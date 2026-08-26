import type { Catalog } from '../../../../catalog-schema';
import type { ResourcePlacements } from '../../../../authored-project/model';
import { createRoomRunStateCheckpointAddress } from '../../../../authored-project/addresses';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import {
  attachTraitHistory,
  advanceChaosClock,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../../traits';
import { completePendingShopAcquisitionSite } from '../../shop-settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../processing';
import { BiomeRewardSimulationContractError } from '../biome-contract';

export interface RoomExitedTransition {
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
): RoomExitedTransition {
  let next = branches;
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
          const priorTraits = branch.traitHistory ?? createTraitHistoryState();
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
            traitHistory,
            history: attachTraitHistory(branch.history, traitHistory),
          });
        }),
      );
  }
  next = Object.freeze(
    next.map((branch) => {
      const before = branch.traitHistory ?? createTraitHistoryState();
      const traitHistory = advanceChaosClock(catalog, before, event.sequence, 'locations');
      return traitHistory === before
        ? branch
        : Object.freeze({
            ...branch,
            traitHistory,
            history: attachTraitHistory(branch.history, traitHistory),
          });
    }),
  );
  return Object.freeze({
    branches: advanceRewardBranches(next, event.sequence),
    ...(checkpoint === undefined ? {} : { runStateCheckpoint: checkpoint }),
  });
}
