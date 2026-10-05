import {
  createAcquisitionEntryAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createRoomRunStateCheckpointAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import type { HistoryEvent } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubDecision } from '../../materialization';
import { resourcePlacementFindingRegions } from '../../resources';
import { addHubBoardRewardLookup } from '../../state/reward-lookups';
import {
  normalizeOfferedRewardTypes,
  publishOfferedRewardTypes,
} from '../../state/offered-rewards';
import { reachSimulationHistory } from '../../state/transitions';
import { attestDerivedAcquisitionEntryCandidateCapability } from '../acquisition/artifacts';
import { advanceRewardBranches } from '../branch-lifecycle';
import { BiomeRewardSimulationContractError } from './biome-contract';
import {
  generationFindings,
  lifecycleFindings,
  mergedFindings,
  settledFindings,
  siteSettlementEmissions,
  type ChronologyAccumulator,
  type ChronologyEmission,
} from './chronology-accumulator';
import { captureRunState, hubDepartureEmissions, targetSlotHistory } from './chronology-run-state';
import {
  withBranches,
  withKeyed,
  withMember,
  type ChronologySeamHandler,
  type ChronologySeamStep,
  type ChronologyWalkContext,
  type ChronologyWalkState,
  type SeamEvent,
} from './chronology-walk';
import { applyAcquisitionPointReachedTransition } from './encounter-acquisition/acquisition-point-reached';
import { applyEncounterSettlementTransition } from './encounter-acquisition/encounter-settlement';
import { applyGorgonStartedTransition } from './encounter-acquisition/gorgon-started';
import { applyWellPurchaseTransition } from './encounter-acquisition/well-purchase';
import { rewardFindingChronologyForRoom } from './finding-chronology';
import { flushHubBoard } from './generation/hub-board';
import { applyOutgoingGenerationTransition } from './generation/outgoing-generation';
import { applyRoomCreatedTransition } from './generation/room-created';
import { applyTargetGenerationCompletedTransition } from './generation/target-generation-completed';
import { applyEncounterEndEffectsTransition } from './lifecycle-transitions/encounter-end-effects';
import { applyEncounterStartedTransition } from './lifecycle-transitions/encounter-started';
import { applyErisInteractedTransition } from './lifecycle-transitions/eris-interacted';
import { applyFountainUsedTransition } from './lifecycle-transitions/fountain-used';
import { applyKeepsakeRackUsedTransition } from './lifecycle-transitions/keepsake-rack-used';
import { applyRoomEnteredTransition } from './lifecycle-transitions/room-entered';
import { applyRoomExitedTransition } from './lifecycle-transitions/room-exited';
import { applyRoomPreparedTransition } from './lifecycle-transitions/room-prepared';
import { applyOfferPointMaterializedTransition } from './offer-lifecycle/offer-point-materialized';
import { applyReachedOfferSettlement } from './offer-lifecycle/reached-settlement';

function authoredRoom(
  context: ChronologyWalkContext,
  origin: SemanticAddress,
): CanonicalAuthoredRoom | undefined {
  const room = context.rooms.get(semanticAddressKey(origin));
  return room?.kind === 'authored' ? room : undefined;
}

const erisInteracted: ChronologySeamHandler<'erisInteracted'> = (context, state, event) => {
  const transition = applyErisInteractedTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    state.branches,
  );
  return {
    state: withBranches(state, transition.branches),
    emissions: [lifecycleFindings(transition.findings)],
  };
};

const keepsakeRackUsed: ChronologySeamHandler<'keepsakeRackUsed'> = (context, state, event) => {
  const transition = applyKeepsakeRackUsedTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    context.views.get(semanticAddressKey(event.origin))?.entry,
    context.routeLoadout,
    state.branches,
    context.enteredBiomeCount + 1,
  );
  return {
    state: withBranches(state, transition.branches),
    emissions: [
      { kind: 'timelineFacts', facts: transition.timelineFacts },
      ...(transition.keepsakeSelectionCandidate === undefined
        ? []
        : [
            {
              kind: 'keepsakeSelectionCandidate' as const,
              key: transition.keepsakeSelectionCandidate.key,
              candidate: transition.keepsakeSelectionCandidate.candidate,
            },
          ]),
      {
        kind: 'keepsakeEquipResultCandidates',
        candidates: transition.keepsakeEquipResultCandidates,
      },
      lifecycleFindings(transition.findings),
    ],
  };
};

const roomExited: ChronologySeamHandler<'roomExited'> = (context, state, event) => {
  const exited = applyRoomExitedTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    context.views.get(semanticAddressKey(event.origin)),
    context.resourcePlacements,
    state.branches,
    context.resourceFindings,
  );
  return {
    state: withBranches(state, exited.branches),
    emissions: [mergedFindings(exited.findingRegions)],
    ...(exited.runStateCheckpoint === undefined
      ? {}
      : { runStateCheckpoint: { ...exited.runStateCheckpoint, against: 'received' as const } }),
  };
};

/** A Hermes Shrine delivery that still needs a placement halts the walk here. */
const encounterEndEffectsApplied: ChronologySeamHandler<'encounterEndEffectsApplied'> = (
  context,
  state,
  event,
) => {
  const transition = applyEncounterEndEffectsTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    state.branches,
  );
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      halted: transition.hermesShrineDeliveryPlacementRequired,
    }),
    emissions: [
      { kind: 'timedEffectContacts', contacts: transition.timedEffects },
      { kind: 'timelineFacts', facts: transition.timelineFacts },
      { kind: 'generatedPickupPlacements', placements: transition.generatedPickupPlacements },
      {
        kind: 'derivedAcquisitionEntryFrontiers',
        frontiers: transition.derivedAcquisitionEntryFrontiers,
      },
      { kind: 'steadyGrowthThresholds', thresholds: transition.steadyGrowthThresholds },
      {
        kind: 'transcendentEmbryoThresholds',
        thresholds: transition.transcendentEmbryoThresholds,
      },
      {
        kind: 'traitChildSettlements',
        checkpoints: transition.traitChildSettlements,
        occurrenceOwner: event.origin,
      },
      lifecycleFindings(transition.findings),
    ],
  };
};

const wellPurchase: ChronologySeamHandler<'wellPurchase'> = (context, state, event) => {
  const wellRoom = context.rooms.get(semanticAddressKey(event.origin));
  const wellOrigin = wellRoom?.kind === 'authored' ? wellRoom.origin : undefined;
  const transition = applyWellPurchaseTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room: wellRoom,
    branches: state.branches,
    refillGenerationSupported:
      wellOrigin !== undefined &&
      state.wellRefillRealizations.has(
        semanticAddressKey(
          createTravelDealRefillRealizationAddress(
            createBiomeAddress(wellOrigin.routeKey, wellOrigin.biomeKey),
            wellOrigin.occurrenceId,
          ),
        ),
      ),
  });
  let stygianWellAssessments = state.stygianWellAssessments;
  if (transition.candidateContexts.length > 0 && wellRoom?.kind === 'authored') {
    const key = semanticAddressKey(event.origin);
    const existing = stygianWellAssessments.get(key);
    stygianWellAssessments = new Map(stygianWellAssessments).set(
      key,
      Object.freeze({
        origin: wellRoom.origin,
        assessments: Object.freeze([
          ...(existing?.assessments ?? []),
          ...transition.candidateContexts,
        ]),
      }),
    );
  }
  const realization = transition.refillRealization;
  const wellRefillRealizations =
    realization === undefined
      ? state.wellRefillRealizations
      : new Map(state.wellRefillRealizations).set(
          semanticAddressKey(realization.owner),
          realization,
        );
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      stygianWellAssessments,
      wellRefillRealizations,
    }),
    emissions: [
      settledFindings(transition.findings),
      { kind: 'timelineFacts', facts: transition.timelineFacts },
    ],
  };
};

function roomDeclaration(context: ChronologyWalkContext, room: CanonicalAuthoredRoom | undefined) {
  return room === undefined
    ? undefined
    : routeRoomDeclaration(context.catalog.rooms.byKey[room.gameName], room.origin.routeKey);
}

function acquisitionEmissions(
  transition: ReturnType<typeof applyAcquisitionPointReachedTransition>,
  room: CanonicalAuthoredRoom | undefined,
): readonly ChronologyEmission[] {
  return [
    settledFindings(transition.findings),
    { kind: 'generatedPickupPlacements', placements: transition.generatedPickupPlacements },
    { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
    { kind: 'acquisitionRoleFrontiers', frontiers: transition.roleFrontiers },
    { kind: 'timelineFacts', facts: transition.timelineFacts },
    ...(room === undefined
      ? []
      : [
          {
            kind: 'traitChildSettlements' as const,
            checkpoints: transition.traitChildSettlements,
            occurrenceOwner: room.origin,
          },
        ]),
  ];
}

const hermesShrineDeliveriesScheduled: ChronologySeamHandler<'hermesShrineDeliveriesScheduled'> = (
  context,
  state,
  event,
) => {
  const room = authoredRoom(context, event.origin);
  const transition = applyAcquisitionPointReachedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room,
    declaration: roomDeclaration(context, room),
    roomView: context.views.get(semanticAddressKey(event.origin)),
    sourceBranches: state.branches,
    authoredSeaStarDuplicateSiteKeys: Object.freeze([...context.authoredSeaStarDuplicateSiteKeys]),
    purgingPoolAssessment: undefined,
  });
  const refills = transition.travelDealRefillAssessments;
  return {
    state:
      refills === undefined
        ? withBranches(state, transition.branches)
        : Object.freeze({
            ...state,
            branches: transition.branches,
            hermesShrineTravelDealRefills: withKeyed(
              state.hermesShrineTravelDealRefills,
              semanticAddressKey(event.origin),
              refills,
            ),
          }),
    emissions: acquisitionEmissions(transition, room),
  };
};

const acquisitionPointReached: ChronologySeamHandler<'acquisitionPointReached'> = (
  context,
  state,
  event,
) => {
  const room = authoredRoom(context, event.origin);
  const emissions: ChronologyEmission[] = [];
  if (room !== undefined && event.point.startsWith('purgingPool:')) {
    const poolSlot = event.point.slice('purgingPool:'.length);
    const poolRow = room.roomActionRoster.rows.find(
      (row) =>
        !row.stale &&
        row.rank !== null &&
        row.reference.kind === 'sellPurgingPoolTrait' &&
        row.reference.slotKey === poolSlot,
    );
    if (poolRow !== undefined)
      emissions.push({
        kind: 'timelineFacts',
        facts: { nodes: [{ owner: poolRow.owner, included: true }] },
      });
  }
  const derivedSite =
    event.siteKey === undefined || room === undefined
      ? undefined
      : room.acquisitionSites[event.siteKey]?.address;
  const derivedFrontiers =
    derivedSite === undefined || event.entryKey === undefined
      ? Object.freeze([])
      : context.accumulated.derivedAcquisitionEntryFrontiers(
          semanticAddressKey(createAcquisitionEntryAddress(derivedSite, event.entryKey)),
        );
  const derivedCapability =
    derivedSite === undefined || event.entryKey === undefined
      ? undefined
      : attestDerivedAcquisitionEntryCandidateCapability(derivedFrontiers);
  const transition = applyAcquisitionPointReachedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room,
    declaration: roomDeclaration(context, room),
    roomView: context.views.get(semanticAddressKey(event.origin)),
    sourceBranches: state.branches,
    authoredSeaStarDuplicateSiteKeys: Object.freeze([...context.authoredSeaStarDuplicateSiteKeys]),
    purgingPoolAssessment: state.purgingPoolAssessments.get(semanticAddressKey(event.origin)),
    derivedAcquisitionEntryFrontiers: derivedFrontiers,
    ...(derivedCapability === undefined
      ? {}
      : { derivedAcquisitionEntryCapability: derivedCapability }),
  });
  emissions.push(...acquisitionEmissions(transition, room));
  if (transition.authoredSiteSettlement !== undefined && room !== undefined)
    emissions.push(...siteSettlementEmissions(transition.authoredSiteSettlement, room.origin));
  return {
    state: withBranches(state, transition.branches),
    emissions,
  };
};

/** A Ship room captures its Run State before each encounter starts. */
const encounterStarted: ChronologySeamHandler<'encounterStarted'> = (context, state, event) => {
  const sourceRoom = context.rooms.get(semanticAddressKey(event.origin));
  const room = sourceRoom?.kind === 'authored' ? sourceRoom : undefined;
  let runStateCheckpoint: ChronologySeamStep['runStateCheckpoint'];
  if (room !== undefined && room.lifecycleProfileKey === 'ShipCombatRoom') {
    const view = context.views
      .get(semanticAddressKey(event.origin))
      ?.encounterStarts.find((candidate) => candidate.phaseKey === event.phaseKey)?.before;
    if (view === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} ${event.phaseKey} has no pre-encounter Run State view`,
      );
    }
    runStateCheckpoint = {
      against: 'received',
      owner: createRoomRunStateCheckpointAddress(room.origin, {
        kind: 'beforeEncounterStart',
        phaseKey: event.phaseKey,
      }),
      room,
      view,
    };
  }
  const figLeaf = applyEncounterStartedTransition(
    context.catalog,
    context.snapshot,
    event,
    room,
    state.branches,
  );
  const gorgon = applyGorgonStartedTransition({
    catalog: context.catalog,
    event,
    room,
    view:
      sourceRoom === undefined
        ? undefined
        : context.views.get(semanticAddressKey(sourceRoom.origin)),
    branches: figLeaf.branches,
    evaluationBlocked: state.gorgonEvaluationBlocked,
  });
  return {
    state: Object.freeze({
      ...state,
      branches: gorgon.branches,
      eligibleGorgonPhases:
        gorgon.eligiblePhaseKey === undefined
          ? state.eligibleGorgonPhases
          : withMember(state.eligibleGorgonPhases, gorgon.eligiblePhaseKey, true),
    }),
    emissions: [
      { kind: 'figLeafPhaseCandidates', candidates: figLeaf.figLeafCandidates },
      lifecycleFindings(figLeaf.findings),
      ...(gorgon.candidate === undefined
        ? []
        : [
            {
              kind: 'gorgonPhaseCandidate' as const,
              key: gorgon.candidate.key,
              candidate: gorgon.candidate.value,
            },
          ]),
      lifecycleFindings(gorgon.findings),
    ],
    ...(runStateCheckpoint === undefined ? {} : { runStateCheckpoint }),
  };
};

/** Encounter completion and its cleanup-window Room Actions settle through one transition. */
const encounterSettled: ChronologySeamHandler<
  'bossDefeated' | 'encounterInteractionReached' | 'encounterCompleted'
> = (context, state, event) => {
  const room = context.rooms.get(semanticAddressKey(event.origin));
  const gorgonPhaseKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
  const gorgonCandidate =
    room?.kind === 'authored'
      ? context.accumulated.gorgonPhaseCandidate(
          semanticAddressKey(
            createEncounterPhaseAddress(
              createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
              { kind: 'occurrence', occurrenceId: room.occurrenceId },
              event.phaseKey,
            ),
          ),
        )
      : undefined;
  const transition = applyEncounterSettlementTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    routePosition: context.routePosition,
    event,
    room,
    view: context.views.get(semanticAddressKey(event.origin)),
    branches: state.branches,
    enteredBiomeCount: context.enteredBiomeCount,
    fullRunBiomeCount: context.fullRunBiomeCount,
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
    gorgonEligible: state.eligibleGorgonPhases.has(gorgonPhaseKey),
    gorgonCandidate,
    gorgonPhaseBlocked: state.blockedGorgonPhases.has(gorgonPhaseKey),
    gorgonEvaluationBlocked: state.gorgonEvaluationBlocked,
  });
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      blockedGorgonPhases:
        transition.blockGorgonPhaseKey === undefined
          ? state.blockedGorgonPhases
          : withMember(state.blockedGorgonPhases, transition.blockGorgonPhaseKey, true),
      gorgonEvaluationBlocked: transition.gorgonEvaluationBlocked,
    }),
    emissions: [
      settledFindings(transition.findings),
      { kind: 'acquisitionRoleFrontiers', frontiers: transition.roleFrontiers },
      {
        kind: 'traitOfferCandidateContacts',
        contacts: transition.traitOfferCandidateContacts,
      },
      ...transition.traitChildSettlements.map((settlement) => ({
        kind: 'traitChildSettlements' as const,
        checkpoints: Object.freeze([settlement.checkpoint]),
        occurrenceOwner: settlement.occurrenceOwner,
      })),
      ...(transition.judgmentCandidate === undefined
        ? []
        : [
            {
              kind: 'judgmentArcanaCandidate' as const,
              key: transition.judgmentCandidate.key,
              candidate: Object.freeze({
                activeArcanaKeys: transition.judgmentCandidate.activeArcanaKeys,
                activeArcana: transition.judgmentCandidate.activeArcana,
                inactiveArcanaKeys: transition.judgmentCandidate.inactiveArcanaKeys,
                requiredCount: transition.judgmentCandidate.requiredCount,
              }),
            },
          ]),
      ...(transition.figurineCandidate === undefined
        ? []
        : [
            {
              kind: 'figurineArcanaCandidate' as const,
              key: transition.figurineCandidate.key,
              candidate: Object.freeze({
                activeArcanaKeys: transition.figurineCandidate.activeArcanaKeys,
                activeArcana: transition.figurineCandidate.activeArcana,
                inactiveArcanaKeys: transition.figurineCandidate.inactiveArcanaKeys,
                requiredCount: transition.figurineCandidate.requiredCount,
                rarity: transition.figurineCandidate.rarity,
              }),
            },
          ]),
      ...(transition.nemesisCandidate === undefined
        ? []
        : [
            {
              kind: 'nemesisRandomEventCandidate' as const,
              key: transition.nemesisCandidate.key,
              candidate: transition.nemesisCandidate.value,
            },
          ]),
      { kind: 'bossArcanaOutcomes', outcomes: transition.bossArcanaOutcomes ?? [] },
      { kind: 'timelineFacts', facts: transition.timelineFacts },
    ],
  };
};

const roomCreated: ChronologySeamHandler<'roomCreated'> = (context, state, event) => {
  const { prepared } = context;
  const transition = applyRoomCreatedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    rooms: prepared.rooms,
    views: prepared.views,
    targets: prepared.targets,
    hubTargetByOrigin: prepared.hubTargetByOrigin,
    additionalContinuations: prepared.additionalContinuations,
    expectedStores: state.expectedStores,
    hermesShrineAssessments: state.hermesShrineAssessments,
    batchesByParent: prepared.batchesByParent,
    ...('current' in context.history ? { historyCurrent: context.history.current } : {}),
    branches: state.branches,
    peers: state.peers,
    ...(state.pendingHubBoard === undefined ? {} : { pendingHubBoard: state.pendingHubBoard }),
    lifecycle: prepared.lifecycle,
    enteredBiomeCount: context.enteredBiomeCount,
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
  });
  const checkpoint = transition.hubRunStateCheckpoint;
  return {
    leadingEmissions: [
      mergedFindings(resourcePlacementFindingRegions(event, context.resourceFindings)),
      ...(transition.keepsakeSelectionCandidate === undefined
        ? []
        : [
            {
              kind: 'keepsakeSelectionCandidate' as const,
              key: transition.keepsakeSelectionCandidate.key,
              candidate: transition.keepsakeSelectionCandidate.candidate,
            },
          ]),
    ],
    ...(checkpoint === undefined
      ? {}
      : {
          runStateCheckpoint: {
            against: 'received' as const,
            owner: checkpoint.owner,
            room: checkpoint.source,
            view: checkpoint.view,
          },
        }),
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      peers: transition.peers,
      pendingHubBoard: transition.pendingHubBoard,
    }),
    emissions: [
      generationFindings(transition.findings),
      { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
    ],
  };
};

/** Publishes the complete Hub board generation once every Hub slot has a participant. */
function flushPendingHubBoard(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
): { readonly state: ChronologyWalkState; readonly emissions: readonly ChronologyEmission[] } {
  const { pendingHubBoard } = state;
  const flushed = flushHubBoard(context.catalog, pendingHubBoard);
  if (flushed === undefined) return { state, emissions: [] };
  const { progression } = context.prepared.layout;
  const branches =
    progression.kind === 'hub' &&
    pendingHubBoard !== undefined &&
    flushed.peers.length === pendingHubBoard.participants.length &&
    flushed.branches.length > 0
      ? Object.freeze(
          flushed.branches.map((branch) =>
            Object.freeze({
              ...branch,
              state: addHubBoardRewardLookup(
                branch.state,
                progression.rewardLookup.key,
                flushed.peers.map((peer) => peer.offer.rewardType),
              ),
            }),
          ),
        )
      : flushed.branches;
  return {
    state: Object.freeze({ ...state, branches, peers: flushed.peers, pendingHubBoard: undefined }),
    emissions: [
      generationFindings(flushed.findings),
      { kind: 'producerFrontiers', frontiers: flushed.producerFrontiers },
    ],
  };
}

const targetGenerationCompleted: ChronologySeamHandler<'targetGenerationCompleted'> = (
  context,
  state,
  event,
) => {
  const flushed =
    event.origin.kind === 'hubSlot' &&
    state.pendingHubBoard?.participants.length === context.prepared.hubTargetByOrigin.size
      ? flushPendingHubBoard(context, state)
      : { state, emissions: [] };
  const current = flushed.state;
  const batch = current.batchTargetGeneration;
  const targetGeneration =
    event.origin.kind === 'target' && batch?.parentKey === semanticAddressKey(event.parentOrigin)
      ? batch.frontier
      : undefined;
  const transition = applyTargetGenerationCompletedTransition(event, targetGeneration);
  let branches = advanceRewardBranches(current.branches, event.sequence);
  // The game rebuilds its offered-reward set once, when the whole batch
  // has rooms and its exits unlock. The completed batch's own generated
  // offers are that set, so nothing reconstructs the rule here: the last
  // generated target simply publishes the peers this batch produced.
  //
  // Only ordinary exit batches publish. Hub slot and local visit slot
  // generations, the hub handoff batch and declaration-fixed room links
  // are deliberately excluded: the hub board has its own run-persistent
  // lookup with a different lifetime, and a fixed link reaches its target
  // without an offered door batch. Extra exits (Chaos gate, Zagreus
  // contract) are created at the parent's entry, so their offers are
  // already flushed from `peers` by this batch's outgoing checkpoint;
  // the game does count those doors, which is a recorded fidelity gap
  // rather than a behavior difference, since no such room offers a type
  // any inventory entry currently consults.
  if (
    event.origin.kind === 'target' &&
    targetGeneration !== undefined &&
    transition.nextTargetHistory === undefined &&
    targetGeneration.exitKeys.at(-1) === event.origin.exitKey
  ) {
    // Normalized once for the whole cohort: every branch of one batch
    // shares the same offered set and therefore the same frozen array.
    const offeredRewardTypes = normalizeOfferedRewardTypes(
      current.peers.map((peer) => peer.offer.rewardType),
    );
    branches = Object.freeze(
      branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: publishOfferedRewardTypes(branch.state, offeredRewardTypes),
        }),
      ),
    );
  }
  return {
    leadingEmissions: flushed.emissions,
    ...(transition.nextTargetHistory === undefined
      ? {}
      : {
          targetHistoryCheckpoint: {
            origin: transition.nextTargetHistory,
            historySequence: event.sequence,
            branches: current.branches,
          },
        }),
    state: withBranches(current, branches),
    emissions: [],
  };
};

const outgoingGenerationCheckpoint: ChronologySeamHandler<'outgoingGenerationCheckpoint'> = (
  context,
  state,
  event,
) => {
  const { prepared, snapshot } = context;
  const ownerKey = semanticAddressKey(event.origin);
  const source = prepared.rooms.get(ownerKey);
  const frontierOwner =
    context.frontierSource === ownerKey &&
    snapshot.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'exitDecision'
      ? snapshot.frontier.origin
      : undefined;
  const transition = applyOutgoingGenerationTransition({
    catalog: context.catalog,
    snapshot,
    event,
    layout: prepared.layout,
    source,
    sourceViews: prepared.views.get(ownerKey),
    declaration:
      source === undefined
        ? undefined
        : routeRoomDeclaration(
            context.catalog.rooms.byKey[source.gameName],
            source.origin.routeKey,
          ),
    batch: prepared.batchesByParent.get(ownerKey),
    hubDecisionOwner: context.hubDecisionOwnerBySource.get(ownerKey),
    frontierOwner,
    emptyOutgoing: prepared.lifecycle.emptyOutgoingOwnerKeys.has(ownerKey),
    hubTakeover: context.hubTakeoverSources.has(ownerKey),
    hubRestoring: context.hubRestoringSources.has(ownerKey),
    branches: state.branches,
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
  });
  const checkpoint = transition.runStateCheckpoint;
  const generation = transition.targetGeneration;
  return {
    leadingEmissions: transition.siteSettlements.flatMap((settlement) =>
      siteSettlementEmissions(settlement, source?.origin ?? event.origin),
    ),
    ...(checkpoint === undefined
      ? {}
      : {
          runStateCheckpoint: {
            against: 'received' as const,
            owner: checkpoint.owner,
            room: checkpoint.source,
            view: checkpoint.view,
            branches: checkpoint.branches,
          },
        }),
    ...(transition.targetHistoryCheckpoint === undefined
      ? {}
      : { targetHistoryCheckpoint: transition.targetHistoryCheckpoint }),
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      peers: transition.peers,
      batchTargetGeneration: generation,
      expectedStores: new Map(
        transition.expectedStores.map((entry) => [entry.targetKey, entry.storeKey] as const),
      ),
    }),
    emissions: [
      { kind: 'storeSupport', entries: transition.storeSupportEntries },
      generationFindings(transition.findings),
    ],
  };
};

/** Room entry captures its Run State after its own features; a pending Shrine delivery halts here. */
const roomEntered: ChronologySeamHandler<'roomEntered'> = (context, state, event) => {
  const room = authoredRoom(context, event.origin);
  const entered = applyRoomEnteredTransition(
    context.catalog,
    event,
    room,
    context.views.get(semanticAddressKey(event.origin)),
    context.chaosGateSourceOccurrenceIds,
    context.ixionGeneratedChaosSourceOccurrenceIds,
    state.branches,
    rewardFindingChronologyForRoom(
      context.snapshot,
      event.origin as CanonicalAuthoredRoom['origin'],
      event.sequence,
      'localRoomLifecycle',
    ),
    context.routePosition,
    Object.freeze({
      hermesShrine:
        room !== undefined && state.hermesShrineAssessments.has(semanticAddressKey(room.origin)),
      stygianWell:
        room !== undefined && state.stygianWellAssessments.has(semanticAddressKey(room.origin)),
    }),
  );
  const shrine = entered.hermesShrineAssessment;
  const well = entered.stygianWellAssessment;
  const checkpoint = entered.runStateCheckpoint;
  if (checkpoint !== undefined && checkpoint.view === undefined)
    throw new BiomeRewardSimulationContractError(
      `${checkpoint.room.gameName} has no room-entry Run State view`,
    );
  return {
    leadingEmissions: [
      lifecycleFindings(entered.findings),
      { kind: 'generatedPickupPlacements', placements: entered.generatedPickupPlacements },
      {
        kind: 'derivedAcquisitionEntryFrontiers',
        frontiers: entered.derivedAcquisitionEntryFrontiers,
      },
      { kind: 'fixedAcquisitionRealizations', realizations: entered.fixedAcquisitionRealizations },
    ],
    state: Object.freeze({
      ...state,
      branches: entered.branches,
      halted: entered.hermesShrineDeliveryPlacementRequired,
      hermesShrineAssessments:
        shrine === undefined
          ? state.hermesShrineAssessments
          : new Map(state.hermesShrineAssessments).set(semanticAddressKey(shrine.origin), shrine),
      stygianWellAssessments:
        well === undefined
          ? state.stygianWellAssessments
          : new Map(state.stygianWellAssessments).set(semanticAddressKey(well.origin), well),
    }),
    ...(checkpoint?.view === undefined
      ? {}
      : {
          runStateCheckpoint: {
            against: 'next' as const,
            owner: checkpoint.owner,
            room: checkpoint.room,
            view: checkpoint.view,
          },
        }),
    emissions: [],
  };
};

const roomPrepared: ChronologySeamHandler<'roomPrepared'> = (context, state, event) => {
  const transition = applyRoomPreparedTransition(
    context.catalog,
    context.snapshot,
    event,
    authoredRoom(context, event.origin),
    state.branches,
  );
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      overviewCohort: Object.freeze({
        roomKey: semanticAddressKey(event.origin),
        branches: transition.branches,
      }),
    }),
    emissions: [lifecycleFindings(transition.findings)],
  };
};

const fountainUsed: ChronologySeamHandler<'fountainUsed'> = (context, state, event) => {
  const room = authoredRoom(context, event.origin);
  const owner = event.owner;
  const transition = applyFountainUsedTransition(
    context.catalog,
    event,
    owner.kind === 'hubFountain'
      ? context.snapshot.decisions.find(
          (decision): decision is CanonicalHubDecision =>
            decision.kind === 'hub' && decision.origin.hubKey === owner.hubKey,
        )?.fountain?.fountainRarityResult
      : room?.fountainRarityResult,
    state.branches,
    room,
  );
  const pool = transition.purgingPoolAssessment;
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      purgingPoolAssessments:
        pool === undefined
          ? state.purgingPoolAssessments
          : withKeyed(state.purgingPoolAssessments, pool.key, pool.value),
    }),
    emissions: [
      { kind: 'timelineFacts', facts: transition.timelineFacts },
      ...(transition.candidate === undefined
        ? []
        : [
            {
              kind: 'fountainRarityCandidate' as const,
              key: transition.candidate.key,
              candidate: transition.candidate.value,
            },
          ]),
      lifecycleFindings(transition.findings),
    ],
  };
};

const offerPointMaterialized: ChronologySeamHandler<'offerPointMaterialized'> = (
  context,
  state,
  event,
) => {
  const roomKey = semanticAddressKey(event.origin);
  const transition = applyOfferPointMaterializedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    rooms: context.rooms,
    views: context.views,
    lifecycle: context.prepared.lifecycle,
    branches: state.branches,
    routeLoadout: context.routeLoadout,
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
    shipLifecycleCandidateAlreadyPublished: state.shipLifecycleContexts.has(roomKey),
  });
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      shipLifecycleContexts:
        transition.shipLifecycleCandidate === undefined
          ? state.shipLifecycleContexts
          : withKeyed(state.shipLifecycleContexts, roomKey, transition.shipLifecycleCandidate),
    }),
    emissions: [
      generationFindings(transition.findings),
      { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
      {
        kind: 'fixedAcquisitionRealizations',
        realizations: transition.fixedAcquisitionRealizations,
      },
    ],
  };
};

/** A reached offer point and an advanced producer role settle through the same transition. */
const reachedOfferSettled: ChronologySeamHandler<'offerPointAcquired' | 'producerRoleAdvanced'> = (
  context,
  state,
  event,
) => {
  const settlement = applyReachedOfferSettlement({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    rooms: context.rooms,
    views: context.views,
    branches: state.branches,
    priorFindings: context.accumulated.findingEntries(),
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
  });
  return {
    state: withBranches(state, settlement.branches),
    emissions: [
      settledFindings(settlement.findings),
      { kind: 'acquisitionRoleFrontiers', frontiers: settlement.roleFrontiers },
      {
        kind: 'traitChildSettlements',
        checkpoints: settlement.traitChildSettlements,
        occurrenceOwner: settlement.traitChildOccurrenceOwner,
      },
    ],
  };
};

/** Events with no reward seam only advance the branch cohort to their sequence. */
const advanceOnly: ChronologySeamHandler<HistoryEvent['kind']> = (_context, state, event) => ({
  state: withBranches(state, advanceRewardBranches(state.branches, event.sequence)),
  emissions: [],
});

type PostStepHook<K extends HistoryEvent['kind']> = (
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: SeamEvent<K>,
) => readonly ChronologyEmission[];

/**
 * A second dispatch after the seam: a Hub exit or a visit's return records a
 * departure, and a later fountain use replaces it.
 */
function hubDeparture(
  replace: boolean,
): PostStepHook<'roomExited' | 'roomRestored' | 'fountainUsed'> {
  return (context, state, event) =>
    event.origin?.kind === 'hubRoom' &&
    (event.kind !== 'roomRestored' || event.restoreKind === 'hub')
      ? hubDepartureEmissions(context, state, event.origin, event.sequence, replace)
      : [];
}

/** A seam's handler and its optional post-step hook for events of kind `K`. */
interface ChronologySeam<K extends HistoryEvent['kind']> {
  step(
    context: ChronologyWalkContext,
    state: ChronologyWalkState,
    event: SeamEvent<K>,
  ): ChronologySeamStep;
  afterStep?(
    context: ChronologyWalkContext,
    state: ChronologyWalkState,
    event: SeamEvent<K>,
  ): readonly ChronologyEmission[];
}

/** Every history event kind and the seam that applies it. */
const chronologySeamTable: { readonly [K in HistoryEvent['kind']]: ChronologySeam<K> } =
  Object.freeze({
    biomeStarted: { step: advanceOnly },
    biomeCompleted: { step: advanceOnly },
    biomeCounterReset: { step: advanceOnly },
    roomCreated: { step: roomCreated },
    fieldsBatchOutcomeRecorded: { step: advanceOnly },
    clockworkBatchStateRecorded: { step: advanceOnly },
    clockworkGoalAcquired: { step: advanceOnly },
    clockworkNonGoalRewardSpawned: { step: advanceOnly },
    targetGenerationCompleted: { step: targetGenerationCompleted },
    emptyOutgoingGenerationCompleted: { step: advanceOnly },
    roomRestored: { step: advanceOnly, afterStep: hubDeparture(false) },
    roomPrepared: { step: roomPrepared },
    offerPointMaterialized: { step: offerPointMaterialized },
    offerPointAcquired: { step: reachedOfferSettled },
    roomEntered: { step: roomEntered },
    fountainUsed: { step: fountainUsed, afterStep: hubDeparture(true) },
    keepsakeRackUsed: { step: keepsakeRackUsed },
    erisInteracted: { step: erisInteracted },
    requiredObjectSpawned: { step: advanceOnly },
    encounterRecorded: { step: advanceOnly },
    encounterStarted: { step: encounterStarted },
    encounterDepthAdvanced: { step: advanceOnly },
    encounterCompleted: { step: encounterSettled },
    encounterEndEffectsApplied: { step: encounterEndEffectsApplied },
    bossDefeated: { step: encounterSettled },
    encounterInteractionReached: { step: encounterSettled },
    requiredObjectCompleted: { step: advanceOnly },
    producerPointReached: { step: advanceOnly },
    producerRoleAdvanced: { step: reachedOfferSettled },
    outgoingGenerationCheckpoint: { step: outgoingGenerationCheckpoint },
    hermesShrineDeliveriesScheduled: { step: hermesShrineDeliveriesScheduled },
    acquisitionPointReached: { step: acquisitionPointReached },
    wellPurchase: { step: wellPurchase },
    roomCommitted: { step: advanceOnly },
    roomCountersAdvanced: { step: advanceOnly },
    enteredRewardStoreRecorded: { step: advanceOnly },
    roomExited: { step: roomExited, afterStep: hubDeparture(false) },
  });

/** Brings every branch to the reached history view at this sequence. */
function reachHistorySequence(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  sequence: number,
): ChronologyWalkState {
  const view = context.history.viewsBySequence[sequence];
  if (view === undefined) {
    throw new BiomeRewardSimulationContractError(`No history view for event ${sequence}`);
  }
  return withBranches(
    state,
    Object.freeze(
      state.branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: reachSimulationHistory(branch.state, context.routePosition, view),
        }),
      ),
    ),
  );
}

/** Applies one seam step in its fixed order. */
export function applySeamStep(
  context: ChronologyWalkContext,
  accumulator: ChronologyAccumulator,
  received: ChronologyWalkState,
  step: ChronologySeamStep,
): ChronologyWalkState {
  if (step.leadingEmissions !== undefined) accumulator.mergeEmissions(step.leadingEmissions);
  const checkpoint = step.runStateCheckpoint;
  if (checkpoint?.against === 'received')
    captureRunState(context, received, accumulator, checkpoint);
  const target = step.targetHistoryCheckpoint;
  if (target !== undefined)
    accumulator.mergeEmissions(
      targetSlotHistory(context, target.origin, target.historySequence, target.branches),
    );
  if (checkpoint?.against === 'next') captureRunState(context, step.state, accumulator, checkpoint);
  accumulator.mergeEmissions(step.emissions);
  return step.state;
}

/**
 * Applies one history event: its seam, then (unless the seam halted the walk)
 * the post-step hook, and finally reaches the event's history view.
 */
export function walkHistoryEvent(
  context: ChronologyWalkContext,
  accumulator: ChronologyAccumulator,
  state: ChronologyWalkState,
  event: HistoryEvent,
): ChronologyWalkState {
  // The table pairs each kind with its own handler; the union call is sound.
  const entry = chronologySeamTable[event.kind] as ChronologySeam<HistoryEvent['kind']>;
  const next = applySeamStep(context, accumulator, state, entry.step(context, state, event));
  if (!next.halted && entry.afterStep !== undefined)
    accumulator.mergeEmissions(entry.afterStep(context, next, event));
  return reachHistorySequence(context, next, event.sequence);
}
