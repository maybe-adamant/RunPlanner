import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createExitDecisionAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { presentRunState } from './run-state';

describe('Run State presentation', () => {
  it('joins catalog labels while retaining technical store and reward keys', () => {
    const snapshot = {
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
          AllElementalBoon: {
            giverKey: 'Hera',
            providerKind: 'olympian',
            rarity: 'Legendary',
            sourceRole: 'source',
            traitKey: 'AllElementalBoon',
          },
          ElementalDamageBoon: {
            giverKey: 'Hephaestus',
            providerKind: 'olympian',
            level: 1,
            sourceRole: 'directTraitGrant',
            traitKey: 'ElementalDamageBoon',
          },
          InfernalContractBoon: {
            giverKey: 'InfernalContractBoon',
            providerKind: 'npc',
            sourceRole: 'directTraitGrant',
            traitKey: 'InfernalContractBoon',
          },
          RestockBoon: {
            giverKey: 'Hermes',
            providerKind: 'hermes',
            rarity: 'Epic',
            sourceRole: 'self',
            traitKey: 'RestockBoon',
          },
          EchoRepeatKeepsakeBoon: {
            traitKey: 'EchoRepeatKeepsakeBoon',
            giverKey: 'Echo',
            providerKind: 'npc',
            sourceRole: 'selection',
            acquisitionIdentity: 'echo-gift-test',
            echoRepeatedKeepsakeKey: 'GoldifyKeepsake',
            echoKeepsakeReplayCount: 2,
          },
          StaffDoubleAttackTrait: {
            giverKey: 'WeaponUpgrade',
            hammerRank: 'RankII',
            providerKind: 'hammer',
            sourceRole: 'main',
            traitKey: 'StaffDoubleAttackTrait',
          },
          SpellMoonBeamTrait: {
            giverKey: 'SpellDrop',
            providerKind: 'spell',
            sourceRole: 'directTraitGrant',
            traitKey: 'SpellMoonBeamTrait',
          },
        },
        equippedSlots: {
          Melee: {
            giverKey: 'Apollo',
            providerKind: 'olympian',
            rarity: 'Rare',
            level: 3,
            sourceRole: 'main',
            traitKey: 'ApolloWeaponBoon',
          },
          Spell: {
            giverKey: 'SpellDrop',
            providerKind: 'spell',
            sourceRole: 'directTraitGrant',
            traitKey: 'SpellMoonBeamTrait',
          },
        },
        elementCounts: { Aether: 0, Air: 0, Earth: 0, Fire: 0, Water: 0 },
        godBoonRarityCounts: {},
        upgradableTraitCount: 1,
        bannedTraitKeys: ['ApolloSpecialBoon'],
        properUpbringingActive: true,
        echoShopDuplicateStatus: 'pending',
        steadyGrowth: { ApolloWeaponBoon: { progress: 2, interval: 6 } },
        chaos: { active: [], matured: [] },
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
        arcana: {
          active: [{ key: 'ChanneledCast', origin: 'temporary', rarity: 'Heroic' }],
          artificerUses: [],
        },
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
        currentKey: 'GoldifyKeepsake',
        history: [
          { key: 'ManaOverTimeRefundKeepsake', kind: 'start' },
          { key: 'GoldifyKeepsake', kind: 'replace' },
          { key: 'GoldifyKeepsake', kind: 'retain' },
        ],
        removedKeys: ['ManaOverTimeRefundKeepsake'],
        fatedStatus: 'Unknown',
        olympianSources: [
          {
            keepsakeKey: 'ForceZeusBoonKeepsake',
            providerKey: 'Zeus',
            origin: 'echo',
            acquisitionOrder: 4,
            remainingForceUses: 1,
            remainingRarificationUses: 0,
            maximumSourceRarityLevel: 1,
          },
        ],
        nextOlympianAcquisitionOrder: 5,
        callingCard: { remainingCharges: 0 },
        experimentalHammers: [
          {
            traitKey: 'StaffDoubleAttackTrait',
            remainingUses: 7,
            acquisitionIdentity: 'experimental-hammer-test',
            active: true,
          },
        ],
        figLeaf: { remainingUses: 2, activatedThisBiome: true },
        gorgon: { status: 'pending' as const, rarity: 'Epic' as const },
        phial: { status: 'pending' as const },
        stone: { status: 'pending' as const, origin: 'echo' as const, rank: 'Common' as const },
        transcendentEmbryo: {
          origin: 'echo' as const,
          rarity: 'Heroic' as const,
          progress: 7,
          markedBlessingKey: 'ChaosElementalBlessing',
          markedBlessingAcquisitionIdentity: 'embryo-run-state',
        },
      },
      rewardPriorities: ['Boon', 'Boon'],
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
    } as const;
    const state = presentRunState(catalog, snapshot);
    expect(state.traits.banned).toEqual([{ key: 'ApolloSpecialBoon', label: 'Nova Flourish' }]);
    expect(state.keepsakes.pendingRewardPriorities).toEqual(['Boon', 'Boon']);
    expect(state.keepsakes.olympianSources).toEqual([
      expect.objectContaining({
        providerKey: 'Zeus',
        origin: 'echo',
        forceRemaining: 1,
        rarificationRemaining: 0,
        maximumSourceRarityLevel: 1,
      }),
    ]);
    expect(state.keepsakes.transcendentEmbryo).toEqual({
      origin: 'echo',
      rarity: 'Heroic',
      progress: 7,
      interval: 8,
      markedBlessingLabel: 'Creation',
      markedBlessingAcquisitionIdentity: 'embryo-run-state',
    });
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
      currentLabel: 'Time Piece',
      chronology: [
        { biomeNumber: 1, label: 'Silver Wheel', retained: false },
        { biomeNumber: 2, label: 'Time Piece', retained: false },
        { biomeNumber: 3, label: 'Time Piece', retained: true },
      ],
      callingCardRemainingCharges: 0,
      echoGift: {
        capturedKeepsakeLabel: 'Time Piece',
        replayCount: 2,
        status: 'everyBiome',
      },
      experimentalHammers: [
        {
          status: 'active',
          traitLabel: 'Wicked Thrasher',
          remainingUses: 7,
          acquisitionIdentity: 'experimental-hammer-test',
        },
      ],
      figLeafRemainingUses: 2,
      figLeafActivatedThisBiome: true,
      gorgonStatus: 'pending',
      gorgonRarity: 'Epic',
      phialStatus: 'pending',
      stoneStatus: 'pending',
      stoneOrigin: 'echo',
      stoneRank: 'Common',
    });
    expect(state.traits).toMatchObject({
      properUpbringingActive: true,
      echoShopDuplicateStatus: 'pending',
      coreSlots: [
        {
          label: 'Attack',
          slotKey: 'Melee',
          trait: {
            label: 'Nova Strike',
            traitKey: 'ApolloWeaponBoon',
            rarity: 'Rare',
            level: 3,
            steadyGrowthProgress: 2,
            steadyGrowthInterval: 6,
          },
        },
        { label: 'Special', slotKey: 'Secondary' },
        { label: 'Cast', slotKey: 'Ranged' },
        { label: 'Sprint', slotKey: 'Rush' },
        { label: 'Magick', slotKey: 'Mana' },
        {
          label: 'Spell',
          slotKey: 'Spell',
          trait: { label: 'Sky Fall', traitKey: 'SpellMoonBeamTrait' },
        },
      ],
      other: [
        {
          label: 'All Together',
          rarity: 'Legendary',
          traitKey: 'AllElementalBoon',
        },
        {
          label: 'Martial Art',
          level: 1,
          traitKey: 'ElementalDamageBoon',
        },
        {
          label: 'Infernal Contract',
          traitKey: 'InfernalContractBoon',
        },
        {
          label: 'Travel Deal',
          rarity: 'Epic',
          traitKey: 'RestockBoon',
        },
        {
          label: 'Gift Gift Gift',
          traitKey: 'EchoRepeatKeepsakeBoon',
        },
        {
          hammerRank: 'RankII',
          label: 'Wicked Thrasher',
          traitKey: 'StaffDoubleAttackTrait',
        },
      ],
    });
    expect(
      presentRunState(catalog, {
        ...snapshot,
        traits: { ...snapshot.traits, echoShopDuplicateStatus: 'consumed' },
      }).traits.echoShopDuplicateStatus,
    ).toBe('consumed');
    for (const status of ['pending', 'consumed', 'expired'] as const) {
      const projected = presentRunState(catalog, {
        ...snapshot,
        keepsakes: {
          ...snapshot.keepsakes,
          gorgon: status === 'pending' ? { status, rarity: 'Epic' } : { status },
        },
      });
      expect(projected.keepsakes.gorgonStatus).toBe(status);
      expect(projected.keepsakes.gorgonRarity).toBe(status === 'pending' ? 'Epic' : undefined);
    }
    expect(
      presentRunState(catalog, {
        ...snapshot,
        keepsakes: { ...snapshot.keepsakes, phial: { status: 'consumed' } },
      }).keepsakes.phialStatus,
    ).toBe('consumed');
  });
});
