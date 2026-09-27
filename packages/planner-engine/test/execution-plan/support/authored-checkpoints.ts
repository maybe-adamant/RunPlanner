import { expect } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '../../../src/authored-project';
import { assembleExecutionProduct, compileExecutionPlan } from '../../../src/execution-plan';
import { simulateProjectAssembly } from '../../../src/simulation';

export function compileEligibleProject(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}

export function reloadProject(project: ProjectDocument): ProjectDocument {
  return decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
}
