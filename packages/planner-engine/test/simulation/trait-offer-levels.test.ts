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

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { applyTraitOfferForAcquisition } from '../../src/simulation/rewards/trait-settlement';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import type { TraitOfferCandidateContext } from '../../src/simulation/traits';

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
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
    keepsakes: Object.freeze({
      ...branch.keepsakes,
      fatedStatus: 'Fated' as const,
      jeweledPom: Object.freeze({
        grantedTraitKey: 'HadesLifestealBoon',
        active: true,
        levels,
        acquisitionIdentity: 'test:pom',
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
  return Object.freeze({
    before: createTraitHistoryState(),
    context: Object.freeze({
      aspectKey: 'LobImpulseAspect',
      ...(withSuppression ? { stackBoostsSuppressed: true as const } : {}),
    }),
    keepsakes: pomBranch().keepsakes,
  });
}

describe('Persephone effective offer levels', () => {
  it('defaults an omitted active contribution to zero while publishing its range', () => {
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(address),
          Object.freeze([
            Object.freeze({
              before: createTraitHistoryState(),
              context: Object.freeze({ aspectKey: 'LobImpulseAspect' }),
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

  it('resolves the standard 0..5 contribution and additive Jeweled Pom levels', () => {
    const values = [0, 1, 2, 3, 4, 5].map(
      (bonus) =>
        resolveTraitOfferOptionLevel({
          catalog,
          before: createTraitHistoryState(),
          context: context().context,
          keepsakes: pomBranch().keepsakes,
          option: offer(bonus).options[0]!,
        }).effectiveLevel,
    );
    expect(values).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('expands only after a chronologically prior Premium Service selection', () => {
    const option = offer(8).options[0]!;
    const standard = resolveTraitOfferOptionLevel({
      catalog,
      before: createTraitHistoryState(),
      context: context().context,
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
      before: premium,
      context: context().context,
      keepsakes: pomBranch().keepsakes,
      option,
    });
    expect(standard).toMatchObject({ persephoneLevelBonusMaximum: 5 });
    expect(standard.findings).toContainEqual(
      expect.objectContaining({ code: 'persephoneLevelBonusUnavailable' }),
    );
    expect(upgraded).toMatchObject({ persephoneLevelBonusMaximum: 8, effectiveLevel: 12 });
  });

  it('suppresses both fresh contributions on Echo nested rows', () => {
    const result = resolveTraitOfferOptionLevel({
      catalog,
      before: createTraitHistoryState(),
      context: context(true).context,
      keepsakes: pomBranch().keepsakes,
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
        traitContext: Object.freeze({ aspectKey: 'LobImpulseAspect' }),
      },
      'echoLastRunSelection',
      'traitAcquired',
      1,
    );
    expect(settled.branch.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
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
        traitContext: Object.freeze({ aspectKey: 'LobImpulseAspect' }),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
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
        traitContext: Object.freeze({ aspectKey: 'LobImpulseAspect' }),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(9);
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
        traitContext: Object.freeze({ aspectKey: 'LobImpulseAspect' }),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(
      candidate.effectiveLevels[0],
    );
    const event = settled.branch.traitHistory?.events.find(
      (entry): entry is TraitOfferEvent => entry.kind === 'traitOffer',
    );
    expect(event?.selectedEffectiveLevel).toBe(candidate.effectiveLevels[0]);
  });

  it("keeps Concave Stone's residual row at its original frozen level", () => {
    const source = pomBranch();
    const branch = Object.freeze({
      ...source,
      keepsakes: Object.freeze({
        ...source.keepsakes,
        stone: Object.freeze({
          origin: 'ordinary' as const,
          status: 'pending' as const,
          rank: 'Common' as const,
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
        traitContext: Object.freeze({ aspectKey: 'LobImpulseAspect' }),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(9);
    expect(settled.branch.traitHistory?.equippedTraits.ApolloSpecialBoon?.level).toBe(9);
    expect(settled.branch.keepsakes.stone?.status).toBe('consumed');
  });

  it('freezes a Concave Stone residual before the same-screen Premium Service selection', () => {
    const history = premiumRequirementHistory();
    const source = pomBranch(3, history);
    const branch = Object.freeze({
      ...source,
      keepsakes: Object.freeze({
        ...source.keepsakes,
        stone: Object.freeze({
          origin: 'ordinary' as const,
          status: 'pending' as const,
          rank: 'Common' as const,
        }),
      }),
    });
    const settled = applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin: owner,
        traitOffersByAcquisitionRole: Object.freeze({ self: hephaestusPremiumOffer() }),
        traitContext: Object.freeze({
          aspectKey: 'LobImpulseAspect',
        }),
      },
      'self',
      'traitAcquired',
      4,
    );
    expect(settled.blockedChild).toBeUndefined();
    expect(settled.branch.traitHistory?.equippedTraits.WeaponUpgradeBoon).toBeDefined();
    expect(settled.branch.traitHistory?.equippedTraits.HephaestusSpecialBoon?.level).toBe(9);
    expect(settled.branch.keepsakes.stone?.status).toBe('consumed');
  });

  it('settles a Hymn replacement at old level plus two without fresh contributions', () => {
    const before = replacementHistory();
    const value = hymnReplacementOffer();
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'self',
      value,
      before,
      { aspectKey: 'LobImpulseAspect', limitedSwapUses: 1 },
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
      stygianWell: Object.freeze({ ...source.stygianWell, hymnUses: 1 }),
    });
    const settled = applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin: owner,
        traitOffersByAcquisitionRole: Object.freeze({ self: value }),
        traitContext: Object.freeze({ aspectKey: 'LobImpulseAspect' }),
      },
      'self',
      'traitAcquired',
      1,
    );
    expect(settled.branch.traitHistory?.equippedTraits.HeraWeaponBoon).toMatchObject({
      level: 6,
    });
    expect(settled.branch.traitHistory?.equippedTraits.HeraWeaponBoon?.level).not.toBe(9);
    expect(settled.branch.stygianWell.hymnUses).toBe(0);
  });
});
