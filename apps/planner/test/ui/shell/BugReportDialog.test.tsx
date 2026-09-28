// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { createFakeGameModuleHost } from '@planner-test/fixtures/gameModuleHost';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

async function openFromGamePanel(
  host: ReturnType<typeof createFakeGameModuleHost>['host'],
  withProject: boolean,
) {
  const application = createApplication({ gameModuleHost: host });
  if (withProject) await application.projectOperations.createNew('Underworld');
  const rendered = renderPlannerForInteraction({ application, startWithProject: false });
  await rendered.user.click(await screen.findByRole('button', { name: /^Game — / }));
  const panel = await screen.findByRole('dialog', { name: 'Game' });
  await rendered.user.click(within(panel).getByRole('button', { name: 'Create bug report…' }));
  const dialog = await screen.findByRole('dialog', { name: 'Create bug report' });
  return { ...rendered, dialog };
}

describe('Bug report dialog', () => {
  afterEach(cleanup);

  it('saves the chosen contents, then offers the folder and the issue page', async () => {
    const game = createFakeGameModuleHost();
    const { dialog, user } = await openFromGamePanel(game.host, true);
    const openPlan = within(dialog).getByRole('checkbox', { name: 'Open plan' });
    expect((openPlan as HTMLInputElement).checked).toBe(true);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Game logs' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create…' }));

    expect(await within(dialog).findByRole('status')).toHaveProperty(
      'textContent',
      expect.stringMatching(/^Saved run-planner-report-\d{8}-\d{4}\.zip\.$/),
    );
    const [defaultFileName, request] = game.host.createBugReport.mock.calls[0]!;
    expect(defaultFileName).toMatch(/^run-planner-report-\d{8}-\d{4}\.zip$/);
    expect(request).toMatchObject({ includePlanSlots: true, includeLogs: false });
    expect(JSON.parse(request.openPlan ?? 'null')).toMatchObject({
      route: { routeKey: 'Underworld' },
    });
    expect(request.appFacts).toMatchObject({ protocolVersion: expect.any(Number) });

    await user.click(within(dialog).getByRole('button', { name: 'Show in folder' }));
    expect(game.host.revealBugReport).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Report on GitHub' }));
    expect(game.host.openExternalPage).toHaveBeenCalledWith(
      'https://github.com/maybe-adamant/RunPlanner/issues/new',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create bug report' })).toBeNull(),
    );
  });

  it('keeps the choices after a cancelled save and shows a host failure', async () => {
    const game = createFakeGameModuleHost();
    const { dialog, user } = await openFromGamePanel(game.host, false);
    const openPlan = within(dialog).getByRole('checkbox', {
      name: 'Open plan',
    }) as HTMLInputElement;
    expect(openPlan.disabled).toBe(true);
    expect(openPlan.checked).toBe(false);

    game.host.createBugReport.mockResolvedValueOnce({ kind: 'cancelled' });
    await user.click(within(dialog).getByRole('button', { name: 'Create…' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Create…' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(within(dialog).queryByRole('status')).toBeNull();

    game.host.createBugReport.mockRejectedValueOnce(new Error('could not replace bug report'));
    await user.click(within(dialog).getByRole('button', { name: 'Create…' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'could not replace bug report',
    );
    expect(game.host.createBugReport.mock.calls[0]![1].openPlan).toBeNull();
  });

  it('closes only itself on Escape, and not while saving', async () => {
    const game = createFakeGameModuleHost();
    let finish: () => void = () => undefined;
    game.host.createBugReport.mockImplementationOnce(
      (defaultFileName) =>
        new Promise((resolve) => {
          finish = () =>
            resolve({ kind: 'saved', fileName: defaultFileName, entries: [], issuePageUrl: '' });
        }),
    );
    const { dialog, user } = await openFromGamePanel(game.host, false);
    const escape = () =>
      fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));

    await user.click(within(dialog).getByRole('button', { name: 'Create…' }));
    escape();
    expect(screen.getByRole('dialog', { name: 'Create bug report' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Game' })).toBeTruthy();
    finish();
    await within(dialog).findByRole('status');

    escape();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create bug report' })).toBeNull(),
    );
    expect(screen.getByRole('dialog', { name: 'Game' })).toBeTruthy();
  });

  it('opens from About in the desktop application only', async () => {
    const game = createFakeGameModuleHost();
    const { user } = renderPlannerForInteraction({
      application: createApplication({ gameModuleHost: game.host }),
      startWithProject: false,
    });
    await user.click(screen.getByRole('button', { name: 'About' }));
    await user.click(await screen.findByRole('button', { name: 'Create bug report…' }));
    expect(await screen.findByRole('dialog', { name: 'Create bug report' })).toBeTruthy();
    cleanup();

    const browser = renderPlannerForInteraction({ startWithProject: false });
    await browser.user.click(screen.getByRole('button', { name: 'About' }));
    await screen.findByRole('dialog', { name: 'About Run Planner' });
    expect(screen.queryByRole('button', { name: 'Create bug report…' })).toBeNull();
  });
});
