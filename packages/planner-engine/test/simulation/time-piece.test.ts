import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  applyConcreteAcquisition,
  factsWithHistory,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';

import { createKeepsakeState } from '../../src/simulation/keepsakes';
import {
  applyKeepsakeDisposition,
  refreshKeepsakeFatedStatus,
} from '../../src/simulation/keepsakes';
import { createTestArcanaFearState } from '../support/arcana-fear';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';
import { assessTimePieceConversion } from '../../src/simulation/rewards/acquisition-settlement';
import { type RewardBranchState } from '../../src/simulation/rewards/branch-primitives';

const biome = createBiomeAddress('Underworld', 'F');
const reward = createIncomingRewardAddress(biome, createOccurrenceId('time-piece'));
const siteOwner = createOccurrenceAddress(biome, createOccurrenceId('time-piece'));
const boonOffer = {
  rewardType: 'Boon' as const,
  payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
};

function facts(): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 1,
        biomeEncounterDepth: 1,
        encounterDepth: 1,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: { biomeUseRecord: {}, lootTypeHistory: {}, roomsEntered: {}, useRecord: {} },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 1,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 1,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

function settle(
  value: 'normal' | 'gold',
  branches = initializeTestRewardBranches(),
  instanceProvenance: 'free' | 'paid' = 'free',
  offer: typeof boonOffer | { readonly rewardType: 'SpellDrop' } = boonOffer,
) {
  return settleOwnedAcquisitionSite(
    catalog,
    branches,
    {
      siteOwner,
      pointKey: 'roomRewardPickup',
      entryKey: 'self',
      historySequence: 1,
      source: {
        origin: reward,
        offer,
        producerLifecycleKey: 'RoomReward',
        instanceProvenance,
        dispositionByAcquisitionRole: {
          [offer.rewardType === 'SpellDrop' ? 'self' : 'source']:
            value === 'gold' ? { kind: 'timePiece' } : { kind: 'normal' },
        },
      },
    },
    (history) => factsWithHistory(facts(), history, new Set()),
    new Map(),
  );
}

describe('Time Piece conversions', () => {
  it('suppresses only a converted free concrete role while retaining settlement evidence and consuming one charge', () => {
    const seeded = initializeTestRewardBranches();
    const branches = seeded.map((branch) =>
      Object.freeze({
        ...branch,
        history: applyConcreteAcquisition(catalog.rewards, branch.history, {
          kind: 'resource',
          gameName: 'GiftDrop',
        }),
        keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', branch.arcanaFear),
      }),
    );
    const result = settle('gold', branches);
    const branch = result.branches[0]!;
    expect(branch.keepsakes.timePiece?.remainingCharges).toBe(3);
    expect(branch.history.lootTypeHistory).toEqual({});
    expect(branch.history.lastRewardRecreation?.offer.rewardType).toBe('GiftDrop');
    expect(branch.events).toContainEqual(expect.objectContaining({ kind: 'conversionToGold' }));
    expect(result.roleFrontiers?.[0]?.address).toEqual(
      createAcquisitionRoleAddress(reward, 'source'),
    );
  });

  it('does not award SpellDrop Path points when Time Piece converts the source before acquisition', () => {
    const seeded = initializeTestRewardBranches().map((branch) =>
      Object.freeze({
        ...branch,
        keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', branch.arcanaFear),
      }),
    );
    const result = settle('gold', seeded, 'free', { rewardType: 'SpellDrop' });
    expect(result.branches[0]?.events).toContainEqual(
      expect.objectContaining({ kind: 'conversionToGold' }),
    );
    expect(result.branches[0]?.hexProgress).toEqual({ bankedPathPoints: 0, investedPathPoints: 0 });
    expect(result.branches[0]?.history.useRecord.SpellDrop).toBeUndefined();
  });

  it('keeps an invalid persisted conversion repairable without consuming a charge or suppressing the acquisition', () => {
    const result = settle('gold');
    const branch = result.branches[0]!;
    expect(branch.keepsakes.timePiece).toBeUndefined();
    expect(branch.history.lootTypeHistory).toMatchObject({ ApolloUpgrade: 1 });
    expect([...result.branches]).toHaveLength(1);
  });

  it('admits a capable zero-cost instance and rejects the same capable acquisition when paid', () => {
    const branches = initializeTestRewardBranches().map((branch) =>
      Object.freeze({
        ...branch,
        keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', branch.arcanaFear),
      }),
    );
    const free = settle('gold', branches, 'free');
    expect(free.branches[0]?.keepsakes.timePiece?.remainingCharges).toBe(3);
    expect(free.branches[0]?.events).toContainEqual(
      expect.objectContaining({ kind: 'conversionToGold' }),
    );

    const paid = settle('gold', branches, 'paid');
    expect(paid.branches[0]?.keepsakes.timePiece?.remainingCharges).toBe(4);
    expect(paid.branches[0]?.history.lootTypeHistory).toMatchObject({ ApolloUpgrade: 1 });
    expect(paid.branches[0]?.events).not.toContainEqual(
      expect.objectContaining({ kind: 'conversionToGold' }),
    );
    expect(paid.roleFrontiers?.[0]?.source.instanceProvenance).toBe('paid');
  });

  it('rejects both paid Blind Box roles, including its capable auto-activated hidden source', () => {
    const branch = initializeTestRewardBranches().map((candidate) =>
      Object.freeze({
        ...candidate,
        keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', candidate.arcanaFear),
      }),
    )[0]!;
    const source = {
      origin: reward,
      offer: {
        rewardType: 'BlindBoxLoot' as const,
        payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' as const },
      },
      producerLifecycleKey: 'WorldShop',
      instanceProvenance: 'paid' as const,
    };

    expect(assessTimePieceConversion(catalog, branch, source, 'box', 'purchase')).toMatchObject({
      supported: false,
      evidence: {
        goldConversionEligible: false,
        blocksGoldConversion: false,
        instanceProvenance: 'paid',
      },
    });
    expect(
      assessTimePieceConversion(catalog, branch, source, 'hiddenSource', 'afterUnwrap'),
    ).toMatchObject({
      supported: false,
      evidence: {
        goldConversionEligible: true,
        blocksGoldConversion: true,
        instanceProvenance: 'paid',
      },
    });
    expect(branch.keepsakes.timePiece?.remainingCharges).toBe(4);
  });

  it('exhausts exactly four retained conversions in acquisition order', () => {
    let branches: readonly RewardBranchState[] = initializeTestRewardBranches().map((branch) =>
      Object.freeze({
        ...branch,
        keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', branch.arcanaFear),
      }),
    );
    for (let index = 0; index < 4; index += 1) branches = settle('gold', branches).branches;
    expect(branches[0]?.keepsakes.timePiece?.remainingCharges).toBe(0);
    const fifth = settle('gold', branches);
    expect(fifth.branches[0]?.history.lootTypeHistory).toMatchObject({ ApolloUpgrade: 1 });
  });

  it('retains unused charges through a neutral swap and closes them at the first Unfated transition', () => {
    const arcana = createTestArcanaFearState();
    const initial = createKeepsakeState(catalog, 'GoldifyKeepsake', arcana);
    const neutral = applyKeepsakeDisposition(
      catalog,
      initial,
      { kind: 'replace', keepsakeKey: 'ManaOverTimeRefundKeepsake' },
      arcana,
    );
    expect(neutral.timePiece?.remainingCharges).toBe(4);
    const unfated = refreshKeepsakeFatedStatus(
      catalog,
      neutral,
      createArcanaFearState(catalog, {
        ...createDefaultRouteLoadout(catalog),
        manualArcanaKeys: ['DoorReroll'],
      }),
    );
    expect(unfated.fatedStatus).toBe('Unfated');
    expect(unfated.timePiece?.remainingCharges).toBe(0);
  });
});
