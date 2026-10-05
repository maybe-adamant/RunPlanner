import type { Catalog } from '../../../catalog-schema';
import type { EncounterEntryVowRanks } from '../../arcana-fear';
import type {
  HubDecisionAddress,
  OccurrenceAddress,
  TargetAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import type {
  HermesShrineCandidateContext,
  HermesShrineTravelDealRefillAssessment,
} from '../../commerce/hermes-shrine';
import type { PurgingPoolAssessment } from '../../commerce/purging-pool';
import type { StygianWellCandidateContext } from '../../commerce/stygian-well';
import type { HistoryEvent, HistoryStateView, ProgressiveRoomHistoryViews } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../materialization';
import type { SemanticFinding } from '../../model';
import type { RewardBranchState } from '../branch-primitives';
import type { ShipLifecycleCandidateContext } from '../lifecycle-artifacts';
import type { WellRefillRealization } from '../model';
import type { OfferProcessingPeer } from '../offer-generation';
import type { createRunStateDerivationCache, RunStateSnapshot } from '../run-state';
import type { ChronologyAccumulator, ChronologyEmission } from './chronology-accumulator';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
import type { PendingHubBoardGeneration } from './generation/emissions';
import type { TargetGenerationFrontier } from './generation/target-generation-completed';
import type { PreparedRewardEvaluationInputs } from './prepared-inputs';

/** The fixed inputs every seam handler of one biome walk reads. */
export interface ChronologyWalkContext {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly rooms: ReadonlyMap<string, CanonicalAuthoredRoom | CanonicalHubRoom>;
  readonly views: ReadonlyMap<string, ProgressiveRoomHistoryViews>;
  readonly routeLoadout: RouteLoadout;
  readonly enteredBiomeCount: number;
  readonly fullRunBiomeCount: number;
  readonly routePosition: ResolvedRoutePosition;
  readonly resourcePlacements: ResourcePlacements;
  readonly resourceFindings: readonly SemanticFinding[];
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  readonly history: BiomeRewardHistory;
  readonly prepared: PreparedRewardEvaluationInputs;
  /** Sources whose outgoing checkpoint creates a Hub instead of a reward batch. */
  readonly hubTakeoverSources: ReadonlySet<string>;
  /** Hub visit targets and entered local rooms that restore to an existing parent. */
  readonly hubRestoringSources: ReadonlySet<string>;
  readonly hubDecisionOwnerBySource: ReadonlyMap<string, HubDecisionAddress>;
  /** The source of a prefix's blank exit-decision frontier. */
  readonly frontierSource: string | undefined;
  readonly chaosGateSourceOccurrenceIds: ReadonlySet<string>;
  readonly ixionGeneratedChaosSourceOccurrenceIds: ReadonlySet<string>;
  /** Shared by every Run State capture of this walk. */
  readonly runStateDerivationCache: ReturnType<typeof createRunStateDerivationCache>;
  /** Ordered reads of what earlier seams accumulated. */
  readonly accumulated: Pick<
    ChronologyAccumulator,
    'derivedAcquisitionEntryFrontiers' | 'gorgonPhaseCandidate' | 'findingEntries'
  >;
}

export interface HermesShrineRoomAssessment {
  readonly origin: OccurrenceAddress;
  readonly assessments: readonly HermesShrineCandidateContext[];
}

export interface PurgingPoolRoomAssessment {
  readonly origin: OccurrenceAddress;
  readonly assessments: readonly PurgingPoolAssessment[];
}

export interface StygianWellRoomAssessment {
  readonly origin: OccurrenceAddress;
  readonly assessments: readonly StygianWellCandidateContext[];
}

/** The walk state carried between seams; replaced, never mutated. */
export interface ChronologyWalkState {
  readonly branches: readonly RewardBranchState[];
  /** A seam stopped the walk at its own sequence. */
  readonly halted: boolean;
  readonly stygianWellAssessments: ReadonlyMap<string, StygianWellRoomAssessment>;
  readonly wellRefillRealizations: ReadonlyMap<string, WellRefillRealization>;
  readonly purgingPoolAssessments: ReadonlyMap<string, PurgingPoolRoomAssessment>;
  /** Shrine-keyed Travel Deal refill domain, captured at the first rushed purchase. */
  readonly hermesShrineTravelDealRefills: ReadonlyMap<
    string,
    readonly HermesShrineTravelDealRefillAssessment[]
  >;
  /** Gorgon phases keyed `occurrence::phase`, shared by encounter start and settlement. */
  readonly eligibleGorgonPhases: ReadonlySet<string>;
  readonly blockedGorgonPhases: ReadonlySet<string>;
  readonly gorgonEvaluationBlocked: boolean;
  /** Offers the current batch generated, until the next batch replaces them. */
  readonly peers: readonly OfferProcessingPeer[];
  /**
   * One persistent Ephyra board-generation region. It starts from the
   * post-Hub-entry reward branches and contains every open physical door,
   * independently from the later six-room visit chronology.
   */
  readonly pendingHubBoard: PendingHubBoardGeneration | undefined;
  /**
   * The latest outgoing checkpoint's target generation and per-target stores.
   * A batch's targets are all generated before the next outgoing checkpoint,
   * so each checkpoint replaces them.
   */
  readonly batchTargetGeneration:
    { readonly parentKey: string; readonly frontier: TargetGenerationFrontier } | undefined;
  readonly expectedStores: ReadonlyMap<string, string | undefined>;
  readonly hermesShrineAssessments: ReadonlyMap<string, HermesShrineRoomAssessment>;
  readonly shipLifecycleContexts: ReadonlyMap<string, ShipLifecycleCandidateContext>;
  /** The prepared cohort entering the current room's Overview. */
  readonly overviewCohort:
    { readonly roomKey: string; readonly branches: readonly RewardBranchState[] } | undefined;
  /** Each entered room's vow ranks, which every phase's encounter composition reads. */
  readonly encounterEntryVowRanks: ReadonlyMap<string, EncounterEntryVowRanks>;
}

export function createChronologyWalkState(
  branches: readonly RewardBranchState[],
): ChronologyWalkState {
  return Object.freeze({
    branches,
    halted: false,
    stygianWellAssessments: new Map(),
    wellRefillRealizations: new Map(),
    purgingPoolAssessments: new Map(),
    hermesShrineTravelDealRefills: new Map(),
    eligibleGorgonPhases: new Set<string>(),
    blockedGorgonPhases: new Set<string>(),
    gorgonEvaluationBlocked: false,
    peers: Object.freeze([]),
    pendingHubBoard: undefined,
    batchTargetGeneration: undefined,
    expectedStores: new Map(),
    hermesShrineAssessments: new Map(),
    shipLifecycleContexts: new Map(),
    overviewCohort: undefined,
    encounterEntryVowRanks: new Map(),
  });
}

/** Copies a keyed scratch map only when the key's value changes; undefined removes it. */
export function withKeyed<V>(
  map: ReadonlyMap<string, V>,
  key: string,
  value: V | undefined,
): ReadonlyMap<string, V> {
  if (value === undefined) {
    if (!map.has(key)) return map;
    const next = new Map(map);
    next.delete(key);
    return next;
  }
  if (map.has(key) && map.get(key) === value) return map;
  return new Map(map).set(key, value);
}

export function withMember(
  set: ReadonlySet<string>,
  key: string,
  member: boolean,
): ReadonlySet<string> {
  if (set.has(key) === member) return set;
  const next = new Set(set);
  if (member) next.add(key);
  else next.delete(key);
  return next;
}

export function withBranches(
  state: ChronologyWalkState,
  branches: readonly RewardBranchState[],
): ChronologyWalkState {
  return Object.freeze({ ...state, branches });
}

export interface RunStateCheckpointRequest {
  readonly owner: RunStateSnapshot['owner'];
  readonly room: CanonicalAuthoredRoom | CanonicalHubRoom;
  readonly view: HistoryStateView;
  /** Defaults to the branches of the state the capture runs against. */
  readonly branches?: readonly RewardBranchState[];
}

/**
 * One seam's result, applied in order: leading emissions, a Run State capture
 * against the state the seam received, the target-slot history, the next
 * state, a capture against that next state, then the remaining emissions.
 */
export interface ChronologySeamStep {
  readonly leadingEmissions?: readonly ChronologyEmission[];
  readonly runStateCheckpoint?: RunStateCheckpointRequest & {
    readonly against: 'received' | 'next';
  };
  readonly targetHistoryCheckpoint?: {
    readonly origin: TargetAddress;
    readonly historySequence: number;
    readonly branches: readonly RewardBranchState[];
  };
  readonly state: ChronologyWalkState;
  readonly emissions: readonly ChronologyEmission[];
}

export type SeamEvent<K extends HistoryEvent['kind']> = Extract<HistoryEvent, { readonly kind: K }>;

export type ChronologySeamHandler<K extends HistoryEvent['kind']> = (
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: SeamEvent<K>,
) => ChronologySeamStep;
