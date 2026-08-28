import { createOccurrenceId } from './addresses';
import type { FixedRoomLink, OccurrenceId } from './model';

export function fixedCompletionOccurrenceId(
  prebossOccurrenceId: OccurrenceId,
  role: 'boss' | 'postboss',
): OccurrenceId {
  return createOccurrenceId(`${prebossOccurrenceId}:${role}`);
}

export function fixedRoomLink(
  sourceOccurrenceId: OccurrenceId,
  targetOccurrenceId: OccurrenceId,
): FixedRoomLink {
  return Object.freeze({ sourceOccurrenceId, targetOccurrenceId });
}
