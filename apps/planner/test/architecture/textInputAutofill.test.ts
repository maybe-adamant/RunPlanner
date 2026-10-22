import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../src');
const TEXT_TYPES = new Set(['text', 'search', 'number', 'url', 'email', 'tel', 'password']);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

/** The source of each JSX `<input>` or `<textarea>` element's opening tag. */
function fieldTags(source: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(/<(input|textarea)\b/g)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end += 1) {
      const character = source[end];
      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
      else if (depth === 0 && character === '>') break;
    }
    tags.push(source.slice(match.index, end));
  }
  return tags;
}

// Browser and WebView autofill ("Saved info") never offers anything a plan field can use.
describe('text field autofill', () => {
  it('turns autocomplete off on every text field the planner renders', () => {
    const missing = sourceFiles(sourceRoot).flatMap((path) =>
      fieldTags(readFileSync(path, 'utf8'))
        .filter((tag) => {
          const type = /\btype=(?:"([^"]*)"|\{)/.exec(tag);
          const text =
            tag.startsWith('<textarea') ||
            type === null ||
            type[1] === undefined ||
            TEXT_TYPES.has(type[1]);
          return text && !tag.includes('autoComplete="off"');
        })
        .map((tag) => `${relative(sourceRoot, path)}: ${tag.split('\n')[0]}`),
    );
    expect(missing).toEqual([]);
  });
});
