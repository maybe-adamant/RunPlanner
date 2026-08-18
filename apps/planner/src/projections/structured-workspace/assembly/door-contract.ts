import type { WorkspaceDoorContract, WorkspaceRoomSummary } from '../contract';

/** Builds the one immutable door handoff consumed by cards and rail summaries. */
export function projectWorkspaceDoorContract(
  room: WorkspaceRoomSummary,
  declaredPreview: 'hidden' | 'visible',
): WorkspaceDoorContract {
  if (declaredPreview === 'hidden') {
    return Object.freeze({
      rewardPreview: Object.freeze({ kind: 'hidden' as const }),
      room,
    });
  }
  const rewardPreview = (() => {
    switch (room.roomLocal.kind) {
      case 'fixed':
        return Object.freeze({
          kind: 'visible' as const,
          rewards: Object.freeze([
            Object.freeze({
              ...(room.roomLocal.control === undefined ? {} : { control: room.roomLocal.control }),
              key: 'incoming',
              label: 'Door reward',
              marker: room.roomLocal.marker,
              offer: room.roomLocal.offer,
              summary: room.roomLocal.summary,
            }),
          ]),
        });
      case 'incomingReward':
        if (room.roomLocal.clockworkReward === 'goal') {
          return Object.freeze({ kind: 'none' as const });
        }
        return Object.freeze({
          kind: 'visible' as const,
          rewards: Object.freeze([
            Object.freeze({
              control: room.roomLocal.control,
              key: 'incoming',
              label: 'Door reward',
              marker: room.roomLocal.control.marker,
              offer: room.roomLocal.control.offer,
              summary: room.roomLocal.summary,
            }),
          ]),
        });
      case 'fields':
        return Object.freeze({
          kind: 'visible' as const,
          rewards: Object.freeze(
            room.roomLocal.cages.map((cage) =>
              Object.freeze({
                control: cage.control,
                key: cage.key,
                label: cage.label,
                marker: cage.control.marker,
                offer: cage.control.offer,
                summary: cage.summary,
              }),
            ),
          ),
        });
      case 'none':
      case 'ship':
      case 'shop':
        return Object.freeze({ kind: 'none' as const });
    }
  })();
  return Object.freeze({ rewardPreview, room });
}
