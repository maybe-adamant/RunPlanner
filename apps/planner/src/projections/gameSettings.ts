import type {
  GameModuleStatus,
  GameSettingChange,
  GameSettingOption,
} from '@planner/persistence/gameModuleHost';

export interface GameSettingRow {
  readonly option: GameSettingOption;
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
}

export interface GameSettingsProduct {
  readonly rows: readonly GameSettingRow[];
}

// In the game window's order and wording.
const OPTIONS: readonly Omit<GameSettingRow, 'enabled'>[] = [
  {
    option: 'showRoomGuide',
    label: 'Show room guide',
    description: 'Planned steps for the current room, on the HUD.',
  },
  {
    option: 'highlightPlannedChoices',
    label: 'Highlight planned choices',
    description: 'Marks the planned door, boon or item.',
  },
  {
    option: 'snapMode',
    label: 'Snap back to the plan',
    description: 'After the run goes off plan, the next door brings it back.',
  },
];

/**
 * The game module options as `settings.json` holds them, or the earlier ModpackLib ticks while
 * it is missing, every option off otherwise, as the module reads it. Null while no game
 * location's files can be read.
 */
export function projectGameSettings(status: GameModuleStatus | null): GameSettingsProduct | null {
  const file = status?.inspection?.settings;
  if (file === undefined) return null;
  return {
    rows: OPTIONS.map((row) => ({
      ...row,
      enabled: file.state === 'present' && file.settings[row.option],
    })),
  };
}

/** Why an option change was not saved, or null when it was. */
export function describeGameSettingChange(change: GameSettingChange): string | null {
  switch (change.status) {
    case 'saved':
      return null;
    case 'blocked':
      return 'Set the game location first.';
    case 'nativeWrite':
      return `Couldn’t save the option: ${change.message}`;
  }
}
