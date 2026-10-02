import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import {
  createCompleteFGAnomalyProject,
  createCompleteFGIxionChaosProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  createFInvalidLaterConversionProject,
  createFMidshopUnresolvedBlindBoxBeforePomProject,
  createGContractAvailabilityProject,
  createGoldenFGHIProject,
  createGoldenFGHProject,
  createUnderworldFPoolCheckpoint,
  createUnderworldFWellCheckpoint,
  loadUnderworldFMidshopPomFrontierProject,
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
  withRetainedFreshFileIntroCustomization,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

import { executionFixtures } from '../execution-plan/support/execution-fixtures';
import {
  createEchoHammerReplayMissingProject,
  createFPoolSaleClearedProject,
  freshFileHFieldsIssueSteps,
} from './corpus-support';

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
  const fieldsIssueSteps = freshFileHFieldsIssueSteps();
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
    entry(
      'underworld/createFInvalidLaterConversionProject',
      () => createFInvalidLaterConversionProject().project,
    ),
    entry(
      'underworld/createFMidshopUnresolvedBlindBoxBeforePomProject',
      createFMidshopUnresolvedBlindBoxBeforePomProject,
    ),
    entry(
      'underworld/loadUnderworldFMidshopPomFrontierProject',
      loadUnderworldFMidshopPomFrontierProject,
    ),
    ...[true, false].map((entered) =>
      entry(
        `underworld/createGContractAvailabilityProject(${entered})`,
        () => createGContractAvailabilityProject(entered).project,
      ),
    ),
    entry('underworld/echoHammerReplayMissing', createEchoHammerReplayMissingProject),
    entry('underworld/fPoolSaleCleared', createFPoolSaleClearedProject),
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
    entry('fresh-file/withRetainedFreshFilePostboss(all)', () =>
      withRetainedFreshFilePostboss(createFreshFileFProject(), {
        well: true,
        poolSaleTraitKey: 'ApolloWeaponBoon',
        rackKeepsakeKey: catalog.keepsakes.values[0]!.key,
      }),
    ),
    entry('fresh-file/withRetainedFreshFilePostboss(emptyPool)', () =>
      withRetainedFreshFilePostboss(createFreshFileFProject(), { poolSaleTraitKey: null }),
    ),
    entry('fresh-file/withRetainedFreshFileIntroCustomization', () =>
      withRetainedFreshFileIntroCustomization(
        authorLegalTraitOffers(createFreshFileFirstSequence()),
      ),
    ),
    ...fieldsIssueSteps.map((document, index) =>
      entry(`fresh-file/hFieldsIssues/${String(index).padStart(2, '0')}`, () => document),
    ),
    ...frontier.map((document, index) =>
      entry(`fresh-file/frontier/${String(index).padStart(2, '0')}`, () => document),
    ),
  ]);
}
