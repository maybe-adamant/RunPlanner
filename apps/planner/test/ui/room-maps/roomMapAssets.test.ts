import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

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
});
