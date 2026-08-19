import type { Catalog } from '@run-planner/engine/catalog-schema';
import { createProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

export function createInitialProject(catalog: Catalog): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'run-plan',
  });
}
