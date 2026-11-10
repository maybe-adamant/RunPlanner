import type { Catalog } from '@run-planner/engine/catalog-schema';

export const SOURCE_SCHEMA_VERSION: 102;
export const OUTPUT_SCHEMA_VERSION: 103;
export const CATALOG_VERSION: string;
export function liftProjectDocument(value: unknown): unknown;
export function migrateProjectDocument(
  value: unknown,
  context: { readonly catalog: Catalog },
): unknown;
