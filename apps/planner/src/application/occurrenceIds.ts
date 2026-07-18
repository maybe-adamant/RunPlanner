import { createOccurrenceId, type OccurrenceId } from '@run-planner/core';

export function allocateOccurrenceId(): OccurrenceId {
  return createOccurrenceId(globalThis.crypto.randomUUID());
}
