import type { Catalog, TraitOrdinaryBoonSlot, TraitRarity } from '../../../catalog-schema';
import type { AuthoredTraitOffer, EquippedTrait } from '../../../authored-project/traits/state';
import { boonRarityRollUnavailable } from '../rarity';
import { optionIndex } from '../../../authored-project/traits/state';
import { bridalGlowAddedLevels, isPomUpgradeTarget, nextRarity } from '../history/upgrades';
import type {
  TraitHistoryState,
  TraitReplacementTransition,
  TraitTargetedAcquisitionAssessment,
  TraitTargetedAcquisitionTransition,
} from '../history/model';
import {
  selectedTargetedAcquisitionTargetKeys,
  latestModelTargetDomain,
  targetedAcquisitionTargetKeys,
  checkRequirement,
} from '../level-effects';
import {
  assessTraitOfferComposition,
  echoLastRunBoonOutcomes,
  type TraitAssessment,
  type TraitAssessmentFinding,
  type TraitCandidateAssessment,
  type TraitOfferCompositionAssessment,
  type TraitOfferContext,
} from '../offer-domain';
import { assessInitialOfferSupport, type InitialOfferInput } from './initial-composition';
import type { InitialOfferSupport } from './initial-composition';

export type { TraitFindingCode } from '../../model';

export interface NaturalSelectionStep {
  readonly targetTraitKey: string;
  readonly oldLevel: number;
  readonly newLevel: number;
}

export interface NaturalSelectionTargetAssessment {
  readonly legal: boolean;
  /** A legal prefix is complete only at eight successes or a true empty next domain. */
  readonly complete: boolean;
  readonly steps: readonly NaturalSelectionStep[];
  readonly nextTargetTraitKeys: readonly string[];
}

/**
 * Validates Natural Selection against its immutable pre-acquisition frontier.
 * The initial author-selected round is the game's one shuffled order. The
 * currently simulated prefix only removes a cooldown-capped Hephaestus target
 * at the precise increment that makes further upgrades ineffective; later
 * turns retain the same surviving cyclic order and never become persisted
 * effect state.
 */
export function assessNaturalSelectionTargets(
  catalog: Catalog,
  before: TraitHistoryState,
  levelCount: number,
  slots: readonly TraitOrdinaryBoonSlot[],
  targets: readonly string[] | undefined,
): NaturalSelectionTargetAssessment {
  const simulated = new Map(
    Object.values(before.equippedTraits).map((trait) => [trait.traitKey, trait]),
  );
  const initiallyEligible = [...simulated.values()]
    .filter((trait) => {
      const slot = catalog.traits.byKey[trait.traitKey]?.equipmentSlot;
      return (
        slot !== undefined &&
        slot !== 'Spell' &&
        slots.includes(slot) &&
        isPomUpgradeTarget(catalog, trait)
      );
    })
    .map((trait) => trait.traitKey);
  if (initiallyEligible.length === 0 || initiallyEligible.length > levelCount)
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze([]),
    });
  if (targets === undefined || targets.length === 0)
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze(initiallyEligible),
    });
  if (targets.length > levelCount)
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze([]),
    });
  if (targets.length < initiallyEligible.length) {
    const prefix = targets;
    if (
      new Set(prefix).size !== prefix.length ||
      prefix.some((traitKey) => !initiallyEligible.includes(traitKey))
    )
      return Object.freeze({
        legal: false,
        complete: false,
        steps: Object.freeze([]),
        nextTargetTraitKeys: Object.freeze([]),
      });
    return Object.freeze({
      legal: true,
      complete: false,
      steps: Object.freeze(
        prefix.map((targetTraitKey) => {
          const target = simulated.get(targetTraitKey)!;
          return Object.freeze({
            targetTraitKey,
            oldLevel: target.level!,
            newLevel: target.level! + 1,
          });
        }),
      ),
      nextTargetTraitKeys: Object.freeze(initiallyEligible.filter((key) => !prefix.includes(key))),
    });
  }
  const stableOrder = targets.slice(0, initiallyEligible.length);
  if (
    new Set(stableOrder).size !== stableOrder.length ||
    stableOrder.some((traitKey) => !initiallyEligible.includes(traitKey)) ||
    initiallyEligible.some((traitKey) => !stableOrder.includes(traitKey))
  )
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze([]),
    });
  let cursor = 0;
  const steps: NaturalSelectionStep[] = [];
  for (const targetTraitKey of targets) {
    let target: EquippedTrait | undefined;
    for (let attempts = 0; attempts < stableOrder.length; attempts += 1) {
      const candidateKey = stableOrder[cursor]!;
      cursor = (cursor + 1) % stableOrder.length;
      const candidate = simulated.get(candidateKey);
      if (isPomUpgradeTarget(catalog, candidate)) {
        target = candidate;
        break;
      }
    }
    if (target?.traitKey !== targetTraitKey)
      return Object.freeze({
        legal: false,
        complete: false,
        steps: Object.freeze([]),
        nextTargetTraitKeys: Object.freeze([]),
      });
    if (target.level === undefined)
      return Object.freeze({
        legal: false,
        complete: false,
        steps: Object.freeze([]),
        nextTargetTraitKeys: Object.freeze([]),
      });
    const oldLevel = target.level;
    const newLevel = oldLevel + 1;
    simulated.set(targetTraitKey, Object.freeze({ ...target, level: newLevel }));
    steps.push(Object.freeze({ targetTraitKey, oldLevel, newLevel }));
  }
  const nextTargetTraitKeys: string[] = [];
  for (let attempts = 0; attempts < stableOrder.length; attempts += 1) {
    const candidateKey = stableOrder[(cursor + attempts) % stableOrder.length]!;
    if (isPomUpgradeTarget(catalog, simulated.get(candidateKey))) {
      nextTargetTraitKeys.push(candidateKey);
      break;
    }
  }
  return Object.freeze({
    legal: true,
    complete: targets.length === levelCount || nextTargetTraitKeys.length === 0,
    steps: Object.freeze(steps),
    nextTargetTraitKeys: Object.freeze(nextTargetTraitKeys),
  });
}

export function assessTraitOption(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
  rarity?: TraitRarity,
): TraitAssessment {
  return assessTraitOptionAgainstRarityDomain(catalog, traitKey, history, context, rarity);
}

/** Native declaration eligibility before picker ownership, occupied-slot and
 * rarity layers. Initial generation deliberately consumes this view. */
export function assessTraitDeclarationEligibility(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): TraitAssessment {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined)
    return Object.freeze({
      legal: false,
      findings: Object.freeze([
        { code: 'missingPrerequisite' as const, traitKey, detail: 'unknown trait' },
      ]),
    });
  const findings: TraitAssessmentFinding[] = [];
  if (history.bannedTraitKeys.includes(traitKey)) findings.push({ code: 'bannedTrait', traitKey });
  if (trait.blockOfferIfPreviouslyPicked && history.previouslyPickedTraitKeys.includes(traitKey))
    findings.push({ code: 'previouslyPicked', traitKey });
  for (const requirement of trait.eligibilityRequirements) {
    const failure = checkRequirement(catalog, requirement, trait, history, context);
    if (failure !== undefined) findings.push({ ...failure, traitKey });
  }
  for (const requirement of trait.linkedBoonRequirements) {
    const failure = checkRequirement(catalog, requirement, trait, history, context);
    if (failure !== undefined) findings.push({ ...failure, traitKey });
  }
  return Object.freeze({ legal: findings.length === 0, findings: Object.freeze(findings) });
}

export function assessTraitOptionAgainstRarityDomain(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext,
  rarity?: TraitRarity,
  supportedRarities?: readonly TraitRarity[],
): TraitAssessment {
  const declaration = assessTraitDeclarationEligibility(catalog, traitKey, history, context);
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined) return declaration;
  const findings: TraitAssessmentFinding[] = [...declaration.findings];
  if (history.equippedTraits[traitKey] !== undefined)
    findings.push({ code: 'alreadyEquipped', traitKey });
  if (trait.selectedDisposition.kind === 'upgradeOccupiedBoonSlot') {
    const target = history.equippedSlots[trait.selectedDisposition.slot];
    if (!isPomUpgradeTarget(catalog, target))
      findings.push({
        code: 'missingPrerequisite',
        traitKey,
        detail: trait.selectedDisposition.slot,
      });
  }
  if (
    trait.targetedAcquisition !== undefined &&
    targetedAcquisitionTargetKeys(catalog, traitKey, history).length === 0
  ) {
    findings.push({ code: 'targetedAcquisitionNoEligibleTarget', traitKey });
  }
  if (trait.equipmentSlot !== undefined && history.equippedSlots[trait.equipmentSlot] !== undefined)
    findings.push({ code: 'occupiedBoonSlot', traitKey, detail: trait.equipmentSlot });
  if (
    trait.hammerCompatibility !== undefined &&
    ((context.weaponKey !== undefined &&
      context.weaponKey !== trait.hammerCompatibility.weaponKey) ||
      (context.aspectKey !== undefined &&
        !trait.hammerCompatibility.aspectKeys.includes(context.aspectKey)))
  )
    findings.push({ code: 'wrongHammerLoadout', traitKey });
  let replacementTransition: TraitReplacementTransition | undefined;
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'lastRunBoon' &&
    !echoLastRunBoonOutcomes(catalog, history, context).some((outcome) => outcome.assessment.legal)
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoLastRunBoonEmpty' });
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'lastReward' &&
    context.echoLastRewardAvailable !== true
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoLastRewardMissing' });
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'repeatKeepsake' &&
    (context.currentKeepsakeKey === undefined ||
      trait.selectedDisposition.excludedKeepsakeKeys.includes(context.currentKeepsakeKey))
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoKeepsakeExcluded' });
  const occupied =
    trait.equipmentSlot === undefined ? undefined : history.equippedSlots[trait.equipmentSlot];
  const giver = context.resolvedProviderKey
    ? catalog.traitGivers.byKey[context.resolvedProviderKey]
    : undefined;
  const priority = giver === undefined ? false : giver.priorityTraitKeys.includes(traitKey);
  const replacementEligible =
    context.ordinarySlotReplacement !== 'forbidden' &&
    occupied !== undefined &&
    occupied.traitKey !== traitKey &&
    giver?.providerKind === 'olympian' &&
    priority &&
    history.equippedTraits[traitKey] === undefined;
  if (replacementEligible && occupied !== undefined && trait.equipmentSlot !== undefined) {
    const requiredRarity =
      occupied.rarity === undefined
        ? undefined
        : nextRarity(catalog, occupied.traitKey, occupied.rarity);
    const occupiedIndex = findings.findIndex((finding) => finding.code === 'occupiedBoonSlot');
    const nonSlotFindings = findings.filter((finding) => finding.code !== 'occupiedBoonSlot');
    if (requiredRarity === undefined) {
      findings.push({
        code: 'replacementMaximumRarity',
        traitKey,
        detail: occupied.traitKey,
      });
    } else if (rarity !== requiredRarity) {
      // Retain a precise replacement-shaped diagnostic rather than exposing
      // arbitrary rarity variants for an occupied slot.
      if (occupiedIndex >= 0 && nonSlotFindings.length === 0) findings.splice(occupiedIndex, 1);
      findings.push({
        code: 'replacementRarityMismatch',
        traitKey,
        detail: `${requiredRarity}:${rarity ?? 'missing'}`,
      });
    } else if (nonSlotFindings.length === 0) {
      if (occupiedIndex >= 0) findings.splice(occupiedIndex, 1);
      replacementTransition = Object.freeze({
        slot: trait.equipmentSlot,
        replacedTraitKey: occupied.traitKey,
        oldRarity: occupied.rarity as TraitRarity,
        newTraitKey: traitKey,
        requiredRarity,
      });
    }
  } else if (
    context.ordinarySlotReplacement !== 'forbidden' &&
    occupied !== undefined &&
    trait.equipmentSlot !== undefined
  ) {
    findings.push({
      code: 'replacementUnavailable',
      traitKey,
      detail: trait.equipmentSlot,
    });
  }
  // Ordered rarity probability, depletion and final rescue are complete-offer
  // generation facts for ordinary Olympian/Hermes offers. A row stays
  // individually repairable when its declared rarity can only arrive through
  // zero-chance final rescue. Fixed-provider boon screens retain their direct
  // numeric rarity check because they do not traverse that staged generation.
  // A source override is the exact rarity for fresh rows, not an offer-wide
  // rewrite. Legal replacements retain their explicit promoted rarity even
  // when the fresh table is overridden (for example, Ordinary at Common).
  const ordinaryGeneration = giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes';
  const exactSourceRarity = context.freshRarityOverride ?? context.gorgonResolvedRarity;
  const freshRarityAllowed =
    ordinaryGeneration && context.gorgonResolvedRarity === undefined
      ? trait.rarityDomain.kind !== 'ranked' ||
        rarity === undefined ||
        trait.rarityDomain.freshOfferRarities.includes(rarity)
      : exactSourceRarity === undefined
        ? trait.rarityDomain.kind !== 'ranked' ||
          rarity === undefined ||
          trait.rarityDomain.freshOfferRarities.includes(rarity)
        : rarity === exactSourceRarity;
  if (
    trait.rarityDomain.kind === 'ranked' &&
    rarity !== undefined &&
    !freshRarityAllowed &&
    replacementTransition === undefined
  ) {
    findings.push({
      code: 'freshRarityUnavailable',
      traitKey,
      detail: rarity,
    });
  }
  if (
    !ordinaryGeneration &&
    replacementTransition === undefined &&
    context.boonRarityFacts !== undefined &&
    rarity !== undefined &&
    trait.usesBoonRarity &&
    trait.rarityDomain.kind === 'ranked' &&
    trait.rarityDomain.freshOfferRarities.includes(rarity) &&
    boonRarityRollUnavailable(
      context.boonRarityFacts,
      rarity,
      supportedRarities ?? trait.rarityDomain.freshOfferRarities,
    )
  )
    findings.push({ code: 'rarityRollUnavailable', traitKey, detail: rarity });
  return Object.freeze({
    legal: findings.length === 0,
    findings: Object.freeze(findings),
    ...(replacementTransition === undefined ? {} : { replacementTransition }),
  });
}

export function assessTraitOffer(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): readonly TraitAssessment[] {
  if (offer.kind !== 'traits') return Object.freeze([]);
  const offerContext = { ...context, resolvedProviderKey: offer.giverKey };
  return Object.freeze(
    offer.options.map((option) => {
      const assessment = assessTraitOptionAgainstRarityDomain(
        catalog,
        option.traitKey,
        history,
        offerContext,
        option.rarity,
      );
      if ((context.limitedSwapUses ?? 0) === 0 || assessment.replacementTransition === undefined)
        return assessment;
      return Object.freeze({
        ...assessment,
        replacementTransition: Object.freeze({
          ...assessment.replacementTransition,
          levelBonus: 2,
        }),
      });
    }),
  );
}

/**
 * The offer frontier Calling Card is allowed to act on.  This deliberately
 * excludes selected-only acquisition consequences: spending a row action is
 * an offer action, so a later invalid selected child must not undo it.
 */
export function assessTraitOfferBeforeRarification(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): {
  readonly assessments: readonly TraitAssessment[];
  readonly generation?: InitialOfferSupport;
  readonly composition: TraitOfferCompositionAssessment;
  readonly legal: boolean;
} {
  const assessments = assessTraitOffer(catalog, offer, history, context);
  const giver = offer.kind === 'chaos' ? undefined : catalog.traitGivers.byKey[offer.giverKey];
  const ordinary = giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes';
  const generation = ordinary
    ? assessInitialOfferSupport({
        ...traitOfferGenerationInput(catalog, offer.giverKey, history, context),
        offer,
      })
    : undefined;
  const composition = assessTraitOfferComposition(catalog, offer);
  return Object.freeze({
    assessments,
    ...(generation === undefined ? {} : { generation }),
    composition,
    legal:
      (generation?.legal ?? true) &&
      composition.legal &&
      assessments.every((assessment) => assessment.legal),
  });
}

export function assessSelectedTargetedAcquisition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: Pick<TraitOfferContext, 'acquisitionOrdinal'> = {},
): TraitTargetedAcquisitionAssessment {
  if (offer.kind !== 'traits')
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const option = offer.options[optionIndex(offer.selectedOptionKey)];
  if (option === undefined) {
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  }
  const acquisition = catalog.traits.byKey[option.traitKey]?.targetedAcquisition;
  if (acquisition === undefined) {
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  }
  const selectedSource = option;
  const targets = selectedTargetedAcquisitionTargetKeys(catalog, selectedSource, history);
  if (targets.length === 0) {
    const finding = Object.freeze({
      code: 'targetedAcquisitionNoEligibleTarget' as const,
      traitKey: option.traitKey,
    });
    return Object.freeze({
      applies: true,
      legal: false,
      sourceTraitKey: option.traitKey,
      findings: Object.freeze([finding]),
    });
  }
  if (acquisition.kind === 'upgradeHammerToRank2') {
    const ordinal = context.acquisitionOrdinal;
    if (ordinal === undefined || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4)
      throw new Error('Latest Model requires an explicit acquisition ordinal');
    const latestModel = latestModelTargetDomain(catalog, option.traitKey, history, ordinal);
    const requiredCount = latestModel.requiredCount;
    const selected = option.icarusHammerTargets;
    if (
      option.targetTraitKey !== undefined ||
      selected === undefined ||
      selected.length < requiredCount
    ) {
      const finding = Object.freeze({
        code: 'targetedAcquisitionTargetMissing' as const,
        traitKey: option.traitKey,
      });
      return Object.freeze({
        applies: true,
        legal: false,
        sourceTraitKey: option.traitKey,
        findings: Object.freeze([finding]),
      });
    }
    if (
      selected.length > requiredCount ||
      new Set(selected).size !== selected.length ||
      selected.some((key) => !latestModel.targetTraitKeys.includes(key))
    ) {
      const finding = Object.freeze({
        code: 'targetedAcquisitionTargetUnavailable' as const,
        traitKey: option.traitKey,
      });
      return Object.freeze({
        applies: true,
        legal: false,
        sourceTraitKey: option.traitKey,
        findings: Object.freeze([finding]),
      });
    }
    return Object.freeze({
      applies: true,
      legal: true,
      sourceTraitKey: option.traitKey,
      findings: Object.freeze([]),
      transition: Object.freeze({
        kind: 'upgradeHammerToRank2' as const,
        sourceTraitKey: option.traitKey,
        targetTraitKeys: Object.freeze([...selected]),
        oldHammerRank: 'RankI' as const,
        newHammerRank: 'RankII' as const,
      }),
    });
  }
  if (option.targetTraitKey === undefined) {
    const finding = Object.freeze({
      code: 'targetedAcquisitionTargetMissing' as const,
      traitKey: option.traitKey,
    });
    return Object.freeze({
      applies: true,
      legal: false,
      sourceTraitKey: option.traitKey,
      findings: Object.freeze([finding]),
    });
  }
  if (!targets.includes(option.targetTraitKey)) {
    const finding = Object.freeze({
      code: 'targetedAcquisitionTargetUnavailable' as const,
      traitKey: option.traitKey,
      detail: option.targetTraitKey,
    });
    return Object.freeze({
      applies: true,
      legal: false,
      sourceTraitKey: option.traitKey,
      targetTraitKey: option.targetTraitKey,
      findings: Object.freeze([finding]),
    });
  }
  const equippedTarget = history.equippedTraits[option.targetTraitKey];
  const sourceIsTarget = selectedSource.traitKey === option.targetTraitKey;
  if (equippedTarget === undefined && !sourceIsTarget) {
    throw new Error(`targeted acquisition target ${option.targetTraitKey} is not equipped`);
  }
  const transition: TraitTargetedAcquisitionTransition = (() => {
    const oldRarity = equippedTarget?.rarity ?? selectedSource.rarity;
    if (oldRarity === undefined) {
      throw new Error(`targeted acquisition target ${option.targetTraitKey} has no rarity`);
    }
    const levelChange =
      equippedTarget?.level === undefined
        ? undefined
        : Object.freeze({
            oldLevel: equippedTarget.level,
            newLevel: equippedTarget.level + bridalGlowAddedLevels(option.rarity),
          });
    return Object.freeze({
      kind: 'promoteGodTraitToHeroic' as const,
      sourceTraitKey: option.traitKey,
      targetTraitKey: option.targetTraitKey,
      oldRarity,
      newRarity: 'Heroic' as const,
      ...(levelChange === undefined ? {} : { levelChange }),
    });
  })();
  return Object.freeze({
    applies: true,
    legal: true,
    sourceTraitKey: option.traitKey,
    targetTraitKey: option.targetTraitKey,
    findings: Object.freeze([]),
    transition,
  });
}

export function traitCandidates(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): readonly TraitCandidateAssessment[] {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return Object.freeze([]);
  const candidates: TraitCandidateAssessment[] = [];
  for (const traitKey of giver.traitKeys) {
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined) continue;
    const assessment = assessTraitOption(catalog, traitKey, history, {
      ...context,
      resolvedProviderKey: giverKey,
    });
    if (trait.rarityDomain.kind === 'none') {
      candidates.push(Object.freeze({ traitKey, available: assessment.legal, assessment }));
      continue;
    }
    const sourceRarity = context.freshRarityOverride ?? context.gorgonResolvedRarity;
    const freshRarities =
      sourceRarity === undefined ? trait.rarityDomain.freshOfferRarities : [sourceRarity];
    for (const rarity of freshRarities) {
      // Ordinary fresh generation never admits Heroic. A chronological source
      // result such as Gorgon is already the exact reached realization.
      if (rarity === 'Heroic' && sourceRarity !== 'Heroic') continue;
      const rarityAssessment = assessTraitOption(
        catalog,
        traitKey,
        history,
        { ...context, resolvedProviderKey: giverKey },
        rarity,
      );
      // A fresh rarity that is also the exact promoted replacement rarity is
      // represented by the replacement candidate below, never as an ordinary
      // arbitrary variant for an occupied slot.
      if (rarityAssessment.replacementTransition !== undefined) continue;
      candidates.push(
        Object.freeze({
          traitKey,
          rarity,
          available: rarityAssessment.legal,
          assessment: rarityAssessment,
        }),
      );
    }
  }
  // Replacement candidates are exact promoted-rarity variants. They are
  // intentionally emitted in addition to fresh variants only for the giver's
  // priority set; Heroic can therefore appear only as Epic-to-Heroic evidence.
  if (giver.providerKind === 'olympian') {
    for (const traitKey of giver.priorityTraitKeys) {
      const trait = catalog.traits.byKey[traitKey];
      if (trait?.rarityDomain.kind !== 'ranked') continue;
      const occupied =
        trait.equipmentSlot === undefined ? undefined : history.equippedSlots[trait.equipmentSlot];
      if (occupied === undefined) continue;
      const required =
        occupied.rarity === undefined
          ? undefined
          : nextRarity(catalog, occupied.traitKey, occupied.rarity);
      if (required === undefined) continue;
      const assessment = assessTraitOption(
        catalog,
        traitKey,
        history,
        { ...context, resolvedProviderKey: giverKey },
        required,
      );
      candidates.push(
        Object.freeze({
          traitKey,
          rarity: required,
          available: assessment.legal && assessment.replacementTransition !== undefined,
          assessment,
        }),
      );
    }
  }
  return Object.freeze(candidates);
}

/** Shared declaration and replacement inputs for support and draft construction. */
export function traitOfferGenerationInput(
  catalog: Catalog,
  giverKey: string,
  before: TraitHistoryState,
  context: TraitOfferContext = {},
): InitialOfferInput {
  const resolved = { ...context, resolvedProviderKey: giverKey };
  return {
    catalog,
    giverKey,
    history: before,
    context: resolved,
    declarationEligible: (traitKey) =>
      assessTraitDeclarationEligibility(catalog, traitKey, before, resolved).legal,
    replacementFor: (traitKey) => {
      const trait = catalog.traits.byKey[traitKey];
      const occupied =
        trait?.equipmentSlot === undefined ? undefined : before.equippedSlots[trait.equipmentSlot];
      const rarity =
        occupied?.rarity === undefined
          ? undefined
          : nextRarity(catalog, occupied.traitKey, occupied.rarity);
      if (rarity === undefined) return undefined;
      const assessment = assessTraitOption(catalog, traitKey, before, resolved, rarity);
      return assessment.replacementTransition === undefined
        ? undefined
        : Object.freeze({ traitKey, rarity });
    },
  };
}
