export interface ProjectSchemaTransition {
  readonly source: number;
  readonly target: number;
  readonly migrate: (document: unknown, context: { readonly name?: string }) => unknown;
}
export const TRANSITIONS: readonly ProjectSchemaTransition[];
export const OLDEST_SCHEMA_VERSION: number;
export const CURRENT_SCHEMA_VERSION: number;
export function planNameFromPath(inputPath: string): string;
export function outputPath(inputPath: string, schemaVersion?: number): string;
export function migrateProjectDocumentTo(
  document: unknown,
  options?: { readonly target?: number; readonly context?: { readonly name?: string } },
): unknown;
