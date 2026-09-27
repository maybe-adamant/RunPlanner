// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { createFakeGameModuleHost, gameModuleStatus } from '@planner-test/fixtures/gameModuleHost';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

async function openSettings(host: ReturnType<typeof createFakeGameModuleHost>['host']) {
  const rendered = renderPlannerForInteraction({
    application: createApplication({ gameModuleHost: host }),
    startWithProject: false,
  });
  await rendered.user.click(screen.getByRole('button', { name: 'Settings' }));
  const dialog = await screen.findByRole('dialog', { name: 'Settings' });
  await within(dialog).findByText('Target');
  return { ...rendered, dialog };
}

describe('Settings game module section', () => {
  afterEach(cleanup);

  it('locates a discovered profile or a chosen folder through the host', async () => {
    const game = createFakeGameModuleHost(
      gameModuleStatus({ target: null, inspection: null, publicationBlockers: [] }),
    );
    game.host.discoverTargets.mockResolvedValue({
      supported: true,
      profiles: [{ path: '/profiles/h2-dev', location: '/profiles/h2-dev', label: 'h2-dev' }],
    });
    game.host.useDiscoveredTarget.mockResolvedValue(gameModuleStatus());
    const { dialog, user } = await openSettings(game.host);
    expect(within(dialog).getByText('Not set')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Locate Game Module' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Use h2-dev' }));
    expect(game.host.useDiscoveredTarget).toHaveBeenCalledWith('/profiles/h2-dev');
    expect(await within(dialog).findByText('/profiles/h2-dev (r2modman profile)')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Locate Game Module' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Choose Folder…' }));
    expect(game.host.chooseTargetFolder).toHaveBeenCalledTimes(1);
  });

  it('asks before overwriting an existing copy and shows the r2modman warning', async () => {
    const managed = gameModuleStatus({
      inspection: {
        module: { state: 'unrecognized', version: '0.10.0', source: null, matchesBundled: false },
        r2modman: { state: 'managed', moduleEnabled: true },
        install: { action: 'update', consentRequired: true },
        removable: false,
      },
    });
    const game = createFakeGameModuleHost(managed);
    game.host.install.mockResolvedValue({ outcome: 'installed', status: gameModuleStatus() });
    const { dialog, user } = await openSettings(game.host);
    expect(
      within(within(dialog).getByRole('list', { name: 'Game module notices' })).getByText(
        /renames or deletes the planner’s files/,
      ),
    ).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Remove Game Module' })).toHaveProperty(
      'disabled',
      true,
    );

    await user.click(within(dialog).getByRole('button', { name: 'Install / Update Game Module' }));
    let consent = await screen.findByRole('dialog', { name: 'Replace existing game module?' });
    expect(within(consent).getByText(/\(0\.10\.0\) will be replaced/)).toBeTruthy();
    expect(within(consent).getByText(/Remove the Run Planner package in r2modman/)).toBeTruthy();
    await user.click(within(consent).getByRole('button', { name: 'Cancel' }));
    expect(game.host.install).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Install / Update Game Module' }));
    consent = await screen.findByRole('dialog', { name: 'Replace existing game module?' });
    await user.click(within(consent).getByRole('button', { name: 'Replace' }));
    expect(game.host.install).toHaveBeenCalledWith(true);
    expect(await within(dialog).findByText('Installed the game module.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Replace existing game module?' })).toBeNull();
  });

  it('installs without consent and removes a planner install after confirmation', async () => {
    const absent = gameModuleStatus({
      inspection: {
        module: { state: 'absent', version: null, source: null, matchesBundled: false },
        install: { action: 'install' },
        removable: false,
      },
    });
    const game = createFakeGameModuleHost(absent);
    game.host.install.mockResolvedValue({ outcome: 'installed', status: gameModuleStatus() });
    const { dialog, user } = await openSettings(game.host);
    expect(within(dialog).queryByRole('button', { name: 'Install from this checkout' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Install / Update Game Module' }));
    expect(game.host.install).toHaveBeenCalledWith(false);
    expect(await within(dialog).findByText('Installed 0.1.0 · this planner 0.1.0')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Remove Game Module' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remove game module?' });
    expect(within(confirm).getByText(/Plan slots and ModpackLib are kept/)).toBeTruthy();
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    expect(game.host.remove).toHaveBeenCalledTimes(1);
    expect(
      await within(dialog).findByText(
        'Removed the game module. Plan slots and ModpackLib were kept.',
      ),
    ).toBeTruthy();
  });

  it('offers the checkout install only in development builds', async () => {
    const game = createFakeGameModuleHost(gameModuleStatus({ developmentInstallAvailable: true }));
    const { dialog, user } = await openSettings(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Install from this checkout' }));
    expect(game.host.installFromCheckout).toHaveBeenCalledWith(false);
    expect(game.host.install).not.toHaveBeenCalled();
  });

  it('explains that game module management needs the desktop application', async () => {
    const { user } = renderPlannerForInteraction({ startWithProject: false });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByText(/available in the desktop application/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });
});
