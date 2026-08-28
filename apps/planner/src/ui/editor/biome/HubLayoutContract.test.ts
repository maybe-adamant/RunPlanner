import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(fileURLToPath(new URL('../../styles.css', import.meta.url)), 'utf8');

function firstCssBlock(selector: string): string {
  const selectorStart = styles.indexOf(selector);
  if (selectorStart === -1) throw new Error(`CSS selector ${selector} is missing.`);
  const blockStart = styles.indexOf('{', selectorStart);
  const blockEnd = styles.indexOf('}', blockStart);
  if (blockStart === -1 || blockEnd === -1) {
    throw new Error(`CSS block ${selector} is incomplete.`);
  }
  return styles.slice(blockStart + 1, blockEnd);
}

describe('Hub layout contract', () => {
  it('keeps the Overview board at three, two, and one columns as its container narrows', () => {
    expect(firstCssBlock('.hub-overview-room-grid')).toContain(
      'grid-template-columns: repeat(3, minmax(0, 1fr));',
    );
    expect(styles).toMatch(
      /@container \(max-width: 760px\) \{[\s\S]*?\.hub-overview-room-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(styles).toMatch(
      /@container \(max-width: 560px\) \{[\s\S]*?\.hub-overview-room-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
  });

  it('keeps timeline cards on one explicit six-region roster layout before responsive stacking', () => {
    expect(firstCssBlock('.hub-roster-primary')).toContain(
      'grid-template-columns: 28px 26px minmax(10rem, 2fr) minmax(10rem, 1.35fr) minmax(7rem, auto) auto;',
    );
  });
});
