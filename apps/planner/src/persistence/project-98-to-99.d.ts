import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { LegacyTimedOutcome } from '@run-planner/engine/project-migration';

export const SOURCE_SCHEMA_VERSION: 98;
export const OUTPUT_SCHEMA_VERSION: 99;
export const CATALOG_VERSION: string;
export function migrateProjectDocument(value: unknown): unknown;
export function readLegacyTimedOutcomes(value: unknown): readonly LegacyTimedOutcome[];
export function recoverLegacyTimedOutcomes(
  document: unknown,
  outcomes: readonly LegacyTimedOutcome[],
  catalog: Catalog,
): unknown;
