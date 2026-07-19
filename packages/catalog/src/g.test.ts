import type {
  CountedRewardBinding,
  FixedRewardBinding,
  RewardProducerBinding,
  ShopRewardBinding,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from './catalog';
import { declarations } from './declarations';
import { catalog } from './index';

function requireCounted(binding: RewardProducerBinding | undefined): CountedRewardBinding {
  if (binding?.kind !== 'countedChoice') {
    throw new Error('expected counted reward binding');
  }
  return binding;
}

function requireFixed(binding: RewardProducerBinding | undefined): FixedRewardBinding {
  if (binding?.kind !== 'fixed') {
    throw new Error('expected fixed reward binding');
  }
  return binding;
}

function requireShop(binding: RewardProducerBinding | undefined): ShopRewardBinding {
  if (binding?.kind !== 'shop') {
    throw new Error('expected shop reward binding');
  }
  return binding;
}

describe('complete G catalog', () => {
  it('normalizes the fixed reward-free intro and G layout', () => {
    const gRooms = catalog.rooms.values.filter((room) => room.biomeStepKey === 'Underworld_G');
    expect(gRooms).toHaveLength(28);

    const intro = catalog.rooms.byKey.G_Intro;
    expect(intro).toMatchObject({
      label: 'Entrance',
      biomeStepKey: 'Underworld_G',
      kind: 'Intro',
      templateKey: 'FixedIntro',
      incomingReward: { kind: 'none' },
      encounterProfileKey: 'FixedIntro',
      counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 0, deadline: 1 },
    });
    expect(intro?.eligibility).toBeUndefined();
    expect(intro?.exits).toEqual([{ index: 1, targetMode: 'generated', type: 'OceanusExitDoor' }]);
    expect(catalog.encounterProfiles.byKey.FixedIntro?.phases).toEqual([]);

    expect(catalog.biomeLayouts.byKey.Underworld_G).toEqual({
      biomeStepKey: 'Underworld_G',
      kind: 'LinearBiome',
      start: { mode: 'fixed', roomGameNames: ['G_Intro'] },
      continuation: {
        defaultBatchRuleKey: 'Standard',
        rewardStorePolicy: {
          kind: 'authoredBaseStore',
          storeKeys: ['RunProgress', 'MetaProgress'],
          defaultStoreKey: 'RunProgress',
        },
        batchStateDefault: null,
      },
      terminal: {
        roomGameName: 'G_PreBoss01',
        transitionRuleKey: 'PrebossEntry',
        exitPolicy: { kind: 'allExitsTerminal' },
      },
      bounds: { maxBatches: 8, maxTargets: 21 },
    });
  });

  it('matches every G combat exit, depth, and reward declaration', () => {
    const expectedRooms = [
      ['G_Combat01', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
      ['G_Combat02', 3, undefined],
      ['G_Combat03', 3, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat04', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
      ['G_Combat05', 3, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
      ['G_Combat06', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
      ['G_Combat07', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
      ['G_Combat08', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
      ['G_Combat09', 3, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat10', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat11', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat12', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat13', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat14', 3, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat15', 3, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat16', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['G_Combat17', 3, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      [
        'G_Combat18',
        3,
        {
          kind: 'all',
          requirements: [
            { kind: 'counterRange', axis: 'biomeDepthCache', range: { max: 3 } },
            { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 2 } },
          ],
        },
      ],
      ['G_Combat19', 2, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
      ['G_Combat20', 3, { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 3 } }],
    ] as const;
    const devotionExclusions = new Set(['G_Combat04', 'G_Combat05', 'G_Combat07', 'G_Combat08']);

    for (const [gameName, exitCount, eligibility] of expectedRooms) {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing normalized room ${gameName}`);
      }
      const reward = requireCounted(room.incomingReward);

      expect(room.label).toBe(gameName.replace('G_', '').replace('Combat', 'Combat '));
      expect(room.kind).toBe('Combat');
      expect(room.templateKey).toBe('StandardCombat');
      expect(room.exits).toEqual(
        Array.from({ length: exitCount }, (_, index) => ({
          index: index + 1,
          targetMode: 'generated',
          type: 'OceanusExitDoor',
        })),
      );
      expect(room.encounterProfileKey).toBe('StandardCombat');
      expect(room.counters).toEqual({ biomeDepthCache: 1, roomHistoryOrdinal: 1 });
      expect(room.caps).toEqual({ maxAppearancesThisBiome: 1 });
      expect(room.eligibility).toEqual(eligibility);
      expect(reward.storeKeys).toEqual(['RunProgress', 'MetaProgress']);
      expect(reward.storeKeys[0]).toBe('RunProgress');
      expect(reward.ineligibleRewardTypes).toEqual(
        devotionExclusions.has(gameName) ? ['Devotion'] : [],
      );
    }
  });

  it('preserves all G miniboss identities, timing, and mutual exclusion', () => {
    const expected = [
      [
        'G_MiniBoss01',
        'Deep Serpent',
        2,
        'MiniBossWaterUnit',
        true,
        ['G_MiniBoss02', 'G_MiniBoss03'],
      ],
      [
        'G_MiniBoss02',
        'King Vermin',
        1,
        'MiniBossCrawler',
        false,
        ['G_MiniBoss01', 'G_MiniBoss03'],
      ],
      ['G_MiniBoss03', 'Hellifish', 2, 'MiniBossJellyfish', true, ['G_MiniBoss01', 'G_MiniBoss02']],
    ] as const;

    for (const [
      gameName,
      label,
      exitCount,
      baselineEncounterKey,
      countsEncounterDepth,
      otherMinibosses,
    ] of expected) {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing normalized room ${gameName}`);
      }
      const reward = requireCounted(room.incomingReward);

      expect(room).toMatchObject({
        label,
        kind: 'Miniboss',
        templateKey: 'Miniboss',
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
        force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 4, deadline: 7 },
      });
      expect(room.exits).toEqual(
        Array.from({ length: exitCount }, (_, index) => ({
          index: index + 1,
          targetMode: 'generated',
          type: 'OceanusExitDoor',
        })),
      );
      expect(reward.storeKeys).toEqual(['RunProgress']);
      expect(reward.allowedRewardTypes).toEqual(['Boon']);
      expect(room.eligibility).toEqual({
        kind: 'all',
        requirements: [
          { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
          {
            kind: 'recordCount',
            record: 'roomsEntered',
            keys: otherMinibosses,
            range: { max: 0 },
          },
        ],
      });
      expect(catalog.encounterProfiles.byKey[gameName]?.phases).toEqual([
        {
          key: gameName,
          kind: 'miniboss',
          countsEncounterDepth,
          baselineEncounterKey,
        },
      ]);
    }
  });

  it('preserves G story, reprieve, and independent midshop windows', () => {
    const story = catalog.rooms.byKey.G_Story01;
    expect(story).toMatchObject({
      label: 'Narcissus',
      kind: 'Story',
      templateKey: 'Story',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 3, max: 6 },
      },
    });
    expect(story?.exits).toEqual([{ index: 1, targetMode: 'generated', type: 'OceanusExitDoor' }]);
    expect(requireFixed(story?.incomingReward).offer).toEqual({ rewardType: 'Story' });

    const reprieve = catalog.rooms.byKey.G_Reprieve01;
    const reprieveReward = requireCounted(reprieve?.incomingReward);
    expect(reprieve).toMatchObject({
      label: 'Fountain',
      kind: 'Reprieve',
      templateKey: 'Fountain',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 4, max: 6 },
      },
    });
    expect(reprieve?.exits).toEqual([
      { index: 1, targetMode: 'generated', type: 'OceanusExitDoor' },
      { index: 2, targetMode: 'generated', type: 'OceanusExitDoor' },
    ]);
    expect(reprieveReward.storeKeys).toEqual(['RunProgress', 'MetaProgress']);
    expect(reprieveReward.storeKeys[0]).toBe('RunProgress');
    expect(reprieveReward.ineligibleRewardTypes).toEqual(['Devotion']);

    const shop = catalog.rooms.byKey.G_Shop01;
    expect(shop).toMatchObject({
      label: 'Midshop',
      kind: 'Shop',
      templateKey: 'Shop',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'all',
        requirements: [
          { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 3, max: 5 } },
          { kind: 'minExits', count: 2 },
        ],
      },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 3, deadline: 6 },
    });
    expect(shop?.exits).toEqual([
      { index: 1, targetMode: 'generated', type: 'OceanusExitDoor' },
      { index: 2, targetMode: 'generated', type: 'OceanusExitDoor' },
    ]);
    expect(requireShop(shop?.incomingReward).shopProfileKey).toBe('WorldShop');
  });

  it('normalizes the G preboss with capacity for two free rewards', () => {
    const preboss = catalog.rooms.byKey.G_PreBoss01;
    const freeReward = requireCounted(preboss?.entryOfferPolicy?.freeReward);

    expect(preboss).toMatchObject({
      label: 'Preboss',
      kind: 'Preboss',
      templateKey: 'ForkedPreboss',
      counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 8 },
      },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 8, deadline: 8 },
      entryOfferPolicy: {
        kind: 'shopThenFillRemainingExits',
        maxFreeRewards: 2,
      },
    });
    expect(preboss?.exits).toEqual([
      { index: 1, targetMode: 'fixedBoss', type: 'OceanusExitDoor' },
    ]);
    expect(requireShop(preboss?.incomingReward).shopProfileKey).toBe('WorldShop');
    expect(freeReward.storeKeys).toEqual(['RunProgress']);
    expect(freeReward.ineligibleRewardTypes).toEqual(['Devotion', 'RoomMoneyDrop']);
  });

  it('rejects a fixed start with more than one room', () => {
    const layout = declarations.biomeLayouts.find(
      (candidate) => candidate.biomeStepKey === 'Underworld_G',
    );
    expect(layout).toBeDefined();
    if (layout === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        biomeLayouts: declarations.biomeLayouts.map((candidate) =>
          candidate.biomeStepKey === 'Underworld_G'
            ? {
                ...layout,
                start: { mode: 'fixed', roomGameNames: ['G_Intro', 'F_Opening01'] },
              }
            : candidate,
        ),
      }),
    ).toThrowError(
      new CatalogContractError(
        'biomeLayouts[1].start.roomGameNames',
        'fixed start must reference exactly one room',
      ),
    );
  });

  it('rejects a FixedIntro with an authored reward producer', () => {
    const intro = declarations.rooms.find((room) => room.gameName === 'G_Intro');
    expect(intro).toBeDefined();
    if (intro === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [
          {
            ...intro,
            incomingReward: {
              kind: 'fixed',
              rewardType: 'Story',
              producerLifecycleKey: 'RoomReward',
            },
          },
        ],
        biomeLayouts: [],
      }),
    ).toThrowError(
      new CatalogContractError(
        'rooms[0].incomingReward.kind',
        'FixedIntro requires reward producer none',
      ),
    );
  });
});
