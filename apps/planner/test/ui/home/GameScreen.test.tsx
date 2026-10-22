// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { GameModuleStatus, GamePlanSlotNumber } from '@planner/persistence/gameModuleHost';
import {
  createFakeGameModuleHost,
  eventSlot,
  gameModuleStatus,
  planSlot,
  planSlots,
} from '@planner-test/fixtures/gameModuleHost';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import {
  activeEvent,
  createFakeCommunityEventDevelopmentHost,
  createFakeCommunityEventHost,
} from '@planner-test/fixtures/communityEventHost';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { catalog } from '@run-planner/hades2-catalog';
import { encodeSlotSource } from '@planner/persistence/slotSource';
import {
  createProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

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
  const home = screen.getByRole('navigation', { name: 'Home' });
  await rendered.user.click(within(home).getByRole('button', { name: /^Game/ }));
  const dialog = await screen.findByRole('region', { name: 'Game module' });
  await within(dialog).findByRole('heading', { name: 'Game location' });
  return { ...rendered, dialog };
}

// Every row's shape: its cells, the plan cell's one line and the two action places.
function rowShapes(table: HTMLElement) {
  return [...table.querySelectorAll('tbody tr')].map((row) => [
    row.children.length,
    row.querySelector('.home-slot-plan')?.children.length,
    row.querySelector('.home-slot-actions')?.children.length,
    [...row.children].map((cell) => (cell as HTMLTableCellElement).colSpan),
  ]);
}

function firstBiome() {
  const project = createCompleteFGProject();
  return { ...project, route: { ...project.route, biomes: project.route.biomes.slice(0, 1) } };
}

// The plan names itself; the file it is saved to does not.
function named(name: string) {
  return { ...firstBiome(), name };
}

describe('Game screen', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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
    expect(within(dialog).queryByRole('heading', { name: 'Status' })).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Find r2modman profiles' }));
    const search = await screen.findByRole('combobox', { name: 'r2modman profile choices' });
    await user.type(search, 'clean');
    expect(screen.queryByRole('option', { name: /h2-dev/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'h2-clean, Run Planner (Thunderstore)' }));
    expect(game.host.useDiscoveredTarget).toHaveBeenCalledWith('/profiles/h2-clean');
    expect(await within(dialog).findByText('h2-dev · r2modman profile')).toBeTruthy();
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
    expect(await within(dialog).findByText('Ship · folder')).toBeTruthy();
    // The module's own install is the card's one primary action.
    const install = within(dialog).getByRole('button', { name: 'Install' });
    expect(install.className).toContain('primary-action');
    expect(within(dialog).queryByRole('button', { name: 'Remove game module' })).toBeNull();
    expect(within(dialog).queryByText('Game target set.')).toBeNull();
    await user.click(install);
    expect(game.host.install).toHaveBeenCalledWith(false);
    expect(await within(dialog).findByText('Installed the game module.')).toBeTruthy();
  });

  it('shows a set location with its path and the module facts, and forgets without touching files', async () => {
    const game = createFakeGameModuleHost();
    const { dialog, user } = await openGame(game.host);
    expect(within(dialog).getByText('h2-dev · r2modman profile')).toBeTruthy();
    expect(within(dialog).getByText('/profiles/h2-dev')).toBeTruthy();
    expect(dialog.querySelector('details')).toBeNull();
    expect(
      within(dialog).getByText('Ready · module 0.1.0 · ModpackLib 4.1.0 · dependencies found'),
    ).toBeTruthy();
    const remove = within(dialog).getByRole('button', { name: 'Remove game module' });
    expect(remove.textContent).toBe('Remove module');
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
    expect(within(dialog).queryByRole('heading', { name: 'Status' })).toBeNull();
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
    expect(within(dialog).getByText('h2-dev · r2modman profile')).toBeTruthy();

    game.host.remove.mockResolvedValueOnce({ outcome: 'removed', status: gameModuleStatus() });
    ask = await chooseNewFolder();
    await user.click(within(ask).getByRole('button', { name: 'Remove it, then switch' }));
    expect(await within(dialog).findByText('Ship · folder')).toBeTruthy();
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
    expect(await within(dialog).findByText('Ship · folder')).toBeTruthy();
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

  it('offers the checkout install only in development builds', async () => {
    const game = createFakeGameModuleHost(gameModuleStatus({ developmentInstallAvailable: true }));
    const { dialog, user } = await openGame(game.host);
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
    expect(await within(dialog).findByText('Ship · folder')).toBeTruthy();
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
    expect(within(dialog).getByText('h2-dev · r2modman profile')).toBeTruthy();
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
    expect(await within(dialog).findByText('h2-dev · r2modman profile')).toBeTruthy();
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

  it('says in the Game tab when the module has an update or an event is on', async () => {
    const game = createFakeGameModuleHost(
      gameModuleStatus({
        publicationBlockers: [{ code: 'moduleMismatch', found: '0.0.9', required: '0.1.0' }],
        inspection: {
          module: { matchesBundled: false, version: '0.0.9' },
          install: { action: 'update', updateAvailable: true },
        },
      }),
    );
    const events = createFakeCommunityEventHost();
    events.refreshFeed.mockResolvedValue({
      active: activeEvent(encodeProjectDocument(firstBiome())),
      source: 'network',
      problem: null,
    });
    const { dialog } = await openGame(game.host, undefined, { communityEventHost: events });
    const tab = within(screen.getByRole('navigation', { name: 'Home' })).getByRole('button', {
      name: /^Game/,
    });
    await waitFor(() => expect(tab.textContent).toBe('Game · update · event'));
    expect(tab.getAttribute('aria-current')).toBe('page');
    const card = within(dialog).getByRole('complementary', { name: 'Community event' });
    expect(within(card).getByText('Event: Week 42: Staff sprint')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Update' }).className).toContain(
      'primary-action',
    );
  });

  it('lists every slot with its library plan, plays a slot next and opens a linked plan', async () => {
    const library = createMemoryProjectLibrary();
    const plan = named('Erebus opener');
    const slots = (active: GamePlanSlotNumber) =>
      gameModuleStatus({
        inspection: {
          planSlots: planSlots(
            planSlot(1, {
              state: 'present',
              routeKey: 'Underworld',
              biomeKeys: ['F'],
              planFingerprint: 'sent-before',
              projectId: plan.projectId,
              displayName: 'Old name',
              weaponKey: 'WeaponStaffSwing',
              aspectKey: 'BaseStaffAspect',
            }),
            planSlot(2, {
              state: 'present',
              routeKey: 'Surface',
              projectId: 'theirs',
              displayName: 'Their run',
            }),
            planSlot(3, { state: 'stale', routeKey: 'Underworld', projectId: plan.projectId }),
          ),
          activeSlot: { state: 'present', slot: active },
        },
      });
    const game = createFakeGameModuleHost(slots(1));
    const { dialog, user, application } = await openGame(
      game.host,
      async () => {
        await library.file(plan, 'Practice');
      },
      { projectLibrary: library.adapter },
    );
    const table = within(dialog).getByRole('table', { name: 'Slots in game' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Slot', 'Library plan', 'Route', 'Aspect', 'Sent', 'Next run', 'Actions']);
    const row = (label: string) =>
      within(table).getByRole('rowheader', { name: label }).closest('tr')!;
    // A linked slot shows the plan's library name, and why it is older, on one line.
    expect(within(row('Slot 1')).getByText('Erebus opener')).toBeTruthy();
    expect(await within(row('Slot 1')).findByText('· older, edited since sent')).toBeTruthy();
    const next = (label: string) =>
      within(row(label)).getByRole<HTMLInputElement>('radio', { name: `Play ${label} next` });
    expect(next('Slot 1').checked).toBe(true);
    expect(within(row('Slot 1')).getByText('Staff · Melinoë')).toBeTruthy();
    expect(within(row('Slot 2')).getByText('Their run')).toBeTruthy();
    expect(within(row('Slot 2')).getByText('· not in library')).toBeTruthy();
    expect(within(row('Slot 2')).queryByRole('button', { name: /^Open/ })).toBeNull();
    expect(within(row('Slot 3')).getByText('· older, send again')).toBeTruthy();
    expect(next('Slot 3').disabled).toBe(true);
    expect(within(row('Slot 4')).queryByRole('radio')).toBeNull();
    expect(within(row('Slot 4')).getByText('Empty')).toBeTruthy();
    // Home never sends.
    expect(within(table).queryByRole('button', { name: /Send|Replace/ })).toBeNull();
    // Present, outdated, unlinked, empty and active rows all keep one shape.
    const shape = rowShapes(table);
    expect(new Set(shape.map((row) => JSON.stringify(row)))).toEqual(
      new Set([JSON.stringify([7, 1, 2, [1, 1, 1, 1, 1, 1, 1]])]),
    );

    game.host.status.mockResolvedValue(slots(2));
    await user.click(next('Slot 2'));
    expect(game.host.setActiveSlot).toHaveBeenCalledWith(2);
    await waitFor(() => expect(next('Slot 2').checked).toBe(true));
    expect(rowShapes(table)).toEqual(shape);

    game.host.setActiveSlot.mockResolvedValueOnce({
      status: 'nativeWrite',
      message: 'could not replace active slot file.',
      blockers: [],
    });
    await user.click(next('Slot 1'));
    expect(
      await within(dialog).findByText('Not made active: could not replace active slot file.'),
    ).toBeTruthy();

    // An unlinked plan's name is plain text; a linked one's opens its library plan.
    expect(within(row('Slot 2')).queryByRole('button', { name: 'Their run' })).toBeNull();
    expect(within(row('Slot 1')).getByRole('button', { name: 'Open Erebus opener' })).toBeTruthy();
    within(row('Slot 1')).getByRole('button', { name: 'Erebus opener' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(application.store.getState().librarySession.view).toEqual({ kind: 'editor' }),
    );
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Plan name' }).value).toBe(
      'Erebus opener',
    );
  });

  it('clears a filled plan slot, never the event slot, and undoes it from the notice', async () => {
    const filled = (active: GamePlanSlotNumber) =>
      gameModuleStatus({
        inspection: {
          planSlots: planSlots(
            planSlot(1, { state: 'present', routeKey: 'Underworld', projectId: 'a' }),
            planSlot(3, { state: 'present', routeKey: 'Surface', projectId: 'b' }),
          ),
          eventSlot: eventSlot({ state: 'present', routeKey: 'Underworld' }),
          activeSlot: { state: 'present', slot: active },
        },
      });
    const game = createFakeGameModuleHost(filled(3));
    const { dialog, user } = await openGame(game.host, undefined, { devBuild: false });
    const table = within(dialog).getByRole('table', { name: 'Slots in game' });
    const row = (label: string) =>
      within(table).getByRole('rowheader', { name: label }).closest('tr')!;
    expect(within(row('Event')).queryByRole('button', { name: /^Clear/ })).toBeNull();
    expect(within(row('Slot 2')).queryByRole('button', { name: /^Clear/ })).toBeNull();

    const cleared = {
      slot: 3,
      plan: '{"format":"run-planner-execution"}',
      source: null,
      summary: null,
      wasActive: true,
    } as const;
    game.host.clearSlot.mockResolvedValueOnce({
      status: 'cleared',
      message: 'Cleared slot 3.',
      blockers: [],
      cleared,
      activeSlotMoved: true,
      activationProblem: null,
    });
    await user.click(within(row('Slot 3')).getByRole('button', { name: 'Clear Slot 3' }));
    expect(game.host.clearSlot).toHaveBeenCalledWith(3);
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Cleared slot 3 · Slot 1 plays next' + 'Undo');
    await user.click(within(notice).getByRole('button', { name: 'Undo' }));
    expect(game.host.restoreSlot).toHaveBeenCalledWith(cleared);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());

    game.host.clearSlot.mockResolvedValueOnce({
      status: 'nativeWrite',
      message: 'could not remove slot-1.runplanner.json',
      blockers: [],
      cleared: null,
      activeSlotMoved: false,
      activationProblem: null,
    });
    await user.click(within(row('Slot 1')).getByRole('button', { name: 'Clear Slot 1' }));
    expect(
      await within(dialog).findByText('Not cleared: could not remove slot-1.runplanner.json'),
    ).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the event slot with its title and offers it for the next run', async () => {
    const withEvent = (active: 0 | 3) =>
      gameModuleStatus({
        inspection: {
          eventSlot: eventSlot({
            state: 'present',
            routeKey: 'Underworld',
            biomeKeys: ['F'],
            event: {
              id: '2026-w42-staff',
              title: 'Week 42: Staff sprint',
              endsAt: '2026-10-19T00:00:00Z',
            },
          }),
          activeSlot: { state: 'present', slot: active },
        },
      });
    const game = createFakeGameModuleHost(withEvent(3));
    const { dialog, user } = await openGame(game.host, undefined, { devBuild: false });
    const table = within(dialog).getByRole('table', { name: 'Slots in game' });
    const row = (await within(table).findByRole('rowheader', { name: 'Event' })).closest('tr')!;
    expect(within(row).getByText('Week 42: Staff sprint')).toBeTruthy();
    expect(within(row).getByText('· community event')).toBeTruthy();
    const eventNext = () =>
      within(row).getByRole<HTMLInputElement>('radio', { name: 'Play Event next' });
    expect(within(dialog).queryByRole('button', { name: 'Import event folder…' })).toBeNull();
    game.host.status.mockResolvedValue(withEvent(0));
    await user.click(eventNext());
    expect(game.host.setActiveSlot).toHaveBeenCalledWith(0);
    await waitFor(() => expect(eventNext().checked).toBe(true));
  });

  it('syncs the event slot on opening and runs the development event actions', async () => {
    const game = createFakeGameModuleHost();
    const events = createFakeCommunityEventHost();
    const development = createFakeCommunityEventDevelopmentHost();
    const { dialog, user } = await openGame(game.host, undefined, {
      communityEventDevelopmentHost: development,
      communityEventHost: events,
      devBuild: true,
    });
    await vi.waitFor(() =>
      expect(events.refreshFeed).toHaveBeenCalledWith(true, expect.anything()),
    );
    const importButton = await within(dialog).findByRole('button', {
      name: 'Import event folder…',
    });
    expect(within(dialog).queryByRole('rowheader', { name: 'Event' })).toBeNull();

    await user.click(importButton);
    expect(development.pickEventFolder).toHaveBeenCalledTimes(1);
    expect(events.publishEvent).not.toHaveBeenCalled();

    development.pickEventFolder.mockResolvedValueOnce('/events/local-test');
    await user.click(importButton);
    expect(await within(dialog).findByText('No event folder.')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Clear event' }));
    expect(await within(dialog).findByText('The event slot is empty.')).toBeTruthy();
    expect(development.clearLocalEvent).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole('button', { name: /Export event/ })).toBeNull();
  });

  it('offers no event actions in release builds', async () => {
    const game = createFakeGameModuleHost();
    const { dialog } = await openGame(game.host, undefined, {
      communityEventHost: createFakeCommunityEventHost(),
      devBuild: false,
    });
    await within(dialog).findByRole('heading', { name: 'Game location' });
    expect(within(dialog).queryByRole('button', { name: 'Import event folder…' })).toBeNull();
  });

  it('rebuilds outdated slots from their sources and reports each outcome', async () => {
    const stale = {
      state: 'stale',
      routeKey: 'Underworld',
      biomeKeys: ['F'],
      modifiedAtMs: 1,
    } as const;
    const game = createFakeGameModuleHost(
      gameModuleStatus({
        inspection: {
          planSlots: planSlots(
            planSlot(2, { ...stale, displayName: 'Opener', hasSource: true }),
            planSlot(3, { ...stale, displayName: 'Broken', hasSource: true }),
            planSlot(4, { ...stale, displayName: 'Old', hasSource: false }),
          ),
        },
      }),
    );
    const source = (project: ProjectDocument) =>
      encodeSlotSource({
        internalRunModifiers: false,
        projectJson: encodeProjectDocument(project),
      });
    game.sources.set(2, source(firstBiome()));
    game.sources.set(
      3,
      source(
        createProjectDocument(catalog, {
          configuredBiomeCount: 1,
          projectId: 'broken',
          routeKey: 'Underworld',
        }),
      ),
    );
    const { dialog, user } = await openGame(game.host);

    expect(within(dialog).getByText(/send again$/)).toBeTruthy();
    expect(within(dialog).getByText('2 slots need a rebuild for module 0.1.0.')).toBeTruthy();
    await user.click(await within(dialog).findByRole('button', { name: 'Rebuild outdated slots' }));

    expect(
      await within(dialog).findByText('Rebuilt 1 slot · couldn’t rebuild 1 slot'),
    ).toBeTruthy();
    // The failed slot says so in a few words, and why under the table.
    expect(within(dialog).getByText(/couldn’t rebuild$/)).toBeTruthy();
    expect(
      within(dialog).getByText(
        /^Slot 3 couldn’t rebuild: .*should still build — create a bug report/,
      ),
    ).toBeTruthy();
    expect(game.rebuilt.map((entry) => entry.slotNumber)).toEqual([2]);
    expect(game.host.setActiveSlot).not.toHaveBeenCalled();
  });

  it('explains that game management needs the desktop application', async () => {
    const { user } = renderPlannerForInteraction({ startWithProject: false });
    const home = screen.getByRole('navigation', { name: 'Home' });
    await user.click(within(home).getByRole('button', { name: 'Game' }));
    const page = screen.getByRole('region', { name: 'Game module' });
    expect(within(page).getByText(/available in the desktop application/)).toBeTruthy();
  });
});
