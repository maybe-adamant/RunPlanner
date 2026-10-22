import assert from 'node:assert/strict';
import { test } from 'node:test';

import { catalogBuildEnvironment, parseCatalogBuildArguments } from './catalog-build.mjs';

test('catalog builds name their entries, categories and output', () => {
  const options = parseCatalogBuildArguments([
    '--entries',
    '../catalog/entries',
    '--categories',
    '../catalog/categories.json',
    '--out',
    'out',
  ]);
  assert.deepEqual(catalogBuildEnvironment(options, '/repo/planner'), {
    RUN_PLANNER_CATALOG_ENTRIES: '/repo/catalog/entries',
    RUN_PLANNER_CATALOG_CATEGORIES: '/repo/catalog/categories.json',
    RUN_PLANNER_CATALOG_OUT: '/repo/planner/out',
  });
});

test('incomplete and unknown arguments are refused', () => {
  for (const argv of [
    ['--entries', 'e', '--out', 'o'],
    ['--entries', 'e', '--categories', 'c'],
    ['--entries', 'e', '--categories', 'c', '--out', 'o', '--check'],
    ['--entries'],
  ]) {
    assert.throws(() => parseCatalogBuildArguments(argv), undefined, argv.join(' '));
  }
});
