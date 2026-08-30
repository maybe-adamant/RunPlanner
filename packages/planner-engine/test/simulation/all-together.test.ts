import { catalog } from '@run-planner/hades2-catalog';
import {
  createTraitOfferAddress,
  createOccurrenceId,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type AuthoredAllTogetherResult,
  type AuthoredTraitOfferTraits,
  createDefaultAuthoredHexTree,
} from '@run-planner/engine/authored-project';
import { factsWithHistory, type RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { evaluateAllTogetherSetDomain } from '../../src/simulation/candidates/trait-offer';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';
import {
  processEncounterTraitOffer,
  settleEncounterTraitOffer,
} from '../../src/simulation/rewards/trait-settlement';
import {
  attachTraitHistory,
  directTraitSetOutcomes,
  foldTraitHistoryEvents,
  type TraitHistoryEvent,
  type TraitHistoryState,
} from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { installHexTree } from '../../src/simulation/hex-progress';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';

const owner = createTraitOfferAddress(
  createEncounterPhaseAddress(
    { kind: 'biome', routeKey: 'Underworld', biomeKey: 'H' },
    { kind: 'occurrence', occurrenceId: createOccurrenceId('all-together-room') },
    'Encounter',
  ),
  'selection',
);

const firstResult: AuthoredAllTogetherResult = Object.freeze({
  earth: 'ElementalDamageBoon',
  fire: 'ElementalBaseDamageBoon',
  air: 'ElementalDamageFloorBoon',
  water: 'ElementalHealthBoon',
});

function acquired(
  sequence: number,
  giverKey: string,
  traitKey: string,
  rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary' = 'Common',
  bannedTraitKeys?: readonly string[],
): TraitHistoryEvent {
  return Object.freeze({
    kind: 'traitOffer',
    owner: { kind: 'project' as const },
    acquisitionRole: 'setup',
    sequence,
    giverKey,
    options: Object.freeze([
      Object.freeze({ traitKey, rarity }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    acquisitionPoint: `setup:${sequence}`,
    ...(bannedTraitKeys === undefined ? {} : { bannedTraitKeys }),
  });
}

function requiredHistory(
  extra: readonly TraitHistoryEvent[] = [],
  bannedTraitKeys?: readonly string[],
): TraitHistoryState {
  return foldTraitHistoryEvents(catalog, [
    acquired(1, 'Hera', 'HeraWeaponBoon', 'Common', bannedTraitKeys),
    acquired(2, 'Hera', 'CommonGlobalDamageBoon'),
    acquired(3, 'Hera', 'DamageSharePotencyBoon'),
    ...extra,
  ]);
}

function branch(history: TraitHistoryState) {
  const initial = initializeTestRewardBranches()[0]!;
  return Object.freeze({
    ...initial,
    history: attachTraitHistory(initial.history, history),
    traitHistory: history,
  });
}

function rewardFacts(): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 2,
        encounterDepth: 7,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: { biomeUseRecord: {}, lootTypeHistory: {}, roomsEntered: {}, useRecord: {} },
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

function offer(
  result: AuthoredAllTogetherResult | undefined = firstResult,
  includeResult = true,
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Hera',
    options: Object.freeze([
      Object.freeze({
        traitKey: 'AllElementalBoon',
        rarity: 'Legendary' as const,
        ...(!includeResult || result === undefined ? {} : { allTogetherResult: result }),
      }),
      Object.freeze({ traitKey: 'HeraManaBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'HeraSprintBoon', rarity: 'Common' as const }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
}

function settle(
  history: TraitHistoryState,
  result?: AuthoredAllTogetherResult,
  initial: RewardBranchState = branch(history),
) {
  const findings = new Map();
  const settled = processEncounterTraitOffer(
    catalog,
    initial,
    owner.owner,
    offer(result),
    20,
    'encounterCompleted',
    findings,
  );
  return { settled, findings };
}

describe('All Together direct trait settlement', () => {
  it('publishes both, forced-other, and exhausted-null domains from the pre-outer history', () => {
    const empty = requiredHistory();
    expect(directTraitSetOutcomes(catalog, empty, 'AllElementalBoon', 'earth')).toEqual([
      'ElementalDamageBoon',
      'ElementalOlympianDamageBoon',
    ]);

    const one = requiredHistory([acquired(4, 'Hephaestus', 'ElementalDamageBoon')]);
    expect(directTraitSetOutcomes(catalog, one, 'AllElementalBoon', 'earth')).toEqual([
      'ElementalOlympianDamageBoon',
    ]);

    const both = requiredHistory([
      acquired(4, 'Hephaestus', 'ElementalDamageBoon'),
      acquired(5, 'Ares', 'ElementalOlympianDamageBoon'),
    ]);
    expect(directTraitSetOutcomes(catalog, both, 'AllElementalBoon', 'earth')).toEqual([null]);
  });

  it('equips the Legendary outer first and four rarityless children without ordinary prerequisites', () => {
    const history = requiredHistory([], ['ElementalDamageBoon']);
    expect(history.elementCounts.Earth).toBe(1);
    const { settled, findings } = settle(history);
    expect(findings.size).toBe(0);
    expect(settled.traitHistory?.equippedTraits.AllElementalBoon).toMatchObject({
      rarity: 'Legendary',
      giverKey: 'Hera',
    });
    for (const traitKey of Object.values(firstResult)) {
      expect(settled.traitHistory?.equippedTraits[traitKey!]).toMatchObject({
        traitKey,
        sourceRole: 'directTraitGrant',
      });
      expect(settled.traitHistory?.equippedTraits[traitKey!]?.rarity).toBeUndefined();
    }
    expect(settled.traitHistory?.bannedTraitKeys).toContain('ElementalDamageBoon');
    expect(settled.traitHistory?.events.map((event) => [event.kind, event.sequence])).toEqual([
      ['traitOffer', 1],
      ['traitOffer', 2],
      ['traitOffer', 3],
      ['traitOffer', 20],
      ['directTraitGrant', 20],
      ['directTraitGrant', 20],
      ['directTraitGrant', 20],
      ['directTraitGrant', 20],
    ]);
    expect(settled.history.lootTypeHistory).toEqual(branch(history).history.lootTypeHistory);
  });

  it('settles the same atomic map through the ordinary free reward acquisition path', () => {
    const history = requiredHistory();
    const biome = { kind: 'biome' as const, routeKey: 'Underworld', biomeKey: 'H' };
    const occurrenceId = createOccurrenceId('all-together-normal-reward');
    const incoming = createIncomingRewardAddress(biome, occurrenceId);
    const findings = new Map();
    const settled = settleOwnedAcquisitionSite(
      catalog,
      [
        installHexTree(
          catalog,
          branch(history),
          'SpellPolymorphTrait',
          createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait'),
        ),
      ],
      {
        siteOwner: createOccurrenceAddress(biome, occurrenceId),
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        source: {
          origin: incoming,
          offer: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
          },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: { source: offer() },
        },
        historySequence: 20,
      },
      (rewardHistory) => factsWithHistory(rewardFacts(), rewardHistory, new Set()),
      findings,
    );
    expect(settled.branches).toHaveLength(1);
    expect(findings.size).toBe(0);
    expect(
      settled.branches[0]?.traitHistory?.events
        .filter((event) => event.kind === 'directTraitGrant')
        .map((event) => event.traitKey),
    ).toEqual(Object.values(firstResult));
    expect(settled.branches[0]?.hexProgress.godSentAdded).toBe(true);

    const nonmatching = settleOwnedAcquisitionSite(
      catalog,
      [
        installHexTree(
          catalog,
          branch(history),
          'SpellTransformTrait',
          createDefaultAuthoredHexTree(catalog, 'SpellTransformTrait'),
        ),
      ],
      {
        siteOwner: createOccurrenceAddress(biome, occurrenceId),
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        source: {
          origin: incoming,
          offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: { source: offer() },
        },
        historySequence: 20,
      },
      (rewardHistory) => factsWithHistory(rewardFacts(), rewardHistory, new Set()),
      new Map(),
    );
    expect(nonmatching.branches[0]?.hexProgress.godSentAdded).toBe(false);
  });

  it('publishes the exact post-outer checkpoint when an ordinary reward child blocks', () => {
    const history = requiredHistory();
    const biome = { kind: 'biome' as const, routeKey: 'Underworld', biomeKey: 'H' };
    const occurrenceId = createOccurrenceId('all-together-blocked-reward');
    const findings = new Map();
    const settled = settleOwnedAcquisitionSite(
      catalog,
      [branch(history)],
      {
        siteOwner: createOccurrenceAddress(biome, occurrenceId),
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        source: {
          origin: createIncomingRewardAddress(biome, occurrenceId),
          offer: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
          },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: {
            source: offer(Object.freeze({ ...firstResult, earth: null })),
          },
        },
        historySequence: 20,
      },
      (rewardHistory) => factsWithHistory(rewardFacts(), rewardHistory, new Set()),
      findings,
    );
    const checkpoint = settled.traitChildSettlements?.[0];
    expect(checkpoint?.address).toMatchObject({ kind: 'allTogetherSet', setKey: 'earth' });
    expect(checkpoint?.branch.traitHistory?.equippedTraits.AllElementalBoon?.rarity).toBe(
      'Legendary',
    );
    expect(
      checkpoint?.branch.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
    ).toEqual([]);
    expect(checkpoint?.branch.events.at(-1)?.kind).toBe('concreteAcquisition');
  });

  it('settles forced alternatives and all-exhausted nulls without duplicate child events', () => {
    const onePerSet = requiredHistory([
      acquired(4, 'Hephaestus', 'ElementalDamageBoon'),
      acquired(5, 'Hestia', 'ElementalBaseDamageBoon'),
      acquired(6, 'Zeus', 'ElementalDamageFloorBoon'),
      acquired(7, 'Poseidon', 'ElementalHealthBoon'),
    ]);
    const alternatives = Object.freeze({
      earth: 'ElementalOlympianDamageBoon',
      fire: 'ElementalRallyBoon',
      air: 'ElementalDodgeBoon',
      water: 'ElementalDamageCapBoon',
    }) satisfies AuthoredAllTogetherResult;
    const forced = settle(onePerSet, alternatives).settled.traitHistory!;
    expect(
      forced.events
        .filter((event) => event.kind === 'directTraitGrant')
        .map((event) => event.traitKey),
    ).toEqual(Object.values(alternatives));

    const allEight = requiredHistory([
      acquired(4, 'Hephaestus', 'ElementalDamageBoon'),
      acquired(5, 'Ares', 'ElementalOlympianDamageBoon'),
      acquired(6, 'Hestia', 'ElementalBaseDamageBoon'),
      acquired(7, 'Apollo', 'ElementalRallyBoon'),
      acquired(8, 'Zeus', 'ElementalDamageFloorBoon'),
      acquired(9, 'Aphrodite', 'ElementalDodgeBoon'),
      acquired(10, 'Poseidon', 'ElementalHealthBoon'),
      acquired(11, 'Demeter', 'ElementalDamageCapBoon'),
    ]);
    const exhausted = settle(
      allEight,
      Object.freeze({ earth: null, fire: null, air: null, water: null }),
    ).settled.traitHistory!;
    expect(exhausted.equippedTraits.AllElementalBoon?.rarity).toBe('Legendary');
    expect(exhausted.events.filter((event) => event.kind === 'directTraitGrant')).toEqual([]);
    const nightBloom = settle(
      allEight,
      Object.freeze({ earth: null, fire: null, air: null, water: null }),
      installHexTree(
        catalog,
        branch(allEight),
        'SpellSummonTrait',
        createDefaultAuthoredHexTree(catalog, 'SpellSummonTrait'),
      ),
    ).settled;
    expect(nightBloom.hexProgress.godSentAdded).toBe(true);
  });

  it.each([
    ['missing', undefined, 'allTogetherResultMissing'],
    ['invalid', Object.freeze({ ...firstResult, earth: null }), 'allTogetherResultUnavailable'],
  ] as const)(
    'keeps the outer and applies no partial map for a %s active child',
    (_label, result, code) => {
      const history = requiredHistory();
      const findings = new Map();
      const settled = processEncounterTraitOffer(
        catalog,
        branch(history),
        owner.owner,
        offer(result, result !== undefined),
        20,
        'encounterCompleted',
        findings,
      );
      expect(settled.traitHistory?.equippedTraits.AllElementalBoon?.rarity).toBe('Legendary');
      expect(
        settled.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
      ).toEqual([]);
      expect([...findings.values()].map((entry) => entry.finding.code)).toContain(code);
      if (result === undefined) expect(findings.size).toBe(1);
    },
  );

  it('ignores an unresolved dormant All Together child when another option is selected', () => {
    const unresolved = Object.freeze({
      ...offer(undefined, false),
      selectedOptionKey: 'option2' as const,
    });
    const findings = new Map();
    const settled = processEncounterTraitOffer(
      catalog,
      branch(requiredHistory()),
      owner.owner,
      unresolved,
      20,
      'encounterCompleted',
      findings,
    );
    expect(
      [...findings.values()].filter((entry) => entry.finding.origin.kind === 'allTogetherSet'),
    ).toEqual([]);
    expect(
      settled.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
    ).toEqual([]);
  });

  it('withholds branch-divergent sets atomically after acquiring the outer trait', () => {
    const first = requiredHistory();
    const second = requiredHistory([acquired(4, 'Hephaestus', 'ElementalDamageBoon')]);
    const findings = new Map();
    const result = settleEncounterTraitOffer(
      catalog,
      branch(first),
      owner.owner,
      offer(),
      20,
      'encounterCompleted',
      findings,
      undefined,
      'selection',
      undefined,
      undefined,
      [first, second],
    );
    expect(result.branch.traitHistory?.equippedTraits.AllElementalBoon?.rarity).toBe('Legendary');
    expect(
      result.branch.traitHistory?.events.filter((event) => event.kind === 'directTraitGrant'),
    ).toEqual([]);
    expect(result.blockedChild?.address).toMatchObject({ kind: 'allTogetherSet', setKey: 'earth' });
    expect(
      [...findings.values()].find((entry) => entry.finding.origin.kind === 'allTogetherSet')
        ?.finding.evidence.detail,
    ).toBe('branchDivergence');
  });

  it('branch-attests each candidate instead of combining divergent histories', () => {
    const first = requiredHistory();
    const forced = requiredHistory([acquired(4, 'Hephaestus', 'ElementalDamageBoon')]);
    const single = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(owner),
          [
            Object.freeze({
              before: first,
              context: Object.freeze({ resolvedProviderKey: 'Hera' }),
            }),
          ],
        ],
      ]),
    ).at(owner)!;
    expect(single.allTogetherSet(offer(), 'option1', 'earth')).toEqual([
      ['ElementalDamageBoon', 'ElementalOlympianDamageBoon'],
    ]);

    const divergentArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(owner),
          [
            Object.freeze({
              before: first,
              context: Object.freeze({ resolvedProviderKey: 'Hera' }),
            }),
            Object.freeze({
              before: forced,
              context: Object.freeze({ resolvedProviderKey: 'Hera' }),
            }),
          ],
        ],
      ]),
    );
    const evaluated = evaluateAllTogetherSetDomain(
      catalog,
      {} as never,
      { route: {} } as never,
      divergentArtifacts,
      {
        kind: 'allTogetherSetDomain',
        trait: owner,
        value: offer(),
        optionKey: 'option1',
        setKey: 'earth',
      },
    );
    expect(evaluated.kind).toBe('allTogetherSetDomain');
    if (evaluated.kind !== 'allTogetherSetDomain') throw new Error('missing All Together domain');
    expect(evaluated.result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'ElementalDamageBoon',
          support: 'impossible',
          reason: 'branchDivergence',
        }),
        expect.objectContaining({
          value: 'ElementalOlympianDamageBoon',
          support: 'possible',
        }),
      ]),
    );
  });
});
