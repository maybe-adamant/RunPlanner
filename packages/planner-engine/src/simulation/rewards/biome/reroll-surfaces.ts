import {
  createBiomeAddress,
  createHubDecisionAddress,
  createHubRerollAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type HubRerollAddress,
  type RoomActionAddress,
} from '../../../authored-project/addresses';
import {
  nextRerollId,
  rerollSurfaceKey,
  type RerollPressTarget,
  type RerollSurface,
} from '../../../authored-project/rerolls';
import type { RerollTarget } from '../../../authored-project/model';
import { rerollActionKey } from '../../../authored-project/room-actions/key';
import type { ResolvedRewardOffer } from '../../../reward-kernel';
import type { HistoryEvent } from '../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalHubDecision,
} from '../../materialization';
import { forGeneration } from '../../materialization';
import type { FindingChronology } from '../../finding-regions';
import type { RerollSurfaceSettlement, RerollSurfaceTarget } from '../model';
import type { RewardProducerCandidateResult } from '../producer-frontiers';
import { historyFindingChronology } from './finding-chronology';
import {
  rerollFlagKey,
  type ChronologyWalkContext,
  type ChronologyWalkState,
} from './chronology-walk';
import {
  hubTargetContext,
  lowestRerollPool,
  rerollOfferEvaluator,
  roomTargetContext,
  type RerollTargetContext,
} from './lifecycle-transitions/reward-rerolled';

/** Evaluates new rewards for a press not yet authored, appended to one surface. */
export interface RerollSurfaceCapability {
  /** Undefined when the surface has no such target or a press of it is refused. */
  readonly evaluateOffer: (
    target: RerollPressTarget,
    offer: ResolvedRewardOffer,
  ) => RewardProducerCandidateResult | undefined;
}

/** Opaque per-surface capabilities from one exact reward evaluation. */
export interface RerollSurfaceCandidateArtifacts {
  readonly at: (surface: RerollSurface) => RerollSurfaceCapability | undefined;
}

export function createRerollSurfaceCandidateArtifacts(
  capabilities: ReadonlyMap<string, RerollSurfaceCapability>,
): RerollSurfaceCandidateArtifacts {
  return Object.freeze({
    at: (surface: RerollSurface) => capabilities.get(rerollSurfaceKey(surface)),
  });
}

export function createEmptyRerollSurfaceCandidateArtifacts(): RerollSurfaceCandidateArtifacts {
  return createRerollSurfaceCandidateArtifacts(new Map());
}

/**
 * One surface as the walk left it after an event. Only its last capture is
 * published, so the settlement is resolved on demand from the captured state.
 */
export interface RerollSurfaceCapture {
  readonly key: string;
  /** The run's pool at this append point, lowest over reached branches. */
  readonly poolRemaining: number;
  readonly settle: (poolRemainingAtStart: number) => RerollSurfaceSettlement;
  readonly capability: RerollSurfaceCapability;
}

/** A room's commit, exit and later returns: its doors' presses all precede them. */
const DOORS_CLOSED_BY = new Set<HistoryEvent['kind']>([
  'roomCommitted',
  'roomCountersAdvanced',
  'enteredRewardStoreRecorded',
  'roomExited',
  'roomDeparted',
  'roomRestored',
]);

interface SurfaceTargetContext {
  readonly target: RerollPressTarget;
  readonly context: RerollTargetContext;
  /** Its reward before any press: what `current` falls back to. */
  readonly drawn: ResolvedRewardOffer;
  readonly unavailable?: RerollSurfaceTarget['unavailable'];
}

function surfaceCapture(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
  inputs: {
    readonly surface: RerollSurface;
    readonly flagKey: string;
    readonly owner: () => RoomActionAddress | HubRerollAddress;
    readonly chronology: FindingChronology;
    readonly targets: () => readonly SurfaceTargetContext[];
    readonly contextFor: (target: RerollPressTarget) => SurfaceTargetContext | undefined;
  },
): RerollSurfaceCapture | undefined {
  const view = context.history.viewsBySequence[event.sequence];
  if (view === undefined) return undefined;
  const pool = lowestRerollPool(state.branches);
  const settle = (poolRemainingAtStart: number): RerollSurfaceSettlement =>
    Object.freeze({
      surface: inputs.surface,
      historySequence: event.sequence,
      enabled: state.rerollsFlagged.get(inputs.flagKey) === true,
      poolRemainingAtStart,
      poolRemaining: pool,
      targets: Object.freeze(
        inputs.targets().map(({ target, context: targetContext, drawn, unavailable }) =>
          Object.freeze({
            target,
            owner: targetContext.owner,
            assigned: targetContext.generated,
            current: state.rerolledOffers.get(targetContext.peerKey) ?? drawn,
            ...(unavailable === undefined ? {} : { unavailable }),
          }),
        ),
      ),
    });
  const evaluators = new Map<
    string,
    (offer: ResolvedRewardOffer) => RewardProducerCandidateResult
  >();
  return Object.freeze({
    key: rerollSurfaceKey(inputs.surface),
    poolRemaining: pool,
    settle,
    capability: Object.freeze({
      evaluateOffer: (target: RerollPressTarget, offer: ResolvedRewardOffer) => {
        const key = JSON.stringify(target);
        let evaluate = evaluators.get(key);
        if (evaluate === undefined) {
          const resolved = inputs.contextFor(target);
          if (resolved === undefined || resolved.unavailable !== undefined) return undefined;
          evaluate = rerollOfferEvaluator({
            catalog: context.catalog,
            owner: inputs.owner(),
            target: resolved.context,
            // The appended press would be the next event.
            historySequence: event.sequence + 1,
            view,
            chronology: inputs.chronology,
            branches: state.branches,
            rerolledOffers: state.rerolledOffers,
          }).evaluateOffer;
          evaluators.set(key, evaluate);
        }
        return evaluate(offer);
      },
    }),
  });
}

/** The press id `InsertReroll` gives the room's next press. */
function nextRoomPress(room: CanonicalAuthoredRoom): RoomActionAddress {
  const rerollId = nextRerollId(
    room.roomActionRoster.rows.flatMap((row) =>
      row.reference.kind === 'reroll' ? [row.reference] : [],
    ),
  );
  return createRoomActionAddress(
    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
    room.occurrenceId,
    rerollActionKey(rerollId),
  );
}

function roomSurfaceTarget(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  room: CanonicalAuthoredRoom,
  batch: CanonicalBatch | undefined,
  target: RerollPressTarget,
): SurfaceTargetContext | undefined {
  if (target.kind === 'hubSlot') return undefined;
  const resolved = roomTargetContext(context.catalog, room, batch, target, state.peers);
  if (resolved === undefined) return undefined;
  return Object.freeze({
    target,
    context: resolved,
    drawn: resolved.generated,
    ...(resolved.rerollable ? {} : { unavailable: 'notRerollable' as const }),
  });
}

function doorsCapture(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
  room: CanonicalAuthoredRoom,
  batch: CanonicalBatch,
): RerollSurfaceCapture | undefined {
  const candidates = () =>
    batch.targets.flatMap((door): RerollTarget[] => {
      const cages = door.room.localRewards?.filter((reward) => reward.groupKey === 'cages') ?? [];
      return cages.length > 0
        ? cages.map((cage) => ({
            kind: 'cage' as const,
            exitKey: door.origin.exitKey,
            occurrenceId: door.room.occurrenceId,
            slotKey: cage.slotKey,
          }))
        : [
            {
              kind: 'door' as const,
              exitKey: door.origin.exitKey,
              occurrenceId: door.room.occurrenceId,
            },
          ];
    });
  const contextFor = (target: RerollPressTarget) =>
    target.kind === 'wheelOffer'
      ? undefined
      : roomSurfaceTarget(context, state, room, batch, target);
  return surfaceCapture(context, state, event, {
    surface: Object.freeze({ kind: 'doors', occurrence: room.origin }),
    flagKey: rerollFlagKey(semanticAddressKey(room.origin)),
    owner: () => nextRoomPress(room),
    chronology: historyFindingChronology(event.sequence + 1),
    targets: () => candidates().flatMap((target) => contextFor(target) ?? []),
    contextFor,
  });
}

function wheelCapture(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
  room: CanonicalAuthoredRoom,
  wheelKey: string,
): RerollSurfaceCapture | undefined {
  const wheel = room.rewardWheels?.find((candidate) => candidate.wheelKey === wheelKey);
  if (wheel === undefined) return undefined;
  const contextFor = (target: RerollPressTarget) =>
    target.kind === 'wheelOffer' && target.wheelKey === wheelKey
      ? roomSurfaceTarget(context, state, room, undefined, target)
      : undefined;
  return surfaceCapture(context, state, event, {
    surface: Object.freeze({ kind: 'rewardWheel', wheel: wheel.origin }),
    flagKey: rerollFlagKey(semanticAddressKey(room.origin), wheelKey),
    owner: () => nextRoomPress(room),
    chronology: historyFindingChronology(event.sequence + 1),
    targets: () =>
      wheel.offers.flatMap(
        (offer) => contextFor({ kind: 'wheelOffer', wheelKey, offerKey: offer.offerKey }) ?? [],
      ),
    contextFor,
  });
}

function hubCapture(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
  hub: CanonicalHubDecision,
  stay: NonNullable<ChronologyWalkState['hubStay']>,
): RerollSurfaceCapture | undefined {
  const biome = createBiomeAddress(hub.origin.routeKey, hub.origin.biomeKey);
  const entered = new Set(
    hub.visits.slice(0, stay.precedingVisitCount).map((visit) => visit.target.hubSlotKey),
  );
  const contextFor = (target: RerollPressTarget): SurfaceTargetContext | undefined => {
    if (target.kind !== 'hubSlot') return undefined;
    const resolved = hubTargetContext(
      context.catalog,
      hub,
      target.hubSlotKey,
      stay.precedingVisitCount,
      stay.assigned,
    );
    const incoming = hub.board.targets.find(
      (candidate) => candidate.hubSlotKey === target.hubSlotKey,
    )?.room.incomingReward;
    if (resolved === undefined || incoming === undefined) return undefined;
    return Object.freeze({
      target,
      context: resolved,
      drawn: forGeneration(incoming).offer,
      ...(entered.has(target.hubSlotKey)
        ? { unavailable: 'slotEntered' as const }
        : resolved.rerollable
          ? {}
          : { unavailable: 'notRerollable' as const }),
    });
  };
  return surfaceCapture(context, state, event, {
    surface: Object.freeze({
      kind: 'hubStay',
      hub: createHubDecisionAddress(biome, hub.origin.hubKey),
      precedingVisitCount: stay.precedingVisitCount,
    }),
    flagKey: rerollFlagKey(semanticAddressKey(hub.origin)),
    owner: () =>
      createHubRerollAddress(
        biome,
        hub.origin.hubKey,
        nextRerollId(hub.rerolls.map((reroll) => reroll.origin)),
      ),
    chronology: Object.freeze({
      kind: 'hubBoard' as const,
      history: historyFindingChronology(event.sequence + 1),
    }),
    targets: () =>
      hub.board.targets.flatMap(
        (target) => contextFor({ kind: 'hubSlot', hubSlotKey: target.hubSlotKey }) ?? [],
      ),
    contextFor,
  });
}

/**
 * The reroll surfaces one walked event leaves at their append point: a room's
 * doors after each of its and its batch's events from the doors unlocking
 * until it commits, a ship wheel after its offers spawn and after each of its
 * presses, and the open Hub stay after each of the Hub's events.
 */
export function captureRerollSurfaces(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
): readonly RerollSurfaceCapture[] {
  if (state.branches.length === 0) return [];
  const captures: (RerollSurfaceCapture | undefined)[] = [];
  const origin = event.origin;
  // A batch's rooms are created as its source's doors unlock; its presses follow them.
  const doorsOrigin =
    'parentOrigin' in event && event.parentOrigin.kind === 'occurrence'
      ? event.parentOrigin
      : origin;
  if (doorsOrigin.kind === 'occurrence' && !DOORS_CLOSED_BY.has(event.kind)) {
    const roomKey = semanticAddressKey(doorsOrigin);
    const room = context.rooms.get(roomKey);
    const batch = context.prepared.batchesByParent.get(roomKey);
    if (
      room?.kind === 'authored' &&
      batch !== undefined &&
      state.rerollsFlagged.has(rerollFlagKey(roomKey))
    )
      captures.push(doorsCapture(context, state, event, room, batch));
  }
  if (origin.kind === 'occurrence') {
    const roomKey = semanticAddressKey(origin);
    const room = context.rooms.get(roomKey);
    const wheelKey =
      event.kind === 'offerPointMaterialized'
        ? event.offerPoint
        : event.kind === 'rewardRerolled' && event.target.kind === 'wheelOffer'
          ? event.target.wheelKey
          : undefined;
    if (
      room?.kind === 'authored' &&
      wheelKey !== undefined &&
      state.rerollsFlagged.has(rerollFlagKey(roomKey, wheelKey))
    )
      captures.push(wheelCapture(context, state, event, room, wheelKey));
  }
  const stay = state.hubStay;
  if (stay !== undefined && (origin.kind === 'hubRoom' || origin.kind === 'hubSlot')) {
    const hub = context.snapshot.decisions.find(
      (decision): decision is CanonicalHubDecision => decision.kind === 'hub',
    );
    if (hub !== undefined) captures.push(hubCapture(context, state, event, hub, stay));
  }
  return captures.filter((capture): capture is RerollSurfaceCapture => capture !== undefined);
}
