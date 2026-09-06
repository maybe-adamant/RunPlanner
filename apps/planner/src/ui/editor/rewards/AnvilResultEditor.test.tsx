// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceAcquisitionConversionInteraction } from '@planner/projections/structured-workspace';

import { AnvilResultEditor } from './AnvilResultEditor';

type AnvilInteraction = NonNullable<WorkspaceAcquisitionConversionInteraction['anvil']>;

afterEach(cleanup);

describe('Anvil result editor', () => {
  it('authors one removal followed by two distinct additions in three contextual pickers', async () => {
    const onCommit = vi.fn();
    const interaction: AnvilInteraction = {
      value: null,
      removableTraitKeys: ['OldHammer'],
      addedTraitKeysFor: (removed, prior) =>
        removed !== 'OldHammer'
          ? []
          : prior.length === 0
            ? ['FirstHammer']
            : prior[0] === 'FirstHammer'
              ? ['SecondHammer']
              : [],
      traitLabel: (traitKey) =>
        ({ OldHammer: 'Old Hammer', FirstHammer: 'First Hammer', SecondHammer: 'Second Hammer' })[
          traitKey
        ] ?? traitKey,
      intentFor: () => {
        throw new Error('the pure editor must not bind commands');
      },
    };
    const user = userEvent.setup();
    render(<AnvilResultEditor interaction={interaction} onCommit={onCommit} />);

    expect(
      (screen.getByRole('button', { name: 'Added Hammer 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Added Hammer 2' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Removed Hammer' }));
    await user.click(screen.getByRole('option', { name: 'Old Hammer' }));
    await user.click(screen.getByRole('button', { name: 'Added Hammer 1' }));
    await user.click(screen.getByRole('option', { name: 'First Hammer' }));
    await user.click(screen.getByRole('button', { name: 'Added Hammer 2' }));
    await user.click(screen.getByRole('option', { name: 'Second Hammer' }));
    await user.click(screen.getByRole('button', { name: 'Save Anvil result' }));

    expect(onCommit).toHaveBeenCalledWith({
      kind: 'anvilOfFates',
      removedTraitKey: 'OldHammer',
      addedTraitKeys: ['FirstHammer', 'SecondHammer'],
    });
  });
});
