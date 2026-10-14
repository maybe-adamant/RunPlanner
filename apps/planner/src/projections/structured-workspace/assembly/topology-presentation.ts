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
