import { catalog } from '@run-planner/hades2-catalog';
import { nativeExitDoorOrder, type RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import {
  deriveRoomLayout,
  roomArrivalThrough,
  type RoomArrival,
} from '../../../src/simulation/room-layout/derivation';

const room = (gameName: string): RoomDeclaration => {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
};
const door = (exitDirection?: 'Left' | 'Right' | 'North'): RoomArrival =>
  exitDirection === undefined ? { kind: 'door' } : { kind: 'door', exitDirection };

describe('room layout derivation', () => {
  it('loads the run start unflipped with every entry the game can pick', () => {
    const layout = deriveRoomLayout(room('F_Opening01'), { kind: 'runStart' }, undefined);
    expect(layout.flip).toEqual({ kind: 'fixed', value: false });
    expect(layout.entry).toEqual({
      kind: 'derived',
      point: { startPointId: 50065, endPointId: 50059 },
    });
  });

  it('decides a fixed-entrance room by the previous exit, ahead of its flip chance', () => {
    // F_MiniBoss03 enters from the Right and never rolls a flip.
    const miniBoss = room('F_MiniBoss03');
    expect(deriveRoomLayout(miniBoss, door('Right'), undefined).flip).toEqual({
      kind: 'derived',
      value: false,
    });
    expect(deriveRoomLayout(miniBoss, door('Left'), undefined).flip).toEqual({
      kind: 'derived',
      value: true,
    });
    // A compass exit never equals Left or Right.
    expect(deriveRoomLayout(miniBoss, door('North'), undefined).flip).toEqual({
      kind: 'derived',
      value: true,
    });
    // An unknown exit leaves the room's own chance, here none.
    expect(deriveRoomLayout(miniBoss, door(), undefined).flip).toEqual({
      kind: 'fixed',
      value: false,
    });
  });

  it('filters entries by their live direction and ties among the matching ones', () => {
    // Both F_MiniBoss03 pairs face Right: unflipped after a Right exit, both match.
    const right = deriveRoomLayout(room('F_MiniBoss03'), door('Right'), undefined);
    expect(right.entry).toMatchObject({ kind: 'choice' });
    // Flipped after a Left exit, both face Left and match again.
    const left = deriveRoomLayout(room('F_MiniBoss03'), door('Left'), undefined);
    expect(left.entry.kind === 'choice' && left.entry.eligible.map((o) => o.startPointId)).toEqual([
      800509, 800511,
    ]);
  });

  it('falls back to the lowest start and end when no pair matches', () => {
    // P_MiniBoss02 never flips here: an unknown exit leaves both pairs, a compass one none.
    const fallback = deriveRoomLayout(room('P_MiniBoss02'), door(), { entryStartPointId: 723537 });
    expect(fallback.entry).toMatchObject({ kind: 'choice' });
    // Without its fixed entrance it keeps its zero chance; no pair faces North.
    const { entranceDirection: _entrance, ...orientation } = room('P_MiniBoss02').orientation!;
    void _entrance;
    const unmatched = deriveRoomLayout(
      { ...room('P_MiniBoss02'), orientation },
      door('North'),
      undefined,
    );
    expect(unmatched.entry).toEqual({
      kind: 'derived',
      point: { startPointId: 50065, endPointId: 50059 },
    });
  });

  it('lets an entry of a rolled room name the flip it needs', () => {
    const fields = room('H_Combat05');
    const derived = deriveRoomLayout(fields, door('Left'), undefined);
    expect(derived.flip).toEqual({ kind: 'roll', chance: 0.5 });
    if (derived.entry.kind !== 'choice') throw new Error('H_Combat05 offers no entry choice');
    const needed = derived.entry.eligible.filter((option) => option.flipped !== undefined);
    expect(needed.length).toBeGreaterThan(0);
    const option = needed[0]!;
    const chosen = deriveRoomLayout(fields, door('Left'), {
      entryStartPointId: option.startPointId,
    });
    expect(chosen.flip).toEqual({ kind: 'roll', chance: 0.5, value: option.flipped });
    expect(chosen.entry).toMatchObject({ point: { startPointId: option.startPointId } });
    // The other flip rules the entry out: kept and reported, never rewritten.
    const contradicted = deriveRoomLayout(fields, door('Left'), {
      flipped: !option.flipped,
      entryStartPointId: option.startPointId,
    });
    expect(contradicted.entryUnavailable).toBeDefined();
    expect(contradicted.flip).toEqual({ kind: 'roll', chance: 0.5, value: !option.flipped });
    // With no exit known, flip and entry are independent.
    const free = deriveRoomLayout(fields, door(), {
      flipped: !option.flipped,
      entryStartPointId: option.startPointId,
    });
    expect(free.entryUnavailable).toBeUndefined();
    expect(
      free.entry.kind === 'choice' && free.entry.eligible.every((o) => o.flipped === undefined),
    ).toBe(true);
  });

  it('flags an authored flip where the room does not roll one', () => {
    expect(
      deriveRoomLayout(room('F_MiniBoss03'), door('Left'), { flipped: false }).flipUnavailable,
    ).toBe(true);
    expect(
      deriveRoomLayout(room('H_Combat05'), door('Left'), { flipped: false }).flipUnavailable,
    ).toBeUndefined();
  });

  it("takes a fixed entry from the room or the previous room's door", () => {
    expect(deriveRoomLayout(room('N_Hub'), door('Right'), undefined).entry).toEqual({
      kind: 'fixed',
      point: { startPointId: 50065, endPointId: 50059 },
    });
    const arrival = roomArrivalThrough(
      catalog,
      { gameName: 'N_Combat01', flipped: false },
      { kind: 'soleDoor' },
    );
    expect(arrival).toMatchObject({
      forcedEntry: { startPointId: 617114, endPointId: 617112 },
    });
  });
});

describe('the previous exit', () => {
  it('reads the taken door direction, mirrored when its room was flipped', () => {
    const order = nativeExitDoorOrder(
      catalog,
      'G_Combat02',
      room('G_Combat02').mapPoints!.exitDoors.map((candidate) => ({ doorId: candidate.id })),
    )!;
    const direction = (index: number) =>
      room('G_Combat02').mapPoints!.exitDoors.find(
        (candidate) => candidate.id === order[index - 1],
      )!.exitDirection;
    for (const index of [1, 2, 3]) {
      expect(
        roomArrivalThrough(
          catalog,
          { gameName: 'G_Combat02', flipped: false },
          { kind: 'exit', index },
        ),
      ).toEqual({ kind: 'door', exitDirection: direction(index) });
      expect(
        roomArrivalThrough(
          catalog,
          { gameName: 'G_Combat02', flipped: true },
          { kind: 'exit', index },
        ),
      ).toEqual({ kind: 'door', exitDirection: direction(index) === 'Left' ? 'Right' : 'Left' });
    }
  });

  it('is unknown at run start, while the flip is unset, past an ignoring room or a spawned door', () => {
    expect(roomArrivalThrough(catalog, undefined, { kind: 'soleDoor' })).toEqual({
      kind: 'runStart',
    });
    expect(
      roomArrivalThrough(catalog, { gameName: 'G_Combat02' }, { kind: 'exit', index: 1 }),
    ).toEqual({ kind: 'door' });
    expect(
      roomArrivalThrough(catalog, { gameName: 'Chaos_01', flipped: false }, { kind: 'soleDoor' }),
    ).toEqual({ kind: 'door' });
    expect(
      roomArrivalThrough(
        catalog,
        { gameName: 'G_Combat02', flipped: false },
        { kind: 'chaosGate' },
      ),
    ).toEqual({ kind: 'door' });
    // A sole-door transition from a room with several doors names none.
    expect(
      roomArrivalThrough(catalog, { gameName: 'G_Combat02', flipped: false }, { kind: 'soleDoor' }),
    ).toEqual({ kind: 'door' });
  });
});
