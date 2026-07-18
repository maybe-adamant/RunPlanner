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

describe('complete F catalog', () => {
  it('declares every F opening and special room exactly once', () => {
    expect(catalog.rooms.values).toHaveLength(32);
    expect(
      catalog.rooms.values.filter((room) => room.kind === 'Opening').map((room) => room.gameName),
    ).toEqual(['F_Opening01', 'F_Opening02', 'F_Opening03']);
    expect(
      catalog.rooms.values.filter((room) => room.kind === 'Miniboss').map((room) => room.gameName),
    ).toEqual(['F_MiniBoss01', 'F_MiniBoss02', 'F_MiniBoss03']);
    expect(
      catalog.rooms.values
        .filter((room) => !['Opening', 'Combat', 'Miniboss'].includes(room.kind))
        .map((room) => room.gameName),
    ).toEqual(['F_Story01', 'F_Reprieve01', 'F_Shop01', 'F_PreBoss01']);

    for (const gameName of ['F_Opening01', 'F_Opening02', 'F_Opening03']) {
      const opening = catalog.rooms.byKey[gameName];
      const reward = requireCounted(opening?.incomingReward);
      expect(opening).toMatchObject({
        label: gameName.replace('F_', '').replace('Opening', 'Opening '),
        kind: 'Opening',
        templateKey: 'FixedOpening',
        encounterProfileKey: 'F_Opening',
        counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1 },
      });
      expect(reward.storeKeys).toEqual(['RunProgress']);
      expect(reward.ineligibleRewardTypes).toEqual([
        'Devotion',
        'RoomMoneyDrop',
        'MaxHealthDrop',
        'MaxManaDrop',
      ]);
    }
  });

  it('preserves every F room physical exit in declaration order', () => {
    const exitCounts = new Map<string, number>([
      ['F_Opening01', 1],
      ['F_Opening02', 1],
      ['F_Opening03', 1],
      ['F_Combat01', 1],
      ['F_Combat02', 2],
      ['F_Combat03', 2],
      ['F_Combat04', 2],
      ['F_Combat05', 2],
      ['F_Combat06', 2],
      ['F_Combat07', 2],
      ['F_Combat08', 2],
      ['F_Combat09', 1],
      ['F_Combat10', 1],
      ['F_Combat11', 2],
      ['F_Combat12', 2],
      ['F_Combat13', 2],
      ['F_Combat14', 2],
      ['F_Combat15', 2],
      ['F_Combat16', 2],
      ['F_Combat17', 2],
      ['F_Combat18', 2],
      ['F_Combat19', 2],
      ['F_Combat20', 2],
      ['F_Combat21', 2],
      ['F_Combat22', 2],
      ['F_MiniBoss01', 1],
      ['F_MiniBoss02', 1],
      ['F_MiniBoss03', 1],
      ['F_Story01', 2],
      ['F_Reprieve01', 2],
      ['F_Shop01', 2],
      ['F_PreBoss01', 1],
    ]);

    expect(exitCounts.size).toBe(catalog.rooms.values.length);
    for (const room of catalog.rooms.values) {
      const exitCount = exitCounts.get(room.gameName);
      if (exitCount === undefined) {
        throw new Error(`missing exit fixture for ${room.gameName}`);
      }
      expect(room.exits).toEqual(
        Array.from({ length: exitCount }, (_, index) => ({
          index: index + 1,
          targetMode: room.kind === 'Preboss' ? 'fixedBoss' : 'generated',
          type: 'ErebusExitDoor',
        })),
      );
    }
  });

  it('preserves the three mutually exclusive F miniboss contracts', () => {
    const expected = [
      ['F_MiniBoss01', 'Root-Stalker', 'MiniBossTreant', ['F_MiniBoss02', 'F_MiniBoss03']],
      ['F_MiniBoss02', 'Shadow-Spiller', 'MiniBossFogEmitter', ['F_MiniBoss01', 'F_MiniBoss03']],
      ['F_MiniBoss03', 'Phantom', 'MiniBossAssassin', ['F_MiniBoss01', 'F_MiniBoss02']],
    ] as const;

    for (const [gameName, label, baselineEncounterKey, otherMinibosses] of expected) {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing normalized room ${gameName}`);
      }
      const reward = requireCounted(room.incomingReward);
      const encounter = catalog.encounterProfiles.byKey[room.encounterProfileKey];

      expect(room).toMatchObject({
        label,
        kind: 'Miniboss',
        templateKey: 'Miniboss',
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
        force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 4, deadline: 6 },
      });
      expect(room.exits).toHaveLength(1);
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
      expect(encounter?.phases).toEqual([
        {
          key: gameName,
          kind: 'miniboss',
          countsEncounterDepth: true,
          baselineEncounterKey,
        },
      ]);
    }
  });

  it('preserves F story, reprieve, and midshop behavior', () => {
    const story = catalog.rooms.byKey.F_Story01;
    const storyReward = requireFixed(story?.incomingReward);
    expect(story).toMatchObject({
      label: 'Arachne',
      kind: 'Story',
      templateKey: 'Story',
      encounterProfileKey: 'Story',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 4, max: 8 },
      },
    });
    expect(story?.exits).toHaveLength(2);
    expect(storyReward.reward).toEqual({ rewardType: 'Story' });

    const reprieve = catalog.rooms.byKey.F_Reprieve01;
    const reprieveReward = requireCounted(reprieve?.incomingReward);
    expect(reprieve).toMatchObject({
      label: 'Fountain',
      kind: 'Reprieve',
      templateKey: 'Fountain',
      encounterProfileKey: 'HealthRestore',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 4, max: 8 },
      },
    });
    expect(reprieve?.exits).toHaveLength(2);
    expect(reprieveReward.storeKeys).toEqual(['RunProgress', 'MetaProgress']);
    expect(reprieveReward.defaultStoreKey).toBe('RunProgress');
    expect(reprieveReward.ineligibleRewardTypes).toEqual(['Devotion']);

    const shop = catalog.rooms.byKey.F_Shop01;
    const shopReward = requireShop(shop?.incomingReward);
    expect(shop).toMatchObject({
      label: 'Midshop',
      kind: 'Shop',
      templateKey: 'Shop',
      encounterProfileKey: 'Shop',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'all',
        requirements: [
          {
            kind: 'counterRange',
            axis: 'biomeDepthCache',
            range: { min: 4, max: 6 },
          },
          { kind: 'minExits', count: 2 },
        ],
      },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 4, deadline: 6 },
    });
    expect(shop?.exits).toHaveLength(2);
    expect(shopReward.shopProfileKey).toBe('WorldShop');
  });

  it('normalizes WorldShop as three explicit authored offer slots', () => {
    expect(catalog.shopOptionSets.byKey.WorldShopBoon?.rewardTypes).toEqual([
      'RandomLoot',
      'BlindBoxLoot',
      'ShopHermesUpgrade',
    ]);
    expect(catalog.shopOptionSets.byKey.WorldShopNonBoon?.rewardTypes).toEqual([
      'WeaponUpgradeDrop',
      'RoomRewardHealDrop',
      'MaxHealthDrop',
      'ArmorBoost',
      'MetaCardPointsCommonDrop',
      'MetaCurrencyDrop',
      'GiftDrop',
    ]);
    expect(catalog.shopOptionSets.byKey.WorldShopMinor?.rewardTypes).toEqual([
      'MaxManaDrop',
      'StackUpgrade',
      'StoreRewardRandomStack',
      'SpellDrop',
      'TalentDrop',
    ]);

    expect(catalog.shopProfiles.byKey.WorldShop?.slots.values).toEqual([
      {
        key: 'Boon',
        label: 'Offer 1',
        optionSetKey: 'WorldShopBoon',
        defaultReward: { rewardType: 'RandomLoot', payload: { source: 'ApolloUpgrade' } },
      },
      {
        key: 'MajorNonBoon',
        label: 'Offer 2',
        optionSetKey: 'WorldShopNonBoon',
        defaultReward: { rewardType: 'WeaponUpgradeDrop' },
      },
      {
        key: 'Minor',
        label: 'Offer 3',
        optionSetKey: 'WorldShopMinor',
        defaultReward: { rewardType: 'MaxManaDrop' },
      },
    ]);
  });

  it('models the F preboss offer and linear layout as separate authorities', () => {
    const preboss = catalog.rooms.byKey.F_PreBoss01;
    const shopReward = requireShop(preboss?.incomingReward);
    const freeReward = requireCounted(preboss?.entryOfferPolicy?.freeReward);

    expect(preboss).toMatchObject({
      label: 'Preboss',
      kind: 'Preboss',
      templateKey: 'ForkedPreboss',
      encounterProfileKey: 'Preboss',
      counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 10 },
      },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 10, deadline: 10 },
    });
    expect(preboss?.exits).toEqual([{ index: 1, targetMode: 'fixedBoss', type: 'ErebusExitDoor' }]);
    expect(shopReward.shopProfileKey).toBe('WorldShop');
    expect(preboss?.entryOfferPolicy).toMatchObject({
      kind: 'shopThenFillRemainingExits',
      maxFreeRewards: 1,
    });
    expect(freeReward.storeKeys).toEqual(['RunProgress']);
    expect(freeReward.ineligibleRewardTypes).toEqual(['Devotion', 'RoomMoneyDrop']);

    expect(catalog.biomeLayouts.byKey.Underworld_F).toEqual({
      biomeStepKey: 'Underworld_F',
      kind: 'LinearBiome',
      start: {
        mode: 'oneOf',
        roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
      },
      continuation: { defaultBatchRuleKey: 'Standard' },
      terminal: {
        roomGameName: 'F_PreBoss01',
        transitionRuleKey: 'PrebossEntry',
        exitPolicy: { kind: 'allExitsTerminal' },
      },
      bounds: { maxBatches: 10, maxTargets: 20 },
    });
  });

  it('rejects a shop default outside its authored option set', () => {
    const worldShop = declarations.shopProfiles[0];
    expect(worldShop).toBeDefined();
    if (worldShop === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        shopProfiles: [
          {
            ...worldShop,
            slots: worldShop.slots.map((slot, index) =>
              index === 0 ? { ...slot, defaultRewardType: 'MaxHealthDrop' } : slot,
            ),
          },
        ],
      }),
    ).toThrowError(
      new CatalogContractError(
        'shopProfiles[0].slots[0].defaultRewardType',
        'MaxHealthDrop is not available from WorldShopBoon',
      ),
    );
  });

  it('rejects a layout start that is not an opening in its biome', () => {
    const layout = declarations.biomeLayouts[0];
    expect(layout).toBeDefined();
    if (layout === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        biomeLayouts: [
          {
            ...layout,
            start: { ...layout.start, roomGameNames: ['F_Combat01'] },
          },
        ],
      }),
    ).toThrowError(
      new CatalogContractError(
        'biomeLayouts[0].start.roomGameNames[0]',
        'F_Combat01 must be an Opening in Underworld_F',
      ),
    );
  });

  it('rejects unresolved room references in current-run eligibility', () => {
    const miniboss = declarations.rooms.find((room) => room.gameName === 'F_MiniBoss01');
    expect(miniboss).toBeDefined();
    if (miniboss === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [
          {
            ...miniboss,
            eligibility: {
              kind: 'recordCount',
              record: 'roomsEntered',
              keys: ['F_MissingRoom'],
              range: { max: 0 },
            },
          },
        ],
        biomeLayouts: [],
      }),
    ).toThrowError(
      new CatalogContractError('rooms[0].eligibility.keys[0]', 'unknown room F_MissingRoom'),
    );
  });
});
