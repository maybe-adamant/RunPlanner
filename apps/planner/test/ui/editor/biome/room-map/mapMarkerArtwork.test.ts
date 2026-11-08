import { describe, expect, it } from 'vitest';

import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { rerollDieArtwork } from '@planner/ui/artwork/rerolls/rerollArtwork';
import { rewardArtwork } from '@planner/ui/artwork/rewards/rewardArtwork';
import { roomObjectArtwork } from '@planner/ui/artwork/room-objects/roomObjectArtwork';
import {
  mapMarkerArtworkCentre,
  mapMarkerArtworkStyle,
} from '@planner/ui/editor/biome/room-map/mapMarkerArtwork';

describe('map marker artwork centres', () => {
  it('measures every artwork a map marker can hold', () => {
    const urls = [
      ...Object.values(rewardArtwork),
      ...Object.values(roomObjectArtwork),
      npcArtwork.Nemesis,
      rerollDieArtwork,
    ].filter((url): url is string => typeof url === 'string');
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => mapMarkerArtworkCentre(url) === undefined)).toEqual([]);
  });

  it('leaves a pair of halves unshifted', () => {
    const gold = rewardArtwork.Currency!;
    expect(mapMarkerArtworkStyle([gold, gold])).toBeUndefined();
  });
});
