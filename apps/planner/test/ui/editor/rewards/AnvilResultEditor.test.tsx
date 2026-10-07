// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { Provider } from 'react-redux';

import { createApplication } from '@planner/composition/createApplication';
import { projectAnvilResultPickers } from '@planner/projections/contextual/anvilResultPickers';
import type { WorkspaceAcquisitionConversionInteraction } from '@planner/projections/structured-workspace';

import {
  AnvilResultEditor,
  AnvilResultLauncher,
} from '@planner/ui/editor/rewards/AnvilResultEditor';

type AnvilInteraction = NonNullable<WorkspaceAcquisitionConversionInteraction['anvil']>;

function anvilInteraction(
  input: Omit<AnvilInteraction, 'pickersFor' | 'traitLabel'> &
    Partial<Pick<AnvilInteraction, 'traitLabel'>>,
): AnvilInteraction {
  const domain = { ...input, traitLabel: input.traitLabel ?? ((traitKey: string) => traitKey) };
  return { ...domain, pickersFor: (draft) => projectAnvilResultPickers(domain, draft) };
}

afterEach(cleanup);

describe('Anvil result editor', () => {
  it('authors one removal followed by two distinct additions in three contextual pickers', async () => {
    const onCommit = vi.fn();
    const interaction = anvilInteraction({
      contextReached: true,
      value: null,
      removedTraitKeys: ['OldHammer'],
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
    });
    const user = userEvent.setup();
    render(<AnvilResultEditor interaction={interaction} onCommit={onCommit} />);

    const feedback = screen.getByRole('status', { name: 'Anvil feedback' });
    expect(feedback.textContent).toContain('No current findings.');
    // The feedback region closes the editor body, directly above its footer.
    expect(feedback.nextElementSibling?.tagName).toBe('FOOTER');

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

  it('closes its open dialog and clears the session target when the context is lost', async () => {
    const application = createApplication();
    const owner = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(
            { kind: 'biome', routeKey: 'Underworld', biomeKey: 'I' },
            createOccurrenceId('anvil-shop'),
          ),
          'roomExit',
        ),
        'anvil',
      ),
      'self',
    );
    const interaction = (contextReached: boolean): AnvilInteraction =>
      anvilInteraction({
        contextReached,
        value: null,
        removedTraitKeys: [],
        addedTraitKeysFor: () => [],
        intentFor: () => {
          throw new Error('closing must not bind commands');
        },
      });
    const launcher = (contextReached: boolean) => (
      <Provider store={application.store}>
        <AnvilResultLauncher interaction={interaction(contextReached)} owner={owner} />
      </Provider>
    );
    const user = userEvent.setup();
    const view = render(launcher(true));
    await user.click(screen.getByRole('button', { name: 'Edit Anvil: Choose result' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(application.store.getState().editorSession.anvilDialogTarget).toEqual(owner);
    view.rerender(launcher(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(application.store.getState().editorSession.anvilDialogTarget ?? null).toBeNull();
    view.rerender(launcher(true));
    // A later reach needs an explicit reopen.
    expect(screen.queryByRole('dialog')).toBeNull();
    application.dispose();
  });
});
