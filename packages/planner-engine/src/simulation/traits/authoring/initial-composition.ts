import type { Catalog, TraitRarity } from '../../../catalog-schema';
import type {
  AuthoredRerolledTraitScreen,
  AuthoredTraitOffer,
  RerolledScreens,
  TraitOptionKey,
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

/** Why a fresh-rarity row cannot hold its rarity. */
export type TraitOfferRarityCause =
  /** The trait is never offered fresh at this rarity. */
  | 'notInTrait'
  /** This rarity has no chance at this offer. */
  | 'noChance'
  /** The offer forces Common. */
  | 'forcedCommon'
  /** A Devotion offer rolls no Duo. */
  | 'devotion'
  /** A later rarity of the trait is guaranteed, so it rolls that one. */
  | 'guaranteed'
  /** A replacement keeps the rarity of the boon it replaces. */
  | 'replacement';

/**
 * Why the game cannot show a screen. Exact local rules are checked first;
 * single-row and pair conflicts come from the same staged search; `generic`
 * names no single violated rule (attempt limits, bucket depletion, seeds).
 */
export type TraitOfferGenerationCause =
  | {
      readonly reason: 'duplicateTrait';
      readonly traitKey: string;
      readonly optionKeys: readonly TraitOptionKey[];
    }
  | {
      /** The row's trait cannot appear on this screen at all. */
      readonly reason: 'traitUnavailable';
      readonly traitKey: string;
      readonly optionKey: TraitOptionKey;
    }
  | {
      readonly reason: 'rarityUnavailable';
      readonly traitKey: string;
      readonly optionKey: TraitOptionKey;
      /** The row's authored rarity. */
      readonly rarity: TraitRarity;
      readonly rarityCause: TraitOfferRarityCause;
      /** The guaranteed or replacement rarity the row would have instead. */
      readonly requiredRarity?: TraitRarity;
      /** The guaranteed rarity's chance, as a fraction (1.1 is 110%). */
      readonly requiredChance?: number;
    }
  | {
      /** Each way this screen can start needs a core or exchange boon these rows lack. */
      readonly reason: 'coreTraitsFirst';
      readonly traitKeys: readonly string[];
    }
  | {
      /** A short screen while this trait could still fill it; absent past three rows. */
      readonly reason: 'screenSize';
      readonly traitKey?: string;
    }
  | {
      /** These two rows never appear together. */
      readonly reason: 'pairConflict';
      readonly traitKeys: readonly string[];
      readonly optionKeys: readonly TraitOptionKey[];
    }
  | { readonly reason: 'generic' };

export type TraitOfferGenerationReason = TraitOfferGenerationCause['reason'];

export type InitialOfferFinding =
  | ({ readonly code: 'traitOfferGenerationUnavailable' } & (
      | TraitOfferGenerationCause
      /** Unexplained: the caller did not ask why. */
      | { readonly reason?: never }
    ))
  /** A rerolled screen legal only without its ban needs an item of the previous screen gone. */
  | { readonly code: 'rollRepeatsAllOffers' };

export interface InitialOfferSupport {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly findings: readonly InitialOfferFinding[];
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
  /** NPC rows keep their own rarity checks; staged generation decides only which traits show. */
  readonly rarityFree: boolean;
  /** No priority traits: a first screen showing every fresh trait refuses its reroll. */
  readonly blocksRerollWhenExhausted: boolean;
  readonly forcedCommon: boolean;
  readonly devotionNoDuo: boolean;
}

/**
 * Whether the giver's screens follow the staged generation: Olympians and
 * Hermes always, NPC givers once a screen is rerolled, where only the ban
 * link and the rows' identities are judged.
 */
export function stagedTraitGeneration(
  catalog: Catalog,
  offer: Pick<AuthoredTraitOffer, 'kind' | 'giverKey'> & {
    readonly rerolledScreens?: RerolledScreens<unknown>;
  },
): boolean {
  if (offer.kind === 'chaos') return false;
  const kind = catalog.traitGivers.byKey[offer.giverKey]?.providerKind;
  return (
    kind === 'olympian' ||
    kind === 'hermes' ||
    (kind === 'npc' && (offer.rerolledScreens?.length ?? 0) > 0)
  );
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
  if (
    giver?.providerKind !== 'olympian' &&
    giver?.providerKind !== 'hermes' &&
    giver?.providerKind !== 'npc'
  )
    return undefined;
  const eligible = giver.traitKeys.filter(declarationEligible);
  if (giver.providerKind === 'npc')
    // The same SetTraitsOnLoot fill and rescue, with no cores, exchanges or linked seeds.
    return {
      rarityOrder: ['Common'],
      chances: {},
      membership: new Map(eligible.map((key) => [key, ['Common'] as const])),
      fresh: eligible.filter((key) => history.equippedTraits[key] === undefined),
      coreSeeds: [[]],
      replacements: [],
      replacementChance: 0,
      linked: [],
      finalRescue: true,
      rarityFree: true,
      blocksRerollWhenExhausted: true,
      forcedCommon: false,
      devotionNoDuo: false,
    };
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
    rarityFree: false,
    blocksRerollWhenExhausted: giver.priorityTraitKeys.length === 0,
    forcedCommon: forceCommon,
    devotionNoDuo: offerSource.devotionNoDuo === true,
  };
}

type Selection = readonly InitialOfferOption[];

/** Traverses the three native display positions. Validation restricts possible
 * winners, never the full pools consulted by mandatory stages. Construction
 * stops at the first supported terminal through the same stage policy. */
function findOutcome(
  pools: InitialOfferPools,
  acceptsOption: (option: InitialOfferOption, selected: Selection) => boolean,
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
    used(selected, option.traitKey) || !acceptsOption(option, selected)
      ? undefined
      : [...selected, option];
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

type ScreenRow = { readonly traitKey: string; readonly rarity?: TraitRarity };

const OPTION_KEYS: readonly TraitOptionKey[] = ['option1', 'option2', 'option3'];

/**
 * Whether native generation can show these rows. A rerolled screen follows a
 * previous one: some item of it is banned for this generation. After an
 * unauthored screen, any first screen or any single ban is accepted.
 */
function screenSupport(
  pools: InitialOfferPools,
  options: readonly ScreenRow[],
  previous: AuthoredRerolledTraitScreen | null | undefined,
  explainFailure: boolean,
  reportedTraitKeys: ReadonlySet<string>,
): InitialOfferSupport {
  const unshown = (bans: readonly (string | undefined)[]) => {
    if (!explainFailure) return support(false);
    const cause = explainScreenFailure(pools, options, bans, reportedTraitKeys);
    return cause === undefined ? reportedOnly() : support(false, cause);
  };
  const wanted = new Map(options.map((option) => [option.traitKey, option.rarity]));
  if (wanted.size !== options.length || options.length > 3) return unshown([undefined]);
  const shown = (banned: string | undefined) =>
    findOutcome(
      pools,
      (option) =>
        wanted.has(option.traitKey) &&
        (pools.rarityFree || wanted.get(option.traitKey) === option.rarity),
      (selected) => selected.length === options.length,
      banned,
    ) !== undefined;
  if (previous === undefined || (previous !== null && previous.options.length === 0))
    return shown(undefined) ? support(true) : unshown([undefined]);
  const bans = previous === null ? poolKeys(pools) : previous.options.map((row) => row.traitKey);
  if ((previous === null && shown(undefined)) || bans.some(shown)) return support(true);
  if (shown(undefined)) return repeatsAllOffers();
  return unshown(previous === null ? [undefined, ...bans] : bans);
}

/**
 * Why the staged search found no outcome for these rows under any of these
 * bans: exact local rules first, in a fixed order, then probes of the same
 * search over subsets of the rows. Called only after the search failed.
 * A row whose own finding already reports it is never the named cause;
 * undefined when nothing beyond such rows is wrong.
 */
function explainScreenFailure(
  pools: InitialOfferPools,
  rows: readonly ScreenRow[],
  bans: readonly (string | undefined)[],
  reportedTraitKeys: ReadonlySet<string>,
): TraitOfferGenerationCause | undefined {
  const keys = rows.map((row) => row.traitKey);
  const reported = (index: number) => reportedTraitKeys.has(keys[index]!);
  for (const [index, row] of rows.entries()) {
    const optionKeys = OPTION_KEYS.filter((_, at) => keys[at] === row.traitKey);
    if (optionKeys.length > 1)
      return {
        reason: 'duplicateTrait',
        traitKey: row.traitKey,
        optionKeys: Object.freeze(optionKeys),
      };
    if (index >= 3) return { reason: 'screenSize' };
  }
  const { chances, rarityOrder } = pools;
  const seedable = new Set([...pools.linked, ...pools.coreSeeds.flat()]);
  for (const [index, row] of rows.entries()) {
    if (reported(index)) continue;
    const optionKey = OPTION_KEYS[index]!;
    const traitKey = row.traitKey;
    const replacement = pools.replacements.find((option) => option.traitKey === traitKey);
    if (!pools.fresh.includes(traitKey)) {
      if (replacement === undefined) return { reason: 'traitUnavailable', traitKey, optionKey };
      if (!pools.rarityFree && row.rarity !== undefined && row.rarity !== replacement.rarity)
        return {
          reason: 'rarityUnavailable',
          traitKey,
          optionKey,
          rarity: row.rarity,
          rarityCause: 'replacement',
          requiredRarity: replacement.rarity,
        };
      continue;
    }
    const rarity = row.rarity;
    if (pools.rarityFree || rarity === undefined) continue;
    const rarityUnavailable = (
      rarityCause: TraitOfferRarityCause,
      required?: TraitRarity,
    ): TraitOfferGenerationCause => ({
      reason: 'rarityUnavailable',
      traitKey,
      optionKey,
      rarity,
      rarityCause,
      ...(required === undefined
        ? {}
        : { requiredRarity: required, requiredChance: chances[required]! }),
    });
    const membership = pools.membership.get(traitKey) ?? [];
    // A seed may show Common outside its fresh rarities when nothing is guaranteed.
    if (!membership.includes(rarity) && !(rarity === 'Common' && seedable.has(traitKey)))
      return rarityUnavailable('notInTrait');
    // Absent chances never roll or rescue; present zero only rescues.
    if (rarity !== 'Common' && (chances[rarity] === undefined || !pools.finalRescue)) {
      if (chances[rarity] === undefined)
        return rarityUnavailable(pools.forcedCommon ? 'forcedCommon' : 'noChance');
      if (chances[rarity]! <= 0) return rarityUnavailable(zeroChanceCause(pools, rarity));
    }
    // A guaranteed later rarity of this trait wins every draw, seed and rescue.
    const later =
      rarity === 'Common' ? rarityOrder : rarityOrder.slice(rarityOrder.indexOf(rarity) + 1);
    const guaranteed = later.filter(
      (check) => check !== rarity && membership.includes(check) && (chances[check] ?? 0) >= 1,
    );
    if (guaranteed.length > 0) return rarityUnavailable('guaranteed', guaranteed.at(-1));
  }
  // Every generation starts from one of these seeds; the banned item is dropped from it.
  const seeds = [
    ...(pools.replacementChance > 0 ? pools.replacements.map((option) => [option.traitKey]) : []),
    ...(pools.replacementChance < 1 || pools.replacements.length === 0 ? pools.coreSeeds : []),
  ];
  const missingSeedKeys = (banned: string | undefined) =>
    seeds.map((seed) => seed.filter((key) => key !== banned && !keys.includes(key)));
  if (bans.every((banned) => missingSeedKeys(banned).every((missing) => missing.length > 0)))
    return {
      reason: 'coreTraitsFirst',
      traitKeys: Object.freeze([
        ...new Set(bans.flatMap((banned) => missingSeedKeys(banned).flat())),
      ]),
    };
  // Final rescue fills a short screen while any fresh trait has a rescuable rarity.
  if (rows.length < 3 && pools.finalRescue) {
    const fillers = (banned: string | undefined) =>
      pools.fresh.filter(
        (key) =>
          key !== banned &&
          !keys.includes(key) &&
          (pools.rarityFree ||
            pools.membership
              .get(key)!
              .some((rarity) => rarity === 'Common' || chances[rarity] !== undefined)),
      );
    if (bans.every((banned) => fillers(banned).length > 0))
      return { reason: 'screenSize', traitKey: fillers(bans[0])[0]! };
  }
  // Probes: which rows appear together, with the screen's other positions free.
  const witness = (indexes: readonly number[]) => {
    const subset = new Map(indexes.map((index) => [keys[index]!, rows[index]!.rarity]));
    for (const banned of bans) {
      const outcome = findOutcome(
        pools,
        (option, selected) =>
          subset.has(option.traitKey)
            ? pools.rarityFree || subset.get(option.traitKey) === option.rarity
            : selected.filter((entry) => !subset.has(entry.traitKey)).length < 3 - subset.size,
        (selected) => [...subset.keys()].every((key) => selected.some((o) => o.traitKey === key)),
        banned,
      );
      if (outcome !== undefined) return outcome;
    }
    return undefined;
  };
  for (const [index, row] of rows.entries()) {
    if (reported(index) || witness([index]) !== undefined) continue;
    const optionKey = OPTION_KEYS[index]!;
    const rarity = row.rarity;
    if (pools.rarityFree || rarity === undefined)
      return { reason: 'traitUnavailable', traitKey: row.traitKey, optionKey };
    const unavailable = {
      reason: 'rarityUnavailable' as const,
      traitKey: row.traitKey,
      optionKey,
      rarity,
    };
    if (rarity !== 'Common' && (chances[rarity] ?? 0) <= 0)
      return { ...unavailable, rarityCause: zeroChanceCause(pools, rarity) };
    // A guaranteed later rarity skips this draw while any trait can roll it.
    const later =
      rarity === 'Common' ? rarityOrder : rarityOrder.slice(rarityOrder.indexOf(rarity) + 1);
    const guaranteed = later.filter((check) => check !== rarity && (chances[check] ?? 0) >= 1);
    const required = guaranteed.at(-1);
    return required === undefined
      ? { reason: 'traitUnavailable', traitKey: row.traitKey, optionKey }
      : {
          ...unavailable,
          rarityCause: 'guaranteed',
          requiredRarity: required,
          requiredChance: chances[required]!,
        };
  }
  const pairs: (readonly [number, number])[] = [];
  for (let i = 0; i < rows.length; i += 1)
    for (let j = i + 1; j < rows.length; j += 1) pairs.push([i, j]);
  // With at most three rows, dropping one row leaves a pair.
  const conflict = pairs.find((pair) => !pair.some(reported) && witness(pair) === undefined);
  if (conflict !== undefined)
    return {
      reason: 'pairConflict',
      traitKeys: Object.freeze(conflict.map((index) => keys[index]!)),
      optionKeys: Object.freeze(conflict.map((index) => OPTION_KEYS[index]!)),
    };
  // The rows appear together only beside more traits.
  const fuller = rows.length < 3 ? witness(rows.map((_, index) => index)) : undefined;
  const filler = fuller?.find((option) => !keys.includes(option.traitKey));
  if (filler !== undefined) return { reason: 'screenSize', traitKey: filler.traitKey };
  return keys.some((_, index) => reported(index)) ? undefined : { reason: 'generic' };
}

/** Why a rarity with no positive chance is unavailable. */
function zeroChanceCause(pools: InitialOfferPools, rarity: TraitRarity): TraitOfferRarityCause {
  if (pools.forcedCommon) return 'forcedCommon';
  return rarity === 'Duo' && pools.devotionNoDuo ? 'devotion' : 'noChance';
}

function poolKeys(pools: InitialOfferPools): readonly string[] {
  return [...new Set([...pools.fresh, ...pools.replacements.map((option) => option.traitKey)])];
}

/**
 * Whether the game refuses to reroll this first screen: a giver without
 * priority traits shows every fresh trait, so nothing is left to draw.
 */
export function firstScreenRerollRefused(
  input: InitialOfferInput,
  firstScreen: AuthoredRerolledTraitScreen,
): boolean {
  const pools = preparePools(input);
  if (pools === undefined || !pools.blocksRerollWhenExhausted) return false;
  const shown = new Set(firstScreen.options.map((option) => option.traitKey));
  return pools.fresh.every((traitKey) => shown.has(traitKey));
}

function support(legal: boolean, cause?: TraitOfferGenerationCause): InitialOfferSupport {
  return Object.freeze({
    applies: true,
    legal,
    findings: legal
      ? Object.freeze([])
      : Object.freeze([
          Object.freeze({ code: 'traitOfferGenerationUnavailable' as const, ...cause }),
        ]),
  });
}

/** Unshowable only through rows whose own findings already report them. */
function reportedOnly(): InitialOfferSupport {
  return Object.freeze({ applies: true, legal: false, findings: Object.freeze([]) });
}

/** The rows whose own assessment already reports them unavailable. */
export function reportedRowTraitKeys(
  rows: readonly { readonly traitKey: string }[],
  assessments: readonly { readonly legal: boolean }[],
): ReadonlySet<string> {
  return new Set(
    rows.flatMap((row, index) => (assessments[index]?.legal === false ? [row.traitKey] : [])),
  );
}

function repeatsAllOffers(): InitialOfferSupport {
  return Object.freeze({
    applies: true,
    legal: false,
    findings: Object.freeze([Object.freeze({ code: 'rollRepeatsAllOffers' as const })]),
  });
}

/** The final screen's support, after its last rerolled screen when it has one. */
export function assessInitialOfferSupport(
  input: Omit<InitialOfferInput, 'giverKey'> & {
    readonly offer: AuthoredTraitOffer;
    /** Whether an unshowable screen names why; focused row queries do not ask. */
    readonly explainFailure: boolean;
    /** Final-screen rows whose own findings already report them; never named again. */
    readonly reportedTraitKeys?: ReadonlySet<string>;
  },
): InitialOfferSupport {
  const pools = stagedTraitGeneration(input.catalog, input.offer)
    ? preparePools({ ...input, giverKey: input.offer.giverKey })
    : undefined;
  if (pools === undefined)
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const offer = input.offer;
  return screenSupport(
    pools,
    offer.kind === 'traits' ? offer.options : [],
    offer.kind === 'chaos' ? undefined : offer.rerolledScreens?.at(-1),
    input.explainFailure,
    input.reportedTraitKeys ?? new Set(),
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
  /** Whether an unshowable screen names why; focused row queries do not ask. */
  explainFailure: boolean,
  /** Each screen's rows whose own findings already report them; never named again. */
  reportedTraitKeys: (screen: number) => ReadonlySet<string> = () => new Set(),
): readonly (InitialOfferSupport | undefined)[] {
  const pools = preparePools(input);
  return Object.freeze(
    screens.map((screen, index) =>
      pools === undefined || screen === null
        ? undefined
        : screenSupport(
            pools,
            screen.options,
            index === 0 ? undefined : screens[index - 1],
            explainFailure,
            reportedTraitKeys(index),
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
  const linkBan = poolKeys(pools).find(
    (banned) =>
      findOutcome(
        pools,
        (option) =>
          wanted.has(option.traitKey) &&
          (pools.rarityFree || wanted.get(option.traitKey) === option.rarity),
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
