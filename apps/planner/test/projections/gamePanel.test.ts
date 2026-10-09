import { describe, expect, it } from 'vitest';

import {
  describePublicationBlocker,
  describeRemoveOutcome,
  gameSaveState,
  projectGamePanel,
  projectGameProfileChoices,
  projectGameIndicator,
  projectGamePlans,
  projectGameSendButton,
  describeActiveSlotSetting,
  describeLastSendFailure,
  describeSent,
  describeSentNotActivated,
} from '@planner/projections/gamePanel';
import { catalog } from '@run-planner/hades2-catalog';
import type { GameActiveSlot } from '@planner/persistence/gameModuleHost';
import type { GameActivationActivity } from '@planner/projections/gamePanel';
import { gameModuleStatus, planSlot, planSlots } from '@planner-test/fixtures/gameModuleHost';

type StatusOverrides = NonNullable<Parameters<typeof gameModuleStatus>[0]>;

const snapshotOf = (status: ReturnType<typeof gameModuleStatus>) => ({
  status,
  error: null,
  readAt: 1,
});

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
    expect(projectGameIndicator(snapshotOf(gameModuleStatus()))).toEqual({
      state: 'ready',
      symbol: '✓',
      accessibleName: 'Game — ready',
    });
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
  it('derives the header indicator for each status with distinct symbols', () => {
    expect(projectGameIndicator({ status: null, error: null, readAt: 0 })).toEqual({
      state: 'checking',
      symbol: '…',
      accessibleName: 'Game — checking',
    });
    expect(projectGameIndicator({ status: null, error: 'host unavailable', readAt: 0 })).toEqual({
      state: 'unavailable',
      symbol: '!',
      accessibleName: 'Game — status unavailable: host unavailable',
    });
    expect(
      projectGameIndicator(snapshotOf(gameModuleStatus({ target: null, inspection: null }))),
    ).toMatchObject({ state: 'noLocation', symbol: '○', accessibleName: 'Game — no location' });
    expect(
      projectGameIndicator(
        snapshotOf(
          gameModuleStatus({
            inspection: { modpackLib: { state: 'older', found: '4.0.1' } },
            publicationBlockers: [{ code: 'modpackLibOlder', found: '4.0.1', required: '4.1.0' }],
          }),
        ),
      ),
    ).toMatchObject({ state: 'needsSetup', symbol: '!', accessibleName: 'Game — needs setup' });
    expect(
      projectGameIndicator(
        snapshotOf(gameModuleStatus({ inspection: null, targetProblem: 'Gone.' })),
      ).state,
    ).toBe('needsSetup');
  });

  it('labels slot columns from the catalog and marks current and older versions', () => {
    const now = Date.UTC(2026, 0, 2, 12);
    const loadout = { weaponKey: 'WeaponStaffSwing', aspectKey: 'BaseStaffAspect' };
    const status = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(1, {
            state: 'present',
            modifiedAtMs: now - 3 * 60_000,
            routeKey: 'Surface',
            biomeKeys: ['N', 'O', 'P', 'Q'],
            planFingerprint: 'current',
            projectId: 'mine',
            displayName: 'Surface Phial run',
            ...loadout,
          }),
          planSlot(2, {
            state: 'present',
            modifiedAtMs: now - 2 * 86_400_000,
            routeKey: 'Underworld',
            biomeKeys: ['F'],
            planFingerprint: 'older',
            projectId: 'mine',
            ...loadout,
          }),
          planSlot(3, { state: 'unreadable', modifiedAtMs: now - 30_000 }),
          planSlot(4, {
            state: 'present',
            modifiedAtMs: now,
            routeKey: 'Underworld',
            biomeKeys: ['F', 'G'],
            planFingerprint: 'current',
            projectId: 'someone-else',
            displayName: 'Theirs',
            ...loadout,
          }),
        ),
      },
    });
    const current = { kind: 'publishable', projectId: 'mine', planFingerprint: 'current' } as const;
    const plans = projectGamePlans(status, current, 'clean', catalog, now);
    const exact = (ms: number) =>
      new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    expect(plans?.unavailableReason).toBeNull();
    expect(plans?.rows[0]).toEqual({
      slot: 1,
      state: 'present',
      columns: {
        plan: 'Surface Phial run',
        route: catalog.routes.byKey.Surface!.label,
        endsAt: catalog.biomes.byKey.Q!.label,
        aspect: 'Aspect of Melinoë (Staff)',
        sent: {
          ago: '3m ago',
          exact: exact(now - 3 * 60_000),
          iso: new Date(now - 3 * 60_000).toISOString(),
        },
      },
      summary: null,
      marker: 'current',
      action: { label: 'Replace', confirm: true },
      active: { checked: false, intent: { kind: 'setActiveSlot', slot: 1 } },
    });
    expect(catalog.biomes.byKey.Q!.label).not.toBe('Q');
    expect(plans?.rows[1]).toMatchObject({
      columns: { plan: null, sent: { ago: '2d ago', exact: exact(now - 2 * 86_400_000) } },
      marker: 'olderVersion',
    });
    expect(plans?.rows[2]).toMatchObject({ columns: null, summary: 'Unreadable', marker: null });
    expect(plans?.rows[3]).toMatchObject({
      columns: { plan: 'Theirs', sent: { ago: 'just now' } },
      marker: null,
    });
    expect(plans?.rows[4]).toMatchObject({
      columns: null,
      summary: 'Empty',
      action: { label: 'Send here', confirm: false },
    });

    const dirty = projectGamePlans(status, current, 'dirty', catalog, now);
    expect(dirty?.rows.map((row) => row.action?.label)).toEqual([
      'Save and send',
      'Save and send',
      'Save and send',
      'Save and send',
      'Save and send',
      'Save and send',
    ]);
    expect(dirty?.rows[0]?.action?.confirm).toBe(true);
    expect(projectGamePlans(status, current, 'unsaved', catalog, now)?.rows[5]?.action).toEqual({
      label: 'Save and send…',
      confirm: false,
    });

    const blocked = projectGamePlans(
      status,
      { kind: 'notPublishable', code: 'notEligible' },
      'clean',
      catalog,
      now,
    );
    expect(blocked?.unavailableReason).toBe('Resolve this plan’s findings before sending it.');
    expect(blocked?.rows.every((row) => row.action === null && row.marker === null)).toBe(true);
    const reasonFor = (
      code: 'unsupportedRoute' | 'openingMissing' | 'executionCoverageMissing' | null,
    ) =>
      projectGamePlans(status, { kind: 'notPublishable', code }, 'clean', catalog, now)
        ?.unavailableReason;
    expect(reasonFor('unsupportedRoute')).toBe('The game module can’t run this route yet.');
    expect(reasonFor('openingMissing')).toBe('Plan the opening room before sending this plan.');
    expect(reasonFor('executionCoverageMissing')).toBe('The game module can’t run this plan yet.');
    expect(reasonFor(null)).toBe('The game module can’t run this plan yet.');
    expect(
      projectGamePlans(
        status,
        {
          kind: 'notPublishable',
          code: 'startPointIneligible',
          startPointReason: { kind: 'branchesDisagree', families: ['traits', 'maxStats'] },
        },
        'clean',
        catalog,
        now,
      )?.unavailableReason,
    ).toBe(
      'The start point can’t start this run. The planned outcomes before this point differ in boons and traits, max Health or Magick.',
    );
    expect(
      projectGamePlans(status, { kind: 'noProject' }, 'clean', catalog, now)?.unavailableReason,
    ).toBe('Open a project to send it to the game.');
    expect(
      projectGamePlans(
        gameModuleStatus({
          inspection: { install: { action: 'install' } },
          publicationBlockers: [{ code: 'moduleMissing', found: null, required: '0.1.0' }],
        }),
        { kind: 'noProject' },
        'clean',
        catalog,
        now,
      ),
    ).toBeNull();
  });

  it('derives the send save state from the profile status', () => {
    expect(gameSaveState('Clean', 'a.runplanner.json')).toBe('clean');
    expect(gameSaveState('Dirty', 'a.runplanner.json')).toBe('dirty');
    expect(gameSaveState('Unsaved', null)).toBe('unsaved');
    expect(gameSaveState('Recovered', 'a.runplanner.json')).toBe('dirty');
    expect(gameSaveState('Recovered', null)).toBe('unsaved');
  });

  it('falls back to raw keys for labels the catalog does not own', () => {
    const status = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(1, {
            state: 'present',
            routeKey: 'constructor',
            biomeKeys: ['toString'],
            weaponKey: '__proto__',
            aspectKey: 'hasOwnProperty',
          }),
          planSlot(2, { state: 'present', routeKey: 'Underworld', biomeKeys: ['F'] }),
          planSlot(3, {
            state: 'present',
            routeKey: 'FreshFile',
            biomeKeys: ['F'],
            weaponKey: 'WeaponStaffSwing',
          }),
        ),
      },
    });
    const rows = projectGamePlans(status, { kind: 'noProject' }, 'clean', catalog, 0)?.rows;
    expect(rows?.[0]?.columns).toMatchObject({
      route: 'constructor',
      endsAt: 'toString',
      aspect: 'hasOwnProperty (__proto__)',
    });
    expect(rows?.[1]?.columns?.aspect).toBe('Unknown');
    expect(rows?.[2]?.columns?.aspect).toMatch(/^None \(/);
  });

  it('asks for a slot sent by another module build to be sent again', () => {
    const status = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(2, {
            state: 'stale',
            buildId: 'another-build',
            modifiedAtMs: 1,
            routeKey: 'Underworld',
            biomeKeys: ['F'],
            planFingerprint: 'current',
            projectId: 'mine',
          }),
        ),
      },
    });
    const current = { kind: 'publishable', projectId: 'mine', planFingerprint: 'current' } as const;
    expect(projectGamePlans(status, current, 'clean', catalog, 0)?.rows[1]).toMatchObject({
      slot: 2,
      state: 'stale',
      columns: { route: 'Underworld', endsAt: 'Erebus', plan: null },
      summary: 'Sent by another build — send again',
      marker: null,
      action: { label: 'Replace', confirm: true },
      active: { checked: false, intent: null },
    });
    expect(
      projectGameSendButton(status, { projectId: 'mine', eligible: true }, 2, 'clean', {
        kind: 'idle',
      }),
    ).toMatchObject({ state: 'ready', action: { kind: 'send', slot: 2 } });
  });

  it('derives every header send state with a short label and its explanation', () => {
    const inSlot2 = (projectId: string | null, state: 'present' | 'unreadable' = 'present') =>
      gameModuleStatus({
        inspection: {
          planSlots: planSlots(
            planSlot(2, {
              state,
              modifiedAtMs: 1,
              routeKey: 'Underworld',
              biomeKeys: ['F'],
              planFingerprint: 'x',
              projectId,
            }),
          ),
        },
      });
    const mine = { projectId: 'my-plan', eligible: true };
    const idle = { kind: 'idle' } as const;
    const ready = gameModuleStatus();
    const sentAt = Date.UTC(2026, 0, 2, 14, 5, 30);
    const cases = [
      [
        projectGameSendButton(ready, null, 2, 'clean', idle),
        'noProject',
        'Send to game',
        null,
        'Open a plan first.',
      ],
      [
        projectGameSendButton(null, mine, 2, 'clean', idle),
        'notReady',
        'Send to game',
        null,
        'Set up the game in the Game panel.',
      ],
      [
        projectGameSendButton(
          gameModuleStatus({
            publicationBlockers: [{ code: 'modpackLibMissing', found: null, required: '4.1.0' }],
          }),
          mine,
          2,
          'clean',
          idle,
        ),
        'notReady',
        'Send to game',
        null,
        'Set up the game in the Game panel.',
      ],
      [
        projectGameSendButton(ready, { projectId: 'my-plan', eligible: false }, 2, 'clean', idle),
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
          2,
          'clean',
          idle,
        ),
        'notSendable',
        'Send to game',
        null,
        'The start point can’t start this run. This biome is not on the route.',
      ],
      [
        projectGameSendButton(ready, mine, null, 'clean', idle),
        'chooseSlot',
        'Send to game…',
        { kind: 'openPlans' },
        'Choose a slot in the Game panel.',
      ],
      [
        projectGameSendButton(ready, mine, 2, 'unsaved', idle),
        'chooseSlot',
        'Send to game…',
        { kind: 'openPlans' },
        'Choose a slot in the Game panel.',
      ],
      [
        projectGameSendButton(inSlot2('another-project'), mine, 2, 'clean', idle),
        'chooseSlot',
        'Send to game…',
        { kind: 'openPlans' },
        'Choose a slot in the Game panel.',
      ],
      [
        projectGameSendButton(inSlot2(null, 'unreadable'), mine, 2, 'clean', idle),
        'chooseSlot',
        'Send to game…',
        { kind: 'openPlans' },
        'Choose a slot in the Game panel.',
      ],
      [
        projectGameSendButton(inSlot2('my-plan'), mine, 2, 'clean', idle),
        'ready',
        'Send · Slot 2',
        { kind: 'send', slot: 2 },
        null,
      ],
      [
        projectGameSendButton(ready, mine, 2, 'dirty', idle),
        'ready',
        'Send · Slot 2',
        { kind: 'send', slot: 2 },
        'Saves your changes, then sends to slot 2.',
      ],
      [
        projectGameSendButton(ready, mine, 2, 'dirty', { kind: 'sending' }),
        'saving',
        'Saving…',
        null,
        null,
      ],
      [
        projectGameSendButton(ready, mine, 2, 'clean', { kind: 'sending' }),
        'sending',
        'Sending…',
        null,
        null,
      ],
      [
        projectGameSendButton(ready, mine, 2, 'clean', { kind: 'sent', slot: 2, atMs: sentAt }),
        'sent',
        '✓ Sent · Slot 2',
        null,
        `Sent to slot 2 at ${new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}; now active.`,
      ],
      [
        projectGameSendButton(ready, mine, 2, 'clean', { kind: 'failed' }),
        'failed',
        '! Not sent',
        null,
        'Details are in the Game panel.',
      ],
    ] as const;
    for (const [button, state, label, action, description] of cases) {
      expect(button).toEqual({ state, label, action, description });
      expect(button.label.length).toBeLessThanOrEqual(15);
    }
    expect(cases.at(-2)?.[0].description).not.toMatch(/:\d\d:\d\d/);
    expect(new Set(cases.map(([button]) => button.label.replace(/\d/, 'N')))).toEqual(
      new Set([
        'Send to game',
        'Send to game…',
        'Send · Slot N',
        'Saving…',
        'Sending…',
        '✓ Sent · Slot N',
        '! Not sent',
      ]),
    );
    expect(
      projectGameSendButton(ready, mine, 6, 'clean', { kind: 'sent', slot: 6, atMs: 0 }).label,
    ).toBe('✓ Sent · Slot 6');
    const notActive = projectGameSendButton(
      ready,
      mine,
      2,
      'clean',
      { kind: 'sent', slot: 2, atMs: sentAt },
      { slot: 2, message: 'locked.', atMs: sentAt },
    );
    expect(notActive.label).toBe('✓ Sent · Slot 2');
    expect(notActive.description).toMatch(/; not made active\.$/);
    // Once the file names the slot, as after a later pick, the failure no longer stands.
    const nowActive = projectGameSendButton(
      gameModuleStatus({ inspection: { activeSlot: { state: 'present', slot: 2 } } }),
      mine,
      2,
      'clean',
      { kind: 'sent', slot: 2, atMs: sentAt },
      { slot: 2, message: 'locked.', atMs: sentAt },
    );
    expect(nowActive.description).toMatch(/; now active\.$/);
  });

  it('selects the Active slot from the file and enables only slots that hold a plan', () => {
    const present = { state: 'present', routeKey: 'Underworld', biomeKeys: ['F'] } as const;
    const withFile = (activeSlot: GameActiveSlot) =>
      gameModuleStatus({
        inspection: {
          planSlots: planSlots(
            planSlot(2, present),
            planSlot(3, { state: 'unreadable' }),
            planSlot(5, present),
          ),
          activeSlot,
        },
      });
    const plans = (activeSlot: GameActiveSlot, activation?: GameActivationActivity) =>
      projectGamePlans(
        withFile(activeSlot),
        { kind: 'noProject' },
        'clean',
        catalog,
        0,
        activation,
      );

    const selected = plans({ state: 'present', slot: 5 });
    expect(selected?.activeSlot).toEqual({
      label: 'Active slot',
      selected: 5,
      pending: false,
      notice: null,
    });
    expect(selected?.rows.map((row) => row.active)).toEqual([
      { checked: false, intent: null },
      { checked: false, intent: { kind: 'setActiveSlot', slot: 2 } },
      { checked: false, intent: null },
      { checked: false, intent: null },
      { checked: true, intent: { kind: 'setActiveSlot', slot: 5 } },
      { checked: false, intent: null },
    ]);
    // A file naming an empty slot still shows it; the radio stays disabled.
    expect(plans({ state: 'present', slot: 1 })?.rows[0]?.active).toEqual({
      checked: true,
      intent: null,
    });
    for (const file of [{ state: 'missing' }, { state: 'invalid' }] as const) {
      const none = plans(file);
      expect(none?.activeSlot.selected).toBeNull();
      expect(none?.rows.some((row) => row.active.checked)).toBe(false);
    }

    const pending = plans({ state: 'present', slot: 5 }, { kind: 'pending' });
    expect(pending?.activeSlot.pending).toBe(true);
    expect(pending?.rows.every((row) => row.active.intent === null)).toBe(true);
    expect(pending?.activeSlot.selected).toBe(5);

    const failed = plans({ state: 'present', slot: 5 }, { kind: 'failed', message: 'locked.' });
    expect(failed?.activeSlot).toMatchObject({ selected: 5, notice: 'Not made active: locked.' });
    expect(failed?.rows[1]?.active.intent).toEqual({ kind: 'setActiveSlot', slot: 2 });
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

  it('marks the indicator and describes a failed last send', () => {
    expect(projectGameIndicator(snapshotOf(gameModuleStatus()), true)).toEqual({
      state: 'lastSendFailed',
      symbol: '!',
      accessibleName: 'Game — last send failed',
    });
    expect(projectGameIndicator({ status: null, error: null, readAt: 0 }, true).state).toBe(
      'checking',
    );
    const atMs = Date.UTC(2026, 0, 2, 14, 5);
    expect(describeLastSendFailure({ message: 'could not write plan slot.', atMs })).toBe(
      `Last send failed at ${new Date(atMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: could not write plan slot.`,
    );
  });
});
