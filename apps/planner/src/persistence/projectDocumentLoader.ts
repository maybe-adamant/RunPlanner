import {
  parseProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { migrateProjectDocument as migrate86To87 } from './project-86-to-87.js';
import { migrateProjectDocument as migrate87To88 } from './project-87-to-88.js';
import { migrateProjectDocument as migrate88To89 } from './project-88-to-89.js';
import { migrateProjectDocument as migrate89To90 } from './project-89-to-90.js';
import { migrateProjectDocument as migrate90To91 } from './project-90-to-91.js';
import { migrateProjectDocument as migrate91To92 } from './project-91-to-92.js';
import { migrateProjectDocument as migrate92To93 } from './project-92-to-93.js';
import { migrateProjectDocument as migrate93To94 } from './project-93-to-94.js';
import { migrateProjectDocument as migrate94To95 } from './project-94-to-95.js';

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

const productionTransitions: readonly ProjectDocumentTransition[] = Object.freeze([
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 86 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 87 }),
    migrate: migrate86To87,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 87 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 88 }),
    migrate: migrate87To88,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 88 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 89 }),
    migrate: migrate88To89,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 89 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 90 }),
    migrate: migrate89To90,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 90 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 91 }),
    migrate: migrate90To91,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 91 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 92 }),
    migrate: migrate91To92,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 92 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 93 }),
    migrate: migrate92To93,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 93 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 94 }),
    migrate: migrate93To94,
  }),
  Object.freeze({
    source: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 94 }),
    target: Object.freeze({ catalogVersion: '0.55.0-anvil-of-fates', schemaVersion: 95 }),
    migrate: migrate94To95,
  }),
]);
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
