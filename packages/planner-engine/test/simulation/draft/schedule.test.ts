import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { draftGodSchedule } from '../../../src/simulation/draft/schedule';
import { createDraftRng } from '../../../src/simulation/draft/walk';
import type { DraftSpec } from '../../../src/simulation';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const surface = { routeKey: 'Surface', itineraryBiomeKeys: ['N', 'O', 'P', 'Q'] };
const spec: DraftSpec = {
  loadout,
  world: { godKeys: ['Zeus', 'Hera', 'Apollo', 'Ares'], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
  basketTraitKeys: [
    'ZeusWeaponBoon',
    'HeraCastBoon',
    'ApolloSprintBoon',
    'AresManaBoon',
    'ZeusManaBoon',
  ],
  rackKeepsakeKeys: [null, null, null],
};

describe('draft god schedule', () => {
  it('places first rooms in the first half and spreads traits by capacity', () => {
    const { byBiome } = draftGodSchedule(catalog, surface, spec, createDraftRng(1));
    expect(
      byBiome
        .slice(0, 2)
        .flatMap((biome) => biome.godKeys)
        .sort(),
    ).toEqual([...spec.world.godKeys].sort());
    expect(byBiome.flatMap((biome) => biome.traitKeys).sort()).toEqual(
      [...spec.basketTraitKeys].sort(),
    );
    expect(byBiome[0]!.traitKeys.length).toBeGreaterThan(byBiome[1]!.traitKeys.length);
  });

  it('gives O no anchors under Forfeit', () => {
    const forfeit = {
      ...spec,
      loadout: { ...loadout, fearRanks: { ...loadout.fearRanks, BoonSkipShrineUpgrade: 1 } },
    };
    const o = draftGodSchedule(catalog, surface, forfeit, createDraftRng(1)).byBiome[1]!;
    expect(o).toMatchObject({ godKeys: [], traitKeys: [] });
  });

  it('varies with the seed', () => {
    const orders = [1, 2, 3, 4, 5].map((seed) =>
      JSON.stringify(draftGodSchedule(catalog, surface, spec, createDraftRng(seed))),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });
});
