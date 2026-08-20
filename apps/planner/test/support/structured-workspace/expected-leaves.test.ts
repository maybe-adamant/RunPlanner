import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createLocalVisitSlotAddress,
  createLocalVisitOrderAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPQProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import {
  expectedWorkspaceEncounterPhaseLeafRequirements,
  expectedWorkspaceLeafRequirements,
} from './expected-leaves';

describe('structured workspace test expectations', () => {
  it('uses exact engine-published support to enumerate top-level and local encounter leaves', () => {
    const project = createRepresentativeNOPQProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete N topology is missing');
    }
    const occurrenceId = nOccurrenceId('combat05');
    const topLevel = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const localOccurrence = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId: nLocalOccurrenceId('combat05', 'sideDoor2') },
      'Encounter',
    );
    const active = new Set([semanticAddressKey(topLevel), semanticAddressKey(localOccurrence)]);

    const requirements = expectedWorkspaceEncounterPhaseLeafRequirements(
      catalog,
      nBiome,
      plan,
      (phase) => (active.has(semanticAddressKey(phase)) ? Object.freeze({}) : undefined),
    );

    expect(requirements.map((requirement) => semanticAddressKey(requirement.address))).toEqual(
      expect.arrayContaining([semanticAddressKey(topLevel), semanticAddressKey(localOccurrence)]),
    );
    expect(requirements).toHaveLength(2);
    const requirementByOwner = new Map(
      requirements.map((requirement) => [semanticAddressKey(requirement.address), requirement]),
    );
    // Gate B makes the main N pool meaningful while the entered side-room
    // retains its independently owned exact editor.
    expect(
      requirementByOwner
        .get(semanticAddressKey(topLevel))
        ?.interactions.map((interaction) => interaction.kind),
    ).toEqual(['encounterPhase']);
    expect(
      requirementByOwner
        .get(semanticAddressKey(localOccurrence))
        ?.interactions.map((interaction) => interaction.kind),
    ).toEqual(['encounterPhase']);
  });

  it('derives Ephyra detail leaves from authored visit order and side generation', () => {
    const localSlot = createLocalVisitSlotAddress(
      nBiome,
      nOccurrenceId('combat10'),
      'sideRooms',
      'sideDoor1',
    );
    const localOccurrenceId = nLocalOccurrenceId('combat10', 'sideDoor1');
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: localSlot,
      generation: 'generated',
    });
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete N topology is missing');
    }
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));
    const sideReward = createIncomingRewardAddress(nBiome, localOccurrenceId);
    const visitOrder = createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat10'), 'sideRooms');
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
    ).toBe(true);
    expect(
      dormant.some(
        (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(localSlot),
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
    const activatedSlot = expectedWorkspaceLeafRequirements(catalog, nBiome, visited).find(
      (requirement) => semanticAddressKey(requirement.address) === semanticAddressKey(localSlot),
    );
    expect(activatedSlot?.interactions.map((interaction) => interaction.kind)).toEqual([
      'localVisitGeneration',
    ]);
    expect(
      expectedWorkspaceLeafRequirements(catalog, nBiome, visited)
        .find(
          (requirement) =>
            semanticAddressKey(requirement.address) === semanticAddressKey(visitOrder),
        )
        ?.interactions.map((interaction) => interaction.kind),
    ).toEqual(['localVisitOrder']);

    const inactiveProject = applyProjectCommand(project, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: localSlot,
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
