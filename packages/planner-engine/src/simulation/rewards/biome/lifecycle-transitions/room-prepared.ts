import type { Catalog } from '../../../../catalog-schema';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion } from '../../../finding-regions';
import { fieldsOptionalRewardCountFindings } from '../../../fields/optional-count';
import { beginRewardRoom } from '../../branch-lifecycle';
import type { RewardBranchState } from '../../branch-primitives';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import type { LifecycleFinding } from './types';

export interface RoomPreparedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly LifecycleFinding[];
}

/** Room preparation opens the room's reward lifecycle and checks Fields optional reward counts. */
export function applyRoomPreparedTransition(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  event: Extract<HistoryEvent, { readonly kind: 'roomPrepared' }>,
  room: CanonicalAuthoredRoom | undefined,
  branches: readonly RewardBranchState[],
): RoomPreparedTransition {
  const findings =
    room === undefined
      ? []
      : fieldsOptionalRewardCountFindings(catalog, room).map((finding) =>
          Object.freeze({
            finding,
            region: ownerRegion(room.origin),
            chronology: rewardFindingChronologyForRoom(
              snapshot,
              room.origin,
              event.sequence,
              'localRoomLifecycle',
            ),
          }),
        );
  return Object.freeze({
    branches: beginRewardRoom(branches, event.sequence),
    findings: Object.freeze(findings),
  });
}
