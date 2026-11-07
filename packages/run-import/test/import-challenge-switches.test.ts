import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import type { RunRecord, RunRecordRoom } from '../src/run-record';
import { describeEntry, fixture, occurrence } from './support/run-import';

/** The record with each listed room's uses raised and its room edited further. */
function withRooms(
  record: RunRecord,
  edits: Readonly<
    Record<
      number,
      {
        readonly uses: Readonly<Record<string, number>>;
        readonly room?: (room: RunRecordRoom) => RunRecordRoom;
      }
    >
  >,
): RunRecord {
  return {
    ...record,
    rooms: record.rooms.map((room, index) => {
      const edit = edits[index];
      if (edit === undefined) return room;
      const uses = { ...room.uses };
      for (const [name, count] of Object.entries(edit.uses)) uses[name] = (uses[name] ?? 0) + count;
      return (edit.room ?? ((same) => same))({ ...room, uses });
    }),
  };
}

const switchLines = (imported: RunImport) =>
  imported.report.entries
    .filter((entry) => entry.area === 'challengeSwitch')
    .map(
      (entry) =>
        `${describeEntry(entry)}${
          entry.alternatives === undefined
            ? ''
            : ` | ${entry.alternatives
                .map((command) =>
                  command.kind === 'ReplaceChallengeSwitchOutcome' ? command.outcome : 'unpressed',
                )
                .join(' ')}`
        }`,
    );

const switchActions = (imported: RunImport, occurrenceId: string) =>
  occurrence(imported.project, occurrenceId).roomActions.order.filter(
    (reference) =>
      reference.kind === 'interactChallengeSwitch' ||
      (reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'challengeSwitch'),
  );

describe('run import of used challenge switches', () => {
  const PRESS = 8;
  const POM = 21;
  const ELITE = 37;
  const EARLY = 3;
  let imported: RunImport;
  beforeAll(() => {
    const record = fixture('underworld');
    imported = projectFromRunRecord(
      catalog,
      withRooms(record, {
        // Biome depth 4: the engine refuses a switch before depth five.
        [EARLY]: { uses: { TimeChallengeSwitch_Money: 1 } },
        // Two presses and no claim the record can show.
        [PRESS]: { uses: { TimeChallengeSwitch_Money: 2 } },
        // A hitless Pom whose level the next entry save holds.
        [POM]: {
          uses: { PerfectClearChallengeSwitch_Pom: 2, StackUpgrade: 1 },
          room: (room) => ({
            ...room,
            traitScreens: [
              ...room.traitScreens,
              {
                giver: 'StackUpgrade',
                options: [
                  { name: 'HeraSpecialBoon', rarity: 'Heroic', chosen: false },
                  { name: 'AresCastBoon', rarity: 'Epic', chosen: false },
                  { name: 'AphroditeManaBoon', rarity: 'Common', chosen: true },
                ],
              },
            ],
            traits: {
              ...room.traits,
              upgraded: [
                {
                  name: 'AphroditeManaBoon',
                  from: { rarity: 'Common', level: 4 },
                  to: { rarity: 'Common', level: 5 },
                  worldTime: 530,
                },
              ],
            },
          }),
        },
        [POM + 1]: {
          uses: {},
          room: (room) => ({
            ...room,
            entry: {
              ...room.entry,
              traits: { ...room.entry?.traits, AphroditeManaBoon: { rarity: 'Common', level: 5 } },
            },
          }),
        },
        [ELITE]: { uses: { EliteChallengeSwitch_MaxMana: 3, MaxManaDrop: 1 } },
      }),
    );
  });

  it('reports a switch the engine refuses at its room', () => {
    expect(occurrence(imported.project, 'F-r3').challengeSwitch).toBeUndefined();
    expect(switchLines(imported)).toContain(
      'refused challengeSwitch r3 roomFeature@F-r3 -> ReplaceChallengeSwitch(F-r3)',
    );
  });

  it('chooses an unclaimed press by its next entry save and names the fits it cannot tell apart', () => {
    expect(occurrence(imported.project, 'F-r8').challengeSwitch).toEqual({
      variantKey: 'TimeChallengeSwitch_Money',
      outcome: 'left',
      nectarDropped: false,
    });
    expect(switchActions(imported, 'F-r8')).toEqual([{ kind: 'interactChallengeSwitch' }]);
    // Leaving mid-fight leaves the room: the press is its last action.
    expect(occurrence(imported.project, 'F-r8').roomActions.order.at(-1)).toEqual({
      kind: 'interactChallengeSwitch',
    });
    // A finished Time fight gushes gold no save holds; a refused press starts nothing.
    expect(switchLines(imported)).toContain(
      'notInRecord challengeSwitch r8 roomFeature@F-r8 -> ReplaceChallengeSwitchOutcome(F-r8) | finished unpressed',
    );
  });

  it("claims a hitless Perfect Clear's Pom on the trait the record levelled", () => {
    expect(occurrence(imported.project, 'G-r21').challengeSwitch).toEqual({
      variantKey: 'PerfectClearChallengeSwitch_Pom',
      outcome: 'hitless',
      nectarDropped: false,
    });
    expect(switchActions(imported, 'G-r21')).toEqual([
      { kind: 'interactChallengeSwitch' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'reward' },
    ]);
    const claim = occurrence(imported.project, 'G-r21').acquisitionSites?.['challengeSwitch']
      ?.pickupEntries?.['reward'];
    expect(claim?.levelResolutionsByAcquisitionRole?.['self']).toMatchObject({
      selectedTraitKey: 'AphroditeManaBoon',
    });
    expect(imported.report.rooms![POM]).toMatchObject({ verdict: 'accepted', introduced: [] });
  });

  it("claims a finished Elite's Max Magick from its leftover pickup", () => {
    expect(occurrence(imported.project, 'I-r37').challengeSwitch).toEqual({
      variantKey: 'EliteChallengeSwitch_MaxMana',
      outcome: 'finished',
      nectarDropped: false,
    });
    expect(switchActions(imported, 'I-r37')).toEqual([
      { kind: 'interactChallengeSwitch' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'reward' },
    ]);
    expect(imported.report.rooms![ELITE]).toMatchObject({ verdict: 'accepted', introduced: [] });
  });

  it('reports only the refused switch and the unclaimed press', () => {
    expect(switchLines(imported)).toHaveLength(2);
    expect(imported.kind).toBe('complete');
  });
});

describe('run import of a claimed Time switch and a hit Perfect Clear', () => {
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(
      catalog,
      withRooms(fixture('underworld'), {
        // The bonus Nectar drops only at a claim, so it pins a finished fight.
        10: { uses: { TimeChallengeSwitch_Money: 2, GiftDrop: 1 } },
        // The Onion is a Perfect Clear's claim once hit.
        21: { uses: { PerfectClearChallengeSwitch_MaxHealth: 2, RoomRewardConsolationPrize: 1 } },
      }),
    );
  });

  it("claims a finished Time switch, whose gold the plan leaves to the engine's estimate", () => {
    expect(occurrence(imported.project, 'F-r10').challengeSwitch).toEqual({
      variantKey: 'TimeChallengeSwitch_Money',
      outcome: 'finished',
      nectarDropped: true,
    });
    expect(switchActions(imported, 'F-r10')).toEqual([
      { kind: 'interactChallengeSwitch' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'reward' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'nectar' },
    ]);
    expect(switchLines(imported)).toEqual([]);
    expect(imported.report.rooms![10]).toMatchObject({ verdict: 'accepted', introduced: [] });
  });

  it('claims the Onion of a hit Perfect Clear', () => {
    expect(occurrence(imported.project, 'G-r21').challengeSwitch).toEqual({
      variantKey: 'PerfectClearChallengeSwitch_MaxHealth',
      outcome: 'failed',
      nectarDropped: false,
    });
    expect(switchActions(imported, 'G-r21')).toEqual([
      { kind: 'interactChallengeSwitch' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'reward' },
    ]);
    expect(imported.report.rooms![21]).toMatchObject({ verdict: 'accepted', introduced: [] });
  });
});

describe('run import of a switch in a Fields room', () => {
  const FIELDS = 26;

  /** The Underworld capture through the room after the Fields room, whose entry save judges it. */
  function throughFields(): RunRecord {
    const record = fixture('underworld');
    return { ...record, rooms: record.rooms.slice(0, FIELDS + 2) };
  }

  it("claims an Infernal Trove after the cages and leaves its Nectar out of the room's optional rewards", () => {
    const base = projectFromRunRecord(catalog, throughFields());
    // Fields' own floor admits a switch at H_Combat15, biome depth two.
    const imported = projectFromRunRecord(
      catalog,
      withRooms(throughFields(), {
        [FIELDS]: { uses: { TimeChallengeSwitch_Money: 2, GiftDrop: 1 } },
      }),
    );
    expect(occurrence(imported.project, 'H-r26').challengeSwitch).toMatchObject({
      outcome: 'finished',
      nectarDropped: true,
    });
    // The exits, and so the press, wait for the cage loot.
    expect(occurrence(imported.project, 'H-r26').roomActions.order.slice(-3)).toEqual([
      { kind: 'interactChallengeSwitch' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'reward' },
      { kind: 'interactAcquisitionEntry', siteKey: 'challengeSwitch', entryKey: 'nectar' },
    ]);
    const optionals = (project: typeof base.project) => {
      const state = occurrence(project, 'H-r26').state;
      return state.kind === 'fieldsCombat' ? state.optionalRewards : undefined;
    };
    // The Nectar is the claim's, not an optional reward collected in combat.
    expect(optionals(imported.project)).toEqual(optionals(base.project));
    expect(imported.report.rooms![FIELDS]).toMatchObject({ verdict: 'accepted', introduced: [] });
    const roomLines = (report: typeof base.report) =>
      report.entries
        .filter((entry) => entry.record?.roomIndex === FIELDS)
        .map(describeEntry)
        .sort();
    // The switch's outcome follows from the record, so it adds no report line.
    expect(roomLines(imported.report)).toEqual(roomLines(base.report));
  });
});
