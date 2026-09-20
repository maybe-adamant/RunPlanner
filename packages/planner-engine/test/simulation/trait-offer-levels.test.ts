import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import {
  attachTraitHistory,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  resolveTraitOfferOptionLevel,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import { applyTraitOfferForAcquisition } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import type { TraitOfferCandidateContext } from '../../src/simulation/traits';
import { traitFrontierState } from '../support/simulation-state';

/** The Persephone aspect this suite assesses every offer level against. */
const persephoneLoadout = Object.freeze({
  weaponKey: 'WeaponLob',
  aspectKey: 'LobImpulseAspect',
});

const owner = createIncomingRewardAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('persephone-levels'),
);
const address = createTraitOfferAddress(owner, 'self');

function offer(roll?: number): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Apollo',
    options: Object.freeze([
      Object.freeze({
        traitKey: 'ApolloWeaponBoon',
        rarity: 'Common' as const,
        ...(roll === undefined ? {} : { persephoneRoll: roll }),
      }),
      Object.freeze({
        traitKey: 'ApolloSpecialBoon',
        rarity: 'Common' as const,
        ...(roll === undefined ? {} : { persephoneRoll: roll }),
      }),
      Object.freeze({
        traitKey: 'ApolloCastBoon',
        rarity: 'Common' as const,
        ...(roll === undefined ? {} : { persephoneRoll: roll }),
      }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
  });
}

function pomBranch(levels = 3, traitHistory = createTraitHistoryState()) {
  const branch = initializeTestRewardBranches()[0];
  if (branch === undefined) throw new Error('missing test reward branch');
  return Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      equipment: persephoneLoadout,
      rewardHistory: attachTraitHistory(branch.state.rewardHistory, traitHistory),
      traitHistory: traitHistory,
      keepsakes: Object.freeze({
        ...branch.state.keepsakes,
        fatedStatus: 'Fated' as const,
        jeweledPom: Object.freeze({
          grantedTraitKey: 'HadesLifestealBoon',
          active: true,
          levels,
          acquisitionIdentity: 'test:pom',
        }),
      }),
    }),
  });
}

function hephaestusPremiumOffer(): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Hephaestus',
    options: Object.freeze([
      Object.freeze({ traitKey: 'WeaponUpgradeBoon', rarity: 'Legendary' as const }),
      Object.freeze({
        traitKey: 'HephaestusSpecialBoon',
        rarity: 'Common' as const,
        persephoneRoll: 5,
      }),
      Object.freeze({
        traitKey: 'HephaestusCastBoon',
        rarity: 'Common' as const,
        persephoneRoll: 5,
      }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    concaveStoneResult: { kind: 'proc' as const, optionKey: 'option2' as const },
  });
}

function premiumRequirementHistory() {
  return foldTraitHistoryEvents(catalog, [
    {
      kind: 'traitOffer' as const,
      owner,
      acquisitionRole: 'requirement-weapon',
      sequence: 0,
      giverKey: 'Hephaestus',
      options: [{ traitKey: 'HephaestusWeaponBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'test',
    },
    {
      kind: 'traitOffer' as const,
      owner,
      acquisitionRole: 'requirement-armor',
      sequence: 1,
      giverKey: 'Hephaestus',
      options: [{ traitKey: 'HeavyArmorBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'test',
    },
    {
      kind: 'traitOffer' as const,
      owner,
      acquisitionRole: 'requirement-damage',
      sequence: 2,
      giverKey: 'Hephaestus',
      options: [{ traitKey: 'MassiveDamageBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'test',
    },
  ]);
}

function replacementHistory() {
  return foldTraitHistoryEvents(catalog, [
    {
      kind: 'traitOffer' as const,
      owner,
      acquisitionRole: 'prior',
      sequence: 0,
      giverKey: 'Apollo',
      options: [{ traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      selectedEffectiveLevel: 4,
      acquisitionPoint: 'test',
    },
  ]);
}

function hymnReplacementOffer(): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Hera',
    options: Object.freeze([
      Object.freeze({ traitKey: 'HeraWeaponBoon', rarity: 'Rare' as const }),
      Object.freeze({
        traitKey: 'HeraSpecialBoon',
        rarity: 'Common' as const,
        persephoneRoll: 5,
      }),
      Object.freeze({
        traitKey: 'HeraCastBoon',
        rarity: 'Common' as const,
        persephoneRoll: 5,
      }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
  });
}

function context(withSuppression = false): TraitOfferCandidateContext {
  return Object.freeze({
    state: traitFrontierState(createTraitHistoryState(), {
      loadout: persephoneLoadout,
      keepsakes: pomBranch().state.keepsakes,
    }),
    source: Object.freeze({
      ...(withSuppression ? { stackBoostsSuppressed: true as const } : {}),
    }),
  });
}

describe('Persephone effective offer levels', () => {
  it('defaults an omitted native roll to zero while publishing its range', () => {
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(address),
          Object.freeze([
            Object.freeze({
              state: traitFrontierState(createTraitHistoryState(), { loadout: persephoneLoadout }),
              source: Object.freeze({}),
            }),
          ]),
        ],
      ]),
    );
    const candidate = artifacts.at(address)?.evaluateOffer(offer())[0];
    if (candidate === undefined) throw new Error('missing candidate branch');

    expect(candidate).toMatchObject({
      persephoneRollMaximums: [6, 6, 6],
      effectiveLevels: [1, 1, 1],
    });
    expect(candidate.assessments.every((assessment) => assessment.legal)).toBe(true);
    expect(candidate.assessments.flatMap((assessment) => assessment.findings)).toEqual([]);
  });

  it.each([
    ['normal without Pom', undefined, [0, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]],
    ['normal with Pom 3', 3, [0, 2, 3, 4, 5, 6], [4, 6, 7, 8, 9, 10]],
    ['normal with Pom 4', 4, [0, 2, 3, 4, 5, 6], [5, 7, 8, 9, 10, 11]],
  ] as const)('resolves %s native rolls', (_label, pomLevels, rolls, expected) => {
    const values = rolls.map(
      (roll) =>
        resolveTraitOfferOptionLevel({
          catalog,
          state: traitFrontierState(createTraitHistoryState(), {
            loadout: persephoneLoadout,
            ...(pomLevels === undefined ? {} : { keepsakes: pomBranch(pomLevels).state.keepsakes }),
          }),
          source: context().source,
          option: offer(roll).options[0]!,
        }).effectiveLevel,
    );
    expect(values).toEqual(expected);
  });

  it('treats an active zero-level Pom as no Pom', () => {
    const state = traitFrontierState(createTraitHistoryState(), {
      loadout: persephoneLoadout,
      keepsakes: pomBranch(0).state.keepsakes,
    });
    expect(
      resolveTraitOfferOptionLevel({
        catalog,
        state,
        source: context().source,
        option: offer(5).options[0]!,
      }),
    ).toMatchObject({ effectiveLevel: 5 });
  });

  it('expands only after a chronologically prior Premium Service selection', () => {
    const option = offer(9).options[0]!;
    const standard = resolveTraitOfferOptionLevel({
      catalog,
      state: traitFrontierState(createTraitHistoryState(), { loadout: persephoneLoadout }),
      source: context().source,
      option,
    });
    const premium = foldTraitHistoryEvents(catalog, [
      Object.freeze({
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: 'premium',
        sequence: 1,
        giverKey: 'Hephaestus',
        options: Object.freeze([
          { traitKey: 'WeaponUpgradeBoon', rarity: 'Legendary' as const },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      }),
    ]);
    const upgraded = resolveTraitOfferOptionLevel({
      catalog,
      state: traitFrontierState(premium, {
        loadout: persephoneLoadout,
        keepsakes: pomBranch().state.keepsakes,
      }),
      source: context().source,
      option,
    });
    expect(standard).toMatchObject({ persephoneRollMaximum: 6 });
    expect(standard.findings).toContainEqual(
      expect.objectContaining({ code: 'persephoneRollUnavailable' }),
    );
    expect(upgraded).toMatchObject({ persephoneRollMaximum: 9, effectiveLevel: 13 });
  });

  it('retains raw roll 1 as a representable but invalid authored value', () => {
    const result = resolveTraitOfferOptionLevel({
      catalog,
      state: traitFrontierState(createTraitHistoryState(), { loadout: persephoneLoadout }),
      source: context().source,
      option: offer(1).options[0]!,
    });
    expect(result).toMatchObject({ persephoneRollMaximum: 6 });
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: 'persephoneRollUnavailable' }),
    );
  });

  it.each([
    ['normal', false, undefined, [0, 2, 6], [1, 2, 6]],
    ['normal', false, 3, [0, 2, 6], [4, 6, 10]],
    ['normal', false, 4, [0, 2, 6], [5, 7, 11]],
    ['Premium', true, undefined, [0, 2, 9], [1, 2, 9]],
    ['Premium', true, 3, [0, 2, 9], [4, 6, 13]],
    ['Premium', true, 4, [0, 2, 9], [5, 7, 14]],
  ] as const)(
    'uses the native %s roll domain with Pom %s',
    (_label, premiumActive, pomLevels, rolls, expected) => {
      const premium = premiumActive
        ? foldTraitHistoryEvents(catalog, [
            Object.freeze({
              kind: 'traitOffer' as const,
              owner,
              acquisitionRole: 'premium-matrix',
              sequence: 1,
              giverKey: 'Hephaestus',
              options: Object.freeze([
                { traitKey: 'WeaponUpgradeBoon', rarity: 'Legendary' as const },
              ]) as TraitOfferEvent['options'],
              selectedOptionKey: 'option1' as const,
              acquisitionPoint: 'test',
            }),
          ])
        : createTraitHistoryState();
      const state = traitFrontierState(premium, {
        loadout: persephoneLoadout,
        ...(pomLevels === undefined ? {} : { keepsakes: pomBranch(pomLevels).state.keepsakes }),
      });
      expect(
        rolls.map(
          (roll) =>
            resolveTraitOfferOptionLevel({
              catalog,
              state,
              source: context().source,
              option: offer(roll).options[0]!,
            }).effectiveLevel,
        ),
      ).toEqual(expected);
    },
  );

  it('suppresses both fresh native boosts on Echo nested rows', () => {
    const result = resolveTraitOfferOptionLevel({
      catalog,
      state: traitFrontierState(createTraitHistoryState(), {
        loadout: persephoneLoadout,
        keepsakes: pomBranch().state.keepsakes,
      }),
      source: context(true).source,
      option: offer(5).options[0]!,
    });
    expect(result).toEqual({ effectiveLevel: 1, findings: [] });
  });

  it('suppresses both boosts through the exact Echo last-run selection settlement role', () => {
    const settled = applyTraitOfferForAcquisition(
      catalog,
      pomBranch(),
      {
        origin: owner,
        traitOffersByAcquisitionRole: Object.freeze({
          echoLastRunSelection: offer(5),
        }),
        traitContext: Object.freeze({}),
      },
      'echoLastRunSelection',
      'traitAcquired',
      1,
    );
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
  });

  it('suppresses both boosts through the Echo last-reward producer lifecycle', () => {
    const settled = applyTraitOfferForAcquisition(
      catalog,
      pomBranch(),
      {
        origin: owner,
        producerLifecycleKey: 'EchoLastReward',
        producerKind: 'freeReward',
        traitOffersByAcquisitionRole: Object.freeze({ self: offer(5) }),
        traitContext: Object.freeze({}),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
  });

  it('keeps an ordinary core-god Shop purchase eligible for both fresh boosts', () => {
    const settled = applyTraitOfferForAcquisition(
      catalog,
      pomBranch(),
      {
        origin: owner,
        producerLifecycleKey: 'ordinaryShop',
        producerKind: 'shop',
        traitOffersByAcquisitionRole: Object.freeze({ self: offer(5) }),
        traitContext: Object.freeze({}),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(9);
  });

  it('publishes the candidate effective level that selected settlement installs', () => {
    const branch = pomBranch();
    const candidateContext = context();
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([[semanticAddressKey(address), Object.freeze([candidateContext])]]),
    );
    const candidate = artifacts.at(address)?.evaluateOffer(offer(5))[0];
    if (candidate === undefined) throw new Error('missing candidate branch');
    expect(candidate.effectiveLevels).toEqual([9, 9, 9]);

    const settled = applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin: owner,
        traitOffersByAcquisitionRole: Object.freeze({ self: offer(5) }),
        traitContext: Object.freeze({}),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(
      candidate.effectiveLevels[0],
    );
    const event = settled.branch.state.traitHistory?.events.find(
      (entry): entry is TraitOfferEvent => entry.kind === 'traitOffer',
    );
    expect(event?.selectedEffectiveLevel).toBe(candidate.effectiveLevels[0]);
  });

  it("keeps Concave Stone's residual row at its original frozen level", () => {
    const source = pomBranch();
    const branch = Object.freeze({
      ...source,
      state: Object.freeze({
        ...source.state,
        keepsakes: Object.freeze({
          ...source.state.keepsakes,
          stone: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rank: 'Common' as const,
          }),
        }),
      }),
    });
    const value = Object.freeze({
      ...offer(5),
      concaveStoneResult: { kind: 'proc' as const, optionKey: 'option2' as const },
    });
    const settled = applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin: owner,
        traitOffersByAcquisitionRole: Object.freeze({ self: value }),
        traitContext: Object.freeze({}),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(9);
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloSpecialBoon?.level).toBe(9);
    expect(settled.branch.state.keepsakes.stone?.status).toBe('consumed');
  });

  it('freezes a Concave Stone residual before the same-screen Premium Service selection', () => {
    const history = premiumRequirementHistory();
    const source = pomBranch(3, history);
    const branch = Object.freeze({
      ...source,
      state: Object.freeze({
        ...source.state,
        keepsakes: Object.freeze({
          ...source.state.keepsakes,
          stone: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rank: 'Common' as const,
          }),
        }),
      }),
    });
    const settled = applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin: owner,
        traitOffersByAcquisitionRole: Object.freeze({ self: hephaestusPremiumOffer() }),
        traitContext: Object.freeze({}),
      },
      'self',
      'traitAcquired',
      4,
    );
    expect(settled.blockedChild).toBeUndefined();
    expect(settled.branch.state.traitHistory?.equippedTraits.WeaponUpgradeBoon).toBeDefined();
    expect(settled.branch.state.traitHistory?.equippedTraits.HephaestusSpecialBoon?.level).toBe(9);
    expect(settled.branch.state.keepsakes.stone?.status).toBe('consumed');
  });

  it('settles a Hymn replacement at old level plus two without fresh contributions', () => {
    const before = replacementHistory();
    const value = hymnReplacementOffer();
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'self',
      value,
      traitFrontierState(before, { loadout: persephoneLoadout, stygianWell: { hymnUses: 1 } }),
      {},
      1,
    );
    expect(evaluation.assessments[0]).toMatchObject({
      legal: true,
      replacementTransition: {
        replacedTraitKey: 'ApolloWeaponBoon',
        levelBonus: 2,
      },
    });
    expect(evaluation.levelResolutions[0]).toEqual({ effectiveLevel: 6, findings: [] });

    const source = pomBranch(3, before);
    const branch = Object.freeze({
      ...source,
      state: Object.freeze({
        ...source.state,
        stygianWell: Object.freeze({ ...source.state.stygianWell, hymnUses: 1 }),
      }),
    });
    const settled = applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin: owner,
        traitOffersByAcquisitionRole: Object.freeze({ self: value }),
        traitContext: Object.freeze({}),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.state.traitHistory?.equippedTraits.HeraWeaponBoon).toMatchObject({
      level: 6,
    });
    expect(settled.branch.state.traitHistory?.equippedTraits.HeraWeaponBoon?.level).not.toBe(9);
    expect(settled.branch.state.stygianWell.hymnUses).toBe(0);
  });
});
