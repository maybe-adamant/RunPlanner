import type { BiomeTopology, ExitDecisionSource, OccurrenceId } from './model';

/**
 * The command authority owns the structural consequences of removing one or
 * more occurrences. Consumers can describe that same consequence, but never
 * need to rediscover descendant topology from rendered state.
 */
export interface TopologyRemovalImpact {
  readonly removedExitDecisionSources: readonly ExitDecisionSource[];
  readonly removedOccurrenceIds: readonly OccurrenceId[];
}

function sourceKey(source: ExitDecisionSource): string {
  return source.kind === 'occurrence'
    ? `occurrence:${source.occurrenceId}`
    : `hubDecision:${source.decisionKey}`;
}

/**
 * Returns the complete occurrence subtree and every exit decision that owns
 * part of it. Hub decisions are not occurrence descendants and remain owned
 * by their explicit Hub commands.
 */
export function describeTopologyRemovalImpact(
  topology: BiomeTopology,
  rootOccurrenceIds: ReadonlySet<OccurrenceId>,
): TopologyRemovalImpact {
  const removed = new Set(rootOccurrenceIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const decision of topology.decisions) {
      if (
        decision.kind !== 'exit' ||
        decision.source.kind !== 'occurrence' ||
        !removed.has(decision.source.occurrenceId)
      ) {
        continue;
      }
      const targets =
        decision.normal.kind === 'linked'
          ? [decision.normal.occurrenceId]
          : decision.normal.targets.map((target) => target.occurrenceId);
      for (const occurrenceId of targets) {
        if (!removed.has(occurrenceId)) {
          removed.add(occurrenceId);
          changed = true;
        }
      }
    }
  }
  return Object.freeze({
    removedExitDecisionSources: Object.freeze(
      topology.decisions.flatMap((decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        removed.has(decision.source.occurrenceId)
          ? [decision.source]
          : [],
      ),
    ),
    removedOccurrenceIds: Object.freeze(
      topology.occurrences
        .filter((occurrence) => removed.has(occurrence.occurrenceId))
        .map((occurrence) => occurrence.occurrenceId),
    ),
  });
}

export function topologyRemovalSourceKeys(
  sources: readonly ExitDecisionSource[],
): ReadonlySet<string> {
  return new Set(sources.map(sourceKey));
}
