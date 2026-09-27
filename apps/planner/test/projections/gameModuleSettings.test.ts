import { describe, expect, it } from 'vitest';

import {
  describePublicationBlocker,
  describeRemoveOutcome,
  projectGameModuleSettings,
  projectGamePublicationReadiness,
} from '@planner/projections/gameModuleSettings';
import { gameModuleStatus } from '@planner-test/fixtures/gameModuleHost';

const rowValues = (status: Parameters<typeof projectGameModuleSettings>[0]) =>
  Object.fromEntries(projectGameModuleSettings(status).rows.map((row) => [row.key, row.value]));

describe('game module settings projection', () => {
  it('presents a matching planner install on an r2modman profile', () => {
    const product = projectGameModuleSettings(gameModuleStatus());
    expect(product.target).toEqual({ location: '/profiles/h2-dev', kindLabel: 'r2modman profile' });
    expect(product.rows.map((row) => [row.key, row.value, row.tone])).toEqual([
      ['module', 'Installed 0.1.0 · this planner 0.1.0', 'ok'],
      ['modpackLib', 'Found 4.1.0 · requires 4.1.0 or newer 4.x', 'ok'],
      ['r2modman', 'Does not manage the game module', 'ok'],
      ['dependencies', 'All found', 'ok'],
    ]);
    expect(product.notices).toEqual([]);
    expect(product.remove).toEqual({ available: true, unavailableReason: null });
    expect(product.install.consentRequired).toBe(false);
    expect(projectGamePublicationReadiness(gameModuleStatus())).toEqual({
      ready: true,
      targetLocation: '/profiles/h2-dev',
      reasons: [],
    });
  });

  it('presents a manual target without mods.yml as not applicable', () => {
    const status = gameModuleStatus({
      target: {
        path: '/games/Hades II/Ship',
        location: '/games/Hades II/Ship',
        label: 'Ship',
        kind: 'manual',
      },
      inspection: {
        r2modman: { state: 'notApplicable' },
        module: { state: 'absent', version: null, source: null, matchesBundled: false },
        install: { action: 'install' },
        removable: false,
      },
      publicationBlockers: [{ code: 'moduleMissing', found: null, required: '0.1.0' }],
    });
    const product = projectGameModuleSettings(status);
    expect(product.target?.kindLabel).toBe('Chosen folder');
    expect(rowValues(status)).toMatchObject({
      module: 'Not installed · this planner 0.1.0',
      r2modman: 'Not applicable (no mods.yml)',
    });
    expect(product.remove.unavailableReason).toBe('The game module is not installed.');
    expect(projectGamePublicationReadiness(status).reasons).toEqual([
      'The Run Planner game module is not installed (this planner needs 0.1.0). Install it in Settings.',
    ]);

    const installed = gameModuleStatus({
      target: status.target,
      inspection: { r2modman: { state: 'notApplicable' } },
    });
    expect(projectGameModuleSettings(installed).remove.available).toBe(true);
    expect(projectGamePublicationReadiness(installed)).toEqual({
      ready: true,
      targetLocation: '/games/Hades II/Ship',
      reasons: [],
    });
  });

  it('presents an r2modman-managed Thunderstore copy with consent facts and notices', () => {
    const status = gameModuleStatus({
      inspection: {
        module: { state: 'unrecognized', version: '0.10.0', source: null, matchesBundled: false },
        r2modman: { state: 'managed', moduleEnabled: true },
        coordinator: { present: true, managed: true },
        install: { action: 'update', consentRequired: true },
        removable: false,
      },
    });
    const product = projectGameModuleSettings(status);
    expect(rowValues(status)).toMatchObject({
      module: 'Found 0.10.0, not installed by the planner · this planner 0.1.0',
      r2modman: 'Manages the game module',
    });
    expect(product.install.consentRequired).toBe(true);
    expect(product.install.consentFacts[0]).toBe(
      'An existing Run Planner folder (0.10.0) will be replaced.',
    );
    expect(product.install.consentFacts[1]).toContain('renames or deletes the planner’s files');
    expect(product.notices.map((notice) => notice.key)).toEqual(['r2modmanManaged', 'coordinator']);
    expect(product.remove.unavailableReason).toBe(
      'This module was not installed by the planner. Remove it with your mod manager.',
    );
  });

  it('presents ModpackLib states and missing dependencies with the r2modman instruction', () => {
    for (const [state, found, value] of [
      ['missing', null, 'Not found · requires 4.1.0 or newer 4.x'],
      ['older', '4.0.1', 'Found 4.0.1 · requires 4.1.0 or newer 4.x'],
      ['incompatibleMajor', '5.0.0', 'Found 5.0.0 · requires 4.1.0 or newer 4.x'],
      ['unreadable', null, 'Found, unreadable · requires 4.1.0 or newer 4.x'],
    ] as const) {
      const status = gameModuleStatus({
        inspection: {
          modpackLib: { state, found },
          missingDependencies: [{ name: 'LuaENVY-ENVY', version: '1.2.0' }],
        },
      });
      const product = projectGameModuleSettings(status);
      expect(rowValues(status)).toMatchObject({
        modpackLib: value,
        dependencies: 'Missing: LuaENVY-ENVY 1.2.0',
      });
      expect(product.notices[0]?.text).toContain('Install or update ModpackLib in r2modman');
    }
  });

  it('describes each publication blocker with its found and required values', () => {
    expect(
      [
        { code: 'noTarget', found: null, required: null },
        { code: 'targetUnavailable', found: null, required: null },
        { code: 'moduleMismatch', found: '0.10.0', required: '0.1.0' },
        { code: 'modpackLibMissing', found: null, required: '4.1.0' },
        { code: 'modpackLibUnreadable', found: null, required: '4.1.0' },
        { code: 'modpackLibIncompatibleMajor', found: '5.0.0', required: '4.1.0' },
      ].map((blocker) =>
        describePublicationBlocker(blocker as Parameters<typeof describePublicationBlocker>[0]),
      ),
    ).toEqual([
      'No game target is set. Locate the game module in Settings.',
      'The game target is unavailable. Locate it again in Settings.',
      'The installed game module (0.10.0) does not match this planner (0.1.0). Update it in Settings.',
      'ModpackLib is not installed (requires 4.1.0 or newer 4.x). Install ModpackLib in r2modman.',
      'ModpackLib could not be read (requires 4.1.0 or newer 4.x). Reinstall or enable ModpackLib in r2modman.',
      'ModpackLib 5.0.0 is not compatible (requires 4.1.0 or newer 4.x). Install a compatible ModpackLib in r2modman.',
    ]);
  });

  it('presents an unavailable target without inspection rows or actions', () => {
    const status = gameModuleStatus({
      inspection: null,
      targetProblem: 'That folder is unavailable.',
      publicationBlockers: [{ code: 'targetUnavailable', found: null, required: null }],
    });
    const product = projectGameModuleSettings(status);
    expect(product.rows).toEqual([]);
    expect(product.targetProblem).toBe('That folder is unavailable.');
    expect(product.install.available).toBe(false);
    expect(product.remove.available).toBe(false);
    expect(projectGamePublicationReadiness(status).ready).toBe(false);
  });
  it('presents an unreadable mod list distinctly from r2modman management', () => {
    const status = gameModuleStatus({
      inspection: {
        r2modman: { state: 'unreadable' },
        install: { action: 'update', consentRequired: true },
        removable: false,
      },
    });
    const product = projectGameModuleSettings(status);
    expect(rowValues(status).r2modman).toBe('r2modman’s mod list couldn’t be read');
    expect(product.install.consentFacts).toContain(
      'r2modman’s mod list couldn’t be read, so r2modman may manage this folder.',
    );
    expect(product.notices.map((notice) => notice.key)).not.toContain('r2modmanManaged');
    expect(product.remove.unavailableReason).toBe(
      'r2modman’s mod list couldn’t be read, so the planner cannot confirm r2modman does not manage this module.',
    );
    expect(describeRemoveOutcome('r2modmanUnreadable')).toBe(
      'r2modman’s mod list couldn’t be read, so the module was not removed.',
    );
    expect(describeRemoveOutcome('managedByR2modman')).toBe(
      'r2modman manages this module. Remove it in r2modman.',
    );
  });

  it('gives each unavailable removal its own reason', () => {
    const reason = (
      inspection: NonNullable<NonNullable<Parameters<typeof gameModuleStatus>[0]>['inspection']>,
    ) => projectGameModuleSettings(gameModuleStatus({ inspection })).remove.unavailableReason;
    expect(reason({})).toBeNull();
    expect(
      reason({ module: { state: 'absent', version: null, source: null }, removable: false }),
    ).toBe('The game module is not installed.');
    expect(reason({ module: { state: 'unrecognized' }, removable: false })).toBe(
      'This module was not installed by the planner. Remove it with your mod manager.',
    );
    expect(reason({ r2modman: { state: 'managed' }, removable: false })).toBe(
      'r2modman manages this module. Remove it in r2modman.',
    );
  });

  it('presents a checkout install by the host publishability and flags modified files', () => {
    const checkout = gameModuleStatus({
      inspection: { module: { source: 'checkout', matchesBundled: false } },
    });
    expect(projectGameModuleSettings(checkout).rows[0]).toEqual({
      key: 'module',
      label: 'Game module',
      value: 'Installed 0.1.0 from this checkout · this planner 0.1.0',
      tone: 'ok',
    });
    const modified = gameModuleStatus({
      inspection: { module: { source: 'checkout', matchesBundled: false, modified: true } },
      publicationBlockers: [{ code: 'moduleMismatch', found: '0.1.0', required: '0.1.0' }],
    });
    const product = projectGameModuleSettings(modified);
    expect(product.rows[0]?.value).toBe(
      'Installed 0.1.0 from this checkout (modified) · this planner 0.1.0',
    );
    expect(product.rows[0]?.tone).toBe('warning');
    expect(product.notices.map((notice) => notice.key)).toEqual(['modified']);
  });

  it('reports a stranded previous install after a failed restore', () => {
    const status = gameModuleStatus({
      inspection: {
        module: { state: 'absent', version: null, source: null, matchesBundled: false },
        strandedInstall: '.run-planner-replaced-01-2-3',
      },
    });
    expect(projectGameModuleSettings(status).notices).toContainEqual({
      key: 'strandedInstall',
      tone: 'error',
      text: 'A failed update left the previous game module at ReturnOfModding/.run-planner-replaced-01-2-3. Install / Update Game Module again; the planner backs it up before cleaning it away.',
    });
  });
});
