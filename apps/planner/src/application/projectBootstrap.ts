import type { Catalog, ProjectDocument } from '@run-planner/core';
import { createProjectDocument } from '@run-planner/core';

export function createFEditorSmokeProject(catalog: Catalog): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'f-editor-smoke',
    name: 'F Editor Smoke',
    configuredBiomeCounts: { Underworld: 1 },
  });
}
