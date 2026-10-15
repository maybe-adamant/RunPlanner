import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  type ExecutionPlan,
} from '@run-planner/engine/execution-plan';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';

import { loadProjectDocument } from '../persistence/projectDocumentLoader';
import { assertPublicProjectAdmission } from './project-admission';

/** The plan a project file compiles to, with the document as loaded (migrated when older). */
export interface ProjectFileCompilation {
  readonly plan: ExecutionPlan;
  readonly project: ProjectDocument;
}

/**
 * Compiles a project file headlessly, as a public project opened and sent would be: loaded
 * (migrated across majors), admitted, simulated and compiled through the execution-plan
 * assembly.
 */
export function compileProjectFile(
  catalog: Catalog,
  projectJson: string,
  options: { readonly displayName?: string; readonly internalRunModifiers?: boolean } = {},
): ProjectFileCompilation {
  const { project } = loadProjectDocument(projectJson, catalog);
  assertPublicProjectAdmission(catalog, project);
  const plan = compileExecutionPlan({
    product: assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, project),
      catalog,
      ...(options.internalRunModifiers === true ? { internalRunModifiers: true } : {}),
    }),
    ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
  });
  return Object.freeze({ plan, project });
}
