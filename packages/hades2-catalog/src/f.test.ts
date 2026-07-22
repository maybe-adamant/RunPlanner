import type {
  CountedRewardBinding,
  FixedRewardBinding,
  RewardProducerBinding,
  ShopRewardBinding,
} from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from './compiler/createCatalog';
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
    const fRooms = catalog.rooms.values.filter((room) => room.biomeKey === 'F');
    expect(fRooms).toHaveLength(34);
    expect(fRooms.filter((room) => room.kind === 'Opening').map((room) => room.gameName)).toEqual([
      'F_Opening01',
      'F_Opening02',
      'F_Opening03',
    ]);
    expect(fRooms.filter((room) => room.kind === 'Miniboss').map((room) => room.gameName)).toEqual([
      'F_MiniBoss01',
      'F_MiniBoss02',
      'F_MiniBoss03',
    ]);
    expect(
      fRooms
        .filter((room) => !['Opening', 'Combat', 'Miniboss'].includes(room.kind))
        .map((room) => room.gameName),
    ).toEqual(['F_Story01', 'F_Reprieve01', 'F_Shop01', 'F_PreBoss01', 'F_Boss01', 'F_PostBoss01']);

    for (const gameName of ['F_Opening01', 'F_Opening02', 'F_Opening03']) {
      const opening = catalog.rooms.byKey[gameName];
      const reward = requireCounted(opening?.incomingReward);
      expect(opening).toMatchObject({
        label: gameName.replace('F_', '').replace('Opening', 'Opening '),
        kind: 'Opening',
        mode: { kind: 'authored', templateKey: 'FixedOpening' },
        encounterProfileKey: 'F_Opening',
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
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
    const fRooms = catalog.rooms.values.filter((room) => room.biomeKey === 'F');
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
      ['F_Boss01', 1],
      ['F_PostBoss01', 1],
    ]);

    expect(exitCounts.size).toBe(fRooms.length);
    for (const room of fRooms) {
      const exitCount = exitCounts.get(room.gameName);
      if (exitCount === undefined) {
        throw new Error(`missing exit fixture for ${room.gameName}`);
      }
      expect(room.exits).toEqual(
        Array.from({ length: exitCount }, (_, index) => ({
          index: index + 1,
          type: 'ErebusExitDoor',
          compatibilityPolicyKey: 'Unconstrained',
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
        mode: { kind: 'authored', templateKey: 'Miniboss' },
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
      mode: { kind: 'authored', templateKey: 'Story' },
      encounterProfileKey: 'Story',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 4, max: 8 },
      },
    });
    expect(story?.exits).toHaveLength(2);
    expect(storyReward.offer).toEqual({ rewardType: 'Story' });

    const reprieve = catalog.rooms.byKey.F_Reprieve01;
    const reprieveReward = requireCounted(reprieve?.incomingReward);
    expect(reprieve).toMatchObject({
      label: 'Fountain',
      kind: 'Reprieve',
      mode: { kind: 'authored', templateKey: 'Fountain' },
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
    expect(reprieveReward.storeKeys[0]).toBe('RunProgress');
    expect(reprieveReward.ineligibleRewardTypes).toEqual(['Devotion']);

    const shop = catalog.rooms.byKey.F_Shop01;
    const shopReward = requireShop(shop?.incomingReward);
    expect(shop).toMatchObject({
      label: 'Midshop',
      kind: 'Shop',
      mode: { kind: 'authored', templateKey: 'Shop' },
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
    expect(catalog.rewards.shops.byKey.WorldShop?.slots.values).toEqual([
      {
        key: 'Boon',
        label: 'Offer 1',
        groupKey: 'Boon',
        defaultOptionKey: 'RandomLoot',
        defaultOffer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      {
        key: 'MajorNonBoon',
        label: 'Offer 2',
        groupKey: 'MajorNonBoon',
        defaultOptionKey: 'WeaponUpgradeDropEarly',
        defaultOffer: { rewardType: 'WeaponUpgradeDrop' },
      },
      {
        key: 'Minor',
        label: 'Offer 3',
        groupKey: 'Minor',
        defaultOptionKey: 'MaxManaDrop',
        defaultOffer: { rewardType: 'MaxManaDrop' },
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
      mode: { kind: 'authored', templateKey: 'ForkedPreboss' },
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
    expect(preboss?.exits).toEqual([
      { index: 1, type: 'ErebusExitDoor', compatibilityPolicyKey: 'Unconstrained' },
    ]);
    expect(shopReward.shopProfileKey).toBe('WorldShop');
    expect(preboss?.entryOfferPolicy).toMatchObject({
      kind: 'shopThenFillRemainingExits',
      maxFreeRewards: 1,
    });
    expect(freeReward.storeKeys).toEqual(['RunProgress']);
    expect(freeReward.ineligibleRewardTypes).toEqual(['Devotion', 'RoomMoneyDrop']);

    expect(catalog.biomeLayouts.byKey.F).toEqual({
      biomeKey: 'F',
      kind: 'LinearBiome',
      initialCounters: { biomeDepthCache: 0, biomeEncounterDepth: 1 },
      start: {
        kind: 'authoredStart',
        mode: 'oneOf',
        roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
      },
      entries: [],
      continuation: {
        progressionPolicy: { kind: 'eligibilityDriven' },
        batchPolicy: { kind: 'standard', fields: [] },
        rewardStorePolicy: {
          kind: 'authoredBaseStore',
          storeKeys: ['RunProgress', 'MetaProgress'],
          defaultStoreKey: 'RunProgress',
          targetMetaRewardsRatio: 0.315,
          targetMetaRewardsAdjustSpeed: 10,
        },
        rewardStoreOverrides: [],
      },
      terminal: {
        kind: 'forkedTransition',
        roomGameName: 'F_PreBoss01',
        exitPolicy: { kind: 'allExitsTerminal' },
      },
      completion: {
        rooms: [
          { role: 'boss', roomGameName: 'F_Boss01' },
          { role: 'postboss', roomGameName: 'F_PostBoss01' },
        ],
        transitionEffects: [
          { kind: 'resetCounter', axis: 'biomeDepthCache' },
          { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
        ],
      },
      fields: [],
      bounds: { maxBatches: 10, maxTargets: 20 },
    });
  });

  it('declares the F completion tail as derived rooms with no authored leaf state', () => {
    expect(catalog.rooms.byKey.F_Boss01).toMatchObject({
      label: 'Hecate',
      kind: 'Boss',
      mode: { kind: 'derived', classification: 'completion' },
      structuralTags: [],
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'F_Boss01',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      localChildren: [],
    });
    expect(catalog.encounterProfiles.byKey.F_Boss01?.phases).toEqual([
      {
        key: 'F_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossHecate01',
      },
    ]);
    expect(catalog.rooms.byKey.F_PostBoss01).toMatchObject({
      kind: 'PostBoss',
      mode: { kind: 'derived', classification: 'completion' },
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'F_PostBoss01',
    });
  });

  it('rejects a shop slot default outside its authored group', () => {
    const worldShop = declarations.rewardKernel.shops[0];
    expect(worldShop).toBeDefined();
    if (worldShop === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rewardKernel: {
          ...declarations.rewardKernel,
          shops: [
            {
              ...worldShop,
              slots: worldShop.slots.map((slot, index) =>
                index === 0 ? { ...slot, defaultOptionKey: 'MaxHealthDrop' } : slot,
              ),
            },
            ...declarations.rewardKernel.shops.slice(1),
          ],
        },
      }),
    ).toThrowError(
      new CatalogContractError(
        'shops[0].slots[0].defaultOptionKey',
        'unknown option MaxHealthDrop in Boon',
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
        'F_Combat01 must be an authored Opening',
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
