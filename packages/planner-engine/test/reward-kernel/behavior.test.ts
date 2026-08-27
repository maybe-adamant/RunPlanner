import {
  evaluateRequirement,
  type RequirementEvaluationContext,
} from '@run-planner/engine/requirements';
import {
  applyConcreteAcquisition,
  applyOfferProjection,
  beginBiomeRewardHistory,
  beginCurrentRoomRewardHistory,
  consumeCountedOffer,
  createRewardBagState,
  insertExactPriorityIntoBag,
  oldestSupportedRewardPriority,
  createRewardHistoryState,
  evaluateShopGenerationSupport,
  evaluateShopPurchaseAtSlot,
  factsWithHistory,
  findShopGenerationWitnesses,
  isOfferSupportedAtResolutionPoint,
  locallyValidRewardOffers,
  resolveAcquisitionRole,
  simulateShopPurchases,
  supportedPayloads,
  type AuthoredShopOffer,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

const rewardKernelCatalog = catalog.rewards;

function requirementContext(
  overrides: Partial<RequirementEvaluationContext> = {},
): RequirementEvaluationContext {
  return {
    counters: {
      biomeDepthCache: 4,
      biomeEncounterDepth: 2,
      encounterDepth: 7,
      enteredBiomes: 1,
      upgradableTraitCount: 0,
    },
    records: {
      biomeUseRecord: {},
      lootTypeHistory: {},
      roomsEntered: {},
      useRecord: {},
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
    ...overrides,
  };
}

function facts(
  acquiredSources: readonly string[] = [],
  contextOverrides: Partial<RequirementEvaluationContext> = {},
): RewardKernelFacts {
  const runDepthCache = contextOverrides.runDepthCache ?? 8;
  const records = {
    biomeUseRecord: {},
    lootTypeHistory: Object.fromEntries(acquiredSources.map((source) => [source, 1])),
    roomsEntered: {},
    useRecord: {},
  };
  return {
    requirements: requirementContext({ records, ...contextOverrides, runDepthCache }),
  };
}

function shopFacts(enteredBiomes: number): RewardKernelFacts {
  return facts([], {
    counters: { ...requirementContext().counters, enteredBiomes },
  });
}

function historyFromSources(sources: readonly string[]): RewardHistoryState {
  const counts = Object.freeze(Object.fromEntries(sources.map((source) => [source, 1])));
  const baseline = createRewardHistoryState();
  return Object.freeze({
    ...baseline,
    offerHistory: [],
    useRecord: counts,
    biomeUseRecord: counts,
    currentRoomUseRecord: counts,
    lootTypeHistory: counts,
    lootBiomeRecord: counts,
    consumableRecord: {},
  });
}

describe('source support', () => {
  const boonType = rewardKernelCatalog.rewardTypes.byKey.Boon!;
  const devotionType = rewardKernelCatalog.rewardTypes.byKey.Devotion!;

  it('uses the four-source cap and peer exclusion with the exhaustion fallback', () => {
    expect(supportedPayloads(rewardKernelCatalog, boonType, facts())).toHaveLength(9);
    expect(
      supportedPayloads(
        rewardKernelCatalog,
        boonType,
        facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']),
      ),
    ).toEqual([
      { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      { kind: 'BoonSource', source: 'ApolloUpgrade' },
      { kind: 'BoonSource', source: 'AresUpgrade' },
      { kind: 'BoonSource', source: 'ZeusUpgrade' },
    ]);
    expect(
      supportedPayloads(
        rewardKernelCatalog,
        boonType,
        facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']),
        {
          priorOffers: [
            {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
            },
          ],
        },
      ),
    ).not.toContainEqual({ kind: 'BoonSource', source: 'ApolloUpgrade' });
    const peerCapFallback = supportedPayloads(rewardKernelCatalog, boonType, facts(), {
      priorOffers: ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade'].map(
        (source) => ({
          rewardType: 'Boon',
          payload: { kind: 'BoonSource' as const, source },
        }),
      ),
    });
    expect(peerCapFallback).toHaveLength(9);
    expect(peerCapFallback).toContainEqual({
      kind: 'BoonSource',
      source: 'AphroditeUpgrade',
    });
    expect(peerCapFallback).toContainEqual({
      kind: 'BoonSource',
      source: 'HestiaUpgrade',
    });
    expect(
      supportedPayloads(
        rewardKernelCatalog,
        boonType,
        facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']),
        {
          priorOffers: ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade'].map(
            (source) => ({
              rewardType: 'Boon',
              payload: { kind: 'BoonSource' as const, source },
            }),
          ),
        },
      ),
    ).toEqual([
      { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      { kind: 'BoonSource', source: 'ApolloUpgrade' },
      { kind: 'BoonSource', source: 'AresUpgrade' },
      { kind: 'BoonSource', source: 'ZeusUpgrade' },
    ]);
  });

  it('constructs ordered Devotion roles from distinct acquired ordinary sources', () => {
    expect(
      supportedPayloads(rewardKernelCatalog, devotionType, facts(['ApolloUpgrade', 'ZeusUpgrade'])),
    ).toEqual([
      {
        kind: 'DevotionPair',
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
      {
        kind: 'DevotionPair',
        chosenSource: 'ZeusUpgrade',
        spurnedSource: 'ApolloUpgrade',
      },
    ]);
  });

  it('defers Blind Box hidden-source support from shop generation to acquisition', () => {
    const blindBox = {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource' as const, source: 'HestiaUpgrade' },
    };
    const capped = facts(['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade']);
    expect(isOfferSupportedAtResolutionPoint(rewardKernelCatalog, blindBox, capped, 'offer')).toBe(
      true,
    );
    expect(
      isOfferSupportedAtResolutionPoint(rewardKernelCatalog, blindBox, capped, {
        acquisitionRole: 'hiddenSource',
      }),
    ).toBe(false);
  });
});

describe('Echo last-reward acquisition history', () => {
  it('retains the latest eligible exact source while ignoring nonparticipating pickups and Blind Box identity', () => {
    let history = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'resource',
      gameName: 'GiftDrop',
    });
    expect(history.lastRewardRecreation).toEqual({
      offer: { rewardType: 'GiftDrop' },
      producerLifecycleKey: 'EchoLastReward',
    });

    history = applyConcreteAcquisition(rewardKernelCatalog, history, {
      kind: 'consumable',
      gameName: 'BlindBoxLoot',
    });
    expect(history.lastRewardRecreation?.offer.rewardType).toBe('GiftDrop');

    history = applyConcreteAcquisition(rewardKernelCatalog, history, {
      kind: 'loot',
      gameName: 'ZeusUpgrade',
    });
    expect(history.lastRewardRecreation?.offer.rewardType).toBe('ZeusUpgrade');

    history = applyConcreteAcquisition(rewardKernelCatalog, history, {
      kind: 'loot',
      gameName: 'TrialUpgrade',
    });
    expect(history.lastRewardRecreation?.offer.rewardType).toBe('ZeusUpgrade');

    history = applyConcreteAcquisition(rewardKernelCatalog, history, {
      kind: 'consumable',
      gameName: 'HealBigDrop',
    });
    expect(history.lastRewardRecreation?.offer.rewardType).toBe('ZeusUpgrade');
  });

  it('records producer-owned Psyche as the exact latest Echo recreation without store membership', () => {
    const history = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'resource',
      gameName: 'MemPointsCommonDrop',
    });
    expect(history.consumableRecord.MemPointsCommonDrop).toBe(1);
    expect(history.lastRewardRecreation).toEqual({
      offer: { rewardType: 'MemPointsCommonDrop' },
      producerLifecycleKey: 'EchoLastReward',
    });
    expect(
      rewardKernelCatalog.stores.values.flatMap((store) =>
        store.entries.filter((entry) => entry.rewardType === 'MemPointsCommonDrop'),
      ),
    ).toEqual([]);
  });
});

describe('locally valid complete offer domains', () => {
  it('enumerates payload-free, one-source, and ordered distinct-pair offers in declaration order', () => {
    expect(locallyValidRewardOffers(rewardKernelCatalog, 'MaxHealthDrop')).toEqual([
      { rewardType: 'MaxHealthDrop' },
    ]);

    const sources = locallyValidRewardOffers(rewardKernelCatalog, 'Boon');
    expect(sources.map((offer) => offer.payload)).toEqual(
      rewardKernelCatalog.payloadDomains.byKey.BoonSource?.kind === 'oneOf'
        ? rewardKernelCatalog.payloadDomains.byKey.BoonSource.values.map((source) => ({
            kind: 'BoonSource',
            source,
          }))
        : [],
    );

    const devotion = locallyValidRewardOffers(rewardKernelCatalog, 'Devotion');
    expect(devotion).toHaveLength(72);
    expect(devotion.slice(0, 3)).toEqual([
      {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'ApolloUpgrade',
        },
      },
      {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'AresUpgrade',
        },
      },
      {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'DemeterUpgrade',
        },
      },
    ]);
    expect(
      devotion.every(
        (offer) =>
          offer.payload?.kind === 'DevotionPair' &&
          offer.payload.chosenSource !== offer.payload.spurnedSource,
      ),
    ).toBe(true);
  });
});

describe('reward eligibility requirements', () => {
  it('keeps current-shop Hermes exclusion on counted loot without self-blocking shop Hermes', () => {
    const countedHermes = rewardKernelCatalog.stores.byKey.RunProgress?.entries.find(
      (entry) => entry.rewardType === 'HermesUpgrade',
    );
    const shopHermes =
      rewardKernelCatalog.shops.byKey.WorldShop?.groups.byKey.Boon?.options.byKey.ShopHermesUpgrade;
    if (countedHermes?.requirement === undefined || shopHermes?.requirement === undefined) {
      throw new Error('Hermes requirements are missing');
    }
    const context = facts([], {
      currentRoomShopOptionNames: new Set(['ShopHermesUpgrade']),
    }).requirements;
    expect(evaluateRequirement(countedHermes.requirement, context)).toBe(false);
    expect(evaluateRequirement(shopHermes.requirement, context)).toBe(true);
  });

  it('does not count Ares toward the two-source Devotion eligibility requirement', () => {
    const devotion = rewardKernelCatalog.stores.byKey.RunProgress?.entries.find(
      (entry) => entry.rewardType === 'Devotion',
    );
    if (devotion?.requirement === undefined) {
      throw new Error('RunProgress Devotion requirement is missing');
    }
    expect(
      evaluateRequirement(
        devotion.requirement,
        facts(['ApolloUpgrade', 'AresUpgrade']).requirements,
      ),
    ).toBe(false);
    expect(
      evaluateRequirement(
        devotion.requirement,
        facts(['ApolloUpgrade', 'ZeusUpgrade']).requirements,
      ),
    ).toBe(true);
  });
});

describe('counted reward bags', () => {
  const runProgress = rewardKernelCatalog.stores.byKey.RunProgress!;

  it('branches when one offer can consume entries with different future requirements', () => {
    const next = consumeCountedOffer(
      rewardKernelCatalog,
      runProgress,
      createRewardBagState(runProgress),
      { rewardType: 'MaxHealthDrop' },
      facts(['ApolloUpgrade']),
    );
    expect(next).toHaveLength(2);
    expect(next.map((state) => state.remainingEntryCounts.slice(0, 2))).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  it('deduplicates equivalent latent states from duplicate Boon entries', () => {
    const next = consumeCountedOffer(
      rewardKernelCatalog,
      runProgress,
      createRewardBagState(runProgress),
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      facts(),
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.remainingEntryCounts.slice(14).reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it('blocks non-duplicate peer reward types while allowing a different-source Boon peer', () => {
    const initial = createRewardBagState(runProgress);
    expect(
      consumeCountedOffer(
        rewardKernelCatalog,
        runProgress,
        initial,
        { rewardType: 'MaxHealthDrop' },
        facts(),
        { peers: { priorOffers: [{ rewardType: 'MaxHealthDrop' }] } },
      ),
    ).toEqual([]);
    expect(
      consumeCountedOffer(
        rewardKernelCatalog,
        runProgress,
        initial,
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
        facts(),
        {
          peers: {
            priorOffers: [
              {
                rewardType: 'Boon',
                payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
              },
            ],
          },
        },
      ),
    ).toHaveLength(1);
  });

  it('retains ineligible leftovers while appending one complete base set', () => {
    const remaining = runProgress.entries.map(() => 0);
    remaining[12] = 1;
    const next = consumeCountedOffer(
      rewardKernelCatalog,
      runProgress,
      { remainingEntryCounts: remaining },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      facts([], {
        records: {
          biomeUseRecord: {},
          lootTypeHistory: {},
          roomsEntered: {},
          useRecord: { SpellDrop: 1 },
        },
      }),
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.remainingEntryCounts[12]).toBe(2);
    expect(next[0]?.remainingEntryCounts.slice(14).reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it('fails loudly when a supported consumer remains empty after its one refill', () => {
    expect(() =>
      consumeCountedOffer(
        rewardKernelCatalog,
        runProgress,
        { remainingEntryCounts: runProgress.entries.map(() => 0) },
        { rewardType: 'SpellDrop' },
        facts([], {
          records: {
            biomeUseRecord: {},
            lootTypeHistory: {},
            roomsEntered: {},
            useRecord: { SpellDrop: 1 },
          },
        }),
        { eligibleRewardTypes: new Set(['SpellDrop']) },
      ),
    ).toThrow('one-refill eligibility invariant');
  });
});

describe('exact reward priorities', () => {
  const runProgress = rewardKernelCatalog.stores.byKey.RunProgress!;

  it('preserves leftovers and appends at source time only when the exact name is exhausted', () => {
    const initial = createRewardBagState(runProgress);
    const boonIndexes = runProgress.entries
      .map((entry, index) => (entry.rewardType === 'Boon' ? index : -1))
      .filter((index) => index >= 0);
    const withBoonLeft = insertExactPriorityIntoBag(runProgress, initial, 'Boon');
    expect(withBoonLeft).toBe(initial);

    const exhaustedBoon = {
      remainingEntryCounts: initial.remainingEntryCounts.map((count, index) =>
        boonIndexes.includes(index) ? 0 : count + 2,
      ),
    };
    const refilled = insertExactPriorityIntoBag(runProgress, exhaustedBoon, 'Boon');
    expect(refilled.remainingEntryCounts).toEqual(
      exhaustedBoon.remainingEntryCounts.map((count) => count + 1),
    );
  });

  it('selects only the oldest supported exact priority, leaves ineligible names pending, and sees one normal refill', () => {
    const initial = createRewardBagState(runProgress);
    expect(
      oldestSupportedRewardPriority(runProgress, initial, ['Missing', 'Boon', 'Boon'], facts()),
    ).toBe('Boon');
    expect(
      oldestSupportedRewardPriority(runProgress, initial, ['Boon'], facts(), {
        eligibleRewardTypes: new Set(['MaxHealthDrop']),
      }),
    ).toBeUndefined();
    // Exact-name priorities never treat the three Path consumables as a family.
    expect(
      oldestSupportedRewardPriority(runProgress, initial, ['SpellDrop'], facts(), {
        eligibleRewardTypes: new Set(['MinorTalentDrop']),
      }),
    ).toBeUndefined();
    expect(
      oldestSupportedRewardPriority(
        runProgress,
        { remainingEntryCounts: initial.remainingEntryCounts.map(() => 0) },
        ['Boon'],
        facts(),
      ),
    ).toBe('Boon');
  });
});

describe('offer and acquisition projections', () => {
  it('records every generic offer without pretending it was acquired', () => {
    const history = applyOfferProjection(
      rewardKernelCatalog,
      createRewardHistoryState(),
      { rewardType: 'MaxHealthDrop' },
      facts([], { runDepthCache: 3 }),
    );
    expect(history.offerHistory).toEqual([{ rewardType: 'MaxHealthDrop' }]);
    expect(history.useRecord).toEqual({});
  });

  it('records Devotion spacing on offer and its chosen/spurned acquisitions in order', () => {
    const offer = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    };
    let history = applyOfferProjection(
      rewardKernelCatalog,
      createRewardHistoryState(),
      offer,
      facts([], { runDepthCache: 12 }),
    );
    expect(history.lastDevotionDepth).toBe(12);
    expect(history.offerHistory).toEqual([offer]);

    const chosen = resolveAcquisitionRole(
      rewardKernelCatalog,
      offer,
      'chosenSource',
      'beforeCombat',
    );
    const spurned = resolveAcquisitionRole(
      rewardKernelCatalog,
      offer,
      'spurnedSource',
      'afterCombat',
    );
    expect([chosen.lifecyclePoint, spurned.lifecyclePoint]).toEqual([
      'beforeCombat',
      'afterCombat',
    ]);
    history = applyConcreteAcquisition(rewardKernelCatalog, history, chosen.acquisition);
    history = applyConcreteAcquisition(rewardKernelCatalog, history, spurned.acquisition);
    expect(history.lootTypeHistory).toEqual({ ApolloUpgrade: 1, ZeusUpgrade: 1 });
    expect(history.traitFacts.upgradableTraitCount).toBe(0);
  });

  it('feeds Devotion offer spacing back into RunDepthCache requirements', () => {
    const requirement = { kind: 'minRoomsSinceEvent', event: 'Devotion', count: 15 } as const;
    const history = applyOfferProjection(
      rewardKernelCatalog,
      createRewardHistoryState(),
      {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
      facts([], { runDepthCache: 12 }),
    );
    const requirementFacts = (runDepthCache: number) =>
      factsWithHistory(facts([], { runDepthCache }), history, new Set()).requirements;

    expect(evaluateRequirement(requirement, requirementFacts(12))).toBe(true);
    expect(evaluateRequirement(requirement, requirementFacts(26))).toBe(false);
    expect(evaluateRequirement(requirement, requirementFacts(27))).toBe(true);
  });

  it('projects Spell as consumable history despite its loot acquisition kind', () => {
    const history = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'loot',
      gameName: 'SpellDrop',
    });
    expect(history.useRecord).toEqual({ SpellDrop: 1 });
    expect(history.consumableRecord).toEqual({ SpellDrop: 1 });
    expect(history.lootTypeHistory).toEqual({});
  });

  it('starts a new current-room use record without clearing route or biome history', () => {
    const acquired = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'consumable',
      gameName: 'MaxHealthDrop',
    });
    const nextRoom = beginCurrentRoomRewardHistory(acquired);

    expect(nextRoom.currentRoomUseRecord).toEqual({});
    expect(nextRoom.useRecord).toEqual({ MaxHealthDrop: 1 });
    expect(nextRoom.biomeUseRecord).toEqual({ MaxHealthDrop: 1 });
    expect(nextRoom.consumableRecord).toEqual({ MaxHealthDrop: 1 });
  });

  it('starts a new biome without clearing route-wide reward history', () => {
    const acquired = applyConcreteAcquisition(rewardKernelCatalog, createRewardHistoryState(), {
      kind: 'loot',
      gameName: 'ApolloUpgrade',
    });
    const nextBiome = beginBiomeRewardHistory(acquired);

    expect(nextBiome.currentRoomUseRecord).toEqual({});
    expect(nextBiome.biomeUseRecord).toEqual({});
    expect(nextBiome.lootBiomeRecord).toEqual({});
    expect(nextBiome.useRecord).toEqual({ ApolloUpgrade: 1 });
    expect(nextBiome.lootTypeHistory).toEqual({ ApolloUpgrade: 1 });
    expect(nextBiome.traitFacts.upgradableTraitCount).toBe(0);
  });

  it('keeps the reward-history trait fold neutral without trait acquisitions', () => {
    const baseline = facts();
    expect(baseline.requirements.counters.upgradableTraitCount).toBe(0);
    expect(baseline.requirements.flags).toEqual({
      allSpellInvested: false,
      pendingSpellDrop: false,
    });
  });
});

describe('ordered shop transitions', () => {
  it('finds exact WorldShop generation witnesses and keeps distinct Hammer entries', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' } },
      { offer: { rewardType: 'MaxManaDrop' } },
    ];
    const witnesses = findShopGenerationWitnesses(rewardKernelCatalog, profile, authored, facts());
    expect(witnesses.map((witness) => witness.optionKeys)).toEqual([
      ['RandomLoot', 'WeaponUpgradeDropEarly', 'MaxManaDrop'],
    ]);
  });

  it('applies declaration-owned option requirements during generation and revalidation', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' } },
      { offer: { rewardType: 'MaxManaDrop' } },
    ];
    const additionalRequirements = {
      WeaponUpgradeDropEarly: {
        kind: 'rewardLookupExcludes' as const,
        lookupKey: 'hubRewardLookup',
        rewardType: 'WeaponUpgrade',
      },
    };
    const supportedFacts = facts([], {
      rewardLookups: { hubRewardLookup: new Set() },
    });
    const witness = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      supportedFacts,
      additionalRequirements,
    )[0];
    if (witness === undefined) {
      throw new Error('WorldShop lookup witness is missing');
    }
    const blockedFacts = facts([], {
      rewardLookups: { hubRewardLookup: new Set(['WeaponUpgrade']) },
    });

    expect(
      evaluateShopGenerationSupport(
        rewardKernelCatalog,
        profile,
        authored,
        blockedFacts,
        additionalRequirements,
      ),
    ).toMatchObject({ witnesses: [], unsupportedSlotIndexes: [1] });
    expect(
      simulateShopPurchases(
        rewardKernelCatalog,
        profile,
        authored,
        witness,
        [],
        createRewardHistoryState(),
        blockedFacts,
        additionalRequirements,
      ),
    ).toEqual([]);
    expect(
      evaluateShopPurchaseAtSlot(
        rewardKernelCatalog,
        profile,
        authored,
        witness,
        1,
        [0, 1, 2],
        createRewardHistoryState(),
        blockedFacts,
        additionalRequirements,
      ),
    ).toBeUndefined();
    expect(
      evaluateShopPurchaseAtSlot(
        rewardKernelCatalog,
        profile,
        authored,
        witness,
        1,
        [0, 1, 2],
        createRewardHistoryState(),
        supportedFacts,
        additionalRequirements,
      ),
    ).toBeDefined();
  });

  it.each([
    [1, 'first'],
    [2, 'first'],
    [3, 'second'],
    [4, 'second'],
  ] as const)(
    'filters I and Q World Shop options at entered biome %d to the %s-half domain',
    (enteredBiomes, phase) => {
      const iProfile = rewardKernelCatalog.shops.byKey.I_WorldShop!;
      const qProfile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
      const iAuthored: readonly AuthoredShopOffer[] =
        phase === 'first'
          ? [
              {
                offer: {
                  rewardType: 'RandomLoot',
                  payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
                },
              },
              { offer: { rewardType: 'MaxHealthDrop' } },
              { offer: { rewardType: 'RoomRewardHealDrop' } },
              {
                offer: {
                  rewardType: 'BlindBoxLoot',
                  payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
                },
              },
              { offer: { rewardType: 'WeaponPointsRareDrop' } },
            ]
          : [
              {
                offer: {
                  rewardType: 'RandomLoot',
                  payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
                },
              },
              { offer: { rewardType: 'MaxHealthDrop' } },
              { offer: { rewardType: 'HealBigDrop' } },
              { offer: { rewardType: 'MaxHealthDropBig' } },
              { offer: { rewardType: 'WeaponPointsRareDrop' } },
            ];
      const qAuthored: readonly AuthoredShopOffer[] =
        phase === 'first'
          ? [
              {
                offer: {
                  rewardType: 'RandomLoot',
                  payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
                },
              },
              {
                offer: {
                  rewardType: 'BlindBoxLoot',
                  payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
                },
              },
              {
                offer: {
                  rewardType: 'RandomLoot',
                  payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
                },
              },
              { offer: { rewardType: 'RoomRewardHealDrop' } },
              { offer: { rewardType: 'WeaponUpgradeDrop' } },
              { offer: { rewardType: 'WeaponPointsRareDrop' } },
            ]
          : [
              {
                offer: {
                  rewardType: 'RandomLoot',
                  payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
                },
              },
              {
                offer: {
                  rewardType: 'RandomLoot',
                  payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
                },
              },
              { offer: { rewardType: 'HealBigDrop' } },
              { offer: { rewardType: 'HealBigDrop' } },
              { offer: { rewardType: 'MaxHealthDropBig' } },
              { offer: { rewardType: 'WeaponPointsRareDrop' } },
            ];

      const iWitness = findShopGenerationWitnesses(
        rewardKernelCatalog,
        iProfile,
        iAuthored,
        shopFacts(enteredBiomes),
      )[0];
      const qWitness = findShopGenerationWitnesses(
        rewardKernelCatalog,
        qProfile,
        qAuthored,
        shopFacts(enteredBiomes),
      )[0];

      expect(iWitness?.optionKeys).toEqual(
        phase === 'first'
          ? [
              'RandomLoot',
              'MaxHealthDrop',
              'RoomRewardHealDrop',
              'BlindBoxLoot',
              'WeaponPointsRareDrop',
            ]
          : [
              'BoostedRandomLoot',
              'MaxHealthDrop',
              'HealBigDrop',
              'MaxHealthDropBig',
              'WeaponPointsRareDrop',
            ],
      );
      expect(qWitness?.optionKeys).toEqual(
        phase === 'first'
          ? [
              'RandomLoot',
              'BlindBoxLoot',
              'RandomLoot',
              'RoomRewardHealDrop',
              'WeaponUpgradeDrop',
              'WeaponPointsRareDrop',
            ]
          : [
              'RandomLoot',
              'BoostedRandomLoot',
              'HealBigDrop',
              'HealBigDrop',
              'MaxHealthDropBig',
              'WeaponPointsRareDrop',
            ],
      );
      expect(qWitness?.optionKeys[0]).not.toBe(qWitness?.optionKeys[1]);
    },
  );

  it('keeps phase-ineligible offers editable as indexed or joint generation failures', () => {
    const iProfile = rewardKernelCatalog.shops.byKey.I_WorldShop!;
    const iAuthored: readonly AuthoredShopOffer[] = [
      { offer: { rewardType: 'StackUpgradeBig' } },
      { offer: { rewardType: 'MaxHealthDrop' } },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'MaxHealthDropBig' } },
      { offer: { rewardType: 'WeaponPointsRareDrop' } },
    ];
    const earlyUpgradableFacts = facts([], {
      counters: { ...requirementContext().counters, enteredBiomes: 2, upgradableTraitCount: 1 },
    });
    expect(
      evaluateShopGenerationSupport(rewardKernelCatalog, iProfile, iAuthored, earlyUpgradableFacts),
    ).toMatchObject({ witnesses: [], unsupportedSlotIndexes: [0, 2, 3] });

    const qProfile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const qAuthored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      {
        offer: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      },
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      },
      { offer: { rewardType: 'RoomRewardHealDrop' } },
      { offer: { rewardType: 'WeaponUpgradeDrop' } },
      { offer: { rewardType: 'WeaponPointsRareDrop' } },
    ];
    const support = evaluateShopGenerationSupport(
      rewardKernelCatalog,
      qProfile,
      qAuthored,
      shopFacts(2),
    );
    expect(support).toMatchObject({
      witnesses: [],
      unsupportedSlotIndexes: [],
      jointlyUnavailable: true,
    });
  });

  it('keeps WorldShop generation support unchanged across entered-biome phase boundaries', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      { offer: { rewardType: 'MaxHealthDrop' } },
      { offer: { rewardType: 'MaxManaDrop' } },
    ];
    const witnesses = [1, 4].map((enteredBiomes) =>
      evaluateShopGenerationSupport(
        rewardKernelCatalog,
        profile,
        authored,
        shopFacts(enteredBiomes),
      ).witnesses.map((witness) => witness.optionKeys),
    );

    expect(witnesses).toEqual([
      [['RandomLoot', 'MaxHealthDrop', 'MaxManaDrop']],
      [['RandomLoot', 'MaxHealthDrop', 'MaxManaDrop']],
    ]);
  });

  it.each([
    {
      profileKey: 'I_WorldShop',
      authored: [
        {
          offer: {
            rewardType: 'RandomLoot',
            payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
          },
        },
        { offer: { rewardType: 'MaxHealthDrop' } },
        { offer: { rewardType: 'LastStandDrop' } },
        { offer: { rewardType: 'MaxHealthDropBig' } },
        { offer: { rewardType: 'WeaponPointsRareDrop' } },
      ],
      lastStandSlot: 2,
    },
    {
      profileKey: 'Q_WorldShop',
      authored: [
        {
          offer: {
            rewardType: 'RandomLoot',
            payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
          },
        },
        {
          offer: {
            rewardType: 'RandomLoot',
            payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
          },
        },
        { offer: { rewardType: 'HealBigDrop' } },
        { offer: { rewardType: 'LastStandDrop' } },
        { offer: { rewardType: 'MaxHealthDropBig' } },
        { offer: { rewardType: 'WeaponPointsRareDrop' } },
      ],
      lastStandSlot: 3,
    },
  ] as const)(
    'keeps $profileKey LastStand generation and purchase independent of authored DD state',
    ({ profileKey, authored, lastStandSlot }) => {
      const profile = rewardKernelCatalog.shops.byKey[profileKey];
      if (profile === undefined) throw new Error(`missing ${profileKey}`);
      const factsAtShop = facts([], {
        counters: { ...requirementContext().counters, enteredBiomes: 4 },
      });

      expect(
        evaluateShopGenerationSupport(rewardKernelCatalog, profile, authored, factsAtShop),
      ).toMatchObject({ unsupportedSlotIndexes: [] });
      const witness = findShopGenerationWitnesses(
        rewardKernelCatalog,
        profile,
        authored,
        factsAtShop,
      )[0];
      if (witness === undefined) throw new Error(`${profileKey} Last Stand witness is missing`);
      expect(
        simulateShopPurchases(
          rewardKernelCatalog,
          profile,
          authored,
          witness,
          [lastStandSlot],
          createRewardHistoryState(),
          factsAtShop,
        ),
      ).toHaveLength(1);
      expect(
        simulateShopPurchases(
          rewardKernelCatalog,
          profile,
          authored,
          witness,
          [lastStandSlot],
          createRewardHistoryState(),
          factsAtShop,
        ),
      ).toHaveLength(1);
    },
  );

  it('rejects a generation witness that does not support the authored shop offers', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' } },
      { offer: { rewardType: 'MaxManaDrop' } },
    ];
    const witness = findShopGenerationWitnesses(rewardKernelCatalog, profile, authored, facts())[0];
    if (witness === undefined) {
      throw new Error('WorldShop witness is missing');
    }
    const mismatched: readonly AuthoredShopOffer[] = [
      authored[0]!,
      authored[1]!,
      { offer: { rewardType: 'MaxHealthDrop' } },
    ];
    expect(
      simulateShopPurchases(
        rewardKernelCatalog,
        profile,
        mismatched,
        witness,
        [],
        createRewardHistoryState(),
        facts(),
      ),
    ).toEqual([]);
  });

  it('revalidates generation witnesses against the authoritative initial history', () => {
    const profile = rewardKernelCatalog.shops.byKey.WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      },
      { offer: { rewardType: 'WeaponUpgradeDrop' } },
      { offer: { rewardType: 'MaxManaDrop' } },
    ];
    const staleFacts = facts();
    const witness = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      staleFacts,
    )[0];
    if (witness === undefined) {
      throw new Error('stale WorldShop witness is missing');
    }
    const cappedSources = ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'ZeusUpgrade'];
    expect(
      simulateShopPurchases(
        rewardKernelCatalog,
        profile,
        authored,
        witness,
        [],
        historyFromSources(cappedSources),
        staleFacts,
      ),
    ).toEqual([]);
  });

  it('enforces without-replacement assignment for the two-offer Q group', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
      },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'MaxHealthDropBig' } },
      { offer: { rewardType: 'WeaponPointsRareDrop' } },
    ];
    const witnesses = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      shopFacts(4),
    );
    expect(witnesses).toHaveLength(2);
    expect(witnesses.map((witness) => witness.optionKeys.slice(0, 2))).toEqual([
      ['RandomLoot', 'BoostedRandomLoot'],
      ['BoostedRandomLoot', 'RandomLoot'],
    ]);
  });

  it('distinguishes a jointly unavailable Q group from unsupported individual slots', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
      {
        offer: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
      },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'MaxHealthDropBig' } },
      { offer: { rewardType: 'WeaponPointsRareDrop' } },
    ];

    const support = evaluateShopGenerationSupport(
      rewardKernelCatalog,
      profile,
      authored,
      shopFacts(4),
    );

    expect(support.witnesses).toEqual([]);
    expect(support.unsupportedSlotIndexes).toEqual([]);
    expect(support.jointlyUnavailable).toBe(true);
  });

  it('executes the one exact authored purchase order', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const authored: readonly AuthoredShopOffer[] = [
      { offer: { rewardType: 'MaxHealthDrop' } },
      { offer: { rewardType: 'MaxManaDrop' } },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'MaxHealthDropBig' } },
      { offer: { rewardType: 'WeaponPointsRareDrop' } },
    ];
    const baseFacts = shopFacts(4);
    const witness = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      baseFacts,
    )[0];
    if (witness === undefined) {
      throw new Error('Q shop witness is missing');
    }
    const results = simulateShopPurchases(
      rewardKernelCatalog,
      profile,
      authored,
      witness,
      [0, 1],
      createRewardHistoryState(),
      baseFacts,
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.entryOrder).toEqual([0, 1]);
    expect(results[0]?.acquisitions).toEqual([
      expect.objectContaining({
        slotIndex: 0,
        event: expect.objectContaining({
          acquisition: { kind: 'consumable', gameName: 'MaxHealthDrop' },
        }),
      }),
      expect.objectContaining({
        slotIndex: 1,
        event: expect.objectContaining({
          acquisition: { kind: 'consumable', gameName: 'MaxManaDrop' },
        }),
      }),
    ]);
    expect(results[0]?.history.consumableRecord).toEqual({
      MaxHealthDrop: 1,
      MaxManaDrop: 1,
    });
  });

  it('does not rescue an invalid authored order with another purchase permutation', () => {
    const profile = rewardKernelCatalog.shops.byKey.Q_WorldShop!;
    const initialSources = ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade'];
    const authored: readonly AuthoredShopOffer[] = [
      {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      },
      {
        offer: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
      },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'HealBigDrop' } },
      { offer: { rewardType: 'MaxHealthDropBig' } },
      { offer: { rewardType: 'WeaponPointsRareDrop' } },
    ];
    const baseFacts = facts(initialSources, {
      counters: { ...requirementContext().counters, enteredBiomes: 4 },
    });
    const witnesses = findShopGenerationWitnesses(
      rewardKernelCatalog,
      profile,
      authored,
      baseFacts,
    );
    expect(witnesses).not.toHaveLength(0);
    const rejectedHistory = applyConcreteAcquisition(
      rewardKernelCatalog,
      historyFromSources(initialSources),
      { kind: 'resource', gameName: 'GiftDrop' },
    );
    const rejectedOrder = simulateShopPurchases(
      rewardKernelCatalog,
      profile,
      authored,
      witnesses[0]!,
      [0, 1],
      rejectedHistory,
      baseFacts,
    );
    const results = simulateShopPurchases(
      rewardKernelCatalog,
      profile,
      authored,
      witnesses[0]!,
      [1, 0],
      historyFromSources(initialSources),
      baseFacts,
    );
    expect(rejectedOrder).toEqual([]);
    expect(rejectedHistory.lastRewardRecreation?.offer.rewardType).toBe('GiftDrop');
    expect(results).toHaveLength(1);
    expect(results[0]?.entryOrder).toEqual([1, 0]);
    expect(results[0]?.acquisitions.map((acquisition) => acquisition.event.role)).toEqual([
      'box',
      'hiddenSource',
      'source',
    ]);
    expect(results[0]?.history.lootTypeHistory).toMatchObject({
      ZeusUpgrade: 1,
      HestiaUpgrade: 1,
    });
    expect(results[0]?.history.consumableRecord).toMatchObject({ BlindBoxLoot: 1 });
  });
});
