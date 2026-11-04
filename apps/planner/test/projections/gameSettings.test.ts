import { describe, expect, it } from 'vitest';

import { describeGameSettingChange, projectGameSettings } from '@planner/projections/gameSettings';
import { gameModuleStatus } from '@planner-test/fixtures/gameModuleHost';

const enabledOptions = (status: Parameters<typeof projectGameSettings>[0]) =>
  projectGameSettings(status)
    ?.rows.filter((row) => row.enabled)
    .map((row) => row.option);

describe('Game settings projection', () => {
  it('lists the three options in the game window’s order as the file holds them', () => {
    const status = gameModuleStatus({
      inspection: {
        settings: {
          state: 'present',
          settings: { showRoomGuide: true, highlightPlannedChoices: false, snapMode: true },
        },
      },
    });
    expect(projectGameSettings(status)?.rows.map((row) => row.option)).toEqual([
      'showRoomGuide',
      'highlightPlannedChoices',
      'snapMode',
    ]);
    expect(enabledOptions(status)).toEqual(['showRoomGuide', 'snapMode']);
  });

  it('shows every option off for a missing or invalid file, as the module reads it', () => {
    for (const settings of [{ state: 'missing' }, { state: 'invalid' }] as const) {
      expect(enabledOptions(gameModuleStatus({ inspection: { settings } }))).toEqual([]);
    }
  });

  it('has no options while no game location can be read', () => {
    expect(projectGameSettings(null)).toBeNull();
    expect(projectGameSettings(gameModuleStatus({ target: null, inspection: null }))).toBeNull();
  });

  it('describes only a change that was not saved', () => {
    expect(
      describeGameSettingChange({ status: 'saved', message: 'Saved.', blockers: [] }),
    ).toBeNull();
    expect(
      describeGameSettingChange({
        status: 'blocked',
        message: 'The game target is not available.',
        blockers: [{ code: 'noTarget', found: null, required: null }],
      }),
    ).toBe('Set the game location first.');
    expect(
      describeGameSettingChange({ status: 'nativeWrite', message: 'denied', blockers: [] }),
    ).toBe('Couldn’t save the option: denied');
  });
});
