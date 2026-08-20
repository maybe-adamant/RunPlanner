import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

import nRaw from './surface-n.runplanner.json';
import noRaw from './surface-no.runplanner.json';
import nopRaw from './surface-nop.runplanner.json';
import nopqRaw from './surface-nopq.runplanner.json';

function lazyCheckpoint(raw: unknown): () => ProjectDocument {
  let cached: ProjectDocument | undefined;
  return () => {
    if (cached === undefined) cached = decodeProjectDocument(raw, catalog);
    return cached;
  };
}

const loadN = lazyCheckpoint(nRaw);
const loadNO = lazyCheckpoint(noRaw);
const loadNOP = lazyCheckpoint(nopRaw);
const loadNOPQ = lazyCheckpoint(nopqRaw);

export function loadSurfaceNCheckpoint(): ProjectDocument {
  return loadN();
}

export function loadSurfaceNOCheckpoint(): ProjectDocument {
  return loadNO();
}

export function loadSurfaceNOPCheckpoint(): ProjectDocument {
  return loadNOP();
}

export function loadSurfaceNOPQCheckpoint(): ProjectDocument {
  return loadNOPQ();
}

export const surfaceCheckpointDocuments = Object.freeze({
  n: loadSurfaceNCheckpoint,
  no: loadSurfaceNOCheckpoint,
  nop: loadSurfaceNOPCheckpoint,
  nopq: loadSurfaceNOPQCheckpoint,
});
