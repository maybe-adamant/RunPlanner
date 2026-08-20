import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type BiomeAddress,
  type AcquisitionSiteAddress,
  type EncounterPhaseAddress,
  type KeepsakeEquipResultAddress,
  type LevelResolutionAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import type { CountedRewardBinding } from '../reward-kernel';
import type {
  AuthoredBiomePlan,
  AuthoredRoutePlan,
  ProjectDocument,
} from '../authored-project/model';
import { evaluateBiomeCompleteness } from './completeness';
import { evaluateBiomeRoomGenerationAssemblyInternal } from './generation/biome';
import { evaluateHubDecisionGenerationInternal } from './generation/hub';
import {
  createBiomeCandidateArtifacts,
  createEmptyBiomeCandidateArtifacts,
  createProjectCandidateArtifacts,
  type BiomeCandidateArtifacts,
  type ProjectCandidateArtifacts,
  type KeepsakeSelectionCandidateCapability,
} from './candidate-artifacts';
import {
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  createKeepsakeState,
  attestFigLeafBranchState,
  attestGorgonBranchState,
} from './keepsakes';
import { createArcanaFearState } from './arcana-fear';
import { createTraitHistoryState } from './traits';
import {
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
} from '../authored-project/addresses';
import {
  composeBiomeHistoryWithEncounterValidation,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
  type HistoryStateView,
  type FigLeafLifecycleState,
} from './history';
import {
  materializeBiome,
  type CanonicalAuthoredRoom,
  type CanonicalBiome,
  type MaterializedBiomePrefix,
} from './materialization';
import { evaluateEncounterCandidatesInternal } from './encounters/candidates';
import { structurallyActiveEncounterRooms } from './encounters/structural';
import type { EncounterCandidateBoundary } from './encounters/candidates';
import type {
  EncounterPhaseCandidateSupport,
  EncounterPhaseSequenceStatus,
} from './encounters/preparation';
import { isAcquisitionAuthorshipMissingFinding, type SemanticFinding } from './model';
import type { FindingRegionEntry } from './finding-regions';
import {
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyFromSelectedProducts,
  occurrenceOwnerAddress,
  type BiomeGenerationValidation,
  type ProgressiveBiomeContext,
} from './progressive/biome';
import { prefixAuthoredRooms } from './candidates/evaluated-biome';
import { evaluateBiomeRewardsAssemblyInternal } from './rewards/biome';
import type {
  BiomeRewardSimulation,
  FigLeafPhaseCandidateSupport,
  GorgonPhaseCandidateSupport,
} from './rewards/model';
import {
  publishRunStateThroughCoverage,
  type RunStateOwner,
  type RunStateSnapshot,
} from './rewards/run-state';
import {
  resolveCountedRewardTypeDomain,
  type CountedRewardOwnerAddress,
} from './rewards/authoring-domain';
import type { RewardProducerCandidateArtifacts } from './rewards/producer-frontiers';
import type { RoomLifecycleCandidateArtifacts } from './rewards/lifecycle-artifacts';
import type { TraitOfferCandidateArtifacts } from './candidate-artifacts';
import type { LevelResolutionCandidateArtifacts } from './candidate-artifacts';

export interface BiomeEvaluationBase {
  readonly biomeKey: string;
  readonly origin: BiomeAddress;
  readonly authoring: 'incomplete' | 'complete';
  readonly coverage: BiomeEvaluationCoverage;
  readonly findings: readonly SemanticFinding[];
}

interface IncompleteBiomeProjectEvaluationBase extends BiomeEvaluationBase {
  readonly authoring: 'incomplete';
  /** A reached contextual block is invalid even when authored completion is pending. */
  readonly validity?: 'invalid';
  readonly frontier: SemanticAddress;
  readonly coverage: IncompleteBiomeEvaluationCoverage;
}

export interface UnevaluatedIncompleteBiomeProjectEvaluation extends IncompleteBiomeProjectEvaluationBase {
  readonly coverage: NoBiomeEvaluationCoverage;
}

export interface PrefixIncompleteBiomeProjectEvaluation extends IncompleteBiomeProjectEvaluationBase {
  readonly coverage: PrefixBiomeEvaluationCoverage;
  readonly materializedPrefix: MaterializedBiomePrefix;
  readonly assessmentPrefix?: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
}

export type IncompleteBiomeProjectEvaluation =
  UnevaluatedIncompleteBiomeProjectEvaluation | PrefixIncompleteBiomeProjectEvaluation;

export type { BiomeGenerationValidation } from './progressive/biome';

interface CompleteBiomeProjectEvaluationBase extends BiomeEvaluationBase {
  readonly authoring: 'complete';
  readonly validity: 'invalid' | 'valid';
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
}

export interface CompleteValidBiomeProjectEvaluation extends CompleteBiomeProjectEvaluationBase {
  readonly validity: 'valid';
  readonly coverage: CompleteBiomeEvaluationCoverage;
  readonly snapshot: CanonicalBiome;
  readonly history: CanonicalBiomeHistory;
}

/**
 * Any complete authored biome that cannot be assessed to a valid checkpoint
 * publishes one bounded invalid result. The authored materialized prefix is
 * retained for editing, while assessment products stop at the first blocking
 * atomic region. No canonical snapshot/history is published for this branch.
 */
export interface CompleteBlockedBiomeProjectEvaluation extends CompleteBiomeProjectEvaluationBase {
  readonly validity: 'invalid';
  readonly coverage: PrefixBiomeEvaluationCoverage;
  readonly materializedPrefix: MaterializedBiomePrefix;
  readonly assessmentPrefix?: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
}

export type CompleteBiomeProjectEvaluation =
  CompleteValidBiomeProjectEvaluation | CompleteBlockedBiomeProjectEvaluation;

export type ProjectBiomeEvaluation =
  IncompleteBiomeProjectEvaluation | CompleteBiomeProjectEvaluation;

export type BiomeAuthoring = ProjectBiomeEvaluation['authoring'];

export type BiomeEvaluationCheckpoint =
  'beforeTargetGeneration' | 'afterTargetGeneration' | 'afterRoomLifecycle';

export interface BiomeEvaluationPoint {
  readonly owner: SemanticAddress;
  readonly checkpoint: BiomeEvaluationCheckpoint;
}

export interface NoBiomeEvaluationCoverage {
  readonly kind: 'none';
  readonly reason: 'notEvaluated';
}

export interface PrefixBiomeEvaluationCoverage {
  readonly kind: 'prefix';
  readonly through: BiomeEvaluationPoint;
  readonly blockedAt?: SemanticAddress;
}

export interface CompleteBiomeEvaluationCoverage {
  readonly kind: 'complete';
}

export type IncompleteBiomeEvaluationCoverage =
  NoBiomeEvaluationCoverage | PrefixBiomeEvaluationCoverage;
export type BiomeEvaluationCoverage =
  IncompleteBiomeEvaluationCoverage | CompleteBiomeEvaluationCoverage;

export interface ActiveRouteBiome {
  readonly kind: 'incomplete' | 'invalid';
  readonly biomeKey: string;
}

export interface RouteProcessingRegions {
  readonly completeValidPrefix: readonly string[];
  readonly active: ActiveRouteBiome | null;
  readonly blockedSuffix: readonly string[];
}

export interface RouteEvaluationSummary {
  readonly configuredBiomeCount: number;
  readonly evaluatedBiomeCount: number;
  readonly validatedBiomeCount: number;
  readonly incompleteBiomeCount: number;
  readonly invalidBiomeCount: number;
  readonly blockedBiomeCount: number;
  readonly eligibleForExecutionPlan: boolean;
}

export interface ProjectRouteEvaluation {
  readonly routeKey: string;
  readonly status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly configuredBiomeKeys: readonly string[];
  readonly biomes: readonly ProjectBiomeEvaluation[];
  readonly processing: RouteProcessingRegions;
  readonly findings: readonly SemanticFinding[];
  readonly summary: RouteEvaluationSummary;
}

export interface ProjectEvaluationSummary {
  readonly configuredBiomeCount: number;
  readonly evaluatedBiomeCount: number;
  readonly validatedBiomeCount: number;
  readonly incompleteBiomeCount: number;
  readonly invalidBiomeCount: number;
  readonly blockedBiomeCount: number;
  readonly eligibleForExecutionPlan: boolean;
}

export interface ProjectEvaluation {
  readonly status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  readonly projectId: string;
  readonly catalogVersion: string;
  readonly routes: readonly ProjectRouteEvaluation[];
  readonly findings: readonly SemanticFinding[];
  readonly summary: ProjectEvaluationSummary;
}

export interface ProjectEvaluationAssembly {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
}

const evaluationSourceProjects = new WeakMap<ProjectEvaluation, ProjectDocument>();
const exactProjectEvaluationAssemblyConstructionToken = Symbol(
  'exactProjectEvaluationAssemblyConstructionToken',
);
let exactProjectEvaluationAssemblyArtifacts:
  ((assembly: ProjectEvaluationAssembly) => ProjectCandidateArtifacts) | undefined;
let isExactProjectEvaluationAssembly:
  ((assembly: ProjectEvaluationAssembly) => boolean) | undefined;

class ExactProjectEvaluationAssembly implements ProjectEvaluationAssembly {
  readonly #candidateArtifacts: ProjectCandidateArtifacts;
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;

  constructor(
    project: ProjectDocument,
    evaluation: ProjectEvaluation,
    candidateArtifacts: ProjectCandidateArtifacts,
    constructionToken: typeof exactProjectEvaluationAssemblyConstructionToken,
  ) {
    if (constructionToken !== exactProjectEvaluationAssemblyConstructionToken) {
      throw new ProjectSimulationContractError(
        'exact project evaluation assemblies may only be constructed by project simulation',
      );
    }
    this.project = project;
    this.evaluation = evaluation;
    this.#candidateArtifacts = candidateArtifacts;
    Object.freeze(this);
  }

  static {
    exactProjectEvaluationAssemblyArtifacts = (
      assembly: ProjectEvaluationAssembly,
    ): ProjectCandidateArtifacts => {
      if (!(assembly instanceof ExactProjectEvaluationAssembly)) {
        throw new ProjectSimulationContractError(
          'prepared project evaluation assembly was not produced by this simulator execution',
        );
      }
      return assembly.#candidateArtifacts;
    };
    isExactProjectEvaluationAssembly = (assembly: ProjectEvaluationAssembly): boolean => {
      const candidateArtifacts = exactProjectEvaluationAssemblyArtifacts;
      if (candidateArtifacts === undefined) return false;
      try {
        candidateArtifacts(assembly);
        return true;
      } catch {
        return false;
      }
    };
  }
}

export class ProjectSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'ProjectSimulationContractError';
  }
}

export function assertProjectEvaluationSource(
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): void {
  if (evaluationSourceProjects.get(evaluation) !== project) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation does not belong to the authored project identity',
    );
  }
}

function requireExactProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
): ProjectEvaluationAssembly {
  if (isExactProjectEvaluationAssembly?.(assembly) !== true) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation assembly was not produced by this simulator execution',
    );
  }
  if (assembly.project === undefined || assembly.evaluation === undefined) {
    throw new ProjectSimulationContractError(
      'prepared project evaluation assembly was not produced by this simulator execution',
    );
  }
  assertProjectEvaluationSource(assembly.project, assembly.evaluation);
  return assembly;
}

export function assertProjectEvaluationAssembly(assembly: ProjectEvaluationAssembly): void {
  if (isExactProjectEvaluationAssembly?.(assembly) === true) return;
  // Application overlays intentionally preserve the authored/evaluation
  // identity while replacing only the public evaluation for contract tests.
  // Candidate artifacts remain exact-only; callers that need them still use
  // candidateArtifactsForProjectEvaluationAssembly.
  assertProjectEvaluationSource(assembly.project, assembly.evaluation);
}

/** Engine-internal capability access; the public assembly surface stays data-only. */
export function candidateArtifactsForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
): ProjectCandidateArtifacts {
  const candidateArtifacts = exactProjectEvaluationAssemblyArtifacts;
  if (candidateArtifacts === undefined) {
    throw new ProjectSimulationContractError('candidate artifact access is not initialized');
  }
  return candidateArtifacts(requireExactProjectEvaluationAssembly(assembly));
}

/** Narrow reachability query for one exact immediate-keepsake child. */
export function keepsakeEquipResultCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  address: KeepsakeEquipResultAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly).keepsakeEquipResults.at(address);
}

/** Narrow supported candidate capability for one reached Pom owner. */
export function levelResolutionCandidateForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  address: LevelResolutionAddress,
) {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(address.routeKey, address.biomeKey))
    ?.levelResolutions.at(address);
}

/**
 * Supported exact-assembly query for one encounter phase. Application
 * composition may ask whether a particular declared phase has an evaluated
 * candidate capability, but cannot traverse the artifact graph itself.
 */
export function encounterPhaseCandidateSupportForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): EncounterPhaseCandidateSupport | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.at(phase);
}

/** Narrow Fig Leaf capability for one exact phase owner. */
export function encounterPhaseFigLeafSupportForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): FigLeafPhaseCandidateSupport | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.figLeafAt(phase);
}

/** Narrow engine-published Gorgon reached/pending capability for one exact phase. */
export function encounterPhaseGorgonSupportForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): GorgonPhaseCandidateSupport | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.gorgonAt(phase);
}

/**
 * Supported exact-assembly query for one structurally declared encounter
 * phase. Unlike candidate support, this preserves the distinction between an
 * evaluated dormant suffix and an owner with no preparation coverage.
 */
export function encounterPhaseSequenceStatusForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  phase: EncounterPhaseAddress,
): EncounterPhaseSequenceStatus | undefined {
  return candidateArtifactsForProjectEvaluationAssembly(assembly)
    .biomeAt(createBiomeAddress(phase.routeKey, phase.biomeKey))
    ?.encounters.statusAt(phase);
}

/** Narrow exact-assembly query for derived entries at one reached acquisition site. */
export function derivedAcquisitionEntriesForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  site: AcquisitionSiteAddress,
) {
  return (
    candidateArtifactsForProjectEvaluationAssembly(assembly)
      .biomeAt(createBiomeAddress(site.routeKey, site.biomeKey))
      ?.derivedAcquisitionEntries.entriesAt(site) ?? Object.freeze([])
  ).map(({ address, capability }) => Object.freeze({ address, ...capability }));
}

/**
 * The exact blocked occurrence remains an authored repair surface even when
 * execution assessment stops inside one of its actions. Later occurrences in
 * the materialized plan remain hidden until their own execution frontier is
 * reached.
 */
export function blockedOccurrenceRoomForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  occurrence: import('../authored-project/addresses').OccurrenceAddress,
): CanonicalAuthoredRoom | undefined {
  const exact = requireExactProjectEvaluationAssembly(assembly);
  const biome = exact.evaluation.routes
    .find((route) => route.routeKey === occurrence.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === occurrence.biomeKey);
  if (
    biome?.coverage.kind !== 'prefix' ||
    biome.coverage.blockedAt === undefined ||
    !('materializedPrefix' in biome)
  ) {
    return undefined;
  }
  const blockedOccurrence = occurrenceOwnerAddress(biome.coverage.blockedAt);
  if (
    blockedOccurrence === undefined ||
    semanticAddressKey(blockedOccurrence) !== semanticAddressKey(occurrence)
  ) {
    return undefined;
  }
  return prefixAuthoredRooms(biome.materializedPrefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(occurrence),
  );
}

/** Exact-assembly entry point for one synchronous counted-reward authoring domain. */
export function countedRewardTypeDomain(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  owner: CountedRewardOwnerAddress,
  binding: CountedRewardBinding,
): readonly string[] {
  const candidateArtifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  const evaluatedProducer = candidateArtifacts
    .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
    ?.rewardProducers.at(owner);
  return resolveCountedRewardTypeDomain(
    catalog,
    assembly.project,
    owner,
    binding,
    evaluatedProducer,
  );
}

interface BiomeProjectEvaluationAssembly {
  readonly evaluation: ProjectBiomeEvaluation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

interface BiomeGenerationAssembly {
  readonly validation: BiomeGenerationValidation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
}

/**
 * Materialized prefixes can expose structural Run State owners before the
 * assessment walk reaches them. Keep those owners explicit so consumers never
 * infer unavailable from a missing snapshot.
 */
function structurallyEligibleRunStateOwners(
  prefix: MaterializedBiomePrefix,
): readonly RunStateOwner[] {
  // Canonical decisions are the outer biome chronology. A Hub remains one
  // decision regardless of how many visits and local rooms it contains.
  const owners: RunStateOwner[] = prefix.decisions.map((decision) => decision.origin);
  if (prefix.frontier?.kind === 'hubBoard' || prefix.frontier?.kind === 'exitDecision') {
    owners.push(prefix.frontier.origin);
  }
  const enteredRooms: CanonicalAuthoredRoom[] = [];
  const appendRoom = (room: CanonicalAuthoredRoom): void => {
    if (!room.entered) return;
    if (
      enteredRooms.some(
        (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
      )
    )
      return;
    enteredRooms.push(room);
  };
  if (prefix.entryRoom !== undefined) appendRoom(prefix.entryRoom);
  for (const decision of prefix.decisions) {
    if (decision.kind === 'batch') {
      for (const target of decision.targets) appendRoom(target.room);
      for (const additional of decision.additional) appendRoom(additional.room);
      continue;
    }
    for (const visit of decision.visits) {
      appendRoom(visit.target.room);
      for (const local of visit.enteredLocalRooms) appendRoom(local);
    }
  }
  const activeHubVisit =
    prefix.frontier?.kind === 'hubVisit' && 'phase' in prefix.frontier
      ? prefix.frontier
      : undefined;
  if (activeHubVisit !== undefined) {
    appendRoom(activeHubVisit.target.room);
    for (const local of activeHubVisit.enteredLocalRooms) appendRoom(local);
  }
  for (const room of enteredRooms) {
    if (room.lifecycleProfileKey === 'ShipCombatRoom') {
      for (const phase of room.encounterPhases) {
        owners.push(
          createRoomRunStateCheckpointAddress(room.origin, {
            kind: 'beforeEncounterStart',
            phaseKey: phase.slotKey,
          }),
        );
      }
    } else {
      owners.push(createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' }));
    }
    owners.push(createRoomRunStateCheckpointAddress(room.origin, { kind: 'beforeRoomExit' }));
  }
  return Object.freeze(owners);
}

function reconcileRunStateAvailability(
  rewards: BiomeRewardSimulation,
  covered: readonly RunStateSnapshot[],
  owners: readonly RunStateOwner[],
): BiomeRewardSimulation {
  const publication = publishRunStateThroughCoverage(rewards.runStateSnapshots, covered, owners);
  return Object.freeze({
    ...rewards,
    runStateSnapshots: publication.snapshots,
    runStateAvailability: publication.availability,
  });
}

function encounterPreparationViews(
  history: CanonicalBiomeHistory | BiomeHistoryPrefix,
): ReadonlyMap<string, HistoryStateView> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room.preparation]));
}

function generation(
  catalog: Catalog,
  snapshot:
    CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom }),
  history: CanonicalBiomeHistory | BiomeHistoryPrefix,
  enteredBiomeCount: number,
  rewards: BiomeRewardSimulation,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  traitOffers: TraitOfferCandidateArtifacts,
  levelResolutions: LevelResolutionCandidateArtifacts,
  encounterBoundary?: EncounterCandidateBoundary,
): BiomeGenerationAssembly {
  const ordinary = evaluateBiomeRoomGenerationAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    rewards.targetHistory,
  );
  const hub = evaluateHubDecisionGenerationInternal(catalog, snapshot, history);
  const gorgonStatus = (() => {
    try {
      return attestGorgonBranchState(rewards.branches);
    } catch (error) {
      throw new ProjectSimulationContractError(
        error instanceof Error ? error.message : 'Gorgon branch frontier is divergent',
      );
    }
  })();
  const encounters = evaluateEncounterCandidatesInternal(
    catalog,
    structurallyActiveEncounterRooms(snapshot),
    encounterPreparationViews(history),
    encounterBoundary,
    rewards.figLeafPhaseCandidates,
    gorgonStatus,
    rewards.gorgonPhaseCandidates,
  );
  const encounterArtifacts = encounters.artifacts;
  const validation: BiomeGenerationValidation = Object.freeze({
    validity:
      ordinary.validation.validity === 'valid' &&
      hub.validity === 'valid' &&
      encounters.findings.length === 0
        ? 'valid'
        : 'invalid',
    ordinary: ordinary.validation,
    hub,
    findings: Object.freeze([
      ...ordinary.validation.findings,
      ...hub.findings,
      ...encounters.findings,
    ]),
  });
  return Object.freeze({
    validation,
    candidateArtifacts: createBiomeCandidateArtifacts(
      createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
      ordinary.candidateArtifacts,
      rewardProducers,
      roomLifecycles,
      encounterArtifacts,
      traitOffers,
      levelResolutions,
    ),
    findingRegions: Object.freeze([
      ...ordinary.findingRegions,
      ...hub.findingRegions,
      ...encounters.findingRegions,
    ]),
  });
}

export function materializedBiomePrefixCoveragePoint(
  prefix: MaterializedBiomePrefix,
): BiomeEvaluationPoint {
  if (prefix.frontier?.kind === 'exitDecision') {
    const lastTarget = prefix.frontier.targets.at(-1);
    return lastTarget === undefined
      ? Object.freeze({ owner: prefix.frontier.origin, checkpoint: 'beforeTargetGeneration' })
      : Object.freeze({ owner: lastTarget.origin, checkpoint: 'afterTargetGeneration' });
  }
  if (prefix.frontier?.kind === 'hubBoard' || prefix.frontier?.kind === 'hubVisit') {
    if (prefix.frontier.kind === 'hubVisit' && 'phase' in prefix.frontier) {
      if (prefix.frontier.phase === 'targetLifecycle') {
        return Object.freeze({
          owner: prefix.frontier.origin,
          checkpoint: 'beforeTargetGeneration',
        });
      }
      if (prefix.frontier.phase === 'sideGeneration') {
        return Object.freeze({
          owner: prefix.frontier.origin,
          checkpoint: 'afterTargetGeneration',
        });
      }
      const lastLocal = prefix.frontier.enteredLocalRooms.at(-1);
      return Object.freeze({
        owner: lastLocal?.origin ?? prefix.frontier.origin,
        checkpoint: 'afterRoomLifecycle',
      });
    }
    const hub = [...prefix.decisions].reverse().find((decision) => decision.kind === 'hub');
    if (hub?.kind === 'hub') {
      const lastVisit = hub.visits.at(-1);
      if (lastVisit !== undefined) {
        const lastLocal = lastVisit.enteredLocalRooms.at(-1);
        return Object.freeze({
          owner: lastLocal?.origin ?? lastVisit.origin,
          checkpoint: 'afterRoomLifecycle',
        });
      }
      const lastTarget = hub.board.targets.at(-1);
      if (lastTarget !== undefined) {
        return Object.freeze({ owner: lastTarget.origin, checkpoint: 'afterTargetGeneration' });
      }
    }
    return Object.freeze({ owner: prefix.frontier.origin, checkpoint: 'beforeTargetGeneration' });
  }
  const last = prefix.decisions.at(-1);
  if (last === undefined) {
    if (prefix.entryRoom === undefined) {
      throw new ProjectSimulationContractError(`${prefix.biomeKey} has no prefix coverage owner`);
    }
    return Object.freeze({ owner: prefix.entryRoom.origin, checkpoint: 'beforeTargetGeneration' });
  }
  if (last.kind === 'batch') {
    return Object.freeze({ owner: last.selectedOrigin, checkpoint: 'afterTargetGeneration' });
  }
  return Object.freeze({ owner: last.origin, checkpoint: 'afterTargetGeneration' });
}

export function evaluateBiome(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): ProjectBiomeEvaluation {
  return evaluateBiomeAssembly(catalog, routeKey, plan, context).evaluation;
}

/**
 * Replay one configured biome from the exact predecessor frontier already
 * attested by the selected project evaluation. Candidate families can change
 * the biome's authored plan without replaying unrelated routes or biomes.
 */
export function replayProjectBiomeFromEvaluatedPredecessor(
  catalog: Catalog,
  project: ProjectDocument,
  selected: ProjectEvaluation,
  biome: BiomeAddress,
): ProjectBiomeEvaluation {
  const route = project.routes.find((candidate) => candidate.routeKey === biome.routeKey);
  const selectedRoute = selected.routes.find((candidate) => candidate.routeKey === biome.routeKey);
  const biomeIndex = route?.biomes.findIndex((candidate) => candidate.biomeKey === biome.biomeKey);
  if (
    route === undefined ||
    selectedRoute === undefined ||
    biomeIndex === undefined ||
    biomeIndex < 0
  ) {
    throw new ProjectSimulationContractError(
      `${biome.routeKey}/${biome.biomeKey} has no configured candidate replay context`,
    );
  }
  const plan = route.biomes[biomeIndex];
  if (plan === undefined) {
    throw new ProjectSimulationContractError(`${biome.biomeKey} candidate replay lost its plan`);
  }
  const previous = selectedRoute.biomes[biomeIndex - 1];
  if (
    previous !== undefined &&
    (previous.authoring !== 'complete' || previous.validity !== 'valid')
  ) {
    throw new ProjectSimulationContractError(
      `${biome.biomeKey} candidate replay predecessor is not complete and valid`,
    );
  }
  return evaluateBiome(catalog, route.routeKey, plan, {
    enteredBiomeCount: biomeIndex + 1,
    hasConfiguredSuccessor: biomeIndex + 1 < route.biomes.length,
    loadout: route.loadout,
    ...(previous === undefined
      ? {}
      : {
          seed: Object.freeze({
            history: previous.history,
            rewardBranches: previous.rewards.branches,
          }),
        }),
  });
}

function evaluateBiomeAssembly(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  context: ProgressiveBiomeContext,
): BiomeProjectEvaluationAssembly {
  const origin = createBiomeAddress(routeKey, plan.biomeKey);
  const completeness = evaluateBiomeCompleteness(catalog, origin, plan);
  if (completeness.completion === 'incomplete') {
    const progressive = evaluateProgressiveBiomeAssembly(catalog, origin, plan, context);
    if (progressive === null) {
      return Object.freeze({
        evaluation: Object.freeze({
          biomeKey: plan.biomeKey,
          origin,
          authoring: 'incomplete',
          frontier: completeness.frontier,
          coverage: Object.freeze({ kind: 'none', reason: 'notEvaluated' }),
          findings: completeness.findings,
        }),
        candidateArtifacts: createEmptyBiomeCandidateArtifacts(origin),
      });
    }
    const blockedAt = progressive.evaluation.blockedAt;
    const unresolvedEntryReward =
      progressive.evaluation.materializedPrefix.entryRoom?.unresolvedIncomingReward;
    const entryAuthorshipBlocked =
      blockedAt !== undefined &&
      unresolvedEntryReward !== undefined &&
      semanticAddressKey(blockedAt) === semanticAddressKey(unresolvedEntryReward.origin) &&
      progressive.evaluation.findings.some(
        (finding) =>
          semanticAddressKey(finding.origin) === semanticAddressKey(blockedAt) &&
          isAcquisitionAuthorshipMissingFinding(finding),
      );
    return Object.freeze({
      evaluation: Object.freeze({
        biomeKey: plan.biomeKey,
        origin,
        authoring: 'incomplete',
        frontier: completeness.frontier,
        ...(blockedAt === undefined || entryAuthorshipBlocked
          ? {}
          : { validity: 'invalid' as const }),
        coverage: Object.freeze({
          kind: 'prefix',
          through: materializedBiomePrefixCoveragePoint(
            progressive.evaluation.assessmentPrefix ?? progressive.evaluation.materializedPrefix,
          ),
          ...(blockedAt === undefined ? {} : { blockedAt }),
        }),
        materializedPrefix: progressive.evaluation.materializedPrefix,
        ...(progressive.evaluation.assessmentPrefix === undefined
          ? {}
          : { assessmentPrefix: progressive.evaluation.assessmentPrefix }),
        history: progressive.evaluation.history,
        roomGeneration: progressive.evaluation.roomGeneration,
        rewards: reconcileRunStateAvailability(
          progressive.evaluation.rewards,
          progressive.evaluation.rewards.runStateSnapshots,
          structurallyEligibleRunStateOwners(progressive.evaluation.materializedPrefix),
        ),
        findings:
          blockedAt === undefined || entryAuthorshipBlocked
            ? Object.freeze([...completeness.findings, ...progressive.evaluation.findings])
            : progressive.evaluation.findings,
      }),
      candidateArtifacts: progressive.candidateArtifacts,
    });
  }
  const snapshot = materializeBiome(
    catalog,
    origin,
    completeness,
    context.loadout,
    plan.bossCompletionArcanaKeys,
    context.hasConfiguredSuccessor === true ? plan.postbossKeepsakeDisposition : undefined,
    plan.keepsakeEquipResults,
    plan.echoKeepsakeReplayResults,
  );
  const seed: HistoryStateView | undefined = context.seed?.history.afterTransition;
  const startingKeepsake = catalog.keepsakes.byKey[context.loadout.startingKeepsakeKey];
  const startingFigLeaf = startingKeepsake?.effect;
  let figLeafState: FigLeafLifecycleState | undefined;
  try {
    figLeafState =
      context.seed === undefined
        ? startingFigLeaf?.kind === 'figLeaf' && startingKeepsake !== undefined
          ? {
              remainingUses: startingFigLeaf.biomeUsesByRank[startingKeepsake.rank],
              activatedThisBiome: false,
            }
          : undefined
        : (() => {
            const state = attestFigLeafBranchState(context.seed.rewardBranches);
            return state === undefined
              ? undefined
              : { remainingUses: state.remainingUses, activatedThisBiome: false };
          })();
  } catch (error) {
    throw new ProjectSimulationContractError(
      error instanceof Error ? error.message : 'Fig Leaf branch frontier is divergent',
    );
  }
  const composed = composeBiomeHistoryWithEncounterValidation(
    catalog,
    snapshot,
    seed,
    figLeafState,
  );
  if (composed.kind !== 'complete') {
    const progressive = evaluateProgressiveBiomeAssembly(catalog, origin, plan, context);
    if (progressive === null) {
      throw new ProjectSimulationContractError(
        `${plan.biomeKey} lifecycle block has no materialized progressive prefix`,
      );
    }
    const blockedAt =
      progressive.evaluation.blockedAt ??
      (composed.kind === 'blocked' ? composed.block.blockedAt : composed.blockedAt);
    if (blockedAt === undefined) {
      throw new ProjectSimulationContractError(
        `${plan.biomeKey} lifecycle block has no semantic repair owner`,
      );
    }
    const assessmentPrefix =
      progressive.evaluation.assessmentPrefix ?? progressive.evaluation.materializedPrefix;
    const reconciledRewards = reconcileRunStateAvailability(
      progressive.evaluation.rewards,
      progressive.evaluation.rewards.runStateSnapshots,
      structurallyEligibleRunStateOwners(progressive.evaluation.materializedPrefix),
    );
    return Object.freeze({
      evaluation: Object.freeze({
        biomeKey: plan.biomeKey,
        origin,
        authoring: 'complete',
        coverage: Object.freeze({
          kind: 'prefix',
          through: materializedBiomePrefixCoveragePoint(assessmentPrefix),
          blockedAt,
        }),
        validity: 'invalid',
        materializedPrefix: progressive.evaluation.materializedPrefix,
        ...(progressive.evaluation.assessmentPrefix === undefined
          ? {}
          : { assessmentPrefix: progressive.evaluation.assessmentPrefix }),
        history: progressive.evaluation.history,
        roomGeneration: progressive.evaluation.roomGeneration,
        rewards: reconciledRewards,
        findings: progressive.evaluation.findings,
      }),
      candidateArtifacts: progressive.candidateArtifacts,
    });
  }
  const history = composed.history;
  const rewards = evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    context.enteredBiomeCount,
    context.loadout,
    context.seed?.rewardBranches,
  );
  const roomGeneration = generation(
    catalog,
    snapshot,
    history,
    context.enteredBiomeCount,
    rewards.simulation,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
    rewards.traitOfferArtifacts,
    rewards.levelResolutionArtifacts,
  );
  const findings = Object.freeze([
    ...roomGeneration.validation.findings,
    ...rewards.simulation.findings,
  ]);
  if (roomGeneration.validation.validity === 'valid' && rewards.simulation.validity === 'valid') {
    return Object.freeze({
      evaluation: Object.freeze({
        biomeKey: plan.biomeKey,
        origin,
        authoring: 'complete',
        coverage: Object.freeze({ kind: 'complete' }),
        validity: 'valid',
        snapshot,
        history,
        roomGeneration: roomGeneration.validation,
        rewards: rewards.simulation,
        findings,
      }),
      candidateArtifacts: createBiomeCandidateArtifacts(
        roomGeneration.candidateArtifacts.origin,
        roomGeneration.candidateArtifacts.roomTargets,
        roomGeneration.candidateArtifacts.rewardProducers,
        roomGeneration.candidateArtifacts.roomLifecycles,
        roomGeneration.candidateArtifacts.encounters,
        roomGeneration.candidateArtifacts.traitOffers,
        roomGeneration.candidateArtifacts.levelResolutions,
        rewards.bossCompletionArcanaArtifacts,
        rewards.keepsakeSelectionArtifacts,
        rewards.keepsakeEquipResultArtifacts,
        rewards.acquisitionConversionArtifacts,
        rewards.derivedAcquisitionEntryArtifacts,
      ),
    });
  }
  const selectedFindingRegions = Object.freeze([
    ...roomGeneration.findingRegions,
    ...rewards.findingRegions,
  ]);
  const progressive = evaluateProgressiveBiomeAssemblyFromSelectedProducts(
    catalog,
    origin,
    plan,
    context,
    Object.freeze({
      rewards: rewards.simulation,
      candidateArtifacts: createBiomeCandidateArtifacts(
        roomGeneration.candidateArtifacts.origin,
        roomGeneration.candidateArtifacts.roomTargets,
        roomGeneration.candidateArtifacts.rewardProducers,
        roomGeneration.candidateArtifacts.roomLifecycles,
        roomGeneration.candidateArtifacts.encounters,
        roomGeneration.candidateArtifacts.traitOffers,
        roomGeneration.candidateArtifacts.levelResolutions,
        rewards.bossCompletionArcanaArtifacts,
        rewards.keepsakeSelectionArtifacts,
        rewards.keepsakeEquipResultArtifacts,
        rewards.acquisitionConversionArtifacts,
        rewards.derivedAcquisitionEntryArtifacts,
      ),
      history: Object.freeze({
        routeKey: history.routeKey,
        biomeKey: history.biomeKey,
        events: history.events,
        ledgers: history.ledgers,
        rooms: history.rooms,
        current: history.afterTransition,
      }),
      roomGeneration: roomGeneration.validation,
      findingRegions: selectedFindingRegions,
      traitChildSettlementCheckpoints: rewards.traitChildSettlementCheckpoints,
    }),
  );
  if (progressive === null) {
    throw new ProjectSimulationContractError(
      `${plan.biomeKey} invalid complete biome has no materialized progressive prefix`,
    );
  }
  const assessmentPrefix =
    progressive.evaluation.assessmentPrefix ?? progressive.evaluation.materializedPrefix;
  const reconciledRewards = reconcileRunStateAvailability(
    progressive.evaluation.rewards,
    progressive.evaluation.rewards.runStateSnapshots,
    structurallyEligibleRunStateOwners(progressive.evaluation.materializedPrefix),
  );
  return Object.freeze({
    evaluation: Object.freeze({
      biomeKey: plan.biomeKey,
      origin,
      authoring: 'complete',
      coverage: Object.freeze({
        kind: 'prefix',
        through: materializedBiomePrefixCoveragePoint(assessmentPrefix),
        ...(progressive.evaluation.blockedAt === undefined
          ? {}
          : { blockedAt: progressive.evaluation.blockedAt }),
      }),
      validity: 'invalid',
      materializedPrefix: progressive.evaluation.materializedPrefix,
      ...(progressive.evaluation.assessmentPrefix === undefined
        ? {}
        : { assessmentPrefix: progressive.evaluation.assessmentPrefix }),
      history: progressive.evaluation.history,
      roomGeneration: progressive.evaluation.roomGeneration,
      rewards: reconciledRewards,
      findings: progressive.evaluation.findings,
    }),
    candidateArtifacts: progressive.candidateArtifacts,
  });
}

function assertProjectMatchesCatalog(catalog: Catalog, project: ProjectDocument): void {
  if (project.catalogVersion !== catalog.version) {
    throw new ProjectSimulationContractError(
      `project catalog ${project.catalogVersion} does not match ${catalog.version}`,
    );
  }
  if (project.routes.length !== catalog.routes.values.length) {
    throw new ProjectSimulationContractError('project routes do not match the catalog');
  }
  for (const [routeIndex, declaration] of catalog.routes.values.entries()) {
    const route = project.routes[routeIndex];
    if (route?.routeKey !== declaration.key) {
      throw new ProjectSimulationContractError(
        `project route ${routeIndex} does not match ${declaration.key}`,
      );
    }
    for (const [biomeIndex, plan] of route.biomes.entries()) {
      if (plan.biomeKey !== declaration.biomeKeys[biomeIndex]) {
        throw new ProjectSimulationContractError(
          `${route.routeKey} biome ${biomeIndex} is not the declared route prefix`,
        );
      }
    }
  }
}

function routeStatus(
  configuredBiomeCount: number,
  evaluations: readonly ProjectBiomeEvaluation[],
  routeStartBlock: 'incomplete' | 'invalid' | null,
): ProjectRouteEvaluation['status'] {
  if (configuredBiomeCount === 0) return 'empty';
  if (routeStartBlock !== null) return routeStartBlock;
  if (evaluations.some((evaluation) => evaluation.validity === 'invalid')) {
    return 'invalid';
  }
  return evaluations.some((evaluation) => evaluation.authoring === 'incomplete')
    ? 'incomplete'
    : 'valid';
}

function summarizeRoute(
  configuredBiomeCount: number,
  evaluations: readonly ProjectBiomeEvaluation[],
  processing: RouteProcessingRegions,
): RouteEvaluationSummary {
  const incompleteBiomeCount = evaluations.filter(
    (evaluation) => evaluation.authoring === 'incomplete',
  ).length;
  const invalidBiomeCount = evaluations.filter(
    (evaluation) => evaluation.validity === 'invalid',
  ).length;
  return Object.freeze({
    configuredBiomeCount,
    evaluatedBiomeCount: evaluations.length,
    validatedBiomeCount: processing.completeValidPrefix.length,
    incompleteBiomeCount,
    invalidBiomeCount,
    blockedBiomeCount: processing.blockedSuffix.length,
    eligibleForExecutionPlan:
      configuredBiomeCount > 0 && processing.completeValidPrefix.length === configuredBiomeCount,
  });
}

interface RouteProjectEvaluationAssembly {
  readonly evaluation: ProjectRouteEvaluation;
  readonly candidateArtifacts: readonly BiomeCandidateArtifacts[];
  readonly routeStartKeepsakes: ReadonlyMap<string, KeepsakeSelectionCandidateCapability>;
  readonly routeStartKeepsakeEquipResults: ReadonlyMap<
    string,
    import('./candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >;
}

function evaluateRouteAssembly(
  catalog: Catalog,
  route: AuthoredRoutePlan,
): RouteProjectEvaluationAssembly {
  const evaluations: ProjectBiomeEvaluation[] = [];
  const candidateArtifacts: BiomeCandidateArtifacts[] = [];
  const completeValidPrefix: string[] = [];
  const findings: SemanticFinding[] = [];
  let active: ActiveRouteBiome | null = null;
  let blockedSuffix: readonly string[] = Object.freeze([]);
  let routeStartBlock: 'incomplete' | 'invalid' | null = null;
  const routeStartKeepsakes = new Map<string, KeepsakeSelectionCandidateCapability>();
  const routeStartKeepsakeEquipResults = new Map<
    string,
    import('./candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >();
  const routeStart = createRouteStartKeepsakeSelectionAddress(route.routeKey);
  routeStartKeepsakes.set(
    semanticAddressKey(routeStart),
    Object.freeze({
      state: createKeepsakeState(
        catalog,
        route.loadout.startingKeepsakeKey,
        createArcanaFearState(catalog, route.loadout),
      ),
      encounterBlockedKeepsakeKeys: Object.freeze([]),
    }),
  );
  const routeStartEffect = catalog.keepsakes.byKey[route.loadout.startingKeepsakeKey]?.effect;
  if (
    routeStartEffect !== undefined &&
    (routeStartEffect.kind === 'jeweledPom' || routeStartEffect.kind === 'experimentalHammer')
  ) {
    const result = createKeepsakeEquipResultAddress(routeStart, routeStartEffect.kind);
    const startArcanaFear = createArcanaFearState(catalog, route.loadout);
    const startKeepsakes = createKeepsakeState(
      catalog,
      route.loadout.startingKeepsakeKey,
      startArcanaFear,
    );
    const authoredResult = route.loadout.keepsakeEquipResults?.[routeStartEffect.kind];
    if (authoredResult === undefined) {
      routeStartBlock = 'incomplete';
      findings.push(
        Object.freeze({
          code: 'keepsakeEquipResultMissing',
          severity: 'error',
          phase: 'rewardGeneration',
          origin: result,
          evidence: Object.freeze({ keepsakeKey: route.loadout.startingKeepsakeKey }),
        }),
      );
    } else if (
      !(routeStartEffect.kind === 'jeweledPom'
        ? assessJeweledPomEquipResult(
            catalog,
            route.loadout.keepsakeEquipResults!.jeweledPom!,
            createTraitHistoryState(),
            startKeepsakes.fatedStatus,
          ).legal
        : assessExperimentalHammerEquipResult(
            catalog,
            route.loadout.keepsakeEquipResults!.experimentalHammer!,
            createTraitHistoryState(),
            route.loadout,
          ).legal)
    ) {
      routeStartBlock = 'invalid';
      findings.push(
        Object.freeze({
          code: 'keepsakeEquipResultUnavailable',
          severity: 'error',
          phase: 'rewardGeneration',
          origin: result,
          evidence: Object.freeze({ keepsakeKey: route.loadout.startingKeepsakeKey }),
        }),
      );
    }
    routeStartKeepsakeEquipResults.set(
      semanticAddressKey(result),
      Object.freeze({
        frontiers: Object.freeze([
          Object.freeze({
            before: createTraitHistoryState(),
            arcanaFear: startArcanaFear,
            fatedStatus: startKeepsakes.fatedStatus,
            loadout: route.loadout,
          }),
        ]),
      }),
    );
  }
  if (routeStartBlock !== null) {
    blockedSuffix = Object.freeze(route.biomes.map((biome) => biome.biomeKey));
  }
  for (const [index, plan] of routeStartBlock === null ? route.biomes.entries() : []) {
    const previous = evaluations.at(-1);
    if (previous?.authoring === 'incomplete' && previous.validity !== 'invalid') {
      throw new ProjectSimulationContractError('incomplete biome cannot seed route continuation');
    }
    if (previous?.validity === 'invalid') {
      throw new ProjectSimulationContractError('invalid biome cannot seed route continuation');
    }
    const seed =
      previous?.authoring === 'complete' && previous.validity === 'valid'
        ? Object.freeze({ history: previous.history, rewardBranches: previous.rewards.branches })
        : undefined;
    const context = Object.freeze({
      enteredBiomeCount: index + 1,
      hasConfiguredSuccessor: index + 1 < route.biomes.length,
      loadout: route.loadout,
      ...(seed === undefined ? {} : { seed }),
    });
    const assembled = evaluateBiomeAssembly(catalog, route.routeKey, plan, context);
    const evaluation = assembled.evaluation;
    evaluations.push(evaluation);
    candidateArtifacts.push(assembled.candidateArtifacts);
    findings.push(...evaluation.findings);
    if (evaluation.authoring === 'incomplete' || evaluation.validity === 'invalid') {
      active = Object.freeze({
        kind: evaluation.validity === 'invalid' ? 'invalid' : 'incomplete',
        biomeKey: evaluation.biomeKey,
      });
      blockedSuffix = Object.freeze(route.biomes.slice(index + 1).map((biome) => biome.biomeKey));
      break;
    }
    completeValidPrefix.push(evaluation.biomeKey);
  }
  const frozenEvaluations = Object.freeze(evaluations);
  const processing = Object.freeze({
    completeValidPrefix: Object.freeze(completeValidPrefix),
    active,
    blockedSuffix,
  });
  return Object.freeze({
    evaluation: Object.freeze({
      routeKey: route.routeKey,
      status: routeStatus(route.biomes.length, frozenEvaluations, routeStartBlock),
      configuredBiomeKeys: Object.freeze(route.biomes.map((biome) => biome.biomeKey)),
      biomes: frozenEvaluations,
      processing,
      findings: Object.freeze(findings),
      summary: summarizeRoute(route.biomes.length, frozenEvaluations, processing),
    }),
    candidateArtifacts: Object.freeze(candidateArtifacts),
    routeStartKeepsakes,
    routeStartKeepsakeEquipResults,
  });
}

function summarizeProject(routes: readonly ProjectRouteEvaluation[]): ProjectEvaluationSummary {
  const totals = routes.reduce(
    (result, route) => ({
      configuredBiomeCount: result.configuredBiomeCount + route.summary.configuredBiomeCount,
      evaluatedBiomeCount: result.evaluatedBiomeCount + route.summary.evaluatedBiomeCount,
      validatedBiomeCount: result.validatedBiomeCount + route.summary.validatedBiomeCount,
      incompleteBiomeCount: result.incompleteBiomeCount + route.summary.incompleteBiomeCount,
      invalidBiomeCount: result.invalidBiomeCount + route.summary.invalidBiomeCount,
      blockedBiomeCount: result.blockedBiomeCount + route.summary.blockedBiomeCount,
    }),
    {
      configuredBiomeCount: 0,
      evaluatedBiomeCount: 0,
      validatedBiomeCount: 0,
      incompleteBiomeCount: 0,
      invalidBiomeCount: 0,
      blockedBiomeCount: 0,
    },
  );
  return Object.freeze({
    ...totals,
    eligibleForExecutionPlan:
      totals.configuredBiomeCount > 0 &&
      routes.every(
        (route) =>
          route.summary.configuredBiomeCount === 0 || route.summary.eligibleForExecutionPlan,
      ),
  });
}

export function simulateProject(catalog: Catalog, project: ProjectDocument): ProjectEvaluation {
  return simulateProjectAssembly(catalog, project).evaluation;
}

export function simulateProjectAssembly(
  catalog: Catalog,
  project: ProjectDocument,
): ProjectEvaluationAssembly {
  assertProjectMatchesCatalog(catalog, project);
  const assembledRoutes = project.routes.map((route) => evaluateRouteAssembly(catalog, route));
  const routes = Object.freeze(assembledRoutes.map((route) => route.evaluation));
  const summary = summarizeProject(routes);
  const evaluation = Object.freeze({
    status:
      summary.configuredBiomeCount === 0
        ? 'empty'
        : routes.some((route) => route.status === 'invalid')
          ? 'invalid'
          : routes.some((route) => route.status === 'incomplete')
            ? 'incomplete'
            : 'valid',
    projectId: project.projectId,
    catalogVersion: project.catalogVersion,
    routes,
    findings: Object.freeze(routes.flatMap((route) => route.findings)),
    summary,
  });
  evaluationSourceProjects.set(evaluation, project);
  return new ExactProjectEvaluationAssembly(
    project,
    evaluation,
    createProjectCandidateArtifacts(
      assembledRoutes.flatMap((route) => route.candidateArtifacts),
      new Map(assembledRoutes.flatMap((route) => [...route.routeStartKeepsakes.entries()])),
      new Map(
        assembledRoutes.flatMap((route) => [...route.routeStartKeepsakeEquipResults.entries()]),
      ),
    ),
    exactProjectEvaluationAssemblyConstructionToken,
  );
}
