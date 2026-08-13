import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createExitDecisionAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { presentRunState } from './run-state';

describe('Run State presentation', () => {
  it('joins catalog labels while retaining technical store and reward keys', () => {
    const state = presentRunState(catalog, {
      owner: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
        kind: 'occurrence',
        occurrenceId: 'x' as never,
      }),
      historySequence: 1,
      checkpoint: 'beforeTargetGeneration',
      godPool: {
        acquiredSourceKeys: ['ApolloUpgrade'],
        effectiveSourceKeys: ['ApolloUpgrade'],
        capNarrowed: true,
      },
      traits: {
        equippedTraits: {
          ApolloWeaponBoon: {
            giverKey: 'Apollo',
            providerKind: 'olympian',
            rarity: 'Rare',
            level: 3,
            sourceRole: 'main',
            traitKey: 'ApolloWeaponBoon',
          },
          StaffDoubleAttackTrait: {
            giverKey: 'WeaponUpgrade',
            hammerRank: 'RankII',
            providerKind: 'hammer',
            sourceRole: 'main',
            traitKey: 'StaffDoubleAttackTrait',
          },
        },
        ordinaryBoonSlots: {
          Melee: {
            giverKey: 'Apollo',
            providerKind: 'olympian',
            rarity: 'Rare',
            level: 3,
            sourceRole: 'main',
            traitKey: 'ApolloWeaponBoon',
          },
        },
        elementCounts: { Aether: 0, Air: 0, Earth: 0, Fire: 0, Water: 0 },
        godBoonRarityCounts: {},
        upgradableTraitCount: 1,
        bannedTraitKeys: ['ApolloSpecialBoon'],
        minimumScalableGodTraitRarity: 'Rare',
      },
      counters: {
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        routeEncounterDepth: 0,
        roomHistoryOrdinal: 0,
        runDepthCache: 0,
        enteredBiomes: 0,
        upgradableTraitCount: 0,
      },
      arcanaFear: {
        arcana: { active: [{ key: 'ChanneledCast', origin: 'temporary', rarity: 'Heroic' }] },
        fear: {
          configuredRanks: { EnemyDamageShrineUpgrade: 2, EnemyHealthShrineUpgrade: 1 },
          configuredTotal: 4,
          disabledVowKeys: ['EnemyDamageShrineUpgrade'],
          effectiveRanks: { EnemyDamageShrineUpgrade: 0, EnemyHealthShrineUpgrade: 1 },
          forfeitConsumed: true,
        },
        events: [],
      },
      keepsakes: {
        currentKey: 'ManaOverTimeRefundKeepsake',
        history: [{ key: 'ManaOverTimeRefundKeepsake', kind: 'start' }],
        removedKeys: [],
        fatedStatus: 'Unknown',
        callingCard: { remainingCharges: 0 },
        experimentalHammer: {
          traitKey: 'StaffDoubleAttackTrait',
          remainingUses: 7,
          acquisitionIdentity: 'experimental-hammer-test',
          active: true,
        },
        figLeaf: { remainingUses: 2, activatedThisBiome: true },
      },
      forfeitStatus: 'consumed',
      bags: [
        {
          storeKey: 'RunProgress',
          remaining: { kind: 'exact', count: 1 },
          entries: [
            {
              rewardType: 'Boon',
              eligibility: 'eligible',
              remaining: { kind: 'exact', count: 1 },
              conditions: [
                {
                  remaining: { kind: 'exact', count: 1 },
                  requirement: { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(state.traits.banned).toEqual([{ key: 'ApolloSpecialBoon', label: 'Nova Flourish' }]);
    expect(state.bags[0]).toMatchObject({ label: 'Major Reward', technicalKey: 'RunProgress' });
    expect(state.bags[0]?.eligible.entries[0]).toMatchObject({
      label: 'Boon',
      technicalKey: 'Boon',
    });
    expect(state.bags[0]?.eligible).toMatchObject({ total: 'x1' });
    expect(state.bags[0]?.eligible.entries[0]?.conditions[0]).toMatchObject({
      technicalKey: 'counterRange',
      explanation: 'Requires biomeDepthCache at least 2.',
    });
    expect(state.godPool).toMatchObject({
      inPool: [{ key: 'ApolloUpgrade', label: 'Apollo' }],
    });
    expect(state.arcana).toEqual([
      { key: 'ChanneledCast', label: 'The Sorceress', origin: 'temporary', rarity: 'Heroic' },
    ]);
    expect(state.fear.forfeitStatus).toBe('consumed');
    expect(state.fear).toMatchObject({
      configuredTotal: 4,
      active: [{ key: 'EnemyHealthShrineUpgrade', label: 'Vow of Grit', rank: 1 }],
      disabled: [{ key: 'EnemyDamageShrineUpgrade', label: 'Vow of Pain', rank: 2 }],
    });
    expect(state.keepsakes).toMatchObject({
      callingCardRemainingCharges: 0,
      experimentalHammerStatus: 'active',
      experimentalHammerTraitLabel: 'Wicked Thrasher',
      experimentalHammerRemainingUses: 7,
      figLeafRemainingUses: 2,
      figLeafActivatedThisBiome: true,
    });
    expect(state.traits).toMatchObject({
      activeMinimumScalableRarity: 'Rare',
      coreSlots: [
        {
          label: 'Attack',
          slotKey: 'Melee',
          trait: {
            label: 'Nova Strike',
            traitKey: 'ApolloWeaponBoon',
            rarity: 'Rare',
            level: 3,
          },
        },
        { label: 'Special', slotKey: 'Secondary' },
        { label: 'Cast', slotKey: 'Ranged' },
        { label: 'Sprint', slotKey: 'Rush' },
        { label: 'Magick', slotKey: 'Mana' },
      ],
      other: [
        {
          hammerRank: 'RankII',
          label: 'Wicked Thrasher',
          traitKey: 'StaffDoubleAttackTrait',
        },
      ],
    });
  });
});
