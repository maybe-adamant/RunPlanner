import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { LegacyTimedOutcome } from '@run-planner/engine/project-migration';

/**
 * What a step may know beyond the document: its plan name before 98, the
 * catalog it opens against and the timed outcomes a save before 99 held.
 */
export interface ProjectTransitionContext {
  readonly name?: string;
  readonly catalog: Catalog;
  readonly legacyTimedOutcomes?: readonly LegacyTimedOutcome[];
}

export interface ProjectTransitionStep {
  readonly SOURCE_SCHEMA_VERSION: number;
  readonly OUTPUT_SCHEMA_VERSION: number;
  readonly CATALOG_VERSION: string;
  migrateProjectDocument(value: unknown, context: ProjectTransitionContext): unknown;
}

export const PROJECT_TRANSITION_STEPS: readonly ProjectTransitionStep[];
