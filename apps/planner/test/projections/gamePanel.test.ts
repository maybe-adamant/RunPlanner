import { describe, expect, it } from 'vitest';

import {
  describePublicationBlocker,
  describeRemoveOutcome,
  projectGamePanel,
  projectGameContext,
  projectGameProfileChoices,
  projectGameSendButton,
  projectLibrarySendButton,
  projectEventPlaysNext,
  projectHomeSlots,
  projectNextRunSlot,
  projectSendSlots,
  describeActiveSlotSetting,
  describeLastSendFailure,
  describeSlotRestoration,
  projectSlotClearing,
  describeSent,
  describeSentNotActivated,
} from '@planner/projections/gamePanel';
import {
  NO_SLOT_LINKS,
  type LibrarySlotLinks,
  type PlanSlotLink,
} from '@planner/projections/libraryHome';
import { catalog } from '@run-planner/hades2-catalog';
import type { GamePlanSlotNumber } from '@planner/persistence/gameModuleHost';
import {
  eventSlot,
  gameModuleStatus,
  planSlot,
  planSlots,
} from '@planner-test/fixtures/gameModuleHost';

type StatusOverrides = NonNullable<Parameters<typeof gameModuleStatus>[0]>;

const moduleOf = (overrides: StatusOverrides) => {
  const module = projectGamePanel(gameModuleStatus(overrides)).module;
  if (module === null) throw new Error('module section is hidden');
  return module;
};
const stepKeys = (overrides: StatusOverrides) => moduleOf(overrides).steps.map((step) => step.key);

describe('Game panel projection', () => {
  it('collapses a ready target to one location line and one Ready status', () => {
    const product = projectGamePanel(gameModuleStatus());
    expect(product.location).toEqual({
      state: 'set',
      name: 'h2-dev',
      kindLabel: 'r2modman profile',
      path: '/profiles/h2-dev',
      problem: null,
      confirmSwitchAway: true,
      switchAwayRemoval: { available: true, reason: null },
    });
    expect(product.module).toMatchObject({
      state: 'ready',
      tone: 'ok',
      summary: 'Ready · module 0.1.0 · ModpackLib 4.1.0 · dependencies found',
      steps: [],
      removeAvailable: true,
    });
    expect(product.module?.details.map((detail) => detail.key)).toEqual([
      'path',
      'module',
      'modpackLib',
      'dependencies',
      'r2modman',
    ]);
  });

  it('hides the module section until a target is set and inspected', () => {
    const unset = projectGamePanel(
      gameModuleStatus({
        target: null,
        inspection: null,
        publicationBlockers: [{ code: 'noTarget', found: null, required: null }],
      }),
    );
    expect(unset.location).toMatchObject({ state: 'unset', confirmSwitchAway: false });
    expect(unset.module).toBeNull();
    const unavailable = projectGamePanel(
      gameModuleStatus({ inspection: null, targetProblem: 'That folder is unavailable.' }),
    );
    expect(unavailable.location.problem).toBe('That folder is unavailable.');
    expect(unavailable.module).toBeNull();
  });

  it('shows the development build instead of the stamped version', () => {
    const module = moduleOf({ developmentInstallAvailable: true });
    expect(module.summary).toBe(
      'Ready · module development build · ModpackLib 4.1.0 · dependencies found',
    );
    expect(module.details.find((detail) => detail.key === 'module')?.value).toBe(
      'Installed development build · this planner development build',
    );
    expect(module.developmentInstallAvailable).toBe(true);
  });

  it('orders every issue once as a step with its found value, ending with the planner action', () => {
    const overrides: StatusOverrides = {
      inspection: {
        module: { state: 'unrecognized', version: '0.10.0', source: null, matchesBundled: false },
        modpackLib: { state: 'older', found: '4.0.1' },
        missingDependencies: [
          { name: 'LuaENVY-ENVY', version: '1.2.0' },
          { name: 'SGG_Modding-ModUtil', version: '4.0.1' },
        ],
        r2modman: { state: 'managed', moduleEnabled: true },
        strandedInstall: '.run-planner-replaced-01-2-3',
        coordinator: { present: true, managed: true },
        install: { action: 'update', consentRequired: true },
        removable: false,
      },
      publicationBlockers: [
        { code: 'moduleMismatch', found: '0.10.0', required: '0.1.0' },
        { code: 'modpackLibOlder', found: '4.0.1', required: '4.1.0' },
      ],
    };
    const module = moduleOf(overrides);
    expect(module.state).toBe('stranded');
    expect(module.tone).toBe('error');
    expect(module.summary).toBe('Stranded install');
    expect(module.steps.map((step) => [step.key, step.text, step.found, step.action])).toEqual([
      ['modpackLib', 'Update ModpackLib to 4.1.0+ in r2modman', '4.0.1', null],
      [
        'dependencies',
        'Install LuaENVY-ENVY, SGG_Modding-ModUtil through r2modman or ModpackLib',
        null,
        null,
      ],
      ['r2modman', 'Remove the Run Planner package in r2modman', null, null],
      [
        'stranded',
        'A failed update left the previous module at ReturnOfModding/.run-planner-replaced-01-2-3. Install again to recover; the planner backs it up first',
        null,
        null,
      ],
      ['module', 'Update the game module', '0.10.0', { label: 'Update' }],
    ]);
    expect(module.steps.filter((step) => step.action !== null)).toHaveLength(1);
    expect(module.consent.required).toBe(true);
    expect(module.consent.facts[1]).toContain('renames or deletes the planner’s files');
    expect(module.removeAvailable).toBe(false);
    expect(module.details.find((detail) => detail.key === 'coordinator')?.value).toBe(
      'The RunPlanner_Modpack coordinator is no longer needed. Remove it in r2modman.',
    );
    expect(module.steps.some((step) => step.text.includes('coordinator'))).toBe(false);
  });

  it('derives needs setup, update available and ready from the reported facts', () => {
    const absent: StatusOverrides = {
      inspection: {
        module: { state: 'absent', version: null, source: null, matchesBundled: false },
        install: { action: 'install' },
        removable: false,
      },
      publicationBlockers: [{ code: 'moduleMissing', found: null, required: '0.1.0' }],
    };
    expect(moduleOf(absent)).toMatchObject({ state: 'needsSetup', tone: 'warning' });
    expect(stepKeys(absent)).toEqual(['module']);
    expect(moduleOf(absent).removeAvailable).toBe(false);

    const update: StatusOverrides = {
      inspection: {
        module: { version: '0.0.9', matchesBundled: false },
        install: { action: 'update' },
      },
      publicationBlockers: [{ code: 'moduleMismatch', found: '0.0.9', required: '0.1.0' }],
    };
    expect(moduleOf(update)).toMatchObject({
      state: 'updateAvailable',
      summary: 'Update available · this planner 0.1.0',
    });
    expect(moduleOf(update).steps[0]?.action).toEqual({ label: 'Update' });

    const library: StatusOverrides = {
      inspection: { modpackLib: { state: 'missing', found: null } },
      publicationBlockers: [{ code: 'modpackLibMissing', found: null, required: '4.1.0' }],
    };
    expect(moduleOf(library)).toMatchObject({ state: 'needsSetup', tone: 'error' });
    expect(moduleOf(library).steps[0]?.link).toEqual({
      url: 'https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/',
      label: 'Thunderstore page',
      accessibleName: 'Open ModpackLib’s Thunderstore page in your browser',
    });
    expect(moduleOf(library).steps[0]?.text).toBe('Install ModpackLib 4.1.0+ in r2modman');

    // An intact development checkout install is publishable, so it is not an update step.
    const checkout = moduleOf({
      developmentInstallAvailable: true,
      inspection: { module: { source: 'checkout', matchesBundled: false } },
    });
    expect(checkout.state).toBe('ready');
    expect(checkout.steps).toEqual([]);
  });

  it('offers an update for another module version even while it admits this planner’s plans', () => {
    const older = moduleOf({
      inspection: {
        module: { version: '0.0.9' },
        install: { action: 'update', consentRequired: false, updateAvailable: true },
      },
    });
    expect(older.state).toBe('updateAvailable');
    expect(older.steps.map((step) => step.text)).toEqual(['Update the game module']);
  });

  it('offers to reinstall a module modified since install at the same version', () => {
    const modified = moduleOf({
      inspection: {
        module: { modified: true },
        install: { action: 'update', consentRequired: false, updateAvailable: false },
      },
    });
    expect(modified.state).toBe('updateAvailable');
    expect(modified.steps.map((step) => step.text)).toEqual(['Update the game module']);
  });

  it('uses the unreadable mod list wording distinctly from r2modman management', () => {
    const overrides: StatusOverrides = {
      inspection: {
        r2modman: { state: 'unreadable' },
        install: { action: 'update', consentRequired: true },
        removable: false,
      },
    };
    const module = moduleOf(overrides);
    expect(module.steps.map((step) => step.text)).toEqual([
      'Check r2modman: r2modman’s mod list couldn’t be read, so it may manage this Run Planner folder',
    ]);
    expect(module.consent.facts).toContain(
      'r2modman’s mod list couldn’t be read, so r2modman may manage this folder.',
    );
    expect(module.details.find((detail) => detail.key === 'r2modman')?.value).toBe(
      'r2modman’s mod list couldn’t be read',
    );
    expect(describeRemoveOutcome('r2modmanUnreadable')).toBe(
      'r2modman’s mod list couldn’t be read, so the module was not removed.',
    );
  });

  it('keeps module source and modified state in details', () => {
    const module = moduleOf({
      inspection: {
        module: { source: 'checkout', matchesBundled: false, modified: true },
        install: { action: 'update' },
      },
      publicationBlockers: [{ code: 'moduleMismatch', found: '0.1.0', required: '0.1.0' }],
    });
    expect(module.details.find((detail) => detail.key === 'module')?.value).toBe(
      'Installed 0.1.0 from this checkout (modified) · this planner 0.1.0',
    );
    expect(module.state).toBe('updateAvailable');
  });

  it('asks before switching away only from a planner install', () => {
    for (const [state, expected] of [
      ['plannerInstalled', true],
      ['unrecognized', false],
      ['absent', false],
    ] as const) {
      expect(
        projectGamePanel(gameModuleStatus({ inspection: { module: { state } } })).location
          .confirmSwitchAway,
      ).toBe(expected);
    }
  });

  it('offers discovered profiles with their Run Planner hints', () => {
    const model = projectGameProfileChoices(
      {
        supported: true,
        profiles: [
          { path: '/p/a', location: '/p/a', label: 'a', module: 'plannerInstalled' },
          { path: '/p/b', location: '/p/b', label: 'b', module: 'thunderstore' },
          { path: '/p/c', location: '/p/c', label: 'c', module: 'none' },
          { path: '/p/d', location: '/p/d', label: 'd', module: 'modListUnreadable' },
        ],
      },
      '/p/b',
    );
    expect(
      model.sections[0]?.items.map((item) => [item.label, item.status, item.selected]),
    ).toEqual([
      ['a', 'Run Planner installed', false],
      ['b', 'Run Planner (Thunderstore)', true],
      ['c', undefined, false],
      ['d', 'Run Planner (mod list unreadable)', false],
    ]);
  });

  it('reuses the step wording for publication blockers', () => {
    expect(
      [
        { code: 'noTarget', found: null, required: null },
        { code: 'targetUnavailable', found: null, required: null },
        { code: 'moduleMissing', found: null, required: '0.1.0' },
        { code: 'moduleMismatch', found: '0.10.0', required: '0.1.0' },
        { code: 'modpackLibMissing', found: null, required: '4.1.0' },
        { code: 'modpackLibUnreadable', found: null, required: '4.1.0' },
        { code: 'modpackLibOlder', found: '4.0.1', required: '4.1.0' },
        { code: 'modpackLibIncompatibleMajor', found: '5.0.0', required: '4.1.0' },
      ].map((blocker) =>
        describePublicationBlocker(blocker as Parameters<typeof describePublicationBlocker>[0]),
      ),
    ).toEqual([
      'Set the game location in the Game panel.',
      'The game location is unavailable. Change it in the Game panel.',
      'Install the game module in the Game panel.',
      'Update the game module in the Game panel (found 0.10.0).',
      'Install ModpackLib 4.1.0+ in r2modman.',
      'Reinstall or enable ModpackLib 4.1.0+ in r2modman (found unreadable).',
      'Update ModpackLib to 4.1.0+ in r2modman (found 4.0.1).',
      'Install a ModpackLib 4.x release (4.1.0+) in r2modman (found 5.0.0).',
    ]);
  });
  it('words a stranded copy by whether an install step exists', () => {
    const current = moduleOf({ inspection: { strandedInstall: '.run-planner-replaced-01' } });
    expect(current.steps.map((step) => [step.key, step.text])).toEqual([
      [
        'stranded',
        'A failed update left an old module copy at ReturnOfModding/.run-planner-replaced-01. The game does not load it; delete it once you no longer need it',
      ],
    ]);
    expect(current.steps.every((step) => step.action === null)).toBe(true);
  });

  it('takes the install label and state from the host action', () => {
    const install = moduleOf({
      inspection: { install: { action: 'install' } },
      publicationBlockers: [{ code: 'moduleMissing', found: null, required: '0.1.0' }],
    });
    expect(install.steps.at(-1)?.action).toEqual({ label: 'Install' });
    expect(install.state).toBe('needsSetup');
    expect(moduleOf({ inspection: { install: { action: 'current' } } }).steps).toEqual([]);
  });

  it('explains why switching away cannot offer removal', () => {
    const reason = (inspection: NonNullable<StatusOverrides['inspection']>) =>
      projectGamePanel(gameModuleStatus({ inspection })).location.switchAwayRemoval;
    expect(reason({ r2modman: { state: 'managed' }, removable: false })).toEqual({
      available: false,
      reason: 'r2modman manages this module. Remove it in r2modman.',
    });
    expect(reason({ r2modman: { state: 'unreadable' }, removable: false }).reason).toBe(
      'r2modman’s mod list couldn’t be read, so the module was not removed.',
    );
  });
  it('lists every slot on Home with its library plan, what plays next and why older', () => {
    const now = Date.UTC(2026, 0, 2, 12);
    const loadout = { weaponKey: 'WeaponStaffSwing', aspectKey: 'BaseStaffAspect' };
    const present = {
      state: 'present',
      routeKey: 'Surface',
      biomeKeys: ['N', 'O'],
      ...loadout,
    } as const;
    const status = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(1, { ...present, modifiedAtMs: now - 3 * 60_000, projectId: 'mine' }),
          planSlot(2, { ...present, projectId: 'theirs', displayName: 'Theirs' }),
          planSlot(3, { state: 'unreadable' }),
          planSlot(4, { ...present, state: 'stale', hasSource: true, projectId: 'mine' }),
          planSlot(5, { ...present, state: 'stale', hasSource: false, projectId: 'gone' }),
        ),
        eventSlot: eventSlot({
          ...present,
          event: { id: 'w42', title: 'Week 42', endsAt: '2026-10-19T00:00:00Z' },
        }),
        activeSlot: { state: 'present', slot: 1 },
      },
    });
    const links: LibrarySlotLinks = {
      byKey: new Map(),
      bySlot: new Map<GamePlanSlotNumber, { key: string; name: string; link: PlanSlotLink }>([
        [1, { key: 'k', name: 'My plan', link: { slot: 1, marker: 'current', reason: null } }],
        [
          4,
          {
            key: 'k',
            name: 'My plan',
            link: {
              slot: 4,
              marker: 'older',
              reason: 'needs rebuild',
            },
          },
        ],
      ]),
    };
    const home = projectHomeSlots(status, catalog, now, links);
    expect(home?.rows.map((row) => row.label)).toEqual([
      'Event',
      ...Array.from({ length: 12 }, (_, index) => `Slot ${index + 1}`),
    ]);
    expect(home?.rows[0]).toMatchObject({
      plan: { kind: 'event', name: 'Week 42', state: 'community event' },
      aspect: 'Staff · Melinoë',
      nextRun: { kind: 'available', intent: { kind: 'setActiveSlot', slot: 0 } },
      clear: null,
    });
    // Every filled plan slot can be cleared from Home, the event slot never.
    expect(home?.rows.filter((row) => row.clear !== null).map((row) => row.slot)).toEqual(
      home?.rows.filter((row) => row.slot !== 0 && row.state !== 'empty').map((row) => row.slot),
    );
    expect(home?.rows[1]).toMatchObject({
      plan: { kind: 'library', key: 'k', name: 'My plan', state: 'current', tone: 'current' },
      route: catalog.routes.byKey.Surface!.label,
      sent: { ago: '3m ago' },
      nextRun: { kind: 'playsNext' },
    });
    expect(home?.rows[2]?.plan).toEqual({
      kind: 'notInLibrary',
      name: 'Theirs',
      state: 'not in library',
      tone: 'unlinked',
    });
    expect(home?.rows[3]).toMatchObject({
      plan: null,
      summary: 'Unreadable',
      nextRun: { kind: 'unplayable' },
    });
    expect(home?.rows[4]).toMatchObject({
      plan: { kind: 'library', state: 'older, needs rebuild', tone: 'older' },
      nextRun: { kind: 'unplayable' },
    });
    expect(home?.rows[5]?.plan).toMatchObject({
      kind: 'notInLibrary',
      state: 'not in library, send again',
    });
    expect(home?.rows[6]).toMatchObject({ summary: 'Empty', nextRun: null });
    expect(home?.rebuild).toEqual({
      available: true,
      summary: '1 slot needs a rebuild for module 0.1.0.',
      failures: [],
    });
    expect(
      projectHomeSlots(status, catalog, now, links, {
        problem: null,
        outcomes: [
          { slot: 4, kind: 'rebuilt' },
          { slot: 5, kind: 'failed', reason: 'x' },
        ],
      })?.rebuild.summary,
    ).toBe('Rebuilt 1 slot · couldn’t rebuild 1 slot');
    // A failed rebuild says so in a few words in its row, and why under the table.
    const failed = projectHomeSlots(status, catalog, now, links, {
      problem: null,
      outcomes: [{ slot: 5, kind: 'failed', reason: 'The source could not be read.' }],
    });
    expect(failed?.rows[5]?.plan).toMatchObject({ state: 'not in library, couldn’t rebuild' });
    expect(failed?.rebuild.failures).toEqual([
      'Slot 5 couldn’t rebuild: The source could not be read.',
    ]);
    expect(
      projectHomeSlots(gameModuleStatus({ inspection: null }), catalog, now, NO_SLOT_LINKS),
    ).toBeNull();
  });

  it('shows a slot’s loadout without raw keys or a missing aspect', () => {
    const status = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(1, {
            state: 'present',
            routeKey: 'constructor',
            weaponKey: '__proto__',
            aspectKey: 'hasOwnProperty',
          }),
          planSlot(2, { state: 'present', routeKey: 'Underworld', weaponKey: 'WeaponDagger' }),
        ),
      },
    });
    const rows = projectHomeSlots(status, catalog, 0, NO_SLOT_LINKS)?.rows;
    expect(rows?.[0]).toMatchObject({ route: 'constructor', aspect: '—' });
    expect(rows?.[1]?.aspect).toBe(catalog.weapons.byKey.WeaponDagger!.shortLabel);
  });

  it('lists the open plan’s slots and every slot to send it to in the slot picker', () => {
    const present = { state: 'present', routeKey: 'Underworld', biomeKeys: ['F'] } as const;
    const status = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(1, { ...present, projectId: 'mine', planFingerprint: 'now', modifiedAtMs: 1 }),
          planSlot(2, { ...present, projectId: 'mine', planFingerprint: 'before' }),
          planSlot(3, { ...present, projectId: 'theirs' }),
          planSlot(4, { ...present, projectId: 'unknown' }),
          planSlot(5, { state: 'unreadable' }),
        ),
        activeSlot: { state: 'present', slot: 1 },
      },
    });
    const current = { kind: 'publishable', projectId: 'mine', planFingerprint: 'now' } as const;
    const names = new Map<GamePlanSlotNumber, string>([[3, 'Their plan']]);
    const slots = projectSendSlots(status, current, 'mine', names, 10);
    expect(slots?.own).toEqual([
      {
        slot: 1,
        marker: 'current',
        playsNext: true,
        sent: expect.objectContaining({ ago: 'just now' }),
      },
      { slot: 2, marker: 'older', playsNext: false, sent: null },
    ]);
    expect(slots?.olderCount).toBe(1);
    expect(slots?.unavailableReason).toBeNull();
    expect(slots?.picks.slice(0, 6).map((pick) => [pick.occupant, pick.action])).toEqual([
      [
        { kind: 'thisPlan', marker: 'current' },
        { label: 'Current', confirm: false, enabled: false },
      ],
      [
        { kind: 'thisPlan', marker: 'older' },
        { label: 'Update', confirm: false, enabled: true },
      ],
      [
        { kind: 'plan', name: 'Their plan' },
        { label: 'Replace', confirm: true, enabled: true },
      ],
      [{ kind: 'notInLibrary' }, { label: 'Replace', confirm: true, enabled: true }],
      [{ kind: 'unreadable' }, { label: 'Replace', confirm: true, enabled: true }],
      [{ kind: 'empty' }, { label: 'Send here', confirm: false, enabled: true }],
    ]);

    const blocked = projectSendSlots(
      status,
      { kind: 'notPublishable', code: 'notEligible' },
      'mine',
      names,
      10,
    );
    expect(blocked?.unavailableReason).toBe('Resolve this plan’s findings before sending it.');
    expect(blocked?.picks.every((pick) => pick.action === null)).toBe(true);
    const reasonFor = (code: 'unsupportedRoute' | 'openingMissing' | null) =>
      projectSendSlots(status, { kind: 'notPublishable', code }, 'mine', names, 10)
        ?.unavailableReason;
    expect(reasonFor('unsupportedRoute')).toBe('The game module can’t run this route yet.');
    expect(reasonFor('openingMissing')).toBe('Plan the opening room before sending this plan.');
    expect(reasonFor(null)).toBe('The game module can’t run this plan yet.');
    // Slots are still listed while the module cannot take plans, with why nothing can be sent.
    const update = gameModuleStatus({
      inspection: status.inspection!,
      publicationBlockers: [{ code: 'moduleMismatch', found: '0.0.9', required: '0.1.0' }],
    });
    expect(projectSendSlots(update, current, 'mine', names, 10)?.unavailableReason).toBe(
      'Set up or update the game module on the Game tab to send plans.',
    );
  });

  it('derives every split send state with its label, slot and explanation', () => {
    const slot = (
      number: GamePlanSlotNumber,
      projectId: string,
      overrides: Parameters<typeof planSlot>[1] = {},
    ) =>
      planSlot(number, {
        state: 'present',
        routeKey: 'Underworld',
        biomeKeys: ['F'],
        planFingerprint: 'sent',
        projectId,
        ...overrides,
      });
    const withSlots = (
      slots: ReturnType<typeof planSlot>[],
      active: GamePlanSlotNumber | null = null,
    ) =>
      gameModuleStatus({
        inspection: {
          planSlots: planSlots(...slots),
          ...(active === null ? {} : { activeSlot: { state: 'present', slot: active } }),
        },
      });
    const full = (except: GamePlanSlotNumber[] = []) =>
      ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const)
        .filter((number) => !except.includes(number))
        .map((number) => slot(number, `other-${number}`));
    const mine = { projectId: 'mine', eligible: true };
    const idle = { kind: 'idle' } as const;
    const ready = gameModuleStatus();
    const sentAt = Date.UTC(2026, 0, 2, 14, 5, 30);
    const cases = [
      [
        projectGameSendButton(ready, null, null, idle),
        'noProject',
        'Send to game',
        null,
        'Open a plan first.',
      ],
      [
        projectGameSendButton(null, mine, null, idle),
        'notReady',
        'Send to game',
        null,
        'Set up the game on the Game tab.',
      ],
      [
        projectGameSendButton(ready, { projectId: 'mine', eligible: false }, null, idle),
        'notSendable',
        'Send to game',
        null,
        'Resolve this plan’s findings before sending it.',
      ],
      [
        projectGameSendButton(
          ready,
          {
            ...mine,
            startPointBlock: { code: 'startPointIneligible', reason: { kind: 'notOnItinerary' } },
          },
          null,
          idle,
        ),
        'notSendable',
        'Send to game',
        null,
        'The start point can’t start this run. This biome is not on the route.',
      ],
      // Never sent: the first empty slot.
      [
        projectGameSendButton(ready, mine, null, idle),
        'ready',
        'Send to slot 1',
        { kind: 'send', slot: 1 },
        null,
      ],
      // The slot last used this session while it is still empty.
      [
        projectGameSendButton(ready, mine, 7, idle),
        'ready',
        'Send to slot 7',
        { kind: 'send', slot: 7 },
        null,
      ],
      // The plan's own slot, the one that plays next when it has several.
      [
        projectGameSendButton(
          withSlots([slot(3, 'mine'), slot(5, 'mine')], 5),
          { ...mine, planFingerprint: 'edited' },
          7,
          idle,
        ),
        'ready',
        'Send to slot 5',
        { kind: 'send', slot: 5 },
        null,
      ],
      [
        projectGameSendButton(
          withSlots([slot(3, 'mine')]),
          { ...mine, planFingerprint: 'sent' },
          null,
          idle,
        ),
        // Nothing to send: the main part opens the picker.
        'upToDate',
        'Slot 3 · up to date',
        { kind: 'openPlans' },
        null,
      ],
      // An outdated slot always needs a send.
      [
        projectGameSendButton(
          withSlots([slot(3, 'mine', { state: 'stale' })]),
          { ...mine, planFingerprint: 'sent' },
          null,
          idle,
        ),
        'ready',
        'Send to slot 3',
        { kind: 'send', slot: 3 },
        null,
      ],
      [
        projectGameSendButton(withSlots(full()), mine, 2, idle),
        'chooseSlot',
        'Send to game…',
        { kind: 'openPlans' },
        'Choose a slot.',
      ],
      [
        projectGameSendButton(ready, mine, 2, { kind: 'sending' }),
        'sending',
        'Sending…',
        null,
        null,
      ],
      [
        projectGameSendButton(ready, mine, 2, { kind: 'sent', slot: 2, atMs: sentAt }),
        'sent',
        '✓ Sent · Slot 2',
        null,
        `Sent to slot 2 at ${new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}; now active.`,
      ],
      [
        projectGameSendButton(ready, mine, 2, { kind: 'failed' }),
        'failed',
        '! Not sent',
        null,
        'Details are in the slot picker.',
      ],
    ] as const;
    for (const [button, state, label, action, description] of cases) {
      expect(button).toEqual({ state, label, action, description });
    }
    expect(projectGameSendButton(withSlots(full([9])), mine, null, idle).label).toBe(
      'Send to slot 9',
    );
    const notActive = projectGameSendButton(
      ready,
      mine,
      2,
      { kind: 'sent', slot: 2, atMs: sentAt },
      { slot: 2, message: 'locked.', atMs: sentAt },
    );
    expect(notActive.description).toMatch(/; not made active\.$/);
    // Once the file names the slot, as after a later pick, the failure no longer stands.
    const nowActive = projectGameSendButton(
      gameModuleStatus({ inspection: { activeSlot: { state: 'present', slot: 2 } } }),
      mine,
      2,
      { kind: 'sent', slot: 2, atMs: sentAt },
      { slot: 2, message: 'locked.', atMs: sentAt },
    );
    expect(nowActive.description).toMatch(/; now active\.$/);
  });

  it('names a Library plan’s default slot, its state and how many more slots hold it', () => {
    const link = (slot: GamePlanSlotNumber, marker: PlanSlotLink['marker']): PlanSlotLink => ({
      slot,
      marker,
      reason: marker === 'older' ? 'edited since sent' : null,
    });
    const playing = (slot: GamePlanSlotNumber) =>
      gameModuleStatus({ inspection: { activeSlot: { state: 'present', slot } } });
    const idle = { kind: 'idle' } as const;
    const shown = (button: ReturnType<typeof projectLibrarySendButton>) => [
      button.state,
      button.label,
      button.action,
      button.more,
    ];
    // Not in a slot, or no game location: the main part opens the picker.
    expect(shown(projectLibrarySendButton(playing(1), [], idle))).toEqual([
      'chooseSlot',
      'Send to game…',
      { kind: 'openPlans' },
      0,
    ]);
    expect(shown(projectLibrarySendButton(null, [link(2, 'current')], idle))).toEqual([
      'chooseSlot',
      'Send to game…',
      { kind: 'openPlans' },
      0,
    ]);
    // Several slots: the one that plays next, else the first, with the rest counted.
    expect(
      shown(projectLibrarySendButton(playing(9), [link(2, 'current'), link(9, 'older')], idle)),
    ).toEqual(['ready', 'Update slot 9', { kind: 'send', slot: 9 }, 1]);
    expect(
      shown(projectLibrarySendButton(playing(1), [link(2, 'current'), link(9, 'older')], idle)),
    ).toEqual(['upToDate', 'Slot 2 · up to date', { kind: 'openPlans' }, 1]);
    // Still comparing: the bare slot, which does nothing until the comparison is read.
    expect(shown(projectLibrarySendButton(playing(1), [link(4, null)], idle))).toEqual([
      'checking',
      'Slot 4',
      null,
      0,
    ]);
    // The module not ready: the bare slot, opening the picker that says why.
    const outdated = gameModuleStatus({
      inspection: {
        module: {
          state: 'plannerInstalled',
          version: '0.0.1',
          source: 'bundled',
          matchesBundled: false,
          modified: false,
        },
        install: { action: 'update', consentRequired: false, updateAvailable: true },
      },
    });
    expect(shown(projectLibrarySendButton(outdated, [link(3, 'older')], idle))).toEqual([
      'notReady',
      'Slot 3',
      { kind: 'openPlans' },
      0,
    ]);
    expect(
      shown(projectLibrarySendButton(playing(1), [link(3, 'older')], { kind: 'sending' })),
    ).toEqual(['sending', 'Sending…', null, 0]);
  });

  it('plays the event next only while the file names it and it holds a playable plan', () => {
    const event = eventSlot({ state: 'present', routeKey: 'Surface' });
    const status = (slot: ReturnType<typeof eventSlot>) =>
      gameModuleStatus({
        inspection: { eventSlot: slot, activeSlot: { state: 'present', slot: 0 } },
      });
    expect(projectNextRunSlot(status(event))).toBe(0);
    expect(projectEventPlaysNext(status(event))).toBe(true);
    expect(projectEventPlaysNext(status({ ...event, state: 'stale' }))).toBe(false);
    expect(projectEventPlaysNext(status(eventSlot()))).toBe(false);
    expect(projectEventPlaysNext(null)).toBe(false);
    // A missing or invalid file plays slot 1; unreadable slots name no slot.
    for (const file of [{ state: 'missing' }, { state: 'invalid' }] as const) {
      expect(projectNextRunSlot(gameModuleStatus({ inspection: { activeSlot: file } }))).toBe(1);
    }
    expect(projectNextRunSlot(gameModuleStatus({ inspection: null }))).toBeNull();
  });

  it('describes why an Active slot write did not take effect', () => {
    expect(
      describeActiveSlotSetting({
        status: 'activated',
        message: 'Slot 2 is active.',
        blockers: [],
      }),
    ).toBeNull();
    expect(
      describeActiveSlotSetting({
        status: 'notPresent',
        message: 'Slot 3 has no plan to make active.',
        blockers: [],
      }),
    ).toBe('Slot 3 has no plan to make active.');
    const blocker = { code: 'moduleMismatch', found: '0.0.9', required: '0.1.0' } as const;
    expect(
      describeActiveSlotSetting({ status: 'blocked', message: 'Not ready.', blockers: [blocker] }),
    ).toBe(describePublicationBlocker(blocker));
    const atMs = Date.UTC(2026, 0, 2, 14, 5);
    const failure = { slot: 4, message: 'locked.', atMs } as const;
    const fileNames = (slot: 2 | 4) =>
      gameModuleStatus({ inspection: { activeSlot: { state: 'present', slot } } });
    expect(describeSentNotActivated(failure, fileNames(2))).toBe(
      `Sent to slot 4 at ${new Date(atMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, but it isn’t active: locked.`,
    );
    expect(describeSentNotActivated(failure, fileNames(4))).toBeNull();
    expect(describeSentNotActivated(null, fileNames(2))).toBeNull();
    expect(describeSent(4, failure, fileNames(2))).toBe('Sent to slot 4; not made active.');
    expect(describeSent(4, failure, fileNames(4))).toBe('Sent to slot 4.');
    expect(describeSent(4, null, null)).toBe('Sent to slot 4.');
  });

  it('describes a failed last send', () => {
    const atMs = Date.UTC(2026, 0, 2, 14, 5);
    expect(describeLastSendFailure({ message: 'could not write plan slot.', atMs })).toBe(
      `Last send failed at ${new Date(atMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: could not write plan slot.`,
    );
  });

  it('describes a cleared slot with its undo, and why a clear or its undo did not take', () => {
    const cleared = { slot: 3, plan: '{}', source: null, summary: null, wasActive: true } as const;
    const clearing = {
      status: 'cleared',
      message: 'Cleared slot 3.',
      blockers: [],
      cleared,
      activeSlotMoved: false,
      activationProblem: null,
    } as const;
    expect(projectSlotClearing(3, clearing, true)).toEqual({
      notice: { text: 'Cleared slot 3', undo: cleared },
      problem: null,
    });
    expect(projectSlotClearing(3, { ...clearing, activeSlotMoved: true }, true).notice?.text).toBe(
      'Cleared slot 3 · Slot 1 plays next',
    );
    expect(projectSlotClearing(3, { ...clearing, activeSlotMoved: true }, false).notice?.text).toBe(
      'Cleared slot 3 · No plan plays next',
    );
    expect(
      projectSlotClearing(3, { ...clearing, cleared: null, activationProblem: 'denied' }, true),
    ).toEqual({
      notice: { text: 'Cleared slot 3', undo: null },
      problem: 'Slot 3 is still the active slot although it is empty: denied',
    });
    expect(
      projectSlotClearing(3, { ...clearing, status: 'alreadyEmpty', cleared: null }, true),
    ).toEqual({
      notice: null,
      problem: null,
    });
    expect(
      projectSlotClearing(
        3,
        {
          ...clearing,
          status: 'blocked',
          cleared: null,
          blockers: [{ code: 'noTarget', found: null, required: null }],
        },
        true,
      ).problem,
    ).toBe(
      `Not cleared: ${describePublicationBlocker({ code: 'noTarget', found: null, required: null })}`,
    );

    const restored = {
      status: 'restored',
      message: 'Restored slot 3.',
      blockers: [],
      activationProblem: null,
    } as const;
    expect(describeSlotRestoration(restored)).toBeNull();
    expect(describeSlotRestoration({ ...restored, activationProblem: 'denied' })).toBe(
      'Restored, but not made active again: denied',
    );
    expect(
      describeSlotRestoration({
        ...restored,
        status: 'occupied',
        message: 'Slot 3 holds a plan again, so it was not restored.',
      }),
    ).toBe('Slot 3 holds a plan again, so it was not restored.');
    expect(describeSlotRestoration({ ...restored, status: 'nativeWrite', message: 'x' })).toBe(
      'Not restored: x',
    );
  });

  it('says whether the module is ready, how many slots are filled and which plays next', () => {
    const filled = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(1, { state: 'present' }),
          planSlot(2, { state: 'stale' }),
          planSlot(4, { state: 'present' }),
        ),
        activeSlot: { state: 'present', slot: 4 },
      },
    });
    expect(projectGameContext(filled)).toEqual([
      { text: 'Ready', tone: 'ok' },
      { text: '3 slots filled', tone: null },
      { text: 'Slot 4 plays next', tone: 'next' },
    ]);
    // A slot that cannot play is not named as playing next.
    expect(
      projectGameContext(
        gameModuleStatus({
          inspection: {
            planSlots: planSlots(planSlot(2, { state: 'stale' })),
            activeSlot: { state: 'present', slot: 2 },
          },
        }),
      ),
    ).toEqual([
      { text: 'Ready', tone: 'ok' },
      { text: '1 slot filled', tone: null },
    ]);
    expect(projectGameContext(gameModuleStatus({ target: null, inspection: null }))).toEqual([
      { text: 'Not connected', tone: null },
    ]);
    expect(projectGameContext(null)).toEqual([]);
  });
});
