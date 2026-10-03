import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const timelineStyles = readFileSync(
  new URL('../../../../src/ui/styles/room-workbenches.css', import.meta.url),
  'utf8',
);
const effectStyles = readFileSync(
  new URL('../../../../src/ui/styles/biome-layout.css', import.meta.url),
  'utf8',
);
const rewardStyles = readFileSync(
  new URL('../../../../src/ui/styles/trait-feedback.css', import.meta.url),
  'utf8',
);

function block(styles: string, selector: string): string {
  const blocks: string[] = [];
  let start = styles.indexOf(`${selector} {`);
  while (start >= 0) {
    const end = styles.indexOf('}', start);
    blocks.push(styles.slice(styles.indexOf('{', start) + 1, end));
    start = styles.indexOf(`${selector} {`, end + 1);
  }
  if (blocks.length === 0) throw new Error(`Missing style for ${selector}`);
  return blocks.join('\n');
}

describe('Room action layout', () => {
  it('aligns action columns and switches all rows together at narrow widths', () => {
    const row = block(timelineStyles, '.room-action-row');
    expect(row).toContain('display: grid;');
    expect(row).toContain('grid-template-columns: minmax(0, 44fr) minmax(0, 56fr);');
    expect(timelineStyles).toContain('@container timeline-list (max-width: 52rem)');
    expect(block(timelineStyles, '.room-action-row > .room-action-identity')).toContain(
      'flex-wrap: nowrap;',
    );
    expect(
      block(timelineStyles, '.room-action-inline-editors > .acquisition-entry-resolution'),
    ).toContain('flex: 0 1 auto;');
  });

  it('wraps whole editors while keeping ordering buttons in a nonshrinking group', () => {
    expect(block(timelineStyles, '.room-action-inline-editors')).toContain('flex-wrap: wrap;');
    expect(block(timelineStyles, '.room-action-row > .room-action-controls')).toContain(
      'grid-template-columns: minmax(0, 1fr) 8rem;',
    );
    expect(block(timelineStyles, '.room-action-ordering')).toContain('flex: 0 0 auto;');
    expect(block(timelineStyles, '.room-action-inline-reward')).toContain('width: max-content;');
    expect(block(timelineStyles, '.room-action-inline-editors > .trait-offer-launcher')).toContain(
      'min-width: 0;',
    );
    expect(block(rewardStyles, '.pickup-outcome-control > .contextual-picker')).toContain(
      'max-width: 100%;',
    );
    expect(block(timelineStyles, '.room-action-inline-editors:empty')).toContain('display: none;');
  });

  it('keeps Nemesis sentences wrapping with fixed-width pickers and intact response labels', () => {
    expect(block(timelineStyles, '.nemesis-interaction-controls')).toContain('flex-wrap: wrap;');
    const field = block(timelineStyles, '.nemesis-interaction-controls > .field-control-inline');
    expect(field).toContain('width: 13rem;');
    expect(field).toContain('max-width: 100%;');
    expect(field).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(block(timelineStyles, '.nemesis-response-control')).toContain('display: inline-flex;');
    expect(block(timelineStyles, '.nemesis-response-control')).toContain('white-space: nowrap;');
    expect(block(timelineStyles, '.nemesis-fixed-reward')).toContain('min-height: 36px;');
  });

  it('allows scheduled, fountain, and keepsake target groups to reflow', () => {
    expect(block(timelineStyles, '.room-timeline-effect-row > .room-action-identity')).toContain(
      'flex-wrap: wrap;',
    );
    expect(block(timelineStyles, '.fountain-rarity-inline')).toContain('flex-wrap: wrap;');
    expect(block(effectStyles, '.room-keepsake-action')).toContain('flex-wrap: wrap;');
    expect(block(effectStyles, '.scheduled-trait-effect-identity > .contextual-picker')).toContain(
      'min-width: min(100%, 13rem);',
    );
  });
});
