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
  it('spreads basket traits by capacity', () => {
    const { byBiome } = draftGodSchedule(catalog, surface, spec, createDraftRng(1));
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
    expect(o).toMatchObject({ traitKeys: [] });
  });

  it('varies with the seed', () => {
    const orders = [1, 2, 3, 4, 5].map((seed) =>
      JSON.stringify(draftGodSchedule(catalog, surface, spec, createDraftRng(seed))),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  describe('prerequisites', () => {
    const chained: DraftSpec = {
      ...spec,
      world: { ...spec.world, godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hera'] },
      basketTraitKeys: [
        'HeraCastBoon',
        'SprintEchoBoon',
        'ApolloSprintBoon',
        'TimeStopLastStandBoon',
        'LuckyBoon',
        'DoubleStrikeChanceBoon',
        'AphroditeManaBoon',
        'ZeusWeaponBoon',
      ],
    };
    const dueBiomes = (seed: number) => {
      const due = new Map<string, number>();
      draftGodSchedule(catalog, surface, chained, createDraftRng(seed)).byBiome.forEach(
        (biome, index) => biome.traitKeys.forEach((key) => due.set(key, index)),
      );
      return (key: string) => {
        const index = due.get(key);
        if (index === undefined) throw new Error(`${key} is not scheduled`);
        return index;
      };
    };
    const seeds = [1, 2, 3, 4, 5, 6];

    it('places a Duo no earlier than both of its prerequisites', () => {
      for (const seed of seeds) {
        const due = dueBiomes(seed);
        expect(due('SprintEchoBoon')).toBeGreaterThanOrEqual(due('ZeusWeaponBoon'));
        expect(due('SprintEchoBoon')).toBeGreaterThanOrEqual(due('AphroditeManaBoon'));
      }
    });

    it('places Success Rate after its god prerequisite and Paid Dues after the other Hermes trait', () => {
      for (const seed of seeds) {
        const due = dueBiomes(seed);
        expect(due('DoubleStrikeChanceBoon')).toBeGreaterThanOrEqual(due('ZeusWeaponBoon'));
        expect(due('LuckyBoon')).toBeGreaterThanOrEqual(due('DoubleStrikeChanceBoon'));
        expect(due('TimeStopLastStandBoon')).toBeGreaterThanOrEqual(due('LuckyBoon'));
        expect(due('TimeStopLastStandBoon')).toBe(surface.itineraryBiomeKeys.length - 1);
      }
    });

    it('moves the prerequisite that unlocks the most traits to the first biome', () => {
      for (const seed of seeds) expect(dueBiomes(seed)('ZeusWeaponBoon')).toBe(0);
    });
  });

  describe('Hermes and element due biomes', () => {
    const underworld = { routeKey: 'Underworld', itineraryBiomeKeys: ['F', 'G', 'H', 'I'] };
    const shortDream = { routeKey: 'Dream', itineraryBiomeKeys: ['F', 'G', 'H'] };
    const forfeit = { ...loadout, fearRanks: { ...loadout.fearRanks, BoonSkipShrineUpgrade: 1 } };
    const draft = (basketTraitKeys: readonly string[], draftLoadout = loadout): DraftSpec => ({
      loadout: draftLoadout,
      world: {
        godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
        storyNpcByBiome: {},
        fieldNpcsByBiome: { G: ['Artemis'] },
      },
      basketTraitKeys,
      rackKeepsakeKeys: [],
    });
    const dueOf = (route: typeof underworld, draftSpec: DraftSpec, seed: number) => {
      const due = new Map<string, number>();
      draftGodSchedule(catalog, route, draftSpec, createDraftRng(seed)).byBiome.forEach(
        (biome, index) => biome.traitKeys.forEach((key) => due.set(key, index)),
      );
      return (key: string) => due.get(key);
    };
    const seeds = [1, 2, 3, 4, 5, 6];
    const successRate = ['ZeusWeaponBoon', 'DoubleStrikeChanceBoon', 'LuckyBoon'];

    it('puts Success Rate at the first-half end, or with a later god prerequisite', () => {
      for (const [route, draftLoadout] of [
        [underworld, loadout],
        [shortDream, loadout],
        [underworld, forfeit],
      ] as const)
        for (const seed of seeds) {
          const early = dueOf(route, draft(['BoltRetaliateBoon', 'LuckyBoon'], draftLoadout), seed);
          expect(early('BoltRetaliateBoon')).toBe(0);
          expect(early('LuckyBoon')).toBe(1);
          const chained = dueOf(route, draft(successRate, draftLoadout), seed);
          expect(chained('LuckyBoon')).toBe(Math.max(1, chained('DoubleStrikeChanceBoon')!));
        }
    });

    it('puts the second Hermes trait at the last biome', () => {
      for (const route of [underworld, shortDream]) {
        const due = dueOf(route, draft([...successRate, 'TimeStopLastStandBoon']), 1);
        expect(due('TimeStopLastStandBoon')).toBe(route.itineraryBiomeKeys.length - 1);
      }
    });

    it('puts Success Rate last when only an unscheduled NPC trait unlocks it', () => {
      const due = dueOf(underworld, draft(['CritBonusBoon', 'LuckyBoon']), 1);
      expect(due('CritBonusBoon')).toBeUndefined();
      expect(due('LuckyBoon')).toBe(3);
    });

    it('puts an Infusion after enough contributors, or last when the basket falls short', () => {
      const airs = ['ZeusSpecialBoon', 'ZeusCastBoon', 'ZeusSprintBoon'];
      for (const seed of seeds) {
        const due = dueOf(underworld, draft(['ElementalDamageFloorBoon', ...airs]), seed);
        expect(due('ElementalDamageFloorBoon')).toBeGreaterThanOrEqual(
          Math.max(...airs.map((key) => due(key)!)),
        );
      }
      const short = dueOf(underworld, draft(['ElementalDamageFloorBoon', 'ZeusCastBoon']), 1);
      expect(short('ElementalDamageFloorBoon')).toBe(3);
    });
  });
});
