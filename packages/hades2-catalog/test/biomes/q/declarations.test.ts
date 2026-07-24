import type {
  CountedRewardBinding,
  RewardProducerBinding,
  ShopRewardBinding,
} from '@run-planner/engine/reward-kernel';
import type { LinearBiomeLayout } from '@run-planner/engine/catalog-schema';
import { createDefaultRoomState } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

function requireCounted(binding: RewardProducerBinding | undefined): CountedRewardBinding {
  if (binding?.kind !== 'countedChoice') {
    throw new Error('expected counted reward binding');
  }
  return binding;
}

function requireShop(binding: RewardProducerBinding | undefined): ShopRewardBinding {
  if (binding?.kind !== 'shop') {
    throw new Error('expected shop reward binding');
  }
  return binding;
}

function requireQLayout(): LinearBiomeLayout {
  const layout = catalog.biomeLayouts.byKey.Q;
  if (layout?.kind !== 'LinearBiome') {
    throw new Error('expected Q LinearBiome layout');
  }
  return layout;
}

describe('complete Q catalog', () => {
  it('normalizes the scripted reward-free layout and exact stage pools', () => {
    const rooms = catalog.rooms.values.filter((room) => room.biomeKey === 'Q');
    expect(rooms).toHaveLength(23);

    expect(catalog.biomeLayouts.byKey.Q).toEqual({
      biomeKey: 'Q',
      kind: 'LinearBiome',
      initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
      start: { kind: 'authoredStart', mode: 'fixed', roomGameNames: ['Q_Intro'] },
      entries: [],
      continuation: {
        progressionPolicy: {
          kind: 'staged',
          stages: [
            { key: 'foyer', roomGameNames: ['Q_Combat10', 'Q_Combat11'] },
            {
              key: 'firstFork',
              roomGameNames: ['Q_Combat03', 'Q_Combat05', 'Q_Combat15'],
            },
            { key: 'firstMiniboss', roomGameNames: ['Q_MiniBoss02', 'Q_MiniBoss05'] },
            {
              key: 'ordinary',
              roomGameNames: [
                'Q_Combat01',
                'Q_Combat02',
                'Q_Combat04',
                'Q_Combat06',
                'Q_Combat07',
                'Q_Combat08',
                'Q_Combat09',
                'Q_Combat16',
              ],
            },
            {
              key: 'secondFork',
              roomGameNames: ['Q_Combat12', 'Q_Combat13', 'Q_Combat14'],
            },
            { key: 'secondMiniboss', roomGameNames: ['Q_MiniBoss03', 'Q_MiniBoss04'] },
          ],
        },
        batchPolicy: { kind: 'standard', fields: [] },
        rewardStorePolicy: { kind: 'none' },
        rewardStoreOverrides: [],
      },
      terminal: { kind: 'directTransition', roomGameName: 'Q_PreBoss01' },
      completion: {
        rooms: [{ role: 'boss', roomGameName: 'Q_Boss01' }],
        transitionEffects: [
          { kind: 'resetCounter', axis: 'biomeDepthCache' },
          { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
        ],
      },
      fields: [],
      bounds: { maxBatches: 6, maxTargets: 8 },
    });
  });

  it('preserves the fixed intro and every reward-free combat map explicitly', () => {
    expect(catalog.rooms.byKey.Q_Intro).toMatchObject({
      label: 'Entrance',
      kind: 'Intro',
      mode: { kind: 'authored', templateKey: 'FixedIntro' },
      structuralTags: ['Outdoor'],
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 1, max: 1 },
      },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 1, deadline: 1 },
    });
    expect(catalog.rooms.byKey.Q_Intro?.exits).toEqual([
      {
        index: 1,
        type: 'FortressMainDoor',
        compatibilityPolicyKey: 'Unconstrained',
      },
    ]);

    const twoExitRooms = new Set([
      'Q_Combat03',
      'Q_Combat05',
      'Q_Combat12',
      'Q_Combat13',
      'Q_Combat14',
      'Q_Combat15',
    ]);
    const requirements = new Map<string, unknown>([
      ['Q_Combat01', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2, max: 6 } }],
      ['Q_Combat02', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2, max: 6 } }],
      ['Q_Combat03', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
      ['Q_Combat04', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2, max: 6 } }],
      ['Q_Combat05', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
      ['Q_Combat06', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } }],
      ['Q_Combat07', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
      ['Q_Combat08', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2, max: 6 } }],
      ['Q_Combat09', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } }],
      ['Q_Combat10', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 1, max: 1 } }],
      ['Q_Combat11', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 1, max: 1 } }],
      ['Q_Combat12', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
      ['Q_Combat13', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
      ['Q_Combat14', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
      ['Q_Combat15', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
      ['Q_Combat16', { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } }],
    ]);
    const forces = new Map<string, unknown>([
      ['Q_Combat03', { kind: 'depthWindow', axis: 'biomeDepthCache', start: 2, deadline: 2 }],
      ['Q_Combat05', { kind: 'depthWindow', axis: 'biomeDepthCache', start: 2, deadline: 2 }],
      ['Q_Combat12', { kind: 'depthWindow', axis: 'biomeDepthCache', start: 5, deadline: 5 }],
      ['Q_Combat13', { kind: 'depthWindow', axis: 'biomeDepthCache', start: 5, deadline: 5 }],
      ['Q_Combat14', { kind: 'depthWindow', axis: 'biomeDepthCache', start: 5, deadline: 5 }],
      ['Q_Combat15', { kind: 'depthWindow', axis: 'biomeDepthCache', start: 2, deadline: 2 }],
    ]);

    for (let index = 1; index <= 16; index += 1) {
      const suffix = String(index).padStart(2, '0');
      const gameName = `Q_Combat${suffix}`;
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing normalized room ${gameName}`);
      }
      expect(room).toMatchObject({
        gameName,
        label: `Combat ${suffix}`,
        kind: 'Combat',
        mode: { kind: 'authored', templateKey: 'RewardlessCombat' },
        incomingReward: { kind: 'none' },
        enteredRewardStoreHistory: { kind: 'none' },
        encounterProfileKey: 'SingleCountedCombat',
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1 },
      });
      expect(room.exits).toEqual(
        Array.from({ length: twoExitRooms.has(gameName) ? 2 : 1 }, (_, exitIndex) => ({
          index: exitIndex + 1,
          type: 'TyphonExitDoor',
          compatibilityPolicyKey: 'Unconstrained',
        })),
      );
      expect(room.eligibility).toEqual(requirements.get(gameName));
      expect(room.force).toEqual(forces.get(gameName));
      expect(
        createDefaultRoomState(catalog, room, {
          role: 'ordinary',
          entryActive: true,
        }),
      ).toEqual({ kind: 'none' });
    }
  });

  it('preserves independent repeated miniboss support and encounter-depth asymmetry', () => {
    const expected = [
      ['Q_MiniBoss02', 'Brute', 3, 'MiniBossBrute', true],
      ['Q_MiniBoss05', 'Stalker', 3, 'MiniBossStalker', true],
      ['Q_MiniBoss03', 'Tail', 6, 'BossTyphonTail01', true],
      ['Q_MiniBoss04', 'Eye', 6, 'BossTyphonEye01', false],
    ] as const;

    for (const [gameName, label, forceDepth, baselineEncounterKey, counts] of expected) {
      const room = catalog.rooms.byKey[gameName];
      const reward = requireCounted(room?.incomingReward);
      expect(room).toMatchObject({
        label,
        kind: 'Miniboss',
        mode: { kind: 'authored', templateKey: 'Miniboss' },
        forcedRewardStoreKey: 'TyphonBossRewards',
        enteredRewardStoreHistory: { kind: 'resolvedOffer' },
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1 },
        force: {
          kind: 'depthWindow',
          axis: 'biomeDepthCache',
          start: forceDepth,
          deadline: forceDepth,
        },
      });
      expect(room?.caps.maxCreationsThisRun).toBeUndefined();
      expect(room?.exits).toEqual([
        { index: 1, type: 'TyphonExitDoor', compatibilityPolicyKey: 'Unconstrained' },
      ]);
      expect(reward.storeKeys).toEqual(['TyphonBossRewards']);
      expect(
        createDefaultRoomState(catalog, room!, {
          role: 'ordinary',
          resolvedStoreKey: 'TyphonBossRewards',
          entryActive: true,
        }),
      ).toMatchObject({ kind: 'counted', offer: { rewardType: 'Boon' } });
      expect(catalog.encounterProfiles.byKey[gameName]?.phases).toEqual([
        {
          key: gameName,
          kind: 'miniboss',
          countsEncounterDepth: counts,
          baselineEncounterKey,
        },
      ]);
    }

    expect(requireQLayout().continuation.progressionPolicy).toMatchObject({
      stages: [
        {},
        {},
        { roomGameNames: ['Q_MiniBoss02', 'Q_MiniBoss05'] },
        {},
        {},
        { roomGameNames: ['Q_MiniBoss03', 'Q_MiniBoss04'] },
      ],
    });
  });

  it('connects the direct Summit shop and boss-only repeat-run completion', () => {
    const preboss = catalog.rooms.byKey.Q_PreBoss01;
    expect(preboss).toMatchObject({
      label: 'Preboss',
      kind: 'Preboss',
      mode: { kind: 'authored', templateKey: 'ShopPreboss' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'Shop',
      counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
      eligibility: {
        kind: 'counterRange',
        axis: 'biomeDepthCache',
        range: { min: 7 },
      },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 7, deadline: 7 },
    });
    expect(requireShop(preboss?.incomingReward).shopProfileKey).toBe('Q_WorldShop');
    expect(preboss?.entryOfferPolicy).toBeUndefined();
    expect(preboss?.exits).toEqual([
      { index: 1, type: 'FortressMainDoor', compatibilityPolicyKey: 'Unconstrained' },
    ]);

    expect(catalog.rooms.byKey.Q_Boss01).toMatchObject({
      label: 'Typhon',
      kind: 'Boss',
      mode: { kind: 'derived', classification: 'completion' },
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'Q_Boss01',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1 },
    });
    expect(catalog.encounterProfiles.byKey.Q_Boss01?.phases).toEqual([
      {
        key: 'Q_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossTyphonHead01',
      },
    ]);
    expect(catalog.rooms.byKey.Q_Boss02).toBeUndefined();
    expect(catalog.rooms.byKey.Q_PostBoss01).toBeUndefined();
    expect(catalog.rooms.byKey.Q_Story01).toBeUndefined();
    expect(catalog.rooms.byKey.Q_MiniBoss01).toBeUndefined();
  });

  it('uses the already-audited concrete Q reward stores without a generated base store', () => {
    expect(
      catalog.rewards.stores.byKey.TyphonBossRewards?.entries.map((entry) => entry.rewardType),
    ).toEqual([
      'Boon',
      'Boon',
      'TalentBigDrop',
      'StackUpgradeTriple',
      'WeaponUpgrade',
      'WeaponUpgrade',
    ]);
    expect(catalog.rewards.shops.byKey.Q_WorldShop?.slots.values).toHaveLength(6);
    expect(requireQLayout().continuation.rewardStorePolicy).toEqual({ kind: 'none' });
  });
});
