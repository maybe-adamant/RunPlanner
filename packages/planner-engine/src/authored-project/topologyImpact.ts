import type { BiomeTopology, ExitDecision, ExitDecisionSource, OccurrenceId } from './model';

/**
 * The command authority owns the structural consequences of removing one or
 * more occurrences. Consumers can describe that same consequence, but never
 * need to rediscover descendant topology from rendered state.
 */
export interface TopologyRemovalImpact {
  readonly removedExitDecisionSources: readonly ExitDecisionSource[];
  readonly removedHubDecisionKeys: readonly string[];
  readonly removedOccurrenceIds: readonly OccurrenceId[];
}

function sourceKey(source: ExitDecisionSource): string {
  return source.kind === 'occurrence'
    ? `occurrence:${source.occurrenceId}`
    : `hubDecision:${source.decisionKey}`;
}

function targetsForDecision(decision: ExitDecision): readonly OccurrenceId[] {
  return decision.normal.kind === 'linked'
    ? [decision.normal.occurrenceId]
    : decision.normal.targets.map((target) => target.occurrenceId);
}

function collectOccurrenceDescendants(
  topology: BiomeTopology,
  roots: ReadonlySet<OccurrenceId>,
): ReadonlySet<OccurrenceId> {
  const removed = new Set(roots);
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
      for (const occurrenceId of targetsForDecision(decision)) {
        if (!removed.has(occurrenceId)) {
          removed.add(occurrenceId);
          changed = true;
        }
      }
    }
  }
  return removed;
}

function impactFor(
  topology: BiomeTopology,
  removedOccurrences: ReadonlySet<OccurrenceId>,
  removedSourceKeys: ReadonlySet<string>,
  removedHubDecisionKeys: ReadonlySet<string>,
): TopologyRemovalImpact {
  return Object.freeze({
    removedExitDecisionSources: Object.freeze(
      topology.decisions.flatMap((decision) =>
        decision.kind === 'exit' &&
        (removedSourceKeys.has(sourceKey(decision.source)) ||
          (decision.source.kind === 'hubDecision' &&
            removedHubDecisionKeys.has(decision.source.decisionKey)))
          ? [decision.source]
          : [],
      ),
    ),
    removedHubDecisionKeys: Object.freeze(
      topology.decisions.flatMap((decision) =>
        decision.kind === 'hub' && removedHubDecisionKeys.has(decision.hubKey)
          ? [decision.hubKey]
          : [],
      ),
    ),
    removedOccurrenceIds: Object.freeze(
      topology.occurrences
        .filter((occurrence) => removedOccurrences.has(occurrence.occurrenceId))
        .map((occurrence) => occurrence.occurrenceId),
    ),
  });
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
  const removedOccurrences = collectOccurrenceDescendants(topology, rootOccurrenceIds);
  const removedSourceKeys = new Set(
    topology.decisions.flatMap((decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      removedOccurrences.has(decision.source.occurrenceId)
        ? [sourceKey(decision.source)]
        : [],
    ),
  );
  return impactFor(topology, removedOccurrences, removedSourceKeys, new Set());
}

/**
 * Describes the exact persisted topology cleared by ClearTopology. This is a
 * command-shaped impact rather than a rendered-tree traversal: it includes
 * unvisited Hub slots and any retained occurrence that is not on the selected
 * route spine.
 */
export function describeClearTopologyImpact(topology: BiomeTopology): TopologyRemovalImpact {
  return impactFor(
    topology,
    new Set(topology.occurrences.map((occurrence) => occurrence.occurrenceId)),
    new Set(
      topology.decisions.flatMap((decision) =>
        decision.kind === 'exit' ? [sourceKey(decision.source)] : [],
      ),
    ),
    new Set(
      topology.decisions.flatMap((decision) => (decision.kind === 'hub' ? [decision.hubKey] : [])),
    ),
  );
}

/**
 * Describes the semantic effect of RemoveExitDecision. Removing N's fixed
 * linked Opening -> PreHub exit also detaches its Hub board, every open Hub
 * occurrence, and the completed-Hub Preboss handoff. Removing a completed-Hub
 * exit itself does not remove the still-authored Hub board.
 */
export function describeExitDecisionRemovalImpact(
  topology: BiomeTopology,
  source: ExitDecisionSource,
): TopologyRemovalImpact | undefined {
  const root = topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' && sourceKey(decision.source) === sourceKey(source),
  );
  if (root === undefined) return undefined;

  const roots = new Set(targetsForDecision(root));
  const removedHubDecisionKeys = new Set<string>();
  const removedSourceKeys = new Set([sourceKey(root.source)]);
  const removesLinkedHubPrerequisite =
    root.normal.kind === 'linked' &&
    root.source.kind === 'occurrence' &&
    root.source.occurrenceId === topology.startOccurrenceId;

  if (removesLinkedHubPrerequisite) {
    for (const decision of topology.decisions) {
      if (decision.kind !== 'hub') continue;
      removedHubDecisionKeys.add(decision.hubKey);
      decision.openTargets.forEach((target) => roots.add(target.occurrenceId));
    }
    for (const decision of topology.decisions) {
      if (
        decision.kind !== 'exit' ||
        decision.source.kind !== 'hubDecision' ||
        !removedHubDecisionKeys.has(decision.source.decisionKey)
      ) {
        continue;
      }
      removedSourceKeys.add(sourceKey(decision.source));
      targetsForDecision(decision).forEach((occurrenceId) => roots.add(occurrenceId));
    }
  }

  const removedOccurrences = collectOccurrenceDescendants(topology, roots);
  for (const decision of topology.decisions) {
    if (
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      removedOccurrences.has(decision.source.occurrenceId)
    ) {
      removedSourceKeys.add(sourceKey(decision.source));
    }
  }
  return impactFor(topology, removedOccurrences, removedSourceKeys, removedHubDecisionKeys);
}

export function topologyRemovalSourceKeys(
  sources: readonly ExitDecisionSource[],
): ReadonlySet<string> {
  return new Set(sources.map(sourceKey));
}

/** Applies an already-described topology removal without rediscovering its scope. */
export function applyTopologyRemovalImpact(
  topology: BiomeTopology,
  impact: TopologyRemovalImpact,
): BiomeTopology {
  const removedOccurrences = new Set(impact.removedOccurrenceIds);
  const removedSources = topologyRemovalSourceKeys(impact.removedExitDecisionSources);
  const removedHubDecisionKeys = new Set(impact.removedHubDecisionKeys);
  return Object.freeze({
    ...topology,
    occurrences: Object.freeze(
      topology.occurrences.filter((occurrence) => !removedOccurrences.has(occurrence.occurrenceId)),
    ),
    decisions: Object.freeze(
      topology.decisions.filter((decision) => {
        if (decision.kind === 'hub') return !removedHubDecisionKeys.has(decision.hubKey);
        return (
          !removedSources.has(sourceKey(decision.source)) &&
          !(
            decision.source.kind === 'hubDecision' &&
            removedHubDecisionKeys.has(decision.source.decisionKey)
          )
        );
      }),
    ),
  });
}
