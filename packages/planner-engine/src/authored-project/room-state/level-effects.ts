import type { Catalog } from '../../catalog-schema';
import type { LevelResolutionEffectSource } from '../../reward-kernel/level-effects';
import type { RoomOccurrence } from '../model';

export function incomingLevelEffectSource(
  catalog: Catalog,
  occurrence: RoomOccurrence,
): LevelResolutionEffectSource | undefined {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) return undefined;
  const binding =
    occurrence.state.kind === 'anomaly'
      ? occurrence.anomalyReplacement === undefined
        ? undefined
        : catalog.rooms.byKey[occurrence.anomalyReplacement.replacedRoomGameName]?.incomingReward
      : occurrence.state.kind === 'freeReward'
        ? room.prebossBatchPolicy?.kind === 'takeOverNormalDoors' &&
          room.prebossBatchPolicy.remainingOffers.kind === 'counted'
          ? room.prebossBatchPolicy.remainingOffers.reward
          : undefined
        : room.incomingReward;
  return binding === undefined || binding.kind === 'none'
    ? undefined
    : Object.freeze({ kind: 'producerLifecycle', key: binding.producerLifecycleKey });
}
