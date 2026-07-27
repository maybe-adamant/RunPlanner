import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createHubOpenSetAddress,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type ExitDecisionAddress,
  type HubSlotAddress,
  type HubVisitAddress,
  type IncomingRewardAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type LocalRewardAddress,
  type OccurrenceAddress,
  type RewardWheelAddress,
  type RewardWheelOfferAddress,
  type SemanticAddress,
  type ShopOfferAddress,
  type ShopPurchaseAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import {
  applyProjectCommand,
  ProjectCommandContractError,
} from '../../authored-project/commands/dispatch';
import type {
  ExitDecision,
  HubDecision,
  OccurrenceId,
  ProjectDocument,
  RewardWheelState,
  ShipCombatState,
} from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import {
  evaluateTakeoverPrebossBatchCandidate,
  evaluateTakeoverPrebossBatchCandidateAtFrontier,
  fieldsCageOutcomeCandidateSupport,
  evaluateHubOpenSetConstraints,
  roomTargetCandidateContextAtFrontier,
  roomTargetCandidateContexts,
  type HubSideRoomGenerationSupportEntry,
  type RoomTargetCandidateValidation,
  type TakeoverPrebossBatchCandidateSupport,
} from '../generation';
import type {
  CanonicalAuthoredRoom,
  CanonicalDecision,
  CanonicalHubDecision,
  MaterializedBiomePrefix,
} from '../materialization';
import {
  assertProjectEvaluationSource,
  simulateProject,
  type CompleteBiomeProjectEvaluation,
  type BiomeEvaluationCheckpoint,
  type BiomeEvaluationCoverage,
  type PrefixIncompleteBiomeProjectEvaluation,
  type ProjectEvaluation,
} from '../project';
import {
  evaluateProgressiveBiome,
  evaluateProgressiveBiomeBeforeClamp,
  type ProgressiveBiomeEvaluation,
} from '../progressive/biome';
import type { SemanticFinding } from '../model';
import type { ProgressiveRoomHistoryViews } from '../history';
import {
  rewardProducerFrontier,
  rewardStoreCandidateSupport,
  roomLifecycleCandidateContexts,
  type RoomLifecycleCandidateResult,
  type RewardProducerCandidateResult,
  type RewardStoreCandidateSupport,
} from '../rewards';

export class CandidateEvaluationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'CandidateEvaluationContractError';
  }
}

export interface RoomTargetCandidateQuery {
  readonly kind: 'roomTarget';
  readonly target: TargetAddress;
  readonly gameName: string;
}

export interface TakeoverPrebossBatchCandidateQuery {
  readonly kind: 'takeoverPrebossBatch';
  readonly source: ExitDecisionAddress;
  readonly gameName: string;
}

export interface StartRoomCandidateQuery {
  readonly kind: 'startRoom';
  readonly owner: BiomeAddress | OccurrenceAddress;
  readonly gameName: string;
}

export interface BatchRewardStoreCandidateQuery {
  readonly kind: 'batchRewardStore';
  readonly rewardStore: BatchRewardStoreAddress;
  readonly storeKey: string;
}

export interface IncomingRewardCandidateQuery {
  readonly kind: 'incomingReward';
  readonly reward: IncomingRewardAddress;
  readonly value: ResolvedRewardOffer;
}

export interface LocalRewardCandidateQuery {
  readonly kind: 'localReward';
  readonly reward: LocalRewardAddress;
  readonly value: ResolvedRewardOffer;
}

export interface FieldsCageOutcomeCandidateQuery {
  readonly kind: 'fieldsCageOutcome';
  readonly decision: ExitDecisionAddress;
  readonly cageOutcome: 'min' | 'max';
}

export interface ShipEncounterCountCandidateQuery {
  readonly kind: 'shipEncounterCount';
  readonly occurrence: OccurrenceAddress;
  readonly encounterCount: 2 | 3;
}

export interface RewardWheelOfferCountCandidateQuery {
  readonly kind: 'rewardWheelOfferCount';
  readonly wheel: RewardWheelAddress;
  readonly offerCount: number;
}

export interface RewardWheelStoreCandidateQuery {
  readonly kind: 'rewardWheelStore';
  readonly wheel: RewardWheelAddress;
  readonly storeKey: string;
}

export interface RewardWheelOfferCandidateQuery {
  readonly kind: 'rewardWheelOffer';
  readonly offer: RewardWheelOfferAddress;
  readonly value: ResolvedRewardOffer;
}

export interface RewardWheelPickedCandidateQuery {
  readonly kind: 'rewardWheelPicked';
  readonly wheel: RewardWheelAddress;
  readonly pickedOfferIndex: number;
}

export interface ShopOfferCandidateQuery {
  readonly kind: 'shopOffer';
  readonly offer: ShopOfferAddress;
  readonly value: ResolvedRewardOffer;
}

export interface ShopPurchaseCandidateQuery {
  readonly kind: 'shopPurchase';
  readonly purchase: ShopPurchaseAddress;
  readonly purchased: boolean;
}

/**
 * A Hub slot is a physical board position. Opening it needs the occurrence
 * identity that the eventual semantic command will create; closing ignores
 * that value and retains the existing occurrence instead.
 */
export interface HubSlotCandidateQuery {
  readonly kind: 'hubSlot';
  readonly slot: HubSlotAddress;
  readonly open: boolean;
  readonly occurrenceId: OccurrenceId;
}

export interface HubVisitCandidateQuery {
  readonly kind: 'hubVisit';
  readonly visit: HubVisitAddress;
  readonly hubSlotKey: string;
}

export interface SideRoomGenerationCandidateQuery {
  readonly kind: 'sideRoomGeneration';
  readonly sideRoom: LocalChildAddress;
  readonly generation: 'generated' | 'notGenerated';
}

export interface SideRoomEntryOrderCandidateQuery {
  readonly kind: 'sideRoomEntryOrder';
  readonly group: LocalChildGroupAddress;
  readonly enteredSlotKeys: readonly string[];
}

export type ProjectCandidateQuery =
  | BatchRewardStoreCandidateQuery
  | HubSlotCandidateQuery
  | HubVisitCandidateQuery
  | IncomingRewardCandidateQuery
  | LocalRewardCandidateQuery
  | FieldsCageOutcomeCandidateQuery
  | ShipEncounterCountCandidateQuery
  | RewardWheelOfferCountCandidateQuery
  | RewardWheelStoreCandidateQuery
  | RewardWheelOfferCandidateQuery
  | RewardWheelPickedCandidateQuery
  | RoomTargetCandidateQuery
  | SideRoomEntryOrderCandidateQuery
  | SideRoomGenerationCandidateQuery
  | ShopOfferCandidateQuery
  | ShopPurchaseCandidateQuery
  | StartRoomCandidateQuery
  | TakeoverPrebossBatchCandidateQuery;

export type CandidateContextUnavailableReason =
  | 'authoredPrerequisiteMissing'
  | 'biomeIncomplete'
  | 'coverageNotReached'
  | 'producerFrontierUnavailable'
  | 'targetNotReachable'
  | 'upstreamIncomplete'
  | 'upstreamInvalid';

export type CandidateAuthoredPrerequisite = {
  readonly kind: 'batchRewardStore' | 'fieldsCageOutcome' | 'biomeField';
  readonly owner: SemanticAddress;
};

export type CandidateContextUnavailableEvidence =
  | {
      readonly kind: 'authoredPrerequisiteMissing';
      readonly prerequisite: CandidateAuthoredPrerequisite;
    }
  | {
      readonly kind: 'biomeIncomplete';
      readonly biome: BiomeAddress;
    }
  | {
      readonly kind: 'coverageNotReached';
      readonly requiredOwner: SemanticAddress;
      readonly requiredCheckpoint: BiomeEvaluationCheckpoint;
      readonly coverage: BiomeEvaluationCoverage;
    }
  | {
      readonly kind: 'producerFrontierUnavailable';
      readonly producer: SemanticAddress;
    }
  | {
      readonly kind: 'targetNotReachable';
      readonly target: SemanticAddress;
    }
  | {
      readonly kind: 'upstreamIncomplete' | 'upstreamInvalid';
      readonly upstreamBiomeKey: string;
    };

export interface CandidateContextUnavailable {
  readonly kind: 'unavailable';
  readonly reason: CandidateContextUnavailableReason;
  /** Exact semantic evidence for the unavailable candidate context. */
  readonly evidence: CandidateContextUnavailableEvidence;
}

export type CandidateEvaluationEvent = {
  readonly kind: 'queryBatch';
  readonly queryCount: number;
};

export interface ProjectCandidateSessionOptions {
  readonly observe?: (event: CandidateEvaluationEvent) => void;
}

export interface EvaluatedRoomTargetCandidate {
  readonly kind: 'roomTarget';
  readonly result: RoomTargetCandidateValidation;
}

export interface EvaluatedTakeoverPrebossBatchCandidate {
  readonly kind: 'takeoverPrebossBatch';
  readonly result: TakeoverPrebossBatchCandidateSupport;
}

export interface StartRoomCandidateSupport {
  readonly gameName: string;
  readonly supportedGameNames: readonly string[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedStartRoomCandidate {
  readonly kind: 'startRoom';
  readonly result: StartRoomCandidateSupport;
}

export interface BatchRewardStoreCandidateSupport extends RewardStoreCandidateSupport {
  readonly authoredStoreKey?: string;
  readonly selectedStoreKey: string;
  readonly selectedPossible: boolean;
}

export interface EvaluatedBatchRewardStoreCandidate {
  readonly kind: 'batchRewardStore';
  readonly result: BatchRewardStoreCandidateSupport;
}

export interface EvaluatedIncomingRewardCandidate {
  readonly kind: 'incomingReward';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedLocalRewardCandidate {
  readonly kind: 'localReward';
  readonly result: RewardProducerCandidateResult;
}

export interface FieldsCageOutcomeCandidateSupport {
  readonly cageOutcome: 'min' | 'max';
  readonly supportOutcomes: readonly ('min' | 'max')[];
  readonly selectedPossible: boolean;
  readonly findings: readonly SemanticFinding[];
}

export interface EvaluatedFieldsCageOutcomeCandidate {
  readonly kind: 'fieldsCageOutcome';
  readonly result: FieldsCageOutcomeCandidateSupport;
}

export interface ShipEncounterCountCandidateSupport {
  readonly encounterCount: 2 | 3;
  readonly supportEncounterCounts: readonly number[];
  readonly selectedPossible: boolean;
  readonly findings: readonly SemanticFinding[];
}

export interface EvaluatedShipEncounterCountCandidate {
  readonly kind: 'shipEncounterCount';
  readonly result: ShipEncounterCountCandidateSupport;
}

export interface RewardWheelLifecycleCandidateSupport {
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedRewardWheelOfferCountCandidate {
  readonly kind: 'rewardWheelOfferCount';
  readonly result: RewardWheelLifecycleCandidateSupport & {
    readonly offerCount: number;
    readonly minimumOfferCount: number;
    readonly maximumOfferCount: number;
  };
}

export interface EvaluatedRewardWheelStoreCandidate {
  readonly kind: 'rewardWheelStore';
  readonly result: RewardWheelLifecycleCandidateSupport & {
    readonly storeKey: string;
    readonly supportedStoreKeys: readonly string[];
  };
}

export interface EvaluatedRewardWheelOfferCandidate {
  readonly kind: 'rewardWheelOffer';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedRewardWheelPickedCandidate {
  readonly kind: 'rewardWheelPicked';
  readonly result: RewardWheelLifecycleCandidateSupport & { readonly pickedOfferIndex: number };
}

export interface EvaluatedShopOfferCandidate {
  readonly kind: 'shopOffer';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedShopPurchaseCandidate {
  readonly kind: 'shopPurchase';
  readonly result: RoomLifecycleCandidateResult;
}

export interface HubSlotCandidateSupport {
  readonly candidateOpen: boolean;
  readonly currentlyOpen: boolean;
  readonly openSlotKeys: readonly string[];
  readonly minimumOpenCount: number;
  readonly maximumOpenCount: number;
  readonly referencedVisitIndexes: readonly number[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedHubSlotCandidate {
  readonly kind: 'hubSlot';
  readonly result: HubSlotCandidateSupport;
}

export interface HubVisitCandidateSupport {
  readonly candidateHubSlotKey: string;
  readonly openHubSlotKeys: readonly string[];
  readonly occupiedVisitIndexes: readonly number[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedHubVisitCandidate {
  readonly kind: 'hubVisit';
  readonly result: HubVisitCandidateSupport;
}

export interface SideRoomGenerationCandidateSupport {
  readonly candidateGeneration: 'generated' | 'notGenerated';
  readonly enteredOrdinal: number | null;
  readonly generatedBefore: number;
  readonly requiredGeneratedCount: number;
  readonly supportOutcomes: readonly ('generated' | 'notGenerated')[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedSideRoomGenerationCandidate {
  readonly kind: 'sideRoomGeneration';
  readonly result: SideRoomGenerationCandidateSupport;
}

export interface SideRoomEntryOrderCandidateSupport {
  readonly candidateEnteredSlotKeys: readonly string[];
  readonly generatedSlotKeys: readonly string[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedSideRoomEntryOrderCandidate {
  readonly kind: 'sideRoomEntryOrder';
  readonly result: SideRoomEntryOrderCandidateSupport;
}

export type ProjectCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedBatchRewardStoreCandidate
  | EvaluatedHubSlotCandidate
  | EvaluatedHubVisitCandidate
  | EvaluatedIncomingRewardCandidate
  | EvaluatedLocalRewardCandidate
  | EvaluatedFieldsCageOutcomeCandidate
  | EvaluatedShipEncounterCountCandidate
  | EvaluatedRewardWheelOfferCountCandidate
  | EvaluatedRewardWheelStoreCandidate
  | EvaluatedRewardWheelOfferCandidate
  | EvaluatedRewardWheelPickedCandidate
  | EvaluatedRoomTargetCandidate
  | EvaluatedSideRoomEntryOrderCandidate
  | EvaluatedSideRoomGenerationCandidate
  | EvaluatedShopOfferCandidate
  | EvaluatedShopPurchaseCandidate
  | EvaluatedStartRoomCandidate
  | EvaluatedTakeoverPrebossBatchCandidate;

export interface ProjectCandidateSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  readonly evaluate: {
    (query: ProjectCandidateQuery): ProjectCandidateEvaluation;
    (queries: readonly ProjectCandidateQuery[]): readonly ProjectCandidateEvaluation[];
  };
}

function completeBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): CompleteBiomeProjectEvaluation | undefined {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  return biome?.authoring === 'complete' ? biome : undefined;
}

function prefixBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): PrefixIncompleteBiomeProjectEvaluation | undefined {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  return biome?.authoring === 'incomplete' && 'materializedPrefix' in biome ? biome : undefined;
}

function previousValidBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): CompleteBiomeProjectEvaluation | undefined {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const index = route?.biomes.findIndex((candidate) => candidate.biomeKey === biomeKey) ?? -1;
  if (index <= 0 || route === undefined) return undefined;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = route.biomes[cursor];
    if (candidate?.authoring === 'complete' && candidate.validity === 'valid') return candidate;
  }
  return undefined;
}

function progressiveSeed(evaluation: ProjectEvaluation, routeKey: string, biomeKey: string) {
  const previous = previousValidBiome(evaluation, routeKey, biomeKey);
  return previous === undefined
    ? undefined
    : Object.freeze({ history: previous.history, rewardBranches: previous.rewards.branches });
}

type CandidateBiomeEvaluation =
  | CompleteBiomeProjectEvaluation
  | PrefixIncompleteBiomeProjectEvaluation
  | ProgressiveBiomeEvaluation;

/**
 * Candidate queries must never read past a blocked progressive prefix. A
 * complete-invalid biome is rematerialized through that clamp; an
 * incomplete-invalid biome already publishes it. Only the invalid owner and
 * its already-generated prefix remain assessable.
 */
function candidateBiome(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): CandidateBiomeEvaluation | undefined {
  const complete = completeBiome(evaluation, routeKey, biomeKey);
  if (complete?.validity !== 'invalid') {
    return complete ?? prefixBiome(evaluation, routeKey, biomeKey);
  }
  return (
    evaluateProgressiveBiome(
      catalog,
      createBiomeAddress(routeKey, biomeKey),
      planFor(project, routeKey, biomeKey),
      completeBiomeCount(evaluation, routeKey, biomeKey),
      progressiveSeed(evaluation, routeKey, biomeKey),
    ) ?? undefined
  );
}

function candidatePrefix(
  biome: CandidateBiomeEvaluation | undefined,
): PrefixIncompleteBiomeProjectEvaluation | ProgressiveBiomeEvaluation | undefined {
  return biome !== undefined && 'materializedPrefix' in biome ? biome : undefined;
}

function candidateBlockedAt(
  biome: CandidateBiomeEvaluation | undefined,
): SemanticAddress | undefined {
  if (biome === undefined) return undefined;
  if ('coverage' in biome)
    return biome.coverage.kind === 'prefix' ? biome.coverage.blockedAt : undefined;
  return biome.blockedAt;
}

type LifecycleRepairOwner = OccurrenceAddress | RewardWheelAddress | ShopPurchaseAddress;

function lifecycleRepairOwnerMatches(
  owner: LifecycleRepairOwner,
  blockedOwner: SemanticAddress,
): boolean {
  if (semanticAddressKey(owner) === semanticAddressKey(blockedOwner)) return true;
  return (
    owner.kind === 'rewardWheel' &&
    blockedOwner.kind === 'rewardWheelOffer' &&
    blockedOwner.routeKey === owner.routeKey &&
    blockedOwner.biomeKey === owner.biomeKey &&
    blockedOwner.occurrenceId === owner.occurrenceId &&
    blockedOwner.wheelKey === owner.wheelKey
  );
}

function repairProgressiveBiomeForOwner(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  owner: SemanticAddress & { readonly routeKey: string; readonly biomeKey: string },
  matchesBlockedOwner: (blockedOwner: SemanticAddress) => boolean = (blockedOwner) =>
    semanticAddressKey(blockedOwner) === semanticAddressKey(owner),
): ProgressiveBiomeEvaluation | undefined {
  const bounded = candidateBiome(catalog, project, evaluation, owner.routeKey, owner.biomeKey);
  const blockedAt = candidateBlockedAt(bounded);
  if (blockedAt === undefined || !matchesBlockedOwner(blockedAt)) {
    return undefined;
  }
  const raw = evaluateProgressiveBiomeBeforeClamp(
    catalog,
    createBiomeAddress(owner.routeKey, owner.biomeKey),
    planFor(project, owner.routeKey, owner.biomeKey),
    completeBiomeCount(evaluation, owner.routeKey, owner.biomeKey),
    progressiveSeed(evaluation, owner.routeKey, owner.biomeKey),
  );
  return raw !== null && raw.blockedAt !== undefined && matchesBlockedOwner(raw.blockedAt)
    ? raw
    : undefined;
}

/**
 * A complete biome may have no materializable progressive form (for example,
 * when its declaration-owned completion path is required to reach the room).
 * Its full lifecycle context is still safe for repair only when the queried
 * owner is its sole invalid owner: there is then no earlier or later invalid
 * semantic owner whose support could be exposed by the fallback.
 */
function completeLifecycleRepairForOwner(
  evaluation: ProjectEvaluation,
  owner: LifecycleRepairOwner,
): CompleteBiomeProjectEvaluation | undefined {
  const complete = completeBiome(evaluation, owner.routeKey, owner.biomeKey);
  if (complete?.validity !== 'invalid' || complete.findings.length === 0) return undefined;
  return complete.findings.every((finding) => lifecycleRepairOwnerMatches(owner, finding.origin))
    ? complete
    : undefined;
}

function prefixAuthoredRooms(prefix: MaterializedBiomePrefix): readonly CanonicalAuthoredRoom[] {
  return Object.freeze([
    ...(prefix.entryRoom === undefined ? [] : [prefix.entryRoom]),
    ...prefix.decisions.flatMap((decision): readonly CanonicalAuthoredRoom[] => {
      switch (decision.kind) {
        case 'batch':
          return decision.targets.map((target) => target.room);
        case 'linkedExit':
          return [decision.target.room];
        case 'hub':
          return decision.board.targets.map((target) => target.room);
      }
    }),
  ]);
}

interface CandidateHubState {
  readonly descriptor: Extract<
    Catalog['biomeLayouts']['values'][number]['progression'],
    {
      readonly kind: 'hub';
    }
  >;
  readonly plan: ProjectDocument['routes'][number]['biomes'][number];
  readonly topology: NonNullable<ProjectDocument['routes'][number]['biomes'][number]['topology']>;
  readonly decision: HubDecision;
}

function candidateHubState(
  catalog: Catalog,
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  hubKey: string,
): CandidateHubState | undefined {
  const plan = planFor(project, routeKey, biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.progression.kind !== 'hub') {
    throw new CandidateEvaluationContractError(`${biomeKey} has no Hub candidate domain`);
  }
  if (layout.progression.hubKey !== hubKey) {
    throw new CandidateEvaluationContractError(`${hubKey} is not ${biomeKey}'s Hub decision`);
  }
  const topology = plan.topology;
  if (topology === null) return undefined;
  const decision = topology.decisions.find(
    (candidate): candidate is HubDecision =>
      candidate.kind === 'hub' && candidate.hubKey === hubKey,
  );
  if (decision === undefined) return undefined;
  return Object.freeze({ descriptor: layout.progression, plan, topology, decision });
}

function hubOpenSetIncompleteFinding(
  query: HubSlotCandidateQuery,
  minimumOpenCount: number,
  maximumOpenCount: number,
  actualOpenCount: number,
): SemanticFinding {
  return Object.freeze({
    code: 'hubOpenSetIncomplete',
    severity: 'error',
    phase: 'completeness',
    origin: createHubOpenSetAddress(
      createBiomeAddress(query.slot.routeKey, query.slot.biomeKey),
      query.slot.hubKey,
    ),
    evidence: Object.freeze({ minimumOpenCount, maximumOpenCount, actualOpenCount }),
  });
}

function hubCandidateFindings(
  query: HubSlotCandidateQuery,
  state: CandidateHubState,
): readonly SemanticFinding[] {
  const candidateOpenSlotKeys = state.descriptor.slots.flatMap((slot) => {
    const isCandidate = slot.slotKey === query.slot.hubSlotKey;
    const remainsOpen = isCandidate
      ? query.open
      : state.decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey);
    return remainsOpen ? [slot.slotKey] : [];
  });
  const count = candidateOpenSlotKeys.length;
  // An undersized board is an incomplete authored decision, not evidence that
  // the slot edit itself is unavailable.  A player must be able to assemble a
  // fresh Hub one physical door at a time; completeness reports the missing
  // minimum separately at the board owner.  Exceeding the declaration maximum
  // is still an invalid proposal.
  if (count > state.descriptor.openCount.max) {
    return Object.freeze([
      hubOpenSetIncompleteFinding(
        query,
        state.descriptor.openCount.min,
        state.descriptor.openCount.max,
        count,
      ),
    ]);
  }
  const constraints = evaluateHubOpenSetConstraints(
    state.descriptor,
    createBiomeAddress(query.slot.routeKey, query.slot.biomeKey),
    candidateOpenSlotKeys,
  );
  return Object.freeze(
    constraints.findings.filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(query.slot),
    ),
  );
}

function hubCandidateProposal(
  catalog: Catalog,
  project: ProjectDocument,
  command: Parameters<typeof applyProjectCommand>[2],
): ProjectDocument | undefined {
  try {
    return applyProjectCommand(project, catalog, command);
  } catch (error) {
    if (error instanceof ProjectCommandContractError) return undefined;
    throw error;
  }
}

function hubRegionEvaluation(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  hubKey: string,
  visitIndex: number,
) {
  const plan = planFor(project, routeKey, biomeKey);
  const topology = plan.topology;
  if (topology === null) return undefined;
  const decision = topology.decisions.find(
    (candidate): candidate is HubDecision =>
      candidate.kind === 'hub' && candidate.hubKey === hubKey,
  );
  if (decision === undefined) return undefined;
  const regionalPlan = Object.freeze({
    ...plan,
    topology: Object.freeze({
      ...topology,
      decisions: Object.freeze(
        topology.decisions.map((candidate) =>
          candidate === decision
            ? Object.freeze({
                ...candidate,
                visitOrder: Object.freeze(candidate.visitOrder.slice(0, visitIndex)),
              })
            : candidate,
        ),
      ),
    }),
  });
  return evaluateProgressiveBiome(
    catalog,
    createBiomeAddress(routeKey, biomeKey),
    regionalPlan,
    completeBiomeCount(evaluation, routeKey, biomeKey),
    progressiveSeed(evaluation, routeKey, biomeKey),
  );
}

function findingOwnsOccurrence(finding: SemanticFinding, occurrenceId: OccurrenceId): boolean {
  return 'occurrenceId' in finding.origin && finding.origin.occurrenceId === occurrenceId;
}

function findingOwnsLocalGroup(finding: SemanticFinding, group: LocalChildGroupAddress): boolean {
  return (
    (finding.origin.kind === 'localChild' || finding.origin.kind === 'localReward') &&
    finding.origin.occurrenceId === group.occurrenceId &&
    finding.origin.groupKey === group.groupKey
  );
}

function hubSideSupport(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  sideRoom: LocalChildAddress,
): HubSideRoomGenerationSupportEntry | undefined {
  const biome = candidateBiome(catalog, project, evaluation, routeKey, biomeKey);
  const support = biome?.roomGeneration.hub.sideRoomGenerations.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(sideRoom),
  );
  if (support !== undefined) return support;
  const repair = repairProgressiveBiomeForOwner(catalog, project, evaluation, sideRoom);
  return repair?.roomGeneration.hub.sideRoomGenerations.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(sideRoom),
  );
}

function candidateHubDecision(
  biome: CandidateBiomeEvaluation | undefined,
): CanonicalHubDecision | undefined {
  const decisions =
    biome === undefined
      ? undefined
      : 'snapshot' in biome
        ? biome.snapshot.decisions
        : biome.materializedPrefix.decisions;
  return decisions?.find((decision): decision is CanonicalHubDecision => decision.kind === 'hub');
}

/**
 * A Hub prefix blocked at any authored completeness state is bounded by its
 * progressive region. A visit beyond that region must be unavailable rather
 * than being evaluated against the unrestricted authored decision.
 */
function progressiveHubVisitReached(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  visit: HubVisitAddress,
): boolean {
  const biome = candidateBiome(catalog, project, evaluation, visit.routeKey, visit.biomeKey);
  if (candidateBlockedAt(biome) === undefined) return true;
  const hub = candidateHubDecision(biome);
  return (
    hub?.visits.some(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(visit),
    ) ?? false
  );
}

function progressiveHubLocalGroupReached(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  group: LocalChildGroupAddress,
): boolean {
  const biome = candidateBiome(catalog, project, evaluation, group.routeKey, group.biomeKey);
  if (candidateBlockedAt(biome) === undefined) return true;
  const hub = candidateHubDecision(biome);
  return (
    hub?.visits.some((visit) =>
      visit.localSlots.some(
        (slot) =>
          slot.origin.occurrenceId === group.occurrenceId && slot.groupKey === group.groupKey,
      ),
    ) ?? false
  );
}

function ordinaryBatchCount(catalog: Catalog, decisions: readonly CanonicalDecision[]): number {
  return decisions.filter(
    (decision) =>
      decision.kind === 'batch' &&
      decision.parent.origin.kind === 'occurrence' &&
      !decision.targets.some(
        (target) =>
          catalog.rooms.byKey[target.room.gameName]?.prebossBatchPolicy?.kind ===
          'takeOverNormalDoors',
      ),
  ).length;
}

function historyBeforePhysicalTarget(
  source: ProgressiveRoomHistoryViews,
  sourceDeclaration: NonNullable<Catalog['rooms']['byKey'][string]>,
  target: TargetAddress,
): ProgressiveRoomHistoryViews['preOutgoing'] {
  const exits = [...sourceDeclaration.exits].sort((left, right) => left.index - right.index);
  const targetIndex = exits.findIndex((exit) => `exit${exit.index}` === target.exitKey);
  if (targetIndex < 0) return undefined;
  if (targetIndex === 0) return source.preOutgoing;
  const precedingExit = exits[targetIndex - 1];
  if (precedingExit === undefined) return undefined;
  return source.targetGenerations.find(
    (generation) =>
      semanticAddressKey(generation.targetOrigin) ===
      semanticAddressKey(
        createTargetAddress(
          createBiomeAddress(target.routeKey, target.biomeKey),
          target.source,
          `exit${precedingExit.index}`,
        ),
      ),
  )?.after;
}

function blockedPhysicalTargetPrecedes(
  project: ProjectDocument,
  blockedAt: SemanticAddress | undefined,
  target: TargetAddress,
): boolean {
  const biome = createBiomeAddress(target.routeKey, target.biomeKey);
  const queriedDecision = createExitDecisionAddress(biome, target.source);
  const queriedIndex = /^exit(\d+)$/.exec(target.exitKey)?.[1];
  if (blockedAt === undefined || queriedIndex === undefined) return false;
  const blockedIndex = (() => {
    if (blockedAt.kind === 'target') {
      const blockedDecision = createExitDecisionAddress(biome, blockedAt.source);
      return semanticAddressKey(blockedDecision) === semanticAddressKey(queriedDecision)
        ? /^exit(\d+)$/.exec(blockedAt.exitKey)?.[1]
        : undefined;
    }
    if (blockedAt.kind === 'batchRewardStore') {
      const blockedDecision = createExitDecisionAddress(biome, blockedAt.source);
      return semanticAddressKey(blockedDecision) === semanticAddressKey(queriedDecision)
        ? '0'
        : undefined;
    }
    if (blockedAt.kind !== 'incomingReward') return undefined;
    const plan = planFor(project, target.routeKey, target.biomeKey);
    const decision = plan.topology?.decisions.find(
      (candidate): candidate is ExitDecision =>
        candidate.kind === 'exit' &&
        semanticAddressKey(createExitDecisionAddress(biome, candidate.source)) ===
          semanticAddressKey(queriedDecision),
    );
    const exitKey =
      decision?.normal.kind === 'batch'
        ? decision.normal.targets.find(
            (candidate) => candidate.occurrenceId === blockedAt.occurrenceId,
          )?.exitKey
        : undefined;
    return exitKey === undefined ? undefined : /^exit(\d+)$/.exec(exitKey)?.[1];
  })();
  return blockedIndex !== undefined && Number(blockedIndex) < Number(queriedIndex);
}

function evaluatePrefixRoomTarget(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: RoomTargetCandidateQuery,
): ProjectCandidateEvaluation | undefined {
  const biome = prefixBiome(evaluation, query.target.routeKey, query.target.biomeKey);
  const prefix = biome?.materializedPrefix;
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  if (
    biome.coverage.kind === 'prefix' &&
    blockedPhysicalTargetPrecedes(project, biome.coverage.blockedAt, query.target)
  ) {
    return undefined;
  }
  const decision = createExitDecisionAddress(
    createBiomeAddress(query.target.routeKey, query.target.biomeKey),
    query.target.source,
  );
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(decision)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const source = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const sourceDeclaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  const exitIndex = /^exit(\d+)$/.exec(query.target.exitKey)?.[1];
  const physicalExit =
    exitIndex === undefined
      ? undefined
      : sourceDeclaration?.exits.find((exit) => exit.index === Number(exitIndex));
  const sourceViews =
    source === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        );
  const sourceHistory =
    sourceDeclaration === undefined || sourceViews === undefined
      ? undefined
      : historyBeforePhysicalTarget(sourceViews, sourceDeclaration, query.target);
  if (source === undefined || physicalExit === undefined || sourceHistory === undefined)
    return undefined;
  const context = roomTargetCandidateContextAtFrontier(
    catalog,
    prefix.biomeKey,
    ordinaryBatchCount(catalog, prefix.decisions),
    source,
    query.target,
    Object.freeze({
      kind: 'available',
      exitKey: query.target.exitKey,
      index: physicalExit.index,
      type: physicalExit.type,
      compatibilityPolicyKey: physicalExit.compatibilityPolicyKey,
    }),
    sourceHistory,
    completeBiomeCount(evaluation, query.target.routeKey, query.target.biomeKey),
  );
  return Object.freeze({
    kind: 'roomTarget',
    result: context.evaluateGameName(query.gameName),
  });
}

function evaluateInvalidCompleteRoomTarget(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  biome: CompleteBiomeProjectEvaluation,
  query: RoomTargetCandidateQuery,
): ProjectCandidateEvaluation | undefined {
  if (biome.validity !== 'invalid') return undefined;
  const plan = planFor(project, query.target.routeKey, query.target.biomeKey);
  const progressive = evaluateProgressiveBiome(
    catalog,
    createBiomeAddress(query.target.routeKey, query.target.biomeKey),
    plan,
    completeBiomeCount(evaluation, query.target.routeKey, query.target.biomeKey),
    progressiveSeed(evaluation, query.target.routeKey, query.target.biomeKey),
  );
  if (progressive === null) return undefined;
  const covered = roomTargetCandidateContexts(progressive.roomGeneration.ordinary).get(
    semanticAddressKey(query.target),
  );
  if (covered !== undefined) {
    return Object.freeze({ kind: 'roomTarget', result: covered.evaluateGameName(query.gameName) });
  }
  if (blockedPhysicalTargetPrecedes(project, progressive.blockedAt, query.target)) {
    // A later physical door has no candidate horizon until the earlier
    // generated target is repaired. Do not reconstruct context from the raw
    // complete biome past this progressive boundary.
    return undefined;
  }
  const prefix = progressive.materializedPrefix;
  const frontier = prefix.frontier;
  if (frontier?.kind !== 'exitDecision') return undefined;
  const decision = createExitDecisionAddress(
    createBiomeAddress(query.target.routeKey, query.target.biomeKey),
    query.target.source,
  );
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(decision)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const source = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const sourceDeclaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  const exitIndex = /^exit(\d+)$/.exec(query.target.exitKey)?.[1];
  const physicalExit =
    exitIndex === undefined
      ? undefined
      : sourceDeclaration?.exits.find((exit) => exit.index === Number(exitIndex));
  const sourceViews =
    source === undefined
      ? undefined
      : progressive.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        );
  const sourceHistory =
    sourceDeclaration === undefined || sourceViews === undefined
      ? undefined
      : historyBeforePhysicalTarget(sourceViews, sourceDeclaration, query.target);
  if (source === undefined || physicalExit === undefined || sourceHistory === undefined) {
    return undefined;
  }
  const context = roomTargetCandidateContextAtFrontier(
    catalog,
    prefix.biomeKey,
    ordinaryBatchCount(catalog, prefix.decisions),
    source,
    query.target,
    Object.freeze({
      kind: 'available',
      exitKey: query.target.exitKey,
      index: physicalExit.index,
      type: physicalExit.type,
      compatibilityPolicyKey: physicalExit.compatibilityPolicyKey,
    }),
    sourceHistory,
    completeBiomeCount(evaluation, query.target.routeKey, query.target.biomeKey),
  );
  return Object.freeze({ kind: 'roomTarget', result: context.evaluateGameName(query.gameName) });
}

function evaluatePrefixTakeover(
  catalog: Catalog,
  evaluation: ProjectEvaluation,
  query: TakeoverPrebossBatchCandidateQuery,
  candidate?: CandidateBiomeEvaluation,
): ProjectCandidateEvaluation | undefined {
  const biome = candidatePrefix(
    candidate ?? prefixBiome(evaluation, query.source.routeKey, query.source.biomeKey),
  );
  const prefix = biome?.materializedPrefix;
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(query.source)) return undefined;
  if (frontier.parent.origin.kind === 'hubRoom') {
    const layout = catalog.biomeLayouts.byKey[prefix.biomeKey];
    if (layout?.progression.kind !== 'hub') return undefined;
    const requiredExitKeys = Object.freeze([layout.progression.completedExit.exitKey]);
    return Object.freeze({
      kind: 'takeoverPrebossBatch',
      result: Object.freeze({
        source: query.source,
        gameName: query.gameName,
        requiredExitKeys,
        requiredTargetCount: requiredExitKeys.length,
        pressure: Object.freeze([]),
        selectedPossible: query.gameName === layout.progression.completedExit.roomGameName,
        findings: Object.freeze([]),
      }),
    });
  }
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const owner = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const ownerHistory =
    owner === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(owner.origin),
        )?.preOutgoing;
  if (owner === undefined || ownerHistory === undefined) return undefined;
  return Object.freeze({
    kind: 'takeoverPrebossBatch',
    result: evaluateTakeoverPrebossBatchCandidateAtFrontier(
      catalog,
      query.source,
      owner,
      ownerHistory,
      query.gameName,
      completeBiomeCount(evaluation, query.source.routeKey, query.source.biomeKey),
    ),
  });
}

function unavailable(evidence: CandidateContextUnavailableEvidence): CandidateContextUnavailable {
  return Object.freeze({
    kind: 'unavailable',
    reason: evidence.kind,
    evidence: Object.freeze(evidence),
  });
}

function coverageFor(
  evaluation: ProjectEvaluation,
  owner: SemanticAddress,
): BiomeEvaluationCoverage {
  if (!('routeKey' in owner) || !('biomeKey' in owner)) {
    return Object.freeze({ kind: 'none', reason: 'notEvaluated' });
  }
  return (
    evaluation.routes
      .find((route) => route.routeKey === owner.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === owner.biomeKey)?.coverage ??
    Object.freeze({ kind: 'none', reason: 'notEvaluated' })
  );
}

function coverageUnavailable(
  evaluation: ProjectEvaluation,
  owner: SemanticAddress,
  checkpoint: BiomeEvaluationCheckpoint,
): CandidateContextUnavailable {
  return unavailable({
    kind: 'coverageNotReached',
    requiredOwner: owner,
    requiredCheckpoint: checkpoint,
    coverage: coverageFor(evaluation, owner),
  });
}

function producerUnavailable(producer: SemanticAddress): CandidateContextUnavailable {
  return unavailable({ kind: 'producerFrontierUnavailable', producer });
}

function unreachableTarget(target: SemanticAddress): CandidateContextUnavailable {
  return unavailable({ kind: 'targetNotReachable', target });
}

function unavailableForBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  owner: SemanticAddress,
  checkpoint: BiomeEvaluationCheckpoint,
): CandidateContextUnavailable {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) return coverageUnavailable(evaluation, owner, checkpoint);
  if (route.biomes.some((candidate) => candidate.biomeKey === biomeKey)) {
    return coverageUnavailable(evaluation, owner, checkpoint);
  }
  const requestedIndex = route.configuredBiomeKeys.indexOf(biomeKey);
  const activeIndex =
    route.processing.active === null
      ? -1
      : route.configuredBiomeKeys.indexOf(route.processing.active.biomeKey);
  if (requestedIndex > activeIndex && route.processing.active !== null) {
    return unavailable({
      kind:
        route.processing.active.kind === 'incomplete' ? 'upstreamIncomplete' : 'upstreamInvalid',
      upstreamBiomeKey: route.processing.active.biomeKey,
    });
  }
  return coverageUnavailable(evaluation, owner, checkpoint);
}

function unresolvedBatchRewardStore(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  source: BatchRewardStoreAddress['source'],
): boolean {
  const plan = planFor(project, routeKey, biomeKey);
  const decision = plan.topology?.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      semanticAddressKey(
        createExitDecisionAddress(createBiomeAddress(routeKey, biomeKey), candidate.source),
      ) ===
        semanticAddressKey(
          createExitDecisionAddress(createBiomeAddress(routeKey, biomeKey), source),
        ),
  );
  return (
    decision?.kind === 'exit' &&
    decision.normal.kind === 'batch' &&
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  );
}

function assertRoomTargetDomain(
  catalog: Catalog,
  project: ProjectDocument,
  target: TargetAddress,
): void {
  const plan = planFor(project, target.routeKey, target.biomeKey);
  const topology = plan.topology;
  const decision = topology?.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      semanticAddressKey(
        createExitDecisionAddress(
          createBiomeAddress(target.routeKey, target.biomeKey),
          candidate.source,
        ),
      ) ===
        semanticAddressKey(
          createExitDecisionAddress(
            createBiomeAddress(target.routeKey, target.biomeKey),
            target.source,
          ),
        ),
  );
  if (decision?.kind === 'exit' && decision.normal.kind === 'batch') {
    const authored = decision.normal.targets.find(
      (candidate) => candidate.exitKey === target.exitKey,
    );
    if (authored !== undefined) {
      const occurrence = topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === authored.occurrenceId,
      );
      const declaration =
        occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
      if (declaration?.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
        throw new CandidateEvaluationContractError(
          `${semanticAddressKey(target)} belongs to a source-owned takeover Preboss batch`,
        );
      }
      return;
    }
  }
  if (target.source.kind !== 'occurrence') {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(target)} has no authored ordinary target domain`,
    );
  }
  const sourceOccurrenceId = target.source.occurrenceId;
  const source = topology?.occurrences.find(
    (occurrence) => occurrence.occurrenceId === sourceOccurrenceId,
  );
  const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  if (
    declaration === undefined ||
    !declaration.exits.some((exit) => `exit${exit.index}` === target.exitKey)
  ) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(target)} has no declaration-owned physical exit`,
    );
  }
}

/**
 * A takeover candidate belongs to the progression-owned source, not merely to
 * any authored exit in the same biome. Generated layouts own occurrence
 * sources; a Hub owns only its completed Hub decision. Keeping that boundary
 * here prevents consumers from advertising a command the authored-project
 * authority would reject.
 */
function assertTakeoverPrebossBatchDomain(
  catalog: Catalog,
  project: ProjectDocument,
  query: TakeoverPrebossBatchCandidateQuery,
): void {
  const plan = planFor(project, query.source.routeKey, query.source.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined) {
    throw new CandidateEvaluationContractError(`${plan.biomeKey} has no catalog layout`);
  }
  if (layout.progression.kind === 'generated' && query.source.source.kind === 'occurrence') {
    return;
  }
  if (
    layout.progression.kind === 'hub' &&
    query.source.source.kind === 'hubDecision' &&
    query.source.source.decisionKey === layout.progression.hubKey
  ) {
    return;
  }
  throw new CandidateEvaluationContractError(
    `${semanticAddressKey(query.source)} has no declaration-owned takeover Preboss candidate domain`,
  );
}

function prefixBatchRewardStoreSupport(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: BatchRewardStoreCandidateQuery,
  candidate?: CandidateBiomeEvaluation,
): BatchRewardStoreCandidateSupport | undefined {
  const biome = candidatePrefix(
    candidate ?? prefixBiome(evaluation, query.rewardStore.routeKey, query.rewardStore.biomeKey),
  );
  const prefix = biome?.materializedPrefix;
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  const decision = createExitDecisionAddress(
    createBiomeAddress(query.rewardStore.routeKey, query.rewardStore.biomeKey),
    query.rewardStore.source,
  );
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(decision)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const source = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const sourceDeclaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  const sourceHistory =
    source === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        )?.preOutgoing;
  const plan = planFor(project, query.rewardStore.routeKey, query.rewardStore.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (
    source === undefined ||
    sourceDeclaration === undefined ||
    sourceHistory === undefined ||
    layout?.progression.kind !== 'generated'
  ) {
    return undefined;
  }
  const support = rewardStoreCandidateSupport(
    layout,
    query.rewardStore,
    source,
    sourceDeclaration,
    sourceHistory,
    sourceHistory.sequence + 1,
  );
  return Object.freeze({
    ...support,
    selectedStoreKey: query.storeKey,
    selectedPossible: support.supportStoreKeys.includes(query.storeKey),
  });
}

function queryOwner(
  query: ProjectCandidateQuery,
):
  | BiomeAddress
  | OccurrenceAddress
  | BatchRewardStoreAddress
  | ExitDecisionAddress
  | HubSlotAddress
  | HubVisitAddress
  | IncomingRewardAddress
  | LocalRewardAddress
  | LocalChildAddress
  | LocalChildGroupAddress
  | RewardWheelAddress
  | RewardWheelOfferAddress
  | ShopOfferAddress
  | ShopPurchaseAddress
  | TargetAddress {
  switch (query.kind) {
    case 'startRoom':
      return query.owner;
    case 'batchRewardStore':
      return query.rewardStore;
    case 'incomingReward':
      return query.reward;
    case 'localReward':
      return query.reward;
    case 'fieldsCageOutcome':
      return query.decision;
    case 'shipEncounterCount':
      return query.occurrence;
    case 'rewardWheelOfferCount':
    case 'rewardWheelStore':
    case 'rewardWheelPicked':
      return query.wheel;
    case 'rewardWheelOffer':
      return query.offer;
    case 'shopOffer':
      return query.offer;
    case 'shopPurchase':
      return query.purchase;
    case 'roomTarget':
      return query.target;
    case 'takeoverPrebossBatch':
      return query.source;
    case 'hubSlot':
      return query.slot;
    case 'hubVisit':
      return query.visit;
    case 'sideRoomGeneration':
      return query.sideRoom;
    case 'sideRoomEntryOrder':
      return query.group;
  }
}

function planFor(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): ProjectDocument['routes'][number]['biomes'][number] {
  const route = project.routes.find((candidate) => candidate.routeKey === routeKey);
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (plan === undefined) {
    throw new CandidateEvaluationContractError(
      `project has no configured ${routeKey}/${biomeKey} candidate biome`,
    );
  }
  return plan;
}

function evaluateStartRoom(
  catalog: Catalog,
  project: ProjectDocument,
  query: StartRoomCandidateQuery,
): EvaluatedStartRoomCandidate {
  const plan = planFor(project, query.owner.routeKey, query.owner.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined) {
    throw new CandidateEvaluationContractError(`${plan.biomeKey} has no catalog layout`);
  }
  if (
    query.owner.kind === 'occurrence' &&
    plan.topology?.startOccurrenceId !== query.owner.occurrenceId
  ) {
    throw new CandidateEvaluationContractError('start-room owner is not the topology start');
  }
  const supportedGameNames =
    layout.start.kind === 'authoredChoice'
      ? layout.start.roomGameNames
      : Object.freeze([layout.start.roomGameName]);
  return Object.freeze({
    kind: 'startRoom',
    result: Object.freeze({
      gameName: query.gameName,
      supportedGameNames,
      selectedPossible: supportedGameNames.includes(query.gameName),
    }),
  });
}

function evaluateBatchRewardStore(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: BatchRewardStoreCandidateQuery,
): ProjectCandidateEvaluation {
  const biome = candidateBiome(
    catalog,
    project,
    evaluation,
    query.rewardStore.routeKey,
    query.rewardStore.biomeKey,
  );
  if (biome === undefined) {
    const prefixSupport = prefixBatchRewardStoreSupport(catalog, project, evaluation, query);
    return prefixSupport === undefined
      ? unavailableForBiome(
          evaluation,
          query.rewardStore.routeKey,
          query.rewardStore.biomeKey,
          query.rewardStore,
          'afterTargetGeneration',
        )
      : Object.freeze({ kind: 'batchRewardStore', result: prefixSupport });
  }
  const support = biome.rewards.storeSupport.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(query.rewardStore),
  );
  if (support === undefined) {
    const prefixSupport = prefixBatchRewardStoreSupport(catalog, project, evaluation, query, biome);
    if (prefixSupport !== undefined) {
      return Object.freeze({ kind: 'batchRewardStore', result: prefixSupport });
    }
    return 'snapshot' in biome
      ? unreachableTarget(query.rewardStore)
      : unavailableForBiome(
          evaluation,
          query.rewardStore.routeKey,
          query.rewardStore.biomeKey,
          query.rewardStore,
          'afterTargetGeneration',
        );
  }
  return Object.freeze({
    kind: 'batchRewardStore',
    result: Object.freeze({
      ...support,
      selectedStoreKey: query.storeKey,
      selectedPossible: support.supportStoreKeys.includes(query.storeKey),
    }),
  });
}

function evaluateIncomingReward(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: IncomingRewardCandidateQuery,
): ProjectCandidateEvaluation {
  const biome = candidateRewards(
    catalog,
    project,
    evaluation,
    query.reward.routeKey,
    query.reward.biomeKey,
    query.reward,
  );
  if (biome == null)
    return unavailableForBiome(
      evaluation,
      query.reward.routeKey,
      query.reward.biomeKey,
      query.reward,
      'afterTargetGeneration',
    );
  const frontier = rewardProducerFrontier(biome.rewards, query.reward);
  if (frontier === undefined) return producerUnavailable(query.reward);
  return Object.freeze({
    kind: 'incomingReward',
    result: frontier.evaluateOffer(query.reward, query.value),
  });
}

function candidateRewards(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  rewardOwner?: SemanticAddress,
) {
  const biome = candidateBiome(catalog, project, evaluation, routeKey, biomeKey);
  const repair =
    rewardOwner === undefined || !('routeKey' in rewardOwner) || !('biomeKey' in rewardOwner)
      ? undefined
      : repairProgressiveBiomeForOwner(catalog, project, evaluation, rewardOwner);
  if (
    repair !== undefined &&
    rewardOwner !== undefined &&
    rewardProducerFrontier(repair.rewards, rewardOwner) !== undefined
  ) {
    /**
     * The first invalid producer remains a repair boundary. Its complete
     * or incomplete pre-clamp evaluation captured the same seed-backed
     * pre-producer frontier; every later owner remains unavailable through
     * the progressive clamp.
     */
    return repair;
  }
  return biome;
}

/**
 * Room-lifecycle controls consume a context captured before their room's
 * lifecycle, rather than a reward-producer frontier. The exact blocked owner
 * may therefore use its pre-clamp reward product even when it is a shop
 * purchase or an occurrence-owned lifecycle control.
 */
function candidateRewardsForLifecycleOwner(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  owner: LifecycleRepairOwner,
) {
  return (
    repairProgressiveBiomeForOwner(catalog, project, evaluation, owner, (blockedOwner) =>
      lifecycleRepairOwnerMatches(owner, blockedOwner),
    ) ??
    completeLifecycleRepairForOwner(evaluation, owner) ??
    candidateBiome(catalog, project, evaluation, owner.routeKey, owner.biomeKey)
  );
}

function evaluateLocalReward(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: LocalRewardCandidateQuery,
): ProjectCandidateEvaluation {
  const biome = candidateRewards(
    catalog,
    project,
    evaluation,
    query.reward.routeKey,
    query.reward.biomeKey,
    query.reward,
  );
  if (biome == null) {
    return unavailableForBiome(
      evaluation,
      query.reward.routeKey,
      query.reward.biomeKey,
      query.reward,
      'afterTargetGeneration',
    );
  }
  const frontier = rewardProducerFrontier(biome.rewards, query.reward);
  if (frontier === undefined) return producerUnavailable(query.reward);
  return Object.freeze({
    kind: 'localReward',
    result: frontier.evaluateOffer(query.reward, query.value),
  });
}

function fieldsOutcomeSupport(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: FieldsCageOutcomeCandidateQuery,
) {
  const biome = candidateBiome(
    catalog,
    project,
    evaluation,
    query.decision.routeKey,
    query.decision.biomeKey,
  );
  const selected = biome?.roomGeneration.ordinary.fieldsCageOutcomes.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(query.decision),
  );
  if (selected !== undefined) return selected;
  const prefix = candidatePrefix(biome);
  if (prefix?.materializedPrefix.frontier?.kind !== 'exitDecision') return undefined;
  if (
    semanticAddressKey(prefix.materializedPrefix.frontier.origin) !==
    semanticAddressKey(query.decision)
  ) {
    return undefined;
  }
  const parent = prefix.materializedPrefix.frontier.parent;
  if (parent.origin.kind !== 'occurrence') return undefined;
  const room = prefixAuthoredRooms(prefix.materializedPrefix).find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(parent.origin),
  );
  const history =
    room === undefined
      ? undefined
      : prefix.history.rooms.find(
          (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
        )?.preOutgoing;
  const layout =
    catalog.biomeLayouts.byKey[
      planFor(project, query.decision.routeKey, query.decision.biomeKey).biomeKey
    ];
  if (
    room === undefined ||
    history === undefined ||
    layout?.progression.kind !== 'generated' ||
    layout.progression.batchPolicy.kind !== 'fields'
  ) {
    return undefined;
  }
  return fieldsCageOutcomeCandidateSupport(layout.progression.batchPolicy, query.decision, history);
}

function evaluateFieldsCageOutcome(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: FieldsCageOutcomeCandidateQuery,
): ProjectCandidateEvaluation {
  const support = fieldsOutcomeSupport(catalog, project, evaluation, query);
  if (support === undefined) {
    return unavailableForBiome(
      evaluation,
      query.decision.routeKey,
      query.decision.biomeKey,
      query.decision,
      'afterTargetGeneration',
    );
  }
  const selectedPossible = support.supportOutcomes.includes(query.cageOutcome);
  const findings = selectedPossible
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({
          code: 'fieldsCageOutcomeUnavailable' as const,
          severity: 'error' as const,
          phase: 'roomGeneration' as const,
          origin: query.decision,
          evidence: Object.freeze({
            beforeSequence: support.beforeSequence,
            biomeDepthCache: support.biomeDepthCache,
            fieldsMaxDoorsRolled: support.fieldsMaxDoorsRolled,
            maxDoorCageCeiling: support.maxDoorCageCeiling,
            selectedOutcome: query.cageOutcome,
            supportOutcomes: support.supportOutcomes,
          }),
        }),
      ]);
  return Object.freeze({
    kind: 'fieldsCageOutcome',
    result: Object.freeze({
      cageOutcome: query.cageOutcome,
      supportOutcomes: support.supportOutcomes,
      selectedPossible,
      findings,
    }),
  });
}

function shipState(catalog: Catalog, project: ProjectDocument, occurrence: OccurrenceAddress) {
  const plan = planFor(project, occurrence.routeKey, occurrence.biomeKey);
  const authored = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
  );
  if (authored?.state.kind !== 'shipCombat') {
    throw new CandidateEvaluationContractError('candidate owner has no Ship combat state');
  }
  const room = catalog.rooms.byKey[authored.gameName];
  const profile =
    room === undefined ? undefined : catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (room === undefined || profile === undefined) {
    throw new CandidateEvaluationContractError(
      'Ship candidate owner has no catalog encounter profile',
    );
  }
  return Object.freeze({ authored, room, profile, state: authored.state });
}

function wheelState(
  catalog: Catalog,
  project: ProjectDocument,
  address: RewardWheelAddress | RewardWheelOfferAddress,
) {
  const owner = createOccurrenceAddress(
    createBiomeAddress(address.routeKey, address.biomeKey),
    address.occurrenceId,
  );
  const ship = shipState(catalog, project, owner);
  const descriptor = ship.profile.phases.find(
    (phase) => phase.offerPoint?.key === address.wheelKey,
  )?.offerPoint;
  const wheel = ship.state.wheels[address.wheelKey];
  if (descriptor === undefined || wheel === undefined) {
    throw new CandidateEvaluationContractError(`Ship candidate has no ${address.wheelKey} wheel`);
  }
  if (address.kind === 'rewardWheelOffer' && !descriptor.offerKeys.includes(address.offerKey)) {
    throw new CandidateEvaluationContractError(
      `${address.wheelKey} has no ${address.offerKey} reward-wheel offer`,
    );
  }
  return Object.freeze({ owner, ship, descriptor, wheel });
}

function replaceWheel(
  state: ShipCombatState,
  wheelKey: string,
  wheel: RewardWheelState,
): ShipCombatState {
  return Object.freeze({
    ...state,
    wheels: Object.freeze({ ...state.wheels, [wheelKey]: Object.freeze(wheel) }),
  });
}

function lifecycleFindings(
  findings: readonly SemanticFinding[],
  owner: OccurrenceAddress | RewardWheelAddress,
): readonly SemanticFinding[] {
  return Object.freeze(
    findings.filter(
      (finding) =>
        semanticAddressKey(finding.origin) === semanticAddressKey(owner) ||
        ('occurrenceId' in finding.origin &&
          finding.origin.occurrenceId === owner.occurrenceId &&
          finding.origin.routeKey === owner.routeKey &&
          finding.origin.biomeKey === owner.biomeKey),
    ),
  );
}

function shipLifecycleContext(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  occurrence: OccurrenceAddress,
  repairOwner: LifecycleRepairOwner = occurrence,
) {
  const biome = candidateRewardsForLifecycleOwner(catalog, project, evaluation, repairOwner);
  if (biome == null) return undefined;
  const context = roomLifecycleCandidateContexts(biome.rewards).shipsByOwner.get(
    semanticAddressKey(occurrence),
  );
  return context === undefined ? undefined : Object.freeze({ biome, context });
}

function evaluateShipEncounterCount(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: ShipEncounterCountCandidateQuery,
): ProjectCandidateEvaluation {
  const prepared = shipLifecycleContext(catalog, project, evaluation, query.occurrence);
  if (prepared === undefined) {
    return unavailableForBiome(
      evaluation,
      query.occurrence.routeKey,
      query.occurrence.biomeKey,
      query.occurrence,
      'afterRoomLifecycle',
    );
  }
  const ship = shipState(catalog, project, query.occurrence);
  const support = prepared.biome.roomGeneration.ordinary.encounterCounts.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(query.occurrence),
  );
  if (support === undefined)
    return coverageUnavailable(evaluation, query.occurrence, 'afterTargetGeneration');
  const structurallyPossible = support.supportEncounterCounts.includes(query.encounterCount);
  const lifecycle = structurallyPossible
    ? prepared.context.evaluateState(
        Object.freeze({ ...ship.state, encounterCount: query.encounterCount }),
      )
    : undefined;
  const findings = Object.freeze([
    ...(structurallyPossible
      ? []
      : [
          Object.freeze({
            code: 'encounterCountUnavailable' as const,
            severity: 'error' as const,
            phase: 'roomGeneration' as const,
            origin: query.occurrence,
            evidence: Object.freeze({
              beforeSequence: support.beforeSequence,
              selectedEncounterCount: query.encounterCount,
              supportEncounterCounts: support.supportEncounterCounts,
            }),
          }),
        ]),
    ...(lifecycle === undefined ? [] : lifecycleFindings(lifecycle.findings, query.occurrence)),
  ]);
  return Object.freeze({
    kind: 'shipEncounterCount',
    result: Object.freeze({
      encounterCount: query.encounterCount,
      supportEncounterCounts: support.supportEncounterCounts,
      selectedPossible:
        structurallyPossible && lifecycle?.supported === true && findings.length === 0,
      findings,
    }),
  });
}

function evaluateWheelLifecycle(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query:
    | RewardWheelOfferCountCandidateQuery
    | RewardWheelStoreCandidateQuery
    | RewardWheelPickedCandidateQuery,
): ProjectCandidateEvaluation {
  const { owner, ship, descriptor, wheel } = wheelState(catalog, project, query.wheel);
  const prepared = shipLifecycleContext(catalog, project, evaluation, owner, query.wheel);
  if (prepared === undefined) {
    return unavailableForBiome(
      evaluation,
      query.wheel.routeKey,
      query.wheel.biomeKey,
      query.wheel,
      'afterRoomLifecycle',
    );
  }
  if (!prepared.context.activeWheelKeys.includes(query.wheel.wheelKey)) {
    return coverageUnavailable(evaluation, query.wheel, 'afterRoomLifecycle');
  }
  if (
    query.kind === 'rewardWheelOfferCount' &&
    (!Number.isInteger(query.offerCount) ||
      query.offerCount < descriptor.offerCount.min ||
      query.offerCount > descriptor.offerCount.max)
  ) {
    throw new CandidateEvaluationContractError(
      `offerCount must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
    );
  }
  if (query.kind === 'rewardWheelStore' && !descriptor.reward.storeKeys.includes(query.storeKey)) {
    throw new CandidateEvaluationContractError(
      `${query.storeKey} is not available from ${query.wheel.wheelKey}`,
    );
  }
  if (
    query.kind === 'rewardWheelPicked' &&
    (!Number.isInteger(query.pickedOfferIndex) ||
      query.pickedOfferIndex < 1 ||
      query.pickedOfferIndex > wheel.offerCount)
  ) {
    throw new CandidateEvaluationContractError('pickedOfferIndex must address an active offer');
  }
  const replacement =
    query.kind === 'rewardWheelOfferCount'
      ? Object.freeze({
          ...wheel,
          offerCount: query.offerCount,
          pickedOfferIndex: Math.min(wheel.pickedOfferIndex, query.offerCount),
        })
      : query.kind === 'rewardWheelStore'
        ? Object.freeze({ ...wheel, storeKey: query.storeKey })
        : Object.freeze({ ...wheel, pickedOfferIndex: query.pickedOfferIndex });
  const result = prepared.context.evaluateState(
    replaceWheel(ship.state, query.wheel.wheelKey, replacement),
  );
  const findings = lifecycleFindings(result.findings, query.wheel);
  const selectedPossible = result.supported && findings.length === 0;
  if (query.kind === 'rewardWheelOfferCount') {
    return Object.freeze({
      kind: 'rewardWheelOfferCount',
      result: Object.freeze({
        offerCount: query.offerCount,
        minimumOfferCount: descriptor.offerCount.min,
        maximumOfferCount: descriptor.offerCount.max,
        selectedPossible,
        findings,
      }),
    });
  }
  if (query.kind === 'rewardWheelStore') {
    return Object.freeze({
      kind: 'rewardWheelStore',
      result: Object.freeze({
        storeKey: query.storeKey,
        supportedStoreKeys: descriptor.reward.storeKeys,
        selectedPossible,
        findings,
      }),
    });
  }
  return Object.freeze({
    kind: 'rewardWheelPicked',
    result: Object.freeze({ pickedOfferIndex: query.pickedOfferIndex, selectedPossible, findings }),
  });
}

function evaluateRewardWheelOffer(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: RewardWheelOfferCandidateQuery,
): ProjectCandidateEvaluation {
  wheelState(catalog, project, query.offer);
  const biome = candidateRewards(
    catalog,
    project,
    evaluation,
    query.offer.routeKey,
    query.offer.biomeKey,
    query.offer,
  );
  if (biome == null) {
    return unavailableForBiome(
      evaluation,
      query.offer.routeKey,
      query.offer.biomeKey,
      query.offer,
      'afterRoomLifecycle',
    );
  }
  const frontier = rewardProducerFrontier(biome.rewards, query.offer);
  if (frontier === undefined) return producerUnavailable(query.offer);
  return Object.freeze({
    kind: 'rewardWheelOffer',
    result: frontier.evaluateOffer(query.offer, query.value),
  });
}

function evaluateShopOffer(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: ShopOfferCandidateQuery,
): ProjectCandidateEvaluation {
  const biome = candidateRewards(
    catalog,
    project,
    evaluation,
    query.offer.routeKey,
    query.offer.biomeKey,
    query.offer,
  );
  if (biome == null)
    return unavailableForBiome(
      evaluation,
      query.offer.routeKey,
      query.offer.biomeKey,
      query.offer,
      'afterRoomLifecycle',
    );
  const frontier = rewardProducerFrontier(biome.rewards, query.offer);
  if (frontier === undefined) return producerUnavailable(query.offer);
  return Object.freeze({
    kind: 'shopOffer',
    result: frontier.evaluateOffer(query.offer, query.value),
  });
}

function evaluateShopPurchase(
  catalog: Catalog,
  evaluation: ProjectEvaluation,
  project: ProjectDocument,
  query: ShopPurchaseCandidateQuery,
): ProjectCandidateEvaluation {
  const biome = candidateRewardsForLifecycleOwner(catalog, project, evaluation, query.purchase);
  if (biome == null)
    return unavailableForBiome(
      evaluation,
      query.purchase.routeKey,
      query.purchase.biomeKey,
      query.purchase,
      'afterRoomLifecycle',
    );
  const plan = planFor(project, query.purchase.routeKey, query.purchase.biomeKey);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === query.purchase.occurrenceId,
  );
  if (occurrence?.state.kind !== 'shop' || occurrence.state.shop === undefined) {
    throw new CandidateEvaluationContractError(
      'shop-purchase owner has no materialized shop state',
    );
  }
  const existing = occurrence.state.shop.offers[query.purchase.offerKey];
  if (existing === undefined) {
    throw new CandidateEvaluationContractError('shop-purchase owner has no declared shop offer');
  }
  const owner = createOccurrenceAddress(
    createBiomeAddress(query.purchase.routeKey, query.purchase.biomeKey),
    query.purchase.occurrenceId,
  );
  const context = roomLifecycleCandidateContexts(biome.rewards).shopsByOwner.get(
    semanticAddressKey(owner),
  );
  if (context === undefined) return producerUnavailable(query.purchase);
  return Object.freeze({
    kind: 'shopPurchase',
    result: context.evaluateState(
      Object.freeze({
        ...occurrence.state.shop,
        offers: Object.freeze({
          ...occurrence.state.shop.offers,
          [query.purchase.offerKey]: Object.freeze({ ...existing, purchased: query.purchased }),
        }),
      }),
    ),
  });
}

function evaluateHubSlot(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: HubSlotCandidateQuery,
): ProjectCandidateEvaluation {
  if (typeof query.open !== 'boolean') {
    throw new CandidateEvaluationContractError('Hub slot candidate open must be a boolean');
  }
  const state = candidateHubState(
    catalog,
    project,
    query.slot.routeKey,
    query.slot.biomeKey,
    query.slot.hubKey,
  );
  if (state === undefined) {
    return unavailableForBiome(
      evaluation,
      query.slot.routeKey,
      query.slot.biomeKey,
      query.slot,
      'afterTargetGeneration',
    );
  }
  if (!state.descriptor.slots.some((slot) => slot.slotKey === query.slot.hubSlotKey)) {
    throw new CandidateEvaluationContractError(`unknown Hub slot ${query.slot.hubSlotKey}`);
  }
  const current = state.decision.openTargets.find(
    (target) => target.hubSlotKey === query.slot.hubSlotKey,
  );
  const closesReferencedSlot =
    !query.open &&
    current !== undefined &&
    state.decision.visitOrder.includes(query.slot.hubSlotKey);
  if (query.open && current === undefined) {
    if (typeof query.occurrenceId !== 'string' || query.occurrenceId.trim().length === 0) {
      throw new CandidateEvaluationContractError(
        'Hub slot candidate occurrenceId must be non-blank',
      );
    }
    if (
      state.topology.occurrences.some(
        (occurrence) => occurrence.occurrenceId === query.occurrenceId,
      )
    ) {
      throw new CandidateEvaluationContractError(
        `Hub slot candidate occurrence ${query.occurrenceId} already exists`,
      );
    }
  }
  const findings = hubCandidateFindings(query, state);
  const openSlotKeys = Object.freeze(
    state.descriptor.slots.flatMap((slot) =>
      state.decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey)
        ? [slot.slotKey]
        : [],
    ),
  );
  return Object.freeze({
    kind: 'hubSlot',
    result: Object.freeze({
      candidateOpen: query.open,
      currentlyOpen: current !== undefined,
      openSlotKeys,
      minimumOpenCount: state.descriptor.openCount.min,
      maximumOpenCount: state.descriptor.openCount.max,
      referencedVisitIndexes: Object.freeze(
        state.decision.visitOrder.flatMap((slotKey, index) =>
          slotKey === query.slot.hubSlotKey ? [index + 1] : [],
        ),
      ),
      findings,
      selectedPossible: !closesReferencedSlot && findings.length === 0,
    }),
  });
}

function evaluateHubVisit(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: HubVisitCandidateQuery,
): ProjectCandidateEvaluation {
  if (!progressiveHubVisitReached(catalog, project, evaluation, query.visit)) {
    return coverageUnavailable(evaluation, query.visit, 'afterTargetGeneration');
  }
  const state = candidateHubState(
    catalog,
    project,
    query.visit.routeKey,
    query.visit.biomeKey,
    query.visit.hubKey,
  );
  if (state === undefined) {
    return unavailableForBiome(
      evaluation,
      query.visit.routeKey,
      query.visit.biomeKey,
      query.visit,
      'afterTargetGeneration',
    );
  }
  if (!state.descriptor.slots.some((slot) => slot.slotKey === query.hubSlotKey)) {
    throw new CandidateEvaluationContractError(`unknown Hub slot ${query.hubSlotKey}`);
  }
  if (query.visit.visitIndex > state.descriptor.requiredVisits) {
    throw new CandidateEvaluationContractError(
      `Hub visit ${query.visit.visitIndex} exceeds ${state.descriptor.requiredVisits} visits`,
    );
  }
  const visitIndex = query.visit.visitIndex - 1;
  const currentHubSlotKey = state.decision.visitOrder[visitIndex];
  if (
    currentHubSlotKey === undefined &&
    query.visit.visitIndex !== state.decision.visitOrder.length + 1
  ) {
    return unreachableTarget(query.visit);
  }
  const openHubSlotKeys = Object.freeze(
    state.descriptor.slots.flatMap((slot) =>
      state.decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey)
        ? [slot.slotKey]
        : [],
    ),
  );
  const occupiedVisitIndexes = Object.freeze(
    state.decision.visitOrder.flatMap((slotKey, index) =>
      slotKey === query.hubSlotKey ? [index + 1] : [],
    ),
  );
  const structurallyPossible =
    openHubSlotKeys.includes(query.hubSlotKey) &&
    occupiedVisitIndexes.every((index) => index === query.visit.visitIndex);
  const command =
    currentHubSlotKey === undefined
      ? ({ kind: 'AppendHubVisit', visit: query.visit, hubSlotKey: query.hubSlotKey } as const)
      : ({ kind: 'ReplaceHubVisit', visit: query.visit, hubSlotKey: query.hubSlotKey } as const);
  const proposal = structurallyPossible
    ? hubCandidateProposal(catalog, project, command)
    : undefined;
  const targetOccurrenceId = proposal?.routes
    .find((route) => route.routeKey === query.visit.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === query.visit.biomeKey)
    ?.topology?.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === query.visit.hubKey,
    )
    ?.openTargets.find((target) => target.hubSlotKey === query.hubSlotKey)?.occurrenceId;
  const regional =
    proposal === undefined || targetOccurrenceId === undefined
      ? undefined
      : hubRegionEvaluation(
          catalog,
          proposal,
          evaluation,
          query.visit.routeKey,
          query.visit.biomeKey,
          query.visit.hubKey,
          query.visit.visitIndex,
        );
  const findings = Object.freeze(
    targetOccurrenceId === undefined
      ? []
      : (regional?.findings ?? []).filter((finding) =>
          findingOwnsOccurrence(finding, targetOccurrenceId),
        ),
  );
  return Object.freeze({
    kind: 'hubVisit',
    result: Object.freeze({
      candidateHubSlotKey: query.hubSlotKey,
      openHubSlotKeys,
      occupiedVisitIndexes,
      findings,
      selectedPossible: structurallyPossible && proposal !== undefined && findings.length === 0,
    }),
  });
}

function evaluateSideRoomGeneration(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: SideRoomGenerationCandidateQuery,
): ProjectCandidateEvaluation {
  const localGroup: LocalChildGroupAddress = Object.freeze({
    kind: 'localChildGroup',
    routeKey: query.sideRoom.routeKey,
    biomeKey: query.sideRoom.biomeKey,
    occurrenceId: query.sideRoom.occurrenceId,
    groupKey: query.sideRoom.groupKey,
  });
  const repair = repairProgressiveBiomeForOwner(catalog, project, evaluation, query.sideRoom);
  if (
    !progressiveHubLocalGroupReached(catalog, project, evaluation, localGroup) &&
    repair === undefined
  ) {
    return coverageUnavailable(evaluation, query.sideRoom, 'afterTargetGeneration');
  }
  const plan = planFor(project, query.sideRoom.routeKey, query.sideRoom.biomeKey);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === query.sideRoom.occurrenceId,
  );
  if (occurrence?.state.kind !== 'ephyraCombat') {
    return unavailableForBiome(
      evaluation,
      query.sideRoom.routeKey,
      query.sideRoom.biomeKey,
      query.sideRoom,
      'afterTargetGeneration',
    );
  }
  const room = catalog.rooms.byKey[occurrence.gameName];
  const group = room?.localChildren.find((candidate) => candidate.key === query.sideRoom.groupKey);
  const sideState = occurrence.state;
  const sideRoom = sideState.sideRooms[query.sideRoom.slotKey];
  if (group?.kind !== 'fixedRoomSlots' || sideRoom === undefined) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.sideRoom)} has no declared Ephyra side-room state`,
    );
  }
  if (query.generation !== 'generated' && query.generation !== 'notGenerated') {
    throw new CandidateEvaluationContractError(
      `unknown side-room generation ${String(query.generation)}`,
    );
  }
  const baseline = hubSideSupport(
    catalog,
    project,
    evaluation,
    query.sideRoom.routeKey,
    query.sideRoom.biomeKey,
    query.sideRoom,
  );
  if (baseline === undefined) {
    return coverageUnavailable(evaluation, query.sideRoom, 'afterTargetGeneration');
  }
  const structurallyPossible = query.generation === 'generated' || sideRoom.enteredOrdinal === null;
  const proposal =
    structurallyPossible && sideRoom.generation !== query.generation
      ? hubCandidateProposal(catalog, project, {
          kind: 'ReplaceSideRoomGeneration',
          sideRoom: query.sideRoom,
          generation: query.generation,
        })
      : structurallyPossible
        ? project
        : undefined;
  const regional =
    proposal === undefined
      ? undefined
      : (() => {
          const descriptor = catalog.biomeLayouts.byKey[plan.biomeKey]?.progression;
          if (descriptor?.kind !== 'hub') {
            throw new CandidateEvaluationContractError(
              `${plan.biomeKey} has no Hub candidate domain`,
            );
          }
          return hubRegionEvaluation(
            catalog,
            proposal,
            evaluation,
            query.sideRoom.routeKey,
            query.sideRoom.biomeKey,
            descriptor.hubKey,
            baseline.visitIndex,
          );
        })();
  const findings = Object.freeze(
    (regional?.findings ?? []).filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(query.sideRoom),
    ),
  );
  return Object.freeze({
    kind: 'sideRoomGeneration',
    result: Object.freeze({
      candidateGeneration: query.generation,
      enteredOrdinal: sideRoom.enteredOrdinal,
      generatedBefore: baseline.generatedBefore,
      requiredGeneratedCount: baseline.requiredGeneratedCount,
      supportOutcomes: baseline.supportOutcomes,
      findings,
      selectedPossible:
        structurallyPossible &&
        baseline.supportOutcomes.includes(query.generation) &&
        findings.length === 0,
    }),
  });
}

function evaluateSideRoomEntryOrder(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: SideRoomEntryOrderCandidateQuery,
): ProjectCandidateEvaluation {
  if (!progressiveHubLocalGroupReached(catalog, project, evaluation, query.group)) {
    return coverageUnavailable(evaluation, query.group, 'afterRoomLifecycle');
  }
  const plan = planFor(project, query.group.routeKey, query.group.biomeKey);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === query.group.occurrenceId,
  );
  if (occurrence?.state.kind !== 'ephyraCombat') {
    return unavailableForBiome(
      evaluation,
      query.group.routeKey,
      query.group.biomeKey,
      query.group,
      'afterRoomLifecycle',
    );
  }
  const sideState = occurrence.state;
  const room = catalog.rooms.byKey[occurrence.gameName];
  const group = room?.localChildren.find((candidate) => candidate.key === query.group.groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.group)} has no declared Ephyra side-room group`,
    );
  }
  if (new Set(query.enteredSlotKeys).size !== query.enteredSlotKeys.length) {
    throw new CandidateEvaluationContractError('side-room entry order must contain distinct slots');
  }
  const generatedSlotKeys = Object.freeze(
    group.slots.flatMap((slot) =>
      sideState.sideRooms[slot.slotKey]?.generation === 'generated' ? [slot.slotKey] : [],
    ),
  );
  let includesUngeneratedSlot = false;
  for (const slotKey of query.enteredSlotKeys) {
    if (!group.slots.some((slot) => slot.slotKey === slotKey)) {
      throw new CandidateEvaluationContractError(`unknown side-room slot ${slotKey}`);
    }
    if (sideState.sideRooms[slotKey]?.generation !== 'generated') {
      includesUngeneratedSlot = true;
    }
  }
  if (includesUngeneratedSlot) {
    return Object.freeze({
      kind: 'sideRoomEntryOrder',
      result: Object.freeze({
        candidateEnteredSlotKeys: Object.freeze([...query.enteredSlotKeys]),
        generatedSlotKeys,
        findings: Object.freeze([]),
        selectedPossible: false,
      }),
    });
  }
  const descriptor = catalog.biomeLayouts.byKey[plan.biomeKey]?.progression;
  if (descriptor?.kind !== 'hub') {
    throw new CandidateEvaluationContractError(`${plan.biomeKey} has no Hub candidate domain`);
  }
  const hub = candidateHubState(
    catalog,
    project,
    query.group.routeKey,
    query.group.biomeKey,
    descriptor.hubKey,
  );
  const hubSlotKey = hub?.decision.openTargets.find(
    (target) => target.occurrenceId === query.group.occurrenceId,
  )?.hubSlotKey;
  const visitIndex =
    hubSlotKey === undefined ? undefined : (hub?.decision.visitOrder.indexOf(hubSlotKey) ?? -1);
  if (hub === undefined || visitIndex === undefined || visitIndex < 0) {
    return coverageUnavailable(evaluation, query.group, 'afterRoomLifecycle');
  }
  const proposal = hubCandidateProposal(catalog, project, {
    kind: 'ReplaceSideRoomEntryOrder',
    group: query.group,
    enteredSlotKeys: query.enteredSlotKeys,
  });
  const regional =
    proposal === undefined
      ? undefined
      : hubRegionEvaluation(
          catalog,
          proposal,
          evaluation,
          query.group.routeKey,
          query.group.biomeKey,
          hub.descriptor.hubKey,
          visitIndex + 1,
        );
  const findings = Object.freeze(
    (regional?.findings ?? []).filter((finding) => findingOwnsLocalGroup(finding, query.group)),
  );
  return Object.freeze({
    kind: 'sideRoomEntryOrder',
    result: Object.freeze({
      candidateEnteredSlotKeys: Object.freeze([...query.enteredSlotKeys]),
      generatedSlotKeys,
      findings,
      selectedPossible: proposal !== undefined && findings.length === 0,
    }),
  });
}

export function createPreparedProjectCandidateSession(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation = simulateProject(catalog, project),
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  assertProjectEvaluationSource(project, evaluation);
  const evaluateOne = (query: ProjectCandidateQuery): ProjectCandidateEvaluation => {
    if (query.kind === 'startRoom') return evaluateStartRoom(catalog, project, query);
    if (query.kind === 'hubSlot') return evaluateHubSlot(catalog, project, evaluation, query);
    if (query.kind === 'hubVisit') return evaluateHubVisit(catalog, project, evaluation, query);
    if (query.kind === 'sideRoomGeneration')
      return evaluateSideRoomGeneration(catalog, project, evaluation, query);
    if (query.kind === 'sideRoomEntryOrder')
      return evaluateSideRoomEntryOrder(catalog, project, evaluation, query);
    if (query.kind === 'batchRewardStore')
      return evaluateBatchRewardStore(catalog, project, evaluation, query);
    if (query.kind === 'incomingReward')
      return evaluateIncomingReward(catalog, project, evaluation, query);
    if (query.kind === 'localReward')
      return evaluateLocalReward(catalog, project, evaluation, query);
    if (query.kind === 'fieldsCageOutcome')
      return evaluateFieldsCageOutcome(catalog, project, evaluation, query);
    if (query.kind === 'shipEncounterCount')
      return evaluateShipEncounterCount(catalog, project, evaluation, query);
    if (
      query.kind === 'rewardWheelOfferCount' ||
      query.kind === 'rewardWheelStore' ||
      query.kind === 'rewardWheelPicked'
    ) {
      return evaluateWheelLifecycle(catalog, project, evaluation, query);
    }
    if (query.kind === 'rewardWheelOffer')
      return evaluateRewardWheelOffer(catalog, project, evaluation, query);
    if (query.kind === 'shopOffer') return evaluateShopOffer(catalog, project, evaluation, query);
    if (query.kind === 'shopPurchase')
      return evaluateShopPurchase(catalog, evaluation, project, query);
    const owner = queryOwner(query);
    const biome = completeBiome(evaluation, owner.routeKey, owner.biomeKey);
    if (query.kind === 'roomTarget') {
      assertRoomTargetDomain(catalog, project, query.target);
      if (biome?.validity === 'invalid') {
        return (
          evaluateInvalidCompleteRoomTarget(catalog, project, evaluation, biome, query) ??
          coverageUnavailable(evaluation, query.target, 'afterTargetGeneration')
        );
      }
      if (biome === undefined) {
        if (
          unresolvedBatchRewardStore(
            project,
            query.target.routeKey,
            query.target.biomeKey,
            query.target.source,
          )
        ) {
          return unavailable({
            kind: 'authoredPrerequisiteMissing',
            prerequisite: Object.freeze({
              kind: 'batchRewardStore',
              owner: createBatchRewardStoreAddress(
                createBiomeAddress(query.target.routeKey, query.target.biomeKey),
                query.target.source,
              ),
            }),
          });
        }
        const prefix = evaluatePrefixRoomTarget(catalog, project, evaluation, query);
        if (prefix !== undefined) return prefix;
        return unavailableForBiome(
          evaluation,
          query.target.routeKey,
          query.target.biomeKey,
          query.target,
          'afterTargetGeneration',
        );
      }
      const context = roomTargetCandidateContexts(biome.roomGeneration.ordinary).get(
        semanticAddressKey(query.target),
      );
      if (context === undefined) return unreachableTarget(query.target);
      return Object.freeze({
        kind: 'roomTarget' as const,
        result: context.evaluateGameName(query.gameName),
      });
    }
    assertTakeoverPrebossBatchDomain(catalog, project, query);
    const candidate = candidateBiome(
      catalog,
      project,
      evaluation,
      query.source.routeKey,
      query.source.biomeKey,
    );
    if (candidate === undefined || !('snapshot' in candidate)) {
      return (
        evaluatePrefixTakeover(catalog, evaluation, query, candidate) ??
        unavailableForBiome(
          evaluation,
          query.source.routeKey,
          query.source.biomeKey,
          query.source,
          'afterTargetGeneration',
        )
      );
    }
    return Object.freeze({
      kind: 'takeoverPrebossBatch' as const,
      result: evaluateTakeoverPrebossBatchCandidate(
        catalog,
        candidate.snapshot,
        candidate.history,
        query.source,
        query.gameName,
        completeBiomeCount(evaluation, query.source.routeKey, query.source.biomeKey),
      ),
    });
  };
  function evaluate(query: ProjectCandidateQuery): ProjectCandidateEvaluation;
  function evaluate(
    queries: readonly ProjectCandidateQuery[],
  ): readonly ProjectCandidateEvaluation[];
  function evaluate(
    queryOrQueries: ProjectCandidateQuery | readonly ProjectCandidateQuery[],
  ): ProjectCandidateEvaluation | readonly ProjectCandidateEvaluation[] {
    if (!Array.isArray(queryOrQueries)) {
      return evaluateOne(queryOrQueries as ProjectCandidateQuery);
    }
    const queries = queryOrQueries as readonly ProjectCandidateQuery[];
    options.observe?.(Object.freeze({ kind: 'queryBatch', queryCount: queries.length }));
    return Object.freeze(queries.map(evaluateOne));
  }
  return Object.freeze({
    project,
    evaluation,
    evaluate,
  });
}

function completeBiomeCount(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): number {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const index = route?.biomes.findIndex((candidate) => candidate.biomeKey === biomeKey) ?? -1;
  return index + 1;
}
