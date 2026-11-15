import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import {
  createCompleteFGAnomalyProject,
  createFConversionFrontierProject,
  createFInvalidLaterConversionProject,
  createFMidshopUnresolvedBlindBoxBeforePomProject,
  createGContractAvailabilityProject,
} from '@run-planner/test-fixtures/underworld';
import {
  createRepresentativeNOPQShopTraitProject,
  createSurfaceNShrineSideRoomDeliveryCheckpoint,
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
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
import { authorLegalTraitOffers, stockTestProject } from '@run-planner/test-fixtures/shared';

import { executionFixtures } from '../execution-plan/support/execution-fixtures';
import {
  surfaceNORerollsProject,
  underworldFRerollsProject,
} from '../execution-plan/support/rerolls-fixture';
import {
  createEchoHammerReplayMissingProject,
  createEchoReplayUnresolvedHammerProject,
  createHammerBridgeRouteProject,
  createFPoolSaleClearedProject,
  createFWellDuplicateRefillProject,
  createOShipWheelPickupBeforeDeferredEndEffectsProject,
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

/** Execution fixtures built from a checkpoint's exact project, hashed by that checkpoint's entry. */
const checkpointExecutionFixtures = new Set([
  'fg',
  'underworld-fgh',
  'underworld-fghi',
  'fg-ixion-chaos',
  'fg-anomaly-roster',
  'automatic-boss',
  'surface-n',
  'dream-mixed-prefix',
  'surface-scheduled-lifecycle',
  'underworld-generated-composition',
  'underworld-arachne-cocoons',
  'surface-n-phial-intermediate-fountain',
  'surface-selene-hex-path',
]);

/**
 * Every distinct project the equivalence lane hashes, each built through its
 * owning fixture builder. Names are stable baseline keys.
 */
export function equivalenceCorpus(): readonly EquivalenceEntry[] {
  const frontier = freshFileRouteFrontierWalk();
  const fieldsIssueSteps = freshFileHFieldsIssueSteps();
  return Object.freeze([
    ...executionFixtures
      .filter((fixture) => !checkpointExecutionFixtures.has(fixture.name))
      .map((fixture) =>
        entry(`execution/${fixture.name}`, fixture.project, fixture.catalog?.() ?? catalog),
      ),
    ...checkpointRegistry.map(({ entry: checkpoint, load }) =>
      entry(`checkpoint/${checkpoint.id}`, load),
    ),
    entry('underworld/createCompleteFGAnomalyProject(false)', () =>
      createCompleteFGAnomalyProject(false),
    ),
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
    ...[true, false].map((entered) =>
      entry(
        `underworld/createGContractAvailabilityProject(${entered})`,
        () => createGContractAvailabilityProject(entered).project,
      ),
    ),
    entry('underworld/echoHammerReplayMissing', createEchoHammerReplayMissingProject),
    entry('underworld/hammerBridgeRoute', createHammerBridgeRouteProject),
    entry('underworld/fPoolSaleCleared', createFPoolSaleClearedProject),
    entry('underworld/echoReplayUnresolvedHammer', createEchoReplayUnresolvedHammerProject),
    entry('underworld/fWellDuplicateRefill', createFWellDuplicateRefillProject),
    entry('underworld/underworldFRerollsProject', () =>
      stockTestProject(underworldFRerollsProject()),
    ),
    entry(
      'surface/createSurfaceNShrineSideRoomDeliveryCheckpoint',
      createSurfaceNShrineSideRoomDeliveryCheckpoint,
    ),
    entry(
      'surface/createSurfaceNUnresolvedBossHermesDeliveryCheckpoint',
      createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
    ),
    entry(
      'surface/createRepresentativeNOPQShopTraitProject',
      createRepresentativeNOPQShopTraitProject,
    ),
    entry('surface/surfaceNORerollsProject', surfaceNORerollsProject),
    entry(
      'surface/oShipWheelPickupBeforeDeferredEndEffects',
      createOShipWheelPickupBeforeDeferredEndEffectsProject,
    ),
    entry('fresh-file/createFreshFileFProject', createFreshFileFProject),
    entry('fresh-file/createFreshFileFirstSequence', () => createFreshFileFirstSequence()),
    entry('fresh-file/createMatureCombat01Sequence', createMatureCombat01Sequence),
    entry('fresh-file/createFreshFileGeneratedComposition', createFreshFileGeneratedComposition),
    // The max outcome is hFieldsIssues/00.
    entry('fresh-file/withNewHFieldsRoom(min)', () =>
      withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'min'),
    ),
    // A Well and Pool its route never spawns, which loading a plan saved before 103.3 drops.
    entry('fresh-file/withRetainedFreshFilePostboss(all)', () =>
      withRetainedFreshFilePostboss(createFreshFileFProject(), {
        well: true,
        poolSaleTraitKey: 'ApolloWeaponBoon',
      }),
    ),
    entry('fresh-file/withRetainedFreshFileIntroCustomization', () =>
      withRetainedFreshFileIntroCustomization(
        authorLegalTraitOffers(createFreshFileFirstSequence()),
      ),
    ),
    ...fieldsIssueSteps.map((document, index) =>
      entry(`fresh-file/hFieldsIssues/${String(index).padStart(2, '0')}`, () => document),
    ),
    // The walk's last step is the complete route, execution/fresh-file-fghi.
    ...frontier
      .slice(0, -1)
      .map((document, index) =>
        entry(`fresh-file/frontier/${String(index).padStart(2, '0')}`, () => document),
      ),
  ]);
}
