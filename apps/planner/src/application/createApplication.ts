import { catalog } from '@run-planner/catalog';
import { simulateProject, summarizeCatalog, type ProjectDocument } from '@run-planner/core';

import { createApplicationCapabilities } from './capabilityConfiguration';
import { createEditorNavigation } from './editorNavigation';
import { createFEditorSmokeProject } from './projectBootstrap';
import { createPlannerStore } from './store';

export function createApplication() {
  const capabilities = createApplicationCapabilities(catalog);
  const editorNavigation = createEditorNavigation(catalog, capabilities);
  const initialProject = createFEditorSmokeProject(catalog, capabilities);
  const evaluateProject = (project: ProjectDocument) => simulateProject(catalog, project);

  return {
    catalog,
    catalogSummary: summarizeCatalog(catalog),
    capabilities,
    editorNavigation,
    store: createPlannerStore({ catalog, capabilities, evaluateProject, initialProject }),
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
