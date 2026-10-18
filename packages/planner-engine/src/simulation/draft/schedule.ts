import type { Catalog } from '../../catalog-schema';
import { draftStartTraits } from './basket';
import {
  createDraftPrerequisites,
  prerequisiteDue,
  prerequisiteOrder,
  type DraftPrerequisiteNeed,
} from './prerequisites';
import { draftHermesTraitKeys } from './report';
import { draftForfeitActive, type DraftRoute, type DraftSpec } from './spec';
import type { DraftRng } from './walk';
import { draftNpcGivers, draftNpcTraitBiomes } from './world';

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

/** The basket god and Hermes traits to hold by the end of each biome. */
export interface DraftGodSchedule {
  readonly byBiome: readonly {
    readonly biomeKey: string;
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
 * Moves the god traits an NPC basket trait needs to fall due by that NPC's
 * biome, into the latest such biome with spare capacity; each still waits on its own needs.
 */
function pullNpcPrerequisites(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftSpec,
  needs: ReadonlyMap<string, readonly DraftPrerequisiteNeed[]>,
  due: Map<string, number>,
  godTraits: readonly string[],
  capacity: (biomeKey: string) => number,
): void {
  const last = route.itineraryBiomeKeys.length - 1;
  const dueOf = (key: string) => due.get(key);
  const npcBiomes = draftNpcTraitBiomes(
    catalog,
    draftNpcGivers(catalog, route, spec.world),
    spec.basketTraitKeys,
  );
  const spareBiome = (latest: number) => {
    for (let index = latest; index >= 0; index -= 1)
      if (
        godTraits.filter((key) => due.get(key) === index).length <
        capacity(route.itineraryBiomeKeys[index]!)
      )
        return index;
    return latest;
  };
  for (const [traitKey, npcBiome] of npcBiomes)
    for (const need of needs.get(traitKey) ?? []) {
      if (prerequisiteDue([need], dueOf, last) <= npcBiome) continue;
      // The option that needs the fewest god traits moved; a later non-god member cannot move.
      const pulls = need
        .map((option) => {
          const members = [...option.weights]
            .filter(([key]) => godTraits.includes(key) || (due.get(key) ?? last + 1) <= npcBiome)
            .sort(([a], [b]) => due.get(a)! - due.get(b)!);
          const moved: string[] = [];
          let sum = 0;
          for (const [key, weight] of members) {
            if (due.get(key)! > npcBiome) moved.push(key);
            sum += weight;
            if (sum >= option.needed) return moved;
          }
          return undefined;
        })
        .filter((moved) => moved !== undefined)
        .sort((a, b) => a.length - b.length)[0];
      for (const key of pulls ?? [])
        due.set(
          key,
          Math.max(spareBiome(npcBiome), prerequisiteDue(needs.get(key) ?? [], dueOf, last)),
        );
    }
}

/**
 * Basket god traits spread by capacity, Hermes traits one per half; no trait
 * falls due before its prerequisites, and an NPC basket trait's prerequisites
 * fall due by its NPC's biome.
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
  const { needs } = createDraftPrerequisites(
    catalog,
    spec.basketTraitKeys,
    draftStartTraits(catalog, route, spec.loadout),
  );
  const traitOrder = prerequisiteOrder(
    [...interleaved, ...shuffle(godTraits.filter((key) => godsOf(key).length > 1))],
    needs,
  );
  const traitPlaces = spread(traitOrder.length, biomeKeys, capacity);
  const last = biomeKeys.length - 1;
  const due = new Map<string, number>();
  const dueAfterNeeds = (key: string) =>
    prerequisiteDue(needs.get(key) ?? [], (member) => due.get(member), last);
  traitOrder.forEach((key, i) => due.set(key, Math.max(traitPlaces[i]!, dueAfterNeeds(key))));
  const hermes = draftHermesTraitKeys(catalog);
  const hermesTraits = prerequisiteOrder(
    spec.basketTraitKeys.filter((key) => hermes.has(key)),
    needs,
  );
  hermesTraits.forEach((key, i) => {
    const half = i === 0 ? firstHalf.length - 1 : last;
    const previous = i === 0 ? 0 : due.get(hermesTraits[i - 1]!)!;
    due.set(key, Math.max(half, previous, dueAfterNeeds(key)));
  });
  pullNpcPrerequisites(catalog, route, spec, needs, due, traitOrder, capacity);
  const scheduled = [...traitOrder, ...hermesTraits];
  return Object.freeze({
    byBiome: Object.freeze(
      biomeKeys.map((biomeKey, index) =>
        Object.freeze({
          biomeKey,
          traitKeys: Object.freeze(scheduled.filter((key) => due.get(key) === index)),
        }),
      ),
    ),
  });
}
