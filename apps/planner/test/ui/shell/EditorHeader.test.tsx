// @vitest-environment jsdom

import { act, cleanup, screen, within } from '@testing-library/react';
import { createRouteAddress } from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

async function openPlan() {
  const library = createMemoryProjectLibrary();
  const application = createApplication({ projectLibrary: library.adapter });
  await application.projectOperations.createNew('Underworld');
  const rendered = renderPlannerForInteraction({ application });
  const edit = (rank: number) =>
    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceFearVowRank',
          route: createRouteAddress('Underworld'),
          vowKey: 'EnemyDamageShrineUpgrade',
          rank,
        }),
      );
    });
  return { ...rendered, application, edit, library };
}

describe('editor header', () => {
  afterEach(cleanup);

  it('shows Discard changes only after an edit, in space kept for it, as one undoable step', async () => {
    const { application, edit, library, user } = await openPlan();
    const discard = screen.getByText('Discard changes', { selector: 'button' });
    expect(screen.queryByRole('button', { name: 'Discard changes' })).toBeNull();
    expect(discard.getAttribute('data-hidden')).toBe('true');
    expect(discard).toHaveProperty('disabled', true);
    expect(screen.queryByText('Saved as you edit')).toBeNull();
    const opened = application.store.getState().projectWorkspace.history!.present;

    edit(3);
    await act(async () => {
      expect((await application.projectOperations.flush()).status).toBe('success');
    });
    const edited = application.store.getState().projectWorkspace.history!.present;
    expect(await library.plans(catalog)).toEqual([edited]);
    expect(discard.getAttribute('data-hidden')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(application.store.getState().projectWorkspace.history!.present).toEqual(opened);
    expect(discard.getAttribute('data-hidden')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history!.present).toBe(edited);
  });

  it('shows Not saved in its reserved slot until a later write succeeds', async () => {
    const { application, edit, library, user } = await openPlan();
    const slot = document.querySelector('.editor-save-slot')!;
    expect(slot.textContent).toBe('');

    library.failWrites(new Error('disk full'));
    edit(2);
    await act(async () => {
      expect((await application.projectOperations.flush()).status).toBe('failure');
    });
    const alert = within(slot as HTMLElement).getByRole('alert');
    expect(alert.textContent).toBe('Not saved Details');
    await user.click(within(alert).getByRole('button', { name: 'Not saved Details' }));
    expect(screen.getByRole('textbox', { name: 'Not saved details' })).toHaveProperty(
      'value',
      'Could not save the plan: disk full',
    );

    library.failWrites(null);
    edit(3);
    await act(async () => {
      expect((await application.projectOperations.flush()).status).toBe('success');
    });
    expect(within(slot as HTMLElement).queryByRole('alert')).toBeNull();
  });

  it('renames from the title, returns Home, and offers history as labelled icon buttons', async () => {
    const { application, user } = await openPlan();
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Plan name' });
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(document.activeElement).toBe(field);
    await user.keyboard('Gorgon run{Enter}');
    expect(application.store.getState().projectWorkspace.history!.present.name).toBe('Gorgon run');

    const history = screen.getByRole('group', { name: 'Project history' });
    const undo = within(history).getByRole('button', { name: 'Undo' });
    const redo = within(history).getByRole('button', { name: 'Redo' });
    expect(undo.textContent).toBe('');
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(application.store.getState().librarySession.view).toEqual({
      kind: 'home',
      tab: 'library',
    });
    expect(screen.queryByRole('textbox', { name: 'Plan name' })).toBeNull();
  });
});
