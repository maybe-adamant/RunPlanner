import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const uiRoot = join(repositoryRoot, 'apps/planner/src/ui');

function productionSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('editor button classification boundary', () => {
  it('requires every production button to declare an explicit class', () => {
    const unclassified: string[] = [];

    for (const path of productionSources(uiRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/<button\b[\s\S]*?>/g)) {
        if (!/\bclassName\s*=/.test(match[0])) {
          const line = source.slice(0, match.index ?? 0).split('\n').length;
          unclassified.push(`${relative(uiRoot, path)}:${line}`);
        }
      }
    }

    expect(unclassified).toEqual([]);
  });
});
