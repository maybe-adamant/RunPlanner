import { describe, expect, it } from 'vitest';

import {
  describePublicationBlocker,
  describeRemoveOutcome,
  projectGameModuleSettings,
  projectGameProfileChoices,
  projectGamePublicationReadiness,
} from '@planner/projections/gameModuleSettings';
import { gameModuleStatus } from '@planner-test/fixtures/gameModuleHost';

type StatusOverrides = NonNullable<Parameters<typeof gameModuleStatus>[0]>;

const moduleOf = (overrides: StatusOverrides) => {
  const module = projectGameModuleSettings(gameModuleStatus(overrides)).module;
  if (module === null) throw new Error('module section is hidden');
  return module;
};
const stepKeys = (overrides: StatusOverrides) => moduleOf(overrides).steps.map((step) => step.key);

describe('game module settings projection', () => {
  it('collapses a ready target to one location line and one Ready status', () => {
    const product = projectGameModuleSettings(gameModuleStatus());
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
    expect(projectGamePublicationReadiness(gameModuleStatus())).toEqual({
      ready: true,
      targetLocation: '/profiles/h2-dev',
      reasons: [],
    });
  });

  it('hides the module section until a target is set and inspected', () => {
    const unset = projectGameModuleSettings(
      gameModuleStatus({
        target: null,
        inspection: null,
        publicationBlockers: [{ code: 'noTarget', found: null, required: null }],
      }),
    );
    expect(unset.location).toMatchObject({ state: 'unset', confirmSwitchAway: false });
    expect(unset.module).toBeNull();
    const unavailable = projectGameModuleSettings(
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
        projectGameModuleSettings(gameModuleStatus({ inspection: { module: { state } } })).location
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
      'Set the game location in Settings.',
      'The game location is unavailable. Change it in Settings.',
      'Install the game module in Settings.',
      'Update the game module in Settings (found 0.10.0).',
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
      projectGameModuleSettings(gameModuleStatus({ inspection })).location.switchAwayRemoval;
    expect(reason({ r2modman: { state: 'managed' }, removable: false })).toEqual({
      available: false,
      reason: 'r2modman manages this module. Remove it in r2modman.',
    });
    expect(reason({ r2modman: { state: 'unreadable' }, removable: false }).reason).toBe(
      'r2modman’s mod list couldn’t be read, so the module was not removed.',
    );
  });
});
