// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ScreenRerollCount } from '@planner/ui/editor/rewards/ScreenRerollCount';

afterEach(cleanup);

it('steps the draft count, stopping where the pool does with the reason', () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <ScreenRerollCount
      count={0}
      onChange={onChange}
      rerolls={{ count: 0, maxCount: 1, lockAtMax: 'poolShort' }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Fewer rerolls' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'More rerolls' }));
  expect(onChange).toHaveBeenLastCalledWith(1);

  rerender(
    <ScreenRerollCount
      count={1}
      onChange={onChange}
      rerolls={{ count: 0, maxCount: 1, lockAtMax: 'poolShort' }}
    />,
  );
  const more = screen.getByRole('button', { name: 'More rerolls' });
  expect(more).toHaveProperty('disabled', true);
  expect(more.getAttribute('data-hint')).toBe('Not enough rerolls left.');
  fireEvent.click(screen.getByRole('button', { name: 'Fewer rerolls' }));
  expect(onChange).toHaveBeenLastCalledWith(0);
});
