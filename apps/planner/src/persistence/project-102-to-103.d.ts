import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  LegacyTimedOutcome,
  LegacyTimedOutcomeRecovery,
} from '@run-planner/engine/project-migration';

export const SOURCE_SCHEMA_VERSION: 102;
export const OUTPUT_SCHEMA_VERSION: 103;
export const CATALOG_VERSION: string;
export function liftProjectDocument(value: unknown, catalog?: Catalog): unknown;
export function migrateProjectDocumentRecoveredBy(
  value: unknown,
  context: {
    readonly catalog: Catalog;
    readonly legacyTimedOutcomes?: readonly LegacyTimedOutcome[];
  },
  recover: (options: {
    readonly catalog: Catalog;
    readonly project: ProjectDocument;
    readonly outcomes: readonly LegacyTimedOutcome[];
  }) => LegacyTimedOutcomeRecovery,
): unknown;
export function migrateProjectDocument(
  value: unknown,
  context: {
    readonly catalog: Catalog;
    readonly legacyTimedOutcomes?: readonly LegacyTimedOutcome[];
  },
): unknown;

export function fillReachedBlanksProject(
  project: ProjectDocument,
  catalog: Catalog,
): ProjectDocument;

export function dropRouteExcludedObjects(document: unknown, catalog: Catalog): unknown;
export function dropAutomaticRewardRows(document: unknown, catalog: Catalog): unknown;
export function dropUnduplicableSeaStarDuplicates(document: unknown, catalog: Catalog): unknown;
