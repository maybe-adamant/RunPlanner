import { catalog } from '@run-planner/hades2-catalog';
import {
  decodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
// Checkpoints are durable authored fixtures and may lag one schema revision;
// loading them through the real migration path keeps fixture authorship
// separate from the current decoder contract.
// @ts-expect-error test support imports the repository migration CLI directly.
import { migrateProjectDocument } from '../../../../schema/migrate-project.js';

export type RawCheckpoint = Parameters<typeof decodeProjectDocument>[0];

export interface CheckpointArtifact {
  readonly raw: RawCheckpoint;
  readonly load: () => ProjectDocument;
}

export function checkpointArtifact(raw: RawCheckpoint): CheckpointArtifact {
  let cached: ProjectDocument | undefined;
  return Object.freeze({
    raw,
    load: () => {
      if (cached === undefined) {
        const schemaVersion =
          typeof raw === 'object' && raw !== null && 'schemaVersion' in raw
            ? raw.schemaVersion
            : undefined;
        const migrated =
          typeof schemaVersion === 'number' && schemaVersion < PROJECT_DOCUMENT_SCHEMA_VERSION
            ? migrateProjectDocument(raw).document
            : raw;
        cached = decodeProjectDocument(migrated, catalog);
      }
      return cached;
    },
  });
}
