// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DoorRows } from '@planner/ui/editor/biome/DoorRows';

/** The space every table is given. */
let space = 400;

/** Lays a table out as a browser would: on one line at its own width, else as wide as its space. */
function layOut(this: HTMLElement): DOMRect {
  const oneLine = Number(this.dataset.oneLine ?? 0);
  const width = this.style.width === 'max-content' ? oneLine : space;
  return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0 } as DOMRect;
}

beforeEach(() => {
  space = 400;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(layOut);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Tables({ revision = 0 }: { readonly revision?: number }) {
  return (
    <div data-revision={revision}>
      <DoorRows ariaLabel="Short">
        <span />
      </DoorRows>
      <DoorRows ariaLabel="Wide">
        <span />
      </DoorRows>
    </div>
  );
}

function table(name: string): HTMLElement {
  return screen.getByLabelText(name);
}

describe('doors table layout', () => {
  it('gives two lines only to the table that does not fit its space', () => {
    const view = render(<Tables />);
    table('Short').dataset.oneLine = '300';
    table('Wide').dataset.oneLine = '520';
    view.rerender(<Tables revision={1} />);

    expect(table('Short').getAttribute('data-layout')).toBeNull();
    expect(table('Wide').getAttribute('data-layout')).toBe('two-line');
  });

  it('returns to one line only with room to spare', () => {
    const view = render(<Tables />);
    table('Wide').dataset.oneLine = '520';
    view.rerender(<Tables revision={1} />);
    expect(table('Wide').getAttribute('data-layout')).toBe('two-line');

    // Barely wide enough: it stays on two lines rather than flip back and forth.
    space = 525;
    view.rerender(<Tables revision={2} />);
    expect(table('Wide').getAttribute('data-layout')).toBe('two-line');

    space = 560;
    view.rerender(<Tables revision={3} />);
    expect(table('Wide').getAttribute('data-layout')).toBeNull();
  });
});
