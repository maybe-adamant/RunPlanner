import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalRewardAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';

describe('authored-project local reward commands', () => {
  it('replaces a declaration-owned Fields cage and preserves unchanged identity', () => {
    const combatId = createOccurrenceId('golden-h-combat02');
    const reward = createLocalRewardAddress(goldenHBiome, combatId, 'cages', 'cage1');
    const initial = createGoldenFGHProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceLocalReward',
      reward,
      value: { rewardType: 'MaxManaDrop' },
    });

    expect(
      changed.routes[0]?.biomes[2]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === combatId,
      )?.state,
    ).toMatchObject({
      kind: 'fieldsCombat',
      cages: { cage1: { offer: { rewardType: 'MaxManaDrop' } } },
    });
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceLocalReward',
        reward,
        value: { rewardType: 'MaxManaDrop' },
      }),
    ).toBe(changed);
  });

  it('replaces an exact Ephyra side-room reward without changing its local state', () => {
    const combatId = createOccurrenceId('round-trip-n-combat02');
    const reward = createLocalRewardAddress(nBiome, combatId, 'sideRooms', 'sideDoor1');
    const initial = createCompleteNProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceLocalReward',
      reward,
      value: { rewardType: 'RoomMoneyTinyDrop' },
    });
    const state = changed.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === combatId)?.state;

    expect(state).toMatchObject({
      kind: 'ephyraCombat',
      sideRooms: {
        sideDoor1: {
          generation: 'notGenerated',
          enteredOrdinal: null,
          reward: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
        },
      },
    });
  });

  it('rejects undeclared Fields and Ephyra local reward owners', () => {
    expect(() =>
      applyProjectCommand(createGoldenFGHProject(), catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          goldenHBiome,
          createOccurrenceId('golden-h-combat02'),
          'cages',
          'cage4',
        ),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceLocalReward' }));

    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          nBiome,
          createOccurrenceId('round-trip-n-combat02'),
          'sideRooms',
          'sideDoor3',
        ),
        value: { rewardType: 'MaxHealthDropSmall' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceLocalReward',
        detail: 'unknown side-room slot sideDoor3',
      }),
    );
  });
});
