import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

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
});
