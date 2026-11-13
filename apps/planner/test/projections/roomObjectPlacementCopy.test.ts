import type { RoomFeatureRefusal } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  roomFeatureRefusalSentence,
  type RoomFeatureNoun,
} from '@planner/projections/roomObjectPlacementCopy';

const sentences = (feature: RoomFeatureNoun, refusals: readonly RoomFeatureRefusal[]) =>
  refusals.map((refusal) => roomFeatureRefusalSentence(feature, refusal));

describe('room feature refusal copy', () => {
  it('words every Well and Shrine refusal from its own values', () => {
    expect(
      sentences('stygianWell', [
        { reason: 'biomeDepth', biomeDepthCache: 2, minimumBiomeDepth: 3 },
        { reason: 'recentWell', roomsSinceLast: 2, minimumRoomsSinceLast: 4 },
      ]),
    ).toEqual([
      'Wells need biome depth 3; this room is at 2.',
      'Wells need 4 rooms between them; this one is 2 after the last.',
    ]);
    expect(
      sentences('hermesShrine', [
        { reason: 'biomeDepth', biomeDepthCache: 1, minimumBiomeDepth: 3 },
        { reason: 'recentShrine', roomsSinceLast: 1, minimumRoomsSinceLast: 3 },
      ]),
    ).toEqual([
      'Shrines need biome depth 3; this room is at 1.',
      'Shrines need 3 rooms between them; this one is 1 after the last.',
    ]);
  });

  it('words the Chaos gate, Contract, Pool and resource refusals from their values', () => {
    expect(
      sentences('chaosGate', [
        { reason: 'routeExcluded' },
        { reason: 'biomeDepthCeiling', biomeDepthCache: 6, maximumBiomeDepth: 5 },
        { reason: 'offerSpacing', rooms: 10 },
      ]),
    ).toEqual([
      'This room holds no Chaos Gate on this route.',
      'Chaos Gates need biome depth 5 or less; this room is at 6.',
      'Chaos Gates need more than 10 rooms after the last Chaos Gate.',
    ]);
    expect(
      sentences('zagreusContract', [{ reason: 'capReached', per: 'route', count: 1, maximum: 1 }]),
    ).toEqual(['This run already had a Zagreus Contract; no more can appear.']);
    expect(sentences('purgingPool', [{ reason: 'routeExcluded' }])).toEqual([
      'This room holds no Pool of Purging on this route.',
    ]);
    expect(
      sentences({ resource: 'Pickaxe' }, [
        {
          reason: 'resourceLookback',
          family: 'Pickaxe',
          scope: 'sameFamily',
          order: 'before',
          rooms: 4,
        },
        {
          reason: 'resourceLookback',
          family: 'Fishing',
          scope: 'crossFamily',
          order: 'before',
          rooms: 2,
        },
        {
          reason: 'resourceLookback',
          family: 'Shovel',
          scope: 'crossFamily',
          order: 'after',
          rooms: 2,
        },
        { reason: 'capReached', per: 'biome', count: 1, maximum: 1 },
        { reason: 'roomCapacity', family: 'Fishing', capacity: 'allTools' },
      ]),
    ).toEqual([
      'Mining spots need more than 4 rooms after the last mining spot.',
      'Mining spots need more than 2 rooms after the last fishing spot.',
      'Seed spots need more than 2 rooms after the last mining spot.',
      'Only one mining spot per biome.',
      'This room has no space for a mining spot beside its fishing spot.',
    ]);
  });
});
