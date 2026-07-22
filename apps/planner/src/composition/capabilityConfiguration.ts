import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectSimulationScope } from '@run-planner/engine/simulation';

import {
  createPlannerCapabilities,
  type PlannerCapabilities,
  type PlannerCapabilityDefinition,
} from './capabilities';

export const activeCapabilityDefinition = Object.freeze({
  authorableBiomeKeys: Object.freeze(['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q']),
  simulatableBiomeKeys: Object.freeze(['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q']),
  editableBiomeKeys: Object.freeze(['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q']),
}) satisfies PlannerCapabilityDefinition;

export function createApplicationCapabilities(catalog: Catalog): PlannerCapabilities {
  return createPlannerCapabilities(catalog, activeCapabilityDefinition);
}

export function createProjectSimulationScope(
  capabilities: PlannerCapabilities,
): ProjectSimulationScope {
  return Object.freeze({
    simulatableBiomeKeys: Object.freeze(
      capabilities.values
        .filter((capability) => capability.simulatable)
        .map((capability) => capability.biomeKey),
    ),
  });
}
