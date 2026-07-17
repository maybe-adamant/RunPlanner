import { catalog } from '@run-planner/catalog';
import { summarizeCatalog } from '@run-planner/core';

import { createPlannerStore } from './store';

export function createApplication() {
  return {
    catalog,
    catalogSummary: summarizeCatalog(catalog),
    store: createPlannerStore(),
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
