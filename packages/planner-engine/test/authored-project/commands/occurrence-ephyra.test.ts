import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';

const combatId = createOccurrenceId('round-trip-n-combat02');
const group = createLocalChildGroupAddress(nBiome, combatId, 'sideRooms');

function sideRooms(project: ProjectDocument) {
  const state = project.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'N')
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === combatId)?.state;
  if (state?.kind !== 'ephyraCombat') throw new Error('missing Ephyra state');
  return state.sideRooms;
}

describe('authored-project Ephyra occurrence commands', () => {
  it('replaces generation and exact entry order and preserves unchanged identity', () => {
    let project = createCompleteNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(nBiome, combatId, 'sideRooms', slotKey),
        generation: 'generated',
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group,
      enteredSlotKeys: ['sideDoor2', 'sideDoor1'],
    });

    expect(sideRooms(project)).toMatchObject({
      sideDoor1: { generation: 'generated', enteredOrdinal: 2 },
      sideDoor2: { generation: 'generated', enteredOrdinal: 1 },
    });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceSideRoomEntryOrder',
        group,
        enteredSlotKeys: ['sideDoor2', 'sideDoor1'],
      }),
    ).toBe(project);
  });

  it('requires distinct generated slots and removal from entry order before disabling generation', () => {
    const initial = createCompleteNProject();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'ReplaceSideRoomEntryOrder',
        group,
        enteredSlotKeys: ['sideDoor1'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceSideRoomEntryOrder',
        detail: 'sideDoor1 must be generated before it can be entered',
      }),
    );

    const generated = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(nBiome, combatId, 'sideRooms', 'sideDoor1'),
      generation: 'generated',
    });
    expect(() =>
      applyProjectCommand(generated, catalog, {
        kind: 'ReplaceSideRoomEntryOrder',
        group,
        enteredSlotKeys: ['sideDoor1', 'sideDoor1'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceSideRoomEntryOrder',
        detail: 'side-room entry order must contain distinct slots',
      }),
    );

    const entered = applyProjectCommand(generated, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group,
      enteredSlotKeys: ['sideDoor1'],
    });
    expect(() =>
      applyProjectCommand(entered, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(nBiome, combatId, 'sideRooms', 'sideDoor1'),
        generation: 'notGenerated',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceSideRoomGeneration',
        detail: 'remove the side room from entry order before disabling generation',
      }),
    );

    const cleared = applyProjectCommand(entered, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group,
      enteredSlotKeys: [],
    });
    const disabled = applyProjectCommand(cleared, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(nBiome, combatId, 'sideRooms', 'sideDoor1'),
      generation: 'notGenerated',
    });
    expect(sideRooms(disabled).sideDoor1).toMatchObject({
      generation: 'notGenerated',
      enteredOrdinal: null,
    });
  });

  it('rejects undeclared side groups and slots at their exact owners', () => {
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(nBiome, combatId, 'sideRooms', 'sideDoor3'),
        generation: 'generated',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceSideRoomGeneration',
        detail: 'unknown side-room slot sideDoor3',
      }),
    );
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceSideRoomEntryOrder',
        group: createLocalChildGroupAddress(nBiome, combatId, 'other'),
        enteredSlotKeys: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceSideRoomEntryOrder',
        detail: 'N_Combat02 has no side-room group other',
      }),
    );
  });
});
