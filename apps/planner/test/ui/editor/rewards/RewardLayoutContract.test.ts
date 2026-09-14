import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const structure = readFileSync(
  new URL('../../../../src/ui/styles/editor-structure.css', import.meta.url),
  'utf8',
);
const feedback = readFileSync(
  new URL('../../../../src/ui/styles/trait-feedback.css', import.meta.url),
  'utf8',
);

function cssBlock(styles: string, selector: string): string {
  const declaration = `${selector} {`;
  const start = styles.indexOf(declaration);
  if (start === -1) throw new Error(`CSS selector ${selector} is missing`);
  return styles.slice(start + declaration.length, styles.indexOf('}', start));
}

describe('Reward row layout', () => {
  it('gives all door and intro reward states the same gap from their room control', () => {
    const spacing = cssBlock(structure, '.door-reward-slot,\n.start-room-entry-reward');
    expect(spacing).toContain('margin-top: 12px;');
    expect(cssBlock(structure, '.door-fixed-reward')).toContain('min-height: 36px;');
  });

  it('centers acquisition feedback with its sibling timeline controls without a top margin', () => {
    expect(cssBlock(feedback, '.trait-offer-launchers')).toContain('align-items: center;');
    expect(cssBlock(feedback, '.reward-acquisition-outcome')).toContain('margin: 0;');
    expect(cssBlock(feedback, '.reward-acquisition-outcome')).toContain('padding: 0.3rem 0.6rem;');
  });
});
