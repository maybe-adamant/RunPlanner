import type { Catalog, TraitRarity } from '../catalog-schema';
import type { AuthoredTraitOffer, TraitOptionKey } from '../authored-project/traits';
import type { RewardHistoryState } from '../reward-kernel/model';
import type { BoonRarityFacts } from './boon-rarity';
import type { TraitFindingCode } from './model';
import type { TraitHistoryState, TraitReplacementTransition } from './trait-history';
import { optionIndex } from '../authored-project/traits';
import { targetedAcquisitionTargetKeys } from './trait-level-effects';
import { ordinaryEquippedSlots } from './trait-history';

export type { TraitFindingCode } from './model';

export interface TraitOfferContext {
  readonly weaponKey?: string;
  readonly aspectKey?: string;
  readonly devotionNoDuo?: boolean;
  readonly blockGiftBoons?: boolean;
  /** Canonical reward-history fact consumed only by Echo Reward availability. */
  readonly echoLastRewardAvailable?: boolean;
  readonly echoLastRewardRecreation?: NonNullable<RewardHistoryState['lastRewardRecreation']>;
  /** Source-resolved appearance rarity that may exceed the ordinary fresh-offer domain. */
  readonly freshRarityOverride?: TraitRarity;
  /** Gorgon's reached ledger realization, retained separately from a fixed source result. */
  readonly gorgonResolvedRarity?: TraitRarity;
  /** Exact pre-acquisition Fear frontier for catalog-owned Circe availability. */
  readonly circeRemovableFearVow?: boolean;
  /** The declaration-resolved provider for the addressed acquisition role. */
  readonly resolvedProviderKey?: string;
  readonly manualArcanaGraspCost?: number;
  /** Direct sources such as Echo may forbid the ordinary replacement path. */
  readonly ordinarySlotReplacement?: 'forbidden';
  /** Source loot flag equivalent to `IgnoreStackBoost`. */
  readonly stackBoostsSuppressed?: boolean;
  /** Exact chronological keepsake held at this acquisition frontier. */
  readonly currentKeepsakeKey?: string;
  /** Canonical reward history fact: at least one Spell Drop has settled. */
  readonly settledSpellDrop?: boolean;
  /** Derived, offer-local numeric rarity facts for fresh Olympian/Hermes rolls. */
  readonly boonRarityFacts?: BoonRarityFacts;
  readonly boonRarityRoomOverride?: import('../catalog-schema').BoonRarityOverride;
  readonly boonRarityItemOverride?: import('../catalog-schema').BoonRarityOverride;
  /** One-use Yarn contributions carried by the real Well purchase branch. */
  readonly temporaryBoonRarityUses?: number;
  /** Source-local `IgnoreTempRarityBonus`; permanent contributions remain active. */
  readonly suppressTemporaryBoonRarity?: boolean;
  /** One-use forced replacement state carried by Sacrificial Hymn. */
  readonly limitedSwapUses?: number;
  /** Effective ordinary replacement roll after source overrides. */
  readonly replacementRollChance?: number;
}

export interface EchoLastRunBoonOutcome {
  readonly option: import('../authored-project/traits').AuthoredEchoLastRunBoonOption;
  readonly effectiveRarity: TraitRarity;
  readonly assessment: TraitAssessment;
  readonly targetTraitKeys: readonly string[];
}

/** Current-run exclusions for a boon already authored into the prior-run cache. */
function assessEchoLastRunBoonOption(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
): TraitAssessment {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined)
    return Object.freeze({
      legal: false,
      findings: Object.freeze([
        Object.freeze({ code: 'missingPrerequisite' as const, traitKey, detail: 'unknown trait' }),
      ]),
    });
  const findings: TraitAssessmentFinding[] = [];
  if (history.bannedTraitKeys.includes(traitKey)) findings.push({ code: 'bannedTrait', traitKey });
  if (history.equippedTraits[traitKey] !== undefined)
    findings.push({ code: 'alreadyEquipped', traitKey });
  if (
    trait.blockOfferIfPreviouslyPicked &&
    history.equippedTraits[traitKey] === undefined &&
    history.previouslyPickedTraitKeys.includes(traitKey)
  )
    findings.push({ code: 'previouslyPicked', traitKey });
  if (trait.equipmentSlot !== undefined && history.equippedSlots[trait.equipmentSlot] !== undefined)
    findings.push({ code: 'occupiedBoonSlot', traitKey, detail: trait.equipmentSlot });
  if (
    trait.targetedAcquisition !== undefined &&
    targetedAcquisitionTargetKeys(catalog, traitKey, history).length === 0
  )
    findings.push({ code: 'targetedAcquisitionNoEligibleTarget', traitKey });
  return Object.freeze({ legal: findings.length === 0, findings: Object.freeze(findings) });
}

/** Exact source-resolved Echo-last-run union at one pre-Echo trait frontier. */
export function echoLastRunBoonOutcomes(
  catalog: Catalog,
  history: TraitHistoryState,
): readonly EchoLastRunBoonOutcome[] {
  return Object.freeze(
    catalog.echoLastRunBoon.variants.values.flatMap((variant) => {
      const trait = catalog.traits.byKey[variant.traitKey];
      if (trait?.rarityDomain.kind !== 'ranked') return [];
      return trait.rarityDomain.equippedRarities.map((rarity) => {
        const effectiveRarity =
          rarity === 'Common' && history.properUpbringingActive === true
            ? ('Rare' as const)
            : rarity;
        return Object.freeze({
          option: Object.freeze({
            giverKey: variant.giverKey,
            traitKey: variant.traitKey,
            rarity,
          }),
          effectiveRarity,
          targetTraitKeys: targetedAcquisitionTargetKeys(catalog, variant.traitKey, history),
          assessment: assessEchoLastRunBoonOption(catalog, variant.traitKey, history),
        });
      });
    }),
  );
}

export interface TraitAssessmentFinding {
  readonly code: TraitFindingCode;
  readonly traitKey: string;
  readonly detail?: string;
  /** Exact declaration keys participating in a positive or negative prerequisite. */
  readonly requirementTraitKeys?: readonly string[];
}

export interface TraitAssessment {
  readonly legal: boolean;
  readonly findings: readonly TraitAssessmentFinding[];
  readonly replacementTransition?: TraitReplacementTransition;
}

export interface TraitCandidateAssessment {
  readonly traitKey: string;
  readonly rarity?: TraitRarity;
  readonly available: boolean;
  readonly assessment: TraitAssessment;
}

/** Findings that belong to the complete first-Olympian offer, not one option's
 * ordinary trait legality.  A missing Attack/Special has no option owner. */
export interface TraitOfferCompositionFinding {
  readonly code:
    | 'nonPriorityTrait'
    | 'missingAttackOrSpecial'
    | 'traitOfferSelectionUnavailable'
    | 'chaosRejectedBlockMissing'
    | 'chaosRejectedBlockUnavailable'
    | 'chaosPairUnavailable';
  readonly traitKey?: string;
  readonly optionKey?: TraitOptionKey;
}

export interface TraitOfferCompositionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly findings: readonly TraitOfferCompositionFinding[];
}

export interface TraitReplacementCompositionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly ordinaryCandidateCount: number;
  readonly eligibleReplacementCount: number;
  readonly maximumReplacementCount: number;
  readonly requiredReplacementCount: number;
  readonly shortageRequiredReplacementCount: number;
  readonly forcedRollRequiredReplacementCount: number;
  readonly replacementCount: number;
  readonly findings: readonly {
    readonly code:
      | 'replacementCompositionExceeded'
      | 'fullTraitOfferWidthRequired'
      | 'missingMandatoryOrdinary'
      | 'missingForcedReplacement'
      | 'unsupportedSparseTraitOffer'
      | 'fallbackGoldUnavailable';
    readonly detail?: string;
  }[];
}

/** One exact pre-offer partition shared by composition and draft construction. */
export interface TraitOfferCompositionDomains {
  readonly ordinary: readonly TraitCandidateAssessment[];
  readonly highTier: readonly TraitCandidateAssessment[];
  readonly replacements: readonly TraitCandidateAssessment[];
}

// This is an identity cache of the complete, immutable domain product. It is
// never a semantic input: callers can always derive the same product from the
// explicit catalog, pre-offer history, giver, and context arguments.
export const compositionDomainCache = new WeakMap<
  Catalog,
  WeakMap<TraitHistoryState, Map<string, TraitOfferCompositionDomains>>
>();

export function compositionDomainCacheKey(giverKey: string, context: TraitOfferContext): string {
  return JSON.stringify([
    giverKey,
    context.weaponKey,
    context.aspectKey,
    context.devotionNoDuo,
    context.blockGiftBoons,
    context.echoLastRewardAvailable,
    context.echoLastRewardRecreation,
    context.freshRarityOverride,
    context.gorgonResolvedRarity,
    context.circeRemovableFearVow,
    context.manualArcanaGraspCost,
    context.currentKeepsakeKey,
    context.stackBoostsSuppressed,
    context.boonRarityFacts,
    context.suppressTemporaryBoonRarity,
  ]);
}

export type TraitOfferDomainOptionKind = 'ordinary' | 'highTier' | 'replacement';

export interface TraitOfferDomainCompositionInput {
  readonly ordinaryKeys: readonly string[];
  readonly highTierKeys: readonly string[];
  readonly replacementKeys: readonly string[];
  readonly authored: readonly {
    readonly traitKey: string;
    readonly kind: TraitOfferDomainOptionKind;
  }[];
  readonly fallbackGold: boolean;
  readonly replacementRollChance: number;
}

export interface TraitOfferDomainCompositionResult {
  readonly legal: boolean;
  readonly ordinaryCandidateCount: number;
  readonly eligibleReplacementCount: number;
  readonly maximumReplacementCount: number;
  readonly requiredReplacementCount: number;
  readonly shortageRequiredReplacementCount: number;
  readonly forcedRollRequiredReplacementCount: number;
  readonly replacementCount: number;
  readonly findings: TraitReplacementCompositionAssessment['findings'];
}

/**
 * The universal three-position exhaustion contract. Inputs are already exact
 * pre-offer O/H/R domains; this function owns only cardinality and fill.
 */
export function assessTraitOfferDomainComposition(
  input: TraitOfferDomainCompositionInput,
): TraitOfferDomainCompositionResult {
  const ordinary = new Set(input.ordinaryKeys);
  const replacements = new Set(input.replacementKeys);
  const ordinaryCandidateCount = ordinary.size;
  const replacementCount = input.authored.filter((option) => option.kind === 'replacement').length;
  const shortageReplacementCount = Math.max(0, 3 - ordinaryCandidateCount);
  const maximumReplacementCount = Math.max(
    shortageReplacementCount,
    input.replacementRollChance > 0 ? 1 : 0,
  );
  if (input.fallbackGold) {
    const legal = ordinaryCandidateCount === 0 && replacements.size === 0;
    return Object.freeze({
      legal,
      ordinaryCandidateCount,
      eligibleReplacementCount: replacements.size,
      maximumReplacementCount: 0,
      requiredReplacementCount: 0,
      shortageRequiredReplacementCount: 0,
      forcedRollRequiredReplacementCount: 0,
      replacementCount: 0,
      findings: legal
        ? Object.freeze([])
        : Object.freeze([Object.freeze({ code: 'fallbackGoldUnavailable' as const })]),
    });
  }
  const optionKeys = new Set(input.authored.map((option) => option.traitKey));
  const missingOrdinary =
    ordinaryCandidateCount > 0 && ordinaryCandidateCount < 3
      ? [...ordinary].filter((key) => !optionKeys.has(key))
      : [];
  const authoredHighTier = input.authored.filter((option) => option.kind === 'highTier').length;
  const exhaustionRequiredReplacement = Math.min(
    replacements.size,
    Math.max(0, 3 - ordinaryCandidateCount - authoredHighTier),
  );
  const forcedRollRequiredReplacement =
    input.replacementRollChance === 1 && replacements.size > 0 ? 1 : 0;
  const requiredReplacement = Math.max(
    exhaustionRequiredReplacement,
    forcedRollRequiredReplacement,
  );
  const findings = Object.freeze([
    ...(ordinaryCandidateCount >= 3 && input.authored.length !== 3
      ? [Object.freeze({ code: 'fullTraitOfferWidthRequired' as const })]
      : []),
    ...(replacementCount > maximumReplacementCount
      ? [
          Object.freeze({
            code: 'replacementCompositionExceeded' as const,
            detail: `${replacementCount}:${maximumReplacementCount}`,
          }),
        ]
      : []),
    ...(missingOrdinary.length > 0
      ? [
          Object.freeze({
            code: 'missingMandatoryOrdinary' as const,
            detail: missingOrdinary.join(','),
          }),
        ]
      : []),
    ...(replacementCount < requiredReplacement
      ? [
          Object.freeze({
            code: 'missingForcedReplacement' as const,
            detail: `${replacementCount}:${requiredReplacement}`,
          }),
        ]
      : []),
  ]);
  return Object.freeze({
    legal: findings.length === 0,
    ordinaryCandidateCount,
    eligibleReplacementCount: replacements.size,
    maximumReplacementCount,
    requiredReplacementCount: requiredReplacement,
    shortageRequiredReplacementCount: exhaustionRequiredReplacement,
    forcedRollRequiredReplacementCount: forcedRollRequiredReplacement,
    replacementCount,
    findings,
  });
}

export function assessTraitOfferComposition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  before: TraitHistoryState,
): TraitOfferCompositionAssessment {
  if (offer.kind !== 'traits')
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  const selectionFindings: TraitOfferCompositionFinding[] =
    selected === undefined ? [Object.freeze({ code: 'traitOfferSelectionUnavailable' })] : [];
  const giver = catalog.traitGivers.byKey[offer.giverKey];
  const applies =
    giver?.providerKind === 'olympian' && Object.keys(ordinaryEquippedSlots(before)).length === 0;
  if (!applies || giver === undefined) {
    return Object.freeze({
      applies: false,
      legal: selectionFindings.length === 0,
      findings: Object.freeze(selectionFindings),
    });
  }
  const priority = new Set(giver.priorityTraitKeys);
  const findings: TraitOfferCompositionFinding[] = [...selectionFindings];
  offer.options.forEach((option, index) => {
    if (!priority.has(option.traitKey)) {
      findings.push(
        Object.freeze({
          code: 'nonPriorityTrait',
          traitKey: option.traitKey,
          optionKey: index === 0 ? 'option1' : index === 1 ? 'option2' : 'option3',
        }),
      );
    }
  });
  const hasAttackOrSpecial = offer.options.some((option) => {
    const slot = catalog.traits.byKey[option.traitKey]?.equipmentSlot;
    return slot === 'Melee' || slot === 'Secondary';
  });
  if (!hasAttackOrSpecial) findings.push(Object.freeze({ code: 'missingAttackOrSpecial' }));
  return Object.freeze({
    applies: true,
    legal: findings.length === 0,
    findings: Object.freeze(findings),
  });
}
