import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import type { RewardHistoryState, RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { createTestArcanaFearState } from '../support/arcana-fear';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { bankPathPoints, settlePathScreen } from '../../src/simulation/hex-progress';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';
import {
  applyMoonBeamEquip,
  initializeRewardBranches,
  publicRewardBranch,
} from '../../src/simulation/rewards/processing';

describe('minimal Hex progress', () => {
  const facts = (history: RewardHistoryState): RewardKernelFacts => ({
    requirements: {
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 1,
        encounterDepth: 1,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: {
        biomeUseRecord: history.biomeUseRecord,
        lootTypeHistory: history.lootTypeHistory,
        roomsEntered: {},
        useRecord: history.useRecord,
      },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 1,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 2,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  });

  it('preserves full semantic Path grants and transfers banked points at a writable screen', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const banked = bankPathPoints(initial, 2);
    const settled = settlePathScreen(banked, 3);
    expect(settled.hexProgress).toEqual({ bankedPathPoints: 0, investedPathPoints: 5 });
    expect(publicRewardBranch(settled).hexProgress).toEqual({
      bankedPathPoints: 0,
      investedPathPoints: 5,
    });
  });

  it('applies Moon Beam points and exact priority at each ordinary source frontier', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'SpellTalentKeepsake',
    )[0]!;
    expect(initial.hexProgress).toEqual({ bankedPathPoints: 5, investedPathPoints: 0 });
    expect(initial.rewardPriorities).toEqual(['SpellDrop']);

    const afterSpell = Object.freeze({
      ...initial,
      history: Object.freeze({ ...initial.history, useRecord: Object.freeze({ SpellDrop: 1 }) }),
    });
    const ordinary = applyMoonBeamEquip(catalog, afterSpell, 'SpellTalentKeepsake', 'Heroic');
    expect(ordinary.hexProgress.bankedPathPoints).toBe(12);
    expect(ordinary.rewardPriorities).toEqual(['SpellDrop', 'TalentDrop']);

    const postboss = applyMoonBeamEquip(catalog, afterSpell, 'SpellTalentKeepsake', 'Epic', true);
    expect(postboss.rewardPriorities).toEqual(['SpellDrop', 'TalentBigDrop']);
  });

  it.each([
    ['MinorTalentDrop', 1],
    ['TalentDrop', 3],
    ['TalentBigDrop', 5],
  ] as const)('settles %s only at the shared acquisition frontier', (rewardType, grant) => {
    const initial = bankPathPoints(
      initializeRewardBranches(
        undefined,
        createTestArcanaFearState(),
        catalog,
        'ManaOverTimeRefundKeepsake',
      )[0]!,
      2,
    );
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('hex-path'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomRewardPickup');
    const settlement = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        historySequence: 1,
        source: {
          origin: createAcquisitionEntryAddress(site, 'self'),
          offer: { rewardType },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
        },
      },
      facts,
      new Map(),
    );
    expect(settlement.branches[0]?.hexProgress).toEqual({
      bankedPathPoints: 0,
      investedPathPoints: grant + 2,
    });
  });

  it('banks the ordinary ordered SpellDrop bonus only after its selected spell installs', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('hex-spell'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomRewardPickup');
    const settleSpell = (
      selectedOptionKey: 'option1' | 'option2' | 'option3',
      options: readonly [
        { readonly traitKey: string },
        { readonly traitKey: string },
        { readonly traitKey: string },
      ] = Object.freeze([
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ] as const),
    ) =>
      settleOwnedAcquisitionSite(
        catalog,
        [initial],
        {
          siteOwner: occurrence,
          pointKey: 'roomRewardPickup',
          entryKey: selectedOptionKey,
          historySequence: 1,
          source: {
            origin: createAcquisitionEntryAddress(site, selectedOptionKey),
            offer: { rewardType: 'SpellDrop' },
            producerLifecycleKey: 'RoomReward',
            instanceProvenance: 'free',
            traitOffersByAcquisitionRole: {
              self: {
                kind: 'traits',
                giverKey: 'SpellDrop',
                options,
                selectedOptionKey,
              },
            },
          },
        },
        facts,
        new Map(),
      ).branches[0]!;
    expect(settleSpell('option1').hexProgress.bankedPathPoints).toBe(0);
    expect(settleSpell('option2').hexProgress.bankedPathPoints).toBe(1);
    expect(settleSpell('option3').hexProgress.bankedPathPoints).toBe(2);
    // The bonus is owned by the selected row, not by a spell identity.
    expect(
      settleSpell(
        'option1',
        Object.freeze([
          { traitKey: 'SpellTransformTrait' },
          { traitKey: 'SpellPolymorphTrait' },
          { traitKey: 'SpellMeteorTrait' },
        ] as const),
      ).hexProgress.bankedPathPoints,
    ).toBe(0);
    expect(
      settleSpell(
        'option3',
        Object.freeze([
          { traitKey: 'SpellTransformTrait' },
          { traitKey: 'SpellPolymorphTrait' },
          { traitKey: 'SpellMeteorTrait' },
        ] as const),
      ).hexProgress.bankedPathPoints,
    ).toBe(2);

    const missingChild = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomRewardPickup',
        entryKey: 'missing',
        historySequence: 1,
        source: {
          origin: createAcquisitionEntryAddress(site, 'missing'),
          offer: { rewardType: 'SpellDrop' },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: { self: null },
        },
      },
      facts,
      new Map(),
    );
    expect(missingChild.branches).toEqual([]);
  });

  it('routes Aspect of Selene SpellDrop through the three-point Path settlement without a spell child', () => {
    const loadout = {
      ...createDefaultRouteLoadout(catalog),
      weaponKey: 'WeaponSuit',
      aspectKey: 'SuitHexAspect',
    };
    const initial = initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, loadout),
      catalog,
      'ManaOverTimeRefundKeepsake',
      undefined,
      'Underworld',
      loadout,
    )[0]!;
    expect(initial.hexProgress).toEqual({ bankedPathPoints: 0, investedPathPoints: 0 });
    expect(initial.traitHistory?.equippedSlots.Spell?.traitKey).toBe('SpellMoonBeamTrait');
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'Q'),
      createOccurrenceId('hex-aspect-spell'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomRewardPickup');
    const settled = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        historySequence: 1,
        source: {
          origin: createAcquisitionEntryAddress(site, 'self'),
          offer: { rewardType: 'SpellDrop' },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitContext: { aspectKey: 'SuitHexAspect' },
        },
      },
      facts,
      new Map(),
    ).branches[0]!;
    expect(settled.history.useRecord.SpellDrop).toBe(1);
    expect(settled.hexProgress).toEqual({ bankedPathPoints: 0, investedPathPoints: 3 });
    expect(settled.traitHistory?.events.some((event) => event.kind === 'traitOffer')).toBe(false);

    const laterBig = settleOwnedAcquisitionSite(
      catalog,
      [settled],
      {
        siteOwner: occurrence,
        pointKey: 'laterBig',
        entryKey: 'self',
        historySequence: 2,
        source: {
          origin: createAcquisitionEntryAddress(site, 'self'),
          offer: { rewardType: 'TalentBigDrop' },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
        },
      },
      facts,
      new Map(),
    ).branches[0]!;
    expect(laterBig.hexProgress).toEqual({ bankedPathPoints: 0, investedPathPoints: 8 });
  });
});
