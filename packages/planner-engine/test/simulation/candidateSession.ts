import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  type ProjectCandidateSession,
  type ProjectCandidateSessionOptions,
} from '@run-planner/engine/simulation';

export function bindTestCandidateSession(
  catalog: Catalog,
  project: ProjectDocument,
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  return createPreparedProjectCandidateSession(
    catalog,
    project,
    simulateProject(catalog, project),
    options,
  );
}
