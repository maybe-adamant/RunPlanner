import { describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { WorkspaceCommandIntent } from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';

import { dispatchCommandIntent } from './useCommandIntent';

describe('command-intent dispatch adapter', () => {
  it.each([
    { expected: ['focus', 'command'], timing: 'before' as const },
    { expected: ['command', 'focus'], timing: 'after' as const },
    { expected: ['command'], timing: undefined },
  ])('dispatches declared $timing focus in exact order', ({ expected, timing }) => {
    const application = createApplication();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const owner = { kind: 'project' as const };
    const intent: WorkspaceCommandIntent = Object.freeze({
      command: Object.freeze({
        kind: 'RenameProject' as const,
        name: `Intent ${timing ?? 'none'}`,
      }),
      ...(timing === undefined ? {} : { focus: Object.freeze({ owner, timing }) }),
    });

    dispatchCommandIntent(application.store.dispatch, intent);

    expect(
      dispatch.mock.calls.map(([action]) => {
        if (semanticOwnerFocused.match(action)) return 'focus';
        if (authoredProjectCommandDispatched.match(action)) return 'command';
        throw new Error(`Unexpected adapter action ${String(action.type)}`);
      }),
    ).toEqual(expected);
    application.dispose();
  });

  it('applies declared after-focus even when the command produces no authored transition', () => {
    const application = createApplication();
    const before = application.store.getState().projectWorkspace.history;
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const owner = { kind: 'project' as const };

    dispatchCommandIntent(application.store.dispatch, {
      command: { kind: 'RenameProject', name: before.present.name },
      focus: { owner, timing: 'after' },
    });

    expect(application.store.getState().projectWorkspace.history).toBe(before);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    expect(
      dispatch.mock.calls.map(([action]) =>
        authoredProjectCommandDispatched.match(action) ? 'command' : 'focus',
      ),
    ).toEqual(['command', 'focus']);
    application.dispose();
  });
});
