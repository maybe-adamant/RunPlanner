import {
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  type AuthoredBiomePlan,
  type DeclaredPhysicalExit,
  type ExitDecisionSourceAddress,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';

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
