import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { evaluateRequirement } from '../../requirements';
import { fieldsOptionalRewardCountSupport } from '../fields-optional-count';
import { isPurgingPoolEligibleTrait, type PurgingPoolAssessment } from '../purging-pool';
import {
  assessHermesShrineTravelDealRefill,
  type HermesShrineCandidateContext,
} from '../hermes-shrine';
import {
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createGorgonPhaseAddress,
  createBiomeAddress,
  createTraitOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createEchoKeepsakeReplayAddress,
  createTargetAddress,
  createRoomRunStateCheckpointAddress,
  createAcquisitionRoleAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type ExitDecisionAddress,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
  type SteadyGrowthOutcomeAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredRewardState,
  ResourcePlacements,
  RouteLoadout,
  ShipCombatState,
} from '../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../authored-project/defaults';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  parseArtificerReplacementEntryKey,
} from '../../authored-project/artificer';
import { parseHermesShrineDeliveryEntryKey } from '../../authored-project/hermes-shrine-delivery';
import { hermesShrineDeliveryEntryKey } from '../../authored-project/hermes-shrine-delivery';
import { applyStygianWellPurchase, advanceStygianWellBossUses } from '../stygian-well';
import { type StygianWellCandidateContext } from '../stygian-well';
import {
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  parseSeaStarDuplicateSiteKey,
  seaStarDuplicateUsesFreshObject,
} from '../../authored-project/sea-star';
import {
  createUnresolvedAcquisitionRewardState,
  createUnresolvedPickupRewardState,
  materializeGorgonAthenaOffer,
} from '../../authored-project/traits';
import {
  encounterEnvelopeSlots,
  selectedEncounterDefinitionKey,
} from '../../authored-project/room-state/encounter-envelope';
import {
  findShopPartialGenerationWitnesses,
  applyConcreteAcquisition,
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type {
  EncounterHistoryEntry,
  HistoryEvent,
  HistoryStateView,
  ProgressiveRoomHistoryViews,
  RoomCreationSource,
} from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalFieldsOptionalReward,
  CanonicalHubRoom,
  CanonicalLocalReward,
  CanonicalResolvedIncomingReward,
  CanonicalRewardWheel,
  CanonicalTarget,
} from '../materialization';
import type { CanonicalDecision } from '../materialization/model';
import { materializeShipCombatState } from '../materialization';
import type { ResolvedEncounterPhase } from '../encounters';
import {
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
  type HistoryFindingChronology,
} from '../finding-regions';
import type {
  RewardBranch,
  BiomeRewardSimulation,
  RewardStoreSupportEntry,
  TargetRewardHistoryCheckpoint,
} from './model';
import {
  createAcquisitionConversionCandidateArtifacts,
  createDerivedAcquisitionEntryCandidateArtifacts,
  createSteadyGrowthCandidateArtifacts,
  createPurgingPoolCandidateArtifacts,
  createHermesShrineCandidateArtifacts,
  createStygianWellCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../candidate-artifacts';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
} from '../candidates/trait-offer-capability';
import type { TraitOfferCandidateContext } from '../traits';
import {
  type ReachedSteadyGrowthThreshold,
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  hasActiveChaosSemanticTag,
} from '../traits';
import {
  createRunState,
  createRunStateDerivationCache,
  publishRunStateThroughCoverage,
  type RunStateSnapshot,
} from './run-state';
import { createRewardFacts, createdPeerGameNames } from './facts';
import {
  createRoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateResult,
  type ShipLifecycleCandidateContext,
} from './lifecycle-artifacts';
import { BiomeRewardSimulationContractError } from './biome-contract';
import { assessAuthoredBatchRewardStore } from './reward-store-support';
import { selectedTraitOfferProducts } from './selected-trait-products';
import {
  prepareRewardEvaluationInputs,
  preparedAcquisitionSiteOwner,
  preparedHubVisitFrontier,
  samePreparedRewardRoomOwner,
  type RewardLifecycleReferences,
} from './prepared-inputs';
import { applyEncounterStartedTransition } from './lifecycle-transitions/encounter-started';
import { applyEncounterEndEffectsTransition } from './lifecycle-transitions/encounter-end-effects';
import { applyKeepsakeRackUsedTransition } from './lifecycle-transitions/keepsake-rack-used';
import { applyRoomEnteredTransition } from './lifecycle-transitions/room-entered';
import { applyRoomExitedTransition } from './lifecycle-transitions/room-exited';
import { applyRoomPreparedTransition } from './lifecycle-transitions/room-prepared';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
export type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';

function canonicalRewardState(reward: {
  readonly offer: AuthoredRewardState['offer'];
  readonly traitOffersByAcquisitionRole?: AuthoredRewardState['traitOffersByAcquisitionRole'];
  readonly levelResolutionsByAcquisitionRole?: AuthoredRewardState['levelResolutionsByAcquisitionRole'];
  readonly dispositionByAcquisitionRole?: AuthoredRewardState['dispositionByAcquisitionRole'];
}): AuthoredRewardState {
  return Object.freeze({
    offer: reward.offer,
    traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole ?? Object.freeze({}),
    ...(reward.levelResolutionsByAcquisitionRole === undefined
      ? {}
      : { levelResolutionsByAcquisitionRole: reward.levelResolutionsByAcquisitionRole }),
    dispositionByAcquisitionRole: reward.dispositionByAcquisitionRole ?? Object.freeze({}),
  });
}

function canonicalArtificerSource(
  room: CanonicalAuthoredRoom,
  sourceKey: string,
):
  | {
      readonly owner: TraitOfferOwnerAddress;
      readonly reward: AuthoredRewardState;
      readonly producerLifecycleKey?: string;
    }
  | undefined {
  const candidates: {
    readonly owner: TraitOfferOwnerAddress;
    readonly reward: AuthoredRewardState;
    readonly producerLifecycleKey?: string;
  }[] = [];
  if (room.incomingReward !== undefined) {
    candidates.push({
      owner: room.incomingReward.origin,
      reward: canonicalRewardState(room.incomingReward),
      producerLifecycleKey: room.incomingReward.producerLifecycleKey,
    });
  }
  for (const reward of [...(room.localRewards ?? []), ...(room.fieldsOptionalRewards ?? [])]) {
    candidates.push({
      owner: reward.origin,
      reward: canonicalRewardState(reward),
      producerLifecycleKey: reward.producerLifecycleKey,
    });
  }
  for (const wheel of room.rewardWheels ?? []) {
    for (const reward of wheel.offers) {
      candidates.push({
        owner: reward.origin,
        reward: canonicalRewardState(reward),
        producerLifecycleKey: wheel.producerLifecycleKey,
      });
    }
  }
  if (room.entryState?.kind === 'shop') {
    for (const reward of room.entryState.offers) {
      candidates.push({ owner: reward.offerOrigin, reward: canonicalRewardState(reward) });
    }
  }
  for (const site of Object.values(room.acquisitionSites)) {
    for (const [entryKey, reward] of Object.entries(site.entries)) {
      if (reward === null) continue;
      candidates.push({
        owner: createAcquisitionEntryAddress(site.address, entryKey),
        reward,
        ...(() => {
          const producerLifecycleKey = room.pickupProducers?.find(
            (producer) => producer.siteKey === site.address.pointKey,
          )?.producerLifecycleKey;
          return producerLifecycleKey === undefined ? {} : { producerLifecycleKey };
        })(),
      });
    }
  }
  return candidates.find((candidate) => semanticAddressKey(candidate.owner) === sourceKey);
}
import {
  createRewardProducerCandidateArtifacts,
  indexRewardProducerFrontier,
  type RewardProducerCandidateArtifacts,
  type RewardProducerCandidateResult,
  type RewardProducerFrontier,
} from './producer-frontiers';
import {
  advanceRewardBranches,
  countedBinding,
  initializeRewardBranches,
  processOfferGenerationCohort,
  processFocusedOfferAfterAuthoredPeers,
  processRewardOffer,
  publicRewardBranch,
  applyExperimentalHammerEquipResult,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from './processing';
import type { AcquisitionRoleFrontier } from './acquisition-settlement';
import {
  assessSeaStarDuplication,
  withStoredArtificerReplacements,
  settleArtificerReplacementAcquisition,
  settleOwnedAcquisitionSite,
  settlePickupAcquisitionSite,
  settleProducerAcquisitionSite,
} from './acquisition-settlement';
import { processShopInventory, settleShopAcquisitionSite } from './shop-settlement';
import { addRewardFinding } from './findings';
import { mergeEquivalentRewardBranches, type RewardBranchState } from './branch-primitives';
import {
  settleEncounterTraitOffer,
  processEncounterTraitOffer,
  type ReachedTraitChildCheckpoint,
} from './trait-settlement';
import { rewardFinding } from './findings';
import {
  assessExperimentalHammerEquipResult,
  refreshKeepsakeFatedStatus,
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
  createJudgmentArcanaAddress,
  createKeepsakeEquipResultAddress,
  createPostbossKeepsakeSelectionAddress,
} from '../../authored-project/addresses';
import {
  createJudgmentArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../candidate-artifacts';

type CanonicalRewardRoom = CanonicalAuthoredRoom;
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

interface ResolvedHubBoardGenerationParticipant {
  readonly kind: 'resolved';
  readonly context: OfferProcessingContext;
  readonly incoming: CanonicalResolvedIncomingReward;
}

interface UnresolvedHubBoardGenerationParticipant {
  readonly kind: 'unresolved';
  readonly declaration: RoomDeclaration;
  readonly incoming: NonNullable<CanonicalRewardRoom['unresolvedIncomingReward']>;
  readonly historySequence: number;
  readonly facts: (history: RewardHistoryState) => RewardKernelFacts;
  readonly candidateFor: (offer: ResolvedRewardOffer) => CanonicalResolvedIncomingReward;
}

type HubBoardGenerationParticipant =
  ResolvedHubBoardGenerationParticipant | UnresolvedHubBoardGenerationParticipant;

/**
 * One persistent Ephyra board-generation region. The region starts from the
 * post-Hub-entry reward branches and contains every open physical door,
 * independently from the later six-room visit chronology.
 */
interface PendingHubBoardGeneration {
  readonly frontierBranches: readonly RewardBranchState[];
  readonly participants: HubBoardGenerationParticipant[];
}

type RewardRoomOwner = {
  readonly kind: string;
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly occurrenceId?: string;
  readonly groupKey?: string;
  readonly slotKey?: string;
};

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
      if (samePreparedRewardRoomOwner(visit.target.room.origin, owner)) {
        return Object.freeze({
          kind: 'hubVisit',
          visitIndex,
          phase: 'targetLifecycle',
          history: historyFindingChronology(sequence),
        });
      }
      const local = visit.localSlots.find((slot) =>
        samePreparedRewardRoomOwner(slot.origin, owner),
      );
      if (local !== undefined) {
        return Object.freeze({
          kind: 'hubVisit',
          visitIndex,
          phase,
          ...(phase === 'localRoomLifecycle' && local.localVisit.enteredOrdinal !== null
            ? { localLifecycleIndex: local.localVisit.enteredOrdinal - 1 }
            : {}),
          history: historyFindingChronology(sequence),
        });
      }
    }
  }
  const frontier = preparedHubVisitFrontier(snapshot);
  if (frontier !== undefined) {
    if (samePreparedRewardRoomOwner(frontier.target.room.origin, owner)) {
      return Object.freeze({
        kind: 'hubVisit',
        visitIndex: frontier.origin.visitIndex - 1,
        phase: 'targetLifecycle',
        history: historyFindingChronology(sequence),
      });
    }
    const local = frontier.localSlots.find((slot) =>
      samePreparedRewardRoomOwner(slot.origin, owner),
    );
    if (local !== undefined) {
      const localLifecycleIndex = frontier.enteredLocalRooms.findIndex((slot) =>
        samePreparedRewardRoomOwner(slot.origin, local.origin),
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

export { BiomeRewardSimulationContractError } from './biome-contract';

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
  branch?: RewardBranchState,
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
    pendingSpellDrop: Object.values(branch?.pendingHermesShrineDeliveries ?? {}).some(
      (delivery) => delivery.reward.offer.rewardType === 'SpellDrop',
    ),
    fail,
  });
}

/**
 * Surface Shrines are a visible store at room entry.  Their three realized
 * names participate in the same outgoing `RequiredNotInStore` contact as a
 * World Shop inventory, regardless of whether the player later purchases an
 * item.  Keep this projection local to reward facts: it is neither a Shop
 * action nor a reward-bag consumer.
 */
function visibleStoreOptionNames(
  source: CanonicalRewardSource,
  shrineAssessments?: readonly HermesShrineCandidateContext[],
): ReadonlySet<string> {
  const names = new Set<string>();
  if (source.kind !== 'authored') return names;
  for (const offer of source.entryState?.kind === 'shop' ? source.entryState.offers : [])
    names.add(offer.offer.rewardType);
  const shrine = source.hermesShrine;
  const shrineInventoryVisible =
    shrineAssessments !== undefined &&
    shrineAssessments.length > 0 &&
    shrineAssessments.every((assessment) => assessment.inventory?.complete === true);
  if (shrine !== undefined && shrineInventoryVisible) {
    for (const offer of Object.values(shrine.offerBySlot)) names.add(offer!.offer.rewardType);
  }
  return names;
}

/** One declaration-owned SurfaceShop fallback edge at the reached action. */
function hermesShrineRuntimeFallbackRewardType(
  catalog: Catalog,
  generationKey: import('../../authored-project/model').HermesShrineGenerationKey,
  rewardType: string,
  refill: import('../hermes-shrine').HermesShrineTravelDealRefillAssessment | undefined,
): string | undefined {
  const sourceGenerationKey =
    generationKey === 'travelDealRefill' ? refill?.sourceGenerationKey : generationKey;
  const slotKey = sourceGenerationKey?.startsWith('initial:')
    ? sourceGenerationKey.slice('initial:'.length)
    : undefined;
  if (slotKey !== 'first' && slotKey !== 'secondLeft' && slotKey !== 'secondRight')
    return undefined;
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  const group = profile?.groups.byKey[profile.slots.byKey[slotKey]?.groupKey ?? ''];
  const option = group?.options.values.find((candidate) => candidate.rewardType === rewardType);
  // A refill is generated only from its published same-slot domain. Initial
  // visible entries use their declaration group; both cases still take one
  // option-declared edge, never a semantic Shrine/Death-Defiance rule.
  const supported =
    generationKey === 'travelDealRefill' ? refill?.candidateRewardTypes : group?.rewardTypes;
  return option?.runtimeOfferFallbackRewardTypes?.find(
    (candidate) => supported?.includes(candidate) === true,
  );
}

function stygianWellRuntimeFallbackItemKey(
  catalog: Catalog,
  itemKey: string,
  nested: boolean,
): string | undefined {
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const option = profile?.groups.values
    .flatMap((group) => group.options.values)
    .find((candidate) => candidate.key === itemKey);
  if (nested) {
    const twist = profile?.groups.values
      .flatMap((group) => group.options.values)
      .find((candidate) => candidate.key === 'RandomStoreItem');
    return twist?.stygianWell?.nestedRuntimeOfferFallbacks?.find(
      (edge) => edge.preferredItemKey === itemKey,
    )?.fallbackItemKey;
  }
  const group = profile?.groups.values.find(
    (candidate) => candidate.options.byKey[itemKey] !== undefined,
  );
  const fallbackRewardType = option?.runtimeOfferFallbackRewardTypes?.[0];
  return fallbackRewardType === undefined
    ? undefined
    : group?.options.values.find((candidate) => candidate.rewardType === fallbackRewardType)?.key;
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
  reward: CanonicalLocalReward | CanonicalFieldsOptionalReward,
): CountedRewardBinding {
  if (reward.groupKey === 'optionalRewards') {
    const descriptor = declaration.fieldsOptionalRewards;
    if (
      descriptor === undefined ||
      !descriptor.slotKeys.includes(reward.slotKey) ||
      descriptor.reward.producerLifecycleKey !== reward.producerLifecycleKey
    ) {
      throw new BiomeRewardSimulationContractError(
        `${declaration.gameName} does not own optional reward ${reward.slotKey}`,
      );
    }
    return descriptor.reward;
  }
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
  lifecycle: RewardLifecycleReferences,
  room: CanonicalAuthoredRoom,
  roomView: ProgressiveRoomHistoryViews,
  wheel: CanonicalRewardWheel,
): WheelLifecycleView {
  const selected = roomView.offerPoints?.find(
    (candidate) => candidate.offerPoint === wheel.wheelKey,
  );
  if (selected !== undefined) {
    const acquisitionEvent = lifecycle.wheelsByOwner
      .get(semanticAddressKey(room.origin))
      ?.find(
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
  const generation =
    roomView.preOutgoing ?? roomView.offerPoints?.at(-1)?.acquisitionAfter ?? roomView.entry;
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
  lifecycle: RewardLifecycleReferences,
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
          roomActions: Object.freeze({ order: Object.freeze([]) }),
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
        const lifecycleView = wheelLifecycleViews(lifecycle, candidateRoom, roomView, wheel);
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
            facts: (
              branchHistory: RewardHistoryState,
              _shopNames: ReadonlySet<string> | undefined,
              branch: RewardBranchState | undefined,
            ) =>
              rewardFacts(
                catalog,
                candidateRoom,
                candidateRoom,
                declaration,
                lifecycleView.generation,
                branchHistory,
                enteredBiomeCount,
                undefined,
                undefined,
                undefined,
                undefined,
                branch,
              ),
          })),
          candidateFindings,
          { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
        );
        const picked = wheel.offers.find(
          (offer: CanonicalRewardWheel['offers'][number]) => offer.picked,
        );
        if (picked === undefined) {
          const unresolvedPicked = wheel.unresolvedOffers.find((offer) => offer.picked);
          if (unresolvedPicked !== undefined) {
            addRewardFinding(
              candidateFindings,
              rewardFinding('rewardMissing', unresolvedPicked.origin, {}),
            );
            return lifecycleCandidateResult(candidateFindings, candidateBranches);
          }
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
  readonly traitOfferArtifacts: import('../candidates/trait-offer-capability').TraitOfferCandidateArtifacts;
  readonly levelResolutionArtifacts: import('../candidates/trait-offer-capability').LevelResolutionCandidateArtifacts;
  readonly judgmentArcanaArtifacts: import('../candidate-artifacts').JudgmentArcanaCandidateArtifacts;
  readonly keepsakeSelectionArtifacts: import('../candidate-artifacts').KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResultArtifacts: import('../candidate-artifacts').KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversionArtifacts: import('../candidate-artifacts').AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntryArtifacts: import('../candidate-artifacts').DerivedAcquisitionEntryCandidateArtifacts;
  readonly steadyGrowthArtifacts: import('../candidate-artifacts').SteadyGrowthCandidateArtifacts;
  readonly purgingPoolArtifacts: import('../candidate-artifacts').PurgingPoolCandidateArtifacts;
  readonly hermesShrineArtifacts: import('../candidate-artifacts').HermesShrineCandidateArtifacts;
  readonly stygianWellArtifacts: import('../candidate-artifacts').StygianWellCandidateArtifacts;
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
  readonly findingRegions: readonly FindingRegionEntry[];
}

export interface TraitChildSettlementCheckpoint {
  readonly branches: readonly RewardBranch[];
  readonly runStateSnapshots: readonly RunStateSnapshot[];
}

export interface TraitChildSettlementCheckpoints {
  readonly at: (address: SemanticAddress) => TraitChildSettlementCheckpoint | undefined;
}

export function evaluateBiomeRewardsAssemblyInternal(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches: readonly RewardBranch[] | undefined = undefined,
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardEvaluationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRewardSimulationContractError('reward inputs do not share one biome owner');
  }
  const fullRunBiomeCount = catalog.routes.byKey[snapshot.routeKey]?.biomeKeys.length;
  if (fullRunBiomeCount === undefined) {
    throw new BiomeRewardSimulationContractError(
      `${snapshot.routeKey} has no catalog route for Boss Judgment effects`,
    );
  }
  const prepared = prepareRewardEvaluationInputs(catalog, snapshot, history);
  const {
    layout,
    rewardLookup,
    rooms,
    views,
    targets,
    additionalContinuations,
    hubTargetByOrigin,
    lifecycle,
  } = prepared;
  const authoredSeaStarDuplicateSiteKeys = new Set(
    [...rooms.values()].flatMap((room) =>
      room.kind === 'authored'
        ? Object.keys(room.acquisitionSites).filter(
            (siteKey) => parseSeaStarDuplicateSiteKey(siteKey) !== undefined,
          )
        : [],
    ),
  );
  const forcedSparkChaosSourceOccurrenceIds = new Set(
    [...additionalContinuations.values()].flatMap((continuation) =>
      continuation.key === 'sparkChaos' ? [continuation.origin.occurrenceId] : [],
    ),
  );
  const batchesByParent = prepared.batchesByParent;
  const emptyOutgoingOrigins = new Set(
    history.events.flatMap((event) =>
      event.kind === 'emptyOutgoingGenerationCompleted' ? [semanticAddressKey(event.origin)] : [],
    ),
  );
  const judgmentArcanaContexts = new Map<
    string,
    import('../candidate-artifacts').JudgmentArcanaCandidateCapability
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
    readonly import('./acquisition-settlement').DerivedAcquisitionEntryFrontier[]
  >();
  const figLeafPhaseCandidates = new Map<string, import('./model').FigLeafPhaseCandidateSupport>();
  const gorgonPhaseCandidates = new Map<string, import('./model').GorgonPhaseCandidateSupport>();
  const nemesisRandomEventCandidates = new Map<
    string,
    import('./model').NemesisRandomEventCandidateSupport
  >();
  const runtimeOfferFallbacks = new Map<
    string,
    {
      readonly address: SemanticAddress;
      readonly preferredKey: string;
      readonly fallbackKey: string;
    }
  >();
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
      const replacement = frontier.artificerReplacementCandidate;
      const replacementKey = semanticAddressKey(frontier.artificerReplacementAddress);
      if (replacement !== undefined && !producerFrontiers.has(replacementKey))
        indexRewardProducerFrontier(
          producerFrontiers,
          Object.freeze({
            generationPolicy: 'sequential',
            generationHistorySequence: frontier.historySequence,
            reachableBranchCount: frontier.branchesBeforeRole.length,
            acquisitionHorizon: 'ownEnteredLifecycle',
            owners: Object.freeze([frontier.artificerReplacementAddress]),
            evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) =>
              semanticAddressKey(owner) === replacementKey
                ? replacement.evaluateOffer(offer)
                : fail('Artificer replacement frontier received a foreign owner'),
          }),
        );
    }
  }
  function recordRuntimeOfferFallbacks(
    fallbacks:
      | readonly {
          readonly address: SemanticAddress;
          readonly preferredRewardType: string;
          readonly fallbackRewardType: string;
        }[]
      | undefined,
  ): void {
    for (const fallback of fallbacks ?? []) {
      const key = semanticAddressKey(fallback.address);
      runtimeOfferFallbacks.set(
        key,
        Object.freeze({
          address: fallback.address,
          preferredKey: fallback.preferredRewardType,
          fallbackKey: fallback.fallbackRewardType,
        }),
      );
    }
  }
  function recordDerivedAcquisitionEntryFrontiers(
    frontiers:
      readonly import('./acquisition-settlement').DerivedAcquisitionEntryFrontier[] | undefined,
  ): void {
    const incomingByOwner = new Map<
      string,
      import('./acquisition-settlement').DerivedAcquisitionEntryFrontier[]
    >();
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.address);
      incomingByOwner.set(key, [...(incomingByOwner.get(key) ?? []), frontier]);
    }
    for (const [key, incoming] of incomingByOwner) {
      const firstIncoming = incoming[0];
      const completeIncomingCohort =
        firstIncoming !== undefined && incoming.length === firstIncoming.branchCohortSize;
      const combined = Object.freeze(
        completeIncomingCohort
          ? incoming
          : [...(derivedAcquisitionEntryContexts.get(key) ?? []), ...incoming],
      );
      derivedAcquisitionEntryContexts.set(key, combined);
      const first = combined[0];
      if (
        (first?.kind !== 'travelDealRefill' &&
          first?.kind !== 'infernalContractReward' &&
          first?.kind !== 'echoDoubleShopReward') ||
        combined.length !== first.branchCohortSize ||
        combined.some((candidate) => candidate.evaluateOffer === undefined) ||
        producerFrontiers.has(key)
      )
        continue;
      recordAcquisitionRoleFrontiers(
        combined.flatMap((candidate) => candidate.roleFrontiers ?? Object.freeze([])),
      );
      indexRewardProducerFrontier(
        producerFrontiers,
        Object.freeze({
          generationPolicy:
            first.kind === 'travelDealRefill'
              ? ('jointShopInventory' as const)
              : ('sequential' as const),
          generationHistorySequence: Math.max(
            ...combined.flatMap((candidate) =>
              candidate.branchesBeforeEntry.map((branch) => branch.processedThroughHistorySequence),
            ),
          ),
          reachableBranchCount: combined.length,
          acquisitionHorizon:
            first.kind === 'travelDealRefill' || first.kind === 'echoDoubleShopReward'
              ? ('generationOnly' as const)
              : ('ownEnteredLifecycle' as const),
          owners: Object.freeze([first.address]),
          evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
            if (semanticAddressKey(owner) !== key)
              return fail('derived Shop reward frontier received a foreign owner');
            const results = combined.map((candidate) => candidate.evaluateOffer!(offer));
            return Object.freeze({
              findings: Object.freeze(results.flatMap((result) => result.findings)),
              supported: results.every((result) => result.supported),
            });
          },
        }),
      );
    }
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
  // Hub visit targets and their entered local rooms restore to an existing
  // parent rather than generating another ordinary decision. Their outgoing
  // checkpoints must still advance reward history without inventing a batch.
  const activeHubVisit = prepared.activeHubVisit;
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
  const purgingPoolAssessments = new Map<
    string,
    {
      readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly PurgingPoolAssessment[];
    }
  >();
  const hermesShrineAssessments = new Map<
    string,
    {
      readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly HermesShrineCandidateContext[];
    }
  >();
  const stygianWellAssessments = new Map<
    string,
    {
      readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly StygianWellCandidateContext[];
    }
  >();
  const hermesShrineTravelDealRefills = new Map<
    string,
    readonly import('../hermes-shrine').HermesShrineTravelDealRefillAssessment[]
  >();
  const hermesShrineTravelDealRefillValid = new Map<string, boolean>();
  // The handler's FirstSpeedUpPurchase guard belongs to the Shrine room, not
  // to a branch.  We still require Travel Deal to agree across every branch
  // at that first action prefix before publishing a refill generation.
  const firstRushedInitialGenerationByShrine = new Set<string>();
  // H's event is a passive room feature, not a replacement for any cage or
  // optional leaf.  Keep an over-cap authored count materialized for repair,
  // but make the one reserved physical optional position an evaluated error.
  for (const room of rooms.values()) {
    if (room.kind !== 'authored' || room.fieldsOptionalRewardCount === undefined) continue;
    const passive = createEncounterPhaseAddress(
      createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
      { kind: 'occurrence' as const, occurrenceId: room.occurrenceId },
      'Passive',
    );
    const owner = createNemesisRandomEventAddress(passive);
    const support = fieldsOptionalRewardCountSupport(catalog, room, room.origin);
    if (
      support === undefined ||
      !support.reservesNemesisPosition ||
      room.fieldsOptionalRewardCount <= support.effectiveMaximum
    )
      continue;
    addRewardFinding(
      findings,
      rewardFinding('fieldsOptionalCapacityUnavailable', owner, {
        physicalCapacity: support.physicalMaximum,
        effectiveCapacity: support.effectiveMaximum,
        selectedCount: room.fieldsOptionalRewardCount,
      }),
      ownerRegion(owner),
    );
  }
  const producerFrontiers = new Map<string, RewardProducerFrontier>();
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
  const runStateSnapshotsByOwner = new Map<string, RunStateSnapshot>();
  const traitChildSettlementBuilders = new Map<
    string,
    {
      readonly occurrenceOwner: SemanticAddress;
      readonly branches: RewardBranchState[];
      readonly candidateContexts: TraitOfferCandidateContext[];
      readonly runStateSnapshots: Map<string, RunStateSnapshot>;
    }
  >();
  const steadyGrowthCandidateContexts = new Map<string, ReachedSteadyGrowthThreshold[]>();
  const steadyGrowthOutcomeAddresses = new Map<string, SteadyGrowthOutcomeAddress>();
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
          candidateContexts:
            checkpoint.candidateContext === undefined ? [] : [checkpoint.candidateContext],
          runStateSnapshots: new Map(),
        });
      else {
        current.branches.push(checkpoint.branch);
        if (checkpoint.candidateContext !== undefined)
          current.candidateContexts.push(checkpoint.candidateContext);
      }
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
  let pendingHubBoard: PendingHubBoardGeneration | undefined;
  const runStateDerivationCache = createRunStateDerivationCache();

  function captureRunState(
    owner: RunStateSnapshot['owner'],
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
    const currentShopNames = visibleStoreOptionNames(
      source,
      hermesShrineAssessments.get(semanticAddressKey(source.origin))?.assessments,
    );
    // One token represents this exact rewardFacts closure: current/source room,
    // declaration, immutable view, entered-biome count, shop names, peer
    // context, and reward lookups. It cannot alias a later checkpoint even
    // when that checkpoint retains the same RewardHistoryState identity.
    const factsContextToken = Object.freeze({});
    const snapshotFor = (checkpointBranches: readonly RewardBranchState[]) =>
      createRunState({
        catalog,
        owner,
        historyView: view,
        branches: checkpointBranches,
        enteredBiomeCount,
        derivationCache: runStateDerivationCache,
        factsContextToken,
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
    // Trait-child candidate checkpoints retain only generation snapshots. Room
    // lifecycle diagnostics are occurrence-local and never become a later
    // candidate-generation authority.
    if (owner.kind === 'roomRunStateCheckpoint') return;
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
        pendingSpellDrops: Object.freeze(
          branches.map((branch) =>
            Object.values(branch.pendingHermesShrineDeliveries).some(
              (delivery) => delivery.reward.offer.rewardType === 'SpellDrop',
            ),
          ),
        ),
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
    onlyEntry?: { readonly siteKey: string; readonly entryKey: string },
    completeShopAfterOrder = true,
    activationOnly = false,
  ): readonly RewardBranchState[] {
    if (Object.keys(room.acquisitionSites).length === 0 && room.entryState?.kind !== 'shop') {
      return sourceBranches;
    }
    const selectedSiteKey = onlyEntry?.siteKey ?? Object.keys(room.acquisitionSites)[0];
    const selectedSite =
      selectedSiteKey === undefined ? undefined : room.acquisitionSites[selectedSiteKey];
    const producer = room.pickupProducers?.find(
      (candidate) => candidate.siteKey === selectedSiteKey,
    );
    const seaStarDuplicate =
      selectedSiteKey === undefined ? undefined : parseSeaStarDuplicateSiteKey(selectedSiteKey);
    if (selectedSite !== undefined && seaStarDuplicate !== undefined) {
      const duplicateEntry = selectedSite.entries[SEA_STAR_DUPLICATE_ENTRY_KEY];
      if (duplicateEntry === undefined || duplicateEntry === null) return sourceBranches;
      const source = canonicalArtificerSource(room, seaStarDuplicate.sourceKey);
      if (source === undefined)
        throw new BiomeRewardSimulationContractError(
          `${room.gameName} lost Sea Star source for ${selectedSiteKey}`,
        );
      const sourceAddress = createAcquisitionRoleAddress(
        source.owner,
        seaStarDuplicate.acquisitionRole,
      );
      const sourceAddressKey = semanticAddressKey(sourceAddress);
      // A direct Shop offer is paid and therefore remains a repair-only
      // authored result. A free acquisition entry generated in a Shop uses
      // its own lifecycle and settles like any other free source.
      if (source.owner.kind === 'shopOffer') return sourceBranches;
      const duplicateUsesFreshObject = seaStarDuplicateUsesFreshObject(
        catalog,
        source.reward,
        seaStarDuplicate.acquisitionRole,
      );
      const producerLifecycleKey = duplicateUsesFreshObject
        ? 'RoomReward'
        : source.producerLifecycleKey;
      if (producerLifecycleKey === undefined)
        throw new BiomeRewardSimulationContractError(
          `${room.gameName} lost Sea Star producer lifecycle for ${selectedSiteKey}`,
        );
      // The duplicate can be placed after other room actions. Its eligibility
      // is nevertheless the source's own pre-acquisition attestation, not
      // whatever traits happen to be equipped at this later action.
      const supportedBranches = sourceBranches.filter(
        (branch) => branch.seaStarDuplicateEligibilityBySource?.[sourceAddressKey]?.supported,
      );
      if (supportedBranches.length !== sourceBranches.length) {
        const unsupported = sourceBranches.find(
          (branch) => !branch.seaStarDuplicateEligibilityBySource?.[sourceAddressKey]?.supported,
        );
        if (unsupported !== undefined) {
          addRewardFinding(
            targetFindings,
            rewardFinding(
              'seaStarDuplicationUnavailable',
              sourceAddress,
              unsupported.seaStarDuplicateEligibilityBySource?.[sourceAddressKey]?.evidence ??
                Object.freeze({ reason: 'sourceFrontierNotReached' }),
            ),
            ownerRegion(sourceAddress),
            rewardFindingChronologyForRoom(
              snapshot,
              room.origin,
              historySequence,
              'localRoomLifecycle',
            ),
          );
        }
      }
      if (supportedBranches.length === 0) return sourceBranches;
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
      const settled = settlePickupAcquisitionSite(
        catalog,
        supportedBranches,
        {
          siteOwner: room.origin,
          site: selectedSite.address,
          entries: Object.freeze({ [SEA_STAR_DUPLICATE_ENTRY_KEY]: duplicateEntry }),
          order: activationOnly ? Object.freeze([]) : Object.freeze([SEA_STAR_DUPLICATE_ENTRY_KEY]),
          producerLifecycleKey,
          requiredEntryKeys: new Set(
            duplicateUsesFreshObject ? [SEA_STAR_DUPLICATE_ENTRY_KEY] : [],
          ),
          seaStarDuplicateEntryKeys: new Set([SEA_STAR_DUPLICATE_ENTRY_KEY]),
          authoredSeaStarDuplicateSiteKeys,
          historySequence,
          findingChronology: rewardFindingChronologyForRoom(
            snapshot,
            room.origin,
            historySequence,
            'localRoomLifecycle',
          ),
          facts: pickupFacts,
          traitContext: routeLoadout,
        },
        targetFindings,
      );
      recordAcquisitionRoleFrontiers(settled.roleFrontiers);
      recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
      return Object.freeze([
        ...sourceBranches.filter((branch) => !supportedBranches.includes(branch)),
        ...settled.branches,
      ]);
    }
    if (room.entryState?.kind !== 'shop') {
      if (selectedSite === undefined || selectedSiteKey === undefined) return sourceBranches;
      if (producer === undefined) return sourceBranches;
      const sourceWasNormallyAcquired = producer.sourceNormal;
      // A selected producer is structural authoring detail. Its pickup site
      // becomes live only for that exact normal participating acquisition;
      // Time Piece, Artificer, and an unpicked optional source do not create it.
      if (!sourceWasNormallyAcquired) return sourceBranches;
      const requiredEntryKeys = new Set(
        producer.pickups.filter((pickup) => pickup.required).map((pickup) => pickup.key),
      );
      const echoReplay = producer.traitKey === 'EchoLastReward';
      const replayEntryKey = echoReplay ? producer.pickups[0]?.key : undefined;
      const replayEntry =
        replayEntryKey === undefined ? undefined : selectedSite.entries[replayEntryKey];
      const replaySources = echoReplay
        ? sourceBranches.map((branch) => branch.history.lastRewardRecreation)
        : Object.freeze([]);
      const firstReplay = replaySources[0];
      const agreedReplay =
        firstReplay !== undefined &&
        replaySources.length === sourceBranches.length &&
        replaySources.every(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(firstReplay),
        )
          ? firstReplay
          : undefined;
      const replaySourceMismatch =
        echoReplay &&
        (agreedReplay === undefined ||
          (replayEntry !== undefined &&
            replayEntry !== null &&
            JSON.stringify(replayEntry.offer) !== JSON.stringify(agreedReplay.offer)));
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
      if (echoReplay && replayEntryKey !== undefined && agreedReplay !== undefined) {
        const replayAddress = createAcquisitionEntryAddress(selectedSite.address, replayEntryKey);
        const fixedReward = createUnresolvedAcquisitionRewardState(catalog, agreedReplay.offer, {
          kind: 'producerLifecycle',
          key: 'EchoLastReward',
        });
        recordDerivedAcquisitionEntryFrontiers(
          sourceBranches.map((branch) =>
            Object.freeze({
              address: replayAddress,
              kind: 'echoLastReward' as const,
              branchCohortSize: sourceBranches.length,
              rewardTypes: Object.freeze([agreedReplay.offer.rewardType]),
              fixedReward,
              retainedSourceMismatch:
                replayEntry !== undefined &&
                replayEntry !== null &&
                JSON.stringify(replayEntry.offer) !== JSON.stringify(agreedReplay.offer),
              branchesBeforeEntry: Object.freeze([branch]),
            }),
          ),
        );
      }
      if (replaySourceMismatch && replayEntryKey !== undefined) {
        const replayAddress = createAcquisitionEntryAddress(selectedSite.address, replayEntryKey);
        addRewardFinding(
          targetFindings,
          rewardFinding('rewardSourceUnavailable', replayAddress, {
            reason: agreedReplay === undefined ? 'branchDivergence' : 'retainedSourceMismatch',
            ...(agreedReplay === undefined ? {} : { rewardType: agreedReplay.offer.rewardType }),
          }),
          ownerRegion(replayAddress),
          findingChronology,
        );
      }
      const pickupEntries =
        onlyEntry === undefined || onlyEntry.entryKey.length === 0
          ? selectedSite.entries
          : Object.freeze({
              [onlyEntry.entryKey]: selectedSite.entries[onlyEntry.entryKey] ?? null,
            });
      const settled = settlePickupAcquisitionSite(
        catalog,
        sourceBranches,
        {
          siteOwner: room.origin,
          site: selectedSite.address,
          entries: pickupEntries,
          order: activationOnly
            ? Object.freeze([])
            : onlyEntry === undefined || onlyEntry.entryKey.length === 0
              ? Object.freeze(
                  room.roomActions.order.flatMap((reference) =>
                    reference.kind === 'interactAcquisitionEntry' &&
                    reference.siteKey === selectedSiteKey
                      ? [reference.entryKey]
                      : [],
                  ),
                )
              : Object.freeze([onlyEntry.entryKey]),
          producerLifecycleKey: producer.producerLifecycleKey,
          authoredSeaStarDuplicateSiteKeys,
          requiredEntryKeys,
          historySequence,
          findingChronology,
          facts: pickupFacts,
          traitContext: routeLoadout,
          publishUnpickedChildFrontiers: activationOnly,
          artificerReplacementFor(source, role) {
            const site = artificerAcquisitionSite(room.origin, source);
            return (
              room.acquisitionSites[acquisitionSiteStorageKey(site)]?.entries[
                artificerReplacementEntryKey(source, role)
              ] ?? null
            );
          },
          artificerReplacementSiteFor(source) {
            return artificerAcquisitionSite(room.origin, source);
          },
        },
        targetFindings,
      );
      if (!replaySourceMismatch) {
        recordAcquisitionRoleFrontiers(settled.roleFrontiers);
        recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
      }
      for (const frontier of activationOnly ? (settled.pickupEntryFrontiers ?? []) : []) {
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
              // resolves only its declaration-compatible payload at this
              // exact site frontier; pickup order independently decides
              // whether the completed entry is acquired.
              const fixedRewardType = echoReplay
                ? agreedReplay?.offer.rewardType
                : (frontier.reward?.offer.rewardType ??
                  producer.pickups.find((pickup) => pickup.key === frontier.address.entryKey)
                    ?.rewardType);
              if (
                fixedRewardType === undefined ||
                offer.rewardType !== fixedRewardType ||
                (echoReplay && JSON.stringify(offer) !== JSON.stringify(agreedReplay?.offer))
              ) {
                return Object.freeze({ findings: Object.freeze([]), supported: false });
              }
              const candidateFindings = new Map<string, FindingRegionEntry>();
              const candidateBranches = settlePickupAcquisitionSite(
                catalog,
                frontier.branchesBeforeEntry,
                {
                  siteOwner: room.origin,
                  site: selectedSite.address,
                  entries: Object.freeze({
                    [frontier.address.entryKey]: createUnresolvedPickupRewardState(
                      catalog,
                      offer,
                      producer.producerLifecycleKey,
                    ),
                  }),
                  order: room.roomActions.order.some(
                    (reference) =>
                      reference.kind === 'interactAcquisitionEntry' &&
                      reference.siteKey === selectedSiteKey &&
                      reference.entryKey === frontier.address.entryKey,
                  )
                    ? Object.freeze([frontier.address.entryKey])
                    : Object.freeze([]),
                  producerLifecycleKey: producer.producerLifecycleKey,
                  authoredSeaStarDuplicateSiteKeys,
                  requiredEntryKeys,
                  historySequence,
                  findingChronology,
                  publishUnpickedChildFrontiers: false,
                  facts: pickupFacts,
                  traitContext: routeLoadout,
                  artificerReplacementFor(source, role) {
                    const site = artificerAcquisitionSite(room.origin, source);
                    return (
                      room.acquisitionSites[acquisitionSiteStorageKey(site)]?.entries[
                        artificerReplacementEntryKey(source, role)
                      ] ?? null
                    );
                  },
                  artificerReplacementSiteFor(source) {
                    return artificerAcquisitionSite(room.origin, source);
                  },
                },
                candidateFindings,
              ).branches;
              return candidateResult(candidateFindings, candidateBranches);
            },
          }),
        );
      }
      return replaySourceMismatch ? Object.freeze([]) : settled.branches;
    }
    const settlementRoom = room;
    const settled = settleShopAcquisitionSite(
      sourceBranches,
      {
        catalog,
        room: settlementRoom,
        order: activationOnly
          ? Object.freeze([])
          : onlyEntry === undefined
            ? Object.freeze(
                room.roomActions.order.flatMap((reference) =>
                  reference.kind === 'interactShopOffer' ? [reference.offerKey] : [],
                ),
              )
            : Object.freeze([onlyEntry.entryKey]),
        completeAfterOrder: completeShopAfterOrder,
        authoredSeaStarDuplicateSiteKeys,
        declaration,
        historySequence,
        findingChronology: rewardFindingChronologyForRoom(
          snapshot,
          room.origin,
          historySequence,
          'localRoomLifecycle',
        ),
        facts: (branchHistory, shopNames = new Set(), branch) =>
          rewardFacts(
            catalog,
            settlementRoom,
            settlementRoom,
            declaration,
            roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
            branchHistory,
            enteredBiomeCount,
            shopNames,
            undefined,
            undefined,
            rewardLookup.internal,
            branch,
          ),
        fail,
      },
      targetFindings,
    );
    // Shop-spawned objects cannot duplicate. Their structurally retained
    // result stays available for repair, but has no active child action; use
    // the captured source frontiers to publish the source-role finding.
    for (const siteKey of Object.keys(room.acquisitionSites)) {
      const seaStarDuplicate = parseSeaStarDuplicateSiteKey(siteKey);
      if (seaStarDuplicate === undefined) continue;
      const source = canonicalArtificerSource(room, seaStarDuplicate.sourceKey);
      if (source === undefined) continue;
      const sourceAddress = createAcquisitionRoleAddress(
        source.owner,
        seaStarDuplicate.acquisitionRole,
      );
      if (
        source.reward.dispositionByAcquisitionRole[seaStarDuplicate.acquisitionRole]?.kind !==
        'normal'
      )
        continue;
      const unsupportedFromFrontier = (settled.roleFrontiers ?? [])
        .filter(
          (frontier) => semanticAddressKey(frontier.address) === semanticAddressKey(sourceAddress),
        )
        .flatMap((frontier) =>
          frontier.branchesBeforeRole.map((branch) =>
            assessSeaStarDuplication(catalog, branch, frontier.source, {
              role: seaStarDuplicate.acquisitionRole,
              lifecyclePoint: frontier.lifecyclePoint,
            }),
          ),
        )
        .find((assessment) => !assessment.supported);
      const sourceOfferKey = source.owner.kind === 'shopOffer' ? source.owner.offerKey : undefined;
      const sourceWasPurchased =
        !activationOnly &&
        sourceOfferKey !== undefined &&
        (onlyEntry === undefined
          ? room.roomActions.order.some(
              (action) => action.kind === 'interactShopOffer' && action.offerKey === sourceOfferKey,
            )
          : onlyEntry.entryKey === sourceOfferKey);
      const unsupported =
        unsupportedFromFrontier ??
        (sourceWasPurchased
          ? sourceBranches
              .map((branch) =>
                assessSeaStarDuplication(
                  catalog,
                  branch,
                  Object.freeze({
                    origin: source.owner,
                    offer: source.reward.offer,
                    producerLifecycleKey: 'Shop',
                    instanceProvenance: 'paid' as const,
                    dispositionByAcquisitionRole: source.reward.dispositionByAcquisitionRole,
                  }),
                  { role: seaStarDuplicate.acquisitionRole, lifecyclePoint: 'purchase' },
                ),
              )
              .find((assessment) => !assessment.supported)
          : undefined);
      if (unsupported === undefined) continue;
      addRewardFinding(
        targetFindings,
        rewardFinding('seaStarDuplicationUnavailable', sourceAddress, unsupported.evidence),
        ownerRegion(sourceAddress),
        rewardFindingChronologyForRoom(
          snapshot,
          room.origin,
          historySequence,
          'localRoomLifecycle',
        ),
      );
    }
    recordAcquisitionRoleFrontiers(settled.roleFrontiers);
    recordRuntimeOfferFallbacks(settled.runtimeOfferFallbacks);
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
            preparedAcquisitionSiteOwner(snapshot, entry.room),
            authoredSeaStarDuplicateSiteKeys,
          );
          candidateBranches = settlement.branches;
        }
      }
    }
    return candidateResult(candidateFindings, candidateBranches);
  }

  function flushPendingHubBoard(): void {
    const pending = pendingHubBoard;
    if (pending === undefined || pending.participants.length === 0) return;
    const owners = Object.freeze(pending.participants.map((entry) => entry.incoming.origin));
    const ownerKeys = new Set(owners.map(semanticAddressKey));
    const generationHistorySequence = Math.max(
      ...pending.participants.map((entry) =>
        entry.kind === 'resolved' ? entry.context.historySequence : entry.historySequence,
      ),
    );
    const resolvedEntries = pending.participants.filter(
      (entry): entry is ResolvedHubBoardGenerationParticipant => entry.kind === 'resolved',
    );
    const unresolvedEntries = pending.participants.filter(
      (entry): entry is UnresolvedHubBoardGenerationParticipant => entry.kind === 'unresolved',
    );
    const selectedBoardBranches =
      unresolvedEntries.length === 0
        ? processOfferGenerationCohort(
            pending.frontierBranches,
            Object.freeze(resolvedEntries.map((entry) => entry.context)),
            findings,
            { ordering: 'sourceOffers' },
          )
        : Object.freeze([]);
    for (const entry of unresolvedEntries) {
      addRewardFinding(
        findings,
        rewardFinding('rewardMissing', entry.incoming.origin, {}),
        ownerRegion(entry.incoming.origin),
        Object.freeze({
          kind: 'hubBoard' as const,
          history: historyFindingChronology(entry.historySequence),
        }),
      );
    }
    const evaluateHubBoardOffer = (
      owner: SemanticAddress,
      offer: CanonicalResolvedIncomingReward['offer'],
    ): RewardProducerCandidateResult => {
      const ownerKey = semanticAddressKey(owner);
      if (!ownerKeys.has(ownerKey)) {
        return fail('Hub-board frontier received a foreign owner');
      }
      // A focused edit is assessed against the identities currently resolved
      // on this one board. Unresolved peers remain absent rather than being
      // existentially completed from their entire domains. This keeps board
      // authoring total and bounded without borrowing any later visit,
      // acquisition, encounter, or side-room history.
      const contexts = Object.freeze(
        pending.participants.flatMap((entry): readonly OfferProcessingContext[] => {
          const isFocused = semanticAddressKey(entry.incoming.origin) === ownerKey;
          if (entry.kind === 'unresolved') {
            if (!isFocused) return Object.freeze([]);
            const incoming = entry.candidateFor(offer);
            const binding = countedBinding(entry.declaration, incoming);
            return Object.freeze([
              Object.freeze({
                catalog,
                reward: incoming,
                ...(binding === undefined ? {} : { binding }),
                historySequence: entry.historySequence,
                peers: Object.freeze([]),
                facts: entry.facts,
              }),
            ]);
          }
          const incoming = isFocused ? Object.freeze({ ...entry.incoming, offer }) : entry.incoming;
          return Object.freeze([Object.freeze({ ...entry.context, reward: incoming })]);
        }),
      );
      const focusedContext = contexts.find(
        (context) => semanticAddressKey(context.reward.origin) === ownerKey,
      );
      if (focusedContext === undefined) return fail('Hub-board frontier lost its focused context');
      const peerContexts = Object.freeze(
        contexts.filter((context) => semanticAddressKey(context.reward.origin) !== ownerKey),
      );
      const candidateFindings = new Map<string, FindingRegionEntry>();
      const candidateBranches = processFocusedOfferAfterAuthoredPeers(
        pending.frontierBranches,
        peerContexts,
        focusedContext,
        candidateFindings,
      );
      return Object.freeze({
        findings: Object.freeze(
          [...candidateFindings.values()]
            .map((entry) => entry.finding)
            .filter((finding) => finding.code !== 'traitOfferMissing'),
        ),
        supported: candidateBranches.length > 0,
      });
    };
    for (const entry of pending.participants) {
      indexRewardProducerFrontier(
        producerFrontiers,
        Object.freeze({
          generationPolicy: 'jointUnordered',
          generationHistorySequence,
          reachableBranchCount: pending.frontierBranches.length,
          acquisitionHorizon: 'generationOnly',
          owners: Object.freeze([entry.incoming.origin]),
          ...(entry.incoming.resolvedStoreKey === undefined
            ? {}
            : { resolvedStoreKey: entry.incoming.resolvedStoreKey }),
          evaluateOffer: evaluateHubBoardOffer,
        }),
      );
    }
    branches = selectedBoardBranches;
    peers = Object.freeze(
      resolvedEntries.map((entry) => ({
        origin: entry.context.reward.origin,
        offer: entry.context.reward.offer,
      })),
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
        if (room?.kind === 'authored' && room.lifecycleProfileKey === 'ShipCombatRoom') {
          const view = views
            .get(semanticAddressKey(event.origin))
            ?.encounterStarts.find((candidate) => candidate.phaseKey === event.phaseKey)?.before;
          if (view === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} ${event.phaseKey} has no pre-encounter Run State view`,
            );
          }
          captureRunState(
            createRoomRunStateCheckpointAddress(room.origin, {
              kind: 'beforeEncounterStart',
              phaseKey: event.phaseKey,
            }),
            room,
            view,
          );
        }
        const figLeafTransition = applyEncounterStartedTransition(
          catalog,
          snapshot,
          event,
          room?.kind === 'authored' ? room : undefined,
          branches,
        );
        branches = figLeafTransition.branches;
        for (const entry of figLeafTransition.figLeafCandidates)
          figLeafPhaseCandidates.set(entry.key, entry.candidate);
        for (const entry of figLeafTransition.findings)
          addRewardFinding(findings, entry.finding, entry.region, entry.chronology);
        // Gorgon is an additive appearance on the existing phase. Eligibility
        // is evaluated at the predecessor/pre-room checkpoint after Fig Leaf
        // execution; the pending branch remains untouched until completion.
        const gorgonDeclaration =
          room !== undefined && room.kind === 'authored'
            ? catalog.rooms.byKey[room.gameName]
            : undefined;
        const gorgonView =
          room === undefined ? undefined : views.get(semanticAddressKey(room.origin));
        const gorgonPhase =
          room !== undefined && room.kind === 'authored'
            ? room.encounterPhases.find((candidate) => candidate.slotKey === event.phaseKey)
            : undefined;
        if (
          room !== undefined &&
          room.kind === 'authored' &&
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
            { kind: 'occurrence', occurrenceId: room.occurrenceId },
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
              athenaTriggerConditionMet:
                room.encounters.gorgonResultByPhase?.[event.phaseKey]?.athenaTriggerConditionMet ===
                true,
            })
          ) {
            if (!gorgonEvaluationBlocked)
              eligibleGorgonPhases.add(`${semanticAddressKey(event.origin)}::${event.phaseKey}`);
          }
        }
        break;
      }
      case 'roomEntered': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const entered = applyRoomEnteredTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin)),
          forcedSparkChaosSourceOccurrenceIds,
          branches,
          rewardFindingChronologyForRoom(
            snapshot,
            event.origin as CanonicalAuthoredRoom['origin'],
            event.sequence,
            'localRoomLifecycle',
          ),
          enteredBiomeCount,
          Object.freeze({
            purgingPool:
              room?.kind === 'authored' &&
              purgingPoolAssessments.has(semanticAddressKey(room.origin)),
            hermesShrine:
              room?.kind === 'authored' &&
              hermesShrineAssessments.has(semanticAddressKey(room.origin)),
            stygianWell:
              room?.kind === 'authored' &&
              stygianWellAssessments.has(semanticAddressKey(room.origin)),
          }),
        );
        branches = entered.branches;
        for (const entry of entered.findings)
          addRewardFinding(findings, entry.finding, entry.region, entry.chronology);
        if (entered.purgingPoolAssessment !== undefined)
          purgingPoolAssessments.set(
            semanticAddressKey(entered.purgingPoolAssessment.origin),
            entered.purgingPoolAssessment,
          );
        if (entered.hermesShrineAssessment !== undefined)
          hermesShrineAssessments.set(
            semanticAddressKey(entered.hermesShrineAssessment.origin),
            entered.hermesShrineAssessment,
          );
        if (entered.stygianWellAssessment !== undefined)
          stygianWellAssessments.set(
            semanticAddressKey(entered.stygianWellAssessment.origin),
            entered.stygianWellAssessment,
          );
        if (entered.runStateCheckpoint !== undefined) {
          const { owner, room: checkpointRoom, view } = entered.runStateCheckpoint;
          if (view === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${checkpointRoom.gameName} has no room-entry Run State view`,
            );
          }
          captureRunState(owner, checkpointRoom, view);
        }
        break;
      }
      case 'roomPrepared':
        branches = applyRoomPreparedTransition(event, branches);
        break;
      case 'keepsakeRackUsed': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyKeepsakeRackUsedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin))?.entry,
          routeLoadout,
          branches,
        );
        branches = transition.branches;
        if (transition.keepsakeSelectionCandidate !== undefined)
          keepsakeSelectionContexts.set(
            transition.keepsakeSelectionCandidate.key,
            transition.keepsakeSelectionCandidate.candidate,
          );
        for (const candidate of transition.keepsakeEquipResultCandidates)
          keepsakeEquipResultContexts.set(candidate.key, candidate.candidate);
        for (const finding of transition.findings)
          addRewardFinding(findings, finding.finding, finding.region, finding.chronology);
        break;
      }
      case 'roomCreated': {
        // Candidate evaluation needs the precise pre-rack frontier even while
        // Retain leaves the optional rack action absent.  Do not apply a
        // disposition here: ranked `keepsakeRackUsed` is the sole mutation
        // point for a replacement and its immediate result.
        const rackRoom = rooms.get(semanticAddressKey(event.origin));
        if (rackRoom?.kind === 'authored' && rackRoom.keepsakeRack !== undefined) {
          if (event.origin.kind !== 'occurrence') break;
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
        const unresolvedIncoming = room.unresolvedIncomingReward;
        const concreteLocalRewards = room.kind === 'authored' ? (room.localRewards ?? []) : [];
        const unresolvedLocalRewards =
          room.kind === 'authored' ? (room.unresolvedLocalRewards ?? []) : [];
        const orderedLocalRewards = Object.freeze(
          [...concreteLocalRewards, ...unresolvedLocalRewards].sort(
            (left, right) =>
              room.encounterPhases.findIndex((phase) => phase.slotKey === left.encounterPhaseKey) -
              room.encounterPhases.findIndex((phase) => phase.slotKey === right.encounterPhaseKey),
          ),
        );
        const firstUnresolvedLocalIndex = orderedLocalRewards.findIndex((reward) =>
          unresolvedLocalRewards.includes(reward as (typeof unresolvedLocalRewards)[number]),
        );
        const concreteLocalKeys = new Set(concreteLocalRewards.map((reward) => reward.slotKey));
        const localRewards = Object.freeze(
          orderedLocalRewards
            .slice(
              0,
              firstUnresolvedLocalIndex < 0
                ? orderedLocalRewards.length
                : firstUnresolvedLocalIndex,
            )
            .filter((reward): reward is CanonicalLocalReward =>
              concreteLocalKeys.has(reward.slotKey),
            ),
        );
        const unresolvedLocalReward =
          firstUnresolvedLocalIndex < 0
            ? undefined
            : (orderedLocalRewards[
                firstUnresolvedLocalIndex
              ] as (typeof unresolvedLocalRewards)[number]);
        if (
          incoming === undefined &&
          unresolvedIncoming === undefined &&
          localRewards.length === 0 &&
          unresolvedLocalRewards.length === 0
        ) {
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
            currentShopNames = visibleStoreOptionNames(
              parent,
              hermesShrineAssessments.get(semanticAddressKey(parent.origin))?.assessments,
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
          currentShopNames = visibleStoreOptionNames(
            parent,
            hermesShrineAssessments.get(semanticAddressKey(parent.origin))?.assessments,
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
        } else if (event.source === 'localVisit') {
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
          peerCreationSource = 'localVisit';
        } else if (localRewards.length !== 0) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} materialized local rewards outside a generated target`,
          );
        }
        if (
          view === undefined &&
          event.source === 'biomeEntry' &&
          unresolvedIncoming !== undefined &&
          'current' in history
        ) {
          // An unresolved biome-entry reward blocks before the room owns a
          // preparation checkpoint. Its complete valid history prefix is
          // nevertheless the exact generation-time view needed to evaluate
          // candidate reward identities. Acquisition remains unavailable
          // because no entry/pre-outgoing view exists below.
          view = history.current;
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
        if (incoming === undefined && unresolvedIncoming !== undefined) {
          const frontierBranches = branches;
          const address = unresolvedIncoming.origin;
          const ownerKey = semanticAddressKey(address);
          const offerFindingChronology =
            event.source === 'hubTarget'
              ? Object.freeze({
                  kind: 'hubBoard' as const,
                  history: historyFindingChronology(event.sequence),
                })
              : event.source === 'localVisit'
                ? rewardFindingChronologyForRoom(
                    snapshot,
                    room.origin,
                    event.sequence,
                    'sideGeneration',
                  )
                : undefined;
          const candidateFor = (offer: ResolvedRewardOffer): CanonicalResolvedIncomingReward => {
            const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
              kind: 'producerLifecycle',
              key: unresolvedIncoming.producerLifecycleKey,
            });
            return Object.freeze({
              ...unresolvedIncoming,
              kind: 'resolved' as const,
              offer,
              traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
              ...(state.levelResolutionsByAcquisitionRole === undefined
                ? {}
                : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
              dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
              traitContext: Object.freeze({
                ...routeLoadout,
                blockGiftBoons: declaration.blockGiftBoons,
                devotionNoDuo: offer.rewardType === 'Devotion',
              }),
            });
          };
          const acquisitionView =
            views.get(semanticAddressKey(room.origin))?.preOutgoing ??
            views.get(semanticAddressKey(room.origin))?.entry;
          const producerPoints =
            lifecycle.producerPointsByOwner.get(semanticAddressKey(room.origin)) ??
            Object.freeze([]);
          const unresolvedFacts = (branchHistory: RewardHistoryState) =>
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
            );
          if (event.source === 'hubTarget') {
            if (pendingHubBoard === undefined) {
              pendingHubBoard = { frontierBranches, participants: [] };
            }
            pendingHubBoard.participants.push(
              Object.freeze({
                kind: 'unresolved' as const,
                declaration,
                incoming: unresolvedIncoming,
                historySequence: event.sequence,
                facts: unresolvedFacts,
                candidateFor,
              }),
            );
          } else {
            indexRewardProducerFrontier(
              producerFrontiers,
              Object.freeze({
                generationPolicy: 'sequential',
                generationHistorySequence: event.sequence,
                reachableBranchCount: frontierBranches.length,
                acquisitionHorizon:
                  acquisitionView === undefined ? 'generationOnly' : 'ownEnteredLifecycle',
                owners: Object.freeze([address]),
                ...(unresolvedIncoming.resolvedStoreKey === undefined
                  ? {}
                  : { resolvedStoreKey: unresolvedIncoming.resolvedStoreKey }),
                evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
                  if (semanticAddressKey(owner) !== ownerKey)
                    return fail('unresolved reward frontier received a foreign owner');
                  const candidate = candidateFor(offer);
                  const candidateBinding = countedBinding(declaration, candidate);
                  const candidateFindings = new Map<string, FindingRegionEntry>();
                  const candidateBranches = processRewardOffer(
                    frontierBranches,
                    {
                      catalog,
                      reward: candidate,
                      ...(candidateBinding === undefined ? {} : { binding: candidateBinding }),
                      historySequence: event.sequence,
                      ...(offerFindingChronology === undefined
                        ? {}
                        : { findingChronology: offerFindingChronology }),
                      peers,
                      facts: unresolvedFacts,
                    },
                    candidateFindings,
                  );
                  const generated = candidateBranches.length > 0;
                  if (generated && acquisitionView !== undefined) {
                    const candidateContext: IncomingOfferCandidateContext = Object.freeze({
                      context: Object.freeze({
                        catalog,
                        reward: candidate,
                        ...(candidateBinding === undefined ? {} : { binding: candidateBinding }),
                        historySequence: event.sequence,
                        peers,
                        facts: unresolvedFacts,
                      }),
                      room,
                      declaration,
                      incoming: candidate,
                      acquisitionView,
                      producerPoints,
                    });
                    completeIncomingOfferCandidate(
                      candidateContext,
                      offer,
                      candidateBranches,
                      candidateFindings,
                    );
                  }
                  return Object.freeze({
                    findings: Object.freeze(
                      [...candidateFindings.values()]
                        .map((entry) => entry.finding)
                        .filter((finding) => finding.code !== 'traitOfferMissing'),
                    ),
                    supported: generated,
                  });
                },
              }),
            );
            addRewardFinding(
              findings,
              rewardFinding('rewardMissing', address, {}),
              ownerRegion(address),
              offerFindingChronology ?? historyFindingChronology(event.sequence),
            );
            branches = Object.freeze([]);
          }
        }
        if (branches.length === 0) break;
        if (incoming !== undefined) {
          const binding = countedBinding(declaration, incoming);
          const frontierBranches = branches;
          const offerFindingChronology =
            event.source === 'hubTarget'
              ? Object.freeze({
                  kind: 'hubBoard' as const,
                  history: historyFindingChronology(event.sequence),
                })
              : event.source === 'localVisit'
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
            facts: (
              branchHistory: RewardHistoryState,
              _shopNames: ReadonlySet<string> | undefined,
              branch: RewardBranchState | undefined,
            ) =>
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
                undefined,
                branch,
              ),
          };
          const incomingOwnerKey = semanticAddressKey(incoming.origin);
          const producerPoints =
            lifecycle.producerPointsByOwner.get(semanticAddressKey(room.origin)) ??
            Object.freeze([]);
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
              pendingHubBoard = { frontierBranches, participants: [] };
            }
            pendingHubBoard.participants.push(
              Object.freeze({
                kind: 'resolved' as const,
                context: candidateContext.context,
                incoming: candidateContext.incoming,
              }),
            );
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
          if (event.source === 'generatedTarget' || event.source === 'localVisit') {
            peers = Object.freeze([
              ...peers,
              { origin: event.targetOrigin, offer: incoming.offer },
            ]);
          }
        }
        for (const localReward of localRewards) {
          const frontierBranches = branches;
          const offerFindingChronology =
            event.source === 'localVisit'
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
            facts: (
              branchHistory: RewardHistoryState,
              _shopNames: ReadonlySet<string> | undefined,
              branch: RewardBranchState | undefined,
            ) =>
              rewardFacts(
                catalog,
                source,
                currentRoom,
                catalog.rooms.byKey[source.gameName] ?? declaration,
                view,
                branchHistory,
                enteredBiomeCount,
                currentShopNames,
                undefined,
                undefined,
                undefined,
                branch,
              ),
          };
          const localOwnerKey = semanticAddressKey(localReward.origin);
          const acquisitionEvent =
            room.lifecycleProfileKey === 'FieldsCombatRoom'
              ? lifecycle.acquisitionPointsByOwner
                  .get(semanticAddressKey(room.origin))
                  ?.find((candidate) => candidate.point === `cages:${localReward.slotKey}`)
              : lifecycle.encounterCompletionsByOwner
                  .get(semanticAddressKey(room.origin))
                  ?.find((candidate) => candidate.phaseKey === localReward.encounterPhaseKey);
          const candidateRoomView = views.get(semanticAddressKey(room.origin));
          const acquisitionView =
            room.lifecycleProfileKey === 'FieldsCombatRoom'
              ? candidateRoomView?.acquisitionPoints?.find(
                  (point) => point.point === `cages:${localReward.slotKey}`,
                )?.before
              : (candidateRoomView?.preOutgoing ?? candidateRoomView?.entry);
          indexRewardProducerFrontier(
            producerFrontiers,
            Object.freeze({
              generationPolicy: 'sequential',
              generationHistorySequence: event.sequence,
              reachableBranchCount: frontierBranches.length,
              acquisitionHorizon:
                acquisitionEvent === undefined || acquisitionView === undefined
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
                const candidateBranches = processRewardOffer(
                  frontierBranches,
                  {
                    ...offerContext,
                    reward: Object.freeze({ ...localReward, offer }),
                  },
                  candidateFindings,
                );
                if (
                  candidateBranches.length > 0 &&
                  acquisitionEvent !== undefined &&
                  acquisitionView !== undefined
                ) {
                  settleOwnedAcquisitionSite(
                    catalog,
                    candidateBranches,
                    {
                      siteOwner: localReward.origin,
                      pointKey:
                        acquisitionEvent.kind === 'acquisitionPointReached'
                          ? acquisitionEvent.point
                          : localReward.encounterPhaseKey,
                      entryKey: localReward.slotKey,
                      source: Object.freeze({ ...localReward, offer, instanceProvenance: 'free' }),
                      historySequence: acquisitionEvent.sequence,
                      authoredSeaStarDuplicateSiteKeys,
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
                  );
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
        if (unresolvedLocalReward !== undefined && branches.length > 0) {
          const frontierBranches = branches;
          const ownerKey = semanticAddressKey(unresolvedLocalReward.origin);
          const acquisitionEvent =
            room.lifecycleProfileKey === 'FieldsCombatRoom'
              ? lifecycle.acquisitionPointsByOwner
                  .get(semanticAddressKey(room.origin))
                  ?.find(
                    (candidate) => candidate.point === `cages:${unresolvedLocalReward.slotKey}`,
                  )
              : lifecycle.encounterCompletionsByOwner
                  .get(semanticAddressKey(room.origin))
                  ?.find(
                    (candidate) => candidate.phaseKey === unresolvedLocalReward.encounterPhaseKey,
                  );
          const candidateRoomView = views.get(semanticAddressKey(room.origin));
          const acquisitionView =
            room.lifecycleProfileKey === 'FieldsCombatRoom'
              ? candidateRoomView?.acquisitionPoints?.find(
                  (point) => point.point === `cages:${unresolvedLocalReward.slotKey}`,
                )?.before
              : (candidateRoomView?.preOutgoing ?? candidateRoomView?.entry);
          indexRewardProducerFrontier(
            producerFrontiers,
            Object.freeze({
              generationPolicy: 'sequential',
              generationHistorySequence: event.sequence,
              reachableBranchCount: frontierBranches.length,
              acquisitionHorizon:
                acquisitionEvent === undefined || acquisitionView === undefined
                  ? 'generationOnly'
                  : 'ownEnteredLifecycle',
              owners: Object.freeze([unresolvedLocalReward.origin]),
              resolvedStoreKey: unresolvedLocalReward.resolvedStoreKey,
              evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
                if (semanticAddressKey(owner) !== ownerKey)
                  return fail('unresolved local reward frontier received a foreign owner');
                const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
                  kind: 'producerLifecycle',
                  key: unresolvedLocalReward.producerLifecycleKey,
                });
                const candidate = Object.freeze({
                  ...unresolvedLocalReward,
                  offer,
                  traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
                  ...(state.levelResolutionsByAcquisitionRole === undefined
                    ? {}
                    : {
                        levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole,
                      }),
                  dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
                  traitContext: Object.freeze({
                    ...routeLoadout,
                    blockGiftBoons: declaration.blockGiftBoons,
                    devotionNoDuo: offer.rewardType === 'Devotion',
                  }),
                });
                const candidateFindings = new Map<string, FindingRegionEntry>();
                const candidateBranches = processRewardOffer(
                  frontierBranches,
                  {
                    catalog,
                    reward: candidate,
                    binding: localRewardBinding(declaration, candidate),
                    historySequence: event.sequence,
                    peers,
                    facts: (branchHistory: RewardHistoryState, _shopNames, branch) =>
                      rewardFacts(
                        catalog,
                        source,
                        currentRoom,
                        catalog.rooms.byKey[source.gameName] ?? declaration,
                        view,
                        branchHistory,
                        enteredBiomeCount,
                        currentShopNames,
                        undefined,
                        undefined,
                        undefined,
                        branch,
                      ),
                  },
                  candidateFindings,
                );
                const generated = candidateBranches.length > 0;
                if (generated && acquisitionEvent !== undefined && acquisitionView !== undefined) {
                  settleOwnedAcquisitionSite(
                    catalog,
                    candidateBranches,
                    {
                      siteOwner: candidate.origin,
                      pointKey:
                        acquisitionEvent.kind === 'acquisitionPointReached'
                          ? acquisitionEvent.point
                          : candidate.encounterPhaseKey,
                      entryKey: candidate.slotKey,
                      source: Object.freeze({ ...candidate, instanceProvenance: 'free' }),
                      historySequence: acquisitionEvent.sequence,
                      authoredSeaStarDuplicateSiteKeys,
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
                    ownerRegion(candidate.origin),
                  );
                }
                return Object.freeze({
                  findings: Object.freeze(
                    [...candidateFindings.values()]
                      .map((entry) => entry.finding)
                      .filter((finding) => finding.code !== 'traitOfferMissing'),
                  ),
                  supported: generated,
                });
              },
            }),
          );
          addRewardFinding(
            findings,
            rewardFinding('rewardMissing', unresolvedLocalReward.origin, {}),
            ownerRegion(unresolvedLocalReward.origin),
            historyFindingChronology(event.sequence),
          );
          branches = Object.freeze([]);
        }
        break;
      }
      case 'targetGenerationCompleted': {
        if (
          event.origin.kind === 'hubSlot' &&
          pendingHubBoard?.participants.length === hubTargetByOrigin.size
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
        if (
          source.kind === 'authored' &&
          (Object.keys(source.acquisitionSites).length > 0 || source.entryState?.kind === 'shop')
        ) {
          if (source.entryState?.kind === 'shop')
            branches = settleAuthoredAcquisitionSite(
              source,
              declaration,
              sourceViews,
              branches,
              event.sequence,
              findings,
              undefined,
              false,
              true,
            );
          else
            for (const siteKey of Object.keys(source.acquisitionSites))
              branches = settleAuthoredAcquisitionSite(
                source,
                declaration,
                sourceViews,
                branches,
                event.sequence,
                findings,
                { siteKey, entryKey: '' },
                true,
                true,
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
            emptyOutgoingOrigins.has(semanticAddressKey(event.origin)) ||
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
            const support = assessAuthoredBatchRewardStore(
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
          const shopEntry = room.entryState?.kind === 'shop' ? room.entryState : undefined;
          const owners = Object.freeze([
            ...(shopEntry?.offers.map((offer) => offer.offerOrigin) ?? []),
            ...(shopEntry?.unresolvedOffers.map((offer) => offer.offerOrigin) ?? []),
          ]);
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
              branch?: RewardBranchState,
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
                branch,
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
                  if (shopEntry === undefined) {
                    return fail(`${room.gameName} lost its shop candidate state`);
                  }
                  const ownerKey = semanticAddressKey(owner);
                  if (!ownerKeys.has(ownerKey)) {
                    return fail('shop reward frontier received a foreign owner');
                  }
                  const profile = catalog.rewards.shops.byKey[shopEntry.profileKey];
                  if (profile === undefined)
                    return fail(`unknown shop profile ${shopEntry.profileKey}`);
                  const concreteByKey = new Map(
                    shopEntry.offers.map((entry) => [entry.offerKey, entry.offer] as const),
                  );
                  const focused = [...shopEntry.offers, ...shopEntry.unresolvedOffers].find(
                    (entry) => semanticAddressKey(entry.offerOrigin) === ownerKey,
                  );
                  if (focused === undefined) return fail('shop reward frontier lost its owner');
                  const fixedOffers = profile.slots.values.map((slot) =>
                    slot.key === focused.offerKey ? offer : (concreteByKey.get(slot.key) ?? null),
                  );
                  const requirements =
                    declaration.incomingReward.kind === 'shop'
                      ? declaration.incomingReward.additionalOptionRequirements
                      : undefined;
                  const supported = frontierBranches.some(
                    (branch) =>
                      findShopPartialGenerationWitnesses(
                        catalog.rewards,
                        profile,
                        fixedOffers,
                        shopContext.facts(branch.history, new Set(), branch),
                        requirements,
                      ).length > 0,
                  );
                  return Object.freeze({ findings: Object.freeze([]), supported });
                },
              }),
            );
          }
          if ((shopEntry?.unresolvedOffers.length ?? 0) > 0) {
            for (const unresolved of shopEntry!.unresolvedOffers) {
              addRewardFinding(
                findings,
                rewardFinding('rewardMissing', unresolved.offerOrigin, {}),
                ownerRegion(room.origin),
                shopContext.findingChronology,
              );
            }
            branches = Object.freeze([]);
          } else {
            branches = processShopInventory(branches, shopContext, findings);
          }
          break;
        }
        if (event.offerPoint === 'fieldsOptionalRewards') {
          const optionalRewards = room.fieldsOptionalRewards ?? [];
          const unresolvedOptionals = room.unresolvedFieldsOptionalRewards ?? [];
          const view = roomView.offerPoints?.find(
            (candidate) => candidate.offerPoint === event.offerPoint,
          )?.before;
          if (view === undefined || room.lifecycleProfileKey !== 'FieldsCombatRoom') {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} has no Fields optional materialization`,
            );
          }
          const frontierBranches = branches;
          const descriptor = declaration.fieldsOptionalRewards;
          if (descriptor === undefined)
            return fail(`${room.gameName} has no Fields optional descriptor`);
          const concreteBySlot = new Map(optionalRewards.map((reward) => [reward.slotKey, reward]));
          const unresolvedBySlot = new Map(
            unresolvedOptionals.map((reward) => [reward.slotKey, reward]),
          );
          const orderedSlots = descriptor.slotKeys.filter(
            (slotKey) => concreteBySlot.has(slotKey) || unresolvedBySlot.has(slotKey),
          );
          const candidateState = (
            base: (typeof unresolvedOptionals)[number],
            offer: ResolvedRewardOffer,
          ): CanonicalFieldsOptionalReward => {
            const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
              kind: 'producerLifecycle',
              key: base.producerLifecycleKey,
            });
            return Object.freeze({
              ...base,
              offer,
              traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
              ...(state.levelResolutionsByAcquisitionRole === undefined
                ? {}
                : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
              dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
              traitContext: Object.freeze({
                ...routeLoadout,
                blockGiftBoons: declaration.blockGiftBoons,
                devotionNoDuo: offer.rewardType === 'Devotion',
              }),
            });
          };
          const contextFor = (reward: CanonicalFieldsOptionalReward) => ({
            catalog,
            reward,
            binding: localRewardBinding(declaration, reward),
            historySequence: event.sequence,
            peers: Object.freeze([]),
            facts: (
              branchHistory: RewardHistoryState,
              _shopNames: ReadonlySet<string> | undefined,
              branch: RewardBranchState | undefined,
            ) =>
              rewardFacts(
                catalog,
                room,
                room,
                declaration,
                view,
                branchHistory,
                enteredBiomeCount,
                undefined,
                undefined,
                undefined,
                undefined,
                branch,
              ),
          });
          const evaluateOptionalCohort = (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
            const ownerKey = semanticAddressKey(owner);
            const selectedReward = [...optionalRewards, ...unresolvedOptionals].find(
              (reward) => semanticAddressKey(reward.origin) === ownerKey,
            );
            if (selectedReward === undefined) {
              return fail('Fields optional frontier received a foreign owner');
            }
            const store = catalog.rewards.stores.byKey.FieldsOptionalRewards;
            if (store === undefined) return fail('Fields optional store is missing');
            const domain = Object.freeze(
              store.entries.flatMap((entry) =>
                locallyValidRewardOffers(catalog.rewards, entry.rewardType),
              ),
            );
            let representativeFailedFindings: Map<string, FindingRegionEntry> | undefined;
            const visit = (
              index: number,
              current: readonly RewardBranchState[],
              currentFindings: Map<string, FindingRegionEntry>,
            ):
              | {
                  readonly branches: readonly RewardBranchState[];
                  readonly findings: Map<string, FindingRegionEntry>;
                }
              | undefined => {
              if (index === orderedSlots.length)
                return Object.freeze({ branches: current, findings: currentFindings });
              const slotKey = orderedSlots[index]!;
              const concrete = concreteBySlot.get(slotKey);
              const unresolved = unresolvedBySlot.get(slotKey);
              const offers =
                slotKey === selectedReward.slotKey
                  ? Object.freeze([offer])
                  : concrete === undefined
                    ? domain
                    : Object.freeze([concrete.offer]);
              for (const candidateOffer of offers) {
                const trialFindings = new Map(currentFindings);
                const reward =
                  concrete !== undefined && candidateOffer === concrete.offer
                    ? concrete
                    : unresolved === undefined
                      ? Object.freeze({ ...concrete!, offer: candidateOffer })
                      : candidateState(unresolved, candidateOffer);
                const next = processRewardOffer(current, contextFor(reward), trialFindings);
                if (next.length === 0) {
                  representativeFailedFindings ??= trialFindings;
                  continue;
                }
                const completed = visit(index + 1, next, trialFindings);
                if (completed !== undefined) return completed;
              }
              return undefined;
            };
            const completion = visit(0, frontierBranches, new Map());
            const candidateBranches = completion?.branches ?? Object.freeze([]);
            const candidateFindings =
              completion?.findings ?? representativeFailedFindings ?? new Map();
            const generated = candidateBranches.length > 0;
            const pointKey = `optionalRewards:${selectedReward.slotKey}`;
            const acquisitionEvent = lifecycle.acquisitionPointsByOwner
              .get(semanticAddressKey(room.origin))
              ?.find((candidate) => candidate.point === pointKey);
            const acquisitionView = roomView.acquisitionPoints?.find(
              (point) => point.point === pointKey,
            )?.before;
            if (
              candidateBranches.length > 0 &&
              acquisitionEvent !== undefined &&
              acquisitionView !== undefined
            ) {
              settleOwnedAcquisitionSite(
                catalog,
                candidateBranches,
                {
                  siteOwner: selectedReward.origin,
                  pointKey,
                  entryKey: selectedReward.slotKey,
                  source: Object.freeze({
                    ...(concreteBySlot.get(selectedReward.slotKey) ??
                      candidateState(unresolvedBySlot.get(selectedReward.slotKey)!, offer)),
                    offer,
                    instanceProvenance: 'free',
                  }),
                  historySequence: acquisitionEvent.sequence,
                  authoredSeaStarDuplicateSiteKeys,
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
                ownerRegion(selectedReward.origin),
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  acquisitionEvent.sequence,
                  'localRoomLifecycle',
                ),
              );
            }
            return Object.freeze({
              findings: Object.freeze(
                [...candidateFindings.values()]
                  .map((entry) => entry.finding)
                  .filter((finding) => finding.code !== 'traitOfferMissing'),
              ),
              supported: generated,
            });
          };
          for (const reward of [...optionalRewards, ...unresolvedOptionals]) {
            const pointKey = `optionalRewards:${reward.slotKey}`;
            const acquisitionEvent = lifecycle.acquisitionPointsByOwner
              .get(semanticAddressKey(room.origin))
              ?.find((candidate) => candidate.point === pointKey);
            indexRewardProducerFrontier(
              producerFrontiers,
              Object.freeze({
                generationPolicy: 'sequential',
                generationHistorySequence: event.sequence,
                reachableBranchCount: frontierBranches.length,
                acquisitionHorizon:
                  acquisitionEvent === undefined
                    ? ('generationOnly' as const)
                    : ('ownEnteredLifecycle' as const),
                owners: Object.freeze([reward.origin]),
                resolvedStoreKey: reward.resolvedStoreKey,
                evaluateOffer: evaluateOptionalCohort,
              }),
            );
          }
          let reachedMissing = false;
          for (const slotKey of orderedSlots) {
            const concrete = concreteBySlot.get(slotKey);
            if (concrete === undefined) {
              reachedMissing = true;
              continue;
            }
            if (!reachedMissing)
              branches = processRewardOffer(branches, contextFor(concrete), findings);
          }
          if (unresolvedOptionals.length > 0) {
            for (const unresolved of unresolvedOptionals) {
              addRewardFinding(
                findings,
                rewardFinding('rewardMissing', unresolved.origin, {}),
                ownerRegion(room.origin),
                historyFindingChronology(event.sequence),
              );
            }
            branches = Object.freeze([]);
          }
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
              prepared.lifecycle,
              branches,
              enteredBiomeCount,
              Object.freeze({
                ...routeLoadout,
                ...(declaration.boonRarityOverride === undefined
                  ? {}
                  : { boonRarityRoomOverride: declaration.boonRarityOverride }),
              }),
            ),
          );
        }
        const wheelStateFor = (
          base: (typeof wheel.unresolvedOffers)[number],
          offer: ResolvedRewardOffer,
        ): CanonicalRewardWheel['offers'][number] => {
          const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
            kind: 'producerLifecycle',
            key: wheel.producerLifecycleKey,
          });
          return Object.freeze({
            ...base,
            offer,
            traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
            ...(state.levelResolutionsByAcquisitionRole === undefined
              ? {}
              : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
            dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
            traitContext: Object.freeze({
              ...routeLoadout,
              blockGiftBoons: declaration.blockGiftBoons,
              devotionNoDuo: offer.rewardType === 'Devotion',
            }),
          });
        };
        const contextForWheel = (offer: CanonicalRewardWheel['offers'][number]) => ({
          catalog,
          reward: {
            ...offer,
            producerLifecycleKey: wheel.producerLifecycleKey,
            resolvedStoreKey: wheel.storeKey,
          },
          binding,
          historySequence: event.sequence,
          peers: Object.freeze([]),
          facts: (
            branchHistory: RewardHistoryState,
            _shopNames: ReadonlySet<string> | undefined,
            branch: RewardBranchState | undefined,
          ) =>
            rewardFacts(
              catalog,
              room,
              room,
              declaration,
              view,
              branchHistory,
              enteredBiomeCount,
              undefined,
              undefined,
              undefined,
              undefined,
              branch,
            ),
        });
        const contexts = wheel.offers.map(contextForWheel);
        const frontierBranches = branches;
        const owners = Object.freeze(
          [...wheel.offers, ...wheel.unresolvedOffers].map((offer) => offer.origin),
        );
        const ownerKeys = new Set(owners.map(semanticAddressKey));
        const acquisitionView = roomView.offerPoints?.find(
          (candidate) => candidate.offerPoint === event.offerPoint,
        )?.acquisitionBefore;
        const acquisitionEvent = lifecycle.wheelsByOwner
          .get(semanticAddressKey(room.origin))
          ?.find((candidate) => candidate.offerPoint === wheel.wheelKey);
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
              const focused = [...wheel.offers, ...wheel.unresolvedOffers].find(
                (candidate) => semanticAddressKey(candidate.origin) === ownerKey,
              );
              if (focused === undefined) return fail('reward-wheel frontier lost its owner');
              const concreteByKey = new Map(
                wheel.offers.map((candidate) => [candidate.offerKey, candidate]),
              );
              const unresolvedByKey = new Map(
                wheel.unresolvedOffers.map((candidate) => [candidate.offerKey, candidate]),
              );
              const offerKeys = Object.freeze(
                [...wheel.offers, ...wheel.unresolvedOffers]
                  .sort((left, right) => left.offerKey.localeCompare(right.offerKey))
                  .map((candidate) => candidate.offerKey),
              );
              const store = catalog.rewards.stores.byKey[wheel.storeKey];
              if (store === undefined) return fail(`unknown wheel store ${wheel.storeKey}`);
              const domain = Object.freeze(
                store.entries.flatMap((entry) =>
                  locallyValidRewardOffers(catalog.rewards, entry.rewardType),
                ),
              );
              const proposals: CanonicalRewardWheel['offers'][number][][] = [];
              const build = (
                index: number,
                values: CanonicalRewardWheel['offers'][number][],
              ): void => {
                if (proposals.length > 0) return;
                if (index === offerKeys.length) {
                  proposals.push(values);
                  return;
                }
                const key = offerKeys[index]!;
                const concrete = concreteByKey.get(key);
                const unresolved = unresolvedByKey.get(key);
                const offers =
                  key === focused.offerKey
                    ? Object.freeze([offer])
                    : concrete === undefined
                      ? domain
                      : Object.freeze([concrete.offer]);
                for (const candidateOffer of offers) {
                  const candidate =
                    concrete !== undefined && candidateOffer === concrete.offer
                      ? concrete
                      : unresolved === undefined
                        ? Object.freeze({ ...concrete!, offer: candidateOffer })
                        : wheelStateFor(unresolved, candidateOffer);
                  const trialFindings = new Map<string, FindingRegionEntry>();
                  const trial = processOfferGenerationCohort(
                    frontierBranches,
                    [...values, candidate].map(contextForWheel),
                    trialFindings,
                    { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
                  );
                  if (trial.length === 0) continue;
                  build(index + 1, [...values, candidate]);
                  if (proposals.length > 0) return;
                }
              };
              build(0, []);
              const candidateBranches = processOfferGenerationCohort(
                frontierBranches,
                (proposals[0] ?? []).map(contextForWheel),
                candidateFindings,
                { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
              );
              const selectedOffer = (proposals[0] ?? []).find(
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
                settleOwnedAcquisitionSite(
                  catalog,
                  candidateBranches,
                  {
                    siteOwner: wheel.origin,
                    pointKey: wheel.wheelKey,
                    entryKey: 'picked',
                    source,
                    historySequence: acquisitionEvent.sequence,
                    authoredSeaStarDuplicateSiteKeys,
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
                );
              }
              return Object.freeze({
                findings: Object.freeze(
                  [...candidateFindings.values()]
                    .map((entry) => entry.finding)
                    .filter((finding) => finding.code !== 'traitOfferMissing'),
                ),
                supported: proposals.length > 0,
              });
            },
          }),
        );
        if (wheel.unresolvedOffers.length > 0) {
          for (const unresolved of wheel.unresolvedOffers) {
            addRewardFinding(
              findings,
              rewardFinding('rewardMissing', unresolved.origin, {}),
              ownerRegion(wheel.origin),
              historyFindingChronology(event.sequence),
            );
          }
          branches = Object.freeze([]);
        } else {
          branches = processOfferGenerationCohort(branches, contexts, findings, {
            ordering: 'allOffers',
            atomicRegion: ownerRegion(wheel.origin),
          });
        }
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
            source: withStoredArtificerReplacements(
              room,
              Object.freeze({
                ...picked,
                producerLifecycleKey: wheel.producerLifecycleKey,
                instanceProvenance: 'free',
              }),
            ),
            historySequence: event.sequence,
            deferArtificerReplacement: true,
            authoredSeaStarDuplicateSiteKeys,
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
          preparedAcquisitionSiteOwner(snapshot, room),
          authoredSeaStarDuplicateSiteKeys,
        );
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
        branches = settlement.branches;
        break;
      }
      case 'bossDefeated':
      case 'encounterInteractionReached':
      case 'encounterCompleted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
        if (event.kind === 'bossDefeated') {
          branches = Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                ...branch,
                stygianWell: advanceStygianWellBossUses(branch.stygianWell),
              }),
            ),
          );
        }
        if (
          event.kind === 'encounterInteractionReached' &&
          event.interaction === 'gorgon' &&
          room !== undefined &&
          declaration !== undefined &&
          room.kind === 'authored' &&
          eligibleGorgonPhases.has(`${semanticAddressKey(event.origin)}::${event.phaseKey}`)
        ) {
          const result = room.encounters.gorgonResultByPhase?.[event.phaseKey];
          const phase = room.encounterPhases.find(
            (candidate) => candidate.slotKey === event.phaseKey,
          );
          const encounterPhaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
            { kind: 'occurrence', occurrenceId: room.occurrenceId },
            event.phaseKey,
          );
          const gorgonPhaseAddress = createGorgonPhaseAddress(encounterPhaseAddress);
          const gorgonAddress = createTraitOfferAddress(gorgonPhaseAddress, 'gorgonAthena');
          const gorgonKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
          const gorgonSnapshot = gorgonPhaseCandidates.get(
            semanticAddressKey(encounterPhaseAddress),
          );
          const gorgonOffer =
            result?.athenaOffer == null || gorgonSnapshot?.rarity === undefined
              ? undefined
              : materializeGorgonAthenaOffer(catalog, result.athenaOffer, gorgonSnapshot.rarity);
          if (
            phase?.blocksGorgon !== true &&
            declaration.blocksGorgon !== true &&
            result?.athenaTriggerConditionMet === true &&
            result.athenaOffer === null &&
            !blockedGorgonPhases.has(gorgonKey)
          ) {
            const gorgonEffect = catalog.keepsakes.values.find(
              (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
            )?.effect;
            const settlements = branches.map((branch) =>
              settleEncounterTraitOffer(
                catalog,
                branch,
                gorgonAddress.owner,
                null,
                event.sequence,
                'encounterCompleted',
                findings,
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                'gorgonAthena',
                gorgonSnapshot?.rarity,
                Object.freeze({
                  ...routeLoadout,
                  ...(declaration.boonRarityOverride === undefined
                    ? {}
                    : { boonRarityRoomOverride: declaration.boonRarityOverride }),
                }),
                undefined,
                gorgonEffect?.kind === 'gorgonAmulet' ? gorgonEffect.providerKey : undefined,
              ),
            );
            for (const settlement of settlements) {
              if (settlement.blockedChild === undefined) continue;
              recordTraitChildSettlements([settlement.blockedChild], room.origin);
            }
            blockedGorgonPhases.add(gorgonKey);
            gorgonEvaluationBlocked = true;
          } else if (
            phase?.blocksGorgon !== true &&
            declaration.blocksGorgon !== true &&
            result?.athenaTriggerConditionMet === true &&
            result.athenaOffer != null &&
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
            result?.athenaTriggerConditionMet === true &&
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
          } else if (result?.athenaTriggerConditionMet === true && result.athenaOffer != null) {
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
        if (
          event.kind === 'bossDefeated' &&
          room?.kind === 'authored' &&
          (() => {
            const declaration = catalog.rooms.byKey[room.gameName];
            return declaration?.mode.kind === 'automatic' && declaration.mode.role === 'boss';
          })() &&
          enteredBiomeCount < fullRunBiomeCount
        ) {
          const owner = createJudgmentArcanaAddress(
            event.origin as import('../../authored-project/addresses').OccurrenceAddress,
            event.phaseKey,
          );
          // Barren suppresses Judgment at this exact seam.  The later
          // encounter completion may mature Barren, but cannot retroactively
          // re-enable this boss-defeated effect.
          const judgmentBranches = branches.filter(
            (branch) =>
              !hasActiveChaosSemanticTag(
                branch.traitHistory ?? createTraitHistoryState(),
                'Barren',
              ),
          );
          const activeArcana = attestJudgmentArcanaFrontier(judgmentBranches);
          const firstArcanaFear = judgmentBranches[0]?.arcanaFear;
          const requiredCount =
            activeArcana === undefined || firstArcanaFear === undefined
              ? undefined
              : judgmentRequiredCount(catalog, firstArcanaFear);
          if (requiredCount !== undefined && firstArcanaFear !== undefined) {
            judgmentArcanaContexts.set(
              semanticAddressKey(owner),
              Object.freeze({
                inactiveArcanaKeys: inactiveArcanaKeys(catalog, firstArcanaFear).filter(
                  (key) =>
                    judgmentBranches[0]?.keepsakes.fatedStatus !== 'Fated' ||
                    catalog.arcanaCards.byKey[key]?.fatedIncompatible !== true,
                ),
                requiredCount,
              }),
            );
          }
          branches = Object.freeze(
            branches.flatMap((branch) => {
              if (
                hasActiveChaosSemanticTag(
                  branch.traitHistory ?? createTraitHistoryState(),
                  'Barren',
                )
              )
                return [advanceRewardBranches([branch], event.sequence)[0]!];
              const required = judgmentRequiredCount(catalog, branch.arcanaFear);
              if (required === undefined)
                return [advanceRewardBranches([branch], event.sequence)[0]!];
              const selected = room.encounters.judgmentArcanaKeysByPhase?.[event.phaseKey] ?? [];
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
        if (room.kind !== 'authored') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (event.kind === 'encounterCompleted') {
          const matchingRewards =
            room.localRewards?.filter((reward) => reward.encounterPhaseKey === event.phaseKey) ??
            [];
          if (room.lifecycleProfileKey === 'FieldsCombatRoom' || matchingRewards.length === 0) {
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
              source: withStoredArtificerReplacements(
                room,
                Object.freeze({ ...matchingRewards[0], instanceProvenance: 'free' }),
              ),
              historySequence: event.sequence,
              authoredSeaStarDuplicateSiteKeys,
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
        if (event.kind === 'encounterInteractionReached' && event.interaction === 'gorgon') {
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
        // Nemesis uses the existing encounter interaction as its only source
        // action.  Its accepted trait trade is intentionally a plain
        // current-trait removal: the generated Triple Gold entry remains a
        // later, ordinary acquisition action and therefore observes the
        // post-removal trait frontier just like every other pickup.
        if (
          event.kind === 'encounterInteractionReached' &&
          event.interaction === 'encounter' &&
          selectedEncounterKey === 'NemesisRandomEvent'
        ) {
          const outcome = room.encounters.nemesisRandomEventByPhase?.[event.phaseKey];
          const eventOwner = createNemesisRandomEventAddress(
            createEncounterPhaseAddress(
              createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
              { kind: 'occurrence' as const, occurrenceId: room.occurrenceId },
              event.phaseKey,
            ),
          );
          const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
          if (policy !== undefined) {
            const traitDomain = (branch: RewardBranchState) => {
              const traits = branch.traitHistory ?? createTraitHistoryState();
              const eligible = Object.values(traits.equippedTraits).filter((equipped) => {
                const declaration = catalog.traits.byKey[equipped.traitKey];
                return (
                  declaration !== undefined &&
                  equipped.providerKind === 'olympian' &&
                  equipped.rarity !== undefined
                );
              });
              const common = eligible.filter((equipped) => equipped.rarity === 'Common');
              return (common.length === 0 ? eligible : common).map((equipped) => equipped.traitKey);
            };
            const branchAssessments = branches.map((branch) => {
              const facts = rewardFacts(
                catalog,
                room,
                room,
                declaration,
                roomView.preOutgoing ?? roomView.entry,
                branch.history,
                enteredBiomeCount,
              );
              const runProgressLegal = (rewardType: string) => {
                const canonicalRewardType =
                  rewardType === 'StackUpgradeBig' ? 'StackUpgrade' : rewardType;
                const entries = catalog.rewards.stores.byKey.RunProgress?.entries.filter(
                  (entry) => entry.rewardType === canonicalRewardType,
                );
                // Plain consumable results are declaration-owned and have no
                // RunProgress gate. For the three gated event categories,
                // reuse the normalized store requirements rather than mirror
                // Hammer, Pom, or Path policy here.
                return (
                  entries === undefined ||
                  entries.length === 0 ||
                  entries.some(
                    (entry) =>
                      entry.requirement === undefined ||
                      evaluateRequirement(entry.requirement, facts.requirements),
                  )
                );
              };
              // NPCData names TalentLegal (rather than routeTalentLegal).
              // The non-Shop event has no current-shop exclusion, leaving the
              // source predicate's Spell Drop and all-invested facts.
              const talentLegal =
                (facts.requirements.records.useRecord.SpellDrop ?? 0) >= 1 &&
                facts.requirements.flags.allSpellInvested !== true;
              const applicable = (variant: {
                readonly rewardType: string;
                readonly enteredBiome: { readonly min?: number; readonly max?: number };
                readonly requirement: string;
              }) =>
                (variant.enteredBiome.min === undefined ||
                  enteredBiomeCount >= variant.enteredBiome.min) &&
                (variant.enteredBiome.max === undefined ||
                  enteredBiomeCount <= variant.enteredBiome.max) &&
                (variant.requirement === 'none' ||
                  (variant.requirement === 'pomLegal' && runProgressLegal('StackUpgrade')) ||
                  (variant.requirement === 'hammerEarlyOrLate' &&
                    runProgressLegal('WeaponUpgrade')) ||
                  (variant.requirement === 'talentLegal' && talentLegal));
              return Object.freeze({
                freeItemRewardTypes: Object.freeze([...policy.freeItem.resultRewardTypes]),
                goldTradeRewardTypes: Object.freeze(
                  policy.goldTrade.variants.filter(applicable).map((variant) => variant.rewardType),
                ),
                damageTradeRewardTypes: Object.freeze(
                  policy.damageTrade.variants
                    .filter(applicable)
                    .map((variant) => variant.rewardType),
                ),
                damageContestSuccessRewardTypes: Object.freeze(
                  policy.damageContest.successResultRewardTypes.filter((rewardType) =>
                    rewardType === 'StackUpgrade'
                      ? runProgressLegal('StackUpgrade')
                      : rewardType === 'TalentDrop'
                        ? talentLegal
                        : true,
                  ),
                ),
                traitTradeTraitKeys: Object.freeze(traitDomain(branch)),
              });
            });
            nemesisRandomEventCandidates.set(
              semanticAddressKey(eventOwner),
              Object.freeze({
                origin: eventOwner,
                familyKeys: Object.freeze([
                  'freeItem',
                  'goldTrade',
                  'damageTrade',
                  'traitTrade',
                  'damageContest',
                ] as const),
                goldTradeResponses: policy.goldTrade.response,
                damageTradeResponses: policy.damageTrade.response,
                traitTradeResponses: policy.traitTrade.response,
                damageContestResults: Object.freeze(['success', 'failure'] as const),
                traitTradeRewardType: policy.traitTrade.fixedResultRewardType,
                damageContestFailureRewardType: policy.damageContest.failureResultRewardType,
                branches: Object.freeze(branchAssessments),
              }),
            );
          }
          if (outcome === null || outcome === undefined) {
            addRewardFinding(
              findings,
              rewardFinding('nemesisOutcomeMissing', eventOwner, {}),
              ownerRegion(eventOwner),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
          } else {
            const assessments = nemesisRandomEventCandidates.get(
              semanticAddressKey(eventOwner),
            )?.branches;
            const outcomeLegal =
              assessments !== undefined &&
              assessments.every((assessment) => {
                const result =
                  room.acquisitionSites?.[`nemesisGenerated:${encodeURIComponent(event.phaseKey)}`]
                    ?.entries.result;
                const rewardType = result?.offer.rewardType;
                if (rewardType === undefined) return false;
                switch (outcome.kind) {
                  case 'freeItem':
                    return assessment.freeItemRewardTypes.includes(rewardType);
                  case 'goldTrade':
                    return assessment.goldTradeRewardTypes.includes(rewardType);
                  case 'damageTrade':
                    return assessment.damageTradeRewardTypes.includes(rewardType);
                  case 'damageContest':
                    return outcome.result === 'success'
                      ? assessment.damageContestSuccessRewardTypes.includes(rewardType)
                      : policy?.damageContest.failureResultRewardType === rewardType;
                  case 'traitTrade':
                    return (
                      rewardType === policy?.traitTrade.fixedResultRewardType &&
                      assessment.traitTradeTraitKeys.includes(outcome.traitKey)
                    );
                }
              });
            if (!outcomeLegal) {
              addRewardFinding(
                findings,
                rewardFinding('nemesisOutcomeUnavailable', eventOwner, { kind: outcome.kind }),
                ownerRegion(eventOwner),
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
              );
            } else if (outcome.kind === 'traitTrade' && outcome.response === 'accept') {
              branches = Object.freeze(
                branches.map((branch) => {
                  const before = branch.traitHistory ?? createTraitHistoryState();
                  const traitHistory = foldTraitHistoryEvents(catalog, [
                    ...before.events,
                    Object.freeze({
                      kind: 'traitRemoval' as const,
                      owner: createEncounterPhaseAddress(
                        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                        { kind: 'occurrence' as const, occurrenceId: room.occurrenceId },
                        event.phaseKey,
                      ),
                      acquisitionRole: 'nemesisTraitTrade',
                      sequence: event.sequence,
                      acquisitionPoint: 'encounterInteraction',
                      traitKey: outcome.traitKey,
                      match: 'currentTraitKey' as const,
                    }),
                  ]);
                  return Object.freeze({
                    ...branch,
                    history: attachTraitHistory(branch.history, traitHistory),
                    traitHistory,
                  });
                }),
              );
            }
            if (outcome.kind === 'freeItem') {
              const result =
                room.acquisitionSites?.[`nemesisGenerated:${encodeURIComponent(event.phaseKey)}`]
                  ?.entries.result;
              const edge = policy?.freeItem.runtimeOfferFallbacks.find(
                (candidate) => candidate.preferredRewardType === result?.offer.rewardType,
              );
              if (
                edge !== undefined &&
                assessments?.every((assessment) =>
                  assessment.freeItemRewardTypes.includes(edge.fallbackRewardType),
                )
              ) {
                runtimeOfferFallbacks.set(
                  semanticAddressKey(eventOwner),
                  Object.freeze({
                    address: eventOwner,
                    preferredKey: edge.preferredRewardType,
                    fallbackKey: edge.fallbackRewardType,
                  }),
                );
              }
            }
          }
        }
        const authoredEncounterOffer =
          selectedEncounterKey === undefined
            ? undefined
            : room.encounters.traitOffersByPhase?.[event.phaseKey]?.[selectedEncounterKey];
        if (authoredEncounterOffer === null && selectedEncounterKey !== undefined) {
          const producer =
            catalog.encounterDefinitions.byKey[selectedEncounterKey]?.traitOfferProducer;
          const phaseOwner = {
            kind: 'occurrence' as const,
            occurrenceId: room.occurrenceId,
          };
          const phaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            phaseOwner,
            event.phaseKey,
          );
          const settlements = branches.map((branch) =>
            settleEncounterTraitOffer(
              catalog,
              branch,
              phaseAddress,
              null,
              event.sequence,
              'encounterCompleted',
              findings,
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
              'selection',
              undefined,
              Object.freeze({
                ...routeLoadout,
                ...(declaration.boonRarityOverride === undefined
                  ? {}
                  : { boonRarityRoomOverride: declaration.boonRarityOverride }),
              }),
              undefined,
              producer?.giverKey,
            ),
          );
          for (const settlement of settlements) {
            if (settlement.blockedChild === undefined) continue;
            recordTraitChildSettlements([settlement.blockedChild], room.origin);
          }
          break;
        }
        if (authoredEncounterOffer != null && selectedEncounterKey !== undefined) {
          const phaseOwner = {
            kind: 'occurrence' as const,
            occurrenceId: room.occurrenceId,
          };
          const phaseAddress = createEncounterPhaseAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            phaseOwner,
            event.phaseKey,
          );
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
              'selection',
              undefined,
              Object.freeze({
                ...routeLoadout,
                ...(declaration.boonRarityOverride === undefined
                  ? {}
                  : { boonRarityRoomOverride: declaration.boonRarityOverride }),
              }),
              branches.map((candidate) => candidate.traitHistory ?? createTraitHistoryState()),
            ),
          );
          for (const settlement of settlements) {
            const checkpoint = settlement.blockedChild;
            if (checkpoint === undefined) continue;
            recordTraitChildSettlements([checkpoint], room.origin);
          }
          branches = Object.freeze(settlements.map((settlement) => settlement.branch));
        }
        break;
      }
      case 'encounterEndEffectsApplied': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyEncounterEndEffectsTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          enteredBiomeCount,
          fullRunBiomeCount,
          branches,
        );
        branches = transition.branches;
        recordDerivedAcquisitionEntryFrontiers(transition.derivedAcquisitionEntryFrontiers);
        for (const { address, threshold } of transition.steadyGrowthThresholds) {
          const key = semanticAddressKey(address);
          steadyGrowthOutcomeAddresses.set(key, address);
          const current = steadyGrowthCandidateContexts.get(key) ?? [];
          current.push(threshold);
          steadyGrowthCandidateContexts.set(key, current);
        }
        recordTraitChildSettlements(transition.traitChildSettlements, event.origin);
        for (const finding of transition.findings)
          addRewardFinding(findings, finding.finding, finding.region, finding.chronology);
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
        if (event.point.startsWith('hermesShrinePurchase:')) {
          const generationKey = event.point.slice(
            'hermesShrinePurchase:'.length,
          ) as import('../../authored-project/model').HermesShrineGenerationKey;
          const slotKey = generationKey.startsWith('initial:')
            ? (generationKey.slice(
                'initial:'.length,
              ) as import('../../authored-project/model').HermesShrineSlotKey)
            : undefined;
          const purchase =
            generationKey === 'travelDealRefill'
              ? room.hermesShrine?.travelDealRefill?.purchase
              : room.hermesShrine?.purchaseBySlot?.[slotKey!];
          const offer =
            generationKey === 'travelDealRefill'
              ? room.hermesShrine?.travelDealRefill?.offer
              : room.hermesShrine?.offerBySlot[slotKey!];
          if (purchase === undefined || offer === undefined || offer === null) {
            addRewardFinding(
              findings,
              rewardFinding('rewardSourceUnavailable', room.origin, { generationKey }),
              ownerRegion(room.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
            break;
          }
          const sourceKey = hermesShrineDeliveryEntryKey(room.origin, generationKey);
          const shrineKey = semanticAddressKey(room.origin);
          const fallbackRewardType = hermesShrineRuntimeFallbackRewardType(
            catalog,
            generationKey,
            offer.offer.rewardType,
            hermesShrineTravelDealRefills.get(shrineKey)?.[0],
          );
          if (
            fallbackRewardType !== undefined &&
            (generationKey !== 'travelDealRefill' ||
              hermesShrineTravelDealRefillValid.get(shrineKey) === true)
          ) {
            const address = createAcquisitionEntryAddress(
              createAcquisitionSiteAddress(room.origin, 'hermesShrineDelivery'),
              sourceKey,
            );
            runtimeOfferFallbacks.set(
              semanticAddressKey(address),
              Object.freeze({
                address,
                preferredKey: offer.offer.rewardType,
                fallbackKey: fallbackRewardType,
              }),
            );
          }
          if (
            generationKey === 'travelDealRefill' &&
            hermesShrineTravelDealRefillValid.get(shrineKey) !== true
          ) {
            addRewardFinding(
              findings,
              rewardFinding('hermesShrineTravelDealRefillUnavailable', room.origin, {
                reason: 'noQualifyingFirstRushedPurchase',
              }),
              ownerRegion(room.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
            break;
          }
          if (purchase.rushed && generationKey.startsWith('initial:')) {
            const shrineKey = semanticAddressKey(room.origin);
            if (!firstRushedInitialGenerationByShrine.has(shrineKey)) {
              firstRushedInitialGenerationByShrine.add(shrineKey);
              const preRushView =
                roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
                roomView.preOutgoing ??
                roomView.entry;
              const qualifies = branches.every(
                (branch) => branch.traitHistory?.equippedTraits.RestockBoon !== undefined,
              );
              if (qualifies) {
                const refillAssessments = Object.freeze(
                  branches.flatMap((branch) => {
                    const assessment = assessHermesShrineTravelDealRefill(
                      catalog,
                      room.hermesShrine!,
                      generationKey,
                      [
                        rewardFacts(
                          catalog,
                          room,
                          room,
                          declaration,
                          preRushView,
                          branch.history,
                          enteredBiomeCount,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          branch,
                        ).requirements,
                      ],
                    );
                    return assessment === undefined ? [] : [assessment];
                  }),
                );
                hermesShrineTravelDealRefills.set(shrineKey, refillAssessments);
                const refill = room.hermesShrine?.travelDealRefill?.offer;
                const supported =
                  refill !== undefined &&
                  refill !== null &&
                  refillAssessments.length === branches.length &&
                  refillAssessments.every((assessment) =>
                    assessment.candidateRewardTypes.includes(refill.offer.rewardType),
                  );
                hermesShrineTravelDealRefillValid.set(shrineKey, supported);
                if (refill === undefined || refill === null) {
                  addRewardFinding(
                    findings,
                    rewardFinding('hermesShrineTravelDealRefillMissing', room.origin, {
                      generationKey,
                    }),
                    ownerRegion(room.origin),
                    rewardFindingChronologyForRoom(
                      snapshot,
                      room.origin,
                      event.sequence,
                      'localRoomLifecycle',
                    ),
                  );
                } else if (!supported) {
                  addRewardFinding(
                    findings,
                    rewardFinding('hermesShrineTravelDealRefillUnavailable', room.origin, {
                      generationKey,
                      rewardType: refill.offer.rewardType,
                    }),
                    ownerRegion(room.origin),
                    rewardFindingChronologyForRoom(
                      snapshot,
                      room.origin,
                      event.sequence,
                      'localRoomLifecycle',
                    ),
                  );
                }
              }
            }
          }
          if (!purchase.rushed) {
            branches = Object.freeze(
              branches.map((branch) =>
                Object.freeze({
                  ...branch,
                  pendingHermesShrineDeliveries: Object.freeze({
                    ...branch.pendingHermesShrineDeliveries,
                    [sourceKey]: Object.freeze({
                      sourceKey,
                      sourceOrigin: room.origin,
                      generationKey,
                      reward: offer,
                      remainingUses: purchase.delay,
                    }),
                  }),
                }),
              ),
            );
          } else {
            // Rush is deliberately one source action, but it is still an
            // ordinary free pickup.  The Shrine offer owns its resolution
            // detail; no second host-owned action is authored for this case.
            const site = createAcquisitionSiteAddress(room.origin, 'hermesShrineDelivery');
            const acquisitionView =
              roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
              roomView.preOutgoing ??
              roomView.entry;
            const settled = settlePickupAcquisitionSite(
              catalog,
              branches,
              {
                siteOwner: room.origin,
                site,
                entries: Object.freeze({ [sourceKey]: offer }),
                order: Object.freeze([sourceKey]),
                requiredEntryKeys: new Set([sourceKey]),
                producerLifecycleKey: 'HermesShrineDelivery',
                historySequence: event.sequence,
                facts: (branchHistory, _shopNames, branch) =>
                  rewardFacts(
                    catalog,
                    room,
                    room,
                    declaration,
                    acquisitionView,
                    branchHistory,
                    enteredBiomeCount,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    branch,
                  ),
                findingChronology: rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                authoredSeaStarDuplicateSiteKeys,
                artificerReplacementFor(source, role) {
                  const replacementSite = artificerAcquisitionSite(room.origin, source);
                  return (
                    room.acquisitionSites[acquisitionSiteStorageKey(replacementSite)]?.entries[
                      artificerReplacementEntryKey(source, role)
                    ] ?? null
                  );
                },
                artificerReplacementSiteFor(source) {
                  return artificerAcquisitionSite(room.origin, source);
                },
              },
              findings,
            );
            recordAcquisitionRoleFrontiers(settled.roleFrontiers);
            recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
            // The entry is not retained at the source: the one purchase row
            // itself owns this immediate pickup's controls and chronology.
            branches = settled.branches;
          }
          break;
        }
        const purgingPoolSlotKey = event.point.startsWith('purgingPool:')
          ? event.point.slice('purgingPool:'.length)
          : undefined;
        if (
          purgingPoolSlotKey === 'left' ||
          purgingPoolSlotKey === 'middle' ||
          purgingPoolSlotKey === 'right'
        ) {
          const traitKey = room.purgingPool?.traitKeyBySlot[purgingPoolSlotKey];
          const row = room.roomActionRoster.rows.find(
            (candidate) =>
              candidate.rank !== null &&
              candidate.reference.kind === 'sellPurgingPoolTrait' &&
              candidate.reference.slotKey === purgingPoolSlotKey,
          );
          if (row === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} has no ranked Pool sale row for ${purgingPoolSlotKey}`,
            );
          }
          const owner = createRoomActionAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            room.occurrenceId,
            row.key,
          );
          const poolGenerationComplete =
            purgingPoolAssessments
              .get(semanticAddressKey(room.origin))
              ?.assessments.every((assessment) => assessment.complete) === true;
          const available =
            poolGenerationComplete &&
            traitKey !== null &&
            traitKey !== undefined &&
            branches.every((branch) => {
              const equipped = (branch.traitHistory ?? createTraitHistoryState()).equippedTraits[
                traitKey
              ];
              return equipped !== undefined && isPurgingPoolEligibleTrait(catalog, equipped);
            });
          if (!available) {
            addRewardFinding(
              findings,
              rewardFinding('purgingPoolSaleUnavailable', owner, {
                slotKey: purgingPoolSlotKey,
                ...(traitKey === null || traitKey === undefined ? {} : { traitKey }),
              }),
              // A stale Pool action has no active roster contribution, so its
              // enclosing occurrence remains the progressive atomic region;
              // the finding origin itself stays the exact retained action.
              ownerRegion(room.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
            break;
          }
          branches = Object.freeze(
            branches.map((branch) => {
              const before = branch.traitHistory ?? createTraitHistoryState();
              const traitHistory = foldTraitHistoryEvents(catalog, [
                ...before.events,
                Object.freeze({
                  kind: 'traitRemoval' as const,
                  owner,
                  acquisitionRole: 'purgingPoolSale',
                  sequence: event.sequence,
                  acquisitionPoint: event.point,
                  traitKey,
                  match: 'currentTraitKey' as const,
                }),
              ]);
              return Object.freeze({
                ...branch,
                history: attachTraitHistory(branch.history, traitHistory),
                traitHistory,
              });
            }),
          );
          break;
        }
        const roomActionLocalParts = event.point.startsWith('localReward:')
          ? event.point.slice('localReward:'.length).split(':')
          : undefined;
        if (room.lifecycleProfileKey === 'FieldsCombatRoom' && roomActionLocalParts !== undefined) {
          const [groupKey, slotKey] = roomActionLocalParts;
          const localReward =
            groupKey === 'cages'
              ? room.localRewards?.find((reward) => reward.slotKey === slotKey)
              : groupKey === 'optionalRewards'
                ? room.fieldsOptionalRewards?.find((reward) => reward.slotKey === slotKey)
                : undefined;
          const acquisitionView = roomView.acquisitionPoints?.find(
            (point) => point.point === event.point,
          )?.before;
          if (localReward === undefined || acquisitionView === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} has no Fields acquisition ${event.point}`,
            );
          }
          const settlement = settleOwnedAcquisitionSite(
            catalog,
            branches,
            {
              siteOwner: localReward.origin,
              pointKey: event.point,
              entryKey: localReward.slotKey,
              source: withStoredArtificerReplacements(
                room,
                Object.freeze({ ...localReward, instanceProvenance: 'free' }),
              ),
              historySequence: event.sequence,
              deferArtificerReplacement: true,
              authoredSeaStarDuplicateSiteKeys,
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
        if (event.siteKey !== undefined && event.entryKey !== undefined) {
          const site = room.acquisitionSites[event.siteKey];
          const shrineDelivery =
            event.siteKey === 'hermesShrineDelivery'
              ? parseHermesShrineDeliveryEntryKey(event.entryKey)
              : undefined;
          if (site !== undefined && shrineDelivery !== undefined) {
            const sourceOrigin = {
              kind: 'occurrence' as const,
              routeKey: shrineDelivery.routeKey,
              biomeKey: shrineDelivery.biomeKey,
              occurrenceId: shrineDelivery.sourceOccurrenceId,
            };
            const sourceKey = hermesShrineDeliveryEntryKey(
              sourceOrigin,
              shrineDelivery.generationKey,
            );
            const due = branches.map((branch) => branch.pendingHermesShrineDeliveries[sourceKey]);
            const firstDue = due[0];
            const agreedDue =
              firstDue !== undefined &&
              due.length === branches.length &&
              due.every(
                (delivery) =>
                  delivery !== undefined &&
                  semanticAddressKey(delivery.dueAt ?? room.origin) ===
                    semanticAddressKey(room.origin),
              )
                ? firstDue
                : undefined;
            const retained = site.entries[event.entryKey];
            const entry = createAcquisitionEntryAddress(site.address, event.entryKey);
            if (
              agreedDue === undefined ||
              retained === undefined ||
              retained === null ||
              JSON.stringify(retained.offer) !== JSON.stringify(agreedDue.reward.offer)
            ) {
              addRewardFinding(
                findings,
                rewardFinding('rewardSourceUnavailable', entry, {
                  reason:
                    agreedDue === undefined
                      ? 'staleHermesShrineDelivery'
                      : 'retainedSourceMismatch',
                }),
                ownerRegion(entry),
                rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
              );
              break;
            }
            const acquisitionView =
              roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
              roomView.preOutgoing ??
              roomView.entry;
            const settled = settlePickupAcquisitionSite(
              catalog,
              branches,
              {
                siteOwner: room.origin,
                site: site.address,
                entries: Object.freeze({ [event.entryKey]: retained }),
                order: Object.freeze([event.entryKey]),
                requiredEntryKeys: new Set([event.entryKey]),
                producerLifecycleKey: 'HermesShrineDelivery',
                historySequence: event.sequence,
                facts: (branchHistory, _shopNames, branch) =>
                  rewardFacts(
                    catalog,
                    room,
                    room,
                    declaration,
                    acquisitionView,
                    branchHistory,
                    enteredBiomeCount,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    branch,
                  ),
                findingChronology: rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                authoredSeaStarDuplicateSiteKeys,
              },
              findings,
            );
            recordAcquisitionRoleFrontiers(settled.roleFrontiers);
            recordTraitChildSettlements(settled.traitChildSettlements, room.origin);
            const settledEntryKey = semanticAddressKey(entry);
            branches = Object.freeze(
              settled.branches.map((branch) => {
                // A role can split or merge reward branches, so cardinality
                // cannot decide whether this particular pending item settled.
                // Its own ordinary pickup event is the authoritative success
                // witness.  Blocked/no-op successors retain the pending item.
                const settledThisEntry = branch.events.some(
                  (candidate) =>
                    (candidate.kind === 'concreteAcquisition' ||
                      candidate.kind === 'conversionToGold' ||
                      candidate.kind === 'artificerConversion') &&
                    candidate.settlement !== undefined &&
                    semanticAddressKey(candidate.settlement.entry) === settledEntryKey,
                );
                if (!settledThisEntry) return branch;
                const { [sourceKey]: delivered, ...remaining } =
                  branch.pendingHermesShrineDeliveries;
                void delivered;
                return Object.freeze({
                  ...branch,
                  pendingHermesShrineDeliveries: Object.freeze(remaining),
                });
              }),
            );
            break;
          }
          const parsed = parseArtificerReplacementEntryKey(event.entryKey);
          if (site !== undefined && parsed !== undefined) {
            const source = canonicalArtificerSource(room, parsed.sourceKey);
            const replacement = site.entries[event.entryKey];
            if (source === undefined || replacement === undefined) {
              throw new BiomeRewardSimulationContractError(
                `${room.gameName} lost Artificer source for ${event.entryKey}`,
              );
            }
            const acquisitionView =
              roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
              roomView.preOutgoing ??
              roomView.entry;
            const row = room.roomActionRoster.rows.find(
              (candidate) =>
                candidate.reference.kind === 'interactAcquisitionEntry' &&
                candidate.reference.siteKey === event.siteKey &&
                candidate.reference.entryKey === event.entryKey,
            );
            const settlement = settleArtificerReplacementAcquisition(
              catalog,
              branches,
              {
                siteOwner: site.address.owner,
                pointKey: site.address.pointKey,
                sourceEntryKey: parsed.sourceKey,
                sourceOrigin: source.owner,
                sourceReward: source.reward,
                replacement,
                acquisitionRole: parsed.acquisitionRole,
                participation: row?.participation === 'required' ? 'mandatory' : 'optional',
                historySequence: event.sequence,
                facts: (branchHistory, _shopNames, branch) =>
                  rewardFacts(
                    catalog,
                    room,
                    room,
                    declaration,
                    acquisitionView,
                    branchHistory,
                    enteredBiomeCount,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    branch,
                  ),
                findingChronology: rewardFindingChronologyForRoom(
                  snapshot,
                  room.origin,
                  event.sequence,
                  'localRoomLifecycle',
                ),
                authoredSeaStarDuplicateSiteKeys,
              },
              findings,
            );
            recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
            recordTraitChildSettlements(settlement.traitChildSettlements, room.origin);
            branches = settlement.branches;
            break;
          }
        }
        const currentRow = room.roomActionRoster.rows.find(
          (row) =>
            row.rank !== null &&
            event.point ===
              (row.reference.kind === 'interactShopOffer'
                ? `shopOffer:${row.reference.offerKey}`
                : row.reference.kind === 'interactAcquisitionEntry'
                  ? `acquisitionEntry:${row.reference.siteKey}:${row.reference.entryKey}`
                  : ''),
        );
        const actionEntry =
          currentRow?.reference.kind === 'interactAcquisitionEntry'
            ? { siteKey: currentRow.reference.siteKey, entryKey: currentRow.reference.entryKey }
            : currentRow?.reference.kind === 'interactShopOffer'
              ? { siteKey: 'roomExit', entryKey: currentRow.reference.offerKey }
              : undefined;
        const currentRank = currentRow?.rank ?? undefined;
        const completeShopAfterOrder =
          room.entryState?.kind !== 'shop' ||
          currentRank === undefined ||
          !room.roomActionRoster.rows.some(
            (row) =>
              row.rank !== null &&
              row.rank > currentRank &&
              (row.reference.kind === 'interactShopOffer' ||
                (row.reference.kind === 'interactAcquisitionEntry' &&
                  row.reference.siteKey === 'roomExit')),
          );
        branches = settleAuthoredAcquisitionSite(
          room,
          declaration,
          roomView,
          branches,
          event.sequence,
          findings,
          actionEntry,
          completeShopAfterOrder,
        );
        break;
      }
      case 'wellPurchase': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const well = room?.kind === 'authored' ? room.stygianWell : undefined;
        const slot = event.generationKey.startsWith('initial:')
          ? (event.generationKey.slice(
              'initial:'.length,
            ) as import('../../authored-project/model').StygianWellSlotKey)
          : undefined;
        const itemKey =
          event.generationKey === 'travelDealRefill'
            ? well?.travelDealRefillKey
            : slot === undefined
              ? undefined
              : well?.offerKeyBySlot[slot];
        if (
          room?.kind !== 'authored' ||
          well === undefined ||
          !well.interacted ||
          itemKey === undefined ||
          itemKey === null
        ) {
          addRewardFinding(
            findings,
            rewardFinding('rewardSourceUnavailable', event.origin, {
              generationKey: event.generationKey,
            }),
            ownerRegion(event.origin),
            rewardFindingChronologyForRoom(
              snapshot,
              event.origin,
              event.sequence,
              'localRoomLifecycle',
            ),
          );
          break;
        }
        const twistChildKey =
          event.generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot;
        const twistResultKey =
          itemKey === 'RandomStoreItem' && twistChildKey !== undefined
            ? well.twistResultKeyBySlot?.[twistChildKey]
            : undefined;
        const row =
          room?.kind === 'authored'
            ? room.roomActionRoster.rows.find(
                (candidate) =>
                  candidate.reference.kind === 'purchaseStygianWellOffer' &&
                  candidate.reference.generationKey === event.generationKey,
              )
            : undefined;
        if (row !== undefined) {
          const address = createRoomActionAddress(
            createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
            room.occurrenceId,
            row.key,
          );
          const fallbackItemKey = stygianWellRuntimeFallbackItemKey(catalog, itemKey, false);
          if (fallbackItemKey !== undefined)
            runtimeOfferFallbacks.set(
              semanticAddressKey(address),
              Object.freeze({ address, preferredKey: itemKey, fallbackKey: fallbackItemKey }),
            );
          if (twistResultKey !== undefined && twistResultKey !== null) {
            const nestedFallback = stygianWellRuntimeFallbackItemKey(catalog, twistResultKey, true);
            if (nestedFallback !== undefined)
              runtimeOfferFallbacks.set(
                `${semanticAddressKey(address)}:twist`,
                Object.freeze({
                  address,
                  preferredKey: twistResultKey,
                  fallbackKey: nestedFallback,
                }),
              );
          }
        }
        branches = Object.freeze(
          branches.map((branch) => {
            const direct = applyStygianWellPurchase(catalog, branch.stygianWell, itemKey);
            const directOption = catalog.rewards.shops.byKey.RoomShop?.groups.values
              .flatMap((group) => group.options.values)
              .find((option) => option.key === itemKey);
            const nestedOption =
              twistResultKey === undefined || twistResultKey === null
                ? undefined
                : catalog.rewards.shops.byKey.RoomShop?.groups.values
                    .flatMap((group) => group.options.values)
                    .find((option) => option.key === twistResultKey);
            let history = branch.history;
            if (directOption?.stygianWell?.effect === 'lastStand') {
              history = applyConcreteAcquisition(catalog.rewards, history, {
                kind: 'consumable',
                gameName: 'LastStandDrop',
              });
            }
            if (nestedOption?.stygianWell?.effect === 'lastStand') {
              history = applyConcreteAcquisition(catalog.rewards, history, {
                kind: 'consumable',
                gameName: 'LastStandDrop',
              });
            }
            return Object.freeze({
              ...branch,
              history,
              stygianWell:
                twistResultKey === undefined || twistResultKey === null
                  ? direct
                  : applyStygianWellPurchase(catalog, direct, twistResultKey, false),
            });
          }),
        );
        break;
      }
      case 'roomExited': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const exited = applyRoomExitedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin)),
          resourcePlacements,
          branches,
        );
        branches = exited.branches;
        if (exited.runStateCheckpoint !== undefined)
          captureRunState(
            exited.runStateCheckpoint.owner,
            exited.runStateCheckpoint.room,
            exited.runStateCheckpoint.view,
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
  const traitCandidateContexts = new Map(traitProducts.candidateContexts);
  for (const [key, checkpoint] of traitChildSettlementBuilders) {
    if (checkpoint.candidateContexts.length === 0) continue;
    traitCandidateContexts.set(
      key,
      Object.freeze([...(traitCandidateContexts.get(key) ?? []), ...checkpoint.candidateContexts]),
    );
  }
  const levelCandidateContexts = new Map(traitProducts.levelCandidateContexts);
  const discoveredRunStateSnapshots = Object.freeze(
    [...runStateSnapshotsByOwner.values()].sort((left, right) => {
      const leftRoom = left.owner.kind === 'roomRunStateCheckpoint';
      const rightRoom = right.owner.kind === 'roomRunStateCheckpoint';
      return leftRoom === rightRoom ? 0 : leftRoom ? 1 : -1;
    }),
  );
  const runStatePublication = publishRunStateThroughCoverage(
    discoveredRunStateSnapshots,
    discoveredRunStateSnapshots,
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
    purgingPoolAssessments: Object.freeze([...purgingPoolAssessments.values()]),
    hermesShrineAssessments: Object.freeze([...hermesShrineAssessments.values()]),
    stygianWellAssessments: Object.freeze([...stygianWellAssessments.values()]),
    hermesShrineDeliveries: Object.freeze([
      ...new Map(
        branches
          .flatMap((branch) => Object.values(branch.pendingHermesShrineDeliveries))
          .map(
            (delivery) =>
              [
                delivery.sourceKey,
                Object.freeze({
                  sourceKey: delivery.sourceKey,
                  sourceOrigin: delivery.sourceOrigin,
                  rewardType: delivery.reward.offer.rewardType,
                  deliveryKind:
                    delivery.dueAt === undefined ? ('pending' as const) : ('countdown' as const),
                  ...(delivery.dueAt === undefined ? {} : { hostOrigin: delivery.dueAt }),
                  ...(delivery.dueSequence === undefined
                    ? {}
                    : { hostSequence: delivery.dueSequence }),
                  remainingUses: delivery.remainingUses,
                }),
              ] as const,
          ),
      ).values(),
    ]),
    selectedTraitOffers: traitProducts.selectedTraitOffers,
    selectedLevelResolutions: traitProducts.selectedLevelResolutions,
    runtimeOfferFallbacks: Object.freeze([
      ...traitProducts.runtimeOfferFallbacks,
      ...runtimeOfferFallbacks.values(),
    ]),
    figLeafPhaseCandidates: Object.freeze([...figLeafPhaseCandidates.values()]),
    gorgonPhaseCandidates: Object.freeze([...gorgonPhaseCandidates.values()]),
    nemesisRandomEventCandidates: Object.freeze([...nemesisRandomEventCandidates.values()]),
    steadyGrowthOutcomes: Object.freeze(
      [...steadyGrowthCandidateContexts.entries()].flatMap(([key, thresholds]) => {
        const address = steadyGrowthOutcomeAddresses.get(key);
        const first = thresholds[0];
        if (address === undefined || first === undefined) return [];
        return [
          Object.freeze({
            address,
            sourceTraitKey: first.traitKey,
            phaseKey: address.phaseKey,
            requiredIntervals: Object.freeze(
              thresholds.map((threshold) => threshold.requiredInterval),
            ),
            progressBefore: Object.freeze(
              thresholds.map(
                (threshold) =>
                  threshold.before.equippedTraits[threshold.traitKey]?.steadyGrowthProgress ?? 0,
              ),
            ),
          }),
        ];
      }),
    ),
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
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(shipLifecycleContexts),
    traitOfferArtifacts: createTraitOfferCandidateArtifacts(catalog, traitCandidateContexts),
    levelResolutionArtifacts: createLevelResolutionCandidateArtifacts(
      catalog,
      levelCandidateContexts,
    ),
    judgmentArcanaArtifacts: createJudgmentArcanaCandidateArtifacts(judgmentArcanaContexts),
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
    steadyGrowthArtifacts: createSteadyGrowthCandidateArtifacts(
      catalog,
      steadyGrowthCandidateContexts,
    ),
    purgingPoolArtifacts: createPurgingPoolCandidateArtifacts(
      new Map(
        [...purgingPoolAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    hermesShrineArtifacts: createHermesShrineCandidateArtifacts(
      new Map(
        [...hermesShrineAssessments.values()].map(({ origin, assessments }) => {
          const travelDealRefills = hermesShrineTravelDealRefills.get(semanticAddressKey(origin));
          return [
            semanticAddressKey(origin),
            Object.freeze(
              assessments.map((assessment, index) =>
                travelDealRefills?.[index] === undefined
                  ? assessment
                  : Object.freeze({ ...assessment, travelDealRefill: travelDealRefills[index] }),
              ),
            ),
          ] as const;
        }),
      ),
    ),
    stygianWellArtifacts: createStygianWellCandidateArtifacts(
      new Map(
        [...stygianWellAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
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
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}

export function evaluateBiomeRewardsAssembly(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}
