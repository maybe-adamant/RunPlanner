// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouteAddress } from '@run-planner/engine/authored-project';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import {
  EditorDialog,
  EditorDialogDraftActions,
  type EditorDialogModel,
} from '@planner/ui/controls/EditorDialog';
import { ProjectHistoryControls } from '@planner/ui/project/ProjectHistoryControls';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);

type Kind = EditorDialogModel['kind'];

function Host({
  initialFocusId,
  kind,
  onClose = () => undefined,
}: {
  readonly initialFocusId?: string;
  readonly kind: Kind;
  readonly onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <>
      <button id="editor-launcher" onClick={() => setOpen(true)} type="button">
        Open editor
      </button>
      <button type="button">Elsewhere</button>
      {open ? (
        <EditorDialog
          {...(initialFocusId === undefined ? {} : { initialFocusId })}
          model={kind === 'draft' ? { kind, onCancel: close } : { kind, onClose: close }}
          returnFocusId="editor-launcher"
          title="Editor"
        >
          {kind === 'draft' ? (
            <EditorDialogDraftActions onCancel={close} onSave={close} saveDisabled={false} />
          ) : null}
          <button disabled type="button">
            Waiting control
          </button>
          <button type="button">First control</button>
          <button id="exact-repair" type="button">
            Repair control
          </button>
        </EditorDialog>
      ) : null}
    </>
  );
}

function renderHost(kind: Kind, options: { readonly initialFocusId?: string } = {}) {
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Underworld'),
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
    }),
  );
  const onClose = vi.fn();
  render(
    <Provider store={application.store}>
      <ProjectHistoryControls />
      <Host kind={kind} onClose={onClose} {...options} />
    </Provider>,
  );
  return { application, onClose, user: userEvent.setup() };
}

describe('editor dialog contract', () => {
  it('focuses the exact repair control a navigation names', async () => {
    const { user } = renderHost('draft', { initialFocusId: 'exact-repair' });
    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Repair control' }));
  });

  it.each(['draft', 'view'] as const)(
    'focuses the first enabled control of a %s editor and returns focus to its launcher after Escape',
    async (kind) => {
      const { onClose, user } = renderHost(kind);
      const launcher = screen.getByRole('button', { name: 'Open editor' });
      await user.click(launcher);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First control' }));
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(launcher);
    },
  );

  it('focuses the title-bar dismiss action, never Save, while the body has no enabled control', () => {
    const application = createApplication();
    render(
      <Provider store={application.store}>
        <EditorDialog model={{ kind: 'draft', onCancel: () => undefined }} title="Editor">
          <EditorDialogDraftActions
            onCancel={() => undefined}
            onSave={() => undefined}
            saveDisabled={false}
          />
          <p>Loading choices…</p>
        </EditorDialog>
      </Provider>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    application.dispose();
  });

  it('puts the first finding, its count of more, Cancel and Save on the title bar', async () => {
    const application = createApplication();
    const onCancel = vi.fn();
    const actions = (issues: readonly (readonly [string, string])[]) => (
      <Provider store={application.store}>
        <EditorDialog model={{ kind: 'draft', onCancel }} title="Editor">
          <EditorDialogDraftActions
            issues={issues}
            onCancel={onCancel}
            onSave={() => undefined}
            saveDisabled={issues.length > 0}
          />
        </EditorDialog>
      </Provider>
    );
    const view = render(
      actions([
        ['a', 'First issue'],
        ['b', 'Second issue'],
        ['c', 'Third issue'],
      ]),
    );
    const header = screen.getByRole('dialog').querySelector('header')!;
    const finding = within(header).getByRole('button', { name: 'First issue (2 more)' });
    expect(finding.textContent).toContain('+2');
    expect(within(header).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    await userEvent.setup().click(within(header).getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    view.rerender(actions([]));
    expect(header.querySelector('.editor-dialog-finding')).toBeNull();
    expect(within(header).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
    application.dispose();
  });

  it('offers Save and Cancel for a draft and only Close for a view', async () => {
    const draft = renderHost('draft');
    await draft.user.click(screen.getByRole('button', { name: 'Open editor' }));
    expect(
      Array.from(
        screen.getByRole('dialog').querySelectorAll('header button'),
        (button) => button.ariaLabel ?? button.textContent,
      ),
    ).toEqual(['Cancel', 'Save']);
    await draft.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();

    const view = renderHost('view');
    await view.user.click(screen.getByRole('button', { name: 'Open editor' }));
    const dialog = screen.getByRole('dialog');
    expect(
      Array.from(dialog.querySelectorAll('header button'), (button) => button.ariaLabel),
    ).toEqual(['Close']);
    await view.user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open editor' }));
  });

  it.each([
    ['draft', 0],
    ['view', 1],
  ] as const)('a %s editor lets history shortcuts undo %i edits', async (kind, undone) => {
    const { application, user } = renderHost(kind);
    const past = () => application.store.getState().projectWorkspace.history!.past.length;
    const before = past();
    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    await user.keyboard('{Control>}z{/Control}');
    expect(past()).toBe(before - undone);
    await user.keyboard('{Escape}');
    expect(application.store.getState().editorSession.openDraftEditors).toBe(0);
    application.dispose();
  });
});
