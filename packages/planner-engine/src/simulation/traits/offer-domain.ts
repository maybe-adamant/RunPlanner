import type { Catalog, TraitRarity } from '../../catalog-schema';
import type { AuthoredTraitOffer, TraitOptionKey } from '../../authored-project/traits/state';
import type { SimulationState } from '../state/model';
import type { BoonRarityFacts } from './rarity';
import type { TraitFindingCode } from '../model';
import type { TraitReplacementTransition } from './history/model';
import { optionIndex, traitOfferSupportsExhaustion } from '../../authored-project/traits/state';
import { checkRequirement, targetedAcquisitionTargetKeys } from './level-effects';
import { resolveTraitOfferOptionLevel } from './offer-levels';

export type { TraitFindingCode } from '../model';

/**
 * The source and operation rules for one addressed trait contact. Player and
 * run facts are not repeated here: every eligibility contact receives the exact
 * reached `SimulationState` alongside this description.
 */
export interface TraitOfferSourceContext {
  readonly devotionNoDuo?: boolean;
  readonly blockGiftBoons?: boolean;
  /** Source-resolved appearance rarity that may exceed the ordinary fresh-offer domain. */
  readonly freshRarityOverride?: TraitRarity;
  /** Gorgon's reached ledger realization, retained separately from a fixed source result. */
  readonly gorgonResolvedRarity?: TraitRarity;
  /** The declaration-resolved provider for the addressed acquisition role. */
  readonly resolvedProviderKey?: string;
  /** Direct sources such as Echo may forbid the ordinary replacement path. */
  readonly ordinarySlotReplacement?: 'forbidden';
  /** Source loot flag equivalent to `IgnoreStackBoost`. */
  readonly stackBoostsSuppressed?: boolean;
  readonly boonRarityRoomOverride?: import('../../catalog-schema').BoonRarityOverride;
  readonly boonRarityItemOverride?: import('../../catalog-schema').BoonRarityOverride;
  /** Source-local `IgnoreTempRarityBonus`; permanent contributions remain active. */
  readonly suppressTemporaryBoonRarity?: boolean;
}

/**
 * One source screen after its rarity and replacement policy have been resolved
 * against the same reached state. These are prepared results, never a parallel
 * transport for player facts the state already owns.
 */
export interface ResolvedTraitOfferSource extends TraitOfferSourceContext {
  /** Derived, offer-local numeric rarity facts for fresh Olympian/Hermes rolls. */
  readonly boonRarityFacts?: BoonRarityFacts;
  /** Effective ordinary replacement roll after source overrides. */
  readonly replacementRollChance?: number;
  /** Effective Denial suppresses only the native final rarity rescue stage. */
  readonly finalRarityRescueDisabled?: boolean;
}

/** A reached source that declares no trait-offer policy of its own. */
export const plainTraitOfferSource: TraitOfferSourceContext = Object.freeze({});

/** One-use Yarn contributions carried by the real Well purchase branch. */
export function temporaryBoonRarityUses(
  state: SimulationState,
  source: TraitOfferSourceContext,
): number {
  return source.suppressTemporaryBoonRarity === true ? 0 : state.stygianWell.yarnUses;
}

/** One-use forced replacement state carried by Sacrificial Hymn. */
export function limitedSwapUses(state: SimulationState): number {
  return state.stygianWell.hymnUses;
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
  state: SimulationState,
  source: TraitOfferSourceContext,
): TraitAssessment {
  const history = state.traitHistory;
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
    const failure = checkRequirement(catalog, requirement, trait, state, source);
    if (failure !== undefined) findings.push({ ...failure, traitKey });
  }
  return Object.freeze({ legal: findings.length === 0, findings: Object.freeze(findings) });
}

/** Exact source-resolved Echo-last-run union at one pre-Echo trait frontier. */
export function echoLastRunBoonOutcomes(
  catalog: Catalog,
  state: SimulationState,
  source: TraitOfferSourceContext,
): readonly EchoLastRunBoonOutcome[] {
  const history = state.traitHistory;
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
          state,
          source: { stackBoostsSuppressed: true },
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
          assessment: assessEchoLastRunBoonOption(catalog, variant.traitKey, state, source),
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
