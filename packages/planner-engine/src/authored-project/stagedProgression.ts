import type { LinearBiomeLayout, StagedCandidatePoolDescriptor } from '../catalog-schema';
import type { LinearBiomeTopology, OccurrenceId } from './model';

export function stagedProgressionStages(
  layout: LinearBiomeLayout,
): readonly StagedCandidatePoolDescriptor[] | undefined {
  const policy = layout.continuation.progressionPolicy;
  return policy.kind === 'staged' ? policy.stages : undefined;
}

export function stagedBatchIndex(
  topology: LinearBiomeTopology,
  parentOccurrenceId: OccurrenceId | null,
): number | undefined {
  const batches = topology.continuations.filter((continuation) => continuation.kind === 'batch');
  const index = batches.findIndex(
    (continuation) => continuation.parentOccurrenceId === parentOccurrenceId,
  );
  return index < 0 ? undefined : index;
}

export function nextStagedBatchIndex(topology: LinearBiomeTopology): number {
  return topology.continuations.filter((continuation) => continuation.kind === 'batch').length;
}

export function stagedRoomIsAvailable(
  stage: StagedCandidatePoolDescriptor,
  gameName: string,
): boolean {
  return stage.roomGameNames.includes(gameName);
}
