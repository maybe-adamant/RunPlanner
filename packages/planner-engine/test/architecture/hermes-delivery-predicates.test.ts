import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../src');
const owners = new Set(['authored-project/hermes-shrine-delivery.ts', 'authored-project/model.ts']);
const deliveryTerms = /hermes|shrine|deliver/i;
const flushTerms = /deliver|flush/i;

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
    })
    .sort();
}

/** Lines matching `pattern` whose surrounding lines also name `terms`. */
function hits(lines: readonly string[], pattern: string | RegExp, terms: RegExp): number[] {
  return lines.flatMap((line, index) => {
    if (typeof pattern === 'string' ? !line.includes(pattern) : !pattern.test(line)) return [];
    const window = lines.slice(Math.max(0, index - 4), index + 5).join('\n');
    return terms.test(window) ? [index + 1] : [];
  });
}

describe('Hermes delivery predicates live with the obligation', () => {
  const files = sourceFiles(sourceRoot)
    .map((path) => relative(sourceRoot, path))
    .filter((path) => !owners.has(path));

  it('derives Shrine slot keys only through hermesShrineInitialSlotKey', () => {
    const violations = files.flatMap((path) =>
      hits(
        readFileSync(join(sourceRoot, path), 'utf8').split('\n'),
        "slice('initial:'.length)",
        deliveryTerms,
      ).map((line) => `${path}:${line}`),
    );
    expect(violations).toEqual([]);
  });

  it('decides the delivery flush host only through isDeliveryFlushHost', () => {
    const violations = files.flatMap((path) =>
      hits(
        readFileSync(join(sourceRoot, path), 'utf8').split('\n'),
        /===\s*'Preboss'/,
        flushTerms,
      ).map((line) => `${path}:${line}`),
    );
    expect(violations).toEqual([]);
  });
});
