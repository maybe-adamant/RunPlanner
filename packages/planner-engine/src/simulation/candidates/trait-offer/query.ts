import type { Catalog, TraitRarity } from '../../../catalog-schema';
import type {
  InitialOfferFinding,
  TraitOfferGenerationReason,
  TraitOfferRarityCause,
} from '../../traits/authoring/initial-composition';
import type { CurrentArcanaCard } from '../../arcana-fear';
import {
  semanticAddressKey,
  type NaturalSelectionResultAddress,
  type TraitOfferAddress,
} from '../../../authored-project/addresses';
import {
  optionIndex,
  type AuthoredTraitOffer,
  type TraitOptionKey,
} from '../../../authored-project/traits/state';
import type { AuthoredTraitCarrierChild } from '../../../authored-project/traits/carrier-children';
import type { ProjectDocument } from '../../../authored-project/model';
import type {
  ConcaveStoneCandidate,
  TraitOfferGenerationState,
  TraitOfferCandidateArtifacts,
} from './capability';
import type { ProjectEvaluation } from '../../evaluation/evaluation-products';
import type { TraitTargetedAcquisitionAssessment } from '../../traits/history/model';
import type {
  TraitAssessment,
  TraitAssessmentFinding,
  TraitFindingCode,
  TraitOfferCompositionAssessment,
  TraitOfferCompositionFinding,
} from '../../traits/offer-domain';
import { rerolledScreensLegal, type RerolledScreenAssessment } from '../../traits/offers';
import type { CandidateContextUnavailable } from '../availability';
import { unavailableForTraitOffer } from './availability';
import {
  evaluateAllTogetherSetDomain,
  evaluateCirceResolutionDomain,
  evaluateEchoLastRunBoonDomain,
  evaluateEchoPomTargetDomain,
  evaluateNaturalSelectionResultCandidate,
} from './selected-effects';

export type TraitOfferCandidateFindingCode =
  TraitFindingCode | 'duplicateOfferedTrait' | 'screenRerollUnavailable';

export type { TraitOfferGenerationReason, TraitOfferRarityCause };

export interface TraitOfferCandidateFinding {
  readonly code: TraitOfferCandidateFindingCode;
  readonly traitKey?: string;
  readonly detail?: string;
  readonly requirementTraitKeys?: readonly string[];
  /** First-offer composition can identify one concrete option position. */
  readonly optionKey?: TraitOptionKey;
  /** Every offer position containing this duplicate trait. */
  readonly optionKeys?: readonly TraitOptionKey[];
  /** Ordered Calling Card action evidence at this exact offer owner. */
  readonly actionIndex?: number;
  /** The rerolled-away screen's tab index; absent for the final screen. */
  readonly screen?: number;
  /** Why a reroll is refused, or why the game cannot show the screen. */
  readonly reason?: 'nothingLeft' | TraitOfferGenerationReason;
  /** The traits a screen cause names beyond its one row: core boons or a pair. */
  readonly traitKeys?: readonly string[];
  /** A rarity cause: the row's authored rarity, why it cannot roll, and what it would roll. */
  readonly rarity?: TraitRarity;
  readonly rarityCause?: TraitOfferRarityCause;
  readonly requiredRarity?: TraitRarity;
  /** The guaranteed rarity's chance, as a fraction (1.1 is 110%). */
  readonly requiredChance?: number;
}

export interface TraitOfferCandidateQuery {
  readonly kind: 'traitOffer';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
}

/**
 * Evaluates one concrete option while preserving its authored siblings. This
 * is a focused support question, not a partial trait offer: all three values
 * remain input to the same pre-offer artifact.
 */
export interface TraitOfferFocusedOptionCandidateQuery {
  readonly kind: 'traitOfferFocusedOption';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}

/**
 * Requests the exact-target domain for one selected targeted acquisition.
 * The engine enumerates it from the retained pre-offer state; consumers do not
 * inspect or reconstruct trait history.
 */
export interface TraitAcquisitionTargetDomainQuery {
  readonly kind: 'traitAcquisitionTargetDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
  readonly retainedTargetTraitKey?: string;
}

/** One exact structurally discovered selected-outcome child and its full draft. */
export interface TraitCarrierChildDomainQuery {
  readonly kind: 'traitCarrierChildDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly child: AuthoredTraitCarrierChild;
}

/** One selected Circe option's atomic exact-outcome frontier. */
export interface CirceResolutionDomainQuery {
  readonly kind: 'circeResolutionDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}
export type DirectTraitOutcomeSupport = 'forced' | 'possible' | 'impossible';
export interface EvaluatedDirectTraitOutcomeCandidate<T> {
  readonly value: T;
  readonly support: DirectTraitOutcomeSupport;
  readonly selected: boolean;
  readonly reason?: 'duplicateTrait' | 'unavailable';
}
export interface EvaluatedCirceResolutionDomain {
  readonly kind: 'circeResolutionDomain';
  readonly result: {
    readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
    readonly resultRarity: 'Epic' | 'Heroic' | null;
    readonly activeArcana: readonly CurrentArcanaCard[];
    readonly requiredCount: number;
    readonly arcanaCandidates: readonly EvaluatedDirectTraitOutcomeCandidate<string>[];
    readonly vowCandidates: readonly EvaluatedDirectTraitOutcomeCandidate<string>[];
    readonly outerAvailable: boolean;
  };
}
export type CirceResolutionDomainEvaluation =
  CandidateContextUnavailable | EvaluatedCirceResolutionDomain;

export interface EchoPomTargetDomainQuery {
  readonly kind: 'echoPomTargetDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}

/** Exact selected Natural Selection sequence beneath one chosen trait option. */
export interface NaturalSelectionResultCandidateQuery {
  readonly kind: 'naturalSelectionResult';
  readonly result: NaturalSelectionResultAddress;
  readonly value: AuthoredTraitOffer;
  readonly targets: readonly string[] | undefined;
}

/** Read-only derived transform for a selected King's or Queen's Ransom. */
export interface RansomAssessmentCandidateQuery {
  readonly kind: 'ransomAssessment';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
}
export interface EvaluatedRansomAssessmentCandidate {
  readonly kind: 'ransomAssessment';
  readonly result: {
    readonly assessment: import('../../traits').RansomAssessment;
  };
}
export type RansomAssessmentCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedRansomAssessmentCandidate;
export interface EvaluatedNaturalSelectionResultCandidate {
  readonly kind: 'naturalSelectionResult';
  readonly result: {
    readonly supported: boolean;
    readonly complete: boolean;
    readonly nextTargetTraitKeys: readonly string[];
    readonly findings: readonly TraitOfferCandidateFinding[];
  } & NaturalSelectionDraftShape;
}

/** First-pass rows and the completed allocation. */
export type NaturalSelectionDraftShape = Pick<
  import('../../traits').NaturalSelectionTargetAssessment,
  'firstPassRows' | 'completedTargets' | 'levelCountsByTraitKey'
>;
export type NaturalSelectionResultCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedNaturalSelectionResultCandidate;
export interface EvaluatedEchoPomTargetDomain {
  readonly kind: 'echoPomTargetDomain';
  readonly result: {
    readonly candidates: readonly EvaluatedDirectTraitOutcomeCandidate<string | null>[];
    readonly emptyNoOpAllowed: boolean;
  };
}
export type EchoPomTargetDomainEvaluation =
  CandidateContextUnavailable | EvaluatedEchoPomTargetDomain;

export interface EchoLastRunBoonDomainQuery {
  readonly kind: 'echoLastRunBoonDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}
export interface EvaluatedEchoLastRunBoonCandidate {
  readonly option: import('../../../authored-project/traits/state').AuthoredEchoLastRunBoonOption;
  readonly effectiveRarity?: import('../../../catalog-schema').TraitRarity;
  readonly effectiveLevel?: number;
  readonly support: DirectTraitOutcomeSupport;
  readonly reason?: 'unavailable';
  readonly targetRequired: boolean;
  readonly targetCandidates: readonly EvaluatedDirectTraitOutcomeCandidate<string>[];
}
export interface EvaluatedEchoLastRunBoonDomain {
  readonly kind: 'echoLastRunBoonDomain';
  readonly result: {
    readonly candidates: readonly EvaluatedEchoLastRunBoonCandidate[];
    readonly selectedCarrier?:
      | {
          readonly kind: 'allTogether';
          readonly complete: boolean;
          readonly sets: readonly {
            readonly setKey: import('../../../catalog-schema').DirectTraitSetKey;
            readonly candidates: readonly EvaluatedDirectTraitOutcomeCandidate<string | null>[];
          }[];
        }
      | ({
          readonly kind: 'naturalSelection';
          readonly slotCount: number;
          readonly complete: boolean;
          readonly supported: boolean;
          readonly nextTargetCandidates: readonly EvaluatedDirectTraitOutcomeCandidate<string>[];
        } & NaturalSelectionDraftShape);
  };
}
export type EchoLastRunBoonDomainEvaluation =
  CandidateContextUnavailable | EvaluatedEchoLastRunBoonDomain;

export interface AllTogetherSetDomainQuery {
  readonly kind: 'allTogetherSetDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
  readonly setKey: import('../../../catalog-schema').DirectTraitSetKey;
}
export interface EvaluatedAllTogetherSetDomain {
  readonly kind: 'allTogetherSetDomain';
  readonly result: {
    readonly setKey: import('../../../catalog-schema').DirectTraitSetKey;
    readonly candidates: readonly EvaluatedDirectTraitOutcomeCandidate<string | null>[];
  };
}
export type AllTogetherSetDomainEvaluation =
  CandidateContextUnavailable | EvaluatedAllTogetherSetDomain;

export interface EvaluatedTraitAcquisitionTargetCandidate {
  readonly kind: 'traitAcquisitionTarget';
  readonly result: {
    readonly traitKey: string;
    readonly supported: boolean;
    readonly findings: readonly TraitOfferCandidateFinding[];
  };
}

export interface EvaluatedTraitAcquisitionTargetDomain {
  readonly kind: 'traitAcquisitionTargetDomain';
  readonly result: {
    readonly sourceTraitKey: string;
    readonly candidates: readonly EvaluatedTraitAcquisitionTargetCandidate[];
  };
}

export type LatestModelHammerTargets = readonly [string] | readonly [string, string];

export interface LatestModelHammerRow {
  /** Candidate Hammers no other row holds; a row may keep its own. */
  readonly availableTargetTraitKeys: readonly string[];
  /** A later row opens only once every earlier row is chosen. */
  readonly requiresEarlierRow: boolean;
  /** The complete target list after choosing each candidate Hammer at this row. */
  readonly valueByTraitKey: Readonly<Record<string, LatestModelHammerTargets>>;
}

export interface EvaluatedLatestModelTargetsDomain {
  readonly kind: 'latestModelTargetsDomain';
  readonly result: {
    readonly sourceTraitKey: string;
    readonly requiredCount: number;
    readonly candidates: readonly EvaluatedTraitAcquisitionTargetCandidate[];
    /** One row per required or retained target. */
    readonly rows: readonly LatestModelHammerRow[];
  };
}

/** Per-row Latest Model target domains: distinct Hammers, filled from the first row. */
export function latestModelHammerRows(
  candidateTraitKeys: readonly string[],
  requiredCount: number,
  targets: readonly string[],
): readonly LatestModelHammerRow[] {
  return Object.freeze(
    Array.from({ length: Math.max(requiredCount, targets.length) }, (_, index) => {
      const requiresEarlierRow = index > targets.length;
      return Object.freeze({
        availableTargetTraitKeys: Object.freeze(
          candidateTraitKeys.filter((traitKey) =>
            targets.every((target, row) => row === index || target !== traitKey),
          ),
        ),
        requiresEarlierRow,
        valueByTraitKey: Object.freeze(
          Object.fromEntries(
            requiresEarlierRow
              ? []
              : candidateTraitKeys.map((traitKey) => {
                  const next = [...targets];
                  next[index] = traitKey;
                  // Choosing another row's Hammer moves it here rather than duplicating it.
                  const distinct = next.filter(
                    (target, row) => row === index || target !== traitKey,
                  );
                  return [traitKey, Object.freeze(distinct) as LatestModelHammerTargets];
                }),
          ),
        ),
      });
    }),
  );
}

/** The complete offer assessed at its one reached pre-offer state. */
export interface TraitOfferCandidateState {
  readonly assessments: readonly TraitAssessment[];
  readonly generation?: import('../../traits/authoring/initial-composition').InitialOfferSupport;
  readonly composition: TraitOfferCompositionAssessment;
  readonly offerGenerationState?: TraitOfferGenerationState;
  readonly targetedAcquisition?: TraitTargetedAcquisitionAssessment;
  readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
  readonly persephoneBaseLevels: readonly (number | undefined)[];
  readonly jeweledPomLevels: readonly (number | undefined)[];
  readonly effectiveLevels: readonly (number | undefined)[];
  /** The rerolled-away screens' assessments, oldest first; absent when none. */
  readonly rerolledScreens?: readonly RerolledScreenAssessment[];
}

/** Exact Calling Card replay product at the offer's pre-offer state. */
export interface CallingCardOfferCandidate {
  readonly effectiveRarities: readonly (
    import('../../../catalog-schema').TraitRarity | undefined
  )[];
  readonly remainingCharges?: number;
  /**
   * The one keepsake powering this offer's Rarify (a matching Olympian source,
   * else Calling Card), chosen at open, with its uses left after this offer's clicks.
   */
  readonly rarifySource?: { readonly keepsakeKey: string; readonly remainingUses: number };
  readonly invalidActionIndexes: readonly number[];
  readonly rarifiableOptionKeys: readonly TraitOptionKey[];
  /** Each earlier screen's replay, oldest first; absent without earlier screens. */
  readonly rerolledScreens?: readonly CallingCardRerolledScreenCandidate[];
}

/** One earlier screen's Rarify replay: its rows after its clicks, and where one more fits. */
export interface CallingCardRerolledScreenCandidate {
  readonly effectiveRarities: readonly (
    import('../../../catalog-schema').TraitRarity | undefined
  )[];
  readonly invalidActionIndexes: readonly number[];
  readonly rarifiableOptionKeys: readonly TraitOptionKey[];
}

export interface EvaluatedTraitOfferCandidate {
  readonly kind: 'traitOffer';
  readonly result: {
    readonly supported: boolean;
    readonly assessments: readonly TraitAssessment[];
    /** Absent without a reached pre-offer state (a duplicate alone answers). */
    readonly state?: TraitOfferCandidateState;
    readonly callingCard?: CallingCardOfferCandidate;
    readonly concaveStone?: ConcaveStoneCandidate;
    /** Active Chaos restrictions at this complete offer. */
    readonly chaosOfferRules?: ChaosOfferRules;
    readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
    readonly persephoneBaseLevels: readonly (number | undefined)[];
    readonly jeweledPomLevels: readonly (number | undefined)[];
    readonly effectiveLevels: readonly (number | undefined)[];
    readonly findings: readonly TraitOfferCandidateFinding[];
  };
}

/**
 * Engine-owned attribution for a focused option. Consumers use
 * `blocksFocusedOption` instead of reimplementing trait finding policy.
 */
export interface TraitOfferFocusedOptionEvidence {
  readonly source: 'focusedOption' | 'siblingOption' | 'duplicate' | 'targetedAcquisition';
  readonly blocksFocusedOption: boolean;
  readonly finding: TraitOfferCandidateFinding;
}

export interface ChaosOfferRules {
  readonly rejectedBlockRequired: boolean;
  readonly rejectedBlockableOptionKeys: readonly TraitOptionKey[];
  /** A retained block is missing, stale, or targets the selected row. */
  readonly rejectedBlockNeedsRepair: boolean;
}

export interface EvaluatedTraitOfferFocusedOptionCandidate {
  readonly kind: 'traitOfferFocusedOption';
  readonly result: {
    readonly optionKey: TraitOptionKey;
    readonly supported: boolean;
    readonly evidence: readonly TraitOfferFocusedOptionEvidence[];
  };
}

export type TraitOfferCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedTraitOfferCandidate;

export type TraitOfferFocusedOptionCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedTraitOfferFocusedOptionCandidate;

export type TraitAcquisitionTargetDomainEvaluation =
  CandidateContextUnavailable | EvaluatedTraitAcquisitionTargetDomain;

export type TraitCarrierChildDomainEvaluation =
  | TraitAcquisitionTargetDomainEvaluation
  | EvaluatedLatestModelTargetsDomain
  | AllTogetherSetDomainEvaluation
  | NaturalSelectionResultCandidateEvaluation
  | CirceResolutionDomainEvaluation
  | EchoPomTargetDomainEvaluation
  | EchoLastRunBoonDomainEvaluation
  | ConcaveStoneCarrierDomainEvaluation;

export interface EvaluatedConcaveStoneCarrierDomain {
  readonly kind: 'concaveStone';
  /** Absent where the offer has no Stone result to author. */
  readonly result: { readonly stone?: ConcaveStoneCandidate };
}
export type ConcaveStoneCarrierDomainEvaluation =
  CandidateContextUnavailable | EvaluatedConcaveStoneCarrierDomain;

interface TraitOfferCandidateAssessment {
  readonly state?: TraitOfferCandidateState;
  readonly assessments: readonly TraitAssessment[];
  readonly duplicateFindings: readonly TraitOfferCandidateFinding[];
  readonly findings: readonly TraitOfferCandidateFinding[];
  readonly supported: boolean;
}

function candidateFinding(
  finding:
    | TraitAssessmentFinding
    | TraitOfferCompositionFinding
    | InitialOfferFinding
    | { readonly code: TraitFindingCode; readonly detail?: string },
): TraitOfferCandidateFinding {
  return Object.freeze({ ...finding });
}

/** Each rerolled-away screen's findings, with its tab index; as settlement reports them. */
function rerolledScreenCandidateFindings(
  screens: readonly RerolledScreenAssessment[],
): readonly TraitOfferCandidateFinding[] {
  return screens.flatMap((screen) => {
    const at = (finding: Omit<TraitOfferCandidateFinding, 'screen'>) =>
      Object.freeze({ ...finding, screen: screen.screen });
    return [
      ...(screen.missing ? [at({ code: 'rerolledScreenMissing' })] : []),
      ...(screen.rerollRefused === true
        ? [
            Object.freeze({
              code: 'screenRerollUnavailable' as const,
              reason: 'nothingLeft' as const,
            }),
          ]
        : []),
      ...screen.assessments.flatMap((entry) => entry.findings.map((finding) => at(finding))),
      ...(screen.generation?.findings.map((finding) => at(finding)) ?? []),
      ...screen.composition.findings.map((finding) => at(finding)),
    ];
  });
}

/** The duplicate authority is shared by complete and focused candidate paths. */
function duplicateOfferedTraitFindings(
  offer: AuthoredTraitOffer,
): readonly TraitOfferCandidateFinding[] {
  if (offer.kind !== 'traits') return Object.freeze([]);
  const optionKeysByTrait = new Map<string, TraitOptionKey[]>();
  const optionKeys: readonly TraitOptionKey[] = ['option1', 'option2', 'option3'];
  for (const [index, option] of offer.options.entries()) {
    const keys = optionKeysByTrait.get(option.traitKey) ?? [];
    keys.push(optionKeys[index]!);
    optionKeysByTrait.set(option.traitKey, keys);
  }
  return Object.freeze(
    [...optionKeysByTrait.entries()].flatMap(([traitKey, optionKeysForTrait]) =>
      optionKeysForTrait.length > 1
        ? [
            Object.freeze({
              code: 'duplicateOfferedTrait' as const,
              traitKey,
              detail: 'trait appears in more than one offered option',
              optionKeys: Object.freeze([...optionKeysForTrait]),
            }),
          ]
        : [],
    ),
  );
}

/**
 * Normalizes exact artifact output once for both candidate questions. No
 * focused path reevaluates trait legality or whole-screen support.
 */
function assessTraitOfferCandidate(
  reached:
    | {
        readonly assessments: readonly TraitAssessment[];
        readonly generation?: import('../../traits/authoring/initial-composition').InitialOfferSupport;
        readonly composition: TraitOfferCompositionAssessment;
        readonly offerGenerationState?: TraitOfferGenerationState;
        readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
        readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
        readonly persephoneBaseLevels: readonly (number | undefined)[];
        readonly jeweledPomLevels: readonly (number | undefined)[];
        readonly effectiveLevels: readonly (number | undefined)[];
        readonly rerolledScreens?: readonly RerolledScreenAssessment[];
      }
    | undefined,
  duplicateFindings: readonly TraitOfferCandidateFinding[],
  callingCard?: CallingCardOfferCandidate,
  value?: AuthoredTraitOffer,
): TraitOfferCandidateAssessment {
  const state: TraitOfferCandidateState | undefined =
    reached === undefined
      ? undefined
      : Object.freeze({
          assessments: reached.assessments,
          ...(reached.generation === undefined ? {} : { generation: reached.generation }),
          composition: reached.composition,
          ...(reached.offerGenerationState === undefined
            ? {}
            : { offerGenerationState: reached.offerGenerationState }),
          ...(reached.targetedAcquisition.applies
            ? { targetedAcquisition: reached.targetedAcquisition }
            : {}),
          persephoneLevelBonusMaximums: reached.persephoneLevelBonusMaximums,
          persephoneBaseLevels: reached.persephoneBaseLevels,
          jeweledPomLevels: reached.jeweledPomLevels,
          effectiveLevels: reached.effectiveLevels,
          ...(reached.rerolledScreens === undefined
            ? {}
            : { rerolledScreens: reached.rerolledScreens }),
        });
  const findings = Object.freeze([
    ...(state === undefined
      ? []
      : [
          ...state.assessments.flatMap((entry) => entry.findings.map(candidateFinding)),
          // The candidate's own duplicate finding names a repeated row.
          ...(state.generation?.findings
            .filter(
              (finding) =>
                !('reason' in finding && finding.reason === 'duplicateTrait') ||
                duplicateFindings.length === 0,
            )
            .map(candidateFinding) ?? []),
          ...state.composition.findings.map(candidateFinding),
          ...(state.targetedAcquisition?.findings.map(candidateFinding) ?? []),
          ...rerolledScreenCandidateFindings(state.rerolledScreens ?? []),
        ]),
    ...duplicateFindings,
    ...(callingCard?.rerolledScreens ?? []).flatMap((screen, screenIndex) =>
      screen.invalidActionIndexes.map((index) => {
        const optionKey =
          value?.kind === 'chaos'
            ? undefined
            : value?.rerolledScreens?.[screenIndex]?.rarificationActions?.[index];
        return Object.freeze({
          code: 'callingCardRarificationUnavailable' as const,
          actionIndex: index,
          ...(optionKey === undefined ? {} : { optionKey }),
          detail: `rarification action ${index + 1} is unavailable at this offer frontier`,
          screen: screenIndex,
        });
      }),
    ),
    ...(callingCard?.invalidActionIndexes ?? []).map((index) =>
      Object.freeze({
        code: 'callingCardRarificationUnavailable' as const,
        actionIndex: index,
        ...(value?.kind === 'traits' && value.rarificationActions?.[index] === undefined
          ? {}
          : value?.kind === 'traits'
            ? { optionKey: value.rarificationActions![index] }
            : {}),
        detail: `rarification action ${index + 1} is unavailable at this offer frontier`,
      }),
    ),
  ]);
  return Object.freeze({
    ...(state === undefined ? {} : { state }),
    assessments: state?.assessments ?? Object.freeze([]),
    duplicateFindings,
    findings,
    supported:
      duplicateFindings.length === 0 &&
      state !== undefined &&
      (state.generation?.legal ?? true) &&
      state.composition.legal &&
      (state.targetedAcquisition?.legal ?? true) &&
      rerolledScreensLegal(state.rerolledScreens) &&
      state.assessments.every((entry) => entry.legal),
  });
}

function evaluatedTraitOfferCandidate(
  assessment: TraitOfferCandidateAssessment,
  callingCard: CallingCardOfferCandidate | undefined,
  concaveStone: ConcaveStoneCandidate | undefined,
  chaosOfferRules: ChaosOfferRules | undefined,
): EvaluatedTraitOfferCandidate {
  const state = assessment.state;
  return Object.freeze({
    kind: 'traitOffer',
    result: Object.freeze({
      supported: assessment.supported,
      ...(state === undefined ? {} : { state }),
      assessments: assessment.assessments,
      findings: assessment.findings,
      ...(callingCard === undefined ? {} : { callingCard }),
      ...(concaveStone === undefined ? {} : { concaveStone }),
      ...(chaosOfferRules === undefined ? {} : { chaosOfferRules }),
      persephoneLevelBonusMaximums: state?.persephoneLevelBonusMaximums ?? Object.freeze([]),
      persephoneBaseLevels: state?.persephoneBaseLevels ?? Object.freeze([]),
      jeweledPomLevels: state?.jeweledPomLevels ?? Object.freeze([]),
      effectiveLevels: state?.effectiveLevels ?? Object.freeze([]),
    }),
  });
}

function focusedEvidence(
  state: TraitOfferCandidateState | undefined,
  duplicateFindings: readonly TraitOfferCandidateFinding[],
  optionKey: TraitOptionKey,
): readonly TraitOfferFocusedOptionEvidence[] {
  const focusIndex = optionIndex(optionKey);
  const evidence: TraitOfferFocusedOptionEvidence[] = [];
  for (const [index, assessment] of (state?.assessments ?? []).entries()) {
    const focused = index === focusIndex;
    for (const finding of assessment.findings) {
      evidence.push(
        Object.freeze({
          source: focused ? 'focusedOption' : 'siblingOption',
          blocksFocusedOption: focused,
          finding: candidateFinding(finding),
        }),
      );
    }
  }
  for (const finding of duplicateFindings) {
    evidence.push(
      Object.freeze({
        source: 'duplicate',
        blocksFocusedOption: finding.optionKeys?.includes(optionKey) ?? false,
        finding,
      }),
    );
  }
  for (const finding of state?.targetedAcquisition?.findings ?? []) {
    evidence.push(
      Object.freeze({
        source: 'targetedAcquisition',
        // A valid target is the next compound picker step. The focused trait
        // remains selectable when its nonempty target domain is legal.
        blocksFocusedOption: false,
        finding: candidateFinding(finding),
      }),
    );
  }
  return Object.freeze(evidence);
}

function evaluatedFocusedTraitOfferOptionCandidate(
  assessment: TraitOfferCandidateAssessment,
  optionKey: TraitOptionKey,
): EvaluatedTraitOfferFocusedOptionCandidate {
  const evidence = focusedEvidence(assessment.state, assessment.duplicateFindings, optionKey);
  return Object.freeze({
    kind: 'traitOfferFocusedOption',
    result: Object.freeze({
      optionKey,
      supported:
        assessment.state !== undefined && evidence.every((entry) => !entry.blocksFocusedOption),
      evidence,
    }),
  });
}

export function evaluateTraitOfferCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitOfferCandidateQuery,
): TraitOfferCandidateEvaluation {
  const duplicateFindings = duplicateOfferedTraitFindings(query.value);
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined && duplicateFindings.length === 0)
    return unavailableForTraitOffer(evaluation, query.trait);
  const replay = capability?.callingCard(query.value);
  const callingCard: CallingCardOfferCandidate | undefined =
    replay === undefined
      ? undefined
      : Object.freeze({
          effectiveRarities:
            replay.effectiveOffer.kind !== 'traits'
              ? Object.freeze([])
              : Object.freeze(replay.effectiveOffer.options.map((option) => option.rarity)),
          ...(replay.remainingCharges === undefined
            ? {}
            : { remainingCharges: replay.remainingCharges }),
          ...(replay.rarifySource === undefined ? {} : { rarifySource: replay.rarifySource }),
          invalidActionIndexes: replay.invalidActions,
          rarifiableOptionKeys: replay.rarifiableOptionKeys,
          ...(replay.rerolledScreens.length === 0
            ? {}
            : {
                rerolledScreens: Object.freeze(
                  replay.rerolledScreens.map((screen, index) => {
                    const effective =
                      replay.effectiveOffer.kind === 'chaos'
                        ? undefined
                        : replay.effectiveOffer.rerolledScreens?.[index];
                    return Object.freeze({
                      effectiveRarities: Object.freeze(
                        (effective?.options ?? []).map((option) => option.rarity),
                      ),
                      invalidActionIndexes: screen.invalidActions,
                      rarifiableOptionKeys: screen.rarifiableOptionKeys,
                    });
                  }),
                ),
              }),
        });
  const assessment = assessTraitOfferCandidate(
    capability?.evaluateOffer(query.value, true),
    duplicateFindings,
    callingCard,
    query.value,
  );
  return evaluatedTraitOfferCandidate(
    assessment,
    callingCard,
    capability?.concaveStone(query.value),
    capability?.chaosOfferRules(query.value),
  );
}

export function evaluateTraitOfferFocusedOptionCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitOfferFocusedOptionCandidateQuery,
): TraitOfferFocusedOptionCandidateEvaluation {
  if (query.value.kind !== 'traits') return unavailableForTraitOffer(evaluation, query.trait);
  const duplicateFindings = duplicateOfferedTraitFindings(query.value);
  const focusedDuplicate = duplicateFindings.some((finding) =>
    finding.optionKeys?.includes(query.optionKey),
  );
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined && !focusedDuplicate)
    return unavailableForTraitOffer(evaluation, query.trait);
  const assessment = assessTraitOfferCandidate(
    capability?.evaluateOffer(query.value, false),
    duplicateFindings,
  );
  return evaluatedFocusedTraitOfferOptionCandidate(assessment, query.optionKey);
}

export function evaluateTraitAcquisitionTargetDomain(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitAcquisitionTargetDomainQuery,
): TraitAcquisitionTargetDomainEvaluation {
  if (query.value.kind !== 'traits') return unavailableForTraitOffer(evaluation, query.trait);
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const option = query.value.options[optionIndex(query.optionKey)];
  if (option === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const targets = capability.targetedAcquisitionTargets(query.value, query.optionKey);
  const supportedKeys = new Set(targets.sourceSupported ? targets.targetTraitKeys : []);
  const orderedKeys = catalog.traits.values
    .map((trait) => trait.key)
    .filter((traitKey) => supportedKeys.has(traitKey));
  if (
    query.retainedTargetTraitKey !== undefined &&
    !orderedKeys.includes(query.retainedTargetTraitKey)
  ) {
    orderedKeys.push(query.retainedTargetTraitKey);
  }
  return Object.freeze({
    kind: 'traitAcquisitionTargetDomain',
    result: Object.freeze({
      sourceTraitKey: option.traitKey,
      candidates: Object.freeze(
        orderedKeys.map((traitKey) => {
          const supported = supportedKeys.has(traitKey);
          return Object.freeze({
            kind: 'traitAcquisitionTarget' as const,
            result: Object.freeze({
              traitKey,
              supported,
              findings: Object.freeze(
                supported
                  ? []
                  : [
                      Object.freeze({
                        code: 'targetedAcquisitionTargetUnavailable' as const,
                        traitKey,
                        detail: traitKey,
                      }),
                    ],
              ),
            }),
          });
        }),
      ),
    }),
  });
}

/**
 * A lazy typed child contact. It delegates to the existing evaluator
 * vocabulary so the retained capability remains owner of private histories.
 */
export function evaluateTraitCarrierChildDomain(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitCarrierChildDomainQuery,
): TraitCarrierChildDomainEvaluation {
  const childTrait =
    query.child.kind === 'hexTree' || query.child.kind === 'concaveStone'
      ? query.child.trait
      : query.child.address.trait;
  if (semanticAddressKey(childTrait) !== semanticAddressKey(query.trait))
    return unavailableForTraitOffer(evaluation, query.trait);
  switch (query.child.kind) {
    case 'traitAcquisitionTarget': {
      const targeted =
        query.value.kind === 'traits'
          ? query.value.options[optionIndex(query.child.optionKey)]
          : undefined;
      return evaluateTraitAcquisitionTargetDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts,
        {
          kind: 'traitAcquisitionTargetDomain',
          trait: query.trait,
          value: query.value,
          optionKey: query.child.optionKey,
          ...(targeted?.targetTraitKey === undefined
            ? {}
            : { retainedTargetTraitKey: targeted.targetTraitKey }),
        },
      );
    }
    case 'latestModelTargets': {
      const targeted =
        query.value.kind === 'traits'
          ? query.value.options[optionIndex(query.child.optionKey)]
          : undefined;
      const domain = evaluateTraitAcquisitionTargetDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts,
        {
          kind: 'traitAcquisitionTargetDomain',
          trait: query.trait,
          value: query.value,
          optionKey: query.child.optionKey,
        },
      );
      if (domain.kind !== 'traitAcquisitionTargetDomain') return domain;
      const requiredCount = candidateArtifacts
        ?.at(query.trait)
        ?.targetedAcquisitionTargets(query.value, query.child.optionKey).requiredCount;
      if (requiredCount === undefined) return unavailableForTraitOffer(evaluation, query.trait);
      const retained = targeted?.icarusHammerTargets ?? [];
      const candidates = [...domain.result.candidates];
      for (const traitKey of retained) {
        if (candidates.some((candidate) => candidate.result.traitKey === traitKey)) continue;
        candidates.push(
          Object.freeze({
            kind: 'traitAcquisitionTarget',
            result: Object.freeze({
              traitKey,
              supported: false,
              findings: Object.freeze([
                { code: 'targetedAcquisitionTargetUnavailable' as const, traitKey },
              ]),
            }),
          }),
        );
      }
      return Object.freeze({
        kind: 'latestModelTargetsDomain' as const,
        result: Object.freeze({
          sourceTraitKey: targeted?.traitKey ?? query.child.traitKey,
          requiredCount,
          candidates: Object.freeze(candidates),
          rows: latestModelHammerRows(
            candidates.map((candidate) => candidate.result.traitKey),
            requiredCount,
            retained,
          ),
        }),
      });
    }
    case 'allTogetherSet':
      return evaluateAllTogetherSetDomain(catalog, project, evaluation, candidateArtifacts, {
        kind: 'allTogetherSetDomain',
        trait: query.trait,
        value: query.value,
        optionKey: query.child.optionKey,
        setKey: query.child.setKey,
      });
    case 'naturalSelectionResult': {
      const natural =
        query.value.kind === 'traits'
          ? query.value.options[optionIndex(query.child.optionKey)]
          : undefined;
      return evaluateNaturalSelectionResultCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts,
        {
          kind: 'naturalSelectionResult',
          result: query.child.address,
          value: query.value,
          targets: natural?.naturalSelectionTargets,
        },
      );
    }
    case 'circeResolution':
      return evaluateCirceResolutionDomain(catalog, project, evaluation, candidateArtifacts, {
        kind: 'circeResolutionDomain',
        trait: query.trait,
        value: query.value,
        optionKey: query.child.optionKey,
      });
    case 'echoPomTarget':
      return evaluateEchoPomTargetDomain(catalog, project, evaluation, candidateArtifacts, {
        kind: 'echoPomTargetDomain',
        trait: query.trait,
        value: query.value,
        optionKey: query.child.optionKey,
      });
    case 'echoLastRunBoon':
      return evaluateEchoLastRunBoonDomain(catalog, project, evaluation, candidateArtifacts, {
        kind: 'echoLastRunBoonDomain',
        trait: query.trait,
        value: query.value,
        optionKey: query.child.optionKey,
      });
    case 'concaveStone': {
      const capability = candidateArtifacts?.at(query.trait);
      if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
      const stone = capability.concaveStone(query.value);
      return Object.freeze({
        kind: 'concaveStone',
        result: Object.freeze(stone === undefined ? {} : { stone }),
      });
    }
    case 'hexTree':
      return unavailableForTraitOffer(evaluation, query.trait);
  }
}

export { evaluateAllTogetherSetDomain, evaluateNaturalSelectionResultCandidate };

export { evaluateRansomAssessmentCandidate } from './selected-effects';

export {
  evaluateCirceResolutionDomain,
  evaluateEchoLastRunBoonDomain,
  evaluateEchoPomTargetDomain,
};
