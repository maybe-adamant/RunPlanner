export const SOURCE_SCHEMA_VERSION: 97;
export const OUTPUT_SCHEMA_VERSION: 98;
export const CATALOG_VERSION: string;
export function migrateProjectDocument(
  value: unknown,
  options?: { readonly name?: string },
): unknown;
export function outputPath(inputPath: string): string;
export function planNameFromPath(inputPath: string): string;
