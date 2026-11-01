import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const behaviourTestRoots = ['ui', 'product-loops'].map((directory) => join(testRoot, directory));
// A quoted path to a stylesheet: a read, a URL or an import of its source.
const STYLESHEET_PATH = /['"`][^'"`\n]*\.css(?:\?[^'"`\n]*)?['"`]/;

function testSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return testSources(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// UI and product-loop tests witness behaviour; stylesheet values are presentation.
describe('UI test presentation boundary', () => {
  it('never reads a stylesheet from a UI or product-loop test', () => {
    const readers = behaviourTestRoots
      .flatMap(testSources)
      .filter((path) => STYLESHEET_PATH.test(readFileSync(path, 'utf8')))
      .map((path) => relative(testRoot, path).replaceAll('\\', '/'));
    expect(readers).toEqual([]);
  });
});
