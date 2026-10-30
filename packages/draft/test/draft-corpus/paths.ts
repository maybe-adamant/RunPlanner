import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(here, '..', '..', '..', '..');

export const draftCorpusBaselinePath = join(here, 'baseline.json');
/** Uncommitted per-run records from the last lane run. */
export const draftCorpusRunsDirectory = join(
  repositoryRoot,
  'node_modules',
  '.cache',
  'run-planner-draft-corpus',
  'runs',
);
