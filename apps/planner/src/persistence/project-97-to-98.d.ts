export const SOURCE_SCHEMA_VERSION: 97;
export const OUTPUT_SCHEMA_VERSION: 98;
export const CATALOG_VERSION: string;
export const DEFAULT_NAME: string;
export function migrateProjectDocument(
  value: unknown,
  options?: { readonly name?: string },
): unknown;
