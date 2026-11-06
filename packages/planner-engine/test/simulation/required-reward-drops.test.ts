import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';

import { resolveRoutePosition } from '../../src/authored-project/route-context';
import { resolveRequiredRewardDrop } from '../../src/simulation/materialization/rooms/required-reward';

function dropAt(gameName: string, routeKey: string, itinerary: readonly string[], biome: string) {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`unknown room ${gameName}`);
  return resolveRequiredRewardDrop(
    catalog,
    room,
    resolveRoutePosition(catalog, { routeKey, itineraryBiomeKeys: itinerary }, biome),
  );
}

const underworld = ['F', 'G', 'H', 'I'];
const surface = ['N', 'O', 'P', 'Q'];

describe('required reward drops', () => {
  it("resolves each boss room's own forced drop on ordinary routes, at every position", () => {
    const bosses = [
      ['Underworld', underworld, 'F', ['F_Boss01', 'F_Boss02'], 'MixerFBossDrop', 'MixerFBoss'],
      ['Underworld', underworld, 'G', ['G_Boss01', 'G_Boss02'], 'MixerGBossDrop', 'MixerGBoss'],
      ['Underworld', underworld, 'H', ['H_Boss01', 'H_Boss02'], 'MixerHBossDrop', 'MixerHBoss'],
      ['Underworld', underworld, 'I', ['I_Boss01'], 'MixerIBossDrop', 'MixerIBoss'],
      ['Surface', surface, 'N', ['N_Boss01', 'N_Boss02'], 'MixerNBossDrop', 'MixerNBoss'],
      ['Surface', surface, 'O', ['O_Boss01', 'O_Boss02'], 'MixerOBossDrop', 'MixerOBoss'],
      ['Surface', surface, 'P', ['P_Boss01'], 'MixerPBossDrop', 'MixerPBoss'],
      ['Surface', surface, 'Q', ['Q_Boss01', 'Q_Boss02'], 'MixerQBossDrop', 'MixerQBoss'],
    ] as const;
    for (const [routeKey, itinerary, biome, rooms, consumableKey, resourceKey] of bosses)
      for (const gameName of rooms)
        expect(dropAt(gameName, routeKey, itinerary, biome), gameName).toEqual({
          consumableKey,
          resourceKey,
          amount: 1,
        });
  });

  it('forces Shiny Stars on a Dream boss, one more for each biome entered before it', () => {
    const itinerary = ['G', 'O', 'F', 'Q'];
    expect(
      [
        ['G_Boss01', 'G'],
        ['O_Boss02', 'O'],
        ['F_Boss01', 'F'],
        ['Q_Boss02', 'Q'],
      ].map(([gameName, biome]) => dropAt(gameName!, 'Dream', itinerary, biome!)),
    ).toEqual(
      [1, 2, 3, 4].map((amount) => ({
        consumableKey: 'DreamPointsDrop',
        resourceKey: 'DreamPoints',
        amount,
      })),
    );
  });

  it('keeps Zagreus at 50 Gemstones on every route, Dream included', () => {
    const gems = { consumableKey: 'GemPointsBigDrop', resourceKey: 'GemPoints', amount: 50 };
    expect(dropAt('C_Boss01', 'Underworld', underworld, 'H')).toEqual(gems);
    expect(dropAt('C_Boss01', 'Dream', ['G', 'H', 'I', 'O'], 'I')).toEqual(gems);
  });

  it('forces nothing in a room without a required reward', () => {
    expect(dropAt('F_PostBoss01', 'Underworld', underworld, 'F')).toBeUndefined();
  });
});
