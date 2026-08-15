import type { Catalog, BiomeLayout, RoomDeclaration } from '../../catalog-schema';
import {
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createBiomeAddress,
  createTraitOfferAddress,
  createEchoLastRewardAddress,
  createAcquisitionSiteAddress,
  createAcquisitionEntryAddress,
  createEchoKeepsakeReplayAddress,
  createTargetAddress,
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type AcquisitionSiteOwnerAddress,
  type ExitDecisionAddress,
  type SemanticAddress,
  type TraitOfferAddress,
  type TraitOfferOwnerAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type { RouteLoadout, ShipCombatState } from '../../authored-project/model';
import {
  createDefaultEchoLastRewardAcquisition,
  optionIndex,
  createDefaultPickupRewardState,
  materializeGorgonAthenaOffer,
  selectedPickupProducer,
} from '../../authored-project/traits';
import {
  encounterEnvelopeSlots,
  selectedEncounterDefinitionKey,
} from '../../authored-project/room-state/encounters';
import {
  type ResolvedRewardOffer,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type {
  EncounterHistoryEntry,
  BiomeHistoryPrefix,
  CanonicalBiomeHistory,
  HistoryEvent,
  HistoryStateView,
  ProgressiveRoomHistoryViews,
  RoomCreationSource,
} from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalAdditionalContinuation,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalLocalChildRoom,
  CanonicalLocalReward,
  CanonicalResolvedIncomingReward,
  CanonicalRewardWheel,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedHubVisitFrontier,
} from '../materialization';
import type { CanonicalDecision } from '../materialization/model';
import { materializeShipCombatState } from '../materialization';
import type { ResolvedEncounterPhase } from '../encounters';
import { assessFigLeafSkip } from '../encounters';
import {
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
  type HistoryFindingChronology,
} from '../finding-regions';
import type {
  RewardBranch,
  BiomeRewardSimulation,
  RewardStoreCandidateSupport,
  RewardStoreSupportEntry,
  TargetRewardHistoryCheckpoint,
} from './model';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
  createAcquisitionConversionCandidateArtifacts,
  createDerivedAcquisitionEntryCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../candidate-artifacts';
import type {
  ReachedTraitOfferEvaluation,
  ReachedLevelResolutionEvaluation,
  SelectedLevelResolutionAssessment,
  SelectedTraitOfferAssessment,
  TraitOfferCandidateContext,
} from '../traits';
import { attachTraitHistory, createTraitHistoryState, foldTraitHistoryEvents } from '../traits';
import {
  createRunState,
  publishRunStateThroughCoverage,
  type DecisionRunStateSnapshot,
} from './run-state';
import { createRewardFacts, createdPeerGameNames } from './facts';
import {
  createRoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateResult,
  type ShipLifecycleCandidateContext,
  type AcquisitionOrderCandidateContext,
} from './lifecycle-artifacts';
import {
  createRewardProducerCandidateArtifacts,
  indexRewardProducerFrontier,
  type RewardProducerCandidateArtifacts,
  type RewardProducerCandidateResult,
  type RewardProducerFrontier,
} from './producer-frontiers';
import {
  addRewardFinding,
  advanceRewardBranches,
  beginRewardRoom,
  countedBinding,
  initializeRewardBranches,
  mergeEquivalentRewardBranches,
  settleEncounterTraitOffer,
  settleProducerAcquisitionSite,
  settleOwnedAcquisitionSite,
  processOfferGenerationCohort,
  processEncounterTraitOffer,
  processRewardOffer,
  processShopInventory,
  settleShopAcquisitionSite,
  settlePickupAcquisitionSite,
  publicRewardBranch,
  applyJeweledPomEquipResult,
  applyExperimentalHammerEquipResult,
  rewardFinding,
  type AcquisitionRoleFrontier,
  type ReachedTraitChildCheckpoint,
  type OfferProcessingContext,
  type OfferProcessingPeer,
  type RewardBranchState,
} from './processing';
import {
  assessJeweledPomEquipResult,
  assessExperimentalHammerEquipResult,
  advanceExperimentalHammers,
  applyKeepsakeDisposition,
  invalidateJeweledPom,
  jeweledPomEffectForKey,
  keepsakeSelectionUnavailableReason,
  keepsakeRankForEquip,
  refreshKeepsakeFatedStatus,
  consumeFigLeafUse,
  attestFigLeafBranchState,
  attestGorgonBranchState,
  attestPendingGorgonRarity,
  consumeGorgonAppearance,
  expirePendingGorgon,
  assessGorgonEligibility,
  assessGorgonChildSettlement,
  applyEchoFigLeafReplay,
  applyEchoCallingCardReplay,
  applyEchoTimePieceReplay,
} from '../keepsakes';
import {
  activateTemporaryArcana,
  createArcanaFearState,
  inactiveArcanaKeys,
  judgmentRequiredCount,
} from '../arcana-fear';
import {
  createBossCompletionArcanaAddress,
  createKeepsakeEquipResultAddress,
  createPostbossKeepsakeSelectionAddress,
} from '../../authored-project/addresses';
import {
  createBossCompletionArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../candidate-artifacts';
import {
  prepareAcquisitionOrderCandidateContext,
  preparePickupAcquisitionOrderCandidateContext,
} from './acquisition-order-candidates';

type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalChildRoom;
type CanonicalRewardSource = CanonicalRewardRoom | CanonicalHubRoom;

interface IncomingOfferCandidateContext {
  readonly context: OfferProcessingContext;
  readonly room: CanonicalRewardRoom;
  readonly declaration: RoomDeclaration;
  readonly incoming: CanonicalResolvedIncomingReward;
  readonly acquisitionView?: HistoryStateView;
  readonly acquisitionSequence?: number;
  /** Exact reached lifecycle points, independent of the selected offer's roles. */
  readonly producerPoints?: readonly Extract<
    HistoryEvent,
    { readonly kind: 'producerPointReached' }
  >[];
}

function sameResolvedOffer(
  left: CanonicalResolvedIncomingReward['offer'],
  right: CanonicalResolvedIncomingReward['offer'],
): boolean {
  if (left.rewardType !== right.rewardType) return false;
  if (left.payload === undefined || right.payload === undefined) {
    return left.payload === right.payload;
  }
  if (left.payload.kind !== right.payload.kind) return false;
  return left.payload.kind === 'BoonSource' && right.payload.kind === 'BoonSource'
    ? left.payload.source === right.payload.source
    : left.payload.kind === 'DevotionPair' && right.payload.kind === 'DevotionPair'
      ? left.payload.chosenSource === right.payload.chosenSource &&
        left.payload.spurnedSource === right.payload.spurnedSource
      : false;
}

type RewardRoomOwner = {
  readonly kind: string;
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly occurrenceId?: string;
  readonly groupKey?: string;
  readonly slotKey?: string;
};

function sameRewardRoomOwner(left: RewardRoomOwner, right: RewardRoomOwner): boolean {
  if (left.routeKey !== right.routeKey || left.biomeKey !== right.biomeKey) return false;
  if (
    left.groupKey !== undefined ||
    left.slotKey !== undefined ||
    right.groupKey !== undefined ||
    right.slotKey !== undefined
  ) {
    return (
      left.occurrenceId === right.occurrenceId &&
      left.groupKey === right.groupKey &&
      left.slotKey === right.slotKey
    );
  }
  return left.occurrenceId !== undefined && left.occurrenceId === right.occurrenceId;
}

function historyFindingChronology(sequence: number): HistoryFindingChronology {
  return Object.freeze({ kind: 'history', sequence, boundary: 'at' });
}

function hubFindingChronology(
  snapshot: BiomeRewardSnapshot,
  owner: RewardRoomOwner,
  sequence: number,
  phase: 'targetLifecycle' | 'sideGeneration' | 'localRoomLifecycle',
): FindingChronology | undefined {
  for (const decision of snapshot.decisions) {
    if (decision.kind !== 'hub') continue;
    for (const [visitIndex, visit] of decision.visits.entries()) {
      if (sameRewardRoomOwner(visit.target.room.origin, owner)) {
        return Object.freeze({
          kind: 'hubVisit',
          visitIndex,
          phase: 'targetLifecycle',
          history: historyFindingChronology(sequence),
        });
      }
      const local = visit.localSlots.find((slot) => sameRewardRoomOwner(slot.origin, owner));
      if (local !== undefined) {
        return Object.freeze({
          kind: 'hubVisit',
          visitIndex,
          phase,
          ...(phase === 'localRoomLifecycle' && local.enteredOrdinal !== null
            ? { localLifecycleIndex: local.enteredOrdinal - 1 }
            : {}),
          history: historyFindingChronology(sequence),
        });
      }
    }
  }
  const frontier = hubVisitFrontier(snapshot);
  if (frontier !== undefined) {
    if (sameRewardRoomOwner(frontier.target.room.origin, owner)) {
      return Object.freeze({
        kind: 'hubVisit',
        visitIndex: frontier.origin.visitIndex - 1,
        phase: 'targetLifecycle',
        history: historyFindingChronology(sequence),
      });
    }
    const local = frontier.localSlots.find((slot) => sameRewardRoomOwner(slot.origin, owner));
    if (local !== undefined) {
      const localLifecycleIndex = frontier.enteredLocalRooms.findIndex((slot) =>
        sameRewardRoomOwner(slot.origin, local.origin),
      );
      return Object.freeze({
        kind: 'hubVisit',
        visitIndex: frontier.origin.visitIndex - 1,
        phase,
        ...(phase === 'localRoomLifecycle' && localLifecycleIndex >= 0
          ? { localLifecycleIndex }
          : {}),
        history: historyFindingChronology(sequence),
      });
    }
  }
  return undefined;
}

function rewardFindingChronologyForRoom(
  snapshot: BiomeRewardSnapshot,
  owner: RewardRoomOwner,
  sequence: number,
  phase: 'targetLifecycle' | 'sideGeneration' | 'localRoomLifecycle',
): FindingChronology {
  return (
    hubFindingChronology(snapshot, owner, sequence, phase) ?? historyFindingChronology(sequence)
  );
}

/** The reward engine only needs materialized rooms and selected decisions. */
export type BiomeRewardSnapshot =
  CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom });
export type BiomeRewardHistory = CanonicalBiomeHistory | BiomeHistoryPrefix;

export class BiomeRewardSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeRewardSimulationContractError';
  }
}

function fail(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

function rewardFacts(
  catalog: Catalog,
  source: CanonicalRewardSource,
  currentRoom: CanonicalRewardSource | undefined,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  history: RewardHistoryState,
  enteredBiomeCount: number,
  currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
  peerParentOrigin = source.origin,
  peerCreationSource: RoomCreationSource = 'generatedTarget',
  rewardLookups: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({}),
): RewardKernelFacts {
  return createRewardFacts({
    catalog,
    currentRoom,
    sourceDeclaration,
    view,
    history,
    enteredBiomeCount,
    currentBatchRoomGameNames: createdPeerGameNames(
      catalog,
      view,
      peerParentOrigin,
      peerCreationSource,
    ),
    currentRoomShopOptionNames,
    rewardLookups,
    fail,
  });
}
function requireRewardLayout(catalog: Catalog, snapshot: BiomeRewardSnapshot): BiomeLayout {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  const supportedPolicy =
    layout !== undefined &&
    (layout.progression.kind === 'hub' ||
      layout.progression.rewardStorePolicy.kind === 'authoredBaseStore' ||
      (layout.progression.progressionPolicy.kind === 'staged' &&
        layout.progression.batchPolicy.kind === 'standard' &&
        layout.progression.rewardStorePolicy.kind === 'none') ||
      (layout.progression.batchPolicy.kind === 'clockwork' &&
        layout.progression.rewardStorePolicy.kind === 'none') ||
      (layout.progression.batchPolicy.kind === 'fields' &&
        layout.progression.rewardStorePolicy.kind === 'none'));
  if (layout === undefined || !supportedPolicy) {
    throw new BiomeRewardSimulationContractError(
      `catalog does not provide supported ${snapshot.biomeKey} reward stores`,
    );
  }
  return layout;
}

function frontierBatch(snapshot: BiomeRewardSnapshot): readonly CanonicalBatch[] {
  return snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
    ? snapshot.frontier.partialBatch === undefined
      ? Object.freeze([])
      : Object.freeze([snapshot.frontier.partialBatch])
    : Object.freeze([]);
}

function frontierAdditional(
  snapshot: BiomeRewardSnapshot,
): readonly CanonicalAdditionalContinuation[] {
  return snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
    ? snapshot.frontier.additional
    : Object.freeze([]);
}

function rewardDecisions(snapshot: BiomeRewardSnapshot): readonly CanonicalDecision[] {
  return Object.freeze([...snapshot.decisions, ...frontierBatch(snapshot)]);
}

function batches(snapshot: BiomeRewardSnapshot): readonly CanonicalBatch[] {
  return rewardDecisions(snapshot).filter(
    (decision): decision is CanonicalBatch => decision.kind === 'batch',
  );
}

function hasHubVisitDetails(
  frontier: MaterializedBiomePrefix['frontier'] | undefined,
): frontier is MaterializedHubVisitFrontier {
  return frontier?.kind === 'hubVisit' && 'phase' in frontier;
}

function hubVisitFrontier(snapshot: BiomeRewardSnapshot): MaterializedHubVisitFrontier | undefined {
  const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
  return hasHubVisitDetails(frontier) ? frontier : undefined;
}

/**
 * A Hub board is persistent, but acquisitions belong to one entered visit (or
 * one entered side room), never to the restored Hub container.
 */
function acquisitionSiteOwner(
  snapshot: BiomeRewardSnapshot,
  room: CanonicalRewardRoom,
): AcquisitionSiteOwnerAddress {
  if (room.kind === 'localChild') return room.origin;
  for (const decision of snapshot.decisions) {
    if (decision.kind !== 'hub') continue;
    const visit = decision.visits.find((candidate) =>
      sameRewardRoomOwner(candidate.target.room.origin, room.origin),
    );
    if (visit !== undefined) return visit.origin;
  }
  const frontier = hubVisitFrontier(snapshot);
  if (frontier !== undefined && sameRewardRoomOwner(frontier.target.room.origin, room.origin)) {
    return frontier.origin;
  }
  return room.origin;
}

function hubFrontierRooms(snapshot: BiomeRewardSnapshot): readonly CanonicalRewardSource[] {
  const frontier = hubVisitFrontier(snapshot);
  if (frontier === undefined) return Object.freeze([]);
  return Object.freeze([frontier.target.room, ...frontier.localSlots]);
}

function rewardRooms(snapshot: BiomeRewardSnapshot): ReadonlyMap<string, CanonicalRewardSource> {
  const rooms = [
    snapshot.entryRoom,
    ...rewardDecisions(snapshot).flatMap((decision) =>
      decision.kind === 'batch'
        ? [
            ...decision.targets.map((target) => target.room),
            ...decision.additional.map((continuation) => continuation.room),
          ]
        : [
            decision.room,
            ...decision.board.targets.map((target) => target.room),
            ...decision.visits.flatMap((visit) => visit.localSlots),
          ],
    ),
    ...frontierAdditional(snapshot).map((continuation) => continuation.room),
    ...hubFrontierRooms(snapshot),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function canonicalAdditionalContinuations(
  snapshot: BiomeRewardSnapshot,
): ReadonlyMap<string, CanonicalAdditionalContinuation> {
  return new Map(
    [
      ...rewardDecisions(snapshot).flatMap((decision) =>
        decision.kind === 'batch' ? decision.additional : [],
      ),
      ...frontierAdditional(snapshot),
    ].map((continuation) => [semanticAddressKey(continuation.origin), continuation]),
  );
}

function hubTargets(snapshot: BiomeRewardSnapshot): ReadonlyMap<string, CanonicalHubTarget> {
  return new Map(
    rewardDecisions(snapshot)
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .flatMap((decision) => decision.board.targets)
      .map((target) => [semanticAddressKey(target.origin), target]),
  );
}

function hubRewardLookups(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
): {
  readonly internal: Readonly<Record<string, ReadonlySet<string>>>;
  readonly public: Readonly<Record<string, readonly string[]>>;
} {
  const descriptor = catalog.biomeLayouts.byKey[snapshot.biomeKey]?.progression;
  const hub = snapshot.decisions.find(
    (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
      decision.kind === 'hub',
  );
  if (descriptor?.kind !== 'hub' || hub === undefined) {
    return Object.freeze({ internal: Object.freeze({}), public: Object.freeze({}) });
  }
  if (hub.origin.hubKey !== descriptor.hubKey) {
    throw new BiomeRewardSimulationContractError(
      `${snapshot.biomeKey} reward lookup has the wrong Hub decision`,
    );
  }
  const orderedTypes: string[] = [];
  const uniqueTypes = new Set<string>();
  for (const target of hub.board.targets) {
    const incoming = target.room.incomingReward;
    if (incoming === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${target.room.gameName} has no Hub-board reward for ${descriptor.rewardLookup.key}`,
      );
    }
    if (!uniqueTypes.has(incoming.offer.rewardType)) {
      uniqueTypes.add(incoming.offer.rewardType);
      orderedTypes.push(incoming.offer.rewardType);
    }
  }
  return Object.freeze({
    internal: Object.freeze({ [descriptor.rewardLookup.key]: uniqueTypes }),
    public: Object.freeze({ [descriptor.rewardLookup.key]: Object.freeze(orderedTypes) }),
  });
}

function roomViews(history: BiomeRewardHistory): ReadonlyMap<string, ProgressiveRoomHistoryViews> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function canonicalTargets(snapshot: BiomeRewardSnapshot): ReadonlyMap<string, CanonicalTarget> {
  return new Map(
    rewardDecisions(snapshot)
      .flatMap((decision) => (decision.kind === 'batch' ? decision.targets : []))
      .map((target) => [semanticAddressKey(target.origin), target]),
  );
}

function enteredStoreKey(
  room: CanonicalRewardRoom,
  declaration: RoomDeclaration,
): string | undefined {
  switch (declaration.enteredRewardStoreHistory.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return declaration.enteredRewardStoreHistory.storeKey;
    case 'resolvedOffer':
      return room.incomingReward?.resolvedStoreKey;
  }
}

export function rewardStoreCandidateSupport(
  layout: BiomeLayout,
  origin: BatchRewardStoreAddress,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  historySequence: number,
): RewardStoreCandidateSupport {
  if (layout.progression.kind !== 'generated') {
    throw new BiomeRewardSimulationContractError(
      'Hub progression has no authored base-store policy',
    );
  }
  const policy = layout.progression.rewardStorePolicy;
  if (policy.kind !== 'authoredBaseStore') {
    throw new BiomeRewardSimulationContractError(
      'generated progression lost its authored base-store contract',
    );
  }
  const priorStores = view.ledgers.enteredRewardStores
    .filter((entry) => entry.origin.biomeKey === source.origin.biomeKey)
    .map((entry) => entry.storeKey);
  const currentStore = enteredStoreKey(source, sourceDeclaration);
  const stores = currentStore === undefined ? priorStores : [...priorStores, currentStore];
  const metaCount = stores.filter((storeKey) => storeKey === 'MetaProgress').length;
  const ratio = stores.length === 0 ? null : metaCount / stores.length;
  const metaSelectionValue =
    ratio === null
      ? policy.targetMetaRewardsRatio
      : policy.targetMetaRewardsRatio +
        policy.targetMetaRewardsAdjustSpeed * (policy.targetMetaRewardsRatio - ratio);
  const supportStoreKeys = Object.freeze(
    metaSelectionValue <= 0
      ? policy.storeKeys.filter((storeKey) => storeKey !== 'MetaProgress')
      : metaSelectionValue >= 1
        ? policy.storeKeys.filter((storeKey) => storeKey === 'MetaProgress')
        : [...policy.storeKeys],
  );
  return Object.freeze({
    origin,
    historySequence,
    enteredStoreCount: stores.length,
    enteredMetaStoreCount: metaCount,
    currentMetaRatio: ratio,
    metaSelectionValue,
    supportStoreKeys,
  });
}

function storeSupport(
  layout: BiomeLayout,
  batch: Pick<CanonicalBatch, 'rewardStore'>,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  historySequence: number,
): RewardStoreSupportEntry {
  if (batch.rewardStore.kind !== 'authoredBaseStore') {
    throw new BiomeRewardSimulationContractError(
      'generated batch lost its authored base-store contract',
    );
  }
  const support = rewardStoreCandidateSupport(
    layout,
    batch.rewardStore.origin,
    source,
    sourceDeclaration,
    view,
    historySequence,
  );
  return Object.freeze({
    ...support,
    authoredStoreKey: batch.rewardStore.baseRewardStoreKey,
    selectedPossible: support.supportStoreKeys.includes(batch.rewardStore.baseRewardStoreKey),
  });
}

function expectedTargetStores(
  catalog: Catalog,
  targets: readonly CanonicalTarget[],
  initialSharedStoreKey: string | undefined,
): ReadonlyMap<string, string | undefined> {
  let finalSharedStoreKey = initialSharedStoreKey;
  for (const target of targets) {
    const declaration = catalog.rooms.byKey[target.room.gameName];
    if (declaration === undefined) {
      throw new BiomeRewardSimulationContractError(`unknown target room ${target.room.gameName}`);
    }
    if (declaration.forcedRewardStoreKey !== undefined) {
      finalSharedStoreKey = declaration.forcedRewardStoreKey;
    }
  }
  return new Map(
    targets.map((target) => {
      const declaration = catalog.rooms.byKey[target.room.gameName]!;
      return [
        semanticAddressKey(target.origin),
        declaration.forcedRewardStoreKey ??
          declaration.individualRewardStoreKey ??
          finalSharedStoreKey,
      ];
    }),
  );
}

function localRewardBinding(
  declaration: RoomDeclaration,
  reward: CanonicalLocalReward,
): CountedRewardBinding {
  const descriptor = declaration.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.key === reward.groupKey,
  );
  if (
    descriptor?.kind !== 'boundedRewardSlots' ||
    !descriptor.slotKeys.includes(reward.slotKey) ||
    descriptor.reward.producerLifecycleKey !== reward.producerLifecycleKey
  ) {
    throw new BiomeRewardSimulationContractError(
      `${declaration.gameName} does not own local reward ${reward.groupKey}.${reward.slotKey}`,
    );
  }
  return descriptor.reward;
}

function rewardWheelBinding(
  catalog: Catalog,
  declaration: RoomDeclaration,
  wheel: CanonicalRewardWheel,
): CountedRewardBinding {
  const descriptor = encounterEnvelopeSlots(catalog, declaration, declaration.gameName).find(
    (slot) => slot.key === wheel.encounterPhaseKey,
  )?.rewardAttachment;
  if (
    descriptor?.kind !== 'rewardWheel' ||
    descriptor.key !== wheel.wheelKey ||
    descriptor.reward.producerLifecycleKey !== wheel.producerLifecycleKey ||
    !descriptor.reward.storeKeys.includes(wheel.storeKey)
  ) {
    throw new BiomeRewardSimulationContractError(
      `${declaration.gameName} does not own reward wheel ${wheel.wheelKey}`,
    );
  }
  return descriptor.reward;
}

function candidateResult(
  findings: Map<string, FindingRegionEntry>,
  branches: readonly RewardBranchState[],
): RewardProducerCandidateResult {
  return Object.freeze({
    findings: Object.freeze([...findings.values()].map((entry) => entry.finding)),
    supported: branches.length > 0,
  });
}

function lifecycleCandidateResult(
  findings: Map<string, FindingRegionEntry>,
  branches: readonly RewardBranchState[],
): RoomLifecycleCandidateResult {
  return candidateResult(findings, branches);
}

interface WheelLifecycleView {
  readonly generation: HistoryStateView;
  readonly acquisition: HistoryStateView;
  readonly acquisitionSequence: number;
}

function projectedEncounterEntry(
  room: CanonicalAuthoredRoom,
  phase: ResolvedEncounterPhase,
  sequence: number,
): EncounterHistoryEntry {
  return Object.freeze({
    sequence,
    origin: room.origin,
    gameName: room.gameName,
    encounterEnvelopeKey: phase.envelopeKey,
    slotKey: phase.slotKey,
    encounterKey: phase.encounterKey,
    phaseKind: phase.kind,
  });
}

function projectDormantWheelView(
  room: CanonicalAuthoredRoom,
  phase: ResolvedEncounterPhase,
  generation: HistoryStateView,
): WheelLifecycleView {
  const start = projectedEncounterEntry(room, phase, generation.sequence + 2);
  const completion = projectedEncounterEntry(room, phase, generation.sequence + 4);
  const encounterDelta = phase.countsEncounterDepth ? 1 : 0;
  const acquisition = Object.freeze({
    sequence: completion.sequence,
    ledgers: Object.freeze({
      ...generation.ledgers,
      encounterStarts: Object.freeze([...generation.ledgers.encounterStarts, start]),
      encounterCompletions: Object.freeze([...generation.ledgers.encounterCompletions, completion]),
      counters: Object.freeze({
        ...generation.ledgers.counters,
        biomeEncounterDepth: generation.ledgers.counters.biomeEncounterDepth + encounterDelta,
        routeEncounterDepth: generation.ledgers.counters.routeEncounterDepth + encounterDelta,
      }),
    }),
  });
  return Object.freeze({
    generation,
    acquisition,
    acquisitionSequence: acquisition.sequence + 1,
  });
}

function wheelLifecycleViews(
  history: BiomeRewardHistory,
  room: CanonicalAuthoredRoom,
  roomView: ProgressiveRoomHistoryViews,
  wheel: CanonicalRewardWheel,
): WheelLifecycleView {
  const selected = roomView.offerPoints?.find(
    (candidate) => candidate.offerPoint === wheel.wheelKey,
  );
  if (selected !== undefined) {
    const acquisitionEvent = history.events.find(
      (candidate) =>
        candidate.kind === 'offerPointAcquired' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin) &&
        candidate.offerPoint === wheel.wheelKey,
    );
    if (selected.acquisitionBefore === undefined || acquisitionEvent === undefined) {
      return fail(`${room.gameName}.${wheel.wheelKey} has no acquisition lifecycle view`);
    }
    return Object.freeze({
      generation: selected.before,
      acquisition: selected.acquisitionBefore,
      acquisitionSequence: acquisitionEvent.sequence,
    });
  }
  const phase = room.encounterPhases.find(
    (candidate) => candidate.slotKey === wheel.encounterPhaseKey,
  );
  const generation = roomView.preOutgoing;
  if (phase === undefined || generation === undefined) {
    return fail(`${room.gameName}.${wheel.wheelKey} has no dormant lifecycle view`);
  }
  return projectDormantWheelView(room, phase, generation);
}

function prepareShipLifecycleCandidateContext(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  roomView: ProgressiveRoomHistoryViews,
  history: BiomeRewardHistory,
  branchesBeforeFirstWheel: readonly RewardBranchState[],
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
): ShipLifecycleCandidateContext {
  const activeWheelKeys = Object.freeze(room.rewardWheels?.map((wheel) => wheel.wheelKey) ?? []);
  return Object.freeze({
    origin: room.origin,
    activeWheelKeys,
    evaluateState: (state: ShipCombatState): RoomLifecycleCandidateResult => {
      const ship = materializeShipCombatState(
        catalog,
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        declaration,
        Object.freeze({
          occurrenceId: room.occurrenceId,
          gameName: room.gameName,
          state,
          encounters: room.encounters,
          additionalExits: Object.freeze([]),
        }),
        routeLoadout,
      );
      const candidateRoom = Object.freeze({
        ...room,
        encounterPhases: ship.encounterPhases,
        rewardWheels: ship.rewardWheels,
      });
      const candidateFindings = new Map<string, FindingRegionEntry>();
      let candidateBranches = branchesBeforeFirstWheel;
      for (const wheel of ship.rewardWheels) {
        if (candidateBranches.length === 0) {
          break;
        }
        const lifecycleView = wheelLifecycleViews(history, candidateRoom, roomView, wheel);
        const binding = rewardWheelBinding(catalog, declaration, wheel);
        candidateBranches = processOfferGenerationCohort(
          candidateBranches,
          wheel.offers.map((offer: CanonicalRewardWheel['offers'][number]) => ({
            catalog,
            reward: {
              ...offer,
              producerLifecycleKey: wheel.producerLifecycleKey,
              resolvedStoreKey: wheel.storeKey,
            },
            binding,
            historySequence: lifecycleView.generation.sequence + 1,
            peers: Object.freeze([]),
            facts: (branchHistory: RewardHistoryState) =>
              rewardFacts(
                catalog,
                candidateRoom,
                candidateRoom,
                declaration,
                lifecycleView.generation,
                branchHistory,
                enteredBiomeCount,
              ),
          })),
          candidateFindings,
          { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
        );
        const picked = wheel.offers.find(
          (offer: CanonicalRewardWheel['offers'][number]) => offer.picked,
        );
        if (picked === undefined) {
          return fail(`${room.gameName}.${wheel.wheelKey} has no picked offer`);
        }
        if (candidateBranches.length > 0) {
          candidateBranches = settleOwnedAcquisitionSite(
            catalog,
            candidateBranches,
            {
              siteOwner: wheel.origin,
              pointKey: wheel.wheelKey,
              entryKey: 'picked',
              source: Object.freeze({
                ...picked,
                producerLifecycleKey: wheel.producerLifecycleKey,
                instanceProvenance: 'free',
              }),
              historySequence: lifecycleView.acquisitionSequence,
            },
            (branchHistory) =>
              rewardFacts(
                catalog,
                candidateRoom,
                candidateRoom,
                declaration,
                lifecycleView.acquisition,
                branchHistory,
                enteredBiomeCount,
              ),
            candidateFindings,
            ownerRegion(wheel.origin),
          ).branches;
        }
      }
      return lifecycleCandidateResult(candidateFindings, candidateBranches);
    },
  });
}

interface BiomeRewardEvaluationAssembly {
  readonly simulation: BiomeRewardSimulation;
  readonly producerArtifacts: RewardProducerCandidateArtifacts;
  readonly lifecycleArtifacts: RoomLifecycleCandidateArtifacts;
  readonly traitOfferArtifacts: import('../candidate-artifacts').TraitOfferCandidateArtifacts;
  readonly levelResolutionArtifacts: import('../candidate-artifacts').LevelResolutionCandidateArtifacts;
  readonly bossCompletionArcanaArtifacts: import('../candidate-artifacts').BossCompletionArcanaCandidateArtifacts;
  readonly keepsakeSelectionArtifacts: import('../candidate-artifacts').KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResultArtifacts: import('../candidate-artifacts').KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversionArtifacts: import('../candidate-artifacts').AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntryArtifacts: import('../candidate-artifacts').DerivedAcquisitionEntryCandidateArtifacts;
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
  readonly findingRegions: readonly FindingRegionEntry[];
}

export interface TraitChildSettlementCheckpoint {
  readonly branches: readonly RewardBranch[];
  readonly runStateSnapshots: readonly DecisionRunStateSnapshot[];
}

export interface TraitChildSettlementCheckpoints {
  readonly at: (address: SemanticAddress) => TraitChildSettlementCheckpoint | undefined;
}

function traitOwnerAddress(origin: SemanticAddress): TraitOfferOwnerAddress | undefined {
  switch (origin.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
      return origin;
    case 'encounterPhase':
      return origin;
    case 'acquisitionEntry':
      return origin;
    default:
      return undefined;
  }
}

export function selectedTraitOfferProducts(
  branches: readonly RewardBranchState[],
  retainedLevelEvaluations: readonly ReachedLevelResolutionEvaluation[] = Object.freeze([]),
): {
  readonly selectedTraitOffers: readonly SelectedTraitOfferAssessment[];
  readonly selectedLevelResolutions: readonly SelectedLevelResolutionAssessment[];
  readonly candidateContexts: ReadonlyMap<string, readonly TraitOfferCandidateContext[]>;
  readonly levelCandidateContexts: ReadonlyMap<
    string,
    readonly {
      readonly address: import('../../authored-project/addresses').LevelResolutionAddress;
      readonly before: import('../traits').TraitHistoryState;
      readonly levelCount: number;
      readonly effectKind: 'choice' | 'random';
      readonly emptyTargetAllowed?: boolean;
    }[]
  >;
} {
  const grouped = new Map<
    string,
    {
      readonly address: TraitOfferAddress;
      readonly acquisitionRole: string;
      readonly offer: ReachedTraitOfferEvaluation['offer'];
      readonly branches: ReachedTraitOfferEvaluation[];
      chronologicalIndex: number;
    }
  >();
  for (const branch of branches) {
    for (const trace of branch.traitEvaluations ?? []) {
      const owner = traitOwnerAddress(trace.address);
      if (owner === undefined) continue;
      const address = createTraitOfferAddress(owner, trace.acquisitionRole);
      const key = semanticAddressKey(address);
      const current = grouped.get(key);
      if (current === undefined) {
        grouped.set(key, {
          address,
          acquisitionRole: trace.acquisitionRole,
          offer: trace.offer,
          branches: [trace],
          chronologicalIndex: trace.chronologicalIndex,
        });
      } else {
        const duplicate = current.branches.some(
          (candidate) =>
            JSON.stringify([
              candidate.before,
              candidate.context,
              candidate.offer,
              candidate.arcanaFear,
            ]) === JSON.stringify([trace.before, trace.context, trace.offer, trace.arcanaFear]),
        );
        if (!duplicate) current.branches.push(trace);
        current.chronologicalIndex = Math.min(current.chronologicalIndex, trace.chronologicalIndex);
      }
    }
  }
  const selectedTraitOffers = Object.freeze(
    [...grouped.values()]
      .sort((left, right) => {
        const chronology = left.chronologicalIndex - right.chronologicalIndex;
        return chronology !== 0
          ? chronology
          : semanticAddressKey(left.address).localeCompare(semanticAddressKey(right.address));
      })
      .map((entry) =>
        Object.freeze({
          address: entry.address,
          acquisitionRole: entry.acquisitionRole,
          offer: entry.offer,
          branches: Object.freeze(
            entry.branches.map((trace) =>
              Object.freeze({
                assessments: trace.assessments,
                composition: trace.composition,
                replacementComposition: trace.replacementComposition,
                targetedAcquisition: trace.targetedAcquisition,
              }),
            ),
          ),
          reached: true as const,
          chronologicalIndex: entry.chronologicalIndex,
        }),
      ),
  );
  const candidateContexts = new Map<string, readonly TraitOfferCandidateContext[]>();
  for (const entry of grouped.values()) {
    const address = createTraitOfferAddress(entry.address.owner, entry.acquisitionRole);
    candidateContexts.set(
      semanticAddressKey(address),
      Object.freeze(
        entry.branches.map((trace) =>
          Object.freeze({
            before: trace.before,
            context: trace.context,
            ...(trace.arcanaFear === undefined ? {} : { arcanaFear: trace.arcanaFear }),
            ...(trace.keepsakes === undefined ? {} : { keepsakes: trace.keepsakes }),
          }),
        ),
      ),
    );
  }
  const levels = new Map<
    string,
    {
      address: import('../../authored-project/addresses').LevelResolutionAddress;
      value: ReachedLevelResolutionEvaluation['value'];
      branches: ReachedLevelResolutionEvaluation[];
      chronologicalIndex: number;
    }
  >();
  for (const trace of [
    ...branches.flatMap((branch) => branch.levelResolutionEvaluations ?? []),
    ...retainedLevelEvaluations,
  ]) {
    const key = semanticAddressKey(trace.address);
    const current = levels.get(key);
    if (current === undefined)
      levels.set(key, {
        address: trace.address,
        value: trace.value,
        branches: [trace],
        chronologicalIndex: trace.chronologicalIndex,
      });
    else if (
      !current.branches.some(
        (candidate) =>
          JSON.stringify([candidate.before, candidate.value]) ===
          JSON.stringify([trace.before, trace.value]),
      )
    ) {
      current.branches.push(trace);
      current.chronologicalIndex = Math.min(current.chronologicalIndex, trace.chronologicalIndex);
    }
  }
  const selectedLevelResolutions = Object.freeze(
    [...levels.values()]
      .sort((left, right) => left.chronologicalIndex - right.chronologicalIndex)
      .map((entry) =>
        Object.freeze({
          address: entry.address,
          value: entry.value,
          branches: Object.freeze(
            entry.branches.map((trace) =>
              Object.freeze({
                findings: trace.findings,
                levelCount: trace.levelCount,
                emptyTargetAllowed: trace.emptyTargetAllowed,
                eligibleTargetCount: trace.before.upgradableTraitCount,
              }),
            ),
          ),
          reached: true as const,
          chronologicalIndex: entry.chronologicalIndex,
        }),
      ),
  );
  const levelCandidateContexts = new Map<
    string,
    readonly {
      readonly address: import('../../authored-project/addresses').LevelResolutionAddress;
      readonly before: import('../traits').TraitHistoryState;
      readonly levelCount: number;
      readonly effectKind: 'choice' | 'random';
      readonly emptyTargetAllowed?: boolean;
    }[]
  >();
  for (const [key, entry] of levels) {
    levelCandidateContexts.set(
      key,
      Object.freeze(
        entry.branches.map((trace) =>
          Object.freeze({
            address: trace.address,
            before: trace.before,
            levelCount: trace.levelCount,
            effectKind: trace.effectKind,
            ...(trace.emptyTargetAllowed ? { emptyTargetAllowed: true } : {}),
          }),
        ),
      ),
    );
  }
  return Object.freeze({
    selectedTraitOffers,
    selectedLevelResolutions,
    candidateContexts,
    levelCandidateContexts,
  });
}

export function evaluateBiomeRewardsAssemblyInternal(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
): BiomeRewardEvaluationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRewardSimulationContractError('reward inputs do not share one biome owner');
  }
  const layout = requireRewardLayout(catalog, snapshot);
  const rewardLookup = hubRewardLookups(catalog, snapshot);
  const rooms = rewardRooms(snapshot);
  const views = roomViews(history);
  const targets = canonicalTargets(snapshot);
  const additionalContinuations = canonicalAdditionalContinuations(snapshot);
  const hubTargetByOrigin = hubTargets(snapshot);
  const batchesByParent = new Map(
    batches(snapshot).map((batch) => [semanticAddressKey(batch.parent.origin), batch]),
  );
  const bossCompletionArcanaContexts = new Map<
    string,
    import('../candidate-artifacts').BossCompletionArcanaCandidateCapability
  >();
  const keepsakeSelectionContexts = new Map<
    string,
    import('../candidate-artifacts').KeepsakeSelectionCandidateCapability
  >();
  const keepsakeEquipResultContexts = new Map<
    string,
    import('../candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >();
  const acquisitionConversionContexts = new Map<string, readonly AcquisitionRoleFrontier[]>();
  const derivedAcquisitionEntryContexts = new Map<
    string,
    readonly import('./processing').DerivedAcquisitionEntryFrontier[]
  >();
  const figLeafPhaseCandidates = new Map<string, import('./model').FigLeafPhaseCandidateSupport>();
  const gorgonPhaseCandidates = new Map<string, import('./model').GorgonPhaseCandidateSupport>();
  const blockedGorgonPhases = new Set<string>();
  let gorgonEvaluationBlocked = false;
  const eligibleGorgonPhases = new Set<string>();
  function recordAcquisitionRoleFrontiers(
    frontiers: readonly AcquisitionRoleFrontier[] | undefined,
  ): void {
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.address);
      acquisitionConversionContexts.set(
        key,
        Object.freeze([...(acquisitionConversionContexts.get(key) ?? []), frontier]),
      );
    }
  }
  function recordDerivedAcquisitionEntryFrontiers(
    frontiers: readonly import('./processing').DerivedAcquisitionEntryFrontier[] | undefined,
  ): void {
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.address);
      derivedAcquisitionEntryContexts.set(
        key,
        Object.freeze([...(derivedAcquisitionEntryContexts.get(key) ?? []), frontier]),
      );
    }
  }

  function advanceExperimentalHammerForCompletion(
    branchesAtCompletion: readonly RewardBranchState[],
    owner: SemanticAddress,
    sequence: number,
  ): readonly RewardBranchState[] {
    return Object.freeze(
      branchesAtCompletion.map((branch) => {
        const advanced = advanceExperimentalHammers(branch.keepsakes);
        if (advanced.state === branch.keepsakes) return branch;
        if (advanced.expired.length === 0)
          return Object.freeze({ ...branch, keepsakes: advanced.state });
        const prior = branch.traitHistory ?? createTraitHistoryState();
        const traitHistory = foldTraitHistoryEvents(catalog, [
          ...prior.events,
          ...advanced.expired.map((expired) =>
            Object.freeze({
              kind: 'traitRemoval' as const,
              owner,
              acquisitionRole: 'experimentalHammerExpiry',
              sequence,
              acquisitionPoint: 'encounterCompleted',
              traitKey: expired.traitKey,
              acquisitionIdentity: expired.acquisitionIdentity,
            }),
          ),
        ]);
        return Object.freeze({
          ...branch,
          history: attachTraitHistory(branch.history, traitHistory),
          traitHistory,
          keepsakes: advanced.state,
        });
      }),
    );
  }

  /**
   * Judgment is one authored exact set, so its pre-effect domain cannot be
   * picked from an arbitrary reward branch. Branches may still differ in
   * reward bags and history, but they must agree on the complete Arcana
   * frontier consumed by this transition. The branch merge authority keeps
   * Arcana/Fear in its identity key; this is the local assertion at the point
   * where one public capability is published.
   */
  function attestJudgmentArcanaFrontier(
    branchesAtFrontier: readonly RewardBranchState[],
  ): readonly { readonly key: string; readonly rarity: 'Epic' | 'Heroic' }[] | undefined {
    const first = branchesAtFrontier[0]?.arcanaFear.arcana.active;
    if (first === undefined) return undefined;
    const identity = JSON.stringify(first);
    if (
      !branchesAtFrontier.every(
        (branch) => JSON.stringify(branch.arcanaFear.arcana.active) === identity,
      )
    ) {
      throw new BiomeRewardSimulationContractError(
        'Judgment candidate frontier has divergent Arcana state across surviving branches',
      );
    }
    return first;
  }
  // A Hub replaces its source's zero-target terminal envelope. Its source
  // still reaches an outgoing lifecycle checkpoint, but that checkpoint
  // creates the Hub rather than a normal reward batch.
  const hubTakeoverSources = new Set(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => semanticAddressKey(decision.source.origin)),
  );
  // Hub visit targets and their entered local children restore to an existing
  // parent rather than generating another ordinary decision. Their outgoing
  // checkpoints must still advance reward history without inventing a batch.
  const activeHubVisit = hubVisitFrontier(snapshot);
  const hubRestoringSources = new Set([
    ...snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .flatMap((decision) =>
        decision.visits.flatMap((visit) => [
          semanticAddressKey(visit.target.room.origin),
          ...visit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
      ),
    ...(activeHubVisit === undefined
      ? []
      : [
          semanticAddressKey(activeHubVisit.target.room.origin),
          ...activeHubVisit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
  ]);
  const frontierSource =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? semanticAddressKey(snapshot.frontier.parent.origin)
      : undefined;
  const expectedStores = new Map<string, string | undefined>();
  const storeSupportEntries: RewardStoreSupportEntry[] = [];
  const targetHistoryByOrigin = new Map<string, TargetRewardHistoryCheckpoint>();
  const targetGenerationByParent = new Map<
    string,
    {
      readonly origin: ExitDecisionAddress;
      readonly exitKeys: readonly string[];
    }
  >();
  const findings = new Map<string, FindingRegionEntry>();
  const producerFrontiers = new Map<string, RewardProducerFrontier>();
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
  const acquisitionOrderContexts = new Map<string, AcquisitionOrderCandidateContext>();
  const runStateSnapshotsByOwner = new Map<string, DecisionRunStateSnapshot>();
  const traitChildSettlementBuilders = new Map<
    string,
    {
      readonly occurrenceOwner: SemanticAddress;
      readonly branches: RewardBranchState[];
      readonly runStateSnapshots: Map<string, DecisionRunStateSnapshot>;
    }
  >();
  function recordTraitChildSettlements(
    checkpoints: readonly ReachedTraitChildCheckpoint[] | undefined,
    occurrenceOwner: SemanticAddress,
  ): void {
    for (const checkpoint of checkpoints ?? []) {
      const key = semanticAddressKey(checkpoint.address);
      const current = traitChildSettlementBuilders.get(key);
      if (current === undefined)
        traitChildSettlementBuilders.set(key, {
          occurrenceOwner,
          branches: [checkpoint.branch],
          runStateSnapshots: new Map(),
        });
      else current.branches.push(checkpoint.branch);
    }
  }
  const hubDecisionsBySource = new Map(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => [semanticAddressKey(decision.source.origin), decision]),
  );
  let peers: readonly OfferProcessingPeer[] = Object.freeze([]);
  let branches: readonly RewardBranchState[] = initializeRewardBranches(
    initialBranches,
    initialBranches === undefined ? createArcanaFearState(catalog, routeLoadout) : undefined,
    catalog,
    initialBranches === undefined ? routeLoadout.startingKeepsakeKey : undefined,
    initialBranches === undefined ? routeLoadout.keepsakeEquipResults : undefined,
    initialBranches === undefined ? snapshot.routeKey : undefined,
    initialBranches === undefined ? routeLoadout : undefined,
  );
  const echoKeepsakeReplay = createEchoKeepsakeReplayAddress(
    createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
  );
  const echoHammerResult = createKeepsakeEquipResultAddress(
    echoKeepsakeReplay,
    'experimentalHammer',
  );
  const biomeStartSequence = history.events[0]?.sequence ?? 0;
  const giftStates = branches.map((branch) => {
    const gift = branch.traitHistory?.equippedTraits.EchoRepeatKeepsakeBoon;
    return gift?.echoRepeatedKeepsakeKey === undefined || gift.acquisitionIdentity === undefined
      ? undefined
      : Object.freeze({
          capturedKeepsakeKey: gift.echoRepeatedKeepsakeKey,
          acquisitionIdentity: gift.acquisitionIdentity,
          replayCount: gift.echoKeepsakeReplayCount ?? 0,
        });
  });
  if (giftStates.some((state) => JSON.stringify(state) !== JSON.stringify(giftStates[0])))
    throw new BiomeRewardSimulationContractError(
      'Echo keepsake replay frontier is divergent across surviving branches',
    );
  const giftState = giftStates[0];
  if (giftState !== undefined) {
    const declaration = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey];
    if (declaration?.echoGift.availability !== 'eligible')
      throw new BiomeRewardSimulationContractError(
        `Echo captured ineligible keepsake ${giftState.capturedKeepsakeKey}`,
      );
    const replayEffect = declaration.echoGift.effect;
    if (
      replayEffect.kind === 'experimentalHammer' &&
      new Set(branches.map((branch) => branch.keepsakes.currentKey)).size !== 1
    )
      throw new BiomeRewardSimulationContractError(
        'Echo Experimental Hammer replay frontier has divergent current keepsakes',
      );
    const recordReplay = (branch: RewardBranchState): RewardBranchState => {
      const before = branch.traitHistory ?? createTraitHistoryState();
      const traitHistory = foldTraitHistoryEvents(catalog, [
        ...before.events,
        Object.freeze({
          kind: 'echoKeepsakeReplay' as const,
          owner: echoKeepsakeReplay,
          acquisitionRole: 'echoKeepsakeReplay' as const,
          sequence: biomeStartSequence,
          acquisitionPoint: 'biomeStart' as const,
          traitKey: 'EchoRepeatKeepsakeBoon' as const,
          acquisitionIdentity: giftState.acquisitionIdentity,
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
        }),
      ]);
      return Object.freeze({
        ...branch,
        history: attachTraitHistory(branch.history, traitHistory),
        traitHistory,
      });
    };
    if (replayEffect.kind === 'figLeaf' && giftState.replayCount === 0) {
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              keepsakes: applyEchoFigLeafReplay(branch.keepsakes),
            }),
          ),
        ),
      );
    } else if (
      replayEffect.kind === 'experimentalHammer' &&
      giftState.replayCount === 0 &&
      branches[0]?.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      keepsakeEquipResultContexts.set(
        semanticAddressKey(echoHammerResult),
        Object.freeze({
          frontiers: Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                before: branch.traitHistory ?? createTraitHistoryState(),
                fatedStatus: branch.keepsakes.fatedStatus,
                arcanaFear: branch.arcanaFear,
                loadout: routeLoadout,
              }),
            ),
          ),
        }),
      );
      const authored = snapshot.echoKeepsakeReplayResults?.experimentalHammer;
      if (authored === undefined) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultMissing', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else if (
        branches.some(
          (branch) =>
            !assessExperimentalHammerEquipResult(
              catalog,
              authored,
              branch.traitHistory ?? createTraitHistoryState(),
              routeLoadout,
            ).legal,
        )
      ) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultUnavailable', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else {
        branches = Object.freeze(
          branches.map((branch) =>
            recordReplay(
              applyExperimentalHammerEquipResult(
                catalog,
                branch,
                giftState.capturedKeepsakeKey,
                snapshot.echoKeepsakeReplayResults,
                echoHammerResult,
                biomeStartSequence,
                routeLoadout,
                'Common',
              ),
            ),
          ),
        );
      }
    } else if (replayEffect.kind === 'callingCard') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'callingCard')
        throw new BiomeRewardSimulationContractError('Echo Calling Card replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              keepsakes: applyEchoCallingCardReplay(
                branch.keepsakes,
                charges.rarificationChargesByRank.Common,
              ),
            }),
          ),
        ),
      );
    } else if (replayEffect.kind === 'timePiece') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'timePiece')
        throw new BiomeRewardSimulationContractError('Echo Time Piece replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              keepsakes: applyEchoTimePieceReplay(
                branch.keepsakes,
                charges.conversionChargesByRank.Common,
              ),
            }),
          ),
        ),
      );
    }
  }
  let pendingHubBoard:
    | {
        readonly frontierBranches: readonly RewardBranchState[];
        readonly offers: IncomingOfferCandidateContext[];
      }
    | undefined;

  function captureRunState(
    owner: DecisionRunStateSnapshot['owner'],
    source: CanonicalRewardSource,
    view: HistoryStateView,
  ): void {
    const ownerKey = semanticAddressKey(owner);
    if (runStateSnapshotsByOwner.has(ownerKey) || branches.length === 0) return;
    const declaration = catalog.rooms.byKey[source.gameName];
    if (declaration === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${source.gameName} has no declaration for run-state snapshot`,
      );
    }
    const currentShopNames = new Set(
      (source.kind === 'authored' && source.entryState?.kind === 'shop'
        ? source.entryState.offers
        : []
      ).map((offer) => offer.offer.rewardType),
    );
    const snapshotFor = (checkpointBranches: readonly RewardBranchState[]) =>
      createRunState({
        catalog,
        owner,
        historyView: view,
        branches: checkpointBranches,
        enteredBiomeCount,
        rewardFacts: (branchHistory) =>
          rewardFacts(
            catalog,
            source,
            source,
            declaration,
            view,
            branchHistory,
            enteredBiomeCount,
            currentShopNames,
          ),
      });
    const snapshot = snapshotFor(branches);
    if (snapshot !== undefined) runStateSnapshotsByOwner.set(ownerKey, snapshot);
    for (const checkpoint of traitChildSettlementBuilders.values()) {
      if (
        semanticAddressKey(checkpoint.occurrenceOwner) !== semanticAddressKey(source.origin) ||
        checkpoint.runStateSnapshots.has(ownerKey)
      )
        continue;
      const checkpointSnapshot = snapshotFor(checkpoint.branches);
      if (checkpointSnapshot !== undefined)
        checkpoint.runStateSnapshots.set(ownerKey, checkpointSnapshot);
    }
  }

  function recordTargetSlotHistory(origin: TargetAddress, historySequence: number): void {
    if (branches.length === 0) {
      return;
    }
    targetHistoryByOrigin.set(
      semanticAddressKey(origin),
      Object.freeze({
        origin,
        historySequence,
        histories: Object.freeze(branches.map((branch) => branch.history)),
      }),
    );
  }

  function recordBlankFrontierTargetHistory(): void {
    const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
    if (frontier?.kind !== 'exitDecision' || frontier.parent.origin.kind !== 'occurrence') {
      return;
    }
    const source = rooms.get(semanticAddressKey(frontier.parent.origin));
    const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
    if (source === undefined || declaration === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${semanticAddressKey(frontier.origin)} has no reward-history frontier source`,
      );
    }
    const exitKeys =
      layout.progression.kind === 'hub'
        ? semanticAddressKey(frontier.parent.origin) ===
          semanticAddressKey(snapshot.entryRoom.origin)
          ? Object.freeze([layout.progression.entry.exitKey])
          : Object.freeze([])
        : Object.freeze(
            [...declaration.exits]
              .sort((left, right) => left.index - right.index)
              .map((exit) => `exit${exit.index}`),
          );
    const nextExitKey = exitKeys[frontier.targets.length];
    const historySequence = history.events.at(-1)?.sequence;
    if (nextExitKey === undefined || historySequence === undefined) {
      return;
    }
    const origin = createTargetAddress(
      createBiomeAddress(frontier.origin.routeKey, frontier.origin.biomeKey),
      frontier.origin.source,
      nextExitKey,
    );
    if (!targetHistoryByOrigin.has(semanticAddressKey(origin))) {
      recordTargetSlotHistory(origin, historySequence);
    }
  }

  function settleAuthoredAcquisitionSite(
    room: CanonicalAuthoredRoom,
    declaration: RoomDeclaration,
    roomView: ProgressiveRoomHistoryViews,
    sourceBranches: readonly RewardBranchState[],
    historySequence: number,
    targetFindings: Map<string, FindingRegionEntry>,
  ): readonly RewardBranchState[] {
    if (room.pickupSite !== undefined && room.entryState?.kind !== 'shop') {
      const producer = selectedPickupProducer(catalog, room.encounters);
      if (producer === undefined) fail('pickup site has no selected pickup producer');
      const pickupFacts = (branchHistory: RewardHistoryState) =>
        rewardFacts(
          catalog,
          room,
          room,
          declaration,
          roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
          branchHistory,
          enteredBiomeCount,
        );
      const findingChronology = rewardFindingChronologyForRoom(
        snapshot,
        room.origin,
        historySequence,
        'localRoomLifecycle',
      );
      const roomKey = semanticAddressKey(room.origin);
      if (!acquisitionOrderContexts.has(roomKey)) {
        acquisitionOrderContexts.set(
          roomKey,
          preparePickupAcquisitionOrderCandidateContext({
            catalog,
            room,
            branchesBeforePickups: sourceBranches,
            producerLifecycleKey: producer.disposition.producerLifecycleKey,
            historySequence,
            facts: pickupFacts,
          }),
        );
      }
      const settled = settlePickupAcquisitionSite(
        catalog,
        sourceBranches,
        {
          siteOwner: room.origin,
          entries: room.pickupSite.entries,
          order: room.pickupSite.order,
          producerLifecycleKey: producer.disposition.producerLifecycleKey,
          historySequence,
          findingChronology,
          facts: pickupFacts,
        },
        targetFindings,
      );
      recordAcquisitionRoleFrontiers(settled.roleFrontiers);
      recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
      for (const frontier of settled.pickupEntryFrontiers ?? []) {
        const entryKey = semanticAddressKey(frontier.address);
        indexRewardProducerFrontier(
          producerFrontiers,
          Object.freeze({
            generationPolicy: 'sequential',
            generationHistorySequence: historySequence,
            reachableBranchCount: frontier.branchesBeforeEntry.length,
            acquisitionHorizon: 'ownEnteredLifecycle',
            owners: Object.freeze([frontier.address]),
            evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
              if (semanticAddressKey(owner) !== entryKey) {
                return fail('pickup reward frontier received a foreign owner');
              }
              // A pickup producer fixes its reward identity. Candidate editing
              // may resolve only its declaration-compatible payload at this
              // exact ordered pre-entry frontier.
              if (offer.rewardType !== frontier.reward.offer.rewardType) {
                return Object.freeze({ findings: Object.freeze([]), supported: false });
              }
              const candidateFindings = new Map<string, FindingRegionEntry>();
              const candidateBranches = settlePickupAcquisitionSite(
                catalog,
                frontier.branchesBeforeEntry,
                {
                  siteOwner: room.origin,
                  entries: Object.freeze({
                    [frontier.address.entryKey]: createDefaultPickupRewardState(
                      catalog,
                      offer,
                      routeLoadout,
                      producer.disposition.producerLifecycleKey,
                    ),
                  }),
                  order: Object.freeze([frontier.address.entryKey]),
                  producerLifecycleKey: producer.disposition.producerLifecycleKey,
                  historySequence,
                  findingChronology,
                  facts: pickupFacts,
                },
                candidateFindings,
              ).branches;
              return candidateResult(candidateFindings, candidateBranches);
            },
          }),
        );
      }
      return settled.branches;
    }
    const roomKey = semanticAddressKey(room.origin);
    if (!acquisitionOrderContexts.has(roomKey)) {
      acquisitionOrderContexts.set(
        roomKey,
        prepareAcquisitionOrderCandidateContext({
          catalog,
          room,
          declaration,
          branchesBeforePurchases: sourceBranches,
          historySequence,
          facts: (candidateRoom, branchHistory, shopNames) =>
            rewardFacts(
              catalog,
              candidateRoom,
              candidateRoom,
              declaration,
              roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
              branchHistory,
              enteredBiomeCount,
              shopNames,
              undefined,
              undefined,
              rewardLookup.internal,
            ),
          fail,
        }),
      );
    }
    const settled = settleShopAcquisitionSite(
      sourceBranches,
      {
        catalog,
        room,
        declaration,
        historySequence,
        findingChronology: rewardFindingChronologyForRoom(
          snapshot,
          room.origin,
          historySequence,
          'localRoomLifecycle',
        ),
        facts: (branchHistory, shopNames = new Set()) =>
          rewardFacts(
            catalog,
            room,
            room,
            declaration,
            roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
            branchHistory,
            enteredBiomeCount,
            shopNames,
            undefined,
            undefined,
            rewardLookup.internal,
          ),
        fail,
      },
      targetFindings,
    );
    recordAcquisitionRoleFrontiers(settled.roleFrontiers);
    recordDerivedAcquisitionEntryFrontiers(settled.derivedEntryFrontiers);
    recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
    return settled.branches;
  }

  function completeIncomingOfferCandidate(
    entry: IncomingOfferCandidateContext,
    offer: CanonicalResolvedIncomingReward['offer'],
    candidateBranches: readonly RewardBranchState[],
    candidateFindings: Map<string, FindingRegionEntry>,
  ): RewardProducerCandidateResult {
    const producerPoints = entry.producerPoints ?? Object.freeze([]);
    if (
      candidateBranches.length > 0 &&
      entry.incoming.acquisitionEnabled !== false &&
      entry.acquisitionView !== undefined
    ) {
      {
        const candidateRoom = Object.freeze({
          ...entry.room,
          incomingReward: Object.freeze({ ...entry.incoming, offer }),
        });
        const candidateLifecycle =
          catalog.rewards.producerLifecycles.byKey[entry.incoming.producerLifecycleKey]?.rewardTypes
            .byKey[offer.rewardType];
        const candidateAcquisitionEvents =
          candidateLifecycle === undefined
            ? Object.freeze([])
            : Object.freeze(
                candidateLifecycle.acquisitionLifecycle.flatMap((binding) => {
                  const reached = producerPoints.find(
                    (event) => event.point === binding.lifecyclePoint,
                  );
                  return reached === undefined
                    ? []
                    : [
                        Object.freeze({
                          ...reached,
                          rewardType: offer.rewardType,
                          role: binding.role,
                          lifecyclePoint: binding.lifecyclePoint,
                          producerLifecycleKey: entry.incoming.producerLifecycleKey,
                          kind: 'producerRoleAdvanced' as const,
                        }),
                      ];
                }),
              );
        for (const acquisitionEvent of candidateAcquisitionEvents) {
          if (candidateBranches.length === 0) break;
          const settlement = settleProducerAcquisitionSite(
            catalog,
            candidateBranches,
            candidateRoom,
            acquisitionEvent,
            (branchHistory) =>
              rewardFacts(
                catalog,
                candidateRoom,
                candidateRoom,
                entry.declaration,
                entry.acquisitionView!,
                branchHistory,
                enteredBiomeCount,
              ),
            candidateFindings,
            fail,
            ownerRegion(entry.incoming.origin),
            rewardFindingChronologyForRoom(
              snapshot,
              entry.room.origin,
              acquisitionEvent.sequence,
              'localRoomLifecycle',
            ),
            acquisitionSiteOwner(snapshot, entry.room),
          );
          candidateBranches = settlement.branches;
        }
      }
    }
    return candidateResult(candidateFindings, candidateBranches);
  }

  function flushPendingHubBoard(): void {
    const pending = pendingHubBoard;
    if (pending === undefined || pending.offers.length === 0) return;
    const contexts = Object.freeze(pending.offers.map((entry) => entry.context));
    const owners = Object.freeze(pending.offers.map((entry) => entry.incoming.origin));
    const ownerKeys = new Set(owners.map(semanticAddressKey));
    const generationHistorySequence = Math.max(
      ...contexts.map((context) => context.historySequence),
    );
    const selectedBoardBranches = processOfferGenerationCohort(branches, contexts, findings, {
      ordering: 'sourceOffers',
    });
    const evaluateHubBoardOffer = (
      owner: SemanticAddress,
      offer: CanonicalResolvedIncomingReward['offer'],
    ): RewardProducerCandidateResult => {
      const ownerKey = semanticAddressKey(owner);
      if (!ownerKeys.has(ownerKey)) {
        return fail('Hub-board frontier received a foreign owner');
      }
      const candidateFindings = new Map<string, FindingRegionEntry>();
      const candidateContexts = contexts.map((context) =>
        semanticAddressKey(context.reward.origin) === ownerKey
          ? {
              ...context,
              reward: Object.freeze({ ...context.reward, offer }),
            }
          : context,
      );
      const selected = pending.offers.find(
        (entry) => semanticAddressKey(entry.incoming.origin) === ownerKey,
      );
      if (selected === undefined) return fail('Hub-board frontier lost its owner');
      const candidateBranches = processOfferGenerationCohort(
        pending.frontierBranches,
        candidateContexts,
        candidateFindings,
        { ordering: 'sourceOffers' },
      );
      if (
        candidateBranches.length > 0 ||
        selectedBoardBranches.length > 0 ||
        sameResolvedOffer(offer, selected.incoming.offer)
      ) {
        return completeIncomingOfferCandidate(
          selected,
          offer,
          candidateBranches,
          candidateFindings,
        );
      }

      // A newly opened Hub board starts from complete declaration defaults,
      // which can leave several sibling offers invalid at once. A changed
      // focused value must remain authorable when it is valid from the board's
      // pre-generation frontier; the selected board still owns complete
      // atomic validation and remains blocked until every sibling is repaired.
      const focusedFindings = new Map<string, FindingRegionEntry>();
      const focusedBranches = processRewardOffer(
        pending.frontierBranches,
        {
          ...selected.context,
          peers: Object.freeze([]),
          reward: Object.freeze({ ...selected.incoming, offer }),
        },
        focusedFindings,
      );
      return completeIncomingOfferCandidate(selected, offer, focusedBranches, focusedFindings);
    };
    for (const entry of pending.offers) {
      indexRewardProducerFrontier(
        producerFrontiers,
        Object.freeze({
          generationPolicy: 'jointUnordered',
          generationHistorySequence,
          reachableBranchCount: pending.frontierBranches.length,
          acquisitionHorizon:
            entry.acquisitionView === undefined || entry.acquisitionSequence === undefined
              ? 'generationOnly'
              : 'ownEnteredLifecycle',
          owners: Object.freeze([entry.incoming.origin]),
          ...(entry.context.reward.resolvedStoreKey === undefined
            ? {}
            : { resolvedStoreKey: entry.context.reward.resolvedStoreKey }),
          evaluateOffer: evaluateHubBoardOffer,
        }),
      );
    }
    branches = selectedBoardBranches;
    peers = Object.freeze(
      contexts.map((context) => ({ origin: context.reward.origin, offer: context.reward.offer })),
    );
    pendingHubBoard = undefined;
  }

  for (const event of history.events) {
    if (branches.length === 0) {
      break;
    }
    switch (event.kind) {
      case 'encounterStarted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room !== undefined && (room.kind === 'authored' || room.kind === 'localChild')) {
          const phase = room.encounterPhases.find(
            (candidate) => candidate.slotKey === event.phaseKey,
          );
          const phaseOwner =
            room.origin.kind === 'occurrence'
              ? { kind: 'occurrence' as const, occurrenceId: room.origin.occurrenceId }
              : {
                  kind: 'localChild' as const,
                  occurrenceId: room.origin.occurrenceId,
                  groupKey: room.origin.groupKey,
                  slotKey: room.origin.slotKey,
                };
          if (phase !== undefined) {
            const origin = createEncounterPhaseAddress(
              createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
              phaseOwner,
              event.phaseKey,
            );
            const isBiomeStart =
              snapshot.entryRoom !== undefined &&
              semanticAddressKey(snapshot.entryRoom.origin) === semanticAddressKey(event.origin);
            const blockedByEnvelope = room.encounterPhases.some(
              (candidate) => candidate.blocksFigLeaf,
            );
            const nonLeadingCascadePhase =
              phase.skipEndEncounterEffects === true &&
              room.encounterPhases[0]?.slotKey !== phase.slotKey;
            // Fig Leaf is a single chronological resource even when rewards
            // have multiple branches. Attest the complete frontier before
            // deriving candidates/findings; never silently choose branch 0.
            const figLeaf = attestFigLeafBranchState(branches);
            const assessment = assessFigLeafSkip({
              selected: phase.figLeafSkip,
              canEncounterSkip: phase.canEncounterSkip,
              biomeStart: isBiomeStart,
              blockedByEnvelope,
              nonLeadingCascadePhase,
              remainingUses: figLeaf?.remainingUses ?? 0,
              activatedThisBiome: figLeaf?.activatedThisBiome ?? false,
              selectionAlreadyResolved: event.figLeafSkipOwner !== true,
            });
            if (phase.figLeafSkip === true && !assessment.legal) {
              addRewardFinding(
                findings,
                Object.freeze({
                  code: 'figLeafSkipUnavailable',
                  severity: 'error',
                  phase: 'encounterResolution',
                  origin,
                  evidence: Object.freeze(
                    assessment.reason === undefined ? {} : { reason: assessment.reason },
                  ),
                }),
                ownerRegion(origin),
                historyFindingChronology(event.sequence),
              );
            }
            if (
              phase.canEncounterSkip &&
              !isBiomeStart &&
              !blockedByEnvelope &&
              !nonLeadingCascadePhase &&
              figLeaf !== undefined
            ) {
              figLeafPhaseCandidates.set(
                semanticAddressKey(origin),
                Object.freeze({
                  origin,
                  supported: figLeaf.remainingUses > 0 && !figLeaf.activatedThisBiome,
                  selected: phase.figLeafSkip === true,
                  remainingUses: figLeaf.remainingUses,
                  activatedThisBiome: figLeaf.activatedThisBiome,
                }),
              );
            }
          }
        }
        if (event.figLeafSkipOwner) {
          attestFigLeafBranchState(branches);
          branches = Object.freeze(
            branches.map((branch) =>
              Object.freeze({ ...branch, keepsakes: consumeFigLeafUse(branch.keepsakes) }),
            ),
          );
        }
        // Gorgon is an additive appearance on the existing phase. Eligibility
        // is evaluated at the predecessor/pre-room checkpoint after Fig Leaf
        // execution; the pending branch remains untouched until completion.
        const gorgonDeclaration =
          room !== undefined && (room.kind === 'authored' || room.kind === 'localChild')
            ? catalog.rooms.byKey[room.gameName]
            : undefined;
        const gorgonView =
          room === undefined ? undefined : views.get(semanticAddressKey(room.origin));
        const gorgonPhase =
          room !== undefined && (room.kind === 'authored' || room.kind === 'localChild')
            ? room.encounterPhases.find((candidate) => candidate.slotKey === event.phaseKey)
            : undefined;
        if (
          room !== undefined &&
          (room.kind === 'authored' || room.kind === 'localChild') &&
          gorgonDeclaration !== undefined &&
          gorgonPhase !== undefined &&
          gorgonView !== undefined
        ) {
          const gorgonStatus = attestGorgonBranchState(branches);
          const gorgonRarity = attestPendingGorgonRarity(branches);
          const selectedEncounterKey = selectedEncounterDefinitionKey(
            catalog,
            gorgonDeclaration,
            room.encounters,
            event.phaseKey,
            semanticAddressKey(event.origin),
          );
          const gorgonEffect = catalog.keepsakes.values.find(
            (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
          )?.effect;
          const gorgonOrigin = createEncounterPhaseAddress(
            createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
            room.kind === 'authored'
              ? { kind: 'occurrence', occurrenceId: room.occurrenceId }
              : {
                  kind: 'localChild',
                  occurrenceId: room.origin.occurrenceId,
                  groupKey: room.groupKey,
                  slotKey: room.slotKey,
                },
            event.phaseKey,
          );
          const gorgonCandidateSupported =
            !gorgonEvaluationBlocked &&
            gorgonStatus === 'pending' &&
            gorgonEffect?.kind === 'gorgonAmulet' &&
            gorgonView.preparation.ledgers.counters.biomeDepthCache >=
              gorgonEffect.minimumBiomeDepth &&
            gorgonDeclaration.blocksGorgon === false &&
            gorgonPhase.blocksGorgon === false &&
            selectedEncounterKey !== undefined &&
            catalog.encounterDefinitions.byKey[selectedEncounterKey]?.hostsGorgon === true &&
            event.execution === 'normal';
          gorgonPhaseCandidates.set(
            semanticAddressKey(gorgonOrigin),
            Object.freeze({
              origin: gorgonOrigin,
              supported: gorgonCandidateSupported,
              ...(gorgonRarity === undefined ? {} : { rarity: gorgonRarity }),
            }),
          );
          if (
            gorgonStatus === 'pending' &&
            gorgonEffect?.kind === 'gorgonAmulet' &&
            selectedEncounterKey === gorgonEffect.naturalEncounterKey
          ) {
            branches = Object.freeze(
              branches.map((branch) =>
                Object.freeze({ ...branch, keepsakes: expirePendingGorgon(branch.keepsakes) }),
              ),
            );
          } else if (
            assessGorgonEligibility({
              status: gorgonStatus,
              biomeDepthCache: gorgonView.preparation.ledgers.counters.biomeDepthCache,
              minimumBiomeDepth:
                gorgonEffect?.kind === 'gorgonAmulet'
                  ? gorgonEffect.minimumBiomeDepth
                  : Number.POSITIVE_INFINITY,
              roomBlocked: gorgonDeclaration.blocksGorgon === true,
              encounterBlocked:
                gorgonPhase.blocksGorgon === true ||
                selectedEncounterKey === undefined ||
                catalog.encounterDefinitions.byKey[selectedEncounterKey]?.hostsGorgon !== true,
              figLeafSkipped: event.execution === 'skippedByFigLeaf',
              deathDefianceConditionMet:
                room.encounters.gorgonResultByPhase?.[event.phaseKey]?.deathDefianceConditionMet ===
                true,
            })
          ) {
            if (!gorgonEvaluationBlocked)
              eligibleGorgonPhases.add(`${semanticAddressKey(event.origin)}::${event.phaseKey}`);
          }
        }
        branches = advanceRewardBranches(branches, event.sequence);
        break;
      }
      case 'roomPrepared':
        branches = beginRewardRoom(branches, event.sequence);
        break;
      case 'roomCreated': {
        if (
          event.origin.kind === 'completionRoom' &&
          event.origin.role === 'postboss' &&
          snapshot.kind === 'biome' &&
          snapshot.postbossKeepsakeDisposition !== undefined
        ) {
          const disposition = snapshot.postbossKeepsakeDisposition;
          const selection = createPostbossKeepsakeSelectionAddress(event.origin);
          const historyAtRack = views.get(semanticAddressKey(event.origin))?.entry;
          keepsakeSelectionContexts.set(
            semanticAddressKey(selection),
            Object.freeze({
              state: branches[0]!.keepsakes,
              encounterBlockedKeepsakeKeys: Object.freeze([
                ...new Set(
                  historyAtRack?.ledgers.encounterRecords.flatMap(
                    (encounter) =>
                      catalog.encounterDefinitions.byKey[encounter.encounterKey]
                        ?.blocksKeepsakeSelectionKeys ?? [],
                  ) ?? [],
                ),
              ]),
            }),
          );
          const encounterBlockedKeepsakeKeys = keepsakeSelectionContexts.get(
            semanticAddressKey(selection),
          )!.encounterBlockedKeepsakeKeys;
          const invalidReplacement =
            disposition.kind === 'replace' &&
            branches.some(
              (branch) =>
                keepsakeSelectionUnavailableReason(
                  catalog,
                  branch.keepsakes,
                  disposition.keepsakeKey,
                  encounterBlockedKeepsakeKeys,
                ) !== undefined,
            );
          if (invalidReplacement) {
            addRewardFinding(
              findings,
              rewardFinding('keepsakeUnavailable', selection, {
                key: disposition.keepsakeKey,
                reason: 'unavailableAtRack',
              }),
              ownerRegion(selection),
              historyFindingChronology(event.sequence),
            );
          }
          // The parent selection remains repairable when a replacement is
          // unavailable. Its effect child, however, is reached only by the
          // branches that actually crossed the rack boundary. Keep that
          // explicit pre/post attestation instead of deriving reachability
          // from the persisted disposition alone.
          let rackTransitions = branches.map((branch) => {
            const before = branch.keepsakes;
            const unavailable =
              disposition.kind === 'replace' &&
              keepsakeSelectionUnavailableReason(
                catalog,
                before,
                disposition.keepsakeKey,
                encounterBlockedKeepsakeKeys,
              ) !== undefined;
            const equippedRank =
              disposition.kind === 'replace' && !unavailable
                ? keepsakeRankForEquip(
                    catalog,
                    disposition.keepsakeKey,
                    branch.traitHistory ?? createTraitHistoryState(),
                  )
                : undefined;
            const after = unavailable
              ? before
              : applyKeepsakeDisposition(
                  catalog,
                  before,
                  disposition,
                  branch.arcanaFear,
                  equippedRank,
                );
            const replacementSucceeded =
              disposition.kind === 'replace' &&
              before.currentKey !== after.currentKey &&
              after.currentKey === disposition.keepsakeKey;
            return Object.freeze({
              branch: Object.freeze({ ...branch, keepsakes: after }),
              replacementSucceeded,
              ...(equippedRank === undefined ? {} : { equippedRank }),
            });
          });
          rackTransitions = rackTransitions.map((transition) => {
            const branch = transition.branch;
            if (
              branch.keepsakes.fatedStatus !== 'Unfated' ||
              branch.keepsakes.jeweledPom?.active !== true
            )
              return transition;
            const prior = branch.traitHistory ?? createTraitHistoryState();
            const traitHistory = foldTraitHistoryEvents(catalog, [
              ...prior.events,
              Object.freeze({
                kind: 'traitRemoval' as const,
                owner: selection,
                acquisitionRole: 'jeweledPomCleanup',
                sequence: event.sequence,
                acquisitionPoint: 'keepsakeFatedInvalidation',
                traitKey: branch.keepsakes.jeweledPom.grantedTraitKey,
                acquisitionIdentity: branch.keepsakes.jeweledPom.acquisitionIdentity,
              }),
            ]);
            return Object.freeze({
              ...transition,
              branch: Object.freeze({
                ...branch,
                history: attachTraitHistory(branch.history, traitHistory),
                traitHistory,
                keepsakes: invalidateJeweledPom(branch.keepsakes),
              }),
            });
          });
          branches = Object.freeze(rackTransitions.map((transition) => transition.branch));
          if (disposition.kind === 'replace') {
            const successfulReplacementTransitions = Object.freeze(
              rackTransitions.filter((transition) => transition.replacementSucceeded),
            );
            const successfulReplacementBranches = Object.freeze(
              successfulReplacementTransitions.map((transition) => transition.branch),
            );
            if (jeweledPomEffectForKey(catalog, disposition.keepsakeKey) !== undefined) {
              const result = createKeepsakeEquipResultAddress(selection, 'jeweledPom');
              if (
                successfulReplacementBranches.length > 0 &&
                snapshot.keepsakeEquipResults?.jeweledPom === undefined
              ) {
                addRewardFinding(
                  findings,
                  rewardFinding('keepsakeEquipResultMissing', result, {
                    keepsakeKey: disposition.keepsakeKey,
                  }),
                  ownerRegion(selection.owner),
                  historyFindingChronology(event.sequence),
                );
              } else if (
                successfulReplacementBranches.some(
                  (branch) =>
                    !assessJeweledPomEquipResult(
                      catalog,
                      snapshot.keepsakeEquipResults!.jeweledPom!,
                      branch.traitHistory ?? createTraitHistoryState(),
                      branch.keepsakes.fatedStatus,
                    ).legal,
                )
              ) {
                addRewardFinding(
                  findings,
                  rewardFinding('keepsakeEquipResultUnavailable', result, {
                    keepsakeKey: disposition.keepsakeKey,
                  }),
                  ownerRegion(selection.owner),
                  historyFindingChronology(event.sequence),
                );
              }
              if (successfulReplacementBranches.length > 0) {
                keepsakeEquipResultContexts.set(
                  semanticAddressKey(result),
                  Object.freeze({
                    frontiers: Object.freeze(
                      successfulReplacementBranches.map((branch) =>
                        Object.freeze({
                          before: branch.traitHistory ?? createTraitHistoryState(),
                          fatedStatus: branch.keepsakes.fatedStatus,
                          ...(branch.arcanaFear === undefined
                            ? {}
                            : { arcanaFear: branch.arcanaFear }),
                        }),
                      ),
                    ),
                  }),
                );
              }
            }
            if (
              catalog.keepsakes.byKey[disposition.keepsakeKey]?.effect?.kind ===
              'experimentalHammer'
            ) {
              const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
              if (
                successfulReplacementBranches.length > 0 &&
                snapshot.keepsakeEquipResults?.experimentalHammer === undefined
              ) {
                addRewardFinding(
                  findings,
                  rewardFinding('keepsakeEquipResultMissing', result, {
                    keepsakeKey: disposition.keepsakeKey,
                  }),
                  ownerRegion(selection.owner),
                  historyFindingChronology(event.sequence),
                );
              } else if (
                successfulReplacementBranches.some(
                  (branch) =>
                    !assessExperimentalHammerEquipResult(
                      catalog,
                      snapshot.keepsakeEquipResults!.experimentalHammer!,
                      branch.traitHistory ?? createTraitHistoryState(),
                      routeLoadout,
                    ).legal,
                )
              ) {
                addRewardFinding(
                  findings,
                  rewardFinding('keepsakeEquipResultUnavailable', result, {
                    keepsakeKey: disposition.keepsakeKey,
                  }),
                  ownerRegion(selection.owner),
                  historyFindingChronology(event.sequence),
                );
              }
              if (successfulReplacementBranches.length > 0) {
                keepsakeEquipResultContexts.set(
                  semanticAddressKey(result),
                  Object.freeze({
                    frontiers: Object.freeze(
                      successfulReplacementBranches.map((branch) =>
                        Object.freeze({
                          before: branch.traitHistory ?? createTraitHistoryState(),
                          fatedStatus: branch.keepsakes.fatedStatus,
                          arcanaFear: branch.arcanaFear,
                          loadout: routeLoadout,
                        }),
                      ),
                    ),
                  }),
                );
              }
            }
            rackTransitions = rackTransitions.map((transition) =>
              !transition.replacementSucceeded
                ? transition
                : Object.freeze({
                    ...transition,
                    branch: applyJeweledPomEquipResult(
                      catalog,
                      transition.branch,
                      disposition.keepsakeKey,
                      snapshot.keepsakeEquipResults,
                      createKeepsakeEquipResultAddress(selection, 'jeweledPom'),
                      event.sequence,
                      transition.equippedRank,
                    ),
                  }),
            );
            rackTransitions = rackTransitions.map((transition) =>
              !transition.replacementSucceeded
                ? transition
                : Object.freeze({
                    ...transition,
                    branch: applyExperimentalHammerEquipResult(
                      catalog,
                      transition.branch,
                      disposition.keepsakeKey,
                      snapshot.keepsakeEquipResults,
                      createKeepsakeEquipResultAddress(selection, 'experimentalHammer'),
                      event.sequence,
                      routeLoadout,
                      transition.equippedRank,
                    ),
                  }),
            );
            branches = Object.freeze(rackTransitions.map((transition) => transition.branch));
          }
        }
        if (event.source === 'generatedTarget' && event.parentOrigin.kind === 'hubRoom') {
          const handoff = batchesByParent.get(semanticAddressKey(event.parentOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          const handoffView = parentViews?.targetGenerations.find(
            (candidate) =>
              semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
          )?.before;
          const handoffTarget = handoff?.targets.find(
            (target) =>
              semanticAddressKey(target.origin) === semanticAddressKey(event.targetOrigin),
          );
          if (
            handoffTarget !== undefined &&
            handoff?.origin.source.kind === 'hubDecision' &&
            parent?.kind === 'hub' &&
            handoffView !== undefined
          ) {
            captureRunState(handoff.origin, parent, handoffView);
          }
        }
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room === undefined) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (room.gameName !== event.gameName) {
          throw new BiomeRewardSimulationContractError(
            `${semanticAddressKey(event.origin)} is ${room.gameName} in the snapshot but ${event.gameName} in history`,
          );
        }
        if (room.kind === 'hub') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const incoming = room.incomingReward;
        const localRewards = room.kind === 'authored' ? (room.localRewards ?? []) : [];
        if (incoming === undefined && localRewards.length === 0) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const declaration = catalog.rooms.byKey[room.gameName];
        if (declaration === undefined) {
          throw new BiomeRewardSimulationContractError(`${room.gameName} has no declaration`);
        }
        let source: CanonicalRewardSource = room;
        let currentRoom: CanonicalRewardSource | undefined =
          event.source === 'biomeEntry' ? undefined : room;
        let view = views.get(semanticAddressKey(room.origin))?.preparation;
        let currentShopNames: ReadonlySet<string> = new Set();
        let peerParentOrigin: CanonicalRewardSource['origin'] = source.origin;
        let peerCreationSource: RoomCreationSource = 'generatedTarget';
        if (event.source === 'generatedTarget') {
          const target = targets.get(semanticAddressKey(event.targetOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          if (target === undefined) {
            throw new BiomeRewardSimulationContractError('generated reward lost its source room');
          }
          if (
            semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin) ||
            semanticAddressKey(target.origin) !== semanticAddressKey(event.targetOrigin)
          ) {
            throw new BiomeRewardSimulationContractError(
              `target ${semanticAddressKey(event.targetOrigin)} does not match its reward history event`,
            );
          }
          if (parent !== undefined && parentViews !== undefined) {
            if (semanticAddressKey(parent.origin) !== semanticAddressKey(event.parentOrigin)) {
              throw new BiomeRewardSimulationContractError(
                `target ${semanticAddressKey(event.targetOrigin)} has the wrong reward parent`,
              );
            }
            source = parent;
            currentRoom = parent;
            view =
              parentViews.targetGenerations.find(
                (candidate) =>
                  semanticAddressKey(candidate.targetOrigin) ===
                  semanticAddressKey(event.targetOrigin),
              )?.before ?? parentViews.preOutgoing!;
            currentShopNames = new Set(
              (parent.kind === 'authored' ? parent.entryState?.offers : undefined)?.map(
                (offer) => offer.offer.rewardType,
              ) ?? [],
            );
          } else if (event.parentOrigin.kind !== 'hubRoom') {
            throw new BiomeRewardSimulationContractError('generated reward lost its source room');
          }
          const targetKey = semanticAddressKey(event.targetOrigin);
          const expectedStore = expectedStores.get(targetKey);
          const resolvedStores = [
            ...(incoming === undefined || countedBinding(declaration, incoming) === undefined
              ? []
              : [incoming.resolvedStoreKey]),
            ...localRewards.map((reward) => reward.resolvedStoreKey),
          ];
          if (
            expectedStores.has(targetKey) &&
            resolvedStores.some((storeKey) => storeKey !== expectedStore)
          ) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} resolved a reward store other than ${String(expectedStore)}`,
            );
          }
        } else if (event.source === 'additionalExit') {
          const continuation = additionalContinuations.get(
            semanticAddressKey(event.additionalOrigin),
          );
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          if (
            continuation === undefined ||
            parent === undefined ||
            parent.kind !== 'authored' ||
            parentViews?.entry === undefined ||
            semanticAddressKey(continuation.room.origin) !== semanticAddressKey(event.origin)
          ) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} lost its entry-time additional continuation source`,
            );
          }
          source = parent;
          currentRoom = parent;
          view = parentViews.entry;
          currentShopNames = new Set(
            (parent.entryState?.kind === 'shop' ? parent.entryState.offers : []).map(
              (offer) => offer.offer.rewardType,
            ),
          );
        } else if (event.source === 'hubTarget') {
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const target = hubTargetByOrigin.get(semanticAddressKey(event.targetOrigin));
          if (
            parent?.kind !== 'hub' ||
            target === undefined ||
            semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin)
          ) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} lost its declaration-owned Hub reward source`,
            );
          }
          source = parent;
          currentRoom = parent;
          view = parentViews?.targetGenerations.find(
            (candidate) =>
              semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
          )?.before;
          peerParentOrigin = parent.origin;
          peerCreationSource = 'hubTarget';
        } else if (event.source === 'localChild') {
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          if (parent?.kind !== 'authored') {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} lost its parent-local reward source`,
            );
          }
          source = parent;
          currentRoom = parent;
          view = parentViews?.targetGenerations.find(
            (candidate) =>
              semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
          )?.before;
          peerParentOrigin = parent.origin;
          peerCreationSource = 'localChild';
        } else if (localRewards.length !== 0) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} materialized local rewards outside a generated target`,
          );
        }
        if (view === undefined) {
          // A blocked entry can publish only its valid encounter-record
          // prefix. It deliberately has no room-preparation view and therefore
          // cannot acquire or publish entry-owned reward effects. Generated
          // targets keep their parent offer-time view above, so their already
          // offered door rewards remain independently modeled.
          if (event.source === 'biomeEntry' && !views.has(semanticAddressKey(room.origin))) {
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} has no offer-time history view`,
          );
        }
        if (incoming !== undefined) {
          const binding = countedBinding(declaration, incoming);
          const frontierBranches = branches;
          const offerFindingChronology =
            event.source === 'hubTarget'
              ? Object.freeze({
                  kind: 'hubBoard' as const,
                  history: historyFindingChronology(event.sequence),
                })
              : event.source === 'localChild'
                ? rewardFindingChronologyForRoom(
                    snapshot,
                    room.origin,
                    event.sequence,
                    'sideGeneration',
                  )
                : undefined;
          const offerContext = {
            catalog,
            reward: incoming,
            ...(binding === undefined ? {} : { binding }),
            historySequence: event.sequence,
            ...(offerFindingChronology === undefined
              ? {}
              : { findingChronology: offerFindingChronology }),
            peers,
            facts: (branchHistory: RewardHistoryState) =>
              rewardFacts(
                catalog,
                source,
                currentRoom,
                catalog.rooms.byKey[source.gameName] ?? declaration,
                view,
                branchHistory,
                enteredBiomeCount,
                currentShopNames,
                source.kind === 'hub' ? source.origin : peerParentOrigin,
                source.kind === 'hub' ? 'hubTarget' : peerCreationSource,
              ),
          };
          const incomingOwnerKey = semanticAddressKey(incoming.origin);
          const producerPoints = history.events.filter(
            (
              candidate,
            ): candidate is Extract<HistoryEvent, { readonly kind: 'producerPointReached' }> =>
              candidate.kind === 'producerPointReached' &&
              semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
          );
          const candidateRoomView = views.get(semanticAddressKey(room.origin));
          // An Anomaly failure still owns a consumed door offer, but its
          // lifecycle deliberately omits the producer acquisition. Candidate
          // evaluation must not manufacture that missing event from the
          // room's generic lifecycle view.
          const acquisitionView =
            incoming.acquisitionEnabled === false
              ? undefined
              : (candidateRoomView?.preOutgoing ?? candidateRoomView?.entry);
          const acquisitionSequence =
            incoming.acquisitionEnabled === false
              ? undefined
              : (producerPoints.at(-1)?.sequence ?? acquisitionView?.sequence);
          const candidateContext: IncomingOfferCandidateContext = Object.freeze({
            context: offerContext,
            room,
            declaration,
            incoming,
            ...(acquisitionView === undefined ? {} : { acquisitionView }),
            ...(acquisitionSequence === undefined ? {} : { acquisitionSequence }),
            ...(producerPoints.length === 0 ? {} : { producerPoints }),
          });
          if (event.source === 'hubTarget') {
            if (pendingHubBoard === undefined) {
              pendingHubBoard = { frontierBranches, offers: [] };
            }
            pendingHubBoard.offers.push(candidateContext);
          } else {
            indexRewardProducerFrontier(
              producerFrontiers,
              Object.freeze({
                generationPolicy: 'sequential',
                generationHistorySequence: event.sequence,
                reachableBranchCount: frontierBranches.length,
                acquisitionHorizon:
                  acquisitionView === undefined || acquisitionSequence === undefined
                    ? 'generationOnly'
                    : 'ownEnteredLifecycle',
                owners: Object.freeze([incoming.origin]),
                ...(binding === undefined || incoming.resolvedStoreKey === undefined
                  ? {}
                  : { resolvedStoreKey: incoming.resolvedStoreKey }),
                evaluateOffer: (
                  owner: SemanticAddress,
                  offer: CanonicalResolvedIncomingReward['offer'],
                ) => {
                  if (semanticAddressKey(owner) !== incomingOwnerKey) {
                    return fail('sequential reward frontier received a foreign owner');
                  }
                  const candidateFindings = new Map<string, FindingRegionEntry>();
                  const candidateBranches = processRewardOffer(
                    frontierBranches,
                    {
                      ...offerContext,
                      reward: Object.freeze({ ...incoming, offer }),
                    },
                    candidateFindings,
                  );
                  return completeIncomingOfferCandidate(
                    candidateContext,
                    offer,
                    candidateBranches,
                    candidateFindings,
                  );
                },
              }),
            );
            branches = processRewardOffer(branches, offerContext, findings);
          }
          if (event.source === 'generatedTarget' || event.source === 'localChild') {
            peers = Object.freeze([
              ...peers,
              { origin: event.targetOrigin, offer: incoming.offer },
            ]);
          }
        }
        for (const localReward of localRewards) {
          const frontierBranches = branches;
          const offerFindingChronology =
            event.source === 'localChild'
              ? rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                )
              : undefined;
          const offerContext = {
            catalog,
            reward: localReward,
            binding: localRewardBinding(declaration, localReward),
            historySequence: event.sequence,
            ...(offerFindingChronology === undefined
              ? {}
              : { findingChronology: offerFindingChronology }),
            peers,
            facts: (branchHistory: RewardHistoryState) =>
              rewardFacts(
                catalog,
                source,
                currentRoom,
                catalog.rooms.byKey[source.gameName] ?? declaration,
                view,
                branchHistory,
                enteredBiomeCount,
                currentShopNames,
              ),
          };
          const localOwnerKey = semanticAddressKey(localReward.origin);
          const acquisitionEvent = history.events.find(
            (candidate) =>
              candidate.kind === 'encounterCompleted' &&
              semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin) &&
              candidate.phaseKey === localReward.encounterPhaseKey,
          );
          const candidateRoomView = views.get(semanticAddressKey(room.origin));
          const acquisitionView = candidateRoomView?.preOutgoing ?? candidateRoomView?.entry;
          indexRewardProducerFrontier(
            producerFrontiers,
            Object.freeze({
              generationPolicy: 'sequential',
              generationHistorySequence: event.sequence,
              reachableBranchCount: frontierBranches.length,
              acquisitionHorizon:
                acquisitionEvent?.kind !== 'encounterCompleted' || acquisitionView === undefined
                  ? 'generationOnly'
                  : 'ownEnteredLifecycle',
              owners: Object.freeze([localReward.origin]),
              resolvedStoreKey: localReward.resolvedStoreKey,
              evaluateOffer: (
                owner: SemanticAddress,
                offer: CanonicalResolvedIncomingReward['offer'],
              ) => {
                if (semanticAddressKey(owner) !== localOwnerKey) {
                  return fail('local reward frontier received a foreign owner');
                }
                const candidateFindings = new Map<string, FindingRegionEntry>();
                let candidateBranches = processRewardOffer(
                  frontierBranches,
                  {
                    ...offerContext,
                    reward: Object.freeze({ ...localReward, offer }),
                  },
                  candidateFindings,
                );
                if (
                  candidateBranches.length > 0 &&
                  acquisitionEvent?.kind === 'encounterCompleted' &&
                  acquisitionView !== undefined
                ) {
                  candidateBranches = settleOwnedAcquisitionSite(
                    catalog,
                    candidateBranches,
                    {
                      siteOwner: localReward.origin,
                      pointKey: localReward.encounterPhaseKey,
                      entryKey: localReward.slotKey,
                      source: Object.freeze({ ...localReward, offer, instanceProvenance: 'free' }),
                      historySequence: acquisitionEvent.sequence,
                    },
                    (branchHistory) =>
                      rewardFacts(
                        catalog,
                        room,
                        room,
                        declaration,
                        acquisitionView,
                        branchHistory,
                        enteredBiomeCount,
                      ),
                    candidateFindings,
                    ownerRegion(localReward.origin),
                    rewardFindingChronologyForRoom(
                      snapshot,
                      room.origin,
                      acquisitionEvent.sequence,
                      'localRoomLifecycle',
                    ),
                  ).branches;
                }
                return candidateResult(candidateFindings, candidateBranches);
              },
            }),
          );
          branches = processRewardOffer(branches, offerContext, findings);
          peers = Object.freeze([
            ...peers,
            { origin: localReward.origin, offer: localReward.offer },
          ]);
        }
        break;
      }
      case 'targetGenerationCompleted': {
        if (
          event.origin.kind === 'hubSlot' &&
          pendingHubBoard?.offers.length === hubTargetByOrigin.size
        ) {
          flushPendingHubBoard();
        }
        if (event.origin.kind === 'target') {
          const generation = targetGenerationByParent.get(semanticAddressKey(event.parentOrigin));
          const currentOffset = generation?.exitKeys.indexOf(event.origin.exitKey) ?? -1;
          if (generation !== undefined && currentOffset + 1 === event.generationIndex) {
            const nextExitKey = generation.exitKeys[currentOffset + 1];
            if (nextExitKey !== undefined) {
              recordTargetSlotHistory(
                createTargetAddress(
                  createBiomeAddress(generation.origin.routeKey, generation.origin.biomeKey),
                  generation.origin.source,
                  nextExitKey,
                ),
                event.sequence,
              );
            }
          }
        }
        branches = advanceRewardBranches(branches, event.sequence);
        break;
      }
      case 'outgoingGenerationCheckpoint': {
        if (event.origin.kind === 'hubRoom') {
          peers = Object.freeze([]);
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const source = rooms.get(semanticAddressKey(event.origin));
        const sourceViews = views.get(semanticAddressKey(event.origin));
        const declaration = source && catalog.rooms.byKey[source.gameName];
        if (source === undefined || sourceViews === undefined || declaration === undefined) {
          throw new BiomeRewardSimulationContractError(
            'outgoing reward checkpoint has no authored source',
          );
        }
        const batch = batchesByParent.get(semanticAddressKey(event.origin));
        const hubDecision = hubDecisionsBySource.get(semanticAddressKey(event.origin));
        if (hubDecision !== undefined) {
          const checkpoint = sourceViews.preOutgoing;
          if (checkpoint !== undefined) {
            captureRunState(hubDecision.origin, source, checkpoint);
          }
        } else if (batch !== undefined) {
          const checkpoint = sourceViews.preOutgoing;
          if (checkpoint !== undefined) {
            captureRunState(batch.origin, source, checkpoint);
          }
        } else if (
          batch === undefined &&
          frontierSource === semanticAddressKey(event.origin) &&
          snapshot.kind === 'biomePrefix' &&
          snapshot.frontier?.kind === 'exitDecision'
        ) {
          const checkpoint = sourceViews.preOutgoing;
          if (checkpoint !== undefined) {
            captureRunState(snapshot.frontier.origin, source, checkpoint);
          }
        }
        const targetSet = batch?.targets;
        if (targetSet === undefined) {
          if (
            hubTakeoverSources.has(semanticAddressKey(event.origin)) ||
            hubRestoringSources.has(semanticAddressKey(event.origin)) ||
            semanticAddressKey(event.origin) === frontierSource
          ) {
            peers = Object.freeze([]);
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          throw new BiomeRewardSimulationContractError(
            `${source.gameName} has no outgoing reward batch`,
          );
        }
        const generationOrigin = batch?.origin;
        if (generationOrigin === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${source.gameName} has no outgoing generation owner`,
          );
        }
        const exitKeys = Object.freeze(targetSet.map((target) => target.exit.exitKey));
        targetGenerationByParent.set(
          semanticAddressKey(event.origin),
          Object.freeze({ origin: generationOrigin, exitKeys }),
        );
        const firstExitKey = exitKeys[0];
        if (firstExitKey !== undefined) {
          recordTargetSlotHistory(
            createTargetAddress(
              createBiomeAddress(generationOrigin.routeKey, generationOrigin.biomeKey),
              generationOrigin.source,
              firstExitKey,
            ),
            event.sequence,
          );
        }
        let sharedStore: string | undefined;
        const rewardStore = batch?.rewardStore;
        if (rewardStore !== undefined) {
          if (rewardStore.kind === 'authoredBaseStore') {
            if (source.kind !== 'authored') {
              throw new BiomeRewardSimulationContractError(
                `${source.gameName} cannot own an authored base reward store`,
              );
            }
            const support = storeSupport(
              layout,
              { rewardStore },
              source,
              declaration,
              sourceViews.preOutgoing ?? sourceViews.preparation,
              event.sequence,
            );
            storeSupportEntries.push(support);
            sharedStore = support.authoredStoreKey;
            if (!support.selectedPossible) {
              addRewardFinding(
                findings,
                rewardFinding('baseRewardStoreUnavailable', support.origin, {
                  authoredStoreKey: support.authoredStoreKey,
                  enteredStoreCount: support.enteredStoreCount,
                  enteredMetaStoreCount: support.enteredMetaStoreCount,
                  currentMetaRatio: support.currentMetaRatio,
                  metaSelectionValue: support.metaSelectionValue,
                  supportStoreKeys: support.supportStoreKeys,
                }),
                ownerRegion(support.origin),
                { kind: 'history', sequence: event.sequence, boundary: 'at' },
              );
            }
          } else if (rewardStore.kind === 'sourceOfferPoint') {
            if (source.kind !== 'authored') {
              throw new BiomeRewardSimulationContractError(
                `${source.gameName} cannot own a source reward wheel`,
              );
            }
            const wheel = source.rewardWheels?.at(-1);
            if (wheel === undefined) {
              throw new BiomeRewardSimulationContractError(
                `${source.gameName} lost its active source reward wheel`,
              );
            }
            sharedStore = wheel.storeKey;
          } else if (rewardStore.kind !== 'none') {
            throw new BiomeRewardSimulationContractError(
              `${source.gameName} exposes an unsupported generated reward store`,
            );
          }
        }
        for (const [targetKey, storeKey] of expectedTargetStores(catalog, targetSet, sharedStore)) {
          expectedStores.set(targetKey, storeKey);
        }
        peers = Object.freeze([]);
        branches = advanceRewardBranches(branches, event.sequence);
        break;
      }
      case 'offerPointMaterialized': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (
          room === undefined ||
          room.kind !== 'authored' ||
          declaration === undefined ||
          roomView === undefined
        ) {
          throw new BiomeRewardSimulationContractError('shop offer point has no authored room');
        }
        if (event.offerPoint === 'shopInventory') {
          const frontierBranches = branches;
          const owners = Object.freeze(
            (room.entryState?.kind === 'shop' ? room.entryState.offers : []).map(
              (offer) => offer.offerOrigin,
            ),
          );
          const ownerKeys = new Set(owners.map(semanticAddressKey));
          const shopContext = {
            catalog,
            room,
            declaration,
            historySequence: event.sequence,
            findingChronology: rewardFindingChronologyForRoom(
              snapshot,
              room.origin,
              event.sequence,
              'localRoomLifecycle',
            ),
            facts: (
              branchHistory: RewardHistoryState,
              shopNames: ReadonlySet<string> = new Set(),
            ) =>
              rewardFacts(
                catalog,
                room,
                room,
                declaration,
                roomView.preparation,
                branchHistory,
                enteredBiomeCount,
                shopNames,
                undefined,
                undefined,
                rewardLookup.internal,
              ),
            fail,
          };
          if (owners.length > 0) {
            indexRewardProducerFrontier(
              producerFrontiers,
              Object.freeze({
                generationPolicy: 'jointShopInventory',
                generationHistorySequence: event.sequence,
                reachableBranchCount: frontierBranches.length,
                acquisitionHorizon: 'generationOnly',
                owners,
                evaluateOffer: (
                  owner: SemanticAddress,
                  offer: CanonicalResolvedIncomingReward['offer'],
                ) => {
                  if (room.entryState?.kind !== 'shop') {
                    return fail(`${room.gameName} lost its shop candidate state`);
                  }
                  const ownerKey = semanticAddressKey(owner);
                  if (!ownerKeys.has(ownerKey)) {
                    return fail('shop reward frontier received a foreign owner');
                  }
                  const candidateRoom = Object.freeze({
                    ...room,
                    entryState: Object.freeze({
                      ...room.entryState,
                      offers: Object.freeze(
                        room.entryState.offers.map((entry) =>
                          semanticAddressKey(entry.offerOrigin) === ownerKey
                            ? Object.freeze({ ...entry, offer })
                            : entry,
                        ),
                      ),
                    }),
                  });
                  const candidateFindings = new Map<string, FindingRegionEntry>();
                  const candidateBranches = processShopInventory(
                    frontierBranches,
                    { ...shopContext, room: candidateRoom },
                    candidateFindings,
                  );
                  return candidateResult(candidateFindings, candidateBranches);
                },
              }),
            );
          }
          branches = processShopInventory(branches, shopContext, findings);
          break;
        }
        const wheel = room.rewardWheels?.find(
          (candidate) => candidate.wheelKey === event.offerPoint,
        );
        const view = roomView.offerPoints?.find(
          (candidate) => candidate.offerPoint === event.offerPoint,
        )?.before;
        if (wheel === undefined || view === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} has no canonical ${event.offerPoint} materialization`,
          );
        }
        const binding = rewardWheelBinding(catalog, declaration, wheel);
        const roomKey = semanticAddressKey(room.origin);
        if (room.rewardWheels?.[0] === wheel && !shipLifecycleContexts.has(roomKey)) {
          shipLifecycleContexts.set(
            roomKey,
            prepareShipLifecycleCandidateContext(
              catalog,
              room,
              declaration,
              roomView,
              history,
              branches,
              enteredBiomeCount,
              routeLoadout,
            ),
          );
        }
        const contexts = wheel.offers.map((offer) => ({
          catalog,
          reward: {
            ...offer,
            producerLifecycleKey: wheel.producerLifecycleKey,
            resolvedStoreKey: wheel.storeKey,
          },
          binding,
          historySequence: event.sequence,
          peers: Object.freeze([]),
          facts: (branchHistory: RewardHistoryState) =>
            rewardFacts(catalog, room, room, declaration, view, branchHistory, enteredBiomeCount),
        }));
        const frontierBranches = branches;
        const owners = Object.freeze(wheel.offers.map((offer) => offer.origin));
        const ownerKeys = new Set(owners.map(semanticAddressKey));
        const acquisitionView = roomView.offerPoints?.find(
          (candidate) => candidate.offerPoint === event.offerPoint,
        )?.acquisitionBefore;
        const acquisitionEvent = history.events.find(
          (candidate) =>
            candidate.kind === 'offerPointAcquired' &&
            semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin) &&
            candidate.offerPoint === wheel.wheelKey,
        );
        indexRewardProducerFrontier(
          producerFrontiers,
          Object.freeze({
            generationPolicy: 'jointUnordered',
            generationHistorySequence: event.sequence,
            reachableBranchCount: frontierBranches.length,
            acquisitionHorizon:
              acquisitionEvent?.kind !== 'offerPointAcquired' || acquisitionView === undefined
                ? 'generationOnly'
                : 'ownEnteredLifecycle',
            owners,
            resolvedStoreKey: wheel.storeKey,
            evaluateOffer: (
              owner: SemanticAddress,
              offer: CanonicalResolvedIncomingReward['offer'],
            ) => {
              const ownerKey = semanticAddressKey(owner);
              if (!ownerKeys.has(ownerKey)) {
                return fail('reward-wheel frontier received a foreign owner');
              }
              const candidateFindings = new Map<string, FindingRegionEntry>();
              let candidateBranches = processOfferGenerationCohort(
                frontierBranches,
                contexts.map((context) =>
                  semanticAddressKey(context.reward.origin) === ownerKey
                    ? {
                        ...context,
                        reward: Object.freeze({ ...context.reward, offer }),
                      }
                    : context,
                ),
                candidateFindings,
                { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
              );
              const selectedOffer = wheel.offers.find(
                (candidate) => semanticAddressKey(candidate.origin) === ownerKey,
              );
              if (
                candidateBranches.length > 0 &&
                selectedOffer?.picked === true &&
                acquisitionView !== undefined &&
                acquisitionEvent?.kind === 'offerPointAcquired'
              ) {
                const source = Object.freeze({
                  ...selectedOffer,
                  offer,
                  producerLifecycleKey: wheel.producerLifecycleKey,
                  instanceProvenance: 'free',
                });
                candidateBranches = settleOwnedAcquisitionSite(
                  catalog,
                  candidateBranches,
                  {
                    siteOwner: wheel.origin,
                    pointKey: wheel.wheelKey,
                    entryKey: 'picked',
                    source,
                    historySequence: acquisitionEvent.sequence,
                  },
                  (branchHistory) =>
                    rewardFacts(
                      catalog,
                      room,
                      room,
                      declaration,
                      acquisitionView,
                      branchHistory,
                      enteredBiomeCount,
                    ),
                  candidateFindings,
                  ownerRegion(wheel.origin),
                ).branches;
              }
              return candidateResult(candidateFindings, candidateBranches);
            },
          }),
        );
        branches = processOfferGenerationCohort(branches, contexts, findings, {
          ordering: 'allOffers',
          atomicRegion: ownerRegion(wheel.origin),
        });
        break;
      }
      case 'offerPointAcquired': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (
          room === undefined ||
          room.kind !== 'authored' ||
          declaration === undefined ||
          roomView === undefined
        ) {
          throw new BiomeRewardSimulationContractError(
            'reward-wheel acquisition has no authored room',
          );
        }
        const wheel = room.rewardWheels?.find(
          (candidate) => candidate.wheelKey === event.offerPoint,
        );
        const picked = wheel?.offers.find((offer) => offer.picked);
        const view = roomView.offerPoints?.find(
          (candidate) => candidate.offerPoint === event.offerPoint,
        )?.acquisitionBefore;
        if (wheel === undefined || picked === undefined || view === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} has no canonical ${event.offerPoint} acquisition`,
          );
        }
        const settlement = settleOwnedAcquisitionSite(
          catalog,
          branches,
          {
            siteOwner: wheel.origin,
            pointKey: wheel.wheelKey,
            entryKey: 'picked',
            source: Object.freeze({
              ...picked,
              producerLifecycleKey: wheel.producerLifecycleKey,
              instanceProvenance: 'free',
            }),
            historySequence: event.sequence,
          },
          (branchHistory) =>
            rewardFacts(catalog, room, room, declaration, view, branchHistory, enteredBiomeCount),
          findings,
          ownerRegion(wheel.origin),
        );
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
        branches = settlement.branches;
        break;
      }
      case 'producerRoleAdvanced': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          throw new BiomeRewardSimulationContractError('producer role has no authored room');
        }
        if (room.kind === 'hub') {
          throw new BiomeRewardSimulationContractError('Hub room cannot advance a reward producer');
        }
        const producerFacts = (branchHistory: RewardHistoryState) =>
          rewardFacts(
            catalog,
            room,
            room,
            declaration,
            roomView.preOutgoing ?? roomView.entry,
            branchHistory,
            enteredBiomeCount,
          );
        const producerRegion = ownerRegion(room.incomingReward?.origin ?? room.origin);
        const producerChronology = rewardFindingChronologyForRoom(
          snapshot,
          room.origin,
          event.sequence,
          'localRoomLifecycle',
        );
        const settlement = settleProducerAcquisitionSite(
          catalog,
          branches,
          room,
          event,
          producerFacts,
          findings,
          fail,
          producerRegion,
          producerChronology,
          acquisitionSiteOwner(snapshot, room),
        );
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
        branches = settlement.branches;
        break;
      }
      case 'encounterCompleted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const completionRoom =
          event.origin.kind === 'completionRoom'
            ? snapshot.completionRooms?.find(
                (candidate) =>
                  semanticAddressKey(candidate.origin) === semanticAddressKey(event.origin),
              )
            : undefined;
        const declaration =
          room === undefined && completionRoom === undefined
            ? undefined
            : catalog.rooms.byKey[(room ?? completionRoom)!.gameName];
        if (declaration?.advancesExperimentalHammerUses === true) {
          branches = advanceExperimentalHammerForCompletion(branches, event.origin, event.sequence);
        }
        if (
          room !== undefined &&
          declaration !== undefined &&
          (room.kind === 'authored' || room.kind === 'localChild') &&
          eligibleGorgonPhases.has(`${semanticAddressKey(event.origin)}::${event.phaseKey}`)
        ) {
          const result = room.encounters.gorgonResultByPhase?.[event.phaseKey];
          const phase = room.encounterPhases.find(
            (candidate) => candidate.slotKey === event.phaseKey,
          );
          const encounterPhaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
            room.origin.kind === 'occurrence'
              ? { kind: 'occurrence', occurrenceId: room.origin.occurrenceId }
              : {
                  kind: 'localChild',
                  occurrenceId: room.origin.occurrenceId,
                  groupKey: room.origin.groupKey,
                  slotKey: room.origin.slotKey,
                },
            event.phaseKey,
          );
          const gorgonPhaseAddress = createGorgonPhaseAddress(encounterPhaseAddress);
          const gorgonAddress = createTraitOfferAddress(gorgonPhaseAddress, 'gorgonAthena');
          const gorgonKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
          const gorgonSnapshot = gorgonPhaseCandidates.get(
            semanticAddressKey(encounterPhaseAddress),
          );
          const gorgonOffer =
            result?.athenaOffer === undefined || gorgonSnapshot?.rarity === undefined
              ? undefined
              : materializeGorgonAthenaOffer(catalog, result.athenaOffer, gorgonSnapshot.rarity);
          if (
            phase?.blocksGorgon !== true &&
            declaration.blocksGorgon !== true &&
            result?.deathDefianceConditionMet === true &&
            result.athenaOffer !== undefined &&
            gorgonOffer !== undefined &&
            assessGorgonChildSettlement(catalog, result.athenaOffer) &&
            !blockedGorgonPhases.has(gorgonKey)
          ) {
            const beforeEvaluations = branches.map(
              (branch) => branch.traitEvaluations?.length ?? 0,
            );
            const processed = branches.map((branch) =>
              processEncounterTraitOffer(
                catalog,
                branch,
                gorgonAddress.owner,
                gorgonOffer,
                event.sequence,
                'encounterCompleted',
                findings,
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                result.deathDefianceConditionMet,
                'gorgonAthena',
                gorgonSnapshot?.rarity,
              ),
            );
            const valid = processed.every((branch, index) => {
              const evaluations = branch.traitEvaluations ?? [];
              const evaluation = evaluations[evaluations.length - 1];
              return (
                evaluations.length > beforeEvaluations[index]! &&
                evaluation !== undefined &&
                evaluation.assessments.every((assessment) => assessment.legal) &&
                evaluation.composition.legal &&
                evaluation.replacementComposition.legal &&
                evaluation.targetedAcquisition.legal
              );
            });
            if (valid) {
              branches = Object.freeze(
                processed.map((branch) =>
                  Object.freeze({
                    ...branch,
                    keepsakes: consumeGorgonAppearance(branch.keepsakes),
                  }),
                ),
              );
            } else {
              blockedGorgonPhases.add(gorgonKey);
              gorgonEvaluationBlocked = true;
            }
          } else if (
            result?.deathDefianceConditionMet === true &&
            result.athenaOffer === undefined
          ) {
            blockedGorgonPhases.add(gorgonKey);
            gorgonEvaluationBlocked = true;
            addRewardFinding(
              findings,
              rewardFinding('rewardAcquisitionUnavailable', gorgonAddress.owner, {
                reason: 'gorgonAthenaOfferMissing',
              }),
              ownerRegion(gorgonAddress.owner),
              historyFindingChronology(event.sequence),
            );
          } else if (
            result?.deathDefianceConditionMet === true &&
            result.athenaOffer !== undefined
          ) {
            blockedGorgonPhases.add(gorgonKey);
            gorgonEvaluationBlocked = true;
            addRewardFinding(
              findings,
              rewardFinding('rewardAcquisitionUnavailable', gorgonAddress.owner, {
                reason: 'gorgonAthenaOfferInvalid',
              }),
              ownerRegion(gorgonAddress.owner),
              historyFindingChronology(event.sequence),
            );
          }
        }
        if (event.origin.kind === 'completionRoom' && event.origin.role === 'boss') {
          const owner = createBossCompletionArcanaAddress(event.origin);
          const activeArcana = attestJudgmentArcanaFrontier(branches);
          const firstArcanaFear = branches[0]?.arcanaFear;
          const requiredCount =
            activeArcana === undefined || firstArcanaFear === undefined
              ? undefined
              : judgmentRequiredCount(catalog, firstArcanaFear);
          if (requiredCount !== undefined && firstArcanaFear !== undefined) {
            bossCompletionArcanaContexts.set(
              semanticAddressKey(owner),
              Object.freeze({
                inactiveArcanaKeys: inactiveArcanaKeys(catalog, firstArcanaFear).filter(
                  (key) =>
                    branches[0]?.keepsakes.fatedStatus !== 'Fated' ||
                    catalog.arcanaCards.byKey[key]?.fatedIncompatible !== true,
                ),
                requiredCount,
              }),
            );
          }
          branches = Object.freeze(
            branches.flatMap((branch) => {
              const required = judgmentRequiredCount(catalog, branch.arcanaFear);
              if (required === undefined)
                return [advanceRewardBranches([branch], event.sequence)[0]!];
              const selected = snapshot.kind === 'biome' ? snapshot.bossCompletionArcanaKeys : [];
              if (selected.length !== required) {
                addRewardFinding(
                  findings,
                  rewardFinding(
                    selected.length === 0
                      ? 'judgmentOutcomeMissing'
                      : 'judgmentOutcomeWrongCardinality',
                    owner,
                    Object.freeze({ required, selected: selected.length }),
                  ),
                  ownerRegion(owner),
                  historyFindingChronology(event.sequence),
                );
                return [];
              }
              const assessed = activateTemporaryArcana(catalog, branch.arcanaFear, selected, {
                owner,
                sequence: event.sequence,
              });
              if (
                !assessed.legal ||
                (branch.keepsakes.fatedStatus === 'Fated' &&
                  selected.some(
                    (key) => catalog.arcanaCards.byKey[key]?.fatedIncompatible === true,
                  ))
              ) {
                addRewardFinding(
                  findings,
                  rewardFinding(
                    'judgmentOutcomeTargetUnavailable',
                    owner,
                    Object.freeze({ reason: assessed.legal ? 'fatedExcluded' : assessed.reason }),
                  ),
                  ownerRegion(owner),
                  historyFindingChronology(event.sequence),
                );
                return [];
              }
              return [
                Object.freeze({
                  ...branch,
                  arcanaFear: assessed.state,
                  keepsakes: refreshKeepsakeFatedStatus(catalog, branch.keepsakes, assessed.state),
                  processedThroughHistorySequence: event.sequence,
                }),
              ];
            }),
          );
          break;
        }
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (room.kind !== 'authored' && room.kind !== 'localChild') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const selectedEncounterKey = selectedEncounterDefinitionKey(
          catalog,
          declaration,
          room.encounters,
          event.phaseKey,
          semanticAddressKey(event.origin),
        );
        const authoredEncounterOffer =
          selectedEncounterKey === undefined
            ? undefined
            : room.encounters.traitOffersByPhase?.[event.phaseKey]?.[selectedEncounterKey];
        if (authoredEncounterOffer !== undefined && selectedEncounterKey !== undefined) {
          const phaseOwner =
            room.origin.kind === 'occurrence'
              ? { kind: 'occurrence' as const, occurrenceId: room.origin.occurrenceId }
              : {
                  kind: 'localChild' as const,
                  occurrenceId: room.origin.occurrenceId,
                  groupKey: room.origin.groupKey,
                  slotKey: room.origin.slotKey,
                };
          const phaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            phaseOwner,
            event.phaseKey,
          );
          const preEchoBranches = branches;
          const settlements = branches.map((branch) =>
            settleEncounterTraitOffer(
              catalog,
              branch,
              phaseAddress,
              authoredEncounterOffer,
              event.sequence,
              'encounterCompleted',
              findings,
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
              undefined,
              'selection',
              undefined,
              routeLoadout,
              branches.map((candidate) => candidate.traitHistory ?? createTraitHistoryState()),
            ),
          );
          for (const settlement of settlements) {
            const checkpoint = settlement.blockedChild;
            if (checkpoint === undefined) continue;
            const key = semanticAddressKey(checkpoint.address);
            const current = traitChildSettlementBuilders.get(key);
            if (current === undefined)
              traitChildSettlementBuilders.set(key, {
                occurrenceOwner: room.origin,
                branches: [checkpoint.branch],
                runStateSnapshots: new Map(),
              });
            else current.branches.push(checkpoint.branch);
          }
          const selectedEchoOption =
            authoredEncounterOffer.kind === 'traits'
              ? authoredEncounterOffer.options[
                  optionIndex(authoredEncounterOffer.selectedOptionKey)
                ]
              : undefined;
          const selectedEchoDisposition =
            selectedEchoOption === undefined
              ? undefined
              : catalog.traits.byKey[selectedEchoOption.traitKey]?.selectedDisposition;
          if (
            authoredEncounterOffer.kind === 'traits' &&
            selectedEchoOption !== undefined &&
            selectedEchoDisposition?.kind === 'echo' &&
            selectedEchoDisposition.effect === 'lastReward'
          ) {
            const replayOwner = createEchoLastRewardAddress(
              createTraitOfferAddress(phaseAddress, 'selection'),
              authoredEncounterOffer.selectedOptionKey,
            );
            const site = createAcquisitionSiteAddress(replayOwner, 'echoReplay');
            const entry = createAcquisitionEntryAddress(site, 'recreatedReward');
            const child = selectedEchoOption.echoLastReward;
            const settledEchoBranches: RewardBranchState[] = [];
            for (const [index, outer] of settlements.entries()) {
              const beforeOuter = preEchoBranches[index];
              if (beforeOuter === undefined) continue;
              const recreation = beforeOuter.history.lastRewardRecreation;
              const outerAcquired =
                outer.branch.traitHistory?.equippedTraits.EchoLastReward !== undefined &&
                beforeOuter.traitHistory?.equippedTraits.EchoLastReward === undefined;
              if (!outerAcquired || recreation === undefined) {
                settledEchoBranches.push(outer.branch);
                continue;
              }
              const defaultChild = createDefaultEchoLastRewardAcquisition(
                catalog,
                recreation,
                routeLoadout,
              );
              const expectedTrait = defaultChild.traitOffer !== undefined;
              const expectedLevel = defaultChild.levelResolution !== undefined;
              const childApplicable =
                child !== undefined &&
                (child.traitOffer !== undefined) === expectedTrait &&
                (child.levelResolution !== undefined) === expectedLevel;
              if (!childApplicable) {
                const finding = Object.freeze({
                  code:
                    child === undefined
                      ? ('echoLastRewardChildMissing' as const)
                      : ('echoLastRewardChildUnavailable' as const),
                  severity: 'error' as const,
                  phase: 'rewardGeneration' as const,
                  origin: replayOwner,
                  evidence: Object.freeze({
                    rewardType: recreation.offer.rewardType,
                    expectedTrait,
                    expectedLevel,
                  }),
                });
                addRewardFinding(
                  findings,
                  finding,
                  ownerRegion(replayOwner),
                  rewardFindingChronologyForRoom(
                    snapshot,
                    room.origin,
                    event.sequence,
                    'localRoomLifecycle',
                  ),
                );
                const key = semanticAddressKey(replayOwner);
                const current = traitChildSettlementBuilders.get(key);
                if (current === undefined)
                  traitChildSettlementBuilders.set(key, {
                    occurrenceOwner: room.origin,
                    branches: [outer.branch],
                    runStateSnapshots: new Map(),
                  });
                else current.branches.push(outer.branch);
                settledEchoBranches.push(outer.branch);
                continue;
              }
              const replay = settleOwnedAcquisitionSite(
                catalog,
                [outer.branch],
                {
                  siteOwner: replayOwner,
                  pointKey: 'echoReplay',
                  entryKey: 'recreatedReward',
                  source: Object.freeze({
                    origin: entry,
                    offer: recreation.offer,
                    producerLifecycleKey: recreation.producerLifecycleKey,
                    instanceProvenance: 'free',
                    ...(child!.traitOffer === undefined
                      ? {}
                      : {
                          traitOffersByAcquisitionRole: Object.freeze({
                            self: child!.traitOffer,
                          }),
                        }),
                    ...(child!.levelResolution === undefined
                      ? {}
                      : {
                          levelResolutionsByAcquisitionRole: Object.freeze({
                            self: child!.levelResolution,
                          }),
                        }),
                    conversionByAcquisitionRole: Object.freeze({ self: child!.conversion }),
                    traitContext: Object.freeze({
                      weaponKey: routeLoadout.weaponKey,
                      aspectKey: routeLoadout.aspectKey,
                    }),
                  }),
                  historySequence: event.sequence,
                },
                (branchHistory) =>
                  rewardFacts(
                    catalog,
                    room,
                    room,
                    declaration,
                    roomView.preOutgoing ?? roomView.entry,
                    branchHistory,
                    enteredBiomeCount,
                  ),
                findings,
                undefined,
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
              );
              recordAcquisitionRoleFrontiers(replay.roleFrontiers);
              recordTraitChildSettlements(replay.traitChildSettlements, room.origin);
              if (replay.branches.length === 0) {
                const key = semanticAddressKey(replayOwner);
                const current = traitChildSettlementBuilders.get(key);
                if (current === undefined)
                  traitChildSettlementBuilders.set(key, {
                    occurrenceOwner: room.origin,
                    branches: [outer.branch],
                    runStateSnapshots: new Map(),
                  });
                else current.branches.push(outer.branch);
                settledEchoBranches.push(outer.branch);
              } else settledEchoBranches.push(...replay.branches);
            }
            branches = mergeEquivalentRewardBranches(settledEchoBranches);
          } else branches = Object.freeze(settlements.map((settlement) => settlement.branch));
        }
        const matchingRewards =
          room.kind === 'authored'
            ? (room.localRewards?.filter((reward) => reward.encounterPhaseKey === event.phaseKey) ??
              [])
            : [];
        if (matchingRewards.length === 0) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (matchingRewards.length !== 1 || matchingRewards[0] === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName}.${event.phaseKey} does not own exactly one local reward`,
          );
        }
        const settlement = settleOwnedAcquisitionSite(
          catalog,
          branches,
          {
            siteOwner: matchingRewards[0].origin,
            pointKey: event.phaseKey,
            entryKey: matchingRewards[0].slotKey,
            source: Object.freeze({
              ...matchingRewards[0],
              instanceProvenance: 'free',
            }),
            historySequence: event.sequence,
          },
          (branchHistory) =>
            rewardFacts(
              catalog,
              room,
              room,
              declaration,
              roomView.preOutgoing ?? roomView.entry,
              branchHistory,
              enteredBiomeCount,
            ),
          findings,
          undefined,
          rewardFindingChronologyForRoom(
            snapshot,
            room.origin,
            event.sequence,
            'localRoomLifecycle',
          ),
        );
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
        branches = settlement.branches;
        break;
      }
      case 'acquisitionPointReached': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (
          room === undefined ||
          room.kind !== 'authored' ||
          declaration === undefined ||
          roomView === undefined
        ) {
          throw new BiomeRewardSimulationContractError('shop purchases have no authored room');
        }
        branches = settleAuthoredAcquisitionSite(
          room,
          declaration,
          roomView,
          branches,
          event.sequence,
          findings,
        );
        break;
      }
      default:
        branches = advanceRewardBranches(branches, event.sequence);
        break;
    }
  }

  if (
    snapshot.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'exitDecision' &&
    snapshot.frontier.parent.origin.kind === 'hubRoom'
  ) {
    const source = rooms.get(semanticAddressKey(snapshot.frontier.parent.origin));
    if (source?.kind === 'hub') {
      const current = 'current' in history ? history.current : history.afterTransition;
      captureRunState(snapshot.frontier.origin, source, current);
    }
  }

  recordBlankFrontierTargetHistory();
  const immutableFindingRegions = Object.freeze([...findings.values()]);
  const immutableFindings = Object.freeze(immutableFindingRegions.map((entry) => entry.finding));
  const traitProducts = selectedTraitOfferProducts(
    branches,
    immutableFindingRegions.flatMap((entry) =>
      entry.levelResolutionEvaluations === undefined ? [] : entry.levelResolutionEvaluations,
    ),
  );
  const runStatePublication = publishRunStateThroughCoverage(
    [...runStateSnapshotsByOwner.values()],
    [...runStateSnapshotsByOwner.values()],
  );
  const traitChildSettlementProducts = new Map(
    [...traitChildSettlementBuilders].map(([key, checkpoint]) =>
      Object.freeze([
        key,
        Object.freeze({
          branches: Object.freeze(
            mergeEquivalentRewardBranches(checkpoint.branches).map(publicRewardBranch),
          ),
          runStateSnapshots: Object.freeze([...checkpoint.runStateSnapshots.values()]),
        }),
      ] as const),
    ),
  );
  const traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints = Object.freeze({
    at: (address: SemanticAddress) => traitChildSettlementProducts.get(semanticAddressKey(address)),
  });
  const simulation: BiomeRewardSimulation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    storeSupport: Object.freeze(storeSupportEntries),
    targetHistory: Object.freeze([...targetHistoryByOrigin.values()]),
    branches: Object.freeze(branches.map(publicRewardBranch)),
    findings: immutableFindings,
    rewardLookups: rewardLookup.public,
    runStateSnapshots: runStatePublication.snapshots,
    runStateAvailability: runStatePublication.availability,
    selectedTraitOffers: traitProducts.selectedTraitOffers,
    selectedLevelResolutions: traitProducts.selectedLevelResolutions,
    figLeafPhaseCandidates: Object.freeze([...figLeafPhaseCandidates.values()]),
    gorgonPhaseCandidates: Object.freeze([...gorgonPhaseCandidates.values()]),
    derivedAcquisitionEntries: Object.freeze(
      [...derivedAcquisitionEntryContexts.values()].flatMap((frontiers) => {
        const first = frontiers[0];
        const capability = attestDerivedAcquisitionEntryCandidateCapability(frontiers);
        return first === undefined || capability === undefined
          ? []
          : [Object.freeze({ address: first.address, ...capability })];
      }),
    ),
  });
  return Object.freeze({
    simulation,
    producerArtifacts: createRewardProducerCandidateArtifacts(producerFrontiers),
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(
      shipLifecycleContexts,
      acquisitionOrderContexts,
    ),
    traitOfferArtifacts: createTraitOfferCandidateArtifacts(
      catalog,
      traitProducts.candidateContexts,
    ),
    levelResolutionArtifacts: createLevelResolutionCandidateArtifacts(
      catalog,
      traitProducts.levelCandidateContexts,
    ),
    bossCompletionArcanaArtifacts: createBossCompletionArcanaCandidateArtifacts(
      bossCompletionArcanaContexts,
    ),
    keepsakeSelectionArtifacts:
      createKeepsakeSelectionCandidateArtifacts(keepsakeSelectionContexts),
    keepsakeEquipResultArtifacts: createKeepsakeEquipResultCandidateArtifacts(
      keepsakeEquipResultContexts,
    ),
    acquisitionConversionArtifacts: createAcquisitionConversionCandidateArtifacts(
      catalog,
      acquisitionConversionContexts,
    ),
    derivedAcquisitionEntryArtifacts: createDerivedAcquisitionEntryCandidateArtifacts(
      derivedAcquisitionEntryContexts,
    ),
    traitChildSettlementCheckpoints,
    findingRegions: Object.freeze(immutableFindingRegions),
  });
}

export function evaluateBiomeRewards(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
  ).simulation;
}

export function evaluateBiomeRewardsAssembly(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
  ).simulation;
}
