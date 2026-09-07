import { semanticAddressKey } from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import type { WorkspaceInspectorDestination } from '../contract';

/** Feedback consumes the completed navigation destination, never origin ancestry. */
export function indexFindingsByRepairTarget(
  findings: readonly SemanticFinding[],
  destinations: ReadonlyMap<string, WorkspaceInspectorDestination>,
): ReadonlyMap<string, readonly SemanticFinding[]> {
  const result = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const destination = destinations.get(semanticAddressKey(finding.origin));
    if (destination === undefined) continue;
    const key = semanticAddressKey(destination.focusAddress);
    const group = result.get(key) ?? [];
    group.push(finding);
    result.set(key, group);
  }
  return new Map([...result].map(([key, group]) => [key, Object.freeze(group)]));
}
