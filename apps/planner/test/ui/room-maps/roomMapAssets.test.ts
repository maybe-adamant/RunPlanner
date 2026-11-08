import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { roomMapPosition } from '@planner/projections/roomMapMarkers';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { roomMapAssets } from '@planner/ui/room-maps/roomMapAssets';

describe('room map assets', () => {
  it('covers every declared room with one resolvable static image', () => {
    const declaredGameNames = Object.keys(catalog.rooms.byKey).sort();

    expect(roomMapAssets.map((asset) => asset.gameName)).toEqual(declaredGameNames);
    expect(new Set(roomMapAssets.map((asset) => asset.gameName)).size).toBe(roomMapAssets.length);
    expect(roomMapAssets.every((asset) => asset.src.length > 0)).toBe(true);
  });

  it('supplies captured references for every declared room', () => {
    expect(
      roomMapAssets.filter((asset) => asset.isPlaceholder).map((asset) => asset.gameName),
    ).toEqual([]);
  });

  it('groups captured maps by biome with shared special rooms and G anomalies', () => {
    for (const asset of roomMapAssets.filter((asset) => !asset.isPlaceholder)) {
      const prefix = asset.gameName.split('_')[0];
      const folder =
        prefix === 'B'
          ? 'G/Anomaly'
          : prefix === 'Chaos' || prefix === 'C' || prefix === 'Dream'
            ? 'Special'
            : prefix;
      expect(asset.src).toContain(`/assets/${folder}/${asset.gameName}.`);
    }
  });

  it('places every cocoon reward point on its room calibrated map', () => {
    const hosts = catalog.rooms.values.filter((room) => room.cocoonRewardPointIds !== undefined);
    expect(hosts).toHaveLength(41);
    for (const room of hosts) {
      expect(roomMapCalibrations[room.gameName], room.gameName).toBeDefined();
      expect(room.mapPoints?.cocoonRewardPoints?.map(({ id }) => id)).toEqual(
        room.cocoonRewardPointIds,
      );
    }
  });

  it('calibrates every Fields room so its cage and reward points show on its map', () => {
    const fields = catalog.rooms.values.filter(
      (room) => (room.mapPoints?.fieldsCagePoints?.length ?? 0) > 0,
    );
    expect(fields.length).toBeGreaterThan(0);
    for (const room of fields)
      expect(roomMapCalibrations[room.gameName], room.gameName).toBeDefined();
  });

  it('calibrates every declared room', () => {
    expect(
      Object.keys(catalog.rooms.byKey).filter(
        (gameName) => roomMapCalibrations[gameName] === undefined,
      ),
    ).toEqual([]);
  });

  it('places the wheel and its two offer spots inside the map of every room with wheel offers', () => {
    const ships = catalog.rooms.values.filter((room) =>
      catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey]?.slots.some(
        (slot) => slot.rewardAttachment?.kind === 'rewardWheel',
      ),
    );
    expect(ships.length).toBeGreaterThan(0);
    for (const room of ships) {
      const calibration = roomMapCalibrations[room.gameName]!;
      const wheel = room.mapPoints?.shipWheel;
      expect(wheel, room.gameName).toBeDefined();
      if (wheel === undefined) continue;
      for (const point of [wheel, wheel.leftOffer, wheel.rightOffer]) {
        const { left, top } = roomMapPosition(point, calibration);
        expect(
          [left, top].every((value) => value > 0 && value < 100),
          room.gameName,
        ).toBe(true);
      }
    }
  });

  it('places every Ephyra side door and Hub door at a map door inside its calibrated image', () => {
    const doorsOn = (gameName: string, doorIds: readonly number[]) => {
      const room = catalog.rooms.byKey[gameName]!;
      const calibration = roomMapCalibrations[gameName];
      expect(calibration, gameName).toBeDefined();
      for (const doorId of doorIds) {
        const door = room.mapPoints?.exitDoors.find((candidate) => candidate.id === doorId);
        expect(door, `${gameName} door ${doorId}`).toBeDefined();
        const { left, top } = roomMapPosition(door!, calibration!);
        expect(left, `${gameName} door ${doorId}`).toBeGreaterThan(0);
        expect(left, `${gameName} door ${doorId}`).toBeLessThan(100);
        expect(top, `${gameName} door ${doorId}`).toBeGreaterThan(0);
        expect(top, `${gameName} door ${doorId}`).toBeLessThan(100);
      }
    };
    const parents = catalog.rooms.values.filter((room) =>
      room.localChildren.some((child) => child.kind === 'fixedRoomSlots'),
    );
    expect(parents).toHaveLength(16);
    for (const room of parents)
      doorsOn(
        room.gameName,
        room.localChildren.flatMap((child) =>
          child.kind === 'fixedRoomSlots' ? child.slots.map((slot) => slot.physicalDoorId) : [],
        ),
      );
    const hubs = catalog.biomeLayouts.values.flatMap((layout) =>
      layout.progression.kind === 'hub' ? [layout.progression] : [],
    );
    expect(hubs).toHaveLength(1);
    for (const hub of hubs)
      doorsOn(
        hub.terminal.roomGameName,
        hub.slots.map((slot) => slot.physicalDoorId),
      );
  });
});
