import {
  createExitDecisionAddress,
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  describeTopologyRemovalImpact,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type DeclaredPhysicalExit,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type OccurrenceId,
  type TopologyRemovalImpact,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';

import type { WorkspaceTopologyRemovalScope } from './contract';

/**
 * Shared presentation-level adaptation of a core removal impact. This owns no
 * decision enumeration or authoring policy, so decision and topology assembly
 * can consume it without depending on each other.
 */
export function workspaceTopologyRemovalScope(
  biome: BiomeAddress,
  impact: TopologyRemovalImpact,
): WorkspaceTopologyRemovalScope {
  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedHubDecisionKeys: impact.removedHubDecisionKeys,
    removedOccurrenceIds: impact.removedOccurrenceIds,
  });
}

/** A batch repair needs only the core-derived decision and occurrence scope. */
export function workspaceRemovalScopeForRoots(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  roots: ReadonlySet<OccurrenceId>,
):
  | {
      readonly removedDecisionOwners: readonly ExitDecisionAddress[];
      readonly removedOccurrenceIds: readonly OccurrenceId[];
    }
  | undefined {
  const topology = plan.topology;
  if (topology === null || roots.size === 0) return undefined;
  const impact = describeTopologyRemovalImpact(topology, roots);
  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedOccurrenceIds: impact.removedOccurrenceIds,
  });
}

/**
 * Physical-door policy remains pure-core authority. Workspace assembly only
 * adapts its declared result into a rendered target surface.
 */
export function workspaceDeclaredPhysicalExits(
  catalog: Catalog,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  source: ExitDecisionSourceAddress,
): readonly DeclaredPhysicalExit[] {
  if (plan.topology === null) return Object.freeze([]);
  return resolveDeclaredPhysicalExits(catalog, layout, plan.topology, source) ?? Object.freeze([]);
}

/**
 * Requirement production must distinguish an undeclared source from a source
 * whose declared physical-door set happens to be empty.
 */
export function workspaceDeclaredPhysicalExitKeys(
  catalog: Catalog,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  source: ExitDecisionSourceAddress,
): readonly string[] | undefined {
  if (plan.topology === null) return undefined;
  const exits = resolveDeclaredPhysicalExits(catalog, layout, plan.topology, source);
  return exits === undefined ? undefined : Object.freeze(exits.map((exit) => exit.exitKey));
}
