import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { roomMapAssetFor, roomMapAssets } from '@planner/ui/room-maps/roomMapAssets';

describe('room map assets', () => {
  it('covers every declared room with one resolvable static image', () => {
    const declaredGameNames = Object.keys(catalog.rooms.byKey).sort();

    expect(roomMapAssets.map((asset) => asset.gameName)).toEqual(declaredGameNames);
    expect(new Set(roomMapAssets.map((asset) => asset.gameName)).size).toBe(roomMapAssets.length);
    expect(roomMapAssets.every((asset) => asset.src.length > 0)).toBe(true);
  });

  it('keeps exact source matches and deliberate placeholders distinct', () => {
    expect(roomMapAssetFor('F_Combat01')).toMatchObject({
      gameName: 'F_Combat01',
      isPlaceholder: false,
    });
    expect(roomMapAssetFor('H_Combat01')).toMatchObject({
      gameName: 'H_Combat01',
      isPlaceholder: true,
    });
    expect(roomMapAssetFor('H_Combat05')).toMatchObject({
      gameName: 'H_Combat05',
      isPlaceholder: true,
    });
  });
});
