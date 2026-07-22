import { createOccurrenceId, type OccurrenceId } from '@run-planner/engine/authored-project';

export function allocateOccurrenceId(): OccurrenceId {
  return createOccurrenceId(globalThis.crypto.randomUUID());
}
