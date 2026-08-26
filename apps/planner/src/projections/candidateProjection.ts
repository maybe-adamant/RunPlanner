import {
  type CandidateEvaluationEvent,
  type EvaluatedTraitAcquisitionTargetCandidate,
  type EvaluatedTraitOfferFocusedOptionCandidate,
  type EvaluatedKeepsakeEquipResultCandidate,
  type EvaluatedAcquisitionConversionCandidate,
  type CirceResolutionDomainEvaluation,
  type EchoPomTargetDomainEvaluation,
  type EchoLastRunBoonDomainEvaluation,
  type AllTogetherSetDomainEvaluation,
  type NaturalSelectionResultCandidateEvaluation,
  type RansomAssessmentCandidateEvaluation,
  type ConcaveStoneCandidateBranch,
  type EvaluatedSteadyGrowthOutcomeCandidate,
  type EvaluatedFountainRarityOutcomeCandidate,
  type EvaluatedFigurineArcanaCandidate,
  type ProjectCandidateEvaluation,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import {
  type AcquisitionEntryAddress,
  type AuthoredTraitOption,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type JudgmentArcanaAddress,
  type FigurineArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type AcquisitionRoleAddress,
  type ExitDecisionAddress,
  type EncounterPhaseAddress,
  type HubDecisionAddress,
  type HubSlotAddress,
  type IncomingRewardAddress,
  type LocalVisitSlotAddress,
  type LocalVisitOrderAddress,
  type LocalRewardAddress,
  type OccurrenceId,
  type OccurrenceAddress,
  type ProjectDocument,
  type RewardWheelAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
  type SideRoomGeneration,
  type TraitOfferAddress,
  type LevelResolutionAddress,
  type NaturalSelectionResultAddress,
  type SteadyGrowthOutcomeAddress,
  type FountainRarityOutcomeAddress,
  type TraitOptionKey,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { type Catalog, type RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import type { PreparedRewardDomain, ProjectedRewardDomain } from './rewardDomainProjection';
import { createCandidateProjectionCore } from './candidateProjectionSession';
import {
  createRewardRoomCandidateAdapters,
  type RewardDomainCache,
} from './candidateRewardRoomAdapters';
import { createTraitCandidateAdapters } from './candidateTraitAdapters';

export type RewardCandidateOwner =
  | { readonly kind: 'incomingReward'; readonly address: IncomingRewardAddress }
  | { readonly kind: 'localReward'; readonly address: LocalRewardAddress }
  | { readonly kind: 'rewardWheelOffer'; readonly address: RewardWheelOfferAddress }
  | { readonly kind: 'shopOffer'; readonly address: ShopOfferAddress }
  | { readonly kind: 'acquisitionEntry'; readonly address: AcquisitionEntryAddress };

export type CountedRewardCandidateOwner = Exclude<
  RewardCandidateOwner,
  { readonly kind: 'shopOffer' | 'acquisitionEntry' }
>;

/**
 * Application adaptation of the engine's exact encounter-phase artifact.
 * It intentionally carries only the already-evaluated support state for one
 * displayed definition; no encounter membership or requirement policy is
 * recreated here.
 */
export interface EncounterCandidateProjectionEvaluation {
  readonly kind: 'encounter';
  readonly result: {
    /**
     * Presentation can distinguish missing assessment from a reached phase
     * that is inactive or absent from the engine support set. The latter is a
     * generic support-set exclusion, not application evidence of one exact
     * requirement. React never reevaluates an encounter requirement.
     */
    readonly evidence:
      | { readonly kind: 'coverageUnavailable' }
      | { readonly kind: 'inactiveSlot' }
      | { readonly kind: 'requirementsExcluded' }
      | { readonly kind: 'supported' };
    readonly support: CandidateSupport;
  };
}

export type CandidateProjectionEvaluation =
  | ProjectCandidateEvaluation
  | EvaluatedTraitOfferFocusedOptionCandidate
  | EvaluatedTraitAcquisitionTargetCandidate
  | EncounterCandidateProjectionEvaluation
  | EvaluatedKeepsakeEquipResultCandidate
  | EvaluatedAcquisitionConversionCandidate
  | EvaluatedFountainRarityOutcomeCandidate
  | EvaluatedFigurineArcanaCandidate;

export interface CandidateOptionProjection<
  T,
  Evaluation extends CandidateProjectionEvaluation = ProjectCandidateEvaluation,
> {
  readonly value: T;
  readonly evaluation: Evaluation;
}

export interface CandidateProjectionSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  readonly prepareRewardDomain: (
    rewardTypes: readonly string[],
    selected?: ResolvedRewardOffer,
  ) => PreparedRewardDomain;
  readonly countedRewardTypes: (
    owner: CountedRewardCandidateOwner,
    binding: CountedRewardBinding,
    selectedRewardType?: string,
  ) => readonly string[];
  readonly rewardDomain: (
    owner: RewardCandidateOwner,
    rewardTypes: readonly string[],
    selected?: ResolvedRewardOffer,
  ) => Promise<ProjectedRewardDomain>;
  readonly startRooms: (
    owner: BiomeAddress | OccurrenceAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly roomTargets: (
    target: TargetAddress,
    rooms: readonly RoomDeclaration[],
  ) => readonly CandidateOptionProjection<RoomDeclaration>[];
  readonly encounterPhases: (
    phase: EncounterPhaseAddress,
    encounterKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string, EncounterCandidateProjectionEvaluation>[];
  readonly batchRewardStores: (
    rewardStore: BatchRewardStoreAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly fieldsCageOutcomes: (
    decision: ExitDecisionAddress,
    outcomes: readonly ('min' | 'max')[],
  ) => readonly CandidateOptionProjection<'min' | 'max'>[];
  readonly takeoverPrebossBatches: (
    source: ExitDecisionAddress,
    gameNames: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly hubTerminalTakeover: (
    source: ExitDecisionAddress,
  ) => CandidateOptionProjection<ExitDecisionAddress>;
  readonly shipCombatPhaseCounts: (
    occurrence: OccurrenceAddress,
    values: readonly (2 | 3)[],
  ) => readonly CandidateOptionProjection<2 | 3>[];
  readonly rewardWheelOfferCounts: (
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly rewardWheelStores: (
    wheel: RewardWheelAddress,
    storeKeys: readonly string[],
  ) => readonly CandidateOptionProjection<string>[];
  readonly rewardWheelPicks: (
    wheel: RewardWheelAddress,
    values: readonly number[],
  ) => readonly CandidateOptionProjection<number>[];
  readonly hubSlots: (
    slot: HubSlotAddress,
    occurrenceId: OccurrenceId,
    localOccurrenceIdsBySlot: Readonly<Record<string, OccurrenceId>>,
    values: readonly boolean[],
  ) => readonly CandidateOptionProjection<boolean>[];
  readonly hubVisitOrders: (
    hub: HubDecisionAddress,
    values: readonly (readonly string[])[],
  ) => readonly CandidateOptionProjection<readonly string[]>[];
  readonly localVisitGenerations: (
    slot: LocalVisitSlotAddress,
    values: readonly SideRoomGeneration[],
  ) => readonly CandidateOptionProjection<SideRoomGeneration>[];
  readonly localVisitOrders: (
    order: LocalVisitOrderAddress,
    values: readonly (readonly OccurrenceId[])[],
  ) => readonly CandidateOptionProjection<readonly OccurrenceId[]>[];
  readonly traitOffer: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
  ) => readonly CandidateOptionProjection<AuthoredTraitOffer>[];
  readonly traitOfferStartingDraft: (
    owner: TraitOfferAddress,
    giverKey: string,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly nextOptionalHighTierTraitOfferDraft: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly previousOptionalHighTierTraitOfferDraft: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  /**
   * Evaluates one declaration-compatible concrete domain at one focused offer
   * position. Every query still carries the complete draft into engine offer
   * assessment.
   */
  readonly traitOfferFocusedOptions: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    variants: readonly AuthoredTraitOption[],
  ) => readonly CandidateOptionProjection<AuthoredTraitOption, CandidateProjectionEvaluation>[];
  readonly traitAcquisitionTargets: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    retainedTargetTraitKey?: string,
  ) => readonly CandidateOptionProjection<string, CandidateProjectionEvaluation>[];
  /** Typed exact Circe frontier from the prepared engine candidate session. */
  readonly circeResolution: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => CirceResolutionDomainEvaluation;
  readonly echoPomTarget: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => EchoPomTargetDomainEvaluation;
  readonly echoLastRunBoon: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => EchoLastRunBoonDomainEvaluation;
  readonly allTogetherSet: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    setKey: import('@run-planner/engine/catalog-schema').DirectTraitSetKey,
  ) => AllTogetherSetDomainEvaluation;
  /** Exact engine-backed Natural Selection child capability. */
  readonly naturalSelectionResult: (
    owner: NaturalSelectionResultAddress,
    value: AuthoredTraitOffer,
    targets: readonly string[] | undefined,
  ) => NaturalSelectionResultCandidateEvaluation;
  readonly ransomAssessment: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
  ) => RansomAssessmentCandidateEvaluation;
  readonly concaveStone: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOffer,
  ) => readonly ConcaveStoneCandidateBranch[];
  /** Exact engine-backed Steady Growth threshold capability. */
  readonly steadyGrowthOutcome: (
    owner: SteadyGrowthOutcomeAddress,
    targetTraitKey: string | null | undefined,
  ) =>
    | EvaluatedSteadyGrowthOutcomeCandidate
    | import('@run-planner/engine/simulation').CandidateContextUnavailable;
  readonly fountainRarityOutcome: (
    owner: FountainRarityOutcomeAddress,
    targetTraitKey: string | null | undefined,
  ) =>
    | EvaluatedFountainRarityOutcomeCandidate
    | import('@run-planner/engine/simulation').CandidateContextUnavailable;
  readonly levelResolution: (
    owner: LevelResolutionAddress,
    value: AuthoredLevelResolution,
  ) => LevelResolutionCandidateProjection | undefined;
  /** One atomic exact Judgment selection, assessed against its pre-effect domain. */
  readonly judgmentArcana: (
    owner: JudgmentArcanaAddress,
    arcanaKeys: readonly string[],
  ) => CandidateProjectionEvaluation;
  /** One atomic exact Crystal Figurine selection, assessed after Judgment. */
  readonly figurineArcana: (
    owner: FigurineArcanaAddress,
    arcanaKeys: readonly string[],
  ) => CandidateProjectionEvaluation;
  /** Exact engine-captured keepsake frontier, projected one option at a time for controls. */
  readonly keepsakeSelections: (
    owner: KeepsakeSelectionAddress,
  ) => readonly CandidateOptionProjection<string>[];
  readonly keepsakeEquipResult: (
    owner: KeepsakeEquipResultAddress,
    value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults[keyof import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults],
  ) => readonly CandidateOptionProjection<string>[];
  readonly acquisitionConversion: (owner: AcquisitionRoleAddress) => CandidateProjectionEvaluation;
}

export interface LevelResolutionCandidateProjection {
  readonly groups: readonly LevelResolutionCandidateGroup[];
}

export interface LevelResolutionCandidateSurface {
  readonly effectKind: 'choice' | 'random';
  readonly emptyTargetAllowed?: boolean;
  readonly levelCount: number;
  readonly requiredOfferCount?: number;
  readonly eligibleTargetTraitKeys: readonly string[];
}

export interface LevelResolutionCandidateGroup {
  readonly key: string;
  readonly branchIndices: readonly number[];
  readonly surface: LevelResolutionCandidateSurface;
  readonly evaluations: readonly {
    readonly branchIndex: number;
    readonly supported: boolean;
    readonly findings: readonly string[];
  }[];
}

export interface CandidateSessionFactory {
  readonly bind: (assembly: ProjectEvaluationAssembly) => CandidateProjectionSession;
}

export interface CandidateSessionFactoryOptions {
  readonly observeCandidateEvaluation?: (event: CandidateEvaluationEvent) => void;
  readonly yieldToHost?: () => Promise<void>;
}

export function createCandidateSessionFactory(
  catalog: Catalog,
  options: CandidateSessionFactoryOptions = {},
): CandidateSessionFactory {
  const coreFactory = createCandidateProjectionCore(catalog, options);
  const rewardDomainCache: RewardDomainCache = {
    rewardTypeDomainCache: new WeakMap(),
    preparedRewardDomainCache: new Map(),
    pendingRewardDomains: new WeakMap(),
  };
  const boundSessionCache = new WeakMap<ProjectEvaluationAssembly, CandidateProjectionSession>();
  const bind = (assembly: ProjectEvaluationAssembly): CandidateProjectionSession => {
    const existing = boundSessionCache.get(assembly);
    if (existing !== undefined) return existing;
    const core = coreFactory.bind(assembly);
    const rewardAdapters = createRewardRoomCandidateAdapters(core, rewardDomainCache);
    const traitAdapters = createTraitCandidateAdapters(core);
    const session = Object.freeze({
      project: assembly.project,
      evaluation: assembly.evaluation,
      ...rewardAdapters,
      ...traitAdapters,
    });
    boundSessionCache.set(assembly, session);
    return session;
  };
  return Object.freeze({ bind });
}

export type CandidateSupport = 'forced' | 'impossible' | 'possible' | 'unavailable';

function candidateSelectedPossible(evaluation: CandidateProjectionEvaluation): boolean {
  switch (evaluation.kind) {
    case 'encounter':
      return evaluation.result.support === 'forced' || evaluation.result.support === 'possible';
    case 'unavailable':
      return false;
    case 'roomTarget':
      return evaluation.result.pressure.selectedPossible;
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'acquisitionEntryOffer':
      return evaluation.result.supported;
    case 'takeoverPrebossBatch':
    case 'hubTerminalTakeover':
      return evaluation.result.support !== 'impossible';
    case 'traitOffer':
    case 'traitOfferFocusedOption':
    case 'traitAcquisitionTarget':
      return evaluation.result.supported;
    case 'judgmentArcana':
    case 'figurineArcana':
    case 'keepsakeSelection':
      return evaluation.result.selectedPossible;
    case 'acquisitionConversion':
      return (
        evaluation.result.timePieceSupported ||
        evaluation.result.artificerSupported ||
        evaluation.result.seaStarSupported
      );
    case 'steadyGrowthOutcome':
      return evaluation.result.selectedPossible;
    case 'fountainRarityOutcome':
      return evaluation.result.selectedPossible;
    default:
      return evaluation.result.selectedPossible;
  }
}

function candidateForced(
  evaluation: Exclude<CandidateProjectionEvaluation, { readonly kind: 'unavailable' }>,
): boolean {
  switch (evaluation.kind) {
    case 'encounter':
      return evaluation.result.support === 'forced';
    case 'judgmentArcana':
    case 'figurineArcana':
    case 'keepsakeSelection':
    case 'keepsakeEquipResult':
    case 'acquisitionConversion':
    case 'steadyGrowthOutcome':
    case 'fountainRarityOutcome':
      return false;
    case 'roomTarget':
      return (
        evaluation.result.pressure.selectedPossible &&
        evaluation.result.pressure.requiredForcedRoomGameNames.includes(
          evaluation.result.pressure.selectedGameName,
        )
      );
    case 'startRoom':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportedGameNames.length === 1
      );
    case 'batchRewardStore':
      return evaluation.result.selectedPossible && evaluation.result.supportStoreKeys.length === 1;
    case 'fieldsCageOutcome':
      return evaluation.result.selectedPossible && evaluation.result.supportOutcomes.length === 1;
    case 'shipEncounterCount':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportEncounterCounts.length === 1
      );
    case 'rewardWheelStore':
      return (
        evaluation.result.selectedPossible && evaluation.result.supportedStoreKeys.length === 1
      );
    case 'hubSlot':
    case 'hubVisitOrder':
    case 'rewardWheelOfferCount':
    case 'rewardWheelPicked':
    case 'sideRoomGeneration':
    case 'sideRoomEntryOrder':
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'acquisitionEntryOffer':
      return false;
    case 'takeoverPrebossBatch':
    case 'hubTerminalTakeover':
      return evaluation.result.support === 'required';
    case 'traitOffer':
    case 'traitOfferFocusedOption':
    case 'traitAcquisitionTarget':
      return false;
    default:
      return false;
  }
}

export function candidateSupport(
  option: CandidateOptionProjection<unknown, CandidateProjectionEvaluation> | undefined,
): CandidateSupport {
  if (option === undefined || option.evaluation.kind === 'unavailable') return 'unavailable';
  if (option.evaluation.kind === 'encounter') return option.evaluation.result.support;
  if (!candidateSelectedPossible(option.evaluation)) return 'impossible';
  return candidateForced(option.evaluation) ? 'forced' : 'possible';
}

export function presentCandidateLabel(
  label: string,
  option: CandidateOptionProjection<unknown, CandidateProjectionEvaluation> | undefined,
): string {
  return candidateSupport(option) === 'impossible' ? `${label} — unavailable` : label;
}
