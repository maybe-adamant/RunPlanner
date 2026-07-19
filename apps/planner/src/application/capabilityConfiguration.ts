import type { Catalog } from '@run-planner/core';

import {
  createPlannerCapabilities,
  type PlannerCapabilities,
  type PlannerCapabilityDefinition,
} from './capabilities';

export const activeCapabilityDefinition = Object.freeze({
  authorableBiomeStepKeys: Object.freeze(['Underworld_F', 'Underworld_G']),
  simulatableBiomeStepKeys: Object.freeze([]),
  editableBiomeStepKeys: Object.freeze(['Underworld_F']),
}) satisfies PlannerCapabilityDefinition;

export function createApplicationCapabilities(catalog: Catalog): PlannerCapabilities {
  return createPlannerCapabilities(catalog, activeCapabilityDefinition);
}
