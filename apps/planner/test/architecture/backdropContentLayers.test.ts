import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const stylesheet = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/ui/styles/foundation-shell.css',
);

// The header's window backdrop is a fixed layer in a positioned stacking context, so every
// in-flow content area beside the header must be lifted above it by one shared rule.
describe('window backdrop content layers', () => {
  it('lifts the notice area, Home and the editor above the backdrop together', () => {
    const css = readFileSync(stylesheet, 'utf8');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
      selectors: selectors!
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(',')
        .map((selector) => selector.trim()),
      body: body!,
    }));
    const lifted = rules.find(
      (rule) =>
        rule.selectors.includes('.app-shell .notice-area') &&
        /position:\s*relative/.test(rule.body) &&
        /z-index:\s*1\b/.test(rule.body),
    );
    expect(lifted?.selectors).toEqual(
      expect.arrayContaining([
        '.app-shell .notice-area',
        '.app-shell .editor-workspace',
        '.app-shell .home-body',
      ]),
    );
  });
});
