import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectEditSettlement } from '@run-planner/engine/simulation';

export const SOURCE_SCHEMA_VERSION: 102;
export const OUTPUT_SCHEMA_VERSION: 103;
export const CATALOG_VERSION: string;
export function migrateProjectDocument(value: unknown): unknown;
export function settleUpgradedProject(
  project: ProjectDocument,
  catalog: Catalog,
): ProjectEditSettlement;
