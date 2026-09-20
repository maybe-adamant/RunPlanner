import type { Catalog, TraitRarity } from '../../../catalog-schema';
import type { AuthoredTraitOffer } from '../../../authored-project/traits/state';
import type { TraitHistoryState } from '../history/model';
import type { ResolvedTraitOfferSource } from '../offer-domain';
import { limitedSwapUses } from '../offer-domain';
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
          : (offerSource.replacementRollChance ?? catalog.boonReplacementChance),
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
): Selection | undefined {
  const { rarityOrder, chances } = pools;
  const used = (selected: Selection, key: string) =>
    selected.some((option) => option.traitKey === key);
  const bucket = (selected: Selection, rarity: TraitRarity) =>
    pools.fresh.filter(
      (key) => !used(selected, key) && pools.membership.get(key)!.includes(rarity),
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
    const replacements = pools.replacements.filter((option) => !used(selected, option.traitKey));
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
    if (keys.length === 3 || traitKey === undefined) return seedRarities(keys);
    return linkedSeeds(keys, index + 1) ?? linkedSeeds([...keys, traitKey], index + 1);
  }

  if (pools.replacementChance > 0)
    for (const replacement of pools.replacements) {
      const result = linkedSeeds([replacement]);
      if (result !== undefined) return result;
    }
  if (pools.replacementChance < 1 || pools.replacements.length === 0)
    for (const keys of pools.coreSeeds) {
      const result = linkedSeeds(keys);
      if (result !== undefined) return result;
    }
  return undefined;
}

export function assessInitialOfferSupport(
  input: Omit<InitialOfferInput, 'giverKey'> & { readonly offer: AuthoredTraitOffer },
): InitialOfferSupport {
  const pools = preparePools({ ...input, giverKey: input.offer.giverKey });
  if (pools === undefined)
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const options = input.offer.kind === 'traits' ? input.offer.options : [];
  const wanted = new Map(options.map((option) => [option.traitKey, option.rarity]));
  const supported =
    wanted.size === options.length &&
    options.length <= 3 &&
    findOutcome(
      pools,
      (option) => wanted.has(option.traitKey) && wanted.get(option.traitKey) === option.rarity,
      (selected) => selected.length === options.length,
    ) !== undefined;
  return Object.freeze({
    applies: true,
    legal: supported,
    findings: supported
      ? Object.freeze([])
      : Object.freeze([{ code: 'traitOfferGenerationUnavailable' as const }]),
  });
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
