import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { ExecutionAnomalyReplacement } from '../model';
import { ExecutionCompilerError } from '../assembler-errors';

/**
 * Assemble the one currently source-backed biome-specific execution fact.
 *
 * The normal target replacement remains owned by Doors/topology. This adapter
 * publishes only the G Anomaly's retained replacement provenance and authored
 * success result, which cannot be reconstructed from the replacement target.
 */
export function assembleGAnomalyReplacement(
  room: CanonicalAuthoredRoom,
): ExecutionAnomalyReplacement | undefined {
  if (room.anomalyReplacement === undefined) return undefined;
  if (room.origin.biomeKey !== 'G')
    throw new ExecutionCompilerError(
      'executionCoverageMissing',
      `${room.gameName} has an Anomaly replacement outside supported G execution`,
    );
  return Object.freeze({
    replacedRoomGameName: room.anomalyReplacement.replacedRoomGameName,
    success: room.anomalyReplacement.success,
  });
}
