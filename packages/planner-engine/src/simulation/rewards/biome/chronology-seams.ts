import {
  createAcquisitionEntryAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createRoomRunStateCheckpointAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import { resolveCompletionBoss } from '../../../authored-project/completion-boss';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import { encounterEntryVowRanks } from '../../arcana-fear';
import { roomActionKey } from '../../../authored-project/room-actions/key';
import type { HistoryEvent } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubDecision } from '../../materialization';
import { forGeneration } from '../../materialization';
import { resourcePlacementFindingRegions } from '../../resources';
import { addHubBoardRewardLookup, replaceHubBoardRewardLookup } from '../../state/reward-lookups';
import {
  normalizeOfferedRewardTypes,
  publishOfferedRewardTypes,
} from '../../state/offered-rewards';
import { reachSimulationHistory } from '../../state/transitions';
import { attestDerivedAcquisitionEntryCandidateCapability } from '../acquisition/artifacts';
import { advanceRewardBranch } from '../branch-lifecycle';
import type { RewardBranchState } from '../branch-primitives';
import type { MidBiomeStartPoint } from '../model';
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
  rerollFlagKey,
  withBranch,
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
import { applyHermesShrinePurchaseReachedTransition } from './encounter-acquisition/hermes-shrine-purchase';
import { applyWellPurchaseTransition } from './encounter-acquisition/well-purchase';
import { withPoolSaleGold } from './gold-event-seams';
import {
  withAcquisitionPointPrice,
  withHermesShrinePurchasePrice,
  withWellPurchasePrice,
} from './purchase-price-seams';
import { rewardFindingChronologyForRoom } from './finding-chronology';
import { flushHubBoard } from './generation/hub-board';
import { applyOutgoingGenerationTransition } from './generation/outgoing-generation';
import { applyPhantomExitTransition } from './generation/phantom-exit';
import { applyRoomCreatedTransition } from './generation/room-created';
import { applyTargetGenerationCompletedTransition } from './generation/target-generation-completed';
import { applyEncounterEndEffectsTransition } from './lifecycle-transitions/encounter-end-effects';
import { applyEncounterStartedTransition } from './lifecycle-transitions/encounter-started';
import { applyErisInteractedTransition } from './lifecycle-transitions/eris-interacted';
import { applyFountainUsedTransition } from './lifecycle-transitions/fountain-used';
import { applyKeepsakeRackUsedTransition } from './lifecycle-transitions/keepsake-rack-used';
import { applyRoomDepartedTransition } from './lifecycle-transitions/room-departed';
import { applyRoomEnteredTransition } from './lifecycle-transitions/room-entered';
import { applyRoomExitedTransition } from './lifecycle-transitions/room-exited';
import { applyRoomPreparedTransition } from './lifecycle-transitions/room-prepared';
import {
  applyRewardRerolledTransition,
  hubTargetContext,
  reachedRerollPool,
  roomTargetContext,
} from './lifecycle-transitions/reward-rerolled';
import { captureRerollSurfaces } from './reroll-surfaces';
import { captureRoomActionEnd } from './object-interaction-seams';
import { featureRerolled, purgingPoolSale, wellPurchaseRoll } from './feature-roll-seams';
import { parsePurgingPoolSalePoint } from '../../commerce/feature-rolls';
import { historyFindingChronology } from './finding-chronology';
import { applyOfferPointMaterializedTransition } from './offer-lifecycle/offer-point-materialized';
import { applyReachedOfferSettlement } from './offer-lifecycle/reached-settlement';
import { spawnInfernalContractPedestal } from './offer-lifecycle/infernal-contract-pedestal';
import { createBiomeRewardFacts } from '../facts';
import { rerollKindEnabled } from '../../arcana-fear';

/** Records whether the state holds a door-reroll card as doors, wheels or the board are flagged. */
function flagRerolls(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  key: string,
): ChronologyWalkState['rerollsFlagged'] {
  const enabled =
    state.branch !== undefined &&
    rerollKindEnabled(context.catalog, state.branch.state.arcanaFear, 'doors');
  return withKeyed(state.rerollsFlagged, key, enabled);
}

function advanceReached(
  branch: RewardBranchState | undefined,
  historySequence: number,
): RewardBranchState | undefined {
  return branch === undefined ? undefined : advanceRewardBranch(branch, historySequence);
}

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
    state.branch,
  );
  return { state: withBranch(state, transition.branch), emissions: [] };
};

/** One door, cage or wheel reroll press at its authored rank. */
const rewardRerolled: ChronologySeamHandler<'rewardRerolled'> = (context, state, event) => {
  const source = authoredRoom(context, event.origin);
  const ownerKey = semanticAddressKey(event.owner);
  const reroll = source?.roomActionRoster.rows.find(
    (row) => semanticAddressKey(row.owner) === ownerKey,
  )?.reference;
  if (source === undefined || reroll?.kind !== 'reroll')
    throw new BiomeRewardSimulationContractError(`${ownerKey} reached without its reroll`);
  const transition = applyRewardRerolledTransition({
    catalog: context.catalog,
    owner: event.owner,
    reward: reroll.reward,
    target: roomTargetContext(
      context.catalog,
      source,
      context.prepared.batchesByParent.get(semanticAddressKey(source.origin)),
      reroll.target,
      state.peers,
    ),
    flagged:
      state.rerollsFlagged.get(
        rerollFlagKey(
          semanticAddressKey(source.origin),
          reroll.target.kind === 'wheelOffer' ? reroll.target.wheelKey : undefined,
        ),
      ) === true,
    historySequence: event.sequence,
    view: context.history.viewsBySequence[event.sequence - 1],
    branch: state.branch,
    rerolledOffers: state.rerolledOffers,
  });
  return {
    state: Object.freeze({
      ...state,
      branch: transition.branch,
      rerolledOffers: transition.rerolledOffers,
    }),
    emissions: [
      generationFindings(transition.findings),
      { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
      ...(transition.settlement === undefined
        ? []
        : [{ kind: 'rerollSettlement' as const, settlement: transition.settlement }]),
    ],
  };
};

/**
 * One Hub board reroll in the stay it is authored in. Its slot must still be
 * open; the press redraws against the board as that stay assigned it.
 */
const hubRewardRerolled: ChronologySeamHandler<'hubRewardRerolled'> = (context, state, event) => {
  const ownerKey = semanticAddressKey(event.owner);
  const hub = context.snapshot.decisions.find(
    (decision): decision is CanonicalHubDecision =>
      decision.kind === 'hub' && decision.origin.hubKey === event.owner.hubKey,
  );
  const reroll = hub?.rerolls.find(
    (candidate) => semanticAddressKey(candidate.origin) === ownerKey,
  );
  if (hub === undefined || reroll === undefined || state.hubStay === undefined)
    throw new BiomeRewardSimulationContractError(`${ownerKey} reached without its Hub reroll`);
  const transition = applyRewardRerolledTransition({
    catalog: context.catalog,
    owner: event.owner,
    reward: reroll.reward,
    target: hubTargetContext(
      context.catalog,
      hub,
      reroll.hubSlotKey,
      reroll.precedingVisitCount,
      state.hubStay.assigned,
    ),
    ...(reroll.slotEntered ? { refused: 'slotEntered' as const } : {}),
    flagged: state.rerollsFlagged.get(rerollFlagKey(semanticAddressKey(hub.origin))) === true,
    historySequence: event.sequence,
    view: context.history.viewsBySequence[event.sequence - 1],
    chronology: Object.freeze({
      kind: 'hubBoard' as const,
      history: historyFindingChronology(event.sequence),
    }),
    branch: state.branch,
    rerolledOffers: state.rerolledOffers,
  });
  const { progression } = context.prepared.layout;
  const boardTypes = hub.board.targets.flatMap((target) => {
    const incoming = target.room.incomingReward;
    return incoming === undefined
      ? []
      : [
          (
            transition.rerolledOffers.get(semanticAddressKey(incoming.origin)) ??
            forGeneration(incoming).offer
          ).rewardType,
        ];
  });
  // Leaving the Hub adds its offered rewards to the lookup and never removes
  // one, so only a press before the first departure replaces a first draw.
  const updateLookup =
    reroll.precedingVisitCount === 0 ? replaceHubBoardRewardLookup : addHubBoardRewardLookup;
  const settled = transition.branch;
  const branch =
    progression.kind !== 'hub' ||
    transition.settlement?.poolRemainingAfter === undefined ||
    settled === undefined
      ? settled
      : Object.freeze({
          ...settled,
          state: updateLookup(settled.state, progression.rewardLookup.key, boardTypes),
        });
  return {
    state: Object.freeze({ ...state, branch, rerolledOffers: transition.rerolledOffers }),
    emissions: [
      generationFindings(transition.findings),
      { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
      ...(transition.settlement === undefined
        ? []
        : [{ kind: 'rerollSettlement' as const, settlement: transition.settlement }]),
    ],
  };
};

/** A restored Hub re-assigns its open board doors, flagging them again (AssignRoomToExitDoor). */
const roomRestored: ChronologySeamHandler<'roomRestored'> = (context, state, event) => {
  const advanced = withBranch(state, advanceReached(state.branch, event.sequence));
  if (event.restoreKind !== 'hub') return { state: advanced, emissions: [] };
  const hub = context.snapshot.decisions.find((decision) => decision.kind === 'hub');
  if (event.after.kind !== 'hubVisit')
    throw new BiomeRewardSimulationContractError('a Hub restore follows no Hub visit');
  const { visitIndex } = event.after;
  return {
    state:
      hub === undefined
        ? advanced
        : Object.freeze({
            ...advanced,
            rerollsFlagged: flagRerolls(
              context,
              advanced,
              rerollFlagKey(semanticAddressKey(hub.origin)),
            ),
            // The restore re-assigns each open door its persisted offer.
            hubStay: Object.freeze({
              precedingVisitCount: visitIndex,
              assigned: advanced.rerolledOffers,
            }),
          }),
    emissions: [],
  };
};

const keepsakeRackUsed: ChronologySeamHandler<'keepsakeRackUsed'> = (context, state, event) => {
  const transition = applyKeepsakeRackUsedTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    context.views.get(semanticAddressKey(event.origin))?.entry,
    context.routeLoadout,
    state.branch,
    context.enteredBiomeCount + 1,
  );
  return {
    state: withBranch(state, transition.branch),
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
    state.branch,
  );
  return {
    state: withBranch(state, exited.branch),
    emissions: [],
    ...(exited.runStateCheckpoint === undefined
      ? {}
      : { runStateCheckpoint: { ...exited.runStateCheckpoint, against: 'received' as const } }),
  };
};

/** Native LeaveRoom: a Hub departure captures its Run State before the clocks advance. */
const roomDeparted: ChronologySeamHandler<'roomDeparted'> = (context, state, event) => ({
  ...(event.origin.kind === 'hubRoom'
    ? { leadingEmissions: hubDepartureEmissions(context, state, event.origin, event.sequence) }
    : {}),
  state: Object.freeze({
    ...withBranch(state, applyRoomDepartedTransition(context.catalog, event, state.branch)),
    ...(event.origin.kind === 'hubRoom' ? { hubStay: undefined } : {}),
  }),
  emissions: [],
});

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
    state.branch,
  );
  return {
    state: Object.freeze({
      ...state,
      branch: transition.branch,
      halted: transition.hermesShrineDeliveryPlacementRequired,
    }),
    emissions: [
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

const wellPurchase: ChronologySeamHandler<'wellPurchase'> = (context, received, event) => {
  const state = withWellPurchasePrice(context, received, event);
  const wellRoom = context.rooms.get(semanticAddressKey(event.origin));
  const wellOrigin = wellRoom?.kind === 'authored' ? wellRoom.origin : undefined;
  const rolled = wellPurchaseRoll(context, state, event);
  const transition = applyWellPurchaseTransition({
    roll: rolled.roll,
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room: wellRoom,
    branch: state.branch,
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
  const existingWell = stygianWellAssessments.get(semanticAddressKey(event.origin));
  if (transition.candidateContext !== undefined && wellRoom?.kind === 'authored') {
    if (existingWell === undefined)
      throw new BiomeRewardSimulationContractError(
        `${wellRoom.gameName} has a Well purchase before its entry`,
      );
    stygianWellAssessments = new Map(stygianWellAssessments).set(
      semanticAddressKey(event.origin),
      Object.freeze({
        ...existingWell,
        actions: Object.freeze([...existingWell.actions, transition.candidateContext]),
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
      branch: transition.branch,
      stygianWellAssessments,
      wellRefillRealizations,
      featureRolls: rolled.featureRolls,
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
    sourceBranch: state.branch,
    authoredSeaStarDuplicateSiteKeys: Object.freeze([...context.authoredSeaStarDuplicateSiteKeys]),
  });
  return {
    state: withBranch(state, transition.branch),
    emissions: acquisitionEmissions(transition, room),
  };
};

const hermesShrinePurchaseReached: ChronologySeamHandler<'hermesShrinePurchaseReached'> = (
  context,
  received,
  event,
) => {
  const state = withHermesShrinePurchasePrice(context, received, event);
  const room = authoredRoom(context, event.origin);
  const key = semanticAddressKey(event.origin);
  const transition = applyHermesShrinePurchaseReachedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room,
    declaration: roomDeclaration(context, room),
    roomView: context.views.get(key),
    branch: state.branch,
    realized: state.hermesShrineTravelDealRefills.get(key),
  });
  const refills = transition.travelDealRefill;
  return {
    state:
      refills === undefined
        ? withBranch(state, transition.branch)
        : Object.freeze({
            ...state,
            branch: transition.branch,
            hermesShrineTravelDealRefills: withKeyed(
              state.hermesShrineTravelDealRefills,
              key,
              refills,
            ),
          }),
    emissions: [
      settledFindings(transition.findings),
      { kind: 'timelineFacts', facts: transition.timelineFacts },
    ],
  };
};

const acquisitionPointReached: ChronologySeamHandler<'acquisitionPointReached'> = (
  context,
  received,
  event,
) => {
  const state = withAcquisitionPointPrice(context, received, event);
  const room = authoredRoom(context, event.origin);
  const emissions: ChronologyEmission[] = [];
  const sale = room === undefined ? undefined : parsePurgingPoolSalePoint(event.point);
  if (room !== undefined && sale !== undefined) {
    const poolRow = room.roomActionRoster.rows.find(
      (row) => !row.stale && row.rank !== null && row.key === roomActionKey(sale),
    );
    if (poolRow !== undefined)
      emissions.push({
        kind: 'timelineFacts',
        facts: { nodes: [{ owner: poolRow.owner, included: true }] },
      });
    const settled = purgingPoolSale(context, state, event, sale);
    emissions.push(settledFindings(settled.findings));
    const transition = applyAcquisitionPointReachedTransition({
      catalog: context.catalog,
      snapshot: context.snapshot,
      event,
      room,
      declaration: roomDeclaration(context, room),
      roomView: context.views.get(semanticAddressKey(event.origin)),
      sourceBranch: state.branch,
      authoredSeaStarDuplicateSiteKeys: Object.freeze([
        ...context.authoredSeaStarDuplicateSiteKeys,
      ]),
      ...(settled.sold === undefined ? {} : { purgingPoolSale: settled.sold }),
    });
    emissions.push(...acquisitionEmissions(transition, room));
    const sold =
      settled.sold === undefined ? state : withPoolSaleGold(context, state, event, settled.sold);
    return {
      state: Object.freeze({
        ...sold,
        branch: transition.branch,
        featureRolls: settled.featureRolls,
      }),
      emissions,
    };
  }
  const derivedSite =
    event.siteKey === undefined || room === undefined
      ? undefined
      : room.acquisitionSites[event.siteKey]?.address;
  const derivedFrontier =
    derivedSite === undefined || event.entryKey === undefined
      ? undefined
      : context.accumulated.derivedAcquisitionEntryFrontier(
          semanticAddressKey(createAcquisitionEntryAddress(derivedSite, event.entryKey)),
        );
  const derivedCapability = attestDerivedAcquisitionEntryCandidateCapability(derivedFrontier);
  const transition = applyAcquisitionPointReachedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room,
    declaration: roomDeclaration(context, room),
    roomView: context.views.get(semanticAddressKey(event.origin)),
    sourceBranch: state.branch,
    authoredSeaStarDuplicateSiteKeys: Object.freeze([...context.authoredSeaStarDuplicateSiteKeys]),
    ...(derivedFrontier === undefined ? {} : { derivedAcquisitionEntryFrontier: derivedFrontier }),
    ...(derivedCapability === undefined
      ? {}
      : { derivedAcquisitionEntryCapability: derivedCapability }),
  });
  emissions.push(...acquisitionEmissions(transition, room));
  if (transition.authoredSiteSettlement !== undefined && room !== undefined)
    emissions.push(...siteSettlementEmissions(transition.authoredSiteSettlement, room.origin));
  return {
    state: withBranch(state, transition.branch),
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
    state.branch,
  );
  const gorgon = applyGorgonStartedTransition({
    catalog: context.catalog,
    event,
    room,
    view:
      sourceRoom === undefined
        ? undefined
        : context.views.get(semanticAddressKey(sourceRoom.origin)),
    branch: figLeaf.branch,
    evaluationBlocked: state.gorgonEvaluationBlocked,
  });
  return {
    state: Object.freeze({
      ...state,
      branch: gorgon.branch,
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
    branch: state.branch,
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
      branch: transition.branch,
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
    branch: state.branch,
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
      branch: transition.branch,
      peers: transition.peers,
      pendingHubBoard: transition.pendingHubBoard,
    }),
    emissions: [
      generationFindings(transition.findings),
      { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
    ],
  };
};

/**
 * A main room's phantom draw precedes its side doors in the same unlock, so it
 * joins their prior offers; a side room has no other door.
 */
const phantomExitCreated: ChronologySeamHandler<'phantomExitCreated'> = (context, state, event) => {
  const room = authoredRoom(context, event.origin);
  const transition = applyPhantomExitTransition({
    catalog: context.catalog,
    event,
    room,
    view: context.history.viewsBySequence[event.sequence - 1],
    branch: state.branch,
  });
  const opensSideDoors =
    room !== undefined &&
    context.catalog.rooms.byKey[room.gameName]?.phantomExit?.placeholderRoomSetKey === 'N';
  return {
    state: Object.freeze({
      ...state,
      branch: transition.branch,
      peers: opensSideDoors ? transition.peers : state.peers,
    }),
    emissions: [
      generationFindings(transition.findings),
      { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
      { kind: 'phantomExitSettlement', settlement: transition.settlement },
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
  const settled = flushed.branch;
  const branch =
    progression.kind === 'hub' &&
    pendingHubBoard !== undefined &&
    flushed.peers.length === pendingHubBoard.participants.length &&
    settled !== undefined
      ? Object.freeze({
          ...settled,
          state: addHubBoardRewardLookup(
            settled.state,
            progression.rewardLookup.key,
            flushed.peers.map((peer) => peer.offer.rewardType),
          ),
        })
      : settled;
  const hub = context.snapshot.decisions.find((decision) => decision.kind === 'hub');
  return {
    state: Object.freeze({
      ...state,
      branch,
      peers: flushed.peers,
      pendingHubBoard: undefined,
      rerollsFlagged:
        hub === undefined
          ? state.rerollsFlagged
          : flagRerolls(context, state, rerollFlagKey(semanticAddressKey(hub.origin))),
      // The first stay assigns the first draws.
      hubStay:
        hub === undefined
          ? state.hubStay
          : Object.freeze({ precedingVisitCount: 0, assigned: new Map() }),
    }),
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
  let branch = advanceReached(current.branch, event.sequence);
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
    if (branch !== undefined)
      branch = Object.freeze({
        ...branch,
        state: publishOfferedRewardTypes(branch.state, offeredRewardTypes),
      });
  }
  return {
    leadingEmissions: flushed.emissions,
    ...(transition.nextTargetHistory === undefined
      ? {}
      : {
          targetHistoryCheckpoint: {
            origin: transition.nextTargetHistory,
            historySequence: event.sequence,
            branch: current.branch,
          },
        }),
    state: withBranch(current, branch),
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
    branch: state.branch,
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
          },
        }),
    ...(transition.targetHistoryCheckpoint === undefined
      ? {}
      : { targetHistoryCheckpoint: transition.targetHistoryCheckpoint }),
    state: Object.freeze({
      ...state,
      branch: transition.branch,
      peers: transition.peers,
      // AssignRoomToExitDoor flags each door as the doors unlock.
      rerollsFlagged: flagRerolls(context, state, ownerKey),
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
  const roomView = context.views.get(semanticAddressKey(event.origin));
  const findingChronology = rewardFindingChronologyForRoom(
    context.snapshot,
    event.origin as CanonicalAuthoredRoom['origin'],
    event.sequence,
    'localRoomLifecycle',
  );
  // The room's start events spawn the pedestal before entry clears the map's offers.
  const pedestalDeclaration =
    room === undefined ? undefined : context.catalog.rooms.byKey[room.gameName];
  const pedestal = spawnInfernalContractPedestal({
    catalog: context.catalog,
    historySequence: event.sequence,
    room,
    declaration: pedestalDeclaration,
    branch: state.branch,
    facts: (branchState, shopNames) => {
      if (room === undefined || pedestalDeclaration === undefined || roomView === undefined)
        throw new BiomeRewardSimulationContractError('pedestal spawn has no authored room');
      return createBiomeRewardFacts({
        catalog: context.catalog,
        state: branchState,
        source: room,
        currentRoom: room,
        sourceDeclaration: pedestalDeclaration,
        view: roomView.preparation,
        currentRoomShopOptionNames: shopNames ?? new Set(),
        hubBoardLookups: 'consulted',
      });
    },
    findingChronology,
  });
  // An unauthored or impossible pedestal item blocks the Overview before entry.
  if (pedestal.branch === undefined && state.branch !== undefined)
    return {
      leadingEmissions: [
        generationFindings(pedestal.findings),
        { kind: 'producerFrontiers', frontiers: pedestal.producerFrontiers },
      ],
      state: withBranch(state, pedestal.branch),
      emissions: [],
    };
  const entered = applyRoomEnteredTransition(
    context.catalog,
    event,
    room,
    roomView,
    context.chaosGateSourceOccurrenceIds,
    context.ixionGeneratedChaosSourceOccurrenceIds,
    pedestal.branch,
    findingChronology,
    context.routePosition,
    Object.freeze({
      hermesShrine:
        room !== undefined && state.hermesShrineAssessments.has(semanticAddressKey(room.origin)),
      stygianWell:
        room !== undefined && state.stygianWellAssessments.has(semanticAddressKey(room.origin)),
    }),
  );
  const enteredBranch = entered.branch;
  const shrine = entered.hermesShrineAssessment;
  const well = entered.stygianWellAssessment;
  const checkpoint = entered.runStateCheckpoint;
  if (checkpoint !== undefined && checkpoint.view === undefined)
    throw new BiomeRewardSimulationContractError(
      `${checkpoint.room.gameName} has no room-entry Run State view`,
    );
  return {
    leadingEmissions: [
      mergedFindings(resourcePlacementFindingRegions(event, context.resourceFindings)),
      generationFindings(pedestal.findings),
      { kind: 'producerFrontiers', frontiers: pedestal.producerFrontiers },
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
      branch: enteredBranch,
      halted: entered.hermesShrineDeliveryPlacementRequired,
      encounterEntryVowRanks:
        room === undefined || enteredBranch === undefined
          ? state.encounterEntryVowRanks
          : new Map(state.encounterEntryVowRanks).set(
              semanticAddressKey(event.origin),
              encounterEntryVowRanks(enteredBranch.state),
            ),
      hermesShrineAssessments:
        shrine === undefined
          ? state.hermesShrineAssessments
          : new Map(state.hermesShrineAssessments).set(semanticAddressKey(shrine.origin), shrine),
      stygianWellAssessments:
        well === undefined
          ? state.stygianWellAssessments
          : new Map(state.stygianWellAssessments).set(
              semanticAddressKey(well.origin),
              Object.freeze({ ...well, actions: Object.freeze([]) }),
            ),
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

/** The completion room a mid-biome start point names, when `room` is one. */
function midBiomeStartPoint(
  context: ChronologyWalkContext,
  room: CanonicalAuthoredRoom,
): MidBiomeStartPoint | undefined {
  const { catalog, routePosition } = context;
  if (room.gameName === routePosition.completion.prebossRoomGameName) return 'preboss';
  if (room.roomKind !== 'Boss') return undefined;
  const boss = resolveCompletionBoss(
    catalog,
    routePosition,
    context.routeLoadout.fearRanks.BossDifficultyShrineUpgrade ?? 0,
  );
  return room.gameName === boss.gameName ? 'boss' : undefined;
}

/**
 * A Preboss's or completion Boss's received state, after its predecessor's
 * departure and before its own preparation and entry, is a mid-biome start state.
 */
function roomStartState(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  room: CanonicalAuthoredRoom | undefined,
): readonly ChronologyEmission[] {
  if (room === undefined || state.branch === undefined) return [];
  const point = midBiomeStartPoint(context, room);
  if (point === undefined) return [];
  return [
    {
      kind: 'roomStartState',
      point,
      capture: Object.freeze({
        owner: room.origin,
        gameName: room.gameName,
        state: state.branch.state,
      }),
    },
  ];
}

const roomPrepared: ChronologySeamHandler<'roomPrepared'> = (context, state, event) => {
  const room = authoredRoom(context, event.origin);
  const transition = applyRoomPreparedTransition(
    context.catalog,
    context.snapshot,
    event,
    room,
    state.branch,
  );
  const branch = transition.branch;
  return {
    leadingEmissions: roomStartState(context, state, room),
    state: Object.freeze({
      ...state,
      branch,
      overviewCohort: Object.freeze({ roomKey: semanticAddressKey(event.origin), branch }),
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
    state.branch,
    room,
  );
  const pool = transition.purgingPoolAssessment;
  return {
    state: Object.freeze({
      ...state,
      branch: transition.branch,
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
    branch: state.branch,
    routeLoadout: context.routeLoadout,
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
    shipLifecycleCandidateAlreadyPublished: state.shipLifecycleContexts.has(roomKey),
  });
  return {
    state: Object.freeze({
      ...state,
      branch: transition.branch,
      // A ship wheel's offers are flagged rerollable as they spawn.
      rerollsFlagged: flagRerolls(context, state, rerollFlagKey(roomKey, event.offerPoint)),
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
    branch: state.branch,
    priorFindings: context.accumulated.findingEntries(),
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
  });
  return {
    state: withBranch(state, settlement.branch),
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

/** Events with no reward seam only advance the reached state to their sequence. */
const advanceOnly: ChronologySeamHandler<HistoryEvent['kind']> = (_context, state, event) => ({
  state: withBranch(state, advanceReached(state.branch, event.sequence)),
  emissions: [],
});

/** A seam's handler for events of kind `K`. */
interface ChronologySeam<K extends HistoryEvent['kind']> {
  step(
    context: ChronologyWalkContext,
    state: ChronologyWalkState,
    event: SeamEvent<K>,
  ): ChronologySeamStep;
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
    phantomExitCreated: { step: phantomExitCreated },
    roomRestored: { step: roomRestored },
    roomPrepared: { step: roomPrepared },
    offerPointMaterialized: { step: offerPointMaterialized },
    offerPointAcquired: { step: reachedOfferSettled },
    roomEntered: { step: roomEntered },
    fountainUsed: { step: fountainUsed },
    keepsakeRackUsed: { step: keepsakeRackUsed },
    erisInteracted: { step: erisInteracted },
    rewardRerolled: { step: rewardRerolled },
    hubRewardRerolled: { step: hubRewardRerolled },
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
    hermesShrinePurchaseReached: { step: hermesShrinePurchaseReached },
    acquisitionPointReached: { step: acquisitionPointReached },
    wellPurchase: { step: wellPurchase },
    featureRerolled: { step: featureRerolled },
    roomCommitted: { step: advanceOnly },
    roomCountersAdvanced: { step: advanceOnly },
    enteredRewardStoreRecorded: { step: advanceOnly },
    roomExited: { step: roomExited },
    roomDeparted: { step: roomDeparted },
  });

/** Brings the reached state to the history view at this sequence. */
function reachHistorySequence(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  sequence: number,
): ChronologyWalkState {
  const view = context.history.viewsBySequence[sequence];
  if (view === undefined) {
    throw new BiomeRewardSimulationContractError(`No history view for event ${sequence}`);
  }
  const { branch } = state;
  return branch === undefined
    ? state
    : withBranch(
        state,
        Object.freeze({
          ...branch,
          state: reachSimulationHistory(branch.state, context.routePosition, view),
        }),
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
      targetSlotHistory(context, target.origin, target.historySequence, target.branch),
    );
  if (checkpoint?.against === 'next') captureRunState(context, step.state, accumulator, checkpoint);
  accumulator.mergeEmissions(step.emissions);
  return step.state;
}

/** Applies one history event's seam, then reaches the event's history view. */
export function walkHistoryEvent(
  context: ChronologyWalkContext,
  accumulator: ChronologyAccumulator,
  state: ChronologyWalkState,
  event: HistoryEvent,
): ChronologyWalkState {
  // The table pairs each kind with its own handler; the union call is sound.
  const entry = chronologySeamTable[event.kind] as ChronologySeam<HistoryEvent['kind']>;
  const next = applySeamStep(context, accumulator, state, entry.step(context, state, event));
  const reached = captureRoomActionEnd(
    context,
    reachHistorySequence(context, next, event.sequence),
    event,
  );
  if (reached.branch !== undefined)
    accumulator.mergeEmissions([
      {
        kind: 'rerollPool',
        point: Object.freeze({
          historySequence: event.sequence,
          remaining: reachedRerollPool(reached.branch),
        }),
      },
      ...captureRerollSurfaces(context, reached, event).map((capture) => ({
        kind: 'rerollSurface' as const,
        capture,
      })),
    ]);
  return reached;
}
