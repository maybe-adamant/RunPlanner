import type {
  CountedRewardBinding,
  FixedRewardBinding,
  RewardProducerBinding,
  ShopRewardBinding,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

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

describe('complete dormant P catalog', () => {
  it('normalizes the empty fixed intro and ordinary linear layout', () => {
    const rooms = catalog.rooms.values.filter((room) => room.biomeKey === 'P');
    expect(rooms).toHaveLength(28);

    expect(catalog.rooms.byKey.P_Intro).toEqual({
      gameName: 'P_Intro',
      label: 'Entrance',
      biomeKey: 'P',
      kind: 'Intro',
      mode: { kind: 'authored', templateKey: 'FixedIntro' },
      structuralTags: ['Outdoor'],
      exits: [
        {
          index: 1,
          type: 'OlympusOutdoorExitDoor',
          compatibilityPolicyKey: 'TargetOutdoor',
        },
        {
          index: 2,
          type: 'OlympusOutdoorExitDoor',
          compatibilityPolicyKey: 'TargetOutdoor',
        },
      ],
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'FixedIntro',
      counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
      localChildren: [],
    });
    expect(catalog.encounterProfiles.byKey.FixedIntro?.phases).toEqual([]);

    expect(catalog.biomeLayouts.byKey.P).toEqual({
      biomeKey: 'P',
      kind: 'LinearBiome',
      initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
      start: { kind: 'authoredStart', mode: 'fixed', roomGameNames: ['P_Intro'] },
      entries: [],
      continuation: {
        progressionPolicy: { kind: 'eligibilityDriven' },
        batchPolicy: { kind: 'standard', fields: [] },
        rewardStorePolicy: {
          kind: 'authoredBaseStore',
          storeKeys: ['RunProgress', 'MetaProgress'],
          defaultStoreKey: 'RunProgress',
          targetMetaRewardsRatio: 0.2,
          targetMetaRewardsAdjustSpeed: 10,
        },
        rewardStoreOverrides: [],
      },
      terminal: {
        kind: 'forkedTransition',
        roomGameName: 'P_PreBoss01',
        exitPolicy: { kind: 'allExitsTerminal' },
      },
      completion: {
        rooms: [
          { role: 'boss', roomGameName: 'P_Boss01' },
          { role: 'postboss', roomGameName: 'P_PostBoss01' },
        ],
        transitionEffects: [
          { kind: 'resetCounter', axis: 'biomeDepthCache' },
          { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
        ],
      },
      fields: [],
      bounds: { maxBatches: 9, maxTargets: 18 },
    });
  });

  it('preserves every combat identity, physical exit, tag, and real requirement', () => {
    const outdoor = new Set([
      'P_Combat01',
      'P_Combat03',
      'P_Combat05',
      'P_Combat06',
      'P_Combat11',
      'P_Combat13',
      'P_Combat14',
      'P_Combat16',
      'P_Combat17',
      'P_Combat19',
    ]);
    const requirements = new Map<string, unknown>([
      ['P_Combat01', { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['P_Combat03', { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { max: 4 } }],
      ['P_Combat17', { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
      ['P_Combat18', { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } }],
    ]);

    for (let index = 1; index <= 19; index += 1) {
      const suffix = String(index).padStart(2, '0');
      const gameName = `P_Combat${suffix}`;
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing normalized room ${gameName}`);
      }
      const isOutdoor = outdoor.has(gameName);
      const reward = requireCounted(room.incomingReward);

      expect(room).toMatchObject({
        gameName,
        label: `Combat ${suffix}`,
        kind: 'Combat',
        mode: { kind: 'authored', templateKey: 'StandardCombat' },
        structuralTags: [isOutdoor ? 'Outdoor' : 'Indoor'],
        enteredRewardStoreHistory: { kind: 'resolvedOffer' },
        encounterProfileKey: 'OlympusCombat',
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1 },
      });
      expect(room.exits).toEqual(
        isOutdoor
          ? [
              {
                index: 1,
                type: 'OlympusIndoorExitDoor',
                compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
              },
              {
                index: 2,
                type: 'OlympusOutdoorExitDoor',
                compatibilityPolicyKey: 'TargetOutdoor',
              },
            ]
          : [
              {
                index: 1,
                type: 'OlympusIndoorExitDoor',
                compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
              },
              {
                index: 2,
                type: 'OlympusIndoorExitDoor',
                compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
              },
            ],
      );
      expect(room.eligibility).toEqual(requirements.get(gameName));
      expect(reward.storeKeys).toEqual(['RunProgress', 'MetaProgress']);
      expect(reward.ineligibleRewardTypes).toEqual(['Devotion']);
    }

    expect(catalog.encounterProfiles.byKey.OlympusCombat?.phases).toEqual([
      { key: 'Combat', kind: 'combat', countsEncounterDepth: true },
    ]);
  });

  it('preserves all P special-room producers, windows, and typed exits', () => {
    const story = catalog.rooms.byKey.P_Story01;
    expect(story).toMatchObject({
      label: 'Dionysus',
      kind: 'Story',
      mode: { kind: 'authored', templateKey: 'Story' },
      structuralTags: ['Indoor'],
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
      encounterProfileKey: 'Story',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'all',
        requirements: [
          { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 3 } },
          { kind: 'counterRange', axis: 'biomeDepthCache', range: { max: 7 } },
        ],
      },
    });
    expect(requireFixed(story?.incomingReward).offer).toEqual({ rewardType: 'Story' });
    expect(story?.exits.map((exit) => exit.type)).toEqual([
      'OlympusIndoorExitDoor',
      'OlympusOutdoorExitDoor',
    ]);

    const reprieve = catalog.rooms.byKey.P_Reprieve01;
    expect(reprieve).toMatchObject({
      label: 'Fountain',
      kind: 'Reprieve',
      structuralTags: ['Indoor'],
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
      encounterProfileKey: 'HealthRestore',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 4, max: 7 },
      },
    });
    expect(requireCounted(reprieve?.incomingReward).ineligibleRewardTypes).toEqual(['Devotion']);
    expect(reprieve?.exits.map((exit) => exit.type)).toEqual([
      'OlympusIndoorExitDoor',
      'OlympusIndoorExitDoor',
    ]);

    const shop = catalog.rooms.byKey.P_Shop01;
    expect(shop).toMatchObject({
      label: 'Midshop',
      kind: 'Shop',
      structuralTags: ['Outdoor'],
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
      encounterProfileKey: 'Shop',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      eligibility: {
        kind: 'all',
        requirements: [
          { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 5 } },
          { kind: 'counterRange', axis: 'biomeDepthCache', range: { max: 7 } },
        ],
      },
    });
    expect(requireShop(shop?.incomingReward)).toMatchObject({
      offer: { rewardType: 'Shop' },
      shopProfileKey: 'WorldShop',
    });
    expect(shop?.exits.map((exit) => exit.type)).toEqual([
      'OlympusIndoorExitDoor',
      'OlympusOutdoorExitDoor',
    ]);
  });

  it('preserves miniboss mutual exclusion, predecessor capacity, and encounter asymmetry', () => {
    const expected = [
      [
        'P_MiniBoss01',
        'Talos',
        ['P_MiniBoss02'],
        ['OlympusIndoorExitDoor', 'OlympusIndoorExitDoor'],
        'MiniBossTalos',
        false,
      ],
      [
        'P_MiniBoss02',
        'Mega-Dracon',
        ['P_MiniBoss01'],
        ['OlympusOutdoorExitDoor'],
        'MiniBossDragon',
        true,
      ],
    ] as const;

    for (const [
      gameName,
      label,
      otherMiniboss,
      exitTypes,
      baselineEncounterKey,
      counts,
    ] of expected) {
      const room = catalog.rooms.byKey[gameName];
      const reward = requireCounted(room?.incomingReward);
      expect(room).toMatchObject({
        label,
        kind: 'Miniboss',
        mode: { kind: 'authored', templateKey: 'Miniboss' },
        structuralTags: ['Indoor'],
        forcedRewardStoreKey: 'RunProgress',
        enteredRewardStoreHistory: { kind: 'resolvedOffer' },
        encounterProfileKey: gameName,
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
        eligibility: {
          kind: 'all',
          requirements: [
            { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
            {
              kind: 'recordCount',
              record: 'roomsEntered',
              keys: otherMiniboss,
              range: { max: 0 },
            },
            { kind: 'minExits', count: 2 },
          ],
        },
        force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 4, deadline: 7 },
      });
      expect(room?.exits).toEqual(
        exitTypes.map((type, index) => ({
          index: index + 1,
          type,
          compatibilityPolicyKey:
            type === 'OlympusOutdoorExitDoor' ? 'TargetOutdoor' : 'OutdoorSourceTargetsIndoor',
        })),
      );
      expect(reward.storeKeys).toEqual(['RunProgress']);
      expect(reward.allowedRewardTypes).toEqual(['Boon']);
      expect(catalog.encounterProfiles.byKey[gameName]?.phases).toEqual([
        {
          key: gameName,
          kind: 'miniboss',
          countsEncounterDepth: counts,
          baselineEncounterKey,
        },
      ]);
    }
  });

  it('preserves the exact terminal, one-free-reward capacity, and ordered completion', () => {
    const preboss = catalog.rooms.byKey.P_PreBoss01;
    expect(preboss).toMatchObject({
      label: 'Preboss',
      kind: 'Preboss',
      mode: { kind: 'authored', templateKey: 'ForkedPreboss' },
      structuralTags: ['Indoor', 'Outdoor'],
      forcedRewardStoreKey: 'RunProgress',
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
      encounterProfileKey: 'Preboss',
      counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 9 },
      },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 9, deadline: 9 },
      entryOfferPolicy: { kind: 'shopThenFillRemainingExits', maxFreeRewards: 1 },
    });
    expect(preboss?.exits).toEqual([
      {
        index: 1,
        type: 'OlympusIndoorExitDoor',
        compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
      },
    ]);
    expect(requireShop(preboss?.incomingReward).shopProfileKey).toBe('WorldShop');
    if (preboss?.entryOfferPolicy?.kind !== 'shopThenFillRemainingExits') {
      throw new Error('expected forked P preboss entry policy');
    }
    const freeReward = requireCounted(preboss.entryOfferPolicy.freeReward);
    expect(freeReward.storeKeys).toEqual(['RunProgress']);
    expect(freeReward.ineligibleRewardTypes).toEqual(['Devotion', 'RoomMoneyDrop']);

    expect(catalog.rooms.byKey.P_Boss01).toMatchObject({
      label: 'Prometheus',
      kind: 'Boss',
      mode: { kind: 'derived', classification: 'completion' },
      structuralTags: ['Indoor', 'Outdoor'],
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
      encounterProfileKey: 'P_Boss01',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
    });
    expect(catalog.rooms.byKey.P_Boss01?.exits).toEqual([
      {
        index: 1,
        type: 'OlympusIndoorExitDoor',
        compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
      },
    ]);
    expect(catalog.encounterProfiles.byKey.P_Boss01?.phases).toEqual([
      {
        key: 'P_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossPrometheus01',
      },
    ]);
    expect(catalog.rooms.byKey.P_PostBoss01).toMatchObject({
      label: 'Postboss',
      kind: 'PostBoss',
      mode: { kind: 'derived', classification: 'completion' },
      structuralTags: ['Indoor', 'Outdoor'],
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'P_PostBoss01',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
    });
    expect(catalog.rooms.byKey.P_PostBoss01?.exits).toEqual([
      {
        index: 1,
        type: 'OlympusOutdoorExitDoor',
        compatibilityPolicyKey: 'TargetOutdoor',
      },
    ]);
    expect(catalog.encounterProfiles.byKey.P_PostBoss01?.phases).toEqual([
      {
        key: 'P_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ]);
  });

  it('normalizes source-sensitive Olympus exit policies as catalog data', () => {
    expect(catalog.exitCompatibilityPolicies.byKey.TargetOutdoor).toEqual({
      key: 'TargetOutdoor',
      kind: 'targetHasTag',
      targetTag: 'Outdoor',
    });
    expect(catalog.exitCompatibilityPolicies.byKey.OutdoorSourceTargetsIndoor).toEqual({
      key: 'OutdoorSourceTargetsIndoor',
      kind: 'sourceTagRequiresTargetTag',
      sourceTag: 'Outdoor',
      targetTag: 'Indoor',
    });
    expect(catalog.exitTypes.byKey.OlympusOutdoorExitDoor).toEqual({
      key: 'OlympusOutdoorExitDoor',
      compatibilityPolicyKey: 'TargetOutdoor',
    });
    expect(catalog.exitTypes.byKey.OlympusIndoorExitDoor).toEqual({
      key: 'OlympusIndoorExitDoor',
      compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
    });
  });
});
