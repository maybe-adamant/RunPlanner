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
  const start = styles.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing style for ${selector}`);
  return styles.slice(styles.indexOf('{', start) + 1, styles.indexOf('}', start));
}

describe('Room action layout', () => {
  it('moves compound controls and cage selectors using their own row width', () => {
    expect(block(timelineStyles, '.room-action-row')).toContain(
      'container: room-action / inline-size;',
    );
    expect(
      block(timelineStyles, ".room-action-lifecycle-boundary[data-fields-cage-slot='true']"),
    ).toContain('container: room-action / inline-size;');
    const compound = timelineStyles.slice(
      timelineStyles.indexOf('@container room-action (max-width: 50rem)'),
    );
    expect(
      block(compound, '.room-action-row[data-inline-layout] > .room-action-controls'),
    ).toContain('grid-column: 1 / -1;');
    const narrow = timelineStyles.slice(
      timelineStyles.indexOf('@container room-action (max-width: 34rem)'),
    );
    expect(block(narrow, '.room-action-row > .room-action-controls')).toContain(
      'grid-column: 1 / -1;',
    );
    expect(narrow).toMatch(
      /@container room-action \(max-width: 34rem\) \{\s*\.fields-cage-slot-control \{\s*width: 100%;\s*grid-column: 2 \/ -1;/,
    );
  });

  it('wraps whole editors while keeping ordering buttons in a nonshrinking group', () => {
    expect(block(timelineStyles, '.room-action-inline-editors')).toContain('flex-wrap: wrap;');
    expect(block(timelineStyles, '.room-action-row > .room-action-controls')).toContain(
      'flex-wrap: wrap;',
    );
    expect(block(timelineStyles, '.room-action-ordering')).toContain('flex: 0 0 auto;');
    for (const selector of [
      '.room-action-inline-reward',
      '.room-action-inline-editors > .trait-offer-launcher',
    ]) {
      expect(block(timelineStyles, selector)).toContain('min-width: min(100%, 13rem);');
    }
    expect(block(rewardStyles, '.pickup-outcome-control > select')).toContain('max-width: 100%;');
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
    expect(block(timelineStyles, ".room-action-row[data-inline-layout='sentence']")).toContain(
      'grid-template-columns: minmax(0, 1fr) auto;',
    );
  });

  it('allows scheduled, fountain, and keepsake target groups to reflow', () => {
    expect(block(timelineStyles, '.room-action-row > .room-action-identity')).toContain(
      'flex-wrap: wrap;',
    );
    expect(block(timelineStyles, '.fountain-rarity-inline')).toContain('flex-wrap: wrap;');
    expect(block(effectStyles, '.room-keepsake-action')).toContain('flex-wrap: wrap;');
    expect(block(effectStyles, '.scheduled-trait-effect-identity > .contextual-picker')).toContain(
      'min-width: min(100%, 13rem);',
    );
  });
});
