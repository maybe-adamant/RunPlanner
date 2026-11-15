import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createRoomFeatureAddress,
  createTravelDealRefillRealizationAddress,
} from '../../../../authored-project/addresses';
import {
  firstInitialRush,
  hermesShrineDeliveryEntryKey,
} from '../../../../authored-project/hermes-shrine-delivery';
import type { HermesShrineGenerationKey } from '../../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import type { PendingHermesShrineDelivery } from '../../../state/model';
import {
  assessHermesShrineTravelDealRefill,
  type RealizedHermesShrineTravelDealRefill,
} from '../../../commerce/hermes-shrine';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { PlannerTimelineFacts } from '../../../timeline-facts';
import { spawnDueHermesDeliveries } from '../offer-lifecycle/spawned-trait-offers';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import { mapReached, type RewardBranchState } from '../../branch-primitives';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, rewardFinding } from '../../findings';

export interface HermesShrinePurchaseReachedTransition {
  readonly branch: RewardBranchState | undefined;
  readonly findings: readonly FindingRegionEntry[];
  /** Published when a rush realizes the room's Travel Deal refill. */
  readonly travelDealRefill?: RealizedHermesShrineTravelDealRefill;
  readonly timelineFacts?: PlannerTimelineFacts;
}

/** One bought Shrine item's pending delivery, keyed by its entry; its rush may later make it due here. */
export function pendingHermesShrineDelivery(
  room: CanonicalAuthoredRoom,
  generationKey: HermesShrineGenerationKey,
  rewardType: string,
  delay: number,
): readonly [string, PendingHermesShrineDelivery] {
  const entryKey = hermesShrineDeliveryEntryKey(room.origin, generationKey);
  return [
    entryKey,
    Object.freeze({
      entryKey,
      source: room.origin,
      generationKey,
      rewardType,
      rushed: false,
      remainingUses: delay,
    }),
  ] as const;
}

function supportedRefill(
  room: CanonicalAuthoredRoom,
  realized: RealizedHermesShrineTravelDealRefill,
): boolean {
  const offer = room.hermesShrine?.travelDealRefill?.offer;
  return (
    offer !== undefined &&
    offer !== null &&
    realized.assessment?.candidateRewardTypes.includes(offer.rewardType) === true
  );
}

/**
 * Settles one ranked Shrine purchase. An initial item's delivery is scheduled
 * at the Shrine checkpoint; the refill's purchase schedules its own, and
 * before a rush made with Travel Deal the refill does not exist yet.
 */
export function applyHermesShrinePurchaseReachedTransition(inputs: {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'hermesShrinePurchaseReached' }>;
  readonly room: CanonicalAuthoredRoom | undefined;
  readonly branch: RewardBranchState | undefined;
  /** The room's refill domain when an earlier rush already realized it. */
  readonly realized: RealizedHermesShrineTravelDealRefill | undefined;
}): HermesShrinePurchaseReachedTransition {
  const { snapshot, event, room, branch, realized } = inputs;
  if (room === undefined)
    throw new BiomeRewardSimulationContractError('Shrine purchases have no authored room');
  const unchanged = () => Object.freeze({ branch, findings: Object.freeze([]) });
  if (event.generationKey !== 'travelDealRefill') return unchanged();
  const offer = room.hermesShrine?.travelDealRefill?.offer;
  const row = room.roomActionRoster.rows.find(
    (candidate) =>
      candidate.rank !== null &&
      candidate.reference.kind === 'purchaseHermesShrineOffer' &&
      candidate.reference.generationKey === 'travelDealRefill',
  );
  if (row === undefined) return unchanged();
  if (realized === undefined) {
    const findings = new Map<string, FindingRegionEntry>();
    addRewardFinding(
      findings,
      rewardFinding('hermesShrineTravelDealRefillUnavailable', row.owner, {
        generationKey: 'travelDealRefill',
        reason:
          firstInitialRush(
            room.roomActionRoster.rows.flatMap((ranked) =>
              ranked.rank === null ? [] : [ranked.reference],
            ),
          ) === undefined
            ? 'noRushedPurchase'
            : 'travelDealInactive',
      }),
      ownerRegion(row.owner),
      rewardFindingChronologyForRoom(snapshot, room.origin, event.sequence, 'localRoomLifecycle'),
    );
    return Object.freeze({ branch, findings: Object.freeze([...findings.values()]) });
  }
  if (offer === undefined || offer === null || !supportedRefill(room, realized)) return unchanged();
  const [key, delivery] = pendingHermesShrineDelivery(
    room,
    'travelDealRefill',
    offer.rewardType,
    offer.delay,
  );
  return Object.freeze({
    branch: mapReached(branch, (reached) =>
      Object.freeze({
        ...reached,
        state: Object.freeze({
          ...reached.state,
          pendingHermesShrineDeliveries: Object.freeze({
            ...reached.state.pendingHermesShrineDeliveries,
            [key]: delivery,
          }),
        }),
      }),
    ),
    findings: Object.freeze([]),
  });
}

/** Makes a bought item's pending delivery due at its rush, in the Shrine room, and spawns it. */
function rushedDelivery(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  branch: RewardBranchState | undefined,
  generationKey: HermesShrineGenerationKey,
  sequence: number,
): RewardBranchState | undefined {
  return mapReached(branch, (reached) => {
    const key = hermesShrineDeliveryEntryKey(room.origin, generationKey);
    const pending = reached.state.pendingHermesShrineDeliveries[key];
    if (pending === undefined || pending.due !== undefined) return reached;
    return spawnDueHermesDeliveries(
      catalog,
      room,
      Object.freeze({
        ...reached,
        state: Object.freeze({
          ...reached.state,
          pendingHermesShrineDeliveries: Object.freeze({
            ...reached.state.pendingHermesShrineDeliveries,
            [key]: Object.freeze({
              ...pending,
              rushed: true,
              due: Object.freeze({
                host: room.origin,
                cause: 'rush' as const,
                historySequence: sequence,
              }),
            }),
          }),
        }),
      }),
      sequence,
    );
  });
}

/**
 * Settles one ranked Shrine rush: the first initial rush made while Travel
 * Deal is held refills its slot (`FirstSpeedUpPurchase`), a rush without the
 * trait leaves the refill to a later rush, and the rush closes the Shrine, so
 * the rushed item spawns here.
 */
export function applyHermesShrineRushReachedTransition(inputs: {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'hermesShrineRushReached' }>;
  readonly room: CanonicalAuthoredRoom | undefined;
  readonly declaration: RoomDeclaration | undefined;
  readonly roomView: ProgressiveRoomHistoryViews | undefined;
  readonly branch: RewardBranchState | undefined;
  /** The room's refill domain when an earlier rush already realized it. */
  readonly realized: RealizedHermesShrineTravelDealRefill | undefined;
}): HermesShrinePurchaseReachedTransition {
  const { catalog, snapshot, event, room, declaration, roomView, branch, realized } = inputs;
  if (room === undefined || declaration === undefined || roomView === undefined)
    throw new BiomeRewardSimulationContractError('Shrine rushes have no authored room');
  const shrine = room.hermesShrine;
  const spawned = () => rushedDelivery(catalog, room, branch, event.generationKey, event.sequence);
  if (
    event.generationKey === 'travelDealRefill' ||
    realized !== undefined ||
    shrine === undefined ||
    branch?.state.traitHistory.equippedTraits.RestockBoon === undefined
  )
    return Object.freeze({ branch: spawned(), findings: Object.freeze([]) });
  const findings = new Map<string, FindingRegionEntry>();
  const addFinding = (
    kind: Parameters<typeof rewardFinding>[0],
    origin: Parameters<typeof rewardFinding>[1],
    detail: Parameters<typeof rewardFinding>[2],
  ) =>
    addRewardFinding(
      findings,
      rewardFinding(kind, origin, detail),
      ownerRegion(origin),
      rewardFindingChronologyForRoom(snapshot, room.origin, event.sequence, 'localRoomLifecycle'),
    );
  const view = roomView.preOutgoing ?? roomView.entry;
  const assessment = assessHermesShrineTravelDealRefill(catalog, shrine, event.generationKey, [
    createBiomeRewardFacts({
      catalog,
      state: branch.state,
      source: room,
      currentRoom: room,
      sourceDeclaration: declaration,
      view,
      hubBoardLookups: 'consulted',
    }).requirements,
  ]);
  const travelDealRefill: RealizedHermesShrineTravelDealRefill = Object.freeze(
    assessment === undefined ? {} : { assessment },
  );
  const offer = shrine.travelDealRefill?.offer;
  const supported = supportedRefill(room, travelDealRefill);
  const feature = createRoomFeatureAddress(room.origin, {
    kind: 'hermesShrineOffer',
    generationKey: 'travelDealRefill',
  });
  if (offer === undefined || offer === null)
    addFinding('hermesShrineTravelDealRefillMissing', feature, {
      generationKey: event.generationKey,
    });
  else if (!supported)
    addFinding('hermesShrineTravelDealRefillUnavailable', feature, {
      generationKey: event.generationKey,
      rewardType: offer.rewardType,
    });
  return Object.freeze({
    branch: spawned(),
    findings: Object.freeze([...findings.values()]),
    travelDealRefill,
    ...(supported
      ? {
          timelineFacts: Object.freeze({
            nodes: Object.freeze([
              Object.freeze({
                owner: createTravelDealRefillRealizationAddress(
                  createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                  room.occurrenceId,
                ),
                included: true,
              }),
            ]),
            dependencies: Object.freeze([]),
          }),
        }
      : {}),
  });
}
