import { Inject, Injectable, Logger } from '@nestjs/common';
const nr = require('newrelic');
import {
  getExecutionLogWorkerOptions,
  INovuWorker,
  PinoLogger,
  storage,
  Store,
  ExecutionLogWorkerService,
  WorkerOptions,
  WorkerProcessor,
  CreateExecutionDetails,
  CreateExecutionDetailsCommand,
  BullMqService,
  WorkflowInMemoryProviderService,
} from '@novu/application-generic';
import { ObservabilityBackgroundTransactionEnum } from '@novu/shared';
const LOG_CONTEXT = 'ExecutionLogWorker';

@Injectable()
export class ExecutionLogWorker extends ExecutionLogWorkerService implements INovuWorker {
  constructor(
    private createExecutionDetails: CreateExecutionDetails,
    public workflowInMemoryProviderService: WorkflowInMemoryProviderService
  ) {
    super(new BullMqService(workflowInMemoryProviderService));

    this.initWorker(this.getWorkerProcessor(), this.getWorkerOptions());
  }

  private getWorkerOptions(): WorkerOptions {
    return getExecutionLogWorkerOptions();
  }

  private getWorkerProcessor(): WorkerProcessor {
    return async ({ data }: { data: CreateExecutionDetailsCommand }) => {
      return await new Promise(async (resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const _this = this;

        Logger.verbose(`Job ${data.jobId} is being inserted into execution details collection`, LOG_CONTEXT);

        nr.startBackgroundTransaction(
          ObservabilityBackgroundTransactionEnum.EXECUTION_LOG_QUEUE,
          'Trigger Engine',
          function () {
            const transaction = nr.getTransaction();

            storage.run(new Store(PinoLogger.root), () => {
              _this.createExecutionDetails
                .execute(data)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                  transaction.end();
                });
            });
          }
        );
      });
    };
  }
}
