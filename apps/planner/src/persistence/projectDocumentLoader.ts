import {
  parseProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

export const PROJECT_DOCUMENT_SCHEMA_SUPPORT_FLOOR = 86 as const;

export interface ProjectDocumentIdentity {
  readonly catalogVersion: string;
  readonly schemaVersion: number;
}

export interface ProjectDocumentTransition {
  readonly source: ProjectDocumentIdentity;
  readonly target: ProjectDocumentIdentity;
  readonly migrate: (document: unknown) => unknown;
}

export interface ProjectMigrationProvenance {
  readonly sourceCatalogVersion: string;
  readonly sourceSchemaVersion: number;
  readonly targetCatalogVersion: string;
  readonly targetSchemaVersion: number;
}

export interface LoadedProjectDocument {
  readonly migrationProvenance: readonly ProjectMigrationProvenance[];
  readonly project: ProjectDocument;
}

const productionTransitions: readonly ProjectDocumentTransition[] = Object.freeze([]);
const noMigrations: readonly ProjectMigrationProvenance[] = Object.freeze([]);

export function loadProjectDocument(json: string, catalog: Catalog): LoadedProjectDocument {
  const parsed = parseJson(json);
  const envelope = inspectEnvelope(parsed);
  if (envelope === undefined) {
    return currentProject(json, catalog);
  }

  if (envelope.schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
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

  const migrated = applyProjectDocumentTransitions({
    document: parsed,
    source: envelope,
    target: Object.freeze({
      catalogVersion: catalog.version,
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    }),
    transitions: productionTransitions,
  });
  const migratedJson = JSON.stringify(migrated.document);
  if (migratedJson === undefined) {
    throw new Error('Project migration result must be JSON serializable.');
  }
  return Object.freeze({
    migrationProvenance: migrated.migrationProvenance,
    project: parseProjectDocument(migratedJson, catalog),
  });
}

export function applyProjectDocumentTransitions(options: {
  readonly document: unknown;
  readonly source: ProjectDocumentIdentity;
  readonly target: ProjectDocumentIdentity;
  readonly transitions: readonly ProjectDocumentTransition[];
}): {
  readonly document: unknown;
  readonly migrationProvenance: readonly ProjectMigrationProvenance[];
} {
  let document = options.document;
  let currentIdentity = options.source;
  const migrationProvenance: ProjectMigrationProvenance[] = [];
  for (const transition of options.transitions) {
    if (!sameIdentity(currentIdentity, transition.source)) continue;
    document = transition.migrate(document);
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
