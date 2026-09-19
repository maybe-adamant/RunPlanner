import type { Catalog, TraitRarity } from '../../catalog-schema';
import type { AuthoredTraitOffer, TraitOptionKey } from '../../authored-project/traits/state';
import type { RewardHistoryState } from '../../reward-kernel/model';
import type { BoonRarityFacts } from './rarity';
import type { TraitFindingCode } from '../model';
import type { TraitHistoryState, TraitReplacementTransition } from './history/model';
import { optionIndex, traitOfferSupportsExhaustion } from '../../authored-project/traits/state';
import { checkRequirement, targetedAcquisitionTargetKeys } from './level-effects';
import { resolveTraitOfferOptionLevel } from './offer-levels';

export type { TraitFindingCode } from '../model';

export interface TraitOfferContext {
  /** Exact route position at this acquisition frontier when a selected NPC effect is ordinal-scaled. */
  readonly acquisitionOrdinal?: number;
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
  readonly boonRarityRoomOverride?: import('../../catalog-schema').BoonRarityOverride;
  readonly boonRarityItemOverride?: import('../../catalog-schema').BoonRarityOverride;
  /** One-use Yarn contributions carried by the real Well purchase branch. */
  readonly temporaryBoonRarityUses?: number;
  /** Source-local `IgnoreTempRarityBonus`; permanent contributions remain active. */
  readonly suppressTemporaryBoonRarity?: boolean;
  /** One-use forced replacement state carried by Sacrificial Hymn. */
  readonly limitedSwapUses?: number;
  /** Effective ordinary replacement roll after source overrides. */
  readonly replacementRollChance?: number;
  /** Effective Denial suppresses only the native final rarity rescue stage. */
  readonly finalRarityRescueDisabled?: boolean;
}

export interface EchoLastRunBoonOutcome {
  readonly option: import('../../authored-project/traits/state').AuthoredEchoLastRunBoonOption;
  readonly effectiveRarity: TraitRarity;
  readonly effectiveLevel?: number;
  readonly assessment: TraitAssessment;
  readonly targetTraitKeys: readonly string[];
}

/** Current-run exclusions for a boon already authored into the prior-run cache. */
function assessEchoLastRunBoonOption(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext,
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
  for (const requirement of trait.eligibilityRequirements) {
    const failure = checkRequirement(catalog, requirement, trait, history, context);
    if (failure !== undefined) findings.push({ ...failure, traitKey });
  }
  return Object.freeze({ legal: findings.length === 0, findings: Object.freeze(findings) });
}

/** Exact source-resolved Echo-last-run union at one pre-Echo trait frontier. */
export function echoLastRunBoonOutcomes(
  catalog: Catalog,
  history: TraitHistoryState,
  context: TraitOfferContext,
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
        const { effectiveLevel } = resolveTraitOfferOptionLevel({
          catalog,
          before: history,
          context: { stackBoostsSuppressed: true },
          option: { traitKey: variant.traitKey, rarity },
        });
        return Object.freeze({
          option: Object.freeze({
            giverKey: variant.giverKey,
            traitKey: variant.traitKey,
            rarity,
          }),
          effectiveRarity,
          ...(effectiveLevel === undefined ? {} : { effectiveLevel }),
          targetTraitKeys: targetedAcquisitionTargetKeys(catalog, variant.traitKey, history),
          assessment: assessEchoLastRunBoonOption(catalog, variant.traitKey, history, context),
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

/** Findings that belong to a complete offer rather than one option. */
export interface TraitOfferCompositionFinding {
  readonly code:
    | 'traitOfferSelectionUnavailable'
    | 'unsupportedSparseTraitOffer'
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

export function assessTraitOfferComposition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
): TraitOfferCompositionAssessment {
  const giver = catalog.traitGivers.byKey[offer.giverKey];
  const fixedSize = giver !== undefined && !traitOfferSupportsExhaustion(giver);
  if (
    fixedSize &&
    (offer.kind === 'fallbackGold' || (offer.kind === 'traits' && offer.options.length !== 3))
  )
    return Object.freeze({
      applies: true,
      legal: false,
      findings: Object.freeze([{ code: 'unsupportedSparseTraitOffer' as const }]),
    });
  if (offer.kind !== 'traits')
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  const selectionFindings: TraitOfferCompositionFinding[] =
    selected === undefined ? [Object.freeze({ code: 'traitOfferSelectionUnavailable' })] : [];
  return Object.freeze({
    applies: false,
    legal: selectionFindings.length === 0,
    findings: Object.freeze(selectionFindings),
  });
}
