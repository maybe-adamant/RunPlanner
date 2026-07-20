import type { Catalog, ProjectDocument } from '@run-planner/core';

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
