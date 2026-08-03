import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNOPQProject, nBiome, nOccurrenceId } from '@run-planner/test-fixtures';
import { expectedWorkspaceLeafRequirements } from './expected-leaves';

describe('structured workspace test expectations', () => {
  it('derives Ephyra detail leaves from authored visit order and side generation', () => {
    const sideChild = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat10'),
      'sideRooms',
      'sideDoor1',
    );
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: sideChild,
      generation: 'generated',
    });
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete N topology is missing');
    }
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));
    const sideReward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat10'),
      'sideRooms',
      'sideDoor1',
    );
    const dormant = expectedWorkspaceLeafRequirements(catalog, nBiome, plan);
    expect(
      dormant.some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(incoming),
      ),
    ).toBe(true);
    expect(
      dormant.some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideReward),
      ),
    ).toBe(false);
    expect(
      dormant.some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideChild),
      ),
    ).toBe(false);

    const visited: AuthoredBiomePlan = {
      ...plan,
      topology: {
        ...plan.topology,
        decisions: plan.topology.decisions.map((decision) =>
          decision.kind !== 'hub'
            ? decision
            : {
                ...decision,
                visitOrder: Object.freeze([...decision.visitOrder.slice(0, -1), 'combat10']),
              },
        ),
      },
    };
    const activatedReward = expectedWorkspaceLeafRequirements(catalog, nBiome, visited).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideReward),
    );
    expect(activatedReward?.interactions.map((interaction) => interaction.kind)).toEqual([
      'reward',
    ]);
    const activatedChild = expectedWorkspaceLeafRequirements(catalog, nBiome, visited).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideChild),
    );
    expect(activatedChild?.interactions.map((interaction) => interaction.kind)).toEqual([
      'sideRoomGeneration',
      'sideRoomEntryOrder',
    ]);

    const inactiveProject = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: sideChild,
      generation: 'notGenerated',
    });
    const inactivePlan = inactiveProject.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (inactivePlan?.topology === null || inactivePlan === undefined) {
      throw new Error('complete inactive N topology is missing');
    }
    const inactiveVisited: AuthoredBiomePlan = {
      ...inactivePlan,
      topology: {
        ...inactivePlan.topology,
        decisions: inactivePlan.topology.decisions.map((decision) =>
          decision.kind !== 'hub'
            ? decision
            : {
                ...decision,
                visitOrder: Object.freeze([...decision.visitOrder.slice(0, -1), 'combat10']),
              },
        ),
      },
    };
    expect(
      expectedWorkspaceLeafRequirements(catalog, nBiome, inactiveVisited).some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(sideReward),
      ),
    ).toBe(false);
  });
});
