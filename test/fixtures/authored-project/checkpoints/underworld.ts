import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

import fgRaw from './underworld-fg.runplanner.json';
import fghRaw from './underworld-fgh.runplanner.json';
import fghiRaw from './underworld-fghi.runplanner.json';

function lazyCheckpoint(raw: unknown): () => ProjectDocument {
  let cached: ProjectDocument | undefined;
  return () => {
    if (cached === undefined) cached = decodeProjectDocument(raw, catalog);
    return cached;
  };
}

const loadFG = lazyCheckpoint(fgRaw);
const loadFGH = lazyCheckpoint(fghRaw);
const loadFGHI = lazyCheckpoint(fghiRaw);

export function loadUnderworldFGCheckpoint(): ProjectDocument {
  return loadFG();
}

export function loadUnderworldFGHCheckpoint(): ProjectDocument {
  return loadFGH();
}

export function loadUnderworldFGHICheckpoint(): ProjectDocument {
  return loadFGHI();
}

export const underworldCheckpointDocuments = Object.freeze({
  fg: loadUnderworldFGCheckpoint,
  fgh: loadUnderworldFGHCheckpoint,
  fghi: loadUnderworldFGHICheckpoint,
});
