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
        { reason: 'notHost' },
        { reason: 'noAnchor' },
        { reason: 'biomeDepth', biomeDepthCache: 2, minimumBiomeDepth: 3 },
        { reason: 'recentWell', roomsSinceLast: 2, minimumRoomsSinceLast: 4 },
      ]),
    ).toEqual([
      'This room never holds a Stygian Well.',
      'This room has no spot for a Stygian Well.',
      'Wells need biome depth 3; this room is at 2.',
      'Wells need 4 rooms between them; this one is 2 after the last.',
    ]);
    expect(
      sentences('hermesShrine', [
        { reason: 'notHost' },
        { reason: 'noAnchor' },
        { reason: 'biomeDepth', biomeDepthCache: 1, minimumBiomeDepth: 3 },
        { reason: 'recentShrine', roomsSinceLast: 1, minimumRoomsSinceLast: 3 },
      ]),
    ).toEqual([
      'This room never holds a Hermes Shrine.',
      'This room has no spot for a Hermes Shrine.',
      'Shrines need biome depth 3; this room is at 1.',
      'Shrines need 3 rooms between them; this one is 1 after the last.',
    ]);
  });

  it('words the Chaos gate, Contract, Pool and resource refusals from their values', () => {
    expect(
      sentences('chaosGate', [
        { reason: 'physicalCapability' },
        { reason: 'targetDomain' },
        { reason: 'requirementUnmet', requirement: 'SecretDoorRequirements' },
        { reason: 'offerSpacing', rooms: 3 },
      ]),
    ).toEqual([
      'This room has no spot for a Chaos Gate.',
      'This biome has no room a Chaos Gate can lead to.',
      'The game’s requirements for a Chaos Gate aren’t met here.',
      'Chaos Gates need 3 rooms between offers.',
    ]);
    expect(
      sentences('zagreusContract', [{ reason: 'capReached', per: 'route', count: 1, maximum: 1 }]),
    ).toEqual(['This run already had a Zagreus Contract; no more can appear.']);
    expect(sentences('purgingPool', [{ reason: 'routeExcluded' }])).toEqual([
      'This room holds no Pool of Purging on this route.',
    ]);
    expect(
      sentences({ resource: 'Pickaxe' }, [
        { reason: 'resourceLookback', family: 'Shovel', scope: 'crossFamily', rooms: 2 },
        { reason: 'capReached', per: 'biome', count: 1, maximum: 1 },
        { reason: 'roomCapacity', family: 'Fishing', capacity: 'allTools' },
      ]),
    ).toEqual([
      'Mining successes need 2 rooms after a Seed success.',
      'Only one Mining success per biome.',
      'This room has no space for a Mining success beside its Fishing success.',
    ]);
  });
});
