import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(fileURLToPath(new URL('../../styles.css', import.meta.url)), 'utf8');

function standaloneCssBlock(selector: string): string {
  const match = styles.match(new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`));
  if (match?.[1] === undefined) throw new Error(`CSS selector ${selector} is missing.`);
  return match[1];
}

describe('O reward wheel layout contract', () => {
  it('keeps two offer cards beside each other until their wheel container becomes narrow', () => {
    expect(standaloneCssBlock('\\.reward-wheel')).toContain('container-type: inline-size;');
    expect(standaloneCssBlock("\\.reward-wheel-offers\\[data-active-offer-count='2'\\]")).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr));',
    );
    expect(styles).toMatch(
      /@container \(max-width: 34rem\) \{[\s\S]*?\.reward-wheel-offers\[data-active-offer-count='2'\] \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
  });
});
