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
import { initializeTestRewardBranchForRoute } from '../../support/arcana-fear';
import {
  countedStoreStanding,
  explainCohortOfferExclusions,
  explainRewardOfferExclusions,
  processRewardOffer,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../../src/simulation/rewards/offer-generation';
import {
  reachedRewardOfferExclusion,
  sourceSupportReason,
  staticCountedOfferExclusion,
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
  return initializeTestRewardBranchForRoute(
    undefined,
    createTestArcanaFearState(),
    catalog,
    keepsake,
  );
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

function explain(reached: RewardBranchState, offerContext: OfferProcessingContext) {
  expect(processRewardOffer(reached, offerContext, new Map())).toBeUndefined();
  return explainRewardOfferExclusions(reached, offerContext);
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
  it("reports the reached state's one reason, or none", () => {
    expect(reachedRewardOfferExclusion(spent)).toEqual([spent]);
    expect(reachedRewardOfferExclusion(undefined)).toBeUndefined();
  });

  it('publishes exclusions only on an unsupported result', () => {
    const exclusions = [spent];
    expect(createRewardProducerCandidateResult(new Map(), branch(), exclusions)).toEqual({
      findings: [],
      supported: true,
    });
    expect(createRewardProducerCandidateResult(new Map(), undefined, exclusions)).toEqual({
      findings: [],
      supported: false,
      exclusions,
    });
  });
});

describe('door and local reward offer exclusions', () => {
  it('names a type the store does not hold', () => {
    expect(explain(branch(), context({ rewardType: 'MetaCurrencyDrop' }))).toEqual([
      {
        kind: 'notInStore',
        rewardType: 'MetaCurrencyDrop',
        storeKey: 'RunProgress',
      },
    ]);
  });

  it('names a type the producer filters out', () => {
    expect(
      explain(
        branch(),
        context(
          { rewardType: 'MaxHealthDrop' },
          {
            binding: binding({ ineligibleRewardTypes: ['MaxHealthDrop'] }),
          },
        ),
      ),
    ).toEqual([{ kind: 'excludedByProducer', rewardType: 'MaxHealthDrop' }]);
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
        branch(),
        context(
          { rewardType: 'RoomMoneyDrop' },
          {
            binding: binding({ forcedRewards: [{ offer: { rewardType: 'MaxHealthDrop' } }] }),
          },
        ),
      ),
    ).toEqual([{ kind: 'forcedReward', offer: { rewardType: 'MaxHealthDrop' } }]);
  });

  it('names the provider an Olympian keepsake forces', () => {
    const [reason] = explain(branch('ForceZeusBoonKeepsake'), context(boon('ApolloUpgrade')))!;
    expect(reason).toEqual({
      kind: 'olympianProviderForced',
      providerKey: catalog.traitGiverByAcquisitionGameName.ZeusUpgrade,
    });
  });

  it('names the queued reward priority', () => {
    expect(
      explain(branch('ForceZeusBoonKeepsake'), context({ rewardType: 'MaxHealthDrop' })),
    ).toEqual([{ kind: 'priorityRequired', rewardType: 'Boon', storeKey: 'RunProgress' }]);
  });

  it('names an earlier door offering the same god', () => {
    const peer = { origin: peerOrigin, offer: boon('ZeusUpgrade') };
    expect(explain(branch(), context(boon('ZeusUpgrade'), { peers: [peer] }))).toEqual([
      { kind: 'peerConflict', peers: [peer] },
    ]);
  });

  it('names an earlier door offering the same non-repeatable reward', () => {
    const peer = { origin: peerOrigin, offer: { rewardType: 'MaxHealthDrop' } };
    expect(explain(branch(), context({ rewardType: 'MaxHealthDrop' }, { peers: [peer] }))).toEqual([
      { kind: 'peerConflict', peers: [peer] },
    ]);
  });

  it('names the god cap with the gods already taken', () => {
    const acquired = ['ZeusUpgrade', 'HeraUpgrade', 'PoseidonUpgrade', 'DemeterUpgrade'];
    const capped = withHistory(branch(), {
      lootTypeHistory: Object.fromEntries(acquired.map((source) => [source, 1])),
    });
    expect(explain(capped, context(boon('ApolloUpgrade')))).toEqual([
      {
        kind: 'godCap',
        source: 'ApolloUpgrade',
        acquiredSources: expect.arrayContaining(acquired),
        cap: 4,
      },
    ]);
  });

  it("names a god's unmet loot requirement with its evidence", () => {
    const unused = withHistory(branch(), { lifetimeGodUseRecord: {} });
    expect(explain(unused, context(boon('AphroditeUpgrade')))).toEqual([
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
      },
    ]);
  });

  it('names a Shop god never picked up while others were', () => {
    const interacted = withHistory(branch(), { lifetimeGodPickupRecord: { ZeusUpgrade: 1 } });
    expect(
      explain(
        interacted,
        context(
          { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
          {
            binding: null,
          },
        ),
      ),
    ).toEqual([{ kind: 'godNotInteracted', source: 'HeraUpgrade' }]);
  });

  it('checks Trial gods before the store entry rule', () => {
    const one = withHistory(branch(), { lootTypeHistory: { ZeusUpgrade: 1 } });
    expect(
      explain(
        one,
        context({
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ZeusUpgrade',
            spurnedSource: 'HeraUpgrade',
          },
        }),
      )?.map((reason) => reason.kind),
    ).toEqual(['devotionSourceNotAcquired']);
  });

  it('names Trial gods not yet acquired', () => {
    const one = withHistory(branch(), { lootTypeHistory: { ZeusUpgrade: 1 } });
    expect(
      explain(
        one,
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
    ).toEqual([
      {
        kind: 'devotionSourceNotAcquired',
        sources: ['HeraUpgrade'],
        acquiredSources: ['ZeusUpgrade'],
        required: 2,
      },
    ]);
  });

  it('names an unmet store-entry requirement with its evidence', () => {
    expect(explain(branch(), context({ rewardType: 'StackUpgrade' }))).toEqual([
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
      },
    ]);
  });

  it('names entries spent while the store still offers others', () => {
    expect(
      explain(
        withSpentEntries(branch(), 'MaxHealthDrop'),
        context({ rewardType: 'MaxHealthDrop' }),
      ),
    ).toEqual([
      {
        kind: 'entriesSpent',
        rewardType: 'MaxHealthDrop',
        storeKey: 'RunProgress',
      },
    ]);
  });

  it('names a store exhausted after both refills', () => {
    expect(
      explain(
        branch(),
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
      },
    ]);
  });
});

describe('cohort reward offer exclusions', () => {
  const peer = (offer: ResolvedRewardOffer) => context(offer, { origin: peerOrigin });

  it('names the later listed peer an offer supported alone leaves without an entry', () => {
    const duplicate = peer({ rewardType: 'MaxHealthDrop' });
    expect(
      explainCohortOfferExclusions(
        branch(),
        context({ rewardType: 'MaxHealthDrop' }),
        { earlier: [], later: [duplicate, peer({ rewardType: 'StackUpgrade' })] },
        'listed',
      ),
    ).toEqual([
      {
        kind: 'peerConflict',
        peers: [{ origin: peerOrigin, offer: { rewardType: 'MaxHealthDrop' } }],
      },
    ]);
  });

  it('names an earlier peer that spent the only eligible entry', () => {
    expect(
      explainCohortOfferExclusions(
        branch(),
        context({ rewardType: 'MaxHealthDrop' }),
        { earlier: [peer({ rewardType: 'MaxHealthDrop' })] },
        'peersFirst',
      ),
    ).toEqual([
      {
        kind: 'peerConflict',
        peers: [{ origin: peerOrigin, offer: { rewardType: 'MaxHealthDrop' } }],
      },
    ]);
  });

  it("reports the offer's own cause when it fails alone", () => {
    expect(
      explainCohortOfferExclusions(
        branch(),
        context({ rewardType: 'MetaCurrencyDrop' }),
        { earlier: [peer({ rewardType: 'MaxHealthDrop' })] },
        'listed',
      ),
    ).toEqual([
      {
        kind: 'notInStore',
        rewardType: 'MetaCurrencyDrop',
        storeKey: 'RunProgress',
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

describe('counted store standing', () => {
  const healthTotal = catalog.rewards.stores.byKey.RunProgress!.entries.filter(
    (entry) => entry.rewardType === 'MaxHealthDrop',
  ).length;

  it("counts the offer type's eligible entries against one base set", () => {
    expect(countedStoreStanding(branch(), context(boon('ZeusUpgrade')))).toEqual({
      remaining: 4,
      total: 4,
    });
  });

  it('counts one fewer after a draw takes an entry of the type', () => {
    const drawn = processRewardOffer(branch(), context(boon('ZeusUpgrade')), new Map());
    expect(countedStoreStanding(drawn, context(boon('ApolloUpgrade')))).toEqual({
      remaining: 3,
      total: 4,
    });
  });

  it('counts none left beside a peer of a type that never repeats', () => {
    const peer = { origin: peerOrigin, offer: { rewardType: 'MaxHealthDrop' } };
    expect(
      countedStoreStanding(branch(), context({ rewardType: 'MaxHealthDrop' }, { peers: [peer] })),
    ).toEqual({ remaining: 0, total: healthTotal });
  });

  it('counts the set the draw appends when nothing eligible is left', () => {
    const spent = branch();
    const store = catalog.rewards.stores.byKey.RunProgress!;
    const empty: RewardBranchState = {
      ...spent,
      state: {
        ...spent.state,
        bags: {
          ...spent.state.bags,
          RunProgress: { remainingEntryCounts: store.entries.map(() => 0) },
        },
      },
    };
    expect(countedStoreStanding(empty, context(boon('ZeusUpgrade')))).toEqual({
      remaining: 4,
      total: 4,
    });
  });

  it('publishes nothing for an uncounted producer or a type the store lacks', () => {
    expect(countedStoreStanding(branch(), context(boon('ZeusUpgrade'), { binding: null }))).toBe(
      undefined,
    );
    expect(countedStoreStanding(branch(), context({ rewardType: 'MetaCurrencyDrop' }))).toBe(
      undefined,
    );
  });

  it('travels on the candidate result whether or not the offer is supported', () => {
    const standing = { remaining: 0, total: healthTotal };
    expect(createRewardProducerCandidateResult(new Map(), undefined, undefined, standing)).toEqual({
      findings: [],
      supported: false,
      countedStore: standing,
    });
  });
});
