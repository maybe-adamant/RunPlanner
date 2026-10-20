import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import { traitGiverForAcquisitionRole } from '../../authored-project/traits/state';
import { draftSourceQueues, draftStartTraits, draftTraitKind } from './basket';
import {
  createDraftPrerequisites,
  prerequisiteDue,
  prerequisiteOrder,
  type DraftPrerequisiteNeed,
} from './prerequisites';
import { shuffleDraft, type DraftRng } from './rng';
import { draftForfeitActive, type DraftRoute, type DraftSpec } from './spec';
import type { DraftWorldProduct } from './world';

/**
 * Median world-god boon rooms one biome yields: ten seeds each of full
 * Underworld FGHI and Surface NOPQ drafts, counting door rewards, Fields cages
 * and Ship wheel picks. Measured when wanted god boons weighed 25 against 1;
 * steering now weighs them 30 or 60 against 4.
 */
const DRAFT_GOD_ROOM_CAPACITY: Readonly<Record<string, number>> = Object.freeze({
  F: 5,
  G: 2,
  H: 1,
  I: 2,
  N: 5,
  O: 1,
  P: 2,
  Q: 2,
});

/** The Hermes and Daedalus Hammer rewards whose basket traits are scheduled by route half. */
export type DraftSupply = 'hermes' | 'hammer';

/** Every trait a Hermes or Hammer giver offers. */
export function draftSupplyTraitKeys(catalog: Catalog, supply: DraftSupply): ReadonlySet<string> {
  return new Set(
    catalog.traitGivers.values
      .filter((giver) => giver.providerKind === supply)
      .flatMap((giver) => giver.traitKeys),
  );
}

/** Rewards whose acquisition role resolves to a Hermes, Daedalus Hammer or Selene giver. */
export function draftProvider(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): DraftSupply | 'spell' | undefined {
  const roles = catalog.rewards.rewardTypes.byKey[offer.rewardType]?.acquisitionRoles.values ?? [];
  for (const role of roles) {
    const giverKey = traitGiverForAcquisitionRole(catalog, offer, role.key);
    const kind =
      giverKey === undefined ? undefined : catalog.traitGivers.byKey[giverKey]?.providerKind;
    if (kind === 'hermes' || kind === 'hammer' || kind === 'spell') return kind;
  }
  return undefined;
}

/** The basket god, Hermes and Hammer traits to hold by the end of each biome. */
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
  route: DraftRoute,
  npcBiomes: ReadonlyMap<string, number>,
  needs: ReadonlyMap<string, readonly DraftPrerequisiteNeed[]>,
  due: Map<string, number>,
  godTraits: readonly string[],
  capacity: (biomeKey: string) => number,
): void {
  const last = route.itineraryBiomeKeys.length - 1;
  const dueOf = (key: string) => due.get(key);
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
 * Basket god traits spread by capacity, Hermes and Hammer traits one per half;
 * no trait falls due before its prerequisites, and an NPC basket trait's
 * prerequisites fall due by its NPC's biome.
 */
export function draftGodSchedule(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftSpec,
  world: DraftWorldProduct,
  rng: DraftRng,
): DraftGodSchedule {
  const shuffle = <T>(values: readonly T[]) => shuffleDraft(rng, values);
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
  const duo = (traitKey: string) => {
    const trait = catalog.traits.byKey[traitKey];
    return trait !== undefined && draftTraitKind(trait) === 'duo';
  };
  const godTraits = spec.basketTraitKeys.filter((key) => godsOf(key).length > 0);
  const queues = new Map(
    draftSourceQueues(catalog, spec).map((queue) => [queue.giverKey, queue.traitKeys]),
  );
  const byGod = godKeys.map((god) => queues.get(god) ?? []);
  const godQueues = spec.world.godKeys.map((god) => queues.get(god) ?? []);
  const interleaved: string[] = [];
  for (let round = 0; byGod.some((traits) => traits.length > round); round += 1)
    for (const traits of byGod) if (traits[round] !== undefined) interleaved.push(traits[round]!);
  const { needs } = createDraftPrerequisites(
    catalog,
    spec.basketTraitKeys,
    draftStartTraits(catalog, route, spec.loadout),
  );
  const traitOrder = prerequisiteOrder([...interleaved, ...shuffle(godTraits.filter(duo))], needs);
  const traitPlaces = spread(traitOrder.length, biomeKeys, capacity);
  const last = biomeKeys.length - 1;
  const due = new Map<string, number>();
  const dueAfterNeeds = (key: string) =>
    prerequisiteDue(needs.get(key) ?? [], (member) => due.get(member), last);
  traitOrder.forEach((key, i) => due.set(key, Math.max(traitPlaces[i]!, dueAfterNeeds(key))));
  // Each god's slots go to its traits in queue order, never falling due before an earlier one.
  for (const queue of godQueues) {
    const slots = queue.map((key) => due.get(key)!).sort((a, b) => a - b);
    let previous = 0;
    queue.forEach((key, i) => {
      previous = Math.max(slots[i]!, dueAfterNeeds(key), previous);
      due.set(key, previous);
    });
  }
  const supplied = (['hermes', 'hammer'] as const).flatMap((supply) => {
    const traitKeys = draftSupplyTraitKeys(catalog, supply);
    // Hermes and Hammer traits are taken in basket order, as their queues hold them.
    const ordered = [...queues.values()].flat().filter((key) => traitKeys.has(key));
    ordered.forEach((key, i) => {
      const half = i === 0 ? firstHalf.length - 1 : last;
      const previous = i === 0 ? 0 : due.get(ordered[i - 1]!)!;
      due.set(key, Math.max(half, previous, dueAfterNeeds(key)));
    });
    return ordered;
  });
  pullNpcPrerequisites(route, world.npcTraitBiomes, needs, due, traitOrder, capacity);
  // A pulled trait brings its god's earlier traits with it.
  for (const queue of godQueues)
    for (let i = queue.length - 2; i >= 0; i -= 1)
      due.set(queue[i]!, Math.min(due.get(queue[i]!)!, due.get(queue[i + 1]!)!));
  const scheduled = [...traitOrder, ...supplied];
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
