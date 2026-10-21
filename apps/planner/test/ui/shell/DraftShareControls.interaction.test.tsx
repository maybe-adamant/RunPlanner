// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createProjectDocument,
  decodeDraftShareCode,
  encodeDraftShareCode,
  projectDraftShareInputs,
  type DraftShareInputs,
} from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { routePanelSelected } from '@planner/state/editorSessionSlice';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function open(routeKey = 'Underworld') {
  const application = createApplication({});
  application.store.dispatch(
    newProjectCreated(
      createProjectDocument(application.catalog, {
        projectId: 'share',
        routeKey,
        configuredBiomeCount: 4,
      }),
    ),
  );
  application.store.dispatch(routePanelSelected({ routeKey, panel: { kind: 'draft' } }));
  renderPlannerForInteraction({ application });
  const history = () => application.store.getState().projectWorkspace.history!;
  return { application, catalog: application.catalog, history };
}

const actions = () => document.querySelector('.draft-action-row') as HTMLElement;

describe('Draft share controls', () => {
  it('copies the code in place, swapping the label without moving the row, then restores it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { catalog, history } = open();
    const copy = within(actions()).getByRole('button', { name: 'Copy code' });
    const rows = document.querySelector('.draft-actions')!.childElementCount;

    await user.click(copy);
    expect(await within(actions()).findByRole('button', { name: 'Copied' })).toBe(copy);
    const decoded = decodeDraftShareCode(
      catalog,
      await globalThis.navigator.clipboard.readText(),
      history().present.route,
    );
    expect(decoded).toEqual({ ok: true, inputs: projectDraftShareInputs(history().present) });
    expect(document.querySelector('.draft-actions')!.childElementCount).toBe(rows);
    act(() => vi.advanceTimersByTime(1_600));
    await waitFor(() =>
      expect(within(actions()).getByRole('button', { name: 'Copy code' })).toBe(copy),
    );

    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });
    await user.click(copy);
    expect(await within(actions()).findByRole('button', { name: 'Failed' })).toBe(copy);
    expect(document.querySelector('.draft-actions')!.childElementCount).toBe(rows);
  });

  it('pastes a code with Enter as one undoable edit of the spec and loadout, closing the popover', async () => {
    const user = userEvent.setup();
    const { catalog, history, application } = open();
    const before = history().present;
    const base = projectDraftShareInputs(before);
    const fearVow = catalog.fearVows.values[0]!.key;
    const inputs: DraftShareInputs = {
      ...base,
      configuredBiomeCount: 2,
      loadout: {
        ...base.loadout,
        familiarKey: catalog.familiars.values.at(-1)!.key,
        fearRanks: { ...base.loadout.fearRanks, [fearVow]: 1 },
      },
      draft: { ...base.draft, godKeys: ['Zeus', 'Apollo', 'Hestia'], seed: 99 },
    };

    await user.click(within(actions()).getByRole('button', { name: 'Paste code' }));
    const field = screen.getByRole('textbox', { name: 'Draft code' });
    await user.type(field, `${encodeDraftShareCode(catalog, inputs).toLowerCase()}{Enter}`);

    expect(screen.queryByRole('textbox', { name: 'Draft code' })).toBeNull();
    expect(projectDraftShareInputs(history().present)).toEqual(inputs);
    expect(history().past).toHaveLength(1);
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(history().present).toBe(before);
  });

  it('shows each refusal under the field, keeps the popover open and Esc closes it', async () => {
    const user = userEvent.setup();
    const { catalog, history } = open();
    const code = encodeDraftShareCode(catalog, projectDraftShareInputs(history().present));
    const surfaceCode = encodeDraftShareCode(
      catalog,
      projectDraftShareInputs(
        createProjectDocument(catalog, {
          projectId: 's',
          routeKey: 'Surface',
          configuredBiomeCount: 0,
        }),
      ),
    );
    await user.click(within(actions()).getByRole('button', { name: 'Paste code' }));
    const field = screen.getByRole('textbox', { name: 'Draft code' });
    const refusal = () => screen.getByRole('alert');

    for (const [text, message] of [
      ['not a code!', 'Not a draft code.'],
      [`2${code.slice(1)}`, 'This code is from another planner version.'],
      [
        `${code[0]}${code[1] === '0' ? 'Z' : '0'}${code.slice(2)}`,
        'This code is from another planner version.',
      ],
      [surfaceCode, 'This code is for another route.'],
      [code.slice(0, 5), 'This code is damaged.'],
    ] as const) {
      await user.clear(field);
      await user.type(field, `${text}{Enter}`);
      expect(refusal().textContent).toBe(message);
      expect(field.getAttribute('aria-invalid')).toBe('true');
    }
    expect(history().past).toHaveLength(0);

    // Editing clears the refusal; its slot stays mounted.
    await user.type(field, 'x');
    expect(refusal().textContent).toBe('');
    expect(field.getAttribute('aria-invalid')).toBeNull();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Draft code' })).toBeNull();
  });
});
