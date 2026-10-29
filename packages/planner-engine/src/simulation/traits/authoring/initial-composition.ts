import type { Catalog, TraitRarity } from '../../../catalog-schema';
import type {
  AuthoredRerolledTraitScreen,
  AuthoredTraitOffer,
  RerolledScreens,
} from '../../../authored-project/traits/state';
import type { TraitHistoryState } from '../history/model';
import type { ResolvedTraitOfferSource } from '../offer-domain';
import { boonReplacementChance, limitedSwapUses } from '../offer-domain';
import type { SimulationState } from '../../state/model';
import { deriveBoonRarityValues } from '../rarity';

export interface InitialOfferOption {
  readonly traitKey: string;
  readonly rarity: TraitRarity;
}

export interface InitialOfferInput {
  readonly catalog: Catalog;
  readonly giverKey: string;
  readonly state: SimulationState;
  readonly source: ResolvedTraitOfferSource;
  /** Declaration requirements before ownership and occupied-slot exclusions. */
  readonly declarationEligible: (traitKey: string) => boolean;
  readonly replacementFor: (traitKey: string) => InitialOfferOption | undefined;
}

export interface InitialOfferSupport {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly findings: readonly { readonly code: 'traitOfferGenerationUnavailable' }[];
}

interface InitialOfferPools {
  readonly rarityOrder: readonly TraitRarity[];
  readonly chances: Readonly<Partial<Record<TraitRarity, number>>>;
  readonly membership: ReadonlyMap<string, readonly TraitRarity[]>;
  readonly fresh: readonly string[];
  readonly coreSeeds: readonly (readonly string[])[];
  readonly replacements: readonly InitialOfferOption[];
  readonly replacementChance: number;
  readonly linked: readonly string[];
  readonly finalRescue: boolean;
}

function coreSeeds(
  catalog: Catalog,
  priority: readonly string[],
  history: TraitHistoryState,
): readonly (readonly string[])[] {
  const vacant = priority.filter((key) => {
    const slot = catalog.traits.byKey[key]!.equipmentSlot;
    return (
      history.equippedTraits[key] === undefined &&
      (slot === undefined || history.equippedSlots[slot] === undefined)
    );
  });
  // The marker is provider/declaration-specific, not "any core in history".
  if (vacant.length !== priority.length)
    return vacant.length === 0 ? [[]] : vacant.map((key) => [key]);
  if (vacant.length <= 3) return [vacant];
  const guaranteed = (key: string) => {
    const slot = catalog.traits.byKey[key]!.equipmentSlot;
    return slot === 'Melee' || slot === 'Secondary';
  };
  const requireAttackOrSpecial = vacant.some(guaranteed);
  const sets: string[][] = [];
  for (let i = 0; i < vacant.length; i += 1)
    for (let j = i + 1; j < vacant.length; j += 1)
      for (let k = j + 1; k < vacant.length; k += 1) {
        const keys = [vacant[i]!, vacant[j]!, vacant[k]!];
        if (!requireAttackOrSpecial || keys.some(guaranteed)) sets.push(keys);
      }
  return sets;
}

/**
 * The vacant core traits when a fresh offer from this god holds only them, every
 * core seed filling all three positions; undefined when other traits can appear.
 */
export function initialOfferCoreOnlyKeys(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
): readonly string[] | undefined {
  const priority = catalog.traitGivers.byKey[giverKey]?.priorityTraitKeys ?? [];
  const seeds = coreSeeds(catalog, priority, history);
  if (priority.length === 0 || !seeds.every((seed) => seed.length === 3)) return undefined;
  return Object.freeze([...new Set(seeds.flat())]);
}

function preparePools(input: InitialOfferInput): InitialOfferPools | undefined {
  const {
    catalog,
    giverKey,
    state,
    source: offerSource,
    declarationEligible,
    replacementFor,
  } = input;
  const history = state.traitHistory;
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver?.providerKind !== 'olympian' && giver?.providerKind !== 'hermes') return undefined;
  const eligible = giver.traitKeys.filter(declarationEligible);
  const fresh = eligible.filter((key) => {
    const slot = catalog.traits.byKey[key]!.equipmentSlot;
    return (
      history.equippedTraits[key] === undefined &&
      (slot === undefined || history.equippedSlots[slot] === undefined)
    );
  });
  const membership = new Map(
    eligible.map((key) => {
      const domain = catalog.traits.byKey[key]!.rarityDomain;
      return [
        key,
        domain.kind === 'ranked' ? domain.freshOfferRarities : (['Common'] as const),
      ] as const;
    }),
  );
  const priority = giver.priorityTraitKeys.filter(declarationEligible);
  const forceCommon = offerSource.freshRarityOverride === 'Common';
  const facts = offerSource.boonRarityFacts ?? {
    providerBase: catalog.boonRarityBases[giver.providerKind],
    rollOrder: giver.boonRarityRollOrder ?? catalog.boonRarityRollOrder,
    contributions: [],
  };
  // ForceCommon clears the table; BlockRarities then writes present zero
  // entries. Presence matters in final rescue: Lua treats zero as true.
  const chances: Partial<Record<TraitRarity, number>> = forceCommon
    ? {}
    : { ...deriveBoonRarityValues(facts) };
  if (offerSource.devotionNoDuo === true) chances.Duo = 0;
  return {
    rarityOrder: facts.rollOrder,
    chances,
    membership,
    fresh,
    coreSeeds: coreSeeds(catalog, priority, history),
    replacements: priority.flatMap((key) => {
      const replacement = replacementFor(key);
      return replacement === undefined ? [] : [replacement];
    }),
    replacementChance:
      limitedSwapUses(state) > 0
        ? 1
        : forceCommon
          ? 0
          : (offerSource.replacementRollChance ?? boonReplacementChance(catalog, state)),
    linked: fresh.filter((traitKey) => catalog.traits.byKey[traitKey]!.optionalLinkedPriority),
    finalRescue: offerSource.finalRarityRescueDisabled !== true,
  };
}

type Selection = readonly InitialOfferOption[];

/** Traverses the three native display positions. Validation restricts possible
 * winners, never the full pools consulted by mandatory stages. Construction
 * stops at the first supported terminal through the same stage policy. */
function findOutcome(
  pools: InitialOfferPools,
  acceptsOption: (option: InitialOfferOption) => boolean,
  acceptsOutcome: (options: Selection) => boolean,
  /** A reroll's one banned item of the previous screen, excluded after seeding. */
  banned?: string,
): Selection | undefined {
  const { rarityOrder, chances } = pools;
  // A dropped banned replacement seed also leaves the rescue list.
  let seededReplacement: InitialOfferOption | undefined;
  const used = (selected: Selection, key: string) =>
    selected.some((option) => option.traitKey === key);
  const bucket = (selected: Selection, rarity: TraitRarity) =>
    pools.fresh.filter(
      (key) =>
        key !== banned && !used(selected, key) && pools.membership.get(key)!.includes(rarity),
    );
  const append = (selected: Selection, option: InitialOfferOption): Selection | undefined =>
    used(selected, option.traitKey) || !acceptsOption(option) ? undefined : [...selected, option];
  const terminal = (selected: Selection) => (acceptsOutcome(selected) ? selected : undefined);

  function finalRescue(selected: Selection): Selection | undefined {
    if (!pools.finalRescue || selected.length === 3) return terminal(selected);
    let rarity: TraitRarity = 'Common';
    let keys = bucket(selected, rarity);
    for (const check of rarityOrder) {
      const next = bucket(selected, check);
      if (chances[check] !== undefined && next.length > 0) {
        rarity = check;
        keys = next;
      }
    }
    if (keys.length === 0) return terminal(selected);
    for (const traitKey of keys) {
      const next = append(selected, { traitKey, rarity });
      const result = next === undefined ? undefined : finalRescue(next);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  function replacementRescue(selected: Selection): Selection | undefined {
    if (selected.length === 3) return terminal(selected);
    // Rescue reads the unpruned core list, so it may re-offer the banned item.
    const replacements = pools.replacements.filter(
      (option) => option !== seededReplacement && !used(selected, option.traitKey),
    );
    if (replacements.length === 0) return finalRescue(selected);
    for (const option of replacements) {
      const next = append(selected, option);
      const result = next === undefined ? undefined : replacementRescue(next);
      if (result !== undefined) return result;
    }
    // A remaining replacement cannot be skipped because it is absent from the
    // authored proposal. Native rescue must fill that vacancy.
    return undefined;
  }

  function ordinaryDraw(selected: Selection, attempts: number): Selection | undefined {
    if (attempts === 0) return replacementRescue(selected);
    const checks = rarityOrder.filter((rarity) => bucket(selected, rarity).length > 0);
    const winners = ['Common' as const, ...checks.filter((rarity) => rarity !== 'Common')];
    for (const rarity of winners) {
      if (rarity !== 'Common' && (chances[rarity] ?? 0) <= 0) continue;
      const later = rarity === 'Common' ? checks : checks.slice(checks.indexOf(rarity) + 1);
      if (later.some((check) => (chances[check] ?? 0) >= 1)) continue;
      for (const traitKey of bucket(selected, rarity)) {
        const next = append(selected, { traitKey, rarity });
        const result = next === undefined ? undefined : ordinaryDraw(next, attempts - 1);
        if (result !== undefined) return result;
      }
    }
    // A failed attempt uses a position in the draw loop, not a displayed row.
    if (
      bucket(selected, 'Common').length === 0 &&
      checks.every((check) => (chances[check] ?? 0) < 1)
    )
      return ordinaryDraw(selected, attempts - 1);
    return undefined;
  }

  function seedRarities(
    keys: readonly (string | InitialOfferOption)[],
    selected: Selection = [],
  ): Selection | undefined {
    const [seed, ...rest] = keys;
    if (seed === undefined) return ordinaryDraw(selected, 3 - selected.length);
    const traitKey = typeof seed === 'string' ? seed : seed.traitKey;
    const membership = pools.membership.get(traitKey) ?? [];
    const checks = rarityOrder.filter((rarity) => membership.includes(rarity));
    const rarities =
      typeof seed !== 'string'
        ? [seed.rarity]
        : [
            ...(checks.every((check) => (chances[check] ?? 0) < 1) ? ['Common' as const] : []),
            ...checks.filter(
              (rarity, index) =>
                (chances[rarity] ?? 0) > 0 &&
                checks.slice(index + 1).every((later) => (chances[later] ?? 0) < 1),
            ),
          ];
    for (const rarity of rarities) {
      const next = append(selected, { traitKey, rarity });
      const result = next === undefined ? undefined : seedRarities(rest, next);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  function linkedSeeds(
    keys: readonly (string | InitialOfferOption)[],
    index = 0,
  ): Selection | undefined {
    const traitKey = pools.linked[index];
    if (keys.length === 3 || traitKey === undefined)
      return seedRarities(
        keys.filter((key) => (typeof key === 'string' ? key : key.traitKey) !== banned),
      );
    return linkedSeeds(keys, index + 1) ?? linkedSeeds([...keys, traitKey], index + 1);
  }

  if (pools.replacementChance > 0)
    for (const replacement of pools.replacements) {
      seededReplacement = replacement;
      const result = linkedSeeds([replacement]);
      if (result !== undefined) return result;
    }
  seededReplacement = undefined;
  if (pools.replacementChance < 1 || pools.replacements.length === 0)
    for (const keys of pools.coreSeeds) {
      const result = linkedSeeds(keys);
      if (result !== undefined) return result;
    }
  return undefined;
}

/**
 * Whether native generation can show these rows. A rerolled screen follows a
 * previous one: some item of it is banned for this generation. An unknown
 * previous screen is judged as a first screen.
 */
function screenSupported(
  pools: InitialOfferPools,
  options: readonly { readonly traitKey: string; readonly rarity?: TraitRarity }[],
  previous: AuthoredRerolledTraitScreen | null | undefined,
): boolean {
  const wanted = new Map(options.map((option) => [option.traitKey, option.rarity]));
  if (wanted.size !== options.length || options.length > 3) return false;
  const bans: readonly (string | undefined)[] =
    previous === undefined || previous === null || previous.options.length === 0
      ? [undefined]
      : previous.options.map((option) => option.traitKey);
  return bans.some(
    (banned) =>
      findOutcome(
        pools,
        (option) => wanted.has(option.traitKey) && wanted.get(option.traitKey) === option.rarity,
        (selected) => selected.length === options.length,
        banned,
      ) !== undefined,
  );
}

function support(applies: boolean, legal: boolean): InitialOfferSupport {
  return Object.freeze({
    applies,
    legal,
    findings: legal
      ? Object.freeze([])
      : Object.freeze([{ code: 'traitOfferGenerationUnavailable' as const }]),
  });
}

/** The final screen's support, after its last rerolled screen when it has one. */
export function assessInitialOfferSupport(
  input: Omit<InitialOfferInput, 'giverKey'> & { readonly offer: AuthoredTraitOffer },
): InitialOfferSupport {
  const pools = preparePools({ ...input, giverKey: input.offer.giverKey });
  if (pools === undefined) return support(false, true);
  const offer = input.offer;
  return support(
    true,
    screenSupported(
      pools,
      offer.kind === 'traits' ? offer.options : [],
      offer.kind === 'traits' ? offer.rerolledScreens?.at(-1) : undefined,
    ),
  );
}

/**
 * Each rerolled-away screen's support, oldest first: the first follows the
 * first-screen rule, every later one bans an item of the screen before it.
 * Undefined for a screen not yet authored or a giver without staged generation.
 */
export function assessRerolledScreensSupport(
  input: InitialOfferInput,
  screens: RerolledScreens<AuthoredRerolledTraitScreen>,
): readonly (InitialOfferSupport | undefined)[] {
  const pools = preparePools(input);
  return Object.freeze(
    screens.map((screen, index) =>
      pools === undefined || screen === null
        ? undefined
        : support(
            true,
            screenSupported(pools, screen.options, index === 0 ? undefined : screens[index - 1]),
          ),
    ),
  );
}

/** A native-supported initial outcome; an empty array is the Gold terminal. */
export function initialOfferStartingOptions(
  input: InitialOfferInput,
): readonly InitialOfferOption[] | undefined {
  const pools = preparePools(input);
  if (pools === undefined) return undefined;
  const outcome = findOutcome(
    pools,
    () => true,
    () => true,
  );
  return outcome === undefined
    ? undefined
    : Object.freeze(outcome.map((option) => Object.freeze({ ...option })));
}

/**
 * The first legal chain of `count` rerolled-away screens before these final
 * rows: the last of them holds an item whose ban lets the final rows appear.
 * Undefined when the search finds none or the giver has no staged generation.
 */
export function guessRerolledScreens(
  input: InitialOfferInput,
  finalOptions: readonly { readonly traitKey: string; readonly rarity?: TraitRarity }[],
  count: number,
): readonly AuthoredRerolledTraitScreen[] | undefined {
  const pools = preparePools(input);
  if (pools === undefined || count < 1) return undefined;
  const wanted = new Map(finalOptions.map((option) => [option.traitKey, option.rarity]));
  const banCandidates = [
    ...new Set([...pools.fresh, ...pools.replacements.map((option) => option.traitKey)]),
  ];
  const linkBan = banCandidates.find(
    (banned) =>
      findOutcome(
        pools,
        (option) => wanted.has(option.traitKey) && wanted.get(option.traitKey) === option.rarity,
        (selected) => selected.length === finalOptions.length,
        banned,
      ) !== undefined,
  );
  if (linkBan === undefined) return undefined;
  const screens: AuthoredRerolledTraitScreen[] = [];
  for (let index = 0; index < count; index += 1) {
    const last = index === count - 1;
    const previous = screens[index - 1];
    const bans: readonly (string | undefined)[] =
      previous === undefined || previous.options.length === 0
        ? [undefined]
        : previous.options.map((option) => option.traitKey);
    let next: Selection | undefined;
    for (const banned of bans) {
      next = findOutcome(
        pools,
        () => true,
        (selected) => !last || selected.some((option) => option.traitKey === linkBan),
        banned,
      );
      if (next !== undefined) break;
    }
    if (next === undefined) return undefined;
    screens.push(
      Object.freeze({
        options: Object.freeze(next.map((option) => Object.freeze({ ...option }))),
      }),
    );
  }
  return Object.freeze(screens);
}
