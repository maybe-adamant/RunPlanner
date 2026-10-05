import { closePendingResourcePickupRoom } from '../../../state/pending-resource-pickups';
import { closePendingTraitOfferRoom, traitOfferRoomKey } from '../../../state/pending-trait-offers';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import type { Catalog } from '../../../../catalog-schema';
import type { ResourcePlacements } from '../../../../authored-project/model';
import type { ResolvedRoutePosition } from '../../../../authored-project/route-context';
import {
  createRoomFeatureAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import type { PendingHermesShrineDelivery } from '../../../state/model';
import { findingRegion, ownerRegion } from '../../../finding-regions';
import { rewardFinding } from '../../findings';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { advanceChaosClock, foldTraitHistoryEvents } from '../../../traits';
import { completePendingShopAcquisitionSite } from '../../shop/settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { FindingRegionEntry } from '../../../finding-regions';
import { resourcePlacementFindingRegions } from '../../../resources';
import type { SemanticFinding } from '../../../model';

export interface RoomExitedTransition {
  readonly findingRegions: readonly FindingRegionEntry[];
  readonly branches: readonly RewardBranchState[];
  readonly runStateCheckpoint?: {
    readonly owner: ReturnType<typeof createRoomRunStateCheckpointAddress>;
    readonly room: CanonicalAuthoredRoom;
    readonly view: NonNullable<ProgressiveRoomHistoryViews['postCommit']>;
  };
}

function failRoomExit(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

export function applyRoomExitedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomExited' }>,
  room: CanonicalAuthoredRoom | undefined,
  roomView: ProgressiveRoomHistoryViews | undefined,
  resourcePlacements: ResourcePlacements,
  branches: readonly RewardBranchState[],
  routePosition: ResolvedRoutePosition,
  resourceFindings: readonly SemanticFinding[] = [],
): RoomExitedTransition {
  let next = branches;
  const findingRegions = [...resourcePlacementFindingRegions(event, resourceFindings)];
  // No Boss room hosts a delivery flush, so a delivery still counting down
  // when the route's last Boss is left can never arrive. The purchase owns
  // the repair; the Boss exit owns the chronology.
  if (
    room !== undefined &&
    room.origin.kind === 'occurrence' &&
    routePosition.isLast &&
    catalog.rooms.byKey[room.gameName]?.kind === 'Boss'
  ) {
    const unreachable = new Map<string, PendingHermesShrineDelivery>();
    for (const branch of branches)
      for (const delivery of Object.values(branch.state.pendingHermesShrineDeliveries))
        if (delivery.dueAt === undefined) unreachable.set(delivery.sourceKey, delivery);
    for (const delivery of unreachable.values()) {
      const purchase = createRoomFeatureAddress(delivery.sourceOrigin, {
        kind: 'hermesShrineOffer',
        generationKey: delivery.generationKey,
      });
      findingRegions.push(
        findingRegion(
          rewardFinding('rewardSourceUnavailable', purchase, {
            reason: 'routeEndsBeforeDelivery',
            sourceKey: delivery.sourceKey,
            hostOccurrenceId: room.origin.occurrenceId,
          }),
          ownerRegion(purchase),
          { kind: 'history', sequence: event.sequence, boundary: 'at', room: room.origin },
        ),
      );
    }
  }
  if (room?.entryState?.kind === 'shop')
    next = completePendingShopAcquisitionSite(next, room.origin, failRoomExit);
  let checkpoint: RoomExitedTransition['runStateCheckpoint'];
  if (room !== undefined) {
    const view = roomView?.postCommit;
    if (view === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} has no pre-exit Run State view`,
      );
    checkpoint = Object.freeze({
      owner: createRoomRunStateCheckpointAddress(room.origin, { kind: 'beforeRoomExit' }),
      room,
      view,
    });
    const placements = Object.entries(resourcePlacements).filter(
      ([family, value]) =>
        value?.biomeKey === room.origin.biomeKey &&
        value.occurrenceId === room.origin.occurrenceId &&
        (catalog.rooms.byKey[room.gameName]?.resourcePointSupport.families.includes(
          family as import('../../../../catalog-schema').ResourceFamily,
        ) ??
          false),
    ) as readonly [
      import('../../../../catalog-schema').ResourceFamily,
      NonNullable<ResourcePlacements[import('../../../../catalog-schema').ResourceFamily]>,
    ][];
    if (placements.length > 0)
      next = Object.freeze(
        next.map((branch) => {
          const priorTraits = branch.state.traitHistory;
          const events = placements.map(([family]) => {
            const source = catalog.rooms.byKey[room.gameName]?.resourcePointSupport.rules[family];
            if (source === undefined)
              throw new BiomeRewardSimulationContractError(
                `resource ${family} has no declaration rule in ${room.gameName}`,
              );
            return Object.freeze({
              kind: 'elementContribution' as const,
              owner: room.origin,
              acquisitionRole: `resource:${source.grantedTraitKey}`,
              sequence: event.sequence,
              acquisitionPoint: 'roomExited',
              contributions: Object.freeze({ [source.element]: 1 }),
            });
          });
          const traitHistory = foldTraitHistoryEvents(catalog, [...priorTraits.events, ...events]);
          return Object.freeze({
            ...branch,
            state: replaceSimulationTraitHistory(branch.state, traitHistory),
          });
        }),
      );
  }
  // Loot left unopened, resources left uncollected and a rushed Shrine item
  // left on the floor disappear with the room; a countdown delivery due here
  // is required and never reaches this exit unacquired.
  const exitedRoom = traitOfferRoomKey(event.origin);
  if (exitedRoom !== undefined)
    next = Object.freeze(
      next.map((branch) => {
        let state = closePendingResourcePickupRoom(
          closePendingTraitOfferRoom(branch.state, exitedRoom),
          exitedRoom,
        );
        const abandoned = Object.entries(state.pendingHermesShrineDeliveries).filter(
          ([, delivery]) =>
            delivery.rushed === true &&
            delivery.dueAt !== undefined &&
            semanticAddressKey(delivery.dueAt) === exitedRoom,
        );
        if (abandoned.length > 0) {
          const remaining = { ...state.pendingHermesShrineDeliveries };
          for (const [key] of abandoned) delete remaining[key];
          state = Object.freeze({
            ...state,
            pendingHermesShrineDeliveries: Object.freeze(remaining),
          });
        }
        return state === branch.state ? branch : Object.freeze({ ...branch, state });
      }),
    );
  next = Object.freeze(
    next.map((branch) => {
      const before = branch.state.traitHistory;
      const traitHistory = advanceChaosClock(catalog, before, event.sequence, 'locations');
      return traitHistory === before
        ? branch
        : Object.freeze({
            ...branch,
            state: replaceSimulationTraitHistory(branch.state, traitHistory),
          });
    }),
  );
  return Object.freeze({
    findingRegions: Object.freeze(findingRegions),
    branches: advanceRewardBranches(next, event.sequence),
    ...(checkpoint === undefined ? {} : { runStateCheckpoint: checkpoint }),
  });
}
