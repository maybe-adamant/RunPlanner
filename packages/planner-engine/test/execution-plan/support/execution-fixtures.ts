import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { format, resolveConfig } from 'prettier';

import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createRouteAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGAnomalyProject,
  createCompleteFGProject,
  createEchoGoldIAnvilDuplicateProject,
  echoGoldIDuplicateAnvilResult,
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
  dreamOSkippedShipProject,
  dreamSingleQShrineDeliveryProject,
} from '@run-planner/test-fixtures/dream';
import { createFreshFileRouteProject } from '@run-planner/test-fixtures/fresh-file';
import {
  loadSurfaceNPhialIntermediateFountainCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadSurfaceNProject,
  loadSurfaceNOProject,
  loadSurfaceNOPProject,
  surfaceGeneratedPreCombatProject,
  surfaceShrineDeliveriesProject,
  surfaceShrineRushedUnrankedProject,
  surfaceTravelDealRefillAnvilProject,
  typhonCustomizationProject,
} from '@run-planner/test-fixtures/surface';

import { assembleExecutionProduct } from '../../../src/execution-plan/assembler';
import { compileExecutionPlan } from '../../../src/execution-plan/compiler';
import { encodeExecutionPlan } from '../../../src/execution-plan/codec';
import { simulateProjectAssembly } from '../../../src/simulation';
import { surfaceQShopCorrelationProject } from './surface-q-shop-correlation-fixture';
import { npcShoppingProtectionProject } from './npc-shopping-fixture';
import { emptyShopGroupCatalog, emptyShopGroupProject } from './empty-shop-group-fixture';
import automaticBossFixture from '../fixtures/automatic-boss.execution.json';
import dreamMixedPrefixFixture from '../fixtures/dream-mixed-prefix.execution.json';
import dreamOSkippedShipFixture from '../fixtures/dream-o-skipped-ship.execution.json';
import dreamShrinePendingFixture from '../fixtures/dream-shrine-pending.execution.json';
import fOpeningFixture from '../fixtures/f-opening.execution.json';
import runModifiersFixture from '../fixtures/run-modifiers.execution.json';
import fgFixture from '../fixtures/fg.execution.json';
import fgAnomalyFixture from '../fixtures/fg-anomaly.execution.json';
import fgAnomalyRosterFixture from '../fixtures/fg-anomaly-roster.execution.json';
import fgIxionChaosFixture from '../fixtures/fg-ixion-chaos.execution.json';
import fgNpcShoppingProtectionFixture from '../fixtures/fg-npc-shopping-protection.execution.json';
import freshFileFGHIFixture from '../fixtures/fresh-file-fghi.execution.json';
import surfaceGeneratedPrecombatFixture from '../fixtures/surface-generated-precombat.execution.json';
import surfaceNPhialIntermediateFountainFixture from '../fixtures/surface-n-phial-intermediate-fountain.execution.json';
import surfaceNFixture from '../fixtures/surface-n.execution.json';
import surfaceNOFixture from '../fixtures/surface-no.execution.json';
import surfaceNOPFixture from '../fixtures/surface-nop.execution.json';
import surfaceNOPQFixture from '../fixtures/surface-nopq.execution.json';
import surfaceQShopCorrelationFixture from '../fixtures/surface-q-shop-correlation.execution.json';
import surfaceScheduledLifecycleFixture from '../fixtures/surface-scheduled-lifecycle.execution.json';
import surfaceShrineDeliveriesFixture from '../fixtures/surface-shrine-deliveries.execution.json';
import surfaceShrineRushedUnrankedFixture from '../fixtures/surface-shrine-rushed-unranked.execution.json';
import surfaceTravelDealRefillAnvilFixture from '../fixtures/surface-travel-deal-refill-anvil.execution.json';
import underworldArachneCocoonsFixture from '../fixtures/underworld-arachne-cocoons.execution.json';
import underworldFGHFixture from '../fixtures/underworld-fgh.execution.json';
import underworldFGHIFixture from '../fixtures/underworld-fghi.execution.json';
import underworldFGHIEmptyShopGroupFixture from '../fixtures/underworld-fghi-empty-shop-group.execution.json';
import underworldGeneratedCompositionFixture from '../fixtures/underworld-generated-composition.execution.json';
import underworldEchoGoldAnvilDuplicateFixture from '../fixtures/underworld-echo-gold-anvil-duplicate.execution.json';

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function positionedIxionChaosProject(): ProjectDocument {
  return applyProjectCommand(loadUnderworldIxionChaosCheckpoint(), catalog, {
    kind: 'SetChaosSpawnPoint',
    additional: createAdditionalExitAddress(
      createBiomeAddress('Underworld', 'G'),
      createOccurrenceId('golden-g-intro'),
      'chaos',
    ),
    spawnPointIndex: 1,
  });
}

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
  /** A test-only catalog context; production declarations otherwise. */
  readonly catalog?: () => Catalog;
}

export function runModifiersProject(): ProjectDocument {
  return applyProjectCommand(fOnlyProject(), catalog, {
    kind: 'ReplaceRunModifiers',
    route: createRouteAddress('Underworld'),
    value: { enemyGoldDropChance: 40, encounterGoldRange: 25 },
  });
}

function echoGoldAnvilDuplicateProject(): ProjectDocument {
  return createEchoGoldIAnvilDuplicateProject(echoGoldIDuplicateAnvilResult);
}

export const executionFixtures: readonly ExecutionFixture[] = Object.freeze([
  { name: 'run-modifiers', project: runModifiersProject, wire: runModifiersFixture },
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
    name: 'underworld-fghi-empty-shop-group',
    project: emptyShopGroupProject,
    wire: underworldFGHIEmptyShopGroupFixture,
    catalog: emptyShopGroupCatalog,
  },
  {
    name: 'fresh-file-fghi',
    project: createFreshFileRouteProject,
    wire: freshFileFGHIFixture,
  },
  {
    name: 'fg-ixion-chaos',
    project: positionedIxionChaosProject,
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
  {
    name: 'surface-shrine-deliveries',
    project: surfaceShrineDeliveriesProject,
    wire: surfaceShrineDeliveriesFixture,
  },
  {
    name: 'surface-shrine-rushed-unranked',
    project: surfaceShrineRushedUnrankedProject,
    wire: surfaceShrineRushedUnrankedFixture,
  },
  {
    name: 'dream-shrine-pending',
    project: dreamSingleQShrineDeliveryProject,
    wire: dreamShrinePendingFixture,
  },
  {
    name: 'underworld-echo-gold-anvil-duplicate',
    project: echoGoldAnvilDuplicateProject,
    wire: underworldEchoGoldAnvilDuplicateFixture,
  },
  {
    name: 'surface-travel-deal-refill-anvil',
    project: surfaceTravelDealRefillAnvilProject,
    wire: surfaceTravelDealRefillAnvilFixture,
  },
  {
    name: 'dream-o-skipped-ship',
    project: dreamOSkippedShipProject,
    wire: dreamOSkippedShipFixture,
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
  const fixtureCatalog = fixture.catalog?.() ?? catalog;
  const assembly = simulateProjectAssembly(fixtureCatalog, fixture.project());
  const plan = compileExecutionPlan({
    product: assembleExecutionProduct({ assembly, catalog: fixtureCatalog }),
  });
  const filepath = executionFixturePath(fixture.name);
  const options = await resolveConfig(filepath);
  const bytes = await format(encodeExecutionPlan(plan), { ...options, filepath });
  return Object.freeze({ bytes, plan });
}
