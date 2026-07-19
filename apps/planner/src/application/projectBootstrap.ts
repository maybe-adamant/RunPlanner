import type { Catalog, ProjectDocument } from '@run-planner/core';

import type { PlannerCapabilities } from './capabilities';
import { createAuthorableProjectDocument } from './projectDocuments';

export function createFEditorSmokeProject(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
): ProjectDocument {
  return createAuthorableProjectDocument(catalog, capabilities, {
    projectId: 'f-editor-smoke',
    name: 'F Editor Smoke',
    configuredBiomeCounts: { Underworld: 1 },
  });
}
