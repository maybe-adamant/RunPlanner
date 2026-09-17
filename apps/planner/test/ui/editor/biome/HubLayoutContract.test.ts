import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  fileURLToPath(new URL('../../../../src/ui/styles/room-workbenches.css', import.meta.url)),
  'utf8',
);

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
  it('insets the Overview board heading to match its content', () => {
    expect(firstCssBlock('.hub-board-heading')).toContain('padding: 12px 12px 0;');
    expect(firstCssBlock('.hub-overview-room-grid')).toContain('padding: 12px;');
  });

  it('gives open and closed rewards a picker-height row that can grow with wrapped text', () => {
    const rewardSlot = firstCssBlock('.hub-overview-reward-slot');
    expect(rewardSlot).toContain('grid-template-rows: minmax(36px, auto);');
    expect(rewardSlot).toContain('align-items: center;');
    expect(firstCssBlock('.hub-main-reward > .fixed-room-state')).toContain('margin: 0;');
  });

  it('keeps the Overview board at four, two, and one columns as its container narrows', () => {
    expect(firstCssBlock('.hub-overview-room-grid')).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr));',
    );
    expect(styles).toMatch(
      /@container \(max-width: 760px\) \{[\s\S]*?\.hub-overview-room-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(styles).toMatch(
      /@container \(max-width: 560px\) \{[\s\S]*?\.hub-overview-room-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
    );
  });

  it('aligns Overview room labels with their membership controls', () => {
    expect(firstCssBlock('.hub-roster-primary')).toContain('align-items: center;');
    expect(firstCssBlock('.hub-roster-identity')).toContain('align-content: center;');
    expect(firstCssBlock('.hub-slot-heading')).toContain('align-items: center;');
    expect(
      firstCssBlock(
        ".hub-open-room-card[data-hub-card-presentation='overview'] .hub-roster-primary",
      ),
    ).toContain('grid-template-columns: minmax(0, 1fr) auto;');
  });
});
