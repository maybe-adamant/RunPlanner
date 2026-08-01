import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createHubOpenSetAddress,
  createOccurrenceAddress,
  semanticAddressKey,
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
} from '../../authored-project/addresses';
import {
  applyProjectCommand,
  ProjectCommandContractError,
} from '../../authored-project/commands/dispatch';
import type {
  HubDecision,
  OccurrenceId,
  ProjectDocument,
  RewardWheelState,
  ShipCombatState,
} from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import {
  evaluateHubOpenSetConstraints,
  type HubSideRoomGenerationSupportEntry,
} from '../generation';
import type { CanonicalHubDecision } from '../materialization';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  type CompleteBiomeProjectEvaluation,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '../project';
import {
  evaluateProgressiveBiome,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
  type ProgressiveBiomeEvaluation,
} from '../progressive/biome';
import type { SemanticFinding } from '../model';
import {
  rewardProducerFrontier,
  roomLifecycleCandidateContexts,
  type RoomLifecycleCandidateResult,
  type RewardProducerCandidateResult,
} from '../rewards';
import {
  coverageUnavailable,
  producerUnavailable,
  unavailableForBiome,
  unreachableTarget,
  type CandidateContextUnavailable,
} from './availability';
import {
  candidateBiome,
  candidateBlockedAt,
  completeBiome,
  completeBiomeCount,
  planFor,
  progressiveSeed,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';
import {
  evaluateBatchRewardStoreCandidate,
  type BatchRewardStoreCandidateQuery,
  type EvaluatedBatchRewardStoreCandidate,
} from './batch-reward-store';
import {
  evaluateFieldsCageOutcomeCandidate,
  type EvaluatedFieldsCageOutcomeCandidate,
  type FieldsCageOutcomeCandidateQuery,
} from './fields-cage-outcome';
import {
  evaluateRoomTargetCandidate,
  type EvaluatedRoomTargetCandidate,
  type RoomTargetCandidateQuery,
} from './room-target';
import {
  evaluateStartRoomCandidate,
  type EvaluatedStartRoomCandidate,
  type StartRoomCandidateQuery,
} from './start-room';
import {
  evaluateTakeoverPrebossBatch,
  type EvaluatedTakeoverPrebossBatchCandidate,
  type TakeoverPrebossBatchCandidateQuery,
} from './takeover-preboss';

export { CandidateEvaluationContractError } from './contract';
export type {
  CandidateAuthoredPrerequisite,
  CandidateContextUnavailable,
  CandidateContextUnavailableEvidence,
  CandidateContextUnavailableReason,
} from './availability';
export type { EvaluatedRoomTargetCandidate, RoomTargetCandidateQuery } from './room-target';
export type {
  BatchRewardStoreCandidateQuery,
  BatchRewardStoreCandidateSupport,
  EvaluatedBatchRewardStoreCandidate,
} from './batch-reward-store';
export type {
  EvaluatedFieldsCageOutcomeCandidate,
  FieldsCageOutcomeCandidateQuery,
  FieldsCageOutcomeCandidateSupport,
} from './fields-cage-outcome';
export type {
  EvaluatedStartRoomCandidate,
  StartRoomCandidateQuery,
  StartRoomCandidateSupport,
} from './start-room';
export type {
  EvaluatedTakeoverPrebossBatchCandidate,
  TakeoverPrebossBatchCandidateQuery,
} from './takeover-preboss';
import { CandidateEvaluationContractError } from './contract';

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

export type CandidateEvaluationEvent = {
  readonly kind: 'queryBatch';
  readonly queryCount: number;
};

export interface ProjectCandidateSessionOptions {
  readonly observe?: (event: CandidateEvaluationEvent) => void;
}

export interface EvaluatedIncomingRewardCandidate {
  readonly kind: 'incomingReward';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedLocalRewardCandidate {
  readonly kind: 'localReward';
  readonly result: RewardProducerCandidateResult;
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
  const raw = evaluateProgressiveBiomeAssemblyBeforeClamp(
    catalog,
    createBiomeAddress(owner.routeKey, owner.biomeKey),
    planFor(project, owner.routeKey, owner.biomeKey),
    completeBiomeCount(evaluation, owner.routeKey, owner.biomeKey),
    progressiveSeed(evaluation, owner.routeKey, owner.biomeKey),
  );
  return raw !== null &&
    raw.evaluation.blockedAt !== undefined &&
    matchesBlockedOwner(raw.evaluation.blockedAt)
    ? raw.evaluation
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
      // A visit may expose incomplete or invalid room-local work that the user
      // must repair next. That downstream state is feedback, not a reason to
      // reject an otherwise distinct open Hub slot from authored visit order.
      selectedPossible: structurallyPossible && proposal !== undefined,
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
  assembly: ProjectEvaluationAssembly,
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  const { project, evaluation } = assembly;
  const candidateArtifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  const evaluateOne = (query: ProjectCandidateQuery): ProjectCandidateEvaluation => {
    if (query.kind === 'startRoom') return evaluateStartRoomCandidate(catalog, project, query);
    if (query.kind === 'hubSlot') return evaluateHubSlot(catalog, project, evaluation, query);
    if (query.kind === 'hubVisit') return evaluateHubVisit(catalog, project, evaluation, query);
    if (query.kind === 'sideRoomGeneration')
      return evaluateSideRoomGeneration(catalog, project, evaluation, query);
    if (query.kind === 'sideRoomEntryOrder')
      return evaluateSideRoomEntryOrder(catalog, project, evaluation, query);
    if (query.kind === 'batchRewardStore')
      return evaluateBatchRewardStoreCandidate(catalog, project, evaluation, query);
    if (query.kind === 'incomingReward')
      return evaluateIncomingReward(catalog, project, evaluation, query);
    if (query.kind === 'localReward')
      return evaluateLocalReward(catalog, project, evaluation, query);
    if (query.kind === 'fieldsCageOutcome')
      return evaluateFieldsCageOutcomeCandidate(catalog, project, evaluation, query);
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
    if (query.kind === 'roomTarget') {
      const roomTargets = candidateArtifacts.biomeAt(
        createBiomeAddress(query.target.routeKey, query.target.biomeKey),
      )?.roomTargets;
      return evaluateRoomTargetCandidate(catalog, project, evaluation, roomTargets, query);
    }
    return evaluateTakeoverPrebossBatch(catalog, project, evaluation, query);
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
