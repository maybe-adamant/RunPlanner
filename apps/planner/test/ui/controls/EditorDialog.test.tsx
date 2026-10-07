// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
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
  EditorDialogFeedback,
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
          eyebrow="Eyebrow"
          footer={<EditorDialogDraftActions onCancel={close} onSave={close} saveDisabled={false} />}
          {...(initialFocusId === undefined ? {} : { initialFocusId })}
          model={kind === 'draft' ? { kind, onCancel: close } : { kind, onDone: close }}
          returnFocusId="editor-launcher"
          title="Editor"
        >
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

  it.each(['draft', 'live'] as const)(
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

  it('focuses the footer dismiss action, never Save or Clear, while the body has no enabled control', () => {
    const application = createApplication();
    render(
      <Provider store={application.store}>
        <EditorDialog
          eyebrow="Eyebrow"
          footer={
            <EditorDialogDraftActions
              onCancel={() => undefined}
              onSave={() => undefined}
              saveDisabled={false}
              secondary={<button type="button">Clear</button>}
            />
          }
          model={{ kind: 'draft', onCancel: () => undefined }}
          title="Editor"
        >
          <p>Loading choices…</p>
        </EditorDialog>
      </Provider>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    // The footer is the only visible exit; the header carries no Close.
    expect(screen.getByRole('dialog').querySelector('header button')).toBeNull();
    application.dispose();
  });

  it('titles every findings region Feedback and names coexisting regions apart', () => {
    render(
      <>
        <EditorDialogFeedback name="Offer feedback" />
        <EditorDialogFeedback
          entries={[['stone', 'Choose a Stone target.']]}
          name="Circe feedback"
        />
      </>,
    );
    const outer = screen.getByRole('status', { name: 'Offer feedback' });
    const inner = screen.getByRole('status', { name: 'Circe feedback' });
    expect(outer.querySelector('h3')?.textContent).toBe('Feedback');
    expect(inner.querySelector('h3')?.textContent).toBe('Feedback');
    expect(outer.textContent).toContain('No current findings.');
    expect(inner.textContent).not.toContain('No current findings.');
    expect(inner.textContent).toContain('Choose a Stone target.');
  });

  it('offers Save and Cancel for a draft and only Done for a live editor', async () => {
    const draft = renderHost('draft');
    await draft.user.click(screen.getByRole('button', { name: 'Open editor' }));
    const draftFooter = screen.getByRole('dialog').querySelector('footer')!;
    expect(
      Array.from(draftFooter.querySelectorAll('button'), (button) => button.textContent),
    ).toEqual(['Cancel', 'Save']);
    await draft.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();

    const live = renderHost('live');
    await live.user.click(screen.getByRole('button', { name: 'Open editor' }));
    const liveFooter = screen.getByRole('dialog').querySelector('footer')!;
    expect(
      Array.from(liveFooter.querySelectorAll('button'), (button) => button.textContent),
    ).toEqual(['Done']);
    await live.user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open editor' }));
  });

  it.each([
    ['draft', 0],
    ['live', 1],
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
