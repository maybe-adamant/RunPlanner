// Run by `npm run catalog:build` (scripts/catalog-build.mjs) through vitest, which resolves the
// planner's aliases and catalog as the application does. It is a task, not a test: it reads the
// authored entries and writes the index, the plan files to publish and the summary.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from '@run-planner/hades2-catalog';
import { expect, it } from 'vitest';

import {
  buildCatalogFeed,
  type AuthoredCatalogSource,
} from '@planner/workspace/catalogFeedBuilder';
import { isTemplateFolder } from '@planner/workspace/feedBuild';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is required.`);
  return value;
}

it('builds the plan catalog index', async () => {
  const entries = required('RUN_PLANNER_CATALOG_ENTRIES');
  const out = required('RUN_PLANNER_CATALOG_OUT');
  const sources: AuthoredCatalogSource[] = readdirSync(entries, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    // A template folder is never read; the builder lists it as not published.
    .map((entry) =>
      isTemplateFolder(entry.name)
        ? { folder: entry.name, entryJson: '', planBytes: new Uint8Array() }
        : {
            folder: entry.name,
            entryJson: readFileSync(join(entries, entry.name, 'entry.json'), 'utf8'),
            planBytes: new Uint8Array(
              readFileSync(join(entries, entry.name, 'plan.runplanner.json')),
            ),
          },
    );
  const built = await buildCatalogFeed({
    catalog,
    categoriesJson: readFileSync(required('RUN_PLANNER_CATALOG_CATEGORIES'), 'utf8'),
    sources,
  });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'catalog.json'), built.feedJson);
  for (const plan of built.plans) writeFileSync(join(out, plan.fileName), plan.bytes);
  writeFileSync(join(out, 'summary.txt'), `${built.summary.join('\n')}\n`);
  expect(built.summary.length).toBe(sources.length);
});
