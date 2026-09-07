import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(fileURLToPath(new URL('../../styles.css', import.meta.url)), 'utf8');

describe('biome rail layout contract', () => {
  it('keeps a selected finding room visually selected', () => {
    expect(styles).toContain(
      ".biome-rail-node[data-findings='true']:not([data-selected='true']) {",
    );
    expect(styles.indexOf(".biome-rail-node[data-selected='true'] {")).toBeGreaterThan(
      styles.indexOf(".biome-rail-node[data-findings='true']:not([data-selected='true']) {"),
    );
  });
});
