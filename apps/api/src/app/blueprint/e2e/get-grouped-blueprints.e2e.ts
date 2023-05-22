import { expect } from 'chai';

import { UserSession } from '@novu/testing';
import { NotificationTemplateRepository, EnvironmentRepository } from '@novu/dal';
import { createTemplateFromBlueprint } from './create-blueprint.e2e';
import { GroupedBlueprintResponse } from '../dto/grouped-blueprint.response.dto';

describe('Get grouped notification template blueprints - /blueprints/group-by-category (GET)', async () => {
  let session: UserSession;
  const notificationTemplateRepository: NotificationTemplateRepository = new NotificationTemplateRepository();
  const environmentRepository: EnvironmentRepository = new EnvironmentRepository();

  before(async () => {
    session = new UserSession();
    await session.initialize();
  });

  it('should get the grouped blueprints', async function () {
    const prodEnv = await getProductionEnvironment();

    await createTemplateFromBlueprint({ session, notificationTemplateRepository, prodEnv });

    const data = await session.testAgent.get(`/v1/blueprints/group-by-category`).send();

    expect(data.statusCode).to.equal(200);

    const groupedBlueprints = data.body.data as GroupedBlueprintResponse[];

    expect(groupedBlueprints[0].name).to.equal('General');

    for (const grouped of groupedBlueprints) {
      for (const blueprint of grouped.blueprints) {
        expect(blueprint.isBlueprint).to.equal(true);
        expect(blueprint.name).to.equal('test email template');
        expect(blueprint.description).to.equal('This is a test description');
        expect(blueprint.active).to.equal(false);
        expect(blueprint.critical).to.equal(false);
        expect(blueprint.steps).to.be.exist;
        expect(blueprint.steps[0].active).to.equal(true);
        expect(blueprint.steps[0].template).to.exist;
        expect(blueprint.steps[0].template?.name).to.be.equal('Message Name');
        expect(blueprint.steps[0].template?.subject).to.be.equal('Test email subject');
      }
    }
  });

  async function getProductionEnvironment() {
    return await environmentRepository.findOne({
      _parentId: session.environment._id,
    });
  }
});