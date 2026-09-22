import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { format, resolveConfig } from 'prettier';

import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import {
  createCompleteFGAnomalyProject,
  createCompleteFGIxionChaosProject,
  createCompleteFGProject,
} from '@run-planner/test-fixtures/underworld';
import {
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNOProject, loadSurfaceNOPProject } from '@run-planner/test-fixtures/surface';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';

import { assembleExecutionProduct } from '../../../src/execution-plan/assembler';
import { compileExecutionPlan } from '../../../src/execution-plan/compiler';
import { encodeExecutionPlan } from '../../../src/execution-plan/codec';
import { simulateProjectAssembly } from '../../../src/simulation';
import { bossAutomaticOutcomeProject } from './automatic-fixture';
import { surfaceScheduledLifecycleProject } from './scheduled-lifecycle-fixture';
import { typhonCustomizationProject } from './typhon-customization-fixture';

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/** The F-only prefix the compiler suite compiles; it owns no separate builder. */
function fOnlyProject(): ProjectDocument {
  const project = createCompleteFGProject();
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.slice(0, 1)),
    }),
  });
}

/**
 * Every committed execution fixture with the builder that owns its semantic
 * content. Regeneration and byte stability read this one table, so a fixture
 * can neither be regenerated from a different project nor drift unwatched.
 */
export const executionFixtures: readonly {
  readonly name: string;
  readonly project: () => ProjectDocument;
}[] = Object.freeze([
  { name: 'f-opening', project: fOnlyProject },
  { name: 'fg', project: createCompleteFGProject },
  { name: 'underworld-fgh', project: loadUnderworldFGHCheckpoint },
  { name: 'underworld-fghi', project: loadUnderworldFGHICheckpoint },
  { name: 'fg-ixion-chaos', project: createCompleteFGIxionChaosProject },
  { name: 'fg-anomaly', project: createCompleteFGAnomalyProject },
  { name: 'automatic-boss', project: bossAutomaticOutcomeProject },
  { name: 'surface-no', project: loadSurfaceNOProject },
  { name: 'surface-nop', project: loadSurfaceNOPProject },
  { name: 'surface-nopq', project: typhonCustomizationProject },
  { name: 'dream-mixed-prefix', project: dreamMixedHandoffProject },
  { name: 'surface-scheduled-lifecycle', project: surfaceScheduledLifecycleProject },
]);

export function executionFixturePath(name: string): string {
  return join(fixtureDirectory, `${name}.execution.json`);
}

/**
 * The exact committed bytes for one fixture: the owning builder's plan through
 * the production wire encoder, then Prettier with the destination path's own
 * resolved configuration. The encoder emits one minified line, so Prettier
 * decides every line break; that is the canonical pre-print for all fixtures.
 */
export async function executionFixtureBytes(
  name: string,
  project: ProjectDocument,
): Promise<string> {
  const assembly = simulateProjectAssembly(catalog, project);
  const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
  const filepath = executionFixturePath(name);
  const options = await resolveConfig(filepath);
  return format(encodeExecutionPlan(plan), { ...options, filepath });
}
