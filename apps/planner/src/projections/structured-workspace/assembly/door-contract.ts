import type { WorkspaceDoorContract, WorkspaceRoomSummary } from '../contract';

/** Builds the one immutable door handoff consumed by cards and rail summaries. */
export function projectWorkspaceDoorContract(
  room: WorkspaceRoomSummary,
  declaredPreview: 'hidden' | 'visible',
): WorkspaceDoorContract {
  return Object.freeze({
    offerRewardSurface: Object.freeze({
      visibility: declaredPreview,
      // A hidden physical door keeps only authorable controls in the exposed
      // surface. Fixed summaries remain part of the room product but are not
      // authoring targets when the game does not reveal that door.
      rewards:
        declaredPreview === 'hidden'
          ? room.offerRewardRewards.filter((reward) => reward.control !== undefined)
          : room.offerRewardRewards,
    }),
    room,
  });
}
