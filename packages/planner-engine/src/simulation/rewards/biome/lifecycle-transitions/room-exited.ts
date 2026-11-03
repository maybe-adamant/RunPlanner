import { closePendingResourcePickupRoom } from '../../../state/pending-resource-pickups';
import { closePendingTraitOfferRoom, traitOfferRoomKey } from '../../../state/pending-trait-offers';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import type { Catalog } from '../../../../catalog-schema';
import type { ResourcePlacements } from '../../../../authored-project/model';
import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { foldTraitHistoryEvents } from '../../../traits';
import { completePendingShopAcquisitionSite } from '../../shop/settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceReachedBranch } from '../../branch-lifecycle';
import { BiomeRewardSimulationContractError } from '../biome-contract';

export interface RoomExitedTransition {
  readonly branch: RewardBranchState | undefined;
  readonly runStateCheckpoint?: {
    readonly owner: ReturnType<typeof createRoomRunStateCheckpointAddress>;
    readonly room: CanonicalAuthoredRoom;
    readonly view: NonNullable<ProgressiveRoomHistoryViews['postCommit']>;
  };
}

export function applyRoomExitedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomExited' }>,
  room: CanonicalAuthoredRoom | undefined,
  roomView: ProgressiveRoomHistoryViews | undefined,
  resourcePlacements: ResourcePlacements,
  branch: RewardBranchState | undefined,
): RoomExitedTransition {
  let next = branch;
  if (room?.entryState?.kind === 'shop')
    next = completePendingShopAcquisitionSite(next, room.origin);
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
    if (placements.length > 0 && next !== undefined) {
      const reached = next;
      const priorTraits = reached.state.traitHistory;
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
      next = Object.freeze({
        ...reached,
        state: replaceSimulationTraitHistory(reached.state, traitHistory),
      });
    }
  }
  // Loot left unopened, resources left uncollected and a rushed Shrine item
  // left on the floor disappear with the room; a countdown delivery due here
  // is required and never reaches this exit unacquired.
  const exitedRoom = traitOfferRoomKey(event.origin);
  if (exitedRoom !== undefined && next !== undefined) {
    const reached = next;
    let state = closePendingResourcePickupRoom(
      closePendingTraitOfferRoom(reached.state, exitedRoom),
      exitedRoom,
    );
    const abandoned = Object.entries(state.pendingHermesShrineDeliveries).filter(
      ([, delivery]) =>
        delivery.due?.cause === 'rush' && semanticAddressKey(delivery.due.host) === exitedRoom,
    );
    if (abandoned.length > 0) {
      const remaining = { ...state.pendingHermesShrineDeliveries };
      for (const [key] of abandoned) delete remaining[key];
      state = Object.freeze({
        ...state,
        pendingHermesShrineDeliveries: Object.freeze(remaining),
      });
    }
    if (state !== reached.state) next = Object.freeze({ ...reached, state });
  }
  return Object.freeze({
    branch: advanceReachedBranch(next, event.sequence),
    ...(checkpoint === undefined ? {} : { runStateCheckpoint: checkpoint }),
  });
}
