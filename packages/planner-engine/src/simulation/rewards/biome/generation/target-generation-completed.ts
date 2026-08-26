import {
  createBiomeAddress,
  createTargetAddress,
  type ExitDecisionAddress,
  type TargetAddress,
} from '../../../../authored-project/addresses';
import type { HistoryEvent } from '../../../history';

export interface TargetGenerationFrontier {
  readonly origin: ExitDecisionAddress;
  readonly exitKeys: readonly string[];
}

export interface TargetGenerationCompletedTransition {
  readonly nextTargetHistory?: TargetAddress;
}

/**
 * Resolves the one following target checkpoint from an already-created target
 * generation. The chronology coordinator remains responsible for recording
 * the history at that checkpoint and for advancing its branch cohort.
 */
export function applyTargetGenerationCompletedTransition(
  event: Extract<HistoryEvent, { readonly kind: 'targetGenerationCompleted' }>,
  generation: TargetGenerationFrontier | undefined,
): TargetGenerationCompletedTransition {
  if (event.origin.kind !== 'target' || generation === undefined) return Object.freeze({});
  const currentOffset = generation.exitKeys.indexOf(event.origin.exitKey);
  if (currentOffset + 1 !== event.generationIndex) return Object.freeze({});
  const nextExitKey = generation.exitKeys[currentOffset + 1];
  if (nextExitKey === undefined) return Object.freeze({});
  return Object.freeze({
    nextTargetHistory: createTargetAddress(
      createBiomeAddress(generation.origin.routeKey, generation.origin.biomeKey),
      generation.origin.source,
      nextExitKey,
    ),
  });
}
