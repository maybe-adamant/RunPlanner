import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

// `npm run test:catalog-entries`: builds the plan catalog's pinned entries
// (external/RunPlanner-Catalog) through `npm run catalog:build` into a temporary folder, so every
// entry is loaded and compiled by this planner. Opt-in; skipped without the submodule.
const root = fileURLToPath(new URL('..', import.meta.url));
const repository = join(root, 'external', 'RunPlanner-Catalog');
if (!existsSync(join(repository, 'entries')) || !existsSync(join(repository, 'categories.json'))) {
  process.stdout.write(
    'Skipped: external/RunPlanner-Catalog is not checked out (git submodule update --init external/RunPlanner-Catalog).\n',
  );
  process.exit(0);
}
const out = mkdtempSync(join(tmpdir(), 'run-planner-catalog-'));
try {
  const built = spawnSync(
    process.execPath,
    [
      join(root, 'scripts', 'catalog-build.mjs'),
      '--entries',
      join(repository, 'entries'),
      '--categories',
      join(repository, 'categories.json'),
      '--out',
      out,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (built.status !== 0) process.exit(built.status ?? 1);
  process.stdout.write(readFileSync(join(out, 'summary.txt'), 'utf8'));
} finally {
  rmSync(out, { recursive: true, force: true });
}
