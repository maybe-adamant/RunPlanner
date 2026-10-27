import { readFileSync } from 'node:fs';

import { catalog } from '@run-planner/hades2-catalog';
import { decodeRunRecord } from '@run-planner/engine/run-record';
import type { RunImportReportEntry } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  createTraitOfferAddress,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import {
  appliedValue,
  projectRecentRunsView,
  projectRunGuesses,
  recentRunCopyKey,
  recordingIndicator,
  shownSaveFolder,
} from '@planner/projections/recentRunsHome';
import type { LibraryItem } from '@planner/workspace/projectLibrary';
import type { RecentRunEntry, RecentRunSummary } from '@planner/workspace/run-recording/recentRuns';

const record = decodeRunRecord(
  JSON.parse(
    readFileSync(
      new URL(
        '../../../../packages/planner-engine/test/run-record/fixtures/underworld.run-record.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);

const NOW = Date.UTC(2026, 9, 27, 12);

function summary(values: Partial<RecentRunSummary> = {}): RecentRunSummary {
  return {
    id: 'p2-1793000000-1001',
    profile: 2,
    runCount: 1001,
    attempt: 1,
    startedAt: NOW / 1000 - 3_600,
    outcome: 'death',
    route: { biomes: ['F', 'G'], dream: false, rooms: 18, endingRoom: 'G_Boss01' },
    importKind: 'complete',
    loadout: { weapon: 'WeaponStaffSwing', aspect: 'StaffClearCastAspect' },
    reportCount: 4,
    hasRecord: true,
    gap: false,
    ...values,
  };
}

function item(key: string, projectId: string): LibraryItem {
  return {
    kind: 'ready',
    key,
    folder: '',
    modifiedMs: 0,
    projectId,
    name: 'Renamed',
    routeKey: 'Underworld',
    weaponKey: null,
    aspectKey: null,
    biomeCount: 2,
  };
}

const view = (
  runs: readonly RecentRunSummary[],
  library: { items?: readonly LibraryItem[]; copies?: Record<string, string> } = {},
) =>
  projectRecentRunsView(
    catalog,
    runs,
    { items: library.items ?? [], copies: library.copies ?? {} },
    NOW,
  );

describe('recent runs view', () => {
  it('names each run by profile, run count and attempt, with its route and loadout', () => {
    const [row] = view([summary({ attempt: 2, outcome: 'reset' })]).rows;
    expect(row).toMatchObject({
      identity: 'Profile 2 · Run 1001 · Attempt 2',
      route: 'Erebus › Oceanus',
      routeKey: 'Underworld',
      rooms: '18 rooms',
      loadout: `${catalog.weapons.byKey.WeaponStaffSwing!.label}, ${
        catalog.aspects.byKey.StaffClearCastAspect!.label
      }`,
      outcome: { text: 'Reset', tone: null },
      planName: 'Profile 2 · Run 1001 · Attempt 2 (Reset)',
      guesses: 4,
      marker: null,
      action: { kind: 'add' },
    });
    expect(row!.played.text).toMatch(/^Today, /);
    expect(view([summary()]).context).toEqual([{ text: '1 run', tone: null }]);
  });

  it('words each outcome, with victory as the one good tone', () => {
    const outcomes = view(
      (['victory', 'death', 'reset', 'unfinished'] as const).map((outcome) => summary({ outcome })),
    ).rows.map((row) => [row.outcome.text, row.outcome.tone]);
    expect(outcomes).toEqual([
      ['Victory', 'ok'],
      ['Death', null],
      ['Reset', null],
      ['Unfinished', null],
    ]);
  });

  it('marks a failed, cut or partial run, and offers no addition without a plan', () => {
    const rows = view([
      summary({ failure: 'no entry save' }),
      summary({ gap: true }),
      summary({ importKind: 'stopped' }),
    ]).rows;
    expect(rows.map((row) => [row.marker?.label, row.marker?.hint])).toEqual([
      ['Not imported', 'no entry save'],
      ['Cut', 'A room was missed; the plan ends before it.'],
      ['Partial', 'The plan ends early; see guesses.'],
    ]);
    expect(rows.map((row) => row.action.kind)).toEqual(['none', 'add', 'add']);
  });

  it('offers a rebuild only for a run whose record is stored', () => {
    const rows = view([summary(), summary({ hasRecord: false, failure: 'no entry save' })]).rows;
    expect(rows.map((row) => row.rebuildable)).toEqual([true, false]);
  });

  it('shows a run in the library while the copy it was added as is still there', () => {
    const copies = { [recentRunCopyKey('p2-1793000000-1001')]: 'copy-id' };
    expect(view([summary()], { copies }).rows[0]!.action).toEqual({ kind: 'add' });
    expect(
      view([summary()], { copies, items: [item('Run.runplanner.json', 'copy-id')] }).rows[0]!
        .action,
    ).toEqual({ kind: 'inLibrary', key: 'Run.runplanner.json' });
  });

  it('classifies the route from the catalog route opening on the first biome', () => {
    const routeOf = (route: Partial<RecentRunSummary['route']>) =>
      view([summary({ route: { ...summary().route, ...route } })]).rows[0]!.routeKey;
    expect(routeOf({ biomes: ['N', 'O'] })).toBe('Surface');
    expect(routeOf({ biomes: ['F', 'G'] })).toBe('Underworld');
    expect(routeOf({ biomes: ['F'], dream: true })).toBe(
      catalog.routes.values.find((route) => route.dreamItinerary !== undefined)!.key,
    );
    expect(routeOf({ biomes: ['Z'] })).toBeNull();
  });
});

describe('recording indicator', () => {
  it('says what the watch is doing', () => {
    expect(recordingIndicator({ kind: 'off' })).toEqual({ text: 'Off', tone: null });
    expect(recordingIndicator({ kind: 'watching', folder: '/f' })).toEqual({
      text: 'Waiting for a run',
      tone: 'ok',
    });
    expect(
      recordingIndicator({ kind: 'runOpen', folder: '/f', runs: [{ profile: 2, rooms: 1 }] }),
    ).toEqual({ text: 'Recording profile 2 · 1 room', tone: 'next' });
    expect(recordingIndicator({ kind: 'importing', folder: '/f' }).text).toBe('Importing…');
    expect(recordingIndicator({ kind: 'error', message: 'x' })).toEqual({
      text: 'Stopped',
      tone: 'error',
    });
  });
});

const biome = createBiomeAddress('Underworld', 'F');
const occurrence = createOccurrenceAddress(biome, createOccurrenceId('F-r2'));
const cage = createLocalRewardAddress(biome, createOccurrenceId('H-r29'), 'cage', 'cage1');
const COMMANDS = {
  target: {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, occurrence, 'exit1'),
    occurrenceId: createOccurrenceId('F-r3'),
    gameName: 'F_Combat21',
  },
  acquisition: {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry: createAcquisitionEntryAddress(createAcquisitionSiteAddress(occurrence, 'reward'), 'e1'),
    value: { rewardType: 'StackUpgrade' },
  },
  localReward: {
    kind: 'ReplaceLocalReward',
    reward: cage,
    value: { rewardType: 'MaxManaDrop' },
  },
  traits: {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(cage, 'self'),
    value: {
      kind: 'traits',
      giverKey: 'ZeusUpgrade',
      options: [
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { traitKey: 'ZeusManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option2',
    },
  },
  fallbackGold: {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(cage, 'self'),
    value: { kind: 'fallbackGold', giverKey: 'ZeusUpgrade' },
  },
  other: {
    kind: 'InitializeExitDecision',
    decision: createExitDecisionAddress(biome, occurrence),
    edit: { kind: 'rewardStore', storeKey: 'RunProgress' },
  },
} satisfies Record<string, ProjectCommand>;

describe('applied values', () => {
  it('name the value each typed command chose, by its catalog name', () => {
    const label = (command: ProjectCommand | undefined) => appliedValue(catalog, command);
    expect(label(COMMANDS.target)).toBe(catalog.rooms.byKey.F_Combat21!.label);
    expect(label(COMMANDS.acquisition)).toBe(catalog.rewards.rewardTypes.byKey.StackUpgrade!.label);
    expect(label(COMMANDS.localReward)).toBe(catalog.rewards.rewardTypes.byKey.MaxManaDrop!.label);
    expect(label(COMMANDS.traits)).toBe(catalog.traits.byKey.ZeusManaBoon!.label);
    expect(label(COMMANDS.fallbackGold)).toBeNull();
    expect(label(COMMANDS.other)).toBeNull();
    expect(label(undefined)).toBeNull();
  });
});

describe('run guesses', () => {
  const entry = (entries: readonly RunImportReportEntry[]): RecentRunEntry => ({
    entryVersion: 1,
    id: 'p2-1-1003',
    profile: 2,
    runCount: 1003,
    attempt: 1,
    startedAt: 1,
    outcome: 'victory',
    route: { biomes: ['F'], dream: false, rooms: 6, endingRoom: 'F_Story01' },
    record,
    report: { entries },
  });

  it('collapses value-less assumptions into one line per area and names other guesses', () => {
    const at = (roomIndex: number) => ({ record: { roomIndex, visit: 1 } });
    const groups = projectRunGuesses(
      catalog,
      entry([
        { area: 'doors', reason: 'assumption', ...at(2) },
        { area: 'doors', reason: 'assumption', ...at(3) },
        { area: 'doors', reason: 'assumption', ...at(3) },
        { area: 'roomActionOrder', reason: 'assumption', ...at(4) },
        {
          area: 'conversion',
          reason: 'assumption',
          ...at(2),
          applied: COMMANDS.acquisition,
        },
        {
          area: 'doors',
          reason: 'refused',
          ...at(3),
          applied: COMMANDS.target,
        },
        { area: 'traitOffer', reason: 'notInRecord', ...at(1) },
        { area: 'shop', reason: 'unsupportedArea', ...at(5) },
        { area: 'encounter', reason: 'inverseMismatch', ...at(4) },
        { area: 'route', reason: 'stopped' },
      ]),
    );
    const room = (gameName: string) => catalog.rooms.byKey[gameName]!.label;
    expect(groups.map((group) => [group.label, group.assumed])).toEqual([
      ['Doors', 'Door order assumed in 2 rooms'],
      ['Pickup order', 'Pickup order assumed in 1 room'],
      ['Reward swaps', null],
      ['Boon offers', null],
      ['Shops', null],
      ['Encounters', null],
      ['Route', null],
    ]);
    expect(groups.find((group) => group.area === 'roomActionOrder')!.lines).toEqual([]);
    expect(
      groups.flatMap((group) => group.lines.map((line) => [line.order, line.room, line.text])),
    ).toEqual([
      [4, `Erebus · ${room('F_Combat22')}`, `Replaced ${room('F_Combat21')}`],
      [3, `Erebus · ${room('F_Combat08')}`, 'Assumed Pom of Power'],
      [2, room('Chaos_03'), 'Guessed'],
      [6, `Erebus · ${room('F_Story01')}`, 'Not supported'],
      [5, `Erebus · ${room('F_Combat21')}`, 'Default foes'],
      [null, null, 'Plan ends here'],
    ]);
  });

  it('shows a save folder inside the home folder from the home marker', () => {
    const windowsHome = 'C:\\Users\\Melinoe';
    expect(
      [
        'C:\\Users\\Melinoe\\Saved Games\\Hades II',
        'c:\\users\\MELINOE\\Saved Games\\Hades II',
        'C:/Users/Melinoe/Saved Games/Hades II',
        'C:\\Users\\Melinoe',
        'C:\\Users\\MelinoeOld\\Saved Games',
        'D:\\Games\\Hades II',
      ].map((folder) => shownSaveFolder(folder, windowsHome)),
    ).toEqual([
      '%USERPROFILE%\\Saved Games\\Hades II',
      '%USERPROFILE%\\Saved Games\\Hades II',
      '%USERPROFILE%/Saved Games/Hades II',
      '%USERPROFILE%',
      'C:\\Users\\MelinoeOld\\Saved Games',
      'D:\\Games\\Hades II',
    ]);
    expect(shownSaveFolder('C:\\Users\\Melinoe\\Saves', 'C:\\Users\\Melinoe\\')).toBe(
      '%USERPROFILE%\\Saves',
    );
    expect(
      [
        '/home/melinoe/.local/share/Steam/Hades II',
        '/home/melinoe',
        '/home/Melinoe/.local/share',
        '/home/melinoe-old/saves',
        '/mnt/games/Hades II',
      ].map((folder) => shownSaveFolder(folder, '/home/melinoe/')),
    ).toEqual([
      '~/.local/share/Steam/Hades II',
      '~',
      '/home/Melinoe/.local/share',
      '/home/melinoe-old/saves',
      '/mnt/games/Hades II',
    ]);
    expect(shownSaveFolder('/home/melinoe/saves', null)).toBe('/home/melinoe/saves');
    expect(shownSaveFolder('/saves', '/')).toBe('/saves');
  });
});
