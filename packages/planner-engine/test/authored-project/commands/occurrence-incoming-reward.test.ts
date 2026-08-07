import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  createGoldenFGHProject,
  createRepresentativeNOProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';

describe('authored-project incoming reward commands', () => {
  it('replaces counted and free-reward offers and preserves unchanged document identity', () => {
    const ephyraId = createOccurrenceId('round-trip-n-combat02');
    const reward = createIncomingRewardAddress(nBiome, ephyraId);
    const initial = createCompleteNProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'MaxManaDropBig' },
    });

    expect(
      changed.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === ephyraId)?.state,
    ).toMatchObject({ kind: 'ephyraCombat', reward: { offer: { rewardType: 'MaxManaDropBig' } } });
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'MaxManaDropBig' },
      }),
    ).toBe(changed);

    const countedId = goldenFOccurrenceId(1, 1);
    const counted = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, countedId),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    expect(
      counted.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === countedId,
      )?.state,
    ).toMatchObject({ kind: 'counted', reward: { offer: { rewardType: 'MetaCurrencyDrop' } } });

    const freeId = createOccurrenceId('golden-h-preboss-free');
    const free = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenHBiome, freeId),
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(
      free.routes[0]?.biomes[2]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === freeId,
      )?.state,
    ).toMatchObject({ kind: 'freeReward', reward: { offer: { rewardType: 'MaxHealthDrop' } } });
  });

  it('replaces only the payload of a declaration-fixed reward', () => {
    const reward = createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion);
    const initial = createRepresentativeNOProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'ApolloUpgrade',
        },
      },
    });

    expect(
      changed.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'O')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === oOccurrenceIds.devotion,
        )?.state,
    ).toMatchObject({
      kind: 'fixed',
      reward: {
        offer: {
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'AphroditeUpgrade',
            spurnedSource: 'ApolloUpgrade',
          },
        },
      },
    });
    expect(() =>
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'WeaponUpgrade' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceIncomingReward',
        detail: 'O_Devotion01 has a fixed reward type',
      }),
    );
  });

  it('rejects occurrences without replaceable incoming reward state', () => {
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-preboss')),
        value: { rewardType: 'Boon' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceIncomingReward',
        detail: 'N_PreBoss01 has no replaceable incoming reward',
      }),
    );
  });
});
