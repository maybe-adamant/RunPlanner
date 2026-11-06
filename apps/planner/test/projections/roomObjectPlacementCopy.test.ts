import type {
  HermesShrinePlacementRefusal,
  StygianWellPlacementRefusal,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  hermesShrineRefusalSentence,
  stygianWellRefusalSentence,
} from '@planner/projections/roomObjectPlacementCopy';

describe('room object placement copy', () => {
  it('words every Well and Shrine refusal from its own values', () => {
    const well: readonly StygianWellPlacementRefusal[] = [
      { reason: 'notHost' },
      { reason: 'noAnchor' },
      { reason: 'biomeDepth', biomeDepthCache: 2, minimumBiomeDepth: 3 },
      { reason: 'recentWell', roomsSinceLast: 2, minimumRoomsSinceLast: 4 },
    ];
    const shrine: readonly HermesShrinePlacementRefusal[] = [
      { reason: 'notHost' },
      { reason: 'noAnchor' },
      { reason: 'biomeDepth', biomeDepthCache: 1, minimumBiomeDepth: 3 },
      { reason: 'recentShrine', roomsSinceLast: 1, minimumRoomsSinceLast: 3 },
    ];
    expect(well.map(stygianWellRefusalSentence)).toEqual([
      'This room never holds a Stygian Well.',
      'This room has no spot for a Stygian Well.',
      'Wells need biome depth 3; this room is at 2.',
      'Wells need 4 rooms between them; this one is 2 after the last.',
    ]);
    expect(shrine.map(hermesShrineRefusalSentence)).toEqual([
      'This room never holds a Hermes Shrine.',
      'This room has no spot for a Hermes Shrine.',
      'Shrines need biome depth 3; this room is at 1.',
      'Shrines need 3 rooms between them; this one is 1 after the last.',
    ]);
  });
});
