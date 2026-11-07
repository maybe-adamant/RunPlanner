import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration, RoomMapPoints } from '@run-planner/engine/catalog-schema';

import { cloneCatalogInput } from './support/catalog-input';

const ids = (points: readonly { readonly id: number }[] | undefined) =>
  (points ?? []).map((point) => point.id);
const ascending = (values: readonly number[]) => [...values].sort((left, right) => left - right);

function mapPoints(room: RoomDeclaration): RoomMapPoints {
  if (room.mapPoints === undefined) throw new Error(`${room.gameName} has no map points`);
  return room.mapPoints;
}

describe('room map points', () => {
  it('gives every declared room its frozen map points', () => {
    for (const room of catalog.rooms.values) {
      const points = mapPoints(room);
      expect(Object.isFrozen(points)).toBe(true);
      expect(Object.isFrozen(points.exitDoors)).toBe(true);
    }
    expect(catalog.rooms.byKey.F_Combat02?.mapPoints?.exitDoors).toEqual([
      {
        id: 560571,
        obstacleName: 'ErebusExitDoor',
        x: 8154.65,
        y: 8532.48,
        heroExitId: 510217,
        exitDirection: 'Right',
      },
      {
        id: 560574,
        obstacleName: 'ErebusExitDoor',
        x: 8749.16,
        y: 8777.07,
        heroExitId: 560575,
        exitDirection: 'Right',
      },
    ]);
  });

  it('places exactly the declared door-setup doors', () => {
    for (const room of catalog.rooms.values) {
      if (room.exitDoorSetupOrder === undefined) continue;
      const declared = room.exitDoorSetupOrder.map((door) => `${door.doorId} ${door.obstacleName}`);
      const placed = mapPoints(room).exitDoors.map((door) => `${door.id} ${door.obstacleName}`);
      expect([room.gameName, placed.sort()]).toEqual([room.gameName, declared.sort()]);
    }
  });

  it('places one door per exit in the rooms without a declared setup order', () => {
    for (const gameName of [
      'P_Combat01',
      'P_Combat05',
      'P_Combat06',
      'P_Combat16',
      'P_Combat17',
      'P_Shop01',
    ]) {
      const room = catalog.rooms.byKey[gameName]!;
      expect([gameName, mapPoints(room).exitDoors.length]).toEqual([gameName, room.exits.length]);
    }
  });

  it('matches the declared secret point and challenge switch anchor counts', () => {
    for (const room of catalog.rooms.values) {
      const points = mapPoints(room);
      if (room.secretPointAnchorCount !== undefined)
        expect([room.gameName, points.secretPoints.length]).toEqual([
          room.gameName,
          room.secretPointAnchorCount,
        ]);
      if (room.challengeSwitchAnchorCount !== undefined)
        expect([room.gameName, points.challengeSwitchAnchors.length]).toEqual([
          room.gameName,
          room.challengeSwitchAnchorCount,
        ]);
    }
  });

  it('places the declared Fields and cocoon points, and only those', () => {
    for (const room of catalog.rooms.values) {
      const points = mapPoints(room);
      const spatial = room.fieldsSpatial;
      expect([room.gameName, ids(points.fieldsCagePoints)]).toEqual([
        room.gameName,
        ascending(spatial?.cagePointIds ?? []),
      ]);
      expect([room.gameName, ids(points.fieldsOptionalPoints)]).toEqual([
        room.gameName,
        ascending(spatial?.optionalPointIds ?? []),
      ]);
      expect((points.fieldsCagePoints === undefined) === (spatial === undefined)).toBe(true);
      for (const pair of spatial?.entryPairs ?? []) {
        expect(ids(points.heroStarts)).toContain(pair.startPointId);
        expect(ids(points.heroEnds)).toContain(pair.endPointId);
      }
      expect([room.gameName, ids(points.cocoonRewardPoints)]).toEqual([
        room.gameName,
        room.cocoonRewardPointIds ?? [],
      ]);
    }
  });

  it('pins the Well in the Postboss rooms that declare its anchor', () => {
    expect(
      Object.fromEntries(
        catalog.rooms.values
          .filter((room) => room.mapPoints?.wellAnchorId !== undefined)
          .map((room) => [room.gameName, room.mapPoints!.wellAnchorId]),
      ),
    ).toEqual({
      Dream_PostBoss01: 800777,
      Dream_PostBoss02: 800777,
      Dream_PostBoss03: 800777,
      F_PostBoss01: 480768,
      G_PostBoss01: 487438,
      H_PostBoss01: 487438,
    });
  });

  it.each([
    [
      'an undeclared room',
      (input: Record<string, RoomMapPoints>) => {
        input.X_Missing01 = input.F_Combat02!;
      },
      /roomMapPoints\.X_Missing01: is not a declared room/,
    ],
    [
      'a descending family',
      (input: Record<string, RoomMapPoints>) => {
        (input.F_Combat02 as { exitDoors: unknown }).exitDoors = [
          ...input.F_Combat02!.exitDoors,
        ].reverse();
      },
      /roomMapPoints\.F_Combat02\.exitDoors\[1\]\.id: must ascend/,
    ],
    [
      'an ObjectId in two families',
      (input: Record<string, RoomMapPoints>) => {
        (input.F_Combat02 as { secretPoints: unknown }).secretPoints = [
          input.F_Combat02!.heroStarts[0],
        ];
      },
      /roomMapPoints\.F_Combat02\.\w+\[0\]\.id: duplicates/,
    ],
    [
      'a Well pin off the anchors',
      (input: Record<string, RoomMapPoints>) => {
        (input.F_PostBoss01 as { wellAnchorId: unknown }).wellAnchorId = 1;
      },
      /roomMapPoints\.F_PostBoss01\.wellAnchorId/,
    ],
    [
      'a non-finite position',
      (input: Record<string, RoomMapPoints>) => {
        (input.F_Combat02!.heroStarts[0] as { x: unknown }).x = null;
      },
      /roomMapPoints\.F_Combat02\.heroStarts\[0\]\.x: must be a finite number/,
    ],
  ])('rejects %s', (_label, change, message) => {
    const input = cloneCatalogInput();
    change(input.roomMapPoints as Record<string, RoomMapPoints>);
    expect(() => createCatalog(input)).toThrow(message);
  });
});
