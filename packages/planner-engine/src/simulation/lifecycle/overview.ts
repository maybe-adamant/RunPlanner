import type { RoomLifecycleOperation, RoomLifecycleProfile } from '../../catalog-schema';

const overviewOperationKinds: ReadonlySet<RoomLifecycleOperation['kind']> = new Set([
  'prepareRoom',
  'materializeOfferPoint',
  'enterRoom',
]);

/**
 * A room's Overview is its leading preparation, inventory and entry operations;
 * the Timeline starts at the first other operation.
 */
export function roomOverviewOperationCount(profile: RoomLifecycleProfile): number {
  const timelineStart = profile.operations.findIndex(
    (operation) => !overviewOperationKinds.has(operation.kind),
  );
  return timelineStart < 0 ? profile.operations.length : timelineStart;
}
