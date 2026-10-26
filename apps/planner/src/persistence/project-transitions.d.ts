export interface ProjectTransitionStep {
  readonly SOURCE_SCHEMA_VERSION: number;
  readonly OUTPUT_SCHEMA_VERSION: number;
  readonly CATALOG_VERSION: string;
  migrateProjectDocument(value: unknown, options?: { readonly name?: string }): unknown;
}

export const PROJECT_TRANSITION_STEPS: readonly ProjectTransitionStep[];
