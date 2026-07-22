import type { Catalog, ProjectSimulationScope } from '@run-planner/core';

import {
  createPlannerCapabilities,
  type PlannerCapabilities,
  type PlannerCapabilityDefinition,
} from './capabilities';

export const activeCapabilityDefinition = Object.freeze({
  authorableBiomeKeys: Object.freeze(['F', 'G', 'H', 'I', 'N']),
  simulatableBiomeKeys: Object.freeze(['F', 'G', 'H', 'I', 'N']),
  editableBiomeKeys: Object.freeze(['F', 'G', 'H', 'I', 'N']),
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
