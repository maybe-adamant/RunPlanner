// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { GameModuleStatus } from '@planner/persistence/gameModuleHost';
import {
  createFakeGameModuleHost,
  gameModuleStatus,
  planSlot,
  planSlots,
} from '@planner-test/fixtures/gameModuleHost';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { catalog } from '@run-planner/hades2-catalog';
import { createFakeProfileFiles } from '@planner-test/fixtures/profileFiles';
import { profileSaveSucceeded } from '@planner/state/profileSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';

const unset = (): GameModuleStatus =>
  gameModuleStatus({
    target: null,
    inspection: null,
    publicationBlockers: [{ code: 'noTarget', found: null, required: null }],
  });

const manualTarget = (): GameModuleStatus =>
  gameModuleStatus({
    target: {
      path: '/games/Hades II/Ship',
      location: '/games/Hades II/Ship',
      label: 'Ship',
      kind: 'manual',
    },
    inspection: {
      module: { state: 'absent', version: null, source: null, matchesBundled: false },
      r2modman: { state: 'notApplicable' },
      install: { action: 'install' },
      removable: false,
    },
    publicationBlockers: [{ code: 'moduleMissing', found: null, required: '0.1.0' }],
  });

async function openGame(
  host: ReturnType<typeof createFakeGameModuleHost>['host'],
  prepare?: (application: ReturnType<typeof createApplication>) => void | Promise<void>,
  options: Omit<Parameters<typeof createApplication>[0] & object, 'gameModuleHost'> = {},
) {
  const application = createApplication({ ...options, gameModuleHost: host });
  await prepare?.(application);
  const rendered = renderPlannerForInteraction({ application, startWithProject: false });
  await rendered.user.click(await screen.findByRole('button', { name: /^Game — / }));
  const dialog = await screen.findByRole('dialog', { name: 'Game' });
  await within(dialog).findByRole('heading', { name: 'Game location' });
  return { ...rendered, dialog };
}

function firstBiome() {
  const project = createCompleteFGProject();
  return { ...project, route: { ...project.route, biomes: project.route.biomes.slice(0, 1) } };
}

describe('Game panel', () => {
  afterEach(cleanup);

  it('finds r2modman profiles in a filterable picker whose selection sets the target', async () => {
    const game = createFakeGameModuleHost(unset());
    game.host.discoverTargets.mockResolvedValue({
      supported: true,
      profiles: [
        { path: '/profiles/h2-dev', location: '/profiles/h2-dev', label: 'h2-dev', module: 'none' },
        {
          path: '/profiles/h2-clean',
          location: '/profiles/h2-clean',
          label: 'h2-clean',
          module: 'thunderstore',
        },
      ],
    });
    game.host.useDiscoveredTarget.mockResolvedValue(gameModuleStatus());
    const { dialog, user } = await openGame(game.host);
    expect(within(dialog).getByText('Choose where Hades II mods are installed.')).toBeTruthy();
    expect(within(dialog).queryByRole('heading', { name: 'Game module' })).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Find r2modman profiles' }));
    const search = await screen.findByRole('combobox', { name: 'r2modman profile choices' });
    await user.type(search, 'clean');
    expect(screen.queryByRole('option', { name: /h2-dev/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'h2-clean, Run Planner (Thunderstore)' }));
    expect(game.host.useDiscoveredTarget).toHaveBeenCalledWith('/profiles/h2-clean');
    expect(await within(dialog).findByText('h2-dev (r2modman profile)')).toBeTruthy();
    expect(
      within(dialog).getByText('Ready · module 0.1.0 · ModpackLib 4.1.0 · dependencies found'),
    ).toBeTruthy();
  });

  it('chooses a folder and shows only the next planner step as a button', async () => {
    const game = createFakeGameModuleHost(unset());
    game.host.pickTargetFolder.mockResolvedValue('/games/Hades II/Ship');
    game.host.useChosenTarget.mockResolvedValue(manualTarget());
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
    expect(game.host.useChosenTarget).toHaveBeenCalledWith('/games/Hades II/Ship');
    expect(await within(dialog).findByText('Ship (folder)')).toBeTruthy();
    const steps = within(dialog).getByRole('list', { name: 'Game module steps' });
    expect(
      within(steps)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Install']);
    expect(within(dialog).queryByRole('button', { name: 'Remove game module' })).toBeNull();
    expect(within(dialog).queryByText('Game target set.')).toBeNull();
    await user.click(within(steps).getByRole('button', { name: 'Install' }));
    expect(game.host.install).toHaveBeenCalledWith(false);
    expect(await within(dialog).findByText('Installed the game module.')).toBeTruthy();
  });

  it('collapses a set location, keeps details closed, and forgets without touching files', async () => {
    const game = createFakeGameModuleHost();
    const { dialog, user } = await openGame(game.host);
    const line = within(dialog).getByText('h2-dev (r2modman profile)');
    expect(line.getAttribute('title')).toBe('/profiles/h2-dev');
    const details = dialog.querySelector('details');
    expect(details?.open).toBe(false);
    const remove = within(dialog).getByRole('button', { name: 'Remove game module' });
    expect(remove.textContent).toBe('Remove');
    expect(remove.parentElement?.textContent).toMatch(/^Ready · module 0\.1\.0 .*Remove$/);
    await user.click(remove);
    const confirmRemove = await screen.findByRole('dialog', { name: 'Remove game module?' });
    await user.click(within(confirmRemove).getByRole('button', { name: 'Cancel' }));
    expect(game.host.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    expect(within(dialog).getByRole('button', { name: 'Find r2modman profiles' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(within(dialog).getByRole('button', { name: 'Forget game location' }));
    expect(game.host.forgetTarget).toHaveBeenCalledTimes(1);
    expect(
      await within(dialog).findByText('Choose where Hades II mods are installed.'),
    ).toBeTruthy();
    expect(within(dialog).queryByRole('heading', { name: 'Game module' })).toBeNull();
    expect(game.host.remove).not.toHaveBeenCalled();
  });

  it('asks before switching away from a planner install and honours each choice', async () => {
    const game = createFakeGameModuleHost();
    game.host.pickTargetFolder.mockResolvedValue('/games/Hades II/Ship');
    game.host.useChosenTarget.mockResolvedValue(manualTarget());
    const { dialog, user } = await openGame(game.host);
    const chooseNewFolder = async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
      await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
      return screen.findByRole('dialog', { name: 'Switch game location?' });
    };

    let ask = await chooseNewFolder();
    expect(
      within(ask).getByText(/no longer tracked and won’t receive planner updates/),
    ).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(game.host.useChosenTarget).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    game.host.remove.mockResolvedValueOnce({
      outcome: 'managedByR2modman',
      status: gameModuleStatus(),
    });
    ask = await chooseNewFolder();
    await user.click(within(ask).getByRole('button', { name: 'Remove it, then switch' }));
    expect(
      await within(dialog).findByText('r2modman manages this module. Remove it in r2modman.'),
    ).toBeTruthy();
    expect(game.host.useChosenTarget).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Switch game location?' })).toBeNull();
    expect(within(dialog).getByText('h2-dev (r2modman profile)')).toBeTruthy();

    game.host.remove.mockResolvedValueOnce({ outcome: 'removed', status: gameModuleStatus() });
    ask = await chooseNewFolder();
    await user.click(within(ask).getByRole('button', { name: 'Remove it, then switch' }));
    expect(await within(dialog).findByText('Ship (folder)')).toBeTruthy();
    expect(game.host.remove).toHaveBeenCalledTimes(2);
    expect(game.host.useChosenTarget).toHaveBeenCalledTimes(1);
  });

  it('reports an invalid candidate before asking or removing anything', async () => {
    const game = createFakeGameModuleHost();
    game.host.pickTargetFolder.mockResolvedValue('/games/Nowhere');
    game.host.validateTarget.mockRejectedValue(
      new Error(
        'No ReturnOfModding folder found. Choose a named profile or the folder that contains ReturnOfModding.',
      ),
    );
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(
      /^No ReturnOfModding folder found/,
    );
    expect(game.host.validateTarget).toHaveBeenCalledWith('/games/Nowhere', 'manual');
    expect(screen.queryByRole('dialog', { name: 'Switch game location?' })).toBeNull();
    expect(game.host.remove).not.toHaveBeenCalled();
    expect(game.host.useChosenTarget).not.toHaveBeenCalled();
  });

  it('keeps the old copy when asked and switches silently without a planner install', async () => {
    const game = createFakeGameModuleHost();
    game.host.pickTargetFolder.mockResolvedValue('/games/Hades II/Ship');
    game.host.useChosenTarget.mockResolvedValue(manualTarget());
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
    const ask = await screen.findByRole('dialog', { name: 'Switch game location?' });
    await user.click(within(ask).getByRole('button', { name: 'Keep it and switch' }));
    expect(await within(dialog).findByText('Ship (folder)')).toBeTruthy();
    expect(game.host.remove).not.toHaveBeenCalled();

    game.host.pickTargetFolder.mockResolvedValue('/games/Other');
    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
    expect(game.host.useChosenTarget).toHaveBeenLastCalledWith('/games/Other');
    expect(screen.queryByRole('dialog', { name: 'Switch game location?' })).toBeNull();
  });

  it('asks before overwriting when the host requires consent', async () => {
    const game = createFakeGameModuleHost(
      gameModuleStatus({
        inspection: {
          module: { state: 'unrecognized', version: '0.10.0', source: null, matchesBundled: false },
          r2modman: { state: 'managed', moduleEnabled: true },
          install: { action: 'update', consentRequired: true },
          removable: false,
        },
        publicationBlockers: [{ code: 'moduleMismatch', found: '0.10.0', required: '0.1.0' }],
      }),
    );
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Update' }));
    const consent = await screen.findByRole('dialog', { name: 'Replace existing game module?' });
    expect(within(consent).getByText(/Remove the Run Planner package in r2modman/)).toBeTruthy();
    await user.click(within(consent).getByRole('button', { name: 'Replace' }));
    expect(game.host.install).toHaveBeenCalledWith(true);
  });

  it('offers the checkout install only in development builds, inside details', async () => {
    const game = createFakeGameModuleHost(gameModuleStatus({ developmentInstallAvailable: true }));
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByText('Details'));
    await user.click(within(dialog).getByRole('button', { name: 'Install from this checkout' }));
    expect(game.host.installFromCheckout).toHaveBeenCalledWith(false);
  });

  it('asks before switching away to a discovered profile', async () => {
    const game = createFakeGameModuleHost();
    game.host.discoverTargets.mockResolvedValue({
      supported: true,
      profiles: [
        {
          path: '/profiles/h2-dev',
          location: '/profiles/h2-dev',
          label: 'h2-dev',
          module: 'plannerInstalled',
        },
        { path: '/profiles/other', location: '/profiles/other', label: 'other', module: 'none' },
      ],
    });
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    expect(document.activeElement?.textContent).toBe('Find r2modman profiles');
    await user.click(within(dialog).getByRole('button', { name: 'Find r2modman profiles' }));
    await user.click(await screen.findByRole('option', { name: 'other' }));
    expect(game.host.validateTarget).toHaveBeenCalledWith('/profiles/other', 'discovered');
    const ask = await screen.findByRole('dialog', { name: 'Switch game location?' });
    expect(ask.getAttribute('aria-describedby')).toBe('game-location-switch-message');
    await user.click(within(ask).getByRole('button', { name: 'Keep it and switch' }));
    expect(game.host.useDiscoveredTarget).toHaveBeenCalledWith('/profiles/other');
    expect(game.host.remove).not.toHaveBeenCalled();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Change game location');
  });

  it('offers only Keep and Cancel when r2modman’s mod list could not be read', async () => {
    const game = createFakeGameModuleHost(
      gameModuleStatus({ inspection: { r2modman: { state: 'unreadable' }, removable: false } }),
    );
    game.host.pickTargetFolder.mockResolvedValue('/games/Hades II/Ship');
    game.host.useChosenTarget.mockResolvedValue(manualTarget());
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
    const ask = await screen.findByRole('dialog', { name: 'Switch game location?' });
    expect(within(ask).queryByRole('button', { name: 'Remove it, then switch' })).toBeNull();
    expect(
      within(ask).getByText('r2modman’s mod list couldn’t be read, so the module was not removed.'),
    ).toBeTruthy();
    expect(within(ask).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Keep it and switch' }));
    expect(await within(dialog).findByText('Ship (folder)')).toBeTruthy();
    expect(game.host.remove).not.toHaveBeenCalled();
  });

  it('reports a failed switch after a successful removal and keeps the old location', async () => {
    const game = createFakeGameModuleHost();
    game.host.pickTargetFolder.mockResolvedValue('/games/Hades II/Ship');
    const removed = gameModuleStatus({
      inspection: {
        module: { state: 'absent', version: null, source: null, matchesBundled: false },
        install: { action: 'install' },
        removable: false,
      },
      publicationBlockers: [{ code: 'moduleMissing', found: null, required: '0.1.0' }],
    });
    game.host.remove.mockResolvedValueOnce({ outcome: 'removed', status: removed });
    game.host.useChosenTarget.mockRejectedValueOnce(new Error('That folder is unavailable.'));
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
    const ask = await screen.findByRole('dialog', { name: 'Switch game location?' });
    await user.click(within(ask).getByRole('button', { name: 'Remove it, then switch' }));
    expect(
      await within(dialog).findByText(
        'The game module was removed, but the new location could not be set, so the game location did not change: That folder is unavailable.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Switch game location?' })).toBeNull();
    expect(within(dialog).getByText('h2-dev (r2modman profile)')).toBeTruthy();
  });

  it('treats reselecting the current location as no change', async () => {
    const game = createFakeGameModuleHost();
    game.host.pickTargetFolder.mockResolvedValue('/profiles/h2-dev/ReturnOfModding');
    game.host.validateTarget.mockResolvedValue({
      path: '/profiles/h2-dev',
      location: '/profiles/h2-dev',
      label: 'h2-dev',
      kind: 'manual',
    });
    const { dialog, user } = await openGame(game.host);
    await user.click(within(dialog).getByRole('button', { name: 'Change game location' }));
    await user.click(within(dialog).getByRole('button', { name: 'Choose folder…' }));
    expect(await within(dialog).findByText('h2-dev (r2modman profile)')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Switch game location?' })).toBeNull();
    expect(game.host.remove).not.toHaveBeenCalled();
    expect(game.host.useChosenTarget).not.toHaveBeenCalled();
    expect(game.host.useDiscoveredTarget).not.toHaveBeenCalled();
  });

  it('opens ModpackLib’s store page from its step through the host', async () => {
    const game = createFakeGameModuleHost(
      gameModuleStatus({
        inspection: { modpackLib: { state: 'older', found: '4.0.1' } },
        publicationBlockers: [{ code: 'modpackLibOlder', found: '4.0.1', required: '4.1.0' }],
      }),
    );
    const { dialog, user } = await openGame(game.host);
    await user.click(
      within(dialog).getByRole('link', {
        name: 'Open ModpackLib’s Thunderstore page in your browser',
      }),
    );
    expect(game.host.openExternalPage).toHaveBeenCalledWith(
      'https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/',
    );
  });

  it('labels the Game button with the indicator state in its accessible name', async () => {
    const needsSetup = createFakeGameModuleHost(manualTarget());
    renderPlannerForInteraction({
      application: createApplication({ gameModuleHost: needsSetup.host }),
      startWithProject: false,
    });
    const button = await screen.findByRole('button', { name: 'Game — needs setup' });
    expect(button.textContent).toBe('Game!');
    cleanup();
    const noLocation = createFakeGameModuleHost(unset());
    renderPlannerForInteraction({
      application: createApplication({ gameModuleHost: noLocation.host }),
      startWithProject: false,
    });
    expect(await screen.findByRole('button', { name: 'Game — no location' })).toBeTruthy();
  });

  it('shows plans only when the module is ready, with the reason when nothing can be sent', async () => {
    const notReady = createFakeGameModuleHost(manualTarget());
    const first = await openGame(notReady.host);
    expect(within(first.dialog).queryByRole('heading', { name: 'Plans in game' })).toBeNull();
    cleanup();

    const game = createFakeGameModuleHost();
    const { dialog } = await openGame(game.host, (application) =>
      application.projectOperations.createNew('Underworld').then(() => undefined),
    );
    expect(within(dialog).getByRole('heading', { name: 'Plans in game' })).toBeTruthy();
    const callout = within(dialog).getByRole('group', { name: 'Can’t send' });
    expect(
      within(callout).getByText('Resolve this plan’s findings before sending it.'),
    ).toBeTruthy();
    expect(within(callout).getByRole('button', { name: 'Show findings' })).toBeTruthy();
    const table = within(dialog).getByRole('table', { name: 'Plans in game' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Slot', 'Plan', 'Route', 'Ends', 'Aspect', 'Sent', 'Action']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5', 'Slot 6']);
    expect(within(table).queryAllByRole('button')).toEqual([]);
  });

  it('sends a clean saved plan under its file name and confirms before replacing', async () => {
    const fourHoursAgo = Date.now() - 4 * 3_600_000;
    const game = createFakeGameModuleHost(
      gameModuleStatus({
        inspection: {
          planSlots: planSlots(
            planSlot(1, {
              state: 'present',
              modifiedAtMs: Date.now(),
              routeKey: 'Underworld',
              biomeKeys: ['F'],
              planFingerprint: 'another',
              projectId: 'another',
              displayName: 'Their run',
              weaponKey: 'WeaponStaffSwing',
              aspectKey: 'BaseStaffAspect',
            }),
            planSlot(3, {
              state: 'present',
              modifiedAtMs: fourHoursAgo,
              routeKey: 'Underworld',
              biomeKeys: ['F'],
              planFingerprint: 'another',
              projectId: 'another',
              weaponKey: 'WeaponDagger',
              aspectKey: 'DaggerBackstabAspect',
            }),
          ),
        },
      }),
    );
    const files = createFakeProfileFiles();
    const { dialog, user } = await openGame(
      game.host,
      (application) => files.openSaved(application, firstBiome(), 'Erebus opener.runplanner.json'),
      { profileFile: files.adapter },
    );
    const table = within(dialog).getByRole('table', { name: 'Plans in game' });
    const row = within(table).getByRole('row', { name: /Slot 1/ });
    expect(within(row).getByText('Their run')).toBeTruthy();
    expect(within(row).getByText(catalog.biomes.byKey.F!.label)).toBeTruthy();
    expect(within(row).getByText('Aspect of Melinoë (Staff)')).toBeTruthy();
    expect(within(row).getByText('just now')).toBeTruthy();
    const unnamed = within(table).getByRole('row', { name: /Slot 3/ });
    expect(within(unnamed).getByText('Unnamed')).toBeTruthy();
    expect(within(unnamed).getByText('Aspect of Melinoë (Blades)')).toBeTruthy();
    const sent = within(unnamed).getByText('4h ago');
    const exact = new Date(fourHoursAgo).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    expect(sent.getAttribute('title')).toBe(exact);
    const description = document.getElementById(sent.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toBe(exact);
    await user.click(within(table).getByRole('button', { name: 'Send here (slot 2)' }));
    expect(game.published.map((publication) => publication.slotNumber)).toEqual([2]);
    expect(JSON.parse(game.published[0]!.json)).toMatchObject({ displayName: 'Erebus opener' });
    expect(files.writes).toHaveLength(0);
    expect(await within(dialog).findByText('Published to game, Slot 2.')).toBeTruthy();

    await user.click(within(table).getByRole('button', { name: 'Replace (slot 1)' }));
    const confirm = await screen.findByRole('dialog', { name: 'Replace the plan in slot 1?' });
    expect(confirm.getAttribute('aria-describedby')).toBe('game-plan-replace-message');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(game.published).toHaveLength(1);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Replace (slot 1)');
    await user.click(within(table).getByRole('button', { name: 'Replace (slot 1)' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Replace the plan in slot 1?' })).getByRole(
        'button',
        { name: 'Replace' },
      ),
    );
    expect(game.published.map((publication) => publication.slotNumber)).toEqual([2, 1]);
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Replace (slot 1)'),
    );
  });

  it('saves unsaved changes in place before sending', async () => {
    const game = createFakeGameModuleHost();
    const files = createFakeProfileFiles();
    const { dialog, user } = await openGame(
      game.host,
      async (application) => {
        await files.openSaved(application, firstBiome(), 'Erebus opener.runplanner.json');
        // A different saved baseline makes the open document dirty without an authored edit.
        application.store.dispatch(
          profileSaveSucceeded({ baselineJson: '{}', fileName: 'Erebus opener.runplanner.json' }),
        );
      },
      { profileFile: files.adapter },
    );
    await user.click(await within(dialog).findByRole('button', { name: 'Save and send (slot 3)' }));
    expect(files.writes.map((write) => write.fileName)).toEqual(['Erebus opener.runplanner.json']);
    expect(game.published.map((publication) => publication.slotNumber)).toEqual([3]);
    expect(JSON.parse(game.published[0]!.json)).toMatchObject({ displayName: 'Erebus opener' });
    expect(await within(dialog).findByRole('button', { name: 'Send here (slot 4)' })).toBeTruthy();
  });

  it('asks where to save a never-saved plan and sends nothing when cancelled', async () => {
    const game = createFakeGameModuleHost();
    const files = createFakeProfileFiles();
    const { dialog, user } = await openGame(
      game.host,
      (application) => {
        application.store.dispatch(authoredProjectReplaced(firstBiome()));
      },
      { profileFile: files.adapter },
    );
    files.chooseSaveAs(null);
    await user.click(
      await within(dialog).findByRole('button', { name: 'Save and send… (slot 1)' }),
    );
    expect(
      await within(dialog).findByText('Send to game cancelled; nothing was sent.'),
    ).toBeTruthy();
    expect(game.published).toHaveLength(0);
    expect(files.writes).toHaveLength(0);

    files.chooseSaveAs('Surface Phial run.runplanner.json');
    await user.click(within(dialog).getByRole('button', { name: 'Save and send… (slot 1)' }));
    expect(files.writes.map((write) => write.fileName)).toEqual([
      'Surface Phial run.runplanner.json',
    ]);
    expect(JSON.parse(game.published[0]!.json)).toMatchObject({
      displayName: 'Surface Phial run',
      // The first save of a never-saved project keeps its identity.
      projectId: firstBiome().projectId,
    });
  });

  it('explains that game management needs the desktop application', async () => {
    const { user } = renderPlannerForInteraction({ startWithProject: false });
    await user.click(screen.getByRole('button', { name: 'Game' }));
    const dialog = await screen.findByRole('dialog', { name: 'Game' });
    expect(within(dialog).getByText(/available in the desktop application/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });
});
