import type { Catalog } from '@run-planner/engine/catalog-schema';

/** What a step may know beyond the document: its plan name before 98 and the catalog it opens against. */
export interface ProjectTransitionContext {
  readonly name?: string;
  readonly catalog: Catalog;
}

export interface ProjectTransitionStep {
  readonly SOURCE_SCHEMA_VERSION: number;
  readonly OUTPUT_SCHEMA_VERSION: number;
  readonly CATALOG_VERSION: string;
  migrateProjectDocument(value: unknown, context: ProjectTransitionContext): unknown;
}

export const PROJECT_TRANSITION_STEPS: readonly ProjectTransitionStep[];
