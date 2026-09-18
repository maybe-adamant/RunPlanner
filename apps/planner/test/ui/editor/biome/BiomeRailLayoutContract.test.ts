import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  fileURLToPath(new URL('../../../../src/ui/styles/biome-layout.css', import.meta.url)),
  'utf8',
);
const responsiveStyles = readFileSync(
  new URL('../../../../src/ui/styles/responsive.css', import.meta.url),
  'utf8',
);

describe('biome rail layout contract', () => {
  it('stacks the room editor with shared scrolling before switching the app to mobile navigation', () => {
    const stacked = responsiveStyles
      .split('@container app-viewport (max-width: 1000px) {')[1]
      ?.split('@container app-viewport (max-width: 700px) {')[0];
    expect(stacked).toBeDefined();
    expect(stacked).toContain(".editor-panel-content[data-editor-layout='biome'] {");
    expect(stacked).toContain('overflow-y: auto;');
    expect(stacked).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(stacked).toContain('grid-template-rows: auto auto;');
    for (const region of ['biome-structure-region', 'biome-structure-scroll', 'biome-inspector']) {
      const regionStyles = stacked?.split(`.${region} {`)[1]?.split('}')[0];
      expect(regionStyles).toContain('overflow-y: visible;');
      expect(regionStyles).toContain('max-height: none;');
    }
  });

  it('keeps a selected finding room visually selected', () => {
    expect(styles).toContain(
      ".biome-rail-node[data-findings='true']:not([data-selected='true']) {",
    );
    expect(styles.indexOf(".biome-rail-node[data-selected='true'] {")).toBeGreaterThan(
      styles.indexOf(".biome-rail-node[data-findings='true']:not([data-selected='true']) {"),
    );
  });
});
