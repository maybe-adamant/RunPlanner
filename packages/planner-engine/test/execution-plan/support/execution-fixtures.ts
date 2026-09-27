import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { format, resolveConfig } from 'prettier';

import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import {
  createCompleteFGAnomalyProject,
  createCompleteFGProject,
} from '@run-planner/test-fixtures/underworld';
import {
  loadUnderworldArachneCocoonsCheckpoint,
  loadUnderworldAutomaticBossCheckpoint,
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
  loadUnderworldGAnomalyRosterCheckpoint,
  loadUnderworldGeneratedCompositionCheckpoint,
  loadUnderworldIxionChaosCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadDreamMixedHandoffCheckpoint } from '@run-planner/test-fixtures/checkpoints/dream';
import {
  loadSurfaceNPhialIntermediateFountainCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadSurfaceNProject,
  loadSurfaceNOProject,
  loadSurfaceNOPProject,
  surfaceGeneratedPreCombatProject,
  typhonCustomizationProject,
} from '@run-planner/test-fixtures/surface';

import { assembleExecutionProduct } from '../../../src/execution-plan/assembler';
import { compileExecutionPlan } from '../../../src/execution-plan/compiler';
import { encodeExecutionPlan } from '../../../src/execution-plan/codec';
import { simulateProjectAssembly } from '../../../src/simulation';
import { surfaceQShopCorrelationProject } from './surface-q-shop-correlation-fixture';
import { npcShoppingProtectionProject } from './npc-shopping-fixture';
import automaticBossFixture from '../fixtures/automatic-boss.execution.json';
import dreamMixedPrefixFixture from '../fixtures/dream-mixed-prefix.execution.json';
import fOpeningFixture from '../fixtures/f-opening.execution.json';
import fgFixture from '../fixtures/fg.execution.json';
import fgAnomalyFixture from '../fixtures/fg-anomaly.execution.json';
import fgAnomalyRosterFixture from '../fixtures/fg-anomaly-roster.execution.json';
import fgIxionChaosFixture from '../fixtures/fg-ixion-chaos.execution.json';
import fgNpcShoppingProtectionFixture from '../fixtures/fg-npc-shopping-protection.execution.json';
import surfaceGeneratedPrecombatFixture from '../fixtures/surface-generated-precombat.execution.json';
import surfaceNPhialIntermediateFountainFixture from '../fixtures/surface-n-phial-intermediate-fountain.execution.json';
import surfaceNFixture from '../fixtures/surface-n.execution.json';
import surfaceNOFixture from '../fixtures/surface-no.execution.json';
import surfaceNOPFixture from '../fixtures/surface-nop.execution.json';
import surfaceNOPQFixture from '../fixtures/surface-nopq.execution.json';
import surfaceQShopCorrelationFixture from '../fixtures/surface-q-shop-correlation.execution.json';
import surfaceScheduledLifecycleFixture from '../fixtures/surface-scheduled-lifecycle.execution.json';
import underworldArachneCocoonsFixture from '../fixtures/underworld-arachne-cocoons.execution.json';
import underworldFGHFixture from '../fixtures/underworld-fgh.execution.json';
import underworldFGHIFixture from '../fixtures/underworld-fghi.execution.json';
import underworldGeneratedCompositionFixture from '../fixtures/underworld-generated-composition.execution.json';

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
interface ExecutionFixture {
  readonly name: string;
  readonly project: () => ProjectDocument;
  readonly wire: unknown;
}

export const executionFixtures: readonly ExecutionFixture[] = Object.freeze([
  { name: 'f-opening', project: fOnlyProject, wire: fOpeningFixture },
  { name: 'fg', project: createCompleteFGProject, wire: fgFixture },
  {
    name: 'fg-npc-shopping-protection',
    project: npcShoppingProtectionProject,
    wire: fgNpcShoppingProtectionFixture,
  },
  { name: 'underworld-fgh', project: loadUnderworldFGHCheckpoint, wire: underworldFGHFixture },
  {
    name: 'underworld-fghi',
    project: loadUnderworldFGHICheckpoint,
    wire: underworldFGHIFixture,
  },
  {
    name: 'fg-ixion-chaos',
    project: loadUnderworldIxionChaosCheckpoint,
    wire: fgIxionChaosFixture,
  },
  { name: 'fg-anomaly', project: createCompleteFGAnomalyProject, wire: fgAnomalyFixture },
  {
    name: 'fg-anomaly-roster',
    project: loadUnderworldGAnomalyRosterCheckpoint,
    wire: fgAnomalyRosterFixture,
  },
  {
    name: 'automatic-boss',
    project: loadUnderworldAutomaticBossCheckpoint,
    wire: automaticBossFixture,
  },
  { name: 'surface-n', project: loadSurfaceNProject, wire: surfaceNFixture },
  { name: 'surface-no', project: loadSurfaceNOProject, wire: surfaceNOFixture },
  { name: 'surface-nop', project: loadSurfaceNOPProject, wire: surfaceNOPFixture },
  { name: 'surface-nopq', project: typhonCustomizationProject, wire: surfaceNOPQFixture },
  {
    name: 'surface-q-shop-correlation',
    project: surfaceQShopCorrelationProject,
    wire: surfaceQShopCorrelationFixture,
  },
  {
    name: 'dream-mixed-prefix',
    project: loadDreamMixedHandoffCheckpoint,
    wire: dreamMixedPrefixFixture,
  },
  {
    name: 'surface-scheduled-lifecycle',
    project: loadSurfaceScheduledLifecycleCheckpoint,
    wire: surfaceScheduledLifecycleFixture,
  },
  {
    name: 'underworld-generated-composition',
    project: loadUnderworldGeneratedCompositionCheckpoint,
    wire: underworldGeneratedCompositionFixture,
  },
  {
    name: 'surface-generated-precombat',
    project: surfaceGeneratedPreCombatProject,
    wire: surfaceGeneratedPrecombatFixture,
  },
  {
    name: 'underworld-arachne-cocoons',
    project: loadUnderworldArachneCocoonsCheckpoint,
    wire: underworldArachneCocoonsFixture,
  },
  {
    name: 'surface-n-phial-intermediate-fountain',
    project: loadSurfaceNPhialIntermediateFountainCheckpoint,
    wire: surfaceNPhialIntermediateFountainFixture,
  },
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
export async function buildExecutionFixture(
  fixture: ExecutionFixture,
): Promise<
  Readonly<{ readonly bytes: string; readonly plan: ReturnType<typeof compileExecutionPlan> }>
> {
  const assembly = simulateProjectAssembly(catalog, fixture.project());
  const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
  const filepath = executionFixturePath(fixture.name);
  const options = await resolveConfig(filepath);
  const bytes = await format(encodeExecutionPlan(plan), { ...options, filepath });
  return Object.freeze({ bytes, plan });
}
