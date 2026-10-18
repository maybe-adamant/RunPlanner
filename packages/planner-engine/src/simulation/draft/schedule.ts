import type { Catalog } from '../../catalog-schema';
import { draftForfeitActive, type DraftRoute, type DraftSpec } from './spec';
import type { DraftRng } from './walk';

/**
 * Median world-god boon rooms one biome yields: ten seeds each of full
 * Underworld FGHI and Surface NOPQ drafted with god boons weighted 25 times,
 * story targets on, counting door rewards, Fields cages and Ship wheel picks.
 */
export const DRAFT_GOD_ROOM_CAPACITY: Readonly<Record<string, number>> = Object.freeze({
  F: 5,
  G: 2,
  H: 1,
  I: 2,
  N: 5,
  O: 1,
  P: 2,
  Q: 2,
});

/** The pool gods to pick up and the basket god traits to hold by the end of each biome. */
export interface DraftGodSchedule {
  readonly byBiome: readonly {
    readonly biomeKey: string;
    readonly godKeys: readonly string[];
    readonly traitKeys: readonly string[];
  }[];
}

/** Places items in order across biomes in proportion to their capacity. */
function spread(
  itemCount: number,
  biomeKeys: readonly string[],
  capacity: (biomeKey: string) => number,
): number[] {
  const total = biomeKeys.reduce((sum, key) => sum + capacity(key), 0);
  if (total === 0) return Array.from({ length: itemCount }, () => biomeKeys.length - 1);
  return Array.from({ length: itemCount }, (_, item) => {
    const position = ((item + 0.5) / itemCount) * total;
    let cumulative = 0;
    for (const [index, key] of biomeKeys.entries()) {
      cumulative += capacity(key);
      if (position <= cumulative) return index;
    }
    return biomeKeys.length - 1;
  });
}

/**
 * Each pool god's first room falls in the first half; basket god traits,
 * interleaved by god with Duos last, spread over the whole route. The seed
 * shuffles both orders so drafts vary; Forfeit takes one boon room from every biome.
 */
export function draftGodSchedule(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftSpec,
  rng: DraftRng,
): DraftGodSchedule {
  const shuffle = <T>(values: readonly T[]): T[] => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [result[index], result[swap]] = [result[swap]!, result[index]!];
    }
    return result;
  };
  const godKeys = shuffle(spec.world.godKeys);
  const biomeKeys = route.itineraryBiomeKeys;
  const forfeit = draftForfeitActive(catalog, spec.loadout) ? 1 : 0;
  const capacity = (biomeKey: string) =>
    Math.max((DRAFT_GOD_ROOM_CAPACITY[biomeKey] ?? 1) - forfeit, 0);
  const firstHalf = biomeKeys.slice(0, Math.ceil(biomeKeys.length / 2));
  const godsOf = (traitKey: string) =>
    catalog.traitGivers.values
      .filter((giver) => giver.providerKind === 'olympian' && giver.traitKeys.includes(traitKey))
      .map((giver) => giver.key);
  const godTraits = spec.basketTraitKeys.filter((key) => godsOf(key).length > 0);
  const byGod = godKeys.map((god) =>
    shuffle(godTraits.filter((key) => godsOf(key).length === 1 && godsOf(key)[0] === god)),
  );
  const interleaved: string[] = [];
  for (let round = 0; byGod.some((traits) => traits.length > round); round += 1)
    for (const traits of byGod) if (traits[round] !== undefined) interleaved.push(traits[round]!);
  const traitOrder = [
    ...interleaved,
    ...shuffle(godTraits.filter((key) => godsOf(key).length > 1)),
  ];
  const godPlaces = spread(godKeys.length, firstHalf, capacity);
  const traitPlaces = spread(traitOrder.length, biomeKeys, capacity);
  return Object.freeze({
    byBiome: Object.freeze(
      biomeKeys.map((biomeKey, index) =>
        Object.freeze({
          biomeKey,
          godKeys: Object.freeze(godKeys.filter((_, i) => godPlaces[i] === index)),
          traitKeys: Object.freeze(traitOrder.filter((_, i) => traitPlaces[i] === index)),
        }),
      ),
    ),
  });
}
