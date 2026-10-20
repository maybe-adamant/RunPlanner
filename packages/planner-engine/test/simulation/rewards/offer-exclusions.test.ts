import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  CountedRewardBinding,
  ResolvedRewardOffer,
  RewardHistoryState,
  RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { createTestArcanaFearState } from '../../support/arcana-fear';
import { initializeTestRewardBranchesForRoute as initializeRewardBranches } from '../../support/arcana-fear';
import {
  explainCohortOfferExclusions,
  explainRewardOfferExclusions,
  processRewardOffer,
  staticCountedOfferExclusion,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../../src/simulation/rewards/offer-generation';
import {
  aggregateRewardOfferExclusions,
  mergeRewardOfferExclusions,
  sourceSupportReason,
  type RewardOfferExclusionReason,
} from '../../../src/simulation/rewards/offer-exclusions';
import {
  notInShopReason,
  shopSlotReason,
  type ShopSlotExclusionInput,
} from '../../../src/simulation/rewards/shop/slot-exclusions';
import { createRewardProducerCandidateResult } from '../../../src/simulation/rewards/producer-frontiers';
import type { RewardBranchState } from '../../../src/simulation/rewards/branch-primitives';

const origin = createBiomeAddress('Underworld', 'F');
const peerOrigin = createOccurrenceAddress(origin, createOccurrenceId('peer'));

function factsFor(history: RewardHistoryState): RewardKernelFacts {
  return {
    requirements: {
      routeKey: 'Underworld',
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
        lifetimeGodUseRecord: history.lifetimeGodUseRecord,
        lifetimeGodPickupRecord: history.lifetimeGodPickupRecord,
      },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: { hubRewardLookup: new Set() },
      offeredRewardTypes: new Set<string>(),
      runDepthCache: 8,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 3,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
      equippedAspectKey: null,
    },
  };
}

function binding(overrides: Partial<CountedRewardBinding> = {}): CountedRewardBinding {
  return {
    kind: 'countedChoice',
    storeKeys: ['RunProgress'],
    eligibleRewardTypes: [],
    ineligibleRewardTypes: [],
    producerLifecycleKey: 'RoomReward',
    ...overrides,
  } as CountedRewardBinding;
}

function context(
  offer: ResolvedRewardOffer,
  options: {
    readonly binding?: CountedRewardBinding | null;
    readonly storeKey?: string;
    readonly peers?: readonly OfferProcessingPeer[];
    readonly origin?: OfferProcessingContext['reward']['origin'];
  } = {},
): OfferProcessingContext {
  const counted = options.binding === null ? undefined : (options.binding ?? binding());
  return {
    catalog,
    reward: {
      origin: options.origin ?? origin,
      offer,
      producerLifecycleKey: 'RoomReward',
      resolvedStoreKey: options.storeKey ?? 'RunProgress',
    },
    ...(counted === undefined ? {} : { binding: counted }),
    historySequence: 1,
    peers: options.peers ?? [],
    facts: (state) => factsFor(state.rewardHistory),
  };
}

function branch(keepsake?: string): RewardBranchState {
  return initializeRewardBranches(undefined, createTestArcanaFearState(), catalog, keepsake)[0]!;
}

function withHistory(
  base: RewardBranchState,
  history: Partial<RewardHistoryState>,
): RewardBranchState {
  return {
    ...base,
    state: { ...base.state, rewardHistory: { ...base.state.rewardHistory, ...history } },
  };
}

function withSpentEntries(base: RewardBranchState, rewardType: string): RewardBranchState {
  const store = catalog.rewards.stores.byKey.RunProgress!;
  return {
    ...base,
    state: {
      ...base.state,
      bags: {
        ...base.state.bags,
        RunProgress: {
          remainingEntryCounts: store.entries.map((entry) =>
            entry.rewardType === rewardType ? 0 : 1,
          ),
        },
      },
    },
  };
}

function explain(branches: readonly RewardBranchState[], offerContext: OfferProcessingContext) {
  expect(processRewardOffer(branches, offerContext, new Map())).toEqual([]);
  return explainRewardOfferExclusions(branches, offerContext);
}

const boon = (source: string): ResolvedRewardOffer => ({
  rewardType: 'Boon',
  payload: { kind: 'BoonSource', source },
});

describe('reward offer exclusion aggregation', () => {
  const spent: RewardOfferExclusionReason = {
    kind: 'entriesSpent',
    rewardType: 'MaxHealthDrop',
    storeKey: 'RunProgress',
  };
  const priority: RewardOfferExclusionReason = {
    kind: 'priorityRequired',
    rewardType: 'Boon',
    storeKey: 'RunProgress',
  };
  const cap: RewardOfferExclusionReason = {
    kind: 'godCap',
    source: 'ZeusUpgrade',
    acquiredSources: [],
    cap: 4,
  };
  const fixed: RewardOfferExclusionReason = { kind: 'rewardTypeFixed', rewardType: 'Boon' };

  it('reports a static cause alone', () => {
    expect(aggregateRewardOfferExclusions([spent, fixed, spent])).toEqual([
      { ...fixed, allBranches: false },
    ]);
  });

  it('ranks by branch count, breaks ties by gate order and caps at two', () => {
    expect(aggregateRewardOfferExclusions([spent, cap, priority, spent])).toEqual([
      { ...spent, allBranches: false },
      { ...cap, allBranches: false },
    ]);
  });

  it('de-duplicates by canonical key and marks reasons held in every branch', () => {
    expect(aggregateRewardOfferExclusions([{ ...spent }, { ...spent }])).toEqual([
      { ...spent, allBranches: true },
    ]);
    expect(aggregateRewardOfferExclusions([spent, undefined])).toEqual([
      { ...spent, allBranches: false },
    ]);
    expect(aggregateRewardOfferExclusions([undefined])).toBeUndefined();
  });

  it('merges every-combined cohorts; a supported cohort keeps reasons partial', () => {
    const failed = { exclusions: [{ ...spent, allBranches: true }] };
    expect(mergeRewardOfferExclusions([failed, failed])).toEqual([{ ...spent, allBranches: true }]);
    expect(mergeRewardOfferExclusions([failed, {}])).toEqual([{ ...spent, allBranches: false }]);
    expect(
      mergeRewardOfferExclusions([failed, { exclusions: [{ ...spent, allBranches: false }] }]),
    ).toEqual([{ ...spent, allBranches: false }]);
  });

  it('publishes exclusions only on an unsupported result', () => {
    const exclusions = [{ ...spent, allBranches: true }];
    expect(createRewardProducerCandidateResult(new Map(), [branch()], exclusions)).toEqual({
      findings: [],
      supported: true,
    });
    expect(createRewardProducerCandidateResult(new Map(), [], exclusions)).toEqual({
      findings: [],
      supported: false,
      exclusions,
    });
  });
});

describe('door and local reward offer exclusions', () => {
  it('names a type the store does not hold', () => {
    expect(explain([branch()], context({ rewardType: 'MetaCurrencyDrop' }))).toEqual([
      {
        kind: 'notInStore',
        rewardType: 'MetaCurrencyDrop',
        storeKey: 'RunProgress',
        allBranches: true,
      },
    ]);
  });

  it('names a type the producer filters out', () => {
    expect(
      explain(
        [branch()],
        context(
          { rewardType: 'MaxHealthDrop' },
          {
            binding: binding({ ineligibleRewardTypes: ['MaxHealthDrop'] }),
          },
        ),
      ),
    ).toEqual([{ kind: 'excludedByProducer', rewardType: 'MaxHealthDrop', allBranches: true }]);
  });

  it('names a type whose store entries exist only on other routes', () => {
    const scoped = {
      rewards: {
        countedStoreFallbackRewardType: 'RoomRewardHealDrop',
        stores: {
          byKey: {
            Store: {
              key: 'Store',
              entries: [{ rewardType: 'Bones', allowDuplicates: false, routeKeys: ['FreshFile'] }],
            },
          },
        },
      },
    } as unknown as Catalog;
    expect(
      staticCountedOfferExclusion(
        scoped,
        binding({ storeKeys: ['Store'] }),
        'Store',
        { rewardType: 'Bones' },
        'Underworld',
      ),
    ).toEqual({ kind: 'offRoute', rewardType: 'Bones', storeKey: 'Store', routeKey: 'Underworld' });
  });

  it('names a qualifying forced reward', () => {
    expect(
      explain(
        [branch()],
        context(
          { rewardType: 'RoomMoneyDrop' },
          {
            binding: binding({ forcedRewards: [{ offer: { rewardType: 'MaxHealthDrop' } }] }),
          },
        ),
      ),
    ).toEqual([
      { kind: 'forcedReward', offer: { rewardType: 'MaxHealthDrop' }, allBranches: true },
    ]);
  });

  it('names the provider an Olympian keepsake forces', () => {
    const [reason] = explain([branch('ForceZeusBoonKeepsake')], context(boon('ApolloUpgrade')))!;
    expect(reason).toEqual({
      kind: 'olympianProviderForced',
      providerKey: catalog.traitGiverByAcquisitionGameName.ZeusUpgrade,
      allBranches: true,
    });
  });

  it('names the queued reward priority', () => {
    expect(
      explain([branch('ForceZeusBoonKeepsake')], context({ rewardType: 'MaxHealthDrop' })),
    ).toEqual([
      { kind: 'priorityRequired', rewardType: 'Boon', storeKey: 'RunProgress', allBranches: true },
    ]);
  });

  it('names an earlier door offering the same god', () => {
    const peer = { origin: peerOrigin, offer: boon('ZeusUpgrade') };
    expect(explain([branch()], context(boon('ZeusUpgrade'), { peers: [peer] }))).toEqual([
      { kind: 'peerConflict', peers: [peer], allBranches: true },
    ]);
  });

  it('names an earlier door offering the same non-repeatable reward', () => {
    const peer = { origin: peerOrigin, offer: { rewardType: 'MaxHealthDrop' } };
    expect(
      explain([branch()], context({ rewardType: 'MaxHealthDrop' }, { peers: [peer] })),
    ).toEqual([{ kind: 'peerConflict', peers: [peer], allBranches: true }]);
  });

  it('names the god cap with the gods already taken', () => {
    const acquired = ['ZeusUpgrade', 'HeraUpgrade', 'PoseidonUpgrade', 'DemeterUpgrade'];
    const capped = withHistory(branch(), {
      lootTypeHistory: Object.fromEntries(acquired.map((source) => [source, 1])),
    });
    expect(explain([capped], context(boon('ApolloUpgrade')))).toEqual([
      {
        kind: 'godCap',
        source: 'ApolloUpgrade',
        acquiredSources: expect.arrayContaining(acquired),
        cap: 4,
        allBranches: true,
      },
    ]);
  });

  it("names a god's unmet loot requirement with its evidence", () => {
    const unused = withHistory(branch(), { lifetimeGodUseRecord: {} });
    expect(explain([unused], context(boon('AphroditeUpgrade')))).toEqual([
      {
        kind: 'godRequirement',
        source: 'AphroditeUpgrade',
        evaluation: {
          kind: 'recordCount',
          satisfied: false,
          record: 'lifetimeGodUseRecord',
          keys: ['PoseidonUpgrade', 'DemeterUpgrade'],
          actual: 0,
          expected: { min: 1 },
        },
        allBranches: true,
      },
    ]);
  });

  it('names a Shop god never picked up while others were', () => {
    const interacted = withHistory(branch(), { lifetimeGodPickupRecord: { ZeusUpgrade: 1 } });
    expect(
      explain(
        [interacted],
        context(
          { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
          {
            binding: null,
          },
        ),
      ),
    ).toEqual([{ kind: 'godNotInteracted', source: 'HeraUpgrade', allBranches: true }]);
  });

  it('names Trial gods not yet acquired', () => {
    const one = withHistory(branch(), { lootTypeHistory: { ZeusUpgrade: 1 } });
    expect(
      explain(
        [one],
        context(
          {
            rewardType: 'Devotion',
            payload: {
              kind: 'DevotionPair',
              chosenSource: 'ZeusUpgrade',
              spurnedSource: 'HeraUpgrade',
            },
          },
          { binding: null },
        ),
      ),
    ).toEqual([{ kind: 'devotionSourceNotAcquired', sources: ['HeraUpgrade'], allBranches: true }]);
  });

  it('names an unmet store-entry requirement with its evidence', () => {
    expect(explain([branch()], context({ rewardType: 'StackUpgrade' }))).toEqual([
      {
        kind: 'entryRequirement',
        rewardType: 'StackUpgrade',
        storeKey: 'RunProgress',
        evaluation: {
          kind: 'counterRange',
          satisfied: false,
          axis: 'upgradableTraitCount',
          actual: 0,
          expected: { min: 1 },
        },
        allBranches: true,
      },
    ]);
  });

  it('names entries spent while the store still offers others', () => {
    expect(
      explain(
        [withSpentEntries(branch(), 'MaxHealthDrop')],
        context({ rewardType: 'MaxHealthDrop' }),
      ),
    ).toEqual([
      {
        kind: 'entriesSpent',
        rewardType: 'MaxHealthDrop',
        storeKey: 'RunProgress',
        allBranches: true,
      },
    ]);
  });

  it('names a store exhausted after both refills', () => {
    expect(
      explain(
        [branch()],
        context(
          { rewardType: 'StackUpgrade' },
          {
            binding: binding({ eligibleRewardTypes: ['StackUpgrade'] }),
          },
        ),
      ),
    ).toEqual([
      {
        kind: 'storeExhausted',
        storeKey: 'RunProgress',
        fallbackRewardType: catalog.rewards.countedStoreFallbackRewardType,
        allBranches: true,
      },
    ]);
  });

  it('reads a reason held in only some branches as depending on earlier rolls', () => {
    const offer = context({ rewardType: 'MaxHealthDrop' });
    expect(
      explain(
        [branch('ForceZeusBoonKeepsake'), withSpentEntries(branch(), 'MaxHealthDrop')],
        offer,
      ),
    ).toEqual([
      { kind: 'priorityRequired', rewardType: 'Boon', storeKey: 'RunProgress', allBranches: false },
      {
        kind: 'entriesSpent',
        rewardType: 'MaxHealthDrop',
        storeKey: 'RunProgress',
        allBranches: false,
      },
    ]);
  });
});

describe('cohort reward offer exclusions', () => {
  const peer = (offer: ResolvedRewardOffer) => context(offer, { origin: peerOrigin });

  it('names the unordered peer an offer supported alone cannot share the cohort with', () => {
    const duplicate = peer({ rewardType: 'MaxHealthDrop' });
    expect(
      explainCohortOfferExclusions(
        [branch()],
        context({ rewardType: 'MaxHealthDrop' }),
        [duplicate, peer({ rewardType: 'StackUpgrade' })],
        'unordered',
      ),
    ).toEqual([
      {
        kind: 'peerConflict',
        peers: [{ origin: peerOrigin, offer: { rewardType: 'MaxHealthDrop' } }],
        allBranches: true,
      },
    ]);
  });

  it('names an earlier peer that spent the only eligible entry', () => {
    expect(
      explainCohortOfferExclusions(
        [branch()],
        context({ rewardType: 'MaxHealthDrop' }),
        [peer({ rewardType: 'MaxHealthDrop' })],
        'peersFirst',
      ),
    ).toEqual([
      {
        kind: 'peerConflict',
        peers: [{ origin: peerOrigin, offer: { rewardType: 'MaxHealthDrop' } }],
        allBranches: true,
      },
    ]);
  });

  it("reports the offer's own cause when it fails alone", () => {
    expect(
      explainCohortOfferExclusions(
        [branch()],
        context({ rewardType: 'MetaCurrencyDrop' }),
        [peer({ rewardType: 'MaxHealthDrop' })],
        'unordered',
      ),
    ).toEqual([
      {
        kind: 'notInStore',
        rewardType: 'MetaCurrencyDrop',
        storeKey: 'RunProgress',
        allBranches: true,
      },
    ]);
  });
});

describe('acquisition-resolved source exclusions', () => {
  it('explains a source resolved at its acquisition role', () => {
    const facts = factsFor({ ...branch().state.rewardHistory, lifetimeGodUseRecord: {} });
    expect(
      sourceSupportReason(
        catalog.rewards,
        { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' } },
        facts,
        { acquisitionRole: 'hiddenSource' },
      ),
    ).toMatchObject({ kind: 'godRequirement', source: 'AphroditeUpgrade' });
  });
});

describe('Shop slot exclusions', () => {
  const profile = catalog.rewards.shops.byKey.SurfaceShop!;
  const facts = factsFor(branch().state.rewardHistory);
  const input = (
    offers: readonly (ResolvedRewardOffer | null)[],
    slotIndex: number,
    excluded?: ReadonlySet<string>,
  ): ShopSlotExclusionInput => ({
    catalog: catalog.rewards,
    profile,
    fixedOffers: offers.map((offer) => (offer === null ? null : { optionKey: null, offer })),
    slotIndex,
    ...(excluded === undefined
      ? {}
      : { constraints: { excludedPurchaseInteractionNames: excluded } }),
    peerAt: (index) =>
      offers[index] === null || offers[index] === undefined
        ? undefined
        : { origin: peerOrigin, offer: offers[index] },
  });

  it('names a slot whose group does not stock the offer', () => {
    expect(notInShopReason(input([null, null, { rewardType: 'Boon' }], 2))).toEqual({
      kind: 'notInShop',
      profileKey: 'SurfaceShop',
      slotIndex: 2,
    });
  });

  it('names the same-group slot a without-replacement draw repeats', () => {
    const health = { rewardType: 'MaxHealthDrop' };
    expect(shopSlotReason(input([null, health, health], 2), facts)).toEqual({
      kind: 'peerConflict',
      peers: [{ origin: peerOrigin, offer: health }],
    });
  });

  it('names the purchase Travel Deal excludes from the restock', () => {
    expect(
      shopSlotReason(
        input([null, { rewardType: 'MaxHealthDrop' }, null], 1, new Set(['MaxHealthDrop'])),
        facts,
      ),
    ).toEqual({ kind: 'shopExcluded', name: 'MaxHealthDrop' });
  });

  it("names a stocked option's unmet requirement", () => {
    expect(
      shopSlotReason(input([null, { rewardType: 'TalentDrop' }, null], 1), {
        requirements: { ...facts.requirements, routeKey: 'FreshFile' },
      }),
    ).toMatchObject({
      kind: 'shopOptionRequirement',
      optionKey: 'TalentDrop',
      rewardType: 'TalentDrop',
      evaluation: { satisfied: false },
    });
  });
});

describe('Shop-only aggregation kinds', () => {
  it('ranks Contract and Shop exclusions by the fixed gate order', () => {
    expect(
      aggregateRewardOfferExclusions([
        { kind: 'shopExcluded', name: 'MaxHealthDrop' },
        { kind: 'contractNotEquipped' },
      ]),
    ).toEqual([
      { kind: 'contractNotEquipped', allBranches: false },
      { kind: 'shopExcluded', name: 'MaxHealthDrop', allBranches: false },
    ]);
  });
});
