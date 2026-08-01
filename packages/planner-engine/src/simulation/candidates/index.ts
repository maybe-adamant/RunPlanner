import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type IncomingRewardAddress,
  type LocalRewardAddress,
  type OccurrenceAddress,
  type RewardWheelAddress,
  type RewardWheelOfferAddress,
  type SemanticAddress,
  type ShopOfferAddress,
  type ShopPurchaseAddress,
} from '../../authored-project/addresses';
import type {
  ProjectDocument,
  RewardWheelState,
  ShipCombatState,
} from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  type CompleteBiomeProjectEvaluation,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '../project';
import {
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
  type CandidateContextUnavailable,
} from './availability';
import {
  candidateBiome,
  candidateBlockedAt,
  completeBiome,
  completeBiomeCount,
  planFor,
  progressiveSeed,
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
  evaluateHubSlotCandidate,
  evaluateHubVisitCandidate,
  evaluateSideRoomEntryOrderCandidate,
  evaluateSideRoomGenerationCandidate,
  type EvaluatedHubSlotCandidate,
  type EvaluatedHubVisitCandidate,
  type EvaluatedSideRoomEntryOrderCandidate,
  type EvaluatedSideRoomGenerationCandidate,
  type HubSlotCandidateQuery,
  type HubVisitCandidateQuery,
  type SideRoomEntryOrderCandidateQuery,
  type SideRoomGenerationCandidateQuery,
} from './hub';
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
  EvaluatedHubSlotCandidate,
  EvaluatedHubVisitCandidate,
  EvaluatedSideRoomEntryOrderCandidate,
  EvaluatedSideRoomGenerationCandidate,
  HubSlotCandidateQuery,
  HubSlotCandidateSupport,
  HubVisitCandidateQuery,
  HubVisitCandidateSupport,
  SideRoomEntryOrderCandidateQuery,
  SideRoomEntryOrderCandidateSupport,
  SideRoomGenerationCandidateQuery,
  SideRoomGenerationCandidateSupport,
} from './hub';
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

export function createPreparedProjectCandidateSession(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  const { project, evaluation } = assembly;
  const candidateArtifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  const evaluateOne = (query: ProjectCandidateQuery): ProjectCandidateEvaluation => {
    if (query.kind === 'startRoom') return evaluateStartRoomCandidate(catalog, project, query);
    if (query.kind === 'hubSlot')
      return evaluateHubSlotCandidate(catalog, project, evaluation, query);
    if (query.kind === 'hubVisit')
      return evaluateHubVisitCandidate(catalog, project, evaluation, query);
    if (query.kind === 'sideRoomGeneration')
      return evaluateSideRoomGenerationCandidate(catalog, project, evaluation, query);
    if (query.kind === 'sideRoomEntryOrder')
      return evaluateSideRoomEntryOrderCandidate(catalog, project, evaluation, query);
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
