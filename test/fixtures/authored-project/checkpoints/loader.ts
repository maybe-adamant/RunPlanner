import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

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
        cached = decodeProjectDocument(raw, catalog);
      }
      return cached;
    },
  });
}

/** Canonical checkpoint text without its revision line; checkpoints keep the revision they were written under. */
export function withoutSchemaRevision(text: string): string {
  return text.replace(/^ {2}"schemaRevision": \d+,\n/m, '');
}
