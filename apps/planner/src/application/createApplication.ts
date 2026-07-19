import { catalog } from '@run-planner/catalog';
import { summarizeCatalog } from '@run-planner/core';

import { createApplicationCapabilities } from './capabilityConfiguration';
import { createEditorNavigation } from './editorNavigation';
import { createFEditorSmokeProject } from './projectBootstrap';
import { createPlannerStore } from './store';

export function createApplication() {
  const capabilities = createApplicationCapabilities(catalog);
  const editorNavigation = createEditorNavigation(catalog, capabilities);
  const initialProject = createFEditorSmokeProject(catalog, capabilities);

  return {
    catalog,
    catalogSummary: summarizeCatalog(catalog),
    capabilities,
    editorNavigation,
    store: createPlannerStore({ catalog, capabilities, initialProject }),
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
