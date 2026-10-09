// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hintProps } from '@planner/ui/controls/hint';
import { HintLayer } from '@planner/ui/controls/HintLayer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderHinted() {
  render(
    <>
      <button
        className="quiet-action"
        disabled
        type="button"
        {...hintProps('Waits on an earlier choice.')}
      >
        Choose boon
      </button>
      <button className="quiet-action" type="button" {...hintProps('Full summary', 'Finding')}>
        Edit Hex
      </button>
      <button className="quiet-action" type="button">
        Plain
      </button>
      <HintLayer />
    </>,
  );
  return {
    disabled: screen.getByRole('button', { name: 'Choose boon' }),
    launcher: screen.getByRole('button', { name: 'Edit Hex' }),
    plain: screen.getByRole('button', { name: 'Plain' }),
    // The test DOM has no popover top layer; the layer's hidden attribute carries visibility.
    tooltip: () => document.querySelector('[role="tooltip"]:not([hidden])'),
  };
}

function elapse(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('hintProps', () => {
  it('leads the accessible description with the hint and omits empty hints', () => {
    expect(hintProps('Full summary', 'Finding')).toEqual({
      'data-hint': 'Full summary',
      'aria-description': 'Full summary Finding',
    });
    expect(hintProps('Same', 'Same')).toEqual({
      'data-hint': 'Same',
      'aria-description': 'Same',
    });
    expect(hintProps(undefined, 'Finding')).toEqual({ 'aria-description': 'Finding' });
    expect(hintProps(undefined)).toEqual({});
  });
});

describe('HintLayer', () => {
  it('shows a hovered hint after a delay, including over a disabled control, and hides on leave', () => {
    const view = renderHinted();
    fireEvent.pointerOver(view.disabled);
    expect(view.tooltip()).toBeNull();
    elapse(500);
    expect(view.tooltip()?.textContent).toBe('Waits on an earlier choice.');

    fireEvent.pointerOut(view.disabled, { relatedTarget: view.plain });
    expect(view.tooltip()).toBeNull();
  });

  it('switches directly between hints while one is visible', () => {
    const view = renderHinted();
    fireEvent.pointerOver(view.disabled);
    elapse(500);
    fireEvent.pointerOut(view.disabled, { relatedTarget: view.launcher });
    fireEvent.pointerOver(view.launcher);
    expect(view.tooltip()?.textContent).toBe('Full summary');
  });

  it('shows on keyboard focus and hides on Escape and blur', () => {
    const view = renderHinted();
    act(() => view.launcher.focus());
    elapse(500);
    expect(view.tooltip()?.textContent).toBe('Full summary');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(view.tooltip()).toBeNull();

    act(() => view.plain.focus());
    act(() => view.launcher.focus());
    elapse(500);
    expect(view.tooltip()).not.toBeNull();
    act(() => view.plain.focus());
    expect(view.tooltip()).toBeNull();
  });

  it('shows nothing while a pointer is pressed, as during a drag', () => {
    const view = renderHinted();
    fireEvent.pointerOver(view.launcher);
    elapse(200);
    fireEvent.pointerDown(view.plain);
    elapse(500);
    expect(view.tooltip()).toBeNull();

    fireEvent.pointerOver(view.disabled, { buttons: 1 });
    act(() => view.launcher.focus());
    elapse(500);
    expect(view.tooltip()).toBeNull();

    fireEvent.pointerUp(view.plain);
    fireEvent.pointerOver(view.disabled);
    elapse(500);
    expect(view.tooltip()?.textContent).toBe('Waits on an earlier choice.');
  });

  it('places a hover hint beside the pointer and a focus hint beside its control', () => {
    const view = renderHinted();
    const layer = () => document.querySelector<HTMLElement>('.hint-layer')!;
    fireEvent.pointerOver(view.launcher, { clientX: 100, clientY: 200 });
    fireEvent.pointerMove(view.launcher, { clientX: 140, clientY: 210 });
    elapse(500);
    expect([layer().style.left, layer().style.top]).toEqual(['152px', '226px']);
    fireEvent.pointerMove(view.launcher, { clientX: 300, clientY: 300 });
    expect([layer().style.left, layer().style.top]).toEqual(['152px', '226px']);
    fireEvent.pointerOut(view.launcher, { relatedTarget: view.plain });

    vi.spyOn(view.launcher, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 400, y: 50, width: 200, height: 30 }),
    );
    act(() => view.launcher.focus());
    elapse(500);
    expect([layer().style.left, layer().style.top]).toEqual(['500px', '88px']);
  });

  it('hides on scroll', () => {
    const view = renderHinted();
    fireEvent.pointerOver(view.launcher);
    elapse(500);
    expect(view.tooltip()).not.toBeNull();
    fireEvent.scroll(window);
    expect(view.tooltip()).toBeNull();
  });

  it('keeps a hint behind an open modal dialog hidden, including one scheduled before it opened', () => {
    render(
      <>
        <button className="quiet-action" type="button" {...hintProps('Behind the dialog')}>
          Row
        </button>
        <dialog aria-modal="true" open>
          <button className="quiet-action" type="button" {...hintProps('Inside the dialog')}>
            Node
          </button>
        </dialog>
        <HintLayer />
      </>,
    );
    const tooltip = () => document.querySelector('[role="tooltip"]:not([hidden])');
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Row', hidden: true }));
    elapse(500);
    expect(tooltip()).toBeNull();
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Node' }));
    elapse(500);
    expect(tooltip()?.textContent).toBe('Inside the dialog');
  });
});
