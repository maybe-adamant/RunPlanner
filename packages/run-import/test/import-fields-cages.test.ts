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
   * replacement Magick up; its untaken door's cages are unattributed. F_Combat22's
   * Nectar then stays, raising its one boon a level.
   */
  function fieldsArtificer(): RunRecord {
    const record = fixture('underworld-1010');
    const NECTAR = 3;
    const rooms = record.rooms.slice(0, FIELDS + 2).map((room, index) => {
      if (index === NECTAR) {
        const { conversions: _moved, ...rest } = room;
        void _moved;
        const worldTime = room.traits.acquired[0]!.worldTime;
        return {
          ...rest,
          uses: { ErebusExitDoor: 1, GiftDrop: 1 },
          traits: {
            acquired: [],
            removed: [],
            upgraded: [
              {
                name: 'FocusLightningBoon',
                from: { rarity: 'Rare' },
                to: { rarity: 'Rare', level: 2 },
                ...(worldTime === undefined ? {} : { worldTime }),
              },
            ],
          },
        };
      }
      if (index === NECTAR + 1) {
        const entry = room.entry!;
        return {
          ...room,
          traits: {
            ...room.traits,
            upgraded: room.traits.upgraded.map((upgrade) =>
              upgrade.name === 'FocusLightningBoon'
                ? {
                    ...upgrade,
                    from: { rarity: 'Rare', level: 2 },
                    to: { rarity: 'Rare', level: 3 },
                  }
                : upgrade,
            ),
          },
          entry: {
            ...entry,
            traits: { FocusLightningBoon: { rarity: 'Rare', level: 2 } },
          },
        };
      }
      if (index === NECTAR + 2)
        return {
          ...room,
          entry: {
            ...room.entry!,
            traits: { ...room.entry!.traits, FocusLightningBoon: { rarity: 'Rare', level: 3 } },
          },
        };
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
        return { ...last, doors: [] };
      }
      return room;
    });
    // Until the Fields room, the moved use stays unspent and RunProgress keeps the Magick its
    // replacement drew: a refill keeps a leftover.
    const unspent = rooms.map((room, index) => {
      const entry = room.entry;
      if (index <= NECTAR || index > FIELDS || entry === undefined) return room;
      const stores = entry.rewardStores?.['RunProgress'];
      return {
        ...room,
        entry: {
          ...entry,
          ...(entry.metaConversionUses === undefined
            ? {}
            : { metaConversionUses: entry.metaConversionUses - 1 }),
          ...(stores === undefined
            ? {}
            : {
                rewardStores: {
                  ...entry.rewardStores,
                  RunProgress: { ...stores, MaxManaDrop: (stores['MaxManaDrop'] ?? 0) + 1 },
                },
              }),
        },
      };
    });
    return {
      ...record,
      outcome: { kind: 'abandoned', endingRoom: 'H_MiniBoss01' },
      rooms: unspent,
    };
  }
  const FIELDS = 26;

  it("searches a Fields room's Artificer replacement with its untaken door's cages", () => {
    // The window lost two Magick and a Gold beyond the MiniBoss door's boon: the replacement
    // the room's uses name takes one Magick, the untaken cages the rest.
    const converted = projectFromRunRecord(catalog, fieldsArtificer());
    // The run was abandoned in the next room, so the plan ends after the Fields room.
    expect(converted).toMatchObject({
      kind: 'complete',
      report: { end: { cause: 'abandoned', record: { roomIndex: FIELDS } } },
    });
    const fields = occurrence(converted.project, 'H-r26');
    expect(
      fields.state.kind === 'fieldsCombat' &&
        fields.state.optionalRewards['optional2']?.dispositionByAcquisitionRole,
    ).toEqual({ self: { kind: 'artificer' } });
    expect(
      Object.values(fields.acquisitionSites ?? {}).flatMap((site) =>
        Object.values(site.pickupEntries ?? {}).map((entry) => entry?.offer),
      ),
    ).toEqual([{ rewardType: 'MaxManaDrop' }]);
    const untaken = occurrence(converted.project, 'H-r26-d564448').state;
    expect(
      untaken.kind === 'fieldsCombat'
        ? Object.values(untaken.cages)
            .flatMap((cage) => (cage === null ? [] : [cage.offer.rewardType]))
            .sort()
        : [],
    ).toEqual(['MaxManaDrop', 'RoomMoneyDrop']);
    expect(
      converted.report.entries.filter(
        (entry) =>
          entry.record?.roomIndex === FIELDS &&
          (entry.area === 'conversion' || occurrenceOf(entry.address) === 'H-r26-d564448'),
      ),
    ).toEqual([]);
    for (const roomIndex of [3, 4, FIELDS])
      expect(converted.report.rooms![roomIndex]).toMatchObject({
        verdict: 'accepted',
        introduced: [],
      });
  });
});
