import { catalog } from '@run-planner/hades2-catalog';
import { expect, it } from 'vitest';
import { cocoonMapAssets, cocoonMapFor } from '@planner/ui/room-maps/cocoons/cocoonMapAssets';
import { cocoonMapAnnotations } from '@planner/ui/room-maps/cocoons/cocoonMapAnnotations';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';

it('packages exactly one separate cocoon map and matching visual inventory for all 41 hosts', () => {
  const rooms = catalog.rooms.values.filter((room) => room.cocoonRewardPointIds !== undefined);
  expect(rooms).toHaveLength(41);
  expect(cocoonMapAssets.map((asset) => asset.gameName).sort()).toEqual(
    rooms.map((room) => room.gameName).sort(),
  );
  expect(Object.keys(cocoonMapAnnotations).sort()).toEqual(
    rooms.map((room) => room.gameName).sort(),
  );
  for (const room of rooms) {
    const map = cocoonMapFor(room.gameName)!;
    expect(map.annotations.points.map(([id]) => id)).toEqual(room.cocoonRewardPointIds);
    expect(map.asset.src).toContain(`/cocoons/assets/${room.roomSetKey}/${room.gameName}.webp`);
    expect(roomMapAssetFor(room.gameName)!.src).not.toBe(map.asset.src);
    expect(roomMapAssetFor(room.gameName)!.src).not.toContain('/cocoons/');
    const { width, height, radius, points } = map.annotations;
    expect(width).toBe(2560);
    expect(height).toBe(1440);
    expect(radius).toBeGreaterThan(0);
    for (const [, x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(radius);
      expect(x).toBeLessThanOrEqual(width - radius);
      expect(y).toBeGreaterThanOrEqual(radius);
      expect(y).toBeLessThanOrEqual(height - radius);
    }
  }
});

it('retains final marker display adjustments rather than raw annotation anchors', () => {
  expect(cocoonMapAnnotations.F_Combat04!.points[6]!.slice(1)).toEqual([
    1217.0976229319567, 520.3918527117813,
  ]);
  expect(cocoonMapAnnotations.F_Combat04!.radius).toBe(37);
});
