import { Inject, Injectable, Logger } from '@nestjs/common';

import { Worker } from '../bull-mq';

import { setTimeout } from 'timers/promises';
import { QueueHealthIndicator } from '../../health/queue-health-indicator.service';
export interface INovuWorker {
  readonly DEFAULT_ATTEMPTS: number;
  gracefulShutdown: () => Promise<void>;
  readonly topic: string;
  onModuleDestroy: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  worker: Worker;
}

const LOG_CONTEXT = 'ReadinessService';

@Injectable()
export class ReadinessService {
  constructor(
    @Inject('QUEUE_HEALTH_INDICATORS')
    private healthIndicators: QueueHealthIndicator[]
  ) {}

  async areQueuesEnabled(): Promise<boolean> {
    Logger.log('Enabling queues as workers are meant to be ready', LOG_CONTEXT);

    const retries = 10;
    const delay = 5000;

    for (let i = 1; i < retries + 1; i++) {
      const result = await this.checkServicesHealth();

      if (result) {
        return true;
      }

      Logger.warn(
        {
          attempt: i,
          message: `Some health indicator returned false when checking if queues are enabled ${i}/${retries}`,
        },
        LOG_CONTEXT
      );

      await setTimeout(delay);
    }

    return false;
  }

  private async checkServicesHealth() {
    try {
      const healths = await Promise.all(
        this.healthIndicators.map((health) => health.isHealthy())
      );

      return healths.every((health) => !!health === true);
    } catch (error) {
      Logger.error(
        error,
        'Some health indicator throw an error when checking if queues are enabled',
        LOG_CONTEXT
      );

      return false;
    }
  }

  async pauseWorkers(workers: INovuWorker[]): Promise<void> {
    for (const worker of workers) {
      try {
        Logger.verbose(`Pausing worker ${worker.topic}...`, LOG_CONTEXT);

        await worker.pause();
      } catch (error) {
        Logger.error(
          error,
          `Failed to pause worker ${worker.topic}.`,
          LOG_CONTEXT
        );

        throw error;
      }
    }
  }

  async enableWorkers(workers: INovuWorker[]): Promise<void> {
    const areQueuesEnabled = await this.areQueuesEnabled();

    if (areQueuesEnabled) {
      for (const worker of workers) {
        try {
          Logger.verbose(`Resuming worker ${worker.topic}...`, LOG_CONTEXT);

          await worker.resume();
        } catch (error) {
          Logger.error(
            error,
            `Failed to resume worker ${worker.topic}.`,
            LOG_CONTEXT
          );

          throw error;
        }
      }
    } else {
      const error = new Error('Queues are not enabled');
      Logger.error(error, 'Queues are not enabled', LOG_CONTEXT);
      throw error;
    }
  }
}
