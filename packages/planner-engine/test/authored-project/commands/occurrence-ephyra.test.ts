import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceId,
  type LocalVisitDecision,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';

const combatId = createOccurrenceId('round-trip-n-combat02');
const sideDoor1 = createOccurrenceId('round-trip-n-combat02-sideDoor1');
const sideDoor2 = createOccurrenceId('round-trip-n-combat02-sideDoor2');
const order = createLocalVisitOrderAddress(nBiome, combatId, 'sideRooms');

function localVisit(project: ProjectDocument): LocalVisitDecision {
  const decision = project.route.biomes
    .find((biome) => biome.biomeKey === 'N')
    ?.topology?.decisions.find(
      (candidate): candidate is LocalVisitDecision =>
        candidate.kind === 'localVisit' && candidate.sourceOccurrenceId === combatId,
    );
  if (decision === undefined) throw new Error('missing local visit decision');
  return decision;
}

describe('authored-project Ephyra local-visit commands', () => {
  it('replaces generation and exact occurrence visit order and preserves unchanged identity', () => {
    let project = createCompleteNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: createLocalVisitSlotAddress(nBiome, combatId, 'sideRooms', slotKey),
        generation: 'generated',
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order,
      occurrenceIds: [sideDoor2, sideDoor1],
    });

    expect(localVisit(project)).toMatchObject({
      targetsBySlot: {
        sideDoor1: { occurrenceId: sideDoor1, generation: 'generated' },
        sideDoor2: { occurrenceId: sideDoor2, generation: 'generated' },
      },
      visitOrder: [sideDoor2, sideDoor1],
    });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalVisitOrder',
        order,
        occurrenceIds: [sideDoor2, sideDoor1],
      }),
    ).toBe(project);
  });

  it('requires generated, distinct occurrences and removal before disabling generation', () => {
    const initial = createCompleteNProject();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'ReplaceLocalVisitOrder',
        order,
        occurrenceIds: [sideDoor1],
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceLocalVisitOrder' }));

    const generated = applyProjectCommand(initial, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: createLocalVisitSlotAddress(nBiome, combatId, 'sideRooms', 'sideDoor1'),
      generation: 'generated',
    });
    expect(() =>
      applyProjectCommand(generated, catalog, {
        kind: 'ReplaceLocalVisitOrder',
        order,
        occurrenceIds: [sideDoor1, sideDoor1],
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceLocalVisitOrder' }));

    const entered = applyProjectCommand(generated, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order,
      occurrenceIds: [sideDoor1],
    });
    expect(() =>
      applyProjectCommand(entered, catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: createLocalVisitSlotAddress(nBiome, combatId, 'sideRooms', 'sideDoor1'),
        generation: 'notGenerated',
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'SetLocalVisitGeneration' }));

    const cleared = applyProjectCommand(entered, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order,
      occurrenceIds: [],
    });
    const disabled = applyProjectCommand(cleared, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: createLocalVisitSlotAddress(nBiome, combatId, 'sideRooms', 'sideDoor1'),
      generation: 'notGenerated',
    });
    expect(localVisit(disabled).targetsBySlot.sideDoor1).toMatchObject({
      occurrenceId: sideDoor1,
      generation: 'notGenerated',
    });
  });

  it('rejects undeclared local groups and slots at their exact topology owners', () => {
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: createLocalVisitSlotAddress(nBiome, combatId, 'sideRooms', 'sideDoor3'),
        generation: 'generated',
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'SetLocalVisitGeneration' }));
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceLocalVisitOrder',
        order: createLocalVisitOrderAddress(nBiome, combatId, 'other'),
        occurrenceIds: [],
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceLocalVisitOrder' }));
  });
});
