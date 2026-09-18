// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAppScale } from '@planner/ui/shell/useAppScale';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

afterEach(cleanup);

function scale() {
  return document.documentElement.style.getPropertyValue('--app-scale');
}

it('restores, changes and persists scale with keyboard shortcuts', () => {
  const preference = { read: () => 80, write: vi.fn() };
  const view = renderHook(() => useAppScale(preference));
  expect(scale()).toBe('0.8');
  fireEvent.keyDown(window, { key: '+', ctrlKey: true });
  expect(scale()).toBe('0.9');
  expect(preference.write).toHaveBeenLastCalledWith(90);
  fireEvent.keyDown(window, { key: '-', ctrlKey: true });
  expect(scale()).toBe('0.8');
  view.unmount();
  expect(scale()).toBe('');
});

it.each([undefined, 0, 49, 205, 83, NaN])(
  'defaults to 100%% for invalid stored scale %s',
  (saved) => {
    renderHook(() => useAppScale({ read: () => saved, write: vi.fn() }));
    expect(scale()).toBe('1');
  },
);

it('handles zoom keys while editing, including reset, without consuming unrelated shortcuts', () => {
  renderHook(() => useAppScale());
  render(<input aria-label="Draft" />);
  const input = screen.getByRole('textbox');
  for (const key of ['=', '+']) {
    expect(fireEvent.keyDown(input, { key, ctrlKey: true })).toBe(false);
  }
  expect(scale()).toBe('1.2');
  expect(fireEvent.keyDown(input, { key: '-', metaKey: true })).toBe(false);
  expect(scale()).toBe('1.1');
  expect(fireEvent.keyDown(input, { key: '0', ctrlKey: true })).toBe(false);
  expect(scale()).toBe('1');
  expect(fireEvent.keyDown(input, { key: '+', ctrlKey: true, altKey: true })).toBe(true);
  expect(fireEvent.keyDown(input, { key: '+', ctrlKey: true, isComposing: true })).toBe(true);
  expect(fireEvent.keyDown(input, { key: '+', ctrlKey: false })).toBe(true);
  expect(fireEvent.keyDown(input, { key: 'z', ctrlKey: true })).toBe(true);
  expect(scale()).toBe('1');
});

it('accumulates Ctrl-wheel deltas while leaving ordinary scrolling native', () => {
  renderHook(() => useAppScale());
  expect(fireEvent.wheel(window, { deltaY: 100 })).toBe(true);
  expect(scale()).toBe('1');
  for (let count = 0; count < 3; count++) {
    expect(fireEvent.wheel(window, { ctrlKey: true, deltaY: 20 })).toBe(false);
  }
  expect(scale()).toBe('1');
  fireEvent.wheel(window, { ctrlKey: true, deltaY: 20 });
  expect(scale()).toBe('0.9');
  fireEvent.wheel(window, { ctrlKey: true, deltaY: -5, deltaMode: 1 });
  expect(scale()).toBe('1');
});

it('enforces the scale limits without falling through to native zoom', () => {
  const view = renderHook(() => useAppScale({ read: () => 50, write: vi.fn() }));
  expect(fireEvent.keyDown(window, { key: '-', ctrlKey: true })).toBe(false);
  expect(fireEvent.wheel(window, { ctrlKey: true, deltaY: 120 })).toBe(false);
  expect(scale()).toBe('0.5');
  for (let count = 0; count < 16; count++) fireEvent.keyDown(window, { key: '+', ctrlKey: true });
  expect(scale()).toBe('2');
  view.unmount();
  expect(fireEvent.keyDown(window, { key: '+', ctrlKey: true })).toBe(true);
  expect(fireEvent.wheel(window, { ctrlKey: true, deltaY: 120 })).toBe(true);
});

it('changes scale without publishing project history or reevaluating the plan', () => {
  const view = renderPlannerForInteraction();
  const before = view.application.store.getState().projectWorkspace;
  fireEvent.keyDown(window, { key: '-', ctrlKey: true });
  expect(scale()).toBe('0.9');
  expect(view.application.store.getState().projectWorkspace).toBe(before);
});
