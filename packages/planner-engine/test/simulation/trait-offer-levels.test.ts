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
  persephoneLevelRolls,
  resolveTraitOfferOptionLevel,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import { applyTraitOfferForAcquisition } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import type { TraitOfferCandidateContext } from '../../src/simulation/traits';
import { traitFrontierState, openTimeTraitOfferContext } from '../support/simulation-state';

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

function offer(bonus?: number): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Apollo',
    options: Object.freeze([
      Object.freeze({
        traitKey: 'ApolloWeaponBoon',
        rarity: 'Common' as const,
        ...(bonus === undefined ? {} : { persephoneLevelBonus: bonus }),
      }),
      Object.freeze({
        traitKey: 'ApolloSpecialBoon',
        rarity: 'Common' as const,
        ...(bonus === undefined ? {} : { persephoneLevelBonus: bonus }),
      }),
      Object.freeze({
        traitKey: 'ApolloCastBoon',
        rarity: 'Common' as const,
        ...(bonus === undefined ? {} : { persephoneLevelBonus: bonus }),
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
        persephoneLevelBonus: 5,
      }),
      Object.freeze({
        traitKey: 'HephaestusCastBoon',
        rarity: 'Common' as const,
        persephoneLevelBonus: 5,
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
        persephoneLevelBonus: 5,
      }),
      Object.freeze({
        traitKey: 'HeraCastBoon',
        rarity: 'Common' as const,
        persephoneLevelBonus: 5,
      }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
  });
}

function context(withSuppression = false): TraitOfferCandidateContext {
  return openTimeTraitOfferContext({
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
  it.each([
    { premium: false, pom: 0, expected: [1, 2, 3, 4, 5, 6] },
    { premium: false, pom: 4, expected: [5, 7, 8, 9, 10, 11] },
    { premium: true, pom: 0, expected: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { premium: true, pom: 3, expected: [4, 6, 7, 8, 9, 10, 11, 12, 13] },
    { premium: true, pom: 4, expected: [5, 7, 8, 9, 10, 11, 12, 13, 14] },
  ])(
    'resolves encoded outcomes with Premium=$premium and Pom=$pom',
    ({ premium, pom, expected }) => {
      const history = premium
        ? foldTraitHistoryEvents(catalog, [
            {
              kind: 'traitOffer',
              owner,
              acquisitionRole: 'premium',
              sequence: 0,
              giverKey: 'Hephaestus',
              options: [{ traitKey: 'WeaponUpgradeBoon', rarity: 'Legendary' }],
              selectedOptionKey: 'option1',
              acquisitionPoint: 'test',
            },
          ])
        : createTraitHistoryState();
      const choices = persephoneLevelRolls(premium ? 8 : 5);
      expect(choices.map(({ roll }) => roll)).toEqual(
        premium ? [0, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 2, 3, 4, 5, 6],
      );
      expect(
        choices.map(
          ({ levelBonus }) =>
            resolveTraitOfferOptionLevel({
              catalog,
              state: pomBranch(pom, history).state,
              source: {},
              option: offer(levelBonus).options[0]!,
            }).effectiveLevel,
        ),
      ).toEqual(expected);
    },
  );

  it('defaults an omitted active contribution to zero while publishing its range', () => {
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(address),
          Object.freeze([
            openTimeTraitOfferContext({
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
      persephoneLevelBonusMaximums: [5, 5, 5],
      effectiveLevels: [1, 1, 1],
    });
    expect(candidate.assessments.every((assessment) => assessment.legal)).toBe(true);
    expect(candidate.assessments.flatMap((assessment) => assessment.findings)).toEqual([]);
  });

  it('maps the stable standard encoding to native rolls and gapped Jeweled Pom levels', () => {
    const values = [0, 1, 2, 3, 4, 5].map(
      (bonus) =>
        resolveTraitOfferOptionLevel({
          catalog,
          state: traitFrontierState(createTraitHistoryState(), {
            loadout: persephoneLoadout,
            keepsakes: pomBranch().state.keepsakes,
          }),
          source: context().source,
          option: offer(bonus).options[0]!,
        }).effectiveLevel,
    );
    expect(values).toEqual([4, 6, 7, 8, 9, 10]);
    expect(persephoneLevelRolls(5)).toEqual([
      { levelBonus: 0, roll: 0 },
      { levelBonus: 1, roll: 2 },
      { levelBonus: 2, roll: 3 },
      { levelBonus: 3, roll: 4 },
      { levelBonus: 4, roll: 5 },
      { levelBonus: 5, roll: 6 },
    ]);
  });

  it('expands only after a chronologically prior Premium Service selection', () => {
    const option = offer(8).options[0]!;
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
    expect(standard).toMatchObject({ persephoneLevelBonusMaximum: 5 });
    expect(standard.findings).toContainEqual(
      expect.objectContaining({ code: 'persephoneLevelBonusUnavailable' }),
    );
    expect(upgraded).toMatchObject({ persephoneLevelBonusMaximum: 8, effectiveLevel: 13 });
  });

  it('suppresses both fresh contributions on Echo nested rows', () => {
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
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(10);
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
    expect(candidate.effectiveLevels).toEqual([10, 10, 10]);

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
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(10);
    expect(settled.branch.state.traitHistory?.equippedTraits.ApolloSpecialBoon?.level).toBe(10);
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
    expect(settled.branch.state.traitHistory?.equippedTraits.HephaestusSpecialBoon?.level).toBe(10);
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
    expect(settled.branch.state.traitHistory?.equippedTraits.HeraWeaponBoon?.level).not.toBe(10);
    expect(settled.branch.state.stygianWell.hymnUses).toBe(0);
  });
});
