import { readFileSync } from 'node:fs';

import { encodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

export function canonicalCheckpointMatches(project: ProjectDocument, filePath: string): boolean {
  return readFileSync(filePath, 'utf8') === encodeProjectDocument(project);
}
