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
import {
  applyEchoOlympianRewardPressureReplay,
  applyKeepsakeDisposition,
  advanceCurrentKeepsake,
  consumeOlympianProviderMaterialized,
  createKeepsakeState,
  evaluateCallingCardOffer,
  olympianProviderForOffer,
} from '../../src/simulation/keepsakes';
import {
  consumeOlympianProviderForReachedOffer,
  initializeRewardBranches,
  applyOlympianRewardPressureEquip,
  processOfferGenerationCohort,
  processRewardOffer,
  publicRewardBranch,
} from '../../src/simulation/rewards/processing';
import { appendRewardEvent } from '../../src/simulation/rewards/branch-primitives';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';

const origin = createBiomeAddress('Underworld', 'F');

function factsFor(history: RewardHistoryState): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 2,
        encounterDepth: 7,
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
      runDepthCache: 8,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 3,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

describe('Olympian reward pressure', () => {
  it('retains an unconsumed exact priority through the public cross-biome branch boundary', () => {
    const currentBiome = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;

    expect(currentBiome.rewardPriorities).toEqual(['Boon']);
    expect(currentBiome.bags.RunProgress).toBeUndefined();

    const nextBiome = initializeRewardBranches([publicRewardBranch(currentBiome)])[0]!;
    expect(nextBiome.rewardPriorities).toEqual(['Boon']);
  });

  it('consumes priority at counted generation while leaving force for materialization', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const countedContext = (
      storeKey: 'RunProgress' | 'MetaProgress',
      offer:
        | { readonly rewardType: 'GiftDrop' }
        | {
            readonly rewardType: 'Boon';
            readonly payload: { readonly kind: 'BoonSource'; readonly source: string };
          },
    ) => ({
      catalog,
      reward: {
        origin,
        offer,
        producerLifecycleKey: 'RoomReward',
        resolvedStoreKey: storeKey,
      },
      binding: {
        kind: 'countedChoice' as const,
        storeKeys: [storeKey],
        eligibleRewardTypes: [],
        ineligibleRewardTypes: [],
        allowedRewardTypes: [],
        producerLifecycleKey: 'RoomReward',
      },
      historySequence: 1,
      peers: [],
      facts: (history: RewardHistoryState) => factsFor(history),
    });

    const generated = processRewardOffer(
      [initial],
      countedContext('RunProgress', {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      }),
      new Map(),
    )[0]!;
    expect(generated.rewardPriorities).toEqual([]);
    expect(generated.keepsakes.olympianSources[0]?.remainingForceUses).toBe(1);

    const unsupported = processRewardOffer(
      [initial],
      countedContext('MetaProgress', { rewardType: 'GiftDrop' }),
      new Map(),
    )[0]!;
    expect(unsupported.rewardPriorities).toEqual(['Boon']);
  });

  it("keeps an unordered cohort's consumed priority out of a later counted offer", () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const context = (
      offer:
        | { readonly rewardType: 'MaxHealthDrop' }
        | { readonly rewardType: 'RoomMoneyDrop' }
        | {
            readonly rewardType: 'Boon';
            readonly payload: { readonly kind: 'BoonSource'; readonly source: string };
          },
    ) => ({
      catalog,
      reward: {
        origin,
        offer,
        producerLifecycleKey: 'RoomReward',
        resolvedStoreKey: 'RunProgress',
      },
      binding: {
        kind: 'countedChoice' as const,
        storeKeys: ['RunProgress'],
        eligibleRewardTypes: [],
        ineligibleRewardTypes: [],
        allowedRewardTypes: [],
        producerLifecycleKey: 'RoomReward',
      },
      historySequence: 1,
      peers: [],
      facts: (history: RewardHistoryState) => factsFor(history),
    });
    const boon = context({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
    });
    const maxHealth = context({ rewardType: 'MaxHealthDrop' });

    const cohort = processOfferGenerationCohort([initial], [boon, maxHealth], new Map(), {
      ordering: 'allOffers',
    });
    expect(cohort).toHaveLength(1);
    expect(cohort[0]?.rewardPriorities).toEqual([]);

    const later = processRewardOffer(
      [cohort[0]!],
      context({ rewardType: 'RoomMoneyDrop' }),
      new Map(),
    );
    expect(later).toHaveLength(1);
  });

  it('uses ordinary acquisition order for Boons, Devotion last-source ordering, and preserves a paid source use', () => {
    const ordinary = createKeepsakeState(catalog, 'ForceZeusBoonKeepsake');
    const withGift = applyEchoOlympianRewardPressureReplay(
      catalog,
      ordinary,
      'ForceAresBoonKeepsake',
    );
    expect(olympianProviderForOffer(withGift, [])).toBe('Zeus');
    expect(olympianProviderForOffer(withGift, ['Zeus'])).toBe('Ares');
    expect(olympianProviderForOffer(withGift, [], true, new Set(['Zeus', 'Ares']))).toBe('Ares');

    const paid = consumeOlympianProviderMaterialized(withGift, 'Zeus', 'paid');
    expect(
      paid.olympianSources.find((source) => source.providerKey === 'Zeus')?.remainingForceUses,
    ).toBe(1);
    const free = consumeOlympianProviderMaterialized(paid, 'Zeus', 'free');
    expect(
      free.olympianSources.find((source) => source.providerKey === 'Zeus')?.remainingForceUses,
    ).toBe(0);
    expect(
      free.olympianSources.find((source) => source.providerKey === 'Ares')?.remainingForceUses,
    ).toBe(1);
  });

  it('accepts either authored Devotion pair orientation containing the forced provider', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const branch = Object.freeze({
      ...initial,
      rewardPriorities: Object.freeze([]),
      history: Object.freeze({
        ...initial.history,
        lootTypeHistory: Object.freeze({ ZeusUpgrade: 1, ApolloUpgrade: 1, HeraUpgrade: 1 }),
      }),
    });
    const context = (chosenSource: string, spurnedSource: string) => ({
      catalog,
      reward: {
        origin,
        offer: {
          rewardType: 'Devotion' as const,
          payload: { kind: 'DevotionPair' as const, chosenSource, spurnedSource },
        },
        producerLifecycleKey: 'test',
        resolvedStoreKey: 'RunProgress',
      },
      binding: {
        kind: 'countedChoice' as const,
        storeKeys: ['RunProgress'],
        eligibleRewardTypes: [],
        ineligibleRewardTypes: [],
        allowedRewardTypes: [],
        producerLifecycleKey: 'RoomReward',
      },
      historySequence: 1,
      peers: [],
      facts: (history: RewardHistoryState) => factsFor(history),
    });
    expect(
      processRewardOffer([branch], context('ApolloUpgrade', 'ZeusUpgrade'), new Map()),
    ).toHaveLength(1);
    expect(
      processRewardOffer([branch], context('ZeusUpgrade', 'ApolloUpgrade'), new Map()),
    ).toHaveLength(1);
    const blockedFindings = new Map();
    expect(
      processRewardOffer([branch], context('ApolloUpgrade', 'HeraUpgrade'), blockedFindings),
    ).toEqual([]);
    expect([...blockedFindings.values()]).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ code: 'rewardSourceUnavailable' }),
      }),
    );
  });

  it('does not steer an uncounted fixed god reward', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const findings = new Map();
    const reached = processRewardOffer(
      [initial],
      {
        catalog,
        reward: {
          origin,
          offer: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
          },
          producerLifecycleKey: 'fixed-test',
        },
        historySequence: 1,
        peers: [],
        facts: (history: RewardHistoryState) => factsFor(history),
      },
      findings,
    );

    expect(reached).toHaveLength(1);
    expect([...findings.values()]).toEqual([]);
    expect(reached[0]?.keepsakes.olympianSources[0]?.remainingForceUses).toBe(1);
  });

  it('spends only matching free Boon and Devotion loot from the reached generated-event ledger', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const boon = appendRewardEvent(initial, 1, {
      kind: 'rewardOffered',
      origin,
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    expect(
      consumeOlympianProviderForReachedOffer(catalog, boon, origin, 'paid').keepsakes
        .olympianSources[0]?.remainingForceUses,
    ).toBe(1);
    expect(
      consumeOlympianProviderForReachedOffer(catalog, boon, origin, 'free').keepsakes
        .olympianSources[0]?.remainingForceUses,
    ).toBe(0);

    const devotion = appendRewardEvent(initial, 1, {
      kind: 'rewardOffered',
      origin,
      offer: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
    expect(
      consumeOlympianProviderForReachedOffer(catalog, devotion, origin, 'free').keepsakes
        .olympianSources[0]?.remainingForceUses,
    ).toBe(0);
  });

  it('spends matching force when a Narcissus Blind Box creates its hidden god loot', () => {
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'G'),
      createOccurrenceId('olympian-narcissus'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomExit');
    const entry = createAcquisitionEntryAddress(site, 'mysteryBoon');
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceHestiaBoonKeepsake',
    )[0]!;
    const settlement = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomExit',
        entryKey: 'mysteryBoon',
        historySequence: 1,
        source: {
          origin: entry,
          offer: {
            rewardType: 'BlindBoxLoot',
            payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
          },
          producerLifecycleKey: 'NarcissusPickup',
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: {
            hiddenSource: {
              kind: 'traits',
              giverKey: 'Hestia',
              options: [
                { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
                { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
                { traitKey: 'HestiaCastBoon', rarity: 'Common' },
              ],
              selectedOptionKey: 'option1',
            },
          },
        },
      },
      (history) => factsFor(history),
      new Map(),
    );

    expect(
      settlement.branches[0]?.keepsakes.olympianSources.find(
        (source) => source.providerKey === 'Hestia',
      )?.remainingForceUses,
    ).toBe(0);
  });

  it('spends matching force through the owned settlement of a fixed free god loot object', () => {
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('olympian-fixed-free'),
    );
    const site = createAcquisitionSiteAddress(occurrence, 'roomRewardPickup');
    const entry = createAcquisitionEntryAddress(site, 'source');
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceApolloBoonKeepsake',
    )[0]!;

    const settlement = settleOwnedAcquisitionSite(
      catalog,
      [initial],
      {
        siteOwner: occurrence,
        pointKey: 'roomRewardPickup',
        entryKey: 'source',
        historySequence: 1,
        source: {
          origin: entry,
          offer: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
          },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: {
            source: {
              kind: 'traits',
              giverKey: 'Apollo',
              options: [
                { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
                { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
                { traitKey: 'ApolloCastBoon', rarity: 'Common' },
              ],
              selectedOptionKey: 'option1',
            },
          },
        },
      },
      (history) => factsFor(history),
      new Map(),
    );

    expect(
      settlement.branches[0]?.keepsakes.olympianSources.find(
        (source) => source.providerKey === 'Apollo',
      )?.remainingForceUses,
    ).toBe(0);
  });

  it('treats the 1/2/3 values as source caps and removes a spent Common Echo source', () => {
    const ordinary = createKeepsakeState(catalog, 'ForceZeusBoonKeepsake');
    const spentOrdinaryRarification = evaluateCallingCardOffer(
      catalog,
      ordinary,
      {
        kind: 'traits',
        giverKey: 'Zeus',
        options: [{ traitKey: 'ZeusWeaponBoon', rarity: 'Common' }],
        selectedOptionKey: 'option1',
        rarificationActions: ['option1'],
      },
      true,
    ).state;
    expect(spentOrdinaryRarification.olympianSources[0]?.remainingRarificationUses).toBe(0);
    const cherished = advanceCurrentKeepsake(
      catalog,
      consumeOlympianProviderMaterialized(spentOrdinaryRarification, 'Zeus', 'free'),
      1,
    );
    expect(cherished.olympianSources).toContainEqual(
      expect.objectContaining({
        providerKey: 'Zeus',
        remainingForceUses: 0,
        remainingRarificationUses: 1,
      }),
    );
    const resolved = evaluateCallingCardOffer(
      catalog,
      applyEchoOlympianRewardPressureReplay(catalog, cherished, 'ForceAresBoonKeepsake'),
      {
        kind: 'traits',
        giverKey: 'Ares',
        options: [{ traitKey: 'AresWeaponBoon', rarity: 'Common' }],
        selectedOptionKey: 'option1',
        rarificationActions: ['option1'],
      },
      true,
    );
    expect(resolved.offer.kind === 'traits' && resolved.offer.options[0]?.rarity).toBe('Rare');
    expect(resolved.state.olympianSources).toEqual([
      expect.objectContaining({ providerKey: 'Zeus', origin: 'ordinary', remainingForceUses: 0 }),
    ]);
    expect(
      applyEchoOlympianRewardPressureReplay(catalog, resolved.state, 'ForceAresBoonKeepsake')
        .olympianSources,
    ).toContainEqual(expect.objectContaining({ providerKey: 'Ares', origin: 'echo' }));
  });

  it('keeps duplicate priorities through an ordinary swap and caps a Cherished later equip at Epic', () => {
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const withGift = applyOlympianRewardPressureEquip(
      catalog,
      Object.freeze({
        ...initial,
        keepsakes: applyEchoOlympianRewardPressureReplay(
          catalog,
          initial.keepsakes,
          'ForceAresBoonKeepsake',
        ),
      }),
      'ForceAresBoonKeepsake',
    );
    expect(withGift.rewardPriorities).toEqual(['Boon', 'Boon']);

    const swapped = Object.freeze({
      ...withGift,
      keepsakes: applyKeepsakeDisposition(
        catalog,
        withGift.keepsakes,
        { kind: 'replace', keepsakeKey: 'ManaOverTimeRefundKeepsake' },
        withGift.arcanaFear,
      ),
    });
    expect(swapped.rewardPriorities).toEqual(['Boon', 'Boon']);
    expect(swapped.keepsakes.olympianSources).toEqual([
      expect.objectContaining({ providerKey: 'Ares', origin: 'echo' }),
    ]);

    const later = applyKeepsakeDisposition(
      catalog,
      swapped.keepsakes,
      { kind: 'replace', keepsakeKey: 'ForceApolloBoonKeepsake' },
      swapped.arcanaFear,
      'Heroic',
    );
    expect(later.olympianSources).toContainEqual(
      expect.objectContaining({
        providerKey: 'Apollo',
        origin: 'ordinary',
        maximumSourceRarityLevel: 3,
      }),
    );
  });
});
