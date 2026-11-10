// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import { createEchoGoldIAnvilDuplicateProject } from '@run-planner/test-fixtures/underworld';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import {
  echoDuplicateKey,
  echoShop,
  echoShopRows,
  swapEchoAway,
} from '@planner-test/support/removed-actions';

afterEach(cleanup);

function notice(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-removed-actions-notice]');
}

describe('removed actions notice', () => {
  it('announces another room’s removed row, opens that room’s Timeline and undoes the edit', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createEchoGoldIAnvilDuplicateProject()));
    const { user } = renderPlannerForInteraction({ application });
    const present = () => application.store.getState().projectWorkspace.history!.present;
    expect(notice()).toBeNull();

    act(() => application.store.dispatch(authoredProjectCommandDispatched(swapEchoAway)));
    const shown = notice();
    expect(shown).not.toBeNull();
    expect(echoShopRows(present())).not.toContain(echoDuplicateKey);

    const link = within(shown!).getByRole('button', { name: 'Location 40' });
    // The room's own name shows on hover.
    expect(link.getAttribute('data-hint')).toBe('Preboss');
    await user.click(link);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(echoShop);
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: echoShop.biomeKey,
    });
    expect(screen.getByRole('tab', { name: 'Room Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(notice()).not.toBeNull();

    await user.click(within(notice()!).getByRole('button', { name: 'Undo' }));
    expect(echoShopRows(present())).toContain(echoDuplicateKey);
    expect(notice()).toBeNull();

    // Redo republishes the edit without announcing it again.
    act(() => application.store.dispatch(authoredProjectRedoRequested()));
    expect(echoShopRows(present())).not.toContain(echoDuplicateKey);
    expect(notice()).toBeNull();
  });

  it('closes on Dismiss without changing the plan', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createEchoGoldIAnvilDuplicateProject()));
    const { user } = renderPlannerForInteraction({ application });
    act(() => application.store.dispatch(authoredProjectCommandDispatched(swapEchoAway)));
    const history = application.store.getState().projectWorkspace.history;
    await user.click(within(notice()!).getByRole('button', { name: 'Dismiss' }));
    expect(notice()).toBeNull();
    expect(application.store.getState().projectWorkspace.history).toBe(history);
  });
});
