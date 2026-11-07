import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import type {
  RoomDeclaration,
  RoomMapPoints,
  RoomOrientation,
} from '@run-planner/engine/catalog-schema';

import { cloneCatalogInput } from './support/catalog-input';

function mapPoints(room: RoomDeclaration): RoomMapPoints {
  if (room.mapPoints === undefined) throw new Error(`${room.gameName} has no map points`);
  return room.mapPoints;
}

function orientation(room: RoomDeclaration): RoomOrientation {
  if (room.orientation === undefined) throw new Error(`${room.gameName} has no orientation`);
  return room.orientation;
}

const room = (gameName: string) => catalog.rooms.byKey[gameName]!;
const doorDirections = (gameName: string) =>
  Object.fromEntries(mapPoints(room(gameName)).exitDoors.map((d) => [d.id, d.exitDirection]));
const biome = (gameName: string) => gameName.slice(0, gameName.indexOf('_'));

describe('room orientation', () => {
  it('gives every declared room frozen orientation facts', () => {
    for (const declared of catalog.rooms.values) {
      expect(Object.isFrozen(orientation(declared))).toBe(true);
      expect(Object.isFrozen(mapPoints(declared).entryPairs)).toBe(true);
    }
  });

  it('counts each biome by entrance side and flip chance', () => {
    const summary: Record<string, Record<string, number>> = {};
    for (const declared of catalog.rooms.values) {
      const facts = orientation(declared);
      const kind = `${facts.entranceDirection ?? 'none'} ${facts.flipChance ?? 'default'}`;
      const counts = (summary[biome(declared.gameName)] ??= {});
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    expect(summary).toEqual({
      B: { 'none 0': 7 },
      C: { 'LeftRight 0': 1 },
      Chaos: { 'none default': 6 },
      Dream: { 'none 0': 3 },
      F: {
        'Left default': 6,
        'LeftRight 0': 4,
        'LeftRight default': 9,
        'Right 0': 5,
        'Right default': 6,
        'none 0': 2,
        'none default': 3,
      },
      G: { 'none 0': 9, 'none 1': 1, 'none default': 21 },
      H: {
        'Left 0': 2,
        'Left default': 3,
        'LeftRight 0': 3,
        'LeftRight default': 10,
        'Right 0': 3,
        'Right default': 1,
        'none 0': 1,
      },
      I: {
        'Left 0': 3,
        'Left default': 11,
        'LeftRight 0': 4,
        'LeftRight default': 7,
        'Right default': 6,
        'none 0': 1,
      },
      N: {
        'Left 0': 2,
        'Left default': 8,
        'Right 0': 2,
        'Right default': 7,
        'none 0': 27,
        'none 1': 3,
      },
      O: { 'LeftRight 0': 2, 'Right 0': 24 },
      P: { 'Left 0': 5, 'LeftRight 0': 8, 'Right 0': 12, 'none 0': 3 },
      Q: { 'Left default': 5, 'LeftRight 0': 10, 'Right 0': 1, 'Right default': 8 },
    });
  });

  it('resolves the inherited direction flags by room set', () => {
    for (const declared of catalog.rooms.values) {
      const facts = orientation(declared);
      const set = biome(declared.gameName);
      expect([declared.gameName, facts.cardinalEntrance]).toEqual([declared.gameName, set === 'B']);
      expect([declared.gameName, facts.strictLeftRight]).toEqual([
        declared.gameName,
        set === 'N' && !declared.gameName.startsWith('N_Sub'),
      ]);
      expect([declared.gameName, facts.ignoresExitDirection]).toEqual([
        declared.gameName,
        set === 'Chaos' || declared.gameName.startsWith('Dream_PostBoss'),
      ]);
    }
  });

  it('matches the offline orientation table', () => {
    expect(orientation(room('F_Combat21'))).toEqual({
      entranceDirection: 'Right',
      ignoresExitDirection: false,
      cardinalEntrance: false,
      strictLeftRight: false,
    });
    expect(doorDirections('F_Combat21')).toEqual({ 699394: 'Left', 561392: 'Right' });
    expect(orientation(room('F_Combat01'))).toMatchObject({
      entranceDirection: 'Right',
      flipChance: 0,
    });
    expect(doorDirections('G_Combat02')).toEqual({
      558526: 'Right',
      558528: 'Left',
      568576: 'Left',
    });
    for (const declared of catalog.rooms.values.filter((r) => biome(r.gameName) === 'O'))
      expect([declared.gameName, orientation(declared).flipChance]).toEqual([declared.gameName, 0]);
  });

  it('names Anomaly door exits on the compass', () => {
    expect(doorDirections('B_Combat01')).toEqual({ 548038: 'West' });
    expect(doorDirections('B_Combat05')).toEqual({ 554466: 'North' });
  });

  it('leaves door exits unnamed only in the rooms without a HeroExit', () => {
    const withoutHeroExit = catalog.rooms.values
      .filter((r) => mapPoints(r).exitDoors.length > 0 && mapPoints(r).heroExits.length === 0)
      .map((r) => r.gameName)
      .sort();
    expect(withoutHeroExit).toEqual([
      'Chaos_06',
      'G_Combat12',
      'G_Combat13',
      'G_Combat14',
      'G_Intro',
      'G_PostBoss01',
      'H_PostBoss01',
    ]);
    for (const declared of catalog.rooms.values)
      for (const door of mapPoints(declared).exitDoors)
        expect([declared.gameName, door.id, door.exitDirection === undefined]).toEqual([
          declared.gameName,
          door.id,
          withoutHeroExit.includes(declared.gameName),
        ]);
  });

  it('pairs entries exactly as the declared Fields entry pairs', () => {
    const pairs = (values: readonly { startPointId: number; endPointId: number }[]) =>
      values.map((pair) => `${pair.startPointId}>${pair.endPointId}`).sort();
    const fieldsRooms = catalog.rooms.values.filter((r) => r.fieldsSpatial !== undefined);
    expect(fieldsRooms).toHaveLength(15);
    for (const declared of fieldsRooms)
      expect([declared.gameName, pairs(mapPoints(declared).entryPairs)]).toEqual([
        declared.gameName,
        pairs(declared.fieldsSpatial!.entryPairs),
      ]);
  });

  it('names every entry pair outside StrictLeftRight rooms', () => {
    for (const declared of catalog.rooms.values) {
      if (orientation(declared).strictLeftRight) continue;
      for (const pair of mapPoints(declared).entryPairs)
        expect([declared.gameName, pair.startPointId, pair.direction]).not.toContain(undefined);
    }
    expect(mapPoints(room('H_Combat02')).entryPairs).toEqual([
      { startPointId: 565481, endPointId: 565479, direction: 'Right' },
      { startPointId: 622320, endPointId: 622321, direction: 'Left' },
    ]);
  });

  it('forces the Ephyra Hub entry and the returns into it', () => {
    const hub = mapPoints(room('N_Hub'));
    expect(orientation(room('N_Hub')).entry).toEqual({ startPointId: 50065, endPointId: 50059 });
    const hubStarts = new Set(hub.heroStarts.map((point) => point.id));
    const hubEnds = new Set(hub.heroEnds.map((point) => point.id));
    const returns = catalog.rooms.values.flatMap((declared) =>
      (orientation(declared).nextRoomEntries ?? []).map((entry) => ({
        gameName: declared.gameName,
        entry,
        door: mapPoints(declared).exitDoors.some((d) => d.obstacleName === entry.obstacleName),
      })),
    );
    expect(returns).toHaveLength(28);
    for (const { gameName, entry, door } of returns) {
      expect([gameName, entry.obstacleName]).toEqual([
        gameName,
        expect.stringMatching(/^EphyraExitDoorReturn(NE)?$/),
      ]);
      expect([gameName, hubEnds.has(entry.endPointId)]).toEqual([gameName, true]);
      // Source quirks: N_MiniBoss02 returns onto a Hub exit door; N_PreHub01 has no return door.
      if (gameName !== 'N_MiniBoss02')
        expect([gameName, hubStarts.has(entry.startPointId)]).toEqual([gameName, true]);
      if (gameName !== 'N_PreHub01') expect([gameName, door]).toEqual([gameName, true]);
    }
    expect(hub.exitDoors.map((d) => d.id)).toContain(560889);
  });

  it.each([
    [
      'an undeclared room',
      (input: Record<string, RoomOrientation>) => {
        input.X_Missing01 = input.F_Combat02!;
      },
      /roomOrientations\.X_Missing01: is not a declared room/,
    ],
    [
      'an unknown entrance side',
      (input: Record<string, RoomOrientation>) => {
        (input.F_Combat02 as { entranceDirection: unknown }).entranceDirection = 'North';
      },
      /roomOrientations\.F_Combat02\.entranceDirection/,
    ],
    [
      'a flip chance above 1',
      (input: Record<string, RoomOrientation>) => {
        (input.F_Combat02 as { flipChance: unknown }).flipChance = 2;
      },
      /roomOrientations\.F_Combat02\.flipChance/,
    ],
    [
      'a compass direction outside cardinal rooms',
      (input: Record<string, RoomOrientation>) => {
        (input.B_Combat01 as { cardinalEntrance: unknown }).cardinalEntrance = false;
      },
      /roomOrientations\.B_Combat01\.exitDoors\[0\]\.exitDirection/,
    ],
    [
      'an entry off the room HeroStarts',
      (input: Record<string, RoomOrientation>) => {
        (input.N_Hub as { entry: unknown }).entry = { startPointId: 1, endPointId: 50059 };
      },
      /roomOrientations\.N_Hub\.entry\.startPointId/,
    ],
  ])('rejects %s', (_label, change, message) => {
    const input = cloneCatalogInput();
    change(input.roomOrientations as Record<string, RoomOrientation>);
    expect(() => createCatalog(input)).toThrow(message);
  });

  it.each([
    [
      'an entry pair out of HeroStart order',
      (input: Record<string, RoomMapPoints>) => {
        const points = input.H_Combat02!;
        (points as { entryPairs: unknown }).entryPairs = [...points.entryPairs].reverse();
      },
      /roomMapPoints\.H_Combat02\.entryPairs\[0\]\.startPointId/,
    ],
    [
      'an entry pair ending off the HeroEnds',
      (input: Record<string, RoomMapPoints>) => {
        (input.F_Combat21!.entryPairs[0] as { endPointId: unknown }).endPointId = 1;
      },
      /roomMapPoints\.F_Combat21\.entryPairs\[0\]\.endPointId/,
    ],
    [
      'a door exit off the HeroExits',
      (input: Record<string, RoomMapPoints>) => {
        (input.F_Combat21!.exitDoors[0] as { heroExitId: unknown }).heroExitId = 1;
      },
      /roomMapPoints\.F_Combat21\.exitDoors\[0\]\.heroExitId/,
    ],
    [
      'a door exit without its direction',
      (input: Record<string, RoomMapPoints>) => {
        delete (input.F_Combat21!.exitDoors[0] as { exitDirection?: unknown }).exitDirection;
      },
      /roomMapPoints\.F_Combat21\.exitDoors\[0\]\.exitDirection/,
    ],
  ])('rejects %s', (_label, change, message) => {
    const input = cloneCatalogInput();
    change(input.roomMapPoints as Record<string, RoomMapPoints>);
    expect(() => createCatalog(input)).toThrow(message);
  });
});
