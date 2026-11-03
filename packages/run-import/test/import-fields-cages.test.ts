import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import type { RunRecord } from '../src/run-record';
import { fixture, occurrence, occurrenceOf } from './support/run-import';

describe('run import of Fields cages', () => {
  const BRIDGE = 28;
  const UNTAKEN = 'H-r28-d565616';
  let imported: RunImport;

  beforeAll(() => {
    // The Bridge's untaken door as a record shows it when a store refilled: no cages attributed.
    const record = fixture('underworld-1010');
    imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === BRIDGE
          ? {
              ...room,
              doors: room.doors.map((door) => {
                const { cageRewards, ...rest } = door;
                return cageRewards === undefined ? door : rest;
              }),
            }
          : room,
      ),
    });
  });

  it("takes an untaken door's cages the stores lost across its room", () => {
    const state = occurrence(imported.project, UNTAKEN).state;
    expect(
      state.kind === 'fieldsCombat'
        ? Object.values(state.cages)
            .flatMap((cage) => (cage === null ? [] : [cage.offer.rewardType]))
            .sort()
        : [],
    ).toEqual(['HermesUpgrade', 'MaxHealthDrop', 'MaxManaDrop']);
    expect(
      imported.report.entries.filter((entry) => occurrenceOf(entry.address) === UNTAKEN),
    ).toEqual([]);
    const bridge = imported.report.rooms![BRIDGE]!;
    expect(bridge.verdict !== 'unchecked' && bridge.introduced).toEqual([]);
  });

  it('takes the twin door to the entered room whose draws the next entry save accepts', () => {
    // The capture's Bridge offers two doors to H_Combat07 that no saved fact tells apart; only
    // with the second in native order taken can the other's cages be drawn before the refill.
    const capture = projectFromRunRecord(catalog, fixture('underworld'));
    const untaken = occurrence(capture.project, 'H-r28-d565616').state;
    expect(untaken.kind === 'fieldsCombat' && Object.values(untaken.cages).length).toBe(3);
    expect(
      capture.project.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .some((entry) => entry.occurrenceId === 'H-r28-d564300'),
    ).toBe(false);
    expect(capture.report.rooms![BRIDGE]).toMatchObject({ verdict: 'accepted' });
  });

  /**
   * The 1010 capture through its first Fields room, which converts its left-behind
   * Bone optional reward with an Artificer use moved from F_Combat22 and picks the
   * replacement Magick up; its untaken door's cages are unattributed. The next entry
   * save is the capture's with that replacement drawn.
   */
  function fieldsArtificer(): RunRecord {
    const record = fixture('underworld-1010');
    const rooms = record.rooms.slice(0, FIELDS + 2).map((room, index) => {
      if (index === 3) {
        const { conversions: _moved, ...rest } = room;
        void _moved;
        return rest;
      }
      if (index === FIELDS)
        return {
          ...room,
          conversions: { artificer: 1 },
          uses: { ...room.uses, MaxManaDrop: 1 },
          fields: {
            ...room.fields!,
            optionalRewards: room.fields!.optionalRewards.map((entry) =>
              entry.reward === 'MetaCardPointsCommonDrop' ? { ...entry, collected: true } : entry,
            ),
          },
          doors: room.doors.map((door) => ({
            door: door.door,
            room: door.room,
            ...(door.reward === undefined ? {} : { reward: door.reward }),
          })),
        };
      if (index === FIELDS + 1) {
        const { exit: _exit, ...last } = room;
        void _exit;
        const entry = room.entry!;
        const stores = entry.rewardStores!['RunProgress']!;
        return {
          ...last,
          doors: [],
          entry: {
            ...entry,
            rewardStores: {
              ...entry.rewardStores,
              RunProgress: { ...stores, MaxManaDrop: stores['MaxManaDrop']! - 1 },
            },
          },
        };
      }
      return room;
    });
    return { ...record, outcome: { kind: 'abandoned', endingRoom: 'H_MiniBoss01' }, rooms };
  }
  const FIELDS = 26;

  it("stops at F_Combat22's Nectar once its Artificer use moves to the Fields room", () => {
    // The moved use leaves F_Combat22's Nectar unconverted: its random level-up has no rise in
    // the next save, so no answer is accepted and the plan stops before the Fields room.
    const converted = projectFromRunRecord(catalog, fieldsArtificer());
    expect(converted.kind === 'stopped' && converted.stop).toMatchObject({
      code: 'missingPomTarget',
      record: { roomIndex: 3 },
    });
  });
});
