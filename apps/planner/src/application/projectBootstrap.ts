import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectDocument } from '@run-planner/engine/authored-project';

import type { PlannerCapabilities } from './capabilities';
import { createAuthorableProjectDocument } from './projectDocuments';

export function createInitialProject(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
): ProjectDocument {
  return createAuthorableProjectDocument(catalog, capabilities, {
    projectId: 'run-plan',
    name: 'Run Plan',
  });
}
