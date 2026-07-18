import { catalog } from '@run-planner/catalog';
import { summarizeCatalog } from '@run-planner/core';

import { createFEditorSmokeProject } from './projectBootstrap';
import { createPlannerStore } from './store';

export function createApplication() {
  const initialProject = createFEditorSmokeProject(catalog);

  return {
    catalog,
    catalogSummary: summarizeCatalog(catalog),
    store: createPlannerStore({ catalog, initialProject }),
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
