import { createOccurrenceId, type OccurrenceId } from '@run-planner/engine';

export function allocateOccurrenceId(): OccurrenceId {
  return createOccurrenceId(globalThis.crypto.randomUUID());
}
