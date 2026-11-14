import {
  createBiomeAddress,
  createHubDecisionAddress,
  semanticAddressKey,
} from '../../../authored-project/addresses';
import {
  rerollSurfaceKey,
  type RerollPressTarget,
  type RerollSurface,
} from '../../../authored-project/rerolls';
import type { ResolvedRerollTarget } from '../../../authored-project/model';
import type { HistoryEvent } from '../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalHubDecision,
} from '../../materialization';
import type { RerollSurfaceSettlement, RerollSurfaceTarget } from '../model';
import {
  rerollFlagKey,
  type ChronologyWalkContext,
  type ChronologyWalkState,
} from './chronology-walk';
import {
  hubTargetContext,
  reachedRerollPool,
  roomTargetContext,
  type RerollTargetContext,
} from './lifecycle-transitions/reward-rerolled';

/**
 * One surface as the walk left it after an event. Only its last capture is
 * published, so the settlement is resolved on demand from the captured state.
 */
export interface RerollSurfaceCapture {
  readonly key: string;
  /** The run's pool at this append point. */
  readonly poolRemaining: number;
  readonly settle: (poolRemainingAtStart: number) => RerollSurfaceSettlement;
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
  readonly unavailable?: RerollSurfaceTarget['unavailable'];
}

function surfaceCapture(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
  inputs: {
    readonly surface: RerollSurface;
    readonly flagKey: string;
    readonly targets: () => readonly SurfaceTargetContext[];
  },
): RerollSurfaceCapture | undefined {
  // Only an event the history fold holds a state view for leaves a surface.
  if (context.history.viewsBySequence[event.sequence] === undefined) return undefined;
  const pool = reachedRerollPool(state.branch);
  const enabled = state.rerollsFlagged.get(inputs.flagKey) === true;
  const settle = (poolRemainingAtStart: number): RerollSurfaceSettlement =>
    Object.freeze({
      surface: inputs.surface,
      historySequence: event.sequence,
      enabled,
      poolRemainingAtStart,
      poolRemaining: pool,
      targets: Object.freeze(
        inputs.targets().map(({ target, context: targetContext, unavailable }) =>
          Object.freeze({
            target,
            owner: targetContext.owner,
            assigned: targetContext.generated,
            current: state.rerolledOffers.get(targetContext.peerKey) ?? targetContext.firstDraw,
            ...(unavailable === undefined ? {} : { unavailable }),
          }),
        ),
      ),
    });
  return Object.freeze({
    key: rerollSurfaceKey(inputs.surface),
    poolRemaining: pool,
    settle,
  });
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
    batch.targets.flatMap((door): ResolvedRerollTarget[] => {
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
    targets: () => candidates().flatMap((target) => contextFor(target) ?? []),
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
    targets: () =>
      wheel.offers.flatMap(
        (offer) => contextFor({ kind: 'wheelOffer', wheelKey, offerKey: offer.offerKey }) ?? [],
      ),
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
  const contextFor = (target: RerollPressTarget): SurfaceTargetContext | undefined => {
    if (target.kind !== 'hubSlot') return undefined;
    const resolved = hubTargetContext(
      context.catalog,
      hub,
      target.hubSlotKey,
      stay.precedingVisitCount,
      stay.assigned,
    );
    if (resolved === undefined) return undefined;
    return Object.freeze({
      target,
      context: resolved,
      ...(resolved.slotEntered === true
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
    targets: () =>
      hub.board.targets.flatMap(
        (target) => contextFor({ kind: 'hubSlot', hubSlotKey: target.hubSlotKey }) ?? [],
      ),
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
  if (state.branch === undefined) return [];
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
