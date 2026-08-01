import { createOccurrenceId, type OccurrenceId } from '@run-planner/engine/authored-project';

export type OccurrenceIdFactory = () => OccurrenceId;

export function allocateOccurrenceId(): OccurrenceId {
  return createOccurrenceId(globalThis.crypto.randomUUID());
}
