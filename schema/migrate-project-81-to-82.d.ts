export const SOURCE_SCHEMA_VERSION: 81;
export const OUTPUT_SCHEMA_VERSION: 82;
export const CATALOG_VERSION: string;

export function migrateProjectDocument(value: unknown): unknown;
export function outputPath(inputPath: string): string;
