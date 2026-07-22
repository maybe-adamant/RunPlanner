// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ContextualPickerModel } from '../../projections/contextualPicker';
import { ContextualPicker } from './ContextualPicker';

afterEach(cleanup);

const model: ContextualPickerModel<string> = {
  selected: {
    key: 'combat-06',
    value: 'combat-06',
    label: 'Combat 06',
    state: 'possible',
    selected: true,
    disabled: false,
  },
  sections: [
    {
      key: 'required',
      kind: 'required',
      label: 'Required now',
      collapsible: false,
      items: [
        {
          key: 'preboss',
          value: 'preboss',
          label: 'Preboss',
          state: 'forced',
          selected: false,
          disabled: false,
          explanation: 'This option is part of the required choice set at this decision.',
        },
      ],
    },
    {
      key: 'category:combat',
      kind: 'category',
      label: 'Combat',
      collapsible: false,
      items: [
        {
          key: 'combat-06',
          value: 'combat-06',
          label: 'Combat 06',
          state: 'possible',
          selected: true,
          disabled: false,
        },
      ],
    },
    {
      key: 'unassessed:story',
      kind: 'unassessed',
      label: 'Story · Not evaluated',
      collapsible: false,
      items: [
        {
          key: 'story-01',
          value: 'story-01',
          label: 'Story 01',
          state: 'unassessed',
          selected: false,
          disabled: false,
          explanation: 'This decision has not been reached by the current evaluated prefix.',
        },
      ],
    },
    {
      key: 'unavailable',
      kind: 'unavailable',
      label: 'Unavailable',
      collapsible: true,
      items: [
        {
          key: 'combat-20',
          value: 'combat-20',
          label: 'Combat 20',
          state: 'impossible',
          selected: false,
          disabled: true,
          explanation: 'Biome depth is 1; this room requires 3 to any.',
        },
      ],
    },
  ],
};

describe('ContextualPicker', () => {
  it('renders ordered sections, searchable options, and an unavailable disclosure', async () => {
    const user = userEvent.setup();
    render(
      <ContextualPicker
        id="room-picker"
        label="Room"
        model={model}
        onSelect={() => undefined}
        placeholder="Select a room"
      />,
    );

    await user.click(screen.getByLabelText('Room'));

    expect(screen.getByText('Required now')).toBeTruthy();
    expect(screen.getByText('Combat')).toBeTruthy();
    expect(screen.getByText('Story · Not evaluated')).toBeTruthy();
    expect(screen.queryByText('Combat 20')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Unavailable (1)' }));
    expect(
      screen.getByText('Combat 20').closest('[cmdk-item]')?.getAttribute('aria-disabled'),
    ).toBe('true');

    const search = screen.getByRole('combobox', { name: 'Room choices' });
    await user.type(search, 'Story 01');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Story 01')).toBeTruthy();
    expect(within(listbox).queryByText('Combat 06')).toBeNull();
  });

  it('commits one complete option through keyboard interaction and closes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ContextualPicker
        id="room-picker"
        label="Room"
        model={model}
        onSelect={onSelect}
        placeholder="Select a room"
      />,
    );

    const trigger = screen.getByLabelText('Room');
    await user.click(trigger);
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('preboss');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
