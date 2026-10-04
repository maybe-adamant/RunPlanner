import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const structure = readFileSync(
  new URL('../../../../src/ui/styles/editor-structure.css', import.meta.url),
  'utf8',
);
const workbenches = readFileSync(
  new URL('../../../../src/ui/styles/room-workbenches.css', import.meta.url),
  'utf8',
);

function cssBlock(styles: string, selector: string): string {
  const declaration = `${selector} {`;
  const start = styles.indexOf(declaration);
  if (start === -1) throw new Error(`CSS selector ${selector} is missing`);
  return styles.slice(start + declaration.length, styles.indexOf('}', start));
}

describe('Reward row layout', () => {
  it('wraps Hermes purchase controls within the available inventory width', () => {
    const row = cssBlock(workbenches, '.hermes-shrine-slot');
    expect(row).toContain('display: flex;');
    expect(row).toContain('flex-wrap: wrap;');
    const picker = cssBlock(workbenches, '.hermes-shrine-slot > .field-control');
    expect(picker).toContain('flex: 1 1 18rem;');
    expect(picker).toContain('max-width: 100%;');
    const details = cssBlock(workbenches, '.hermes-shrine-purchase-details');
    expect(details).toContain('flex-wrap: wrap;');
    expect(details).toContain('min-width: 0;');
    expect(details).toContain('max-width: 100%;');
  });

  it('gives all door and intro reward states the same gap from their room control', () => {
    const spacing = cssBlock(structure, '.door-reward-slot,\n.start-room-entry-reward');
    expect(spacing).toContain('margin-top: 12px;');
    const placeholder = cssBlock(structure, '.control-placeholder > .fixed-room-state');
    expect(placeholder).toContain('min-height: 36px;');
    expect(placeholder).toContain('margin: 0;');
    expect(workbenches).not.toContain('.ephyra-side-unavailable');
  });

  it('keeps placement feedback out of flow and pool results separate from editable columns', () => {
    expect(cssBlock(workbenches, '.room-action-placement-notice')).toContain('position: fixed;');
    expect(cssBlock(structure, '.batch-pool-information')).toContain('min-height: 2.5rem;');
    expect(cssBlock(workbenches, '.effect-repair-action[data-inactive]')).toContain(
      'visibility: hidden;',
    );
  });
});
