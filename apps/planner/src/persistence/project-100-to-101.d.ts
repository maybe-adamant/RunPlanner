import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { WheelSideOrderBlock } from '@run-planner/engine/project-migration';

export const SOURCE_SCHEMA_VERSION: 100;
export const OUTPUT_SCHEMA_VERSION: 101;
export const CATALOG_VERSION: string;
export function migrateProjectDocumentJudgedBy(
  value: unknown,
  catalog: Catalog,
  blockOf: (project: ProjectDocument) => WheelSideOrderBlock | undefined,
): unknown;
export function migrateProjectDocument(
  value: unknown,
  context: { readonly catalog: Catalog },
): unknown;
