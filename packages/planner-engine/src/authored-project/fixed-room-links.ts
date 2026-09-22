import { createOccurrenceId } from './addresses';
import type { FixedRoomLink, OccurrenceId } from './model';

export function fixedCompletionOccurrenceId(
  prebossOccurrenceId: OccurrenceId,
  role: 'boss' | 'postboss',
): OccurrenceId {
  return createOccurrenceId(`${prebossOccurrenceId}:${role}`);
}

/**
 * A newly constructed link never carries a store: the authored boss-door store
 * is omitted until the author resolves it, so a plan that never touches the
 * decision serializes exactly as it did before the field existed.
 */
export function fixedRoomLink(
  sourceOccurrenceId: OccurrenceId,
  targetOccurrenceId: OccurrenceId,
  rewardStoreKey?: string,
): FixedRoomLink {
  return Object.freeze({
    sourceOccurrenceId,
    targetOccurrenceId,
    ...(rewardStoreKey === undefined ? {} : { rewardStoreKey }),
  });
}
