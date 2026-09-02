import { semanticAddressKey, type SemanticAddress } from '../authored-project/addresses';

/** Planner-owned disposition for one room-session owner. */
export interface PlannerTimelineNode {
  readonly owner: SemanticAddress;
  /** Whether the owner is emitted into the execution DAG. */
  readonly included: boolean;
  /** Whether completion is required at its lifecycle checkpoint. */
  readonly required: boolean;
}

/** Exact owner-to-owner prerequisite published by planner evaluation. */
export interface PlannerTimelineDependency {
  readonly owner: SemanticAddress;
  readonly afterOwner: SemanticAddress;
}

/** Sparse execution facts; the authored Timeline remains the simulation order. */
export interface PlannerTimelineFacts {
  readonly nodes: readonly PlannerTimelineNode[];
  readonly dependencies: readonly PlannerTimelineDependency[];
}

export const EMPTY_PLANNER_TIMELINE_FACTS: PlannerTimelineFacts = Object.freeze({
  nodes: Object.freeze([]),
  dependencies: Object.freeze([]),
});

export function mergePlannerTimelineFacts(
  ...facts: readonly PlannerTimelineFacts[]
): PlannerTimelineFacts {
  const nodes = new Map<string, PlannerTimelineNode>();
  const dependencies = new Map<string, PlannerTimelineDependency>();
  for (const fact of facts) {
    for (const node of fact.nodes) {
      const key = semanticAddressKey(node.owner);
      const current = nodes.get(key);
      if (current === undefined) nodes.set(key, node);
      else
        nodes.set(
          key,
          Object.freeze({
            owner: current.owner,
            included: current.included || node.included,
            required: current.required || node.required,
          }),
        );
    }
    for (const dependency of fact.dependencies) {
      if (semanticAddressKey(dependency.owner) === semanticAddressKey(dependency.afterOwner))
        continue;
      dependencies.set(
        `${semanticAddressKey(dependency.owner)}\u0000${semanticAddressKey(dependency.afterOwner)}`,
        dependency,
      );
    }
  }
  return Object.freeze({
    nodes: Object.freeze([...nodes.values()]),
    dependencies: Object.freeze([...dependencies.values()]),
  });
}
