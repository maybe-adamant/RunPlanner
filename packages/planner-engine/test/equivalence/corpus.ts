import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import {
  createCompleteFGAnomalyProject,
  createCompleteFGIxionChaosProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  createGoldenFGHIProject,
  createGoldenFGHProject,
  createUnderworldFPoolCheckpoint,
  createUnderworldFWellCheckpoint,
} from '@run-planner/test-fixtures/underworld';
import {
  createRepresentativeNOPQShopTraitProject,
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  createSurfaceNShrineSideRoomDeliveryCheckpoint,
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
  loadSurfaceNOPQProject,
  surfaceAnvilProject,
  surfaceEncounterShowcaseProject,
  surfaceOrdinaryHexPathProject,
  surfaceSeleneHexPathProject,
  surfaceShrineTravelDealProject,
} from '@run-planner/test-fixtures/surface';
import {
  createFreshFileFProject,
  createFreshFileFirstSequence,
  createFreshFileGeneratedComposition,
  createFreshFileRouteProject,
  createMatureCombat01Sequence,
  freshFileRouteFrontierWalk,
  withNewHFieldsRoom,
} from '@run-planner/test-fixtures/fresh-file';

import { executionFixtures } from '../execution-plan/support/execution-fixtures';

export interface EquivalenceEntry {
  readonly name: string;
  readonly catalog: Catalog;
  readonly project: () => ProjectDocument;
}

const entry = (
  name: string,
  project: () => ProjectDocument,
  entryCatalog: Catalog = catalog,
): EquivalenceEntry => Object.freeze({ name, project, catalog: entryCatalog });

/**
 * Every project the equivalence lane hashes, each built through its owning
 * fixture builder. Names are stable baseline keys.
 */
export function equivalenceCorpus(): readonly EquivalenceEntry[] {
  const frontier = freshFileRouteFrontierWalk();
  return Object.freeze([
    ...executionFixtures.map((fixture) =>
      entry(`execution/${fixture.name}`, fixture.project, fixture.catalog?.() ?? catalog),
    ),
    ...checkpointRegistry.map(({ entry: checkpoint, load }) =>
      entry(`checkpoint/${checkpoint.id}`, load),
    ),
    entry('underworld/createGoldenFGHProject', createGoldenFGHProject),
    entry('underworld/createGoldenFGHIProject', createGoldenFGHIProject),
    entry('underworld/createCompleteFGProject', () => createCompleteFGProject()),
    entry('underworld/createCompleteFGAnomalyProject(true)', () =>
      createCompleteFGAnomalyProject(true),
    ),
    entry('underworld/createCompleteFGAnomalyProject(false)', () =>
      createCompleteFGAnomalyProject(false),
    ),
    entry('underworld/createCompleteFGIxionChaosProject', createCompleteFGIxionChaosProject),
    entry('underworld/createUnderworldFWellCheckpoint', () => createUnderworldFWellCheckpoint()),
    entry('underworld/createUnderworldFPoolCheckpoint', createUnderworldFPoolCheckpoint),
    ...(['GiftDrop', 'MetaCurrencyDrop', 'MetaCardPointsCommonDrop'] as const).map((rewardType) =>
      entry(
        `underworld/createFConversionFrontierProject(${rewardType})`,
        () => createFConversionFrontierProject(rewardType).project,
      ),
    ),
    entry('surface/loadSurfaceNOPQProject', loadSurfaceNOPQProject),
    entry('surface/surfaceAnvilProject', surfaceAnvilProject),
    entry('surface/createSurfaceNOHermesShrineDeliveryCheckpoint', () =>
      createSurfaceNOHermesShrineDeliveryCheckpoint(),
    ),
    entry('surface/surfaceShrineTravelDealProject', surfaceShrineTravelDealProject),
    entry(
      'surface/createSurfaceNShrineSideRoomDeliveryCheckpoint',
      createSurfaceNShrineSideRoomDeliveryCheckpoint,
    ),
    entry(
      'surface/createSurfaceNUnresolvedBossHermesDeliveryCheckpoint',
      createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
    ),
    entry('surface/surfaceEncounterShowcaseProject', surfaceEncounterShowcaseProject),
    entry(
      'surface/createRepresentativeNOPQShopTraitProject',
      createRepresentativeNOPQShopTraitProject,
    ),
    entry('surface/surfaceOrdinaryHexPathProject', surfaceOrdinaryHexPathProject),
    entry('surface/surfaceSeleneHexPathProject', surfaceSeleneHexPathProject),
    entry('fresh-file/createFreshFileRouteProject', createFreshFileRouteProject),
    entry('fresh-file/createFreshFileFProject', createFreshFileFProject),
    entry('fresh-file/createFreshFileFirstSequence', () => createFreshFileFirstSequence()),
    entry('fresh-file/createMatureCombat01Sequence', createMatureCombat01Sequence),
    entry('fresh-file/createFreshFileGeneratedComposition', createFreshFileGeneratedComposition),
    ...(['min', 'max'] as const).map((cageOutcome) =>
      entry(`fresh-file/withNewHFieldsRoom(${cageOutcome})`, () =>
        withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', cageOutcome),
      ),
    ),
    ...frontier.map((document, index) =>
      entry(`fresh-file/frontier/${String(index).padStart(2, '0')}`, () => document),
    ),
  ]);
}
