import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectCommand, ProjectDocument } from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';

/** One edit settled as the editor's history settles it, so a swapped room's doors follow it. */
export function settleTestEdit(project: ProjectDocument, command: ProjectCommand): ProjectDocument {
  const evaluate = (document: ProjectDocument) => simulateProjectAssembly(catalog, document);
  return settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly
    .project;
}
