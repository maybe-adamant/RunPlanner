import { describe, expect, it } from 'vitest';

import {
  markerPlacement,
  roomMapChipSide,
} from '@planner/ui/editor/biome/room-map/roomMapPosition';

describe('room map chip side', () => {
  it('centres a chip on a point away from the edges', () => {
    expect(roomMapChipSide({ left: 50, top: 50 })).toEqual({});
  });

  it('turns a chip away from each edge its point is near', () => {
    expect(roomMapChipSide({ left: 40, top: 2 })).toEqual({ y: 'below' });
    expect(roomMapChipSide({ left: 40, top: 97 })).toEqual({ y: 'above' });
    expect(roomMapChipSide({ left: 3, top: 50 })).toEqual({ x: 'right' });
    expect(roomMapChipSide({ left: 96, top: 98 })).toEqual({ x: 'left', y: 'above' });
  });

  it('keeps a ring on its point', () => {
    expect(markerPlacement({ left: 40, top: 2 }, false)).toEqual({
      style: { left: '40%', top: '2%' },
    });
    expect(markerPlacement({ left: 40, top: 2 }, true)['data-chip-y']).toBe('below');
  });
});
