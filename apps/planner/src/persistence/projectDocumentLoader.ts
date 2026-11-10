import {
  createProjectAddress,
  parseProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RemovedStaleRoomActions, SettlementFault } from '@run-planner/engine/simulation';
import {
  OUTPUT_SCHEMA_VERSION as UPGRADE_SETTLEMENT_SCHEMA_VERSION,
  settleUpgradedProject,
} from './project-102-to-103.js';
import { PROJECT_TRANSITION_STEPS } from './project-transitions.js';

export const PROJECT_DOCUMENT_SCHEMA_SUPPORT_FLOOR = 86 as const;

/** The project schema majors this loader opens, inclusive, and the newest major's revision. */
export const LOADABLE_PROJECT_SCHEMAS = Object.freeze({
  oldest: PROJECT_DOCUMENT_SCHEMA_SUPPORT_FLOOR,
  newest: PROJECT_DOCUMENT_SCHEMA_VERSION,
  newestRevision: PROJECT_DOCUMENT_SCHEMA_REVISION,
});

export interface ProjectDocumentIdentity {
  readonly catalogVersion: string;
  readonly schemaVersion: number;
}

/** What a transition may know about the document beyond its content. */
export interface ProjectMigrationContext {
  /** The plan's name before the project carried one. */
  readonly name?: string;
}

export interface ProjectDocumentTransition {
  readonly source: ProjectDocumentIdentity;
  readonly target: ProjectDocumentIdentity;
  readonly migrate: (document: unknown, context: ProjectMigrationContext) => unknown;
}

export interface LoadProjectDocumentOptions {
  /** Names a document saved before projects carried a name: its file's stem, when known. */
  readonly legacyName?: string;
  /**
   * Reads a plan saved before schema 103 as saved, without the settlement opening it applies:
   * for library upkeep that compares or re-identifies a file without opening it.
   */
  readonly asSaved?: boolean;
}

export interface ProjectMigrationProvenance {
  readonly sourceCatalogVersion: string;
  readonly sourceSchemaVersion: number;
  readonly targetCatalogVersion: string;
  readonly targetSchemaVersion: number;
}

/**
 * What settling a plan saved before schema 103 changed: the plan as saved, read at the current
 * schema, which one Undo restores, and the removals to announce.
 */
export interface ProjectUpgrade {
  readonly before: ProjectDocument;
  readonly removedStaleActions?: readonly RemovedStaleRoomActions[];
  readonly fault?: SettlementFault;
}

export interface LoadedProjectDocument {
  readonly migrationProvenance: readonly ProjectMigrationProvenance[];
  /** The plan to open: settled once when it was saved before schema 103. */
  readonly project: ProjectDocument;
  /** Present when that settlement changed the plan or faulted. */
  readonly upgrade?: ProjectUpgrade;
}

/** The registered transitions, each opening against the catalog the document loads under. */
function productionTransitions(catalog: Catalog): readonly ProjectDocumentTransition[] {
  return PROJECT_TRANSITION_STEPS.map((step) =>
    Object.freeze({
      source: Object.freeze({
        catalogVersion: step.CATALOG_VERSION,
        schemaVersion: step.SOURCE_SCHEMA_VERSION,
      }),
      target: Object.freeze({
        catalogVersion: step.CATALOG_VERSION,
        schemaVersion: step.OUTPUT_SCHEMA_VERSION,
      }),
      migrate: (document: unknown, context: ProjectMigrationContext) =>
        step.migrateProjectDocument(document, { ...context, catalog }),
    }),
  );
}

const noMigrations: readonly ProjectMigrationProvenance[] = Object.freeze([]);

export function loadProjectDocument(
  json: string,
  catalog: Catalog,
  options: LoadProjectDocumentOptions = {},
): LoadedProjectDocument {
  const parsed = parseJson(json);
  const envelope = inspectEnvelope(parsed);
  if (envelope === undefined) {
    return currentProject(json, catalog);
  }

  if (envelope.schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
    const revision = (parsed as Record<string, unknown>).schemaRevision;
    if (typeof revision === 'number' && revision > PROJECT_DOCUMENT_SCHEMA_REVISION) {
      throw new Error(
        `Project schema ${envelope.schemaVersion}.${revision} is newer than supported schema ${PROJECT_DOCUMENT_SCHEMA_VERSION}.${PROJECT_DOCUMENT_SCHEMA_REVISION}.`,
      );
    }
    return currentProject(json, catalog);
  }

  if (envelope.schemaVersion < PROJECT_DOCUMENT_SCHEMA_SUPPORT_FLOOR) {
    throw new Error(
      `Project schema ${envelope.schemaVersion} is older than the supported schema floor ${PROJECT_DOCUMENT_SCHEMA_SUPPORT_FLOOR}.`,
    );
  }
  if (envelope.schemaVersion > PROJECT_DOCUMENT_SCHEMA_VERSION) {
    throw new Error(
      `Project schema ${envelope.schemaVersion} is newer than supported schema ${PROJECT_DOCUMENT_SCHEMA_VERSION}.`,
    );
  }

  // Each transition leaves its source major's revision behind.
  const migrated = applyProjectDocumentTransitions({
    document: parsed,
    source: envelope,
    target: Object.freeze({
      catalogVersion: catalog.version,
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    }),
    transitions: productionTransitions(catalog),
    context: options.legacyName === undefined ? {} : { name: options.legacyName },
  });
  const migratedJson = JSON.stringify(migrated.document);
  if (migratedJson === undefined) {
    throw new Error('Project migration result must be JSON serializable.');
  }
  const before = parseProjectDocument(migratedJson, catalog);
  if (envelope.schemaVersion >= UPGRADE_SETTLEMENT_SCHEMA_VERSION || options.asSaved === true) {
    return Object.freeze({ migrationProvenance: migrated.migrationProvenance, project: before });
  }
  // A plan saved under the earlier settlement rules is settled once, as they now would.
  let settled: ReturnType<typeof settleUpgradedProject>;
  try {
    settled = settleUpgradedProject(before, catalog);
  } catch (error) {
    // A settlement that throws is an engine defect, never a reason the plan cannot open: it
    // opens as saved, with the fault reported where settlement faults are.
    return Object.freeze({
      migrationProvenance: migrated.migrationProvenance,
      project: before,
      upgrade: Object.freeze({
        before,
        fault: Object.freeze({
          key: `upgradeSettlement:${error instanceof Error ? error.message : String(error)}`,
          owner: createProjectAddress(),
        }),
      }),
    });
  }
  const project = settled.assembly.project;
  return Object.freeze({
    migrationProvenance: migrated.migrationProvenance,
    project,
    ...(project === before && settled.fault === undefined
      ? {}
      : {
          upgrade: Object.freeze({
            before,
            ...(settled.removedStaleActions === undefined
              ? {}
              : { removedStaleActions: settled.removedStaleActions }),
            ...(settled.fault === undefined ? {} : { fault: settled.fault }),
          }),
        }),
  });
}

export function applyProjectDocumentTransitions(options: {
  readonly document: unknown;
  readonly source: ProjectDocumentIdentity;
  readonly target: ProjectDocumentIdentity;
  readonly transitions: readonly ProjectDocumentTransition[];
  readonly context?: ProjectMigrationContext;
}): {
  readonly document: unknown;
  readonly migrationProvenance: readonly ProjectMigrationProvenance[];
} {
  let document = options.document;
  let currentIdentity = options.source;
  const migrationProvenance: ProjectMigrationProvenance[] = [];
  for (const transition of options.transitions) {
    if (!sameIdentity(currentIdentity, transition.source)) continue;
    document = transition.migrate(document, options.context ?? {});
    const target = inspectEnvelope(document);
    if (target === undefined || !sameIdentity(target, transition.target)) {
      throw new Error('Project migration did not produce its declared target identity.');
    }
    migrationProvenance.push(
      Object.freeze({
        sourceCatalogVersion: currentIdentity.catalogVersion,
        sourceSchemaVersion: currentIdentity.schemaVersion,
        targetCatalogVersion: target.catalogVersion,
        targetSchemaVersion: target.schemaVersion,
      }),
    );
    currentIdentity = target;
    if (sameIdentity(currentIdentity, options.target)) {
      return Object.freeze({
        document,
        migrationProvenance: Object.freeze(migrationProvenance),
      });
    }
  }

  throw new Error(
    `Project schema ${options.source.schemaVersion} with catalog ${options.source.catalogVersion} has no supported migration.`,
  );
}

function currentProject(json: string, catalog: Catalog): LoadedProjectDocument {
  return Object.freeze({
    migrationProvenance: noMigrations,
    project: parseProjectDocument(json, catalog),
  });
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error('$: must be valid JSON');
  }
}

function inspectEnvelope(value: unknown): ProjectDocumentIdentity | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.schemaVersion !== 'number' || !Number.isInteger(record.schemaVersion)) {
    return undefined;
  }
  if (typeof record.catalogVersion !== 'string') return undefined;
  return Object.freeze({
    catalogVersion: record.catalogVersion,
    schemaVersion: record.schemaVersion,
  });
}

function sameIdentity(left: ProjectDocumentIdentity, right: ProjectDocumentIdentity): boolean {
  return left.schemaVersion === right.schemaVersion && left.catalogVersion === right.catalogVersion;
}
