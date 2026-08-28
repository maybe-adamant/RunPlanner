import type {
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  HubDecision,
  OccurrenceId,
} from './model';

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

function targetsForDecision(
  topology: BiomeTopology,
  decision: ExitDecision,
): readonly OccurrenceId[] {
  const additional =
    decision.source.kind !== 'occurrence'
      ? Object.freeze([])
      : (() => {
          const sourceOccurrenceId = decision.source.occurrenceId;
          return (
            topology.occurrences.find(
              (occurrence) => occurrence.occurrenceId === sourceOccurrenceId,
            )?.additionalExits ?? Object.freeze([])
          );
        })();
  return Object.freeze([
    ...decision.normal.targets.map((target) => target.occurrenceId),
    ...additional.map((exit) => exit.occurrenceId),
  ]);
}

function exitSourceIsRemoved(
  source: ExitDecisionSource,
  removedOccurrences: ReadonlySet<OccurrenceId>,
  removedSourceKeys: ReadonlySet<string>,
  removedHubDecisionKeys: ReadonlySet<string>,
): boolean {
  return (
    removedSourceKeys.has(sourceKey(source)) ||
    (source.kind === 'occurrence' && removedOccurrences.has(source.occurrenceId)) ||
    (source.kind === 'hubDecision' && removedHubDecisionKeys.has(source.decisionKey))
  );
}

function hubSourceIsRemoved(
  source: ExitDecisionSource,
  removedOccurrences: ReadonlySet<OccurrenceId>,
  removedHubDecisionKeys: ReadonlySet<string>,
): boolean {
  return (
    (source.kind === 'occurrence' && removedOccurrences.has(source.occurrenceId)) ||
    (source.kind === 'hubDecision' && removedHubDecisionKeys.has(source.decisionKey))
  );
}

interface TopologyRemovalRoots {
  readonly occurrenceIds?: ReadonlySet<OccurrenceId>;
  readonly exitDecisionSources?: ReadonlySet<string>;
  readonly hubDecisionKeys?: ReadonlySet<string>;
}

/**
 * Follows the persisted ownership graph while a command removes topology.
 * Exit decisions own their targets, and a Hub decision owns both its open
 * slots and its completed-Hub handoff. A Hub source is an ordinary structural
 * owner, so deleting that source removes the whole Hub-owned branch without
 * relying on a biome-specific predecessor shape.
 */
function collectTopologyRemovalClosure(
  topology: BiomeTopology,
  roots: TopologyRemovalRoots,
): {
  readonly removedOccurrences: ReadonlySet<OccurrenceId>;
  readonly removedSourceKeys: ReadonlySet<string>;
  readonly removedHubDecisionKeys: ReadonlySet<string>;
} {
  const removedOccurrences = new Set(roots.occurrenceIds);
  const removedSourceKeys = new Set(roots.exitDecisionSources);
  const removedHubDecisionKeys = new Set(roots.hubDecisionKeys);
  let changed = true;

  while (changed) {
    changed = false;

    for (const decision of topology.decisions) {
      if (decision.kind !== 'exit') continue;
      if (
        !exitSourceIsRemoved(
          decision.source,
          removedOccurrences,
          removedSourceKeys,
          removedHubDecisionKeys,
        )
      ) {
        continue;
      }
      if (!removedSourceKeys.has(sourceKey(decision.source))) {
        removedSourceKeys.add(sourceKey(decision.source));
        changed = true;
      }
      for (const occurrenceId of targetsForDecision(topology, decision)) {
        if (!removedOccurrences.has(occurrenceId)) {
          removedOccurrences.add(occurrenceId);
          changed = true;
        }
      }
    }

    for (const decision of topology.decisions) {
      if (decision.kind !== 'hub') continue;
      if (
        !removedHubDecisionKeys.has(decision.hubKey) &&
        !hubSourceIsRemoved(decision.source, removedOccurrences, removedHubDecisionKeys)
      ) {
        continue;
      }
      if (!removedHubDecisionKeys.has(decision.hubKey)) {
        removedHubDecisionKeys.add(decision.hubKey);
        changed = true;
      }
      for (const target of decision.openTargets) {
        if (!removedOccurrences.has(target.occurrenceId)) {
          removedOccurrences.add(target.occurrenceId);
          changed = true;
        }
      }
    }

    for (const decision of topology.decisions) {
      if (decision.kind !== 'localVisit' || !removedOccurrences.has(decision.sourceOccurrenceId)) {
        continue;
      }
      for (const target of Object.values(decision.targetsBySlot)) {
        if (!removedOccurrences.has(target.occurrenceId)) {
          removedOccurrences.add(target.occurrenceId);
          changed = true;
        }
      }
    }

    for (const link of topology.fixedRoomLinks) {
      if (
        removedOccurrences.has(link.sourceOccurrenceId) &&
        !removedOccurrences.has(link.targetOccurrenceId)
      ) {
        removedOccurrences.add(link.targetOccurrenceId);
        changed = true;
      }
    }
  }

  return Object.freeze({
    removedOccurrences,
    removedSourceKeys,
    removedHubDecisionKeys,
  });
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
 * part of it, plus any Hub decision whose persisted source is in that
 * subtree. Explicit Hub removal starts from the Hub decision instead.
 */
export function describeTopologyRemovalImpact(
  topology: BiomeTopology,
  rootOccurrenceIds: ReadonlySet<OccurrenceId>,
): TopologyRemovalImpact {
  const closure = collectTopologyRemovalClosure(topology, {
    occurrenceIds: rootOccurrenceIds,
  });
  return impactFor(
    topology,
    closure.removedOccurrences,
    closure.removedSourceKeys,
    closure.removedHubDecisionKeys,
  );
}

/**
 * Describes the full topology consequence of closing a Hub slot. The Hub
 * decision itself stays authored and is updated by CloseHubSlot. Crossing the
 * declared open-set minimum additionally detaches the completed-Hub handoff
 * because the retained board is incomplete.
 */
export function describeHubSlotClosureImpact(
  topology: BiomeTopology,
  hubKey: string,
  hubSlotKey: string,
  minimumOpenCount: number,
): TopologyRemovalImpact | undefined {
  const hub = topology.decisions.find(
    (decision): decision is HubDecision => decision.kind === 'hub' && decision.hubKey === hubKey,
  );
  const target = hub?.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  if (hub === undefined || target === undefined) return undefined;

  // An undersized Hub remains an intentionally incomplete authored board, but
  // it can no longer own its completed-Hub exit.  Remove that handoff and its
  // selected subtree in the same CloseHubSlot impact as the detached slot.
  const removedExitDecisionSources = new Set<string>();
  if (hub.openTargets.length - 1 < minimumOpenCount) {
    const handoff = topology.decisions.find(
      (decision): decision is ExitDecision =>
        decision.kind === 'exit' &&
        decision.source.kind === 'hubDecision' &&
        decision.source.decisionKey === hubKey,
    );
    if (handoff !== undefined) {
      removedExitDecisionSources.add(sourceKey(handoff.source));
    }
  }
  const closure = collectTopologyRemovalClosure(topology, {
    occurrenceIds: new Set([target.occurrenceId]),
    exitDecisionSources: removedExitDecisionSources,
  });
  return impactFor(
    topology,
    closure.removedOccurrences,
    closure.removedSourceKeys,
    closure.removedHubDecisionKeys,
  );
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
 * Describes the semantic effect of RemoveExitDecision. If its removed targets
 * include a Hub source, the Hub board, every open Hub occurrence, and the
 * completed-Hub handoff are removed through that persisted ownership edge.
 * Removing a completed-Hub exit itself does not remove the still-authored
 * Hub board.
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

  const closure = collectTopologyRemovalClosure(topology, {
    exitDecisionSources: new Set([sourceKey(root.source)]),
  });
  return impactFor(
    topology,
    closure.removedOccurrences,
    closure.removedSourceKeys,
    closure.removedHubDecisionKeys,
  );
}

/**
 * Describes the authored topology exclusively owned by one Hub decision.
 * Its source occurrence is intentionally retained: RemoveHubDecision uses it
 * to restore the exact terminal envelope after this impact is applied.
 */
export function describeHubDecisionRemovalImpact(
  topology: BiomeTopology,
  hubKey: string,
): TopologyRemovalImpact | undefined {
  if (
    !topology.decisions.some(
      (decision): decision is HubDecision => decision.kind === 'hub' && decision.hubKey === hubKey,
    )
  ) {
    return undefined;
  }
  const closure = collectTopologyRemovalClosure(topology, {
    hubDecisionKeys: new Set([hubKey]),
  });
  return impactFor(
    topology,
    closure.removedOccurrences,
    closure.removedSourceKeys,
    closure.removedHubDecisionKeys,
  );
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
    fixedRoomLinks: Object.freeze(
      topology.fixedRoomLinks.filter(
        (link) =>
          !removedOccurrences.has(link.sourceOccurrenceId) &&
          !removedOccurrences.has(link.targetOccurrenceId),
      ),
    ),
    decisions: Object.freeze(
      topology.decisions.filter((decision) => {
        if (decision.kind === 'hub') return !removedHubDecisionKeys.has(decision.hubKey);
        if (decision.kind === 'localVisit') {
          return (
            !removedOccurrences.has(decision.sourceOccurrenceId) &&
            !Object.values(decision.targetsBySlot).some((target) =>
              removedOccurrences.has(target.occurrenceId),
            )
          );
        }
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
