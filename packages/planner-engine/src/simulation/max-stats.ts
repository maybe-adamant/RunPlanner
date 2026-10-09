import type {
  Catalog,
  InRunTraitRarity,
  MaxStatKey,
  TraitMaxStatValue,
  TraitRarity,
} from '../catalog-schema';
import type { SimulationState } from './state/model';
import { aspectIsPerfect, familiarStackMultiplier } from './traits/equipment-upgrades';

/** The declaration that owns one flat contribution. */
export type MaxStatSource =
  | { readonly kind: 'base' }
  | { readonly kind: 'pickups' }
  | {
      readonly kind: 'aspect' | 'familiar' | 'arcana' | 'keepsake' | 'trait' | 'chaos';
      readonly key: string;
    };

export interface MaxStatContribution {
  readonly source: MaxStatSource;
  readonly maxHealth: number;
  readonly maxMana: number;
}

/** `ValidateMaxHealth` and `GetExpectedMaxMana` over one reached state. */
export interface MaxStats {
  readonly maxHealth: number;
  readonly maxMana: number;
  /** Flat additions before multipliers, base first; fractions are kept. */
  readonly flat: readonly MaxStatContribution[];
  /** One plus every multiplier's excess over one. */
  readonly multipliers: Readonly<Record<MaxStatKey, number>>;
  /** Flat health from `ceil(max Magick)` conversions. */
  readonly convertedHealth: number;
  /** Present while an active keepsake cap fixes max health. */
  readonly maxHealthCap?: { readonly maxHealth: number; readonly keepsakeKey: string };
}

/** A flat amount folded state records when granted; no held declaration re-derives it. */
export interface MaxStatGrant {
  readonly source:
    | { readonly kind: 'pickups' }
    | { readonly kind: 'trait' | 'arcana' | 'keepsake'; readonly key: string };
  readonly maxHealth: number;
  readonly maxMana: number;
}

/**
 * The recorded grants among `deriveMaxStats`' flat terms: pickups, trait
 * acquisition rolls and room-growth grants, Arcana room-entry growth, and each
 * keepsake max-Magick grant in grant order. Aspect, familiar, Arcana card,
 * per-element, decay and Chaos terms follow from what is held.
 */
export function deriveMaxStatGrants(state: SimulationState): readonly MaxStatGrant[] {
  const grants: MaxStatGrant[] = [];
  const add = (source: MaxStatGrant['source'], maxHealth: number, maxMana: number) => {
    if (maxHealth !== 0 || maxMana !== 0)
      grants.push(Object.freeze({ source: Object.freeze(source), maxHealth, maxMana }));
  };
  const { maxStatGains } = state.rewardHistory;
  add({ kind: 'pickups' }, maxStatGains.maxHealth, maxStatGains.maxMana);
  for (const [key, grant] of Object.entries(state.traitHistory.maxStatGrants ?? {}))
    add({ kind: 'trait', key }, grant.maxHealth, grant.maxMana);
  for (const [key, growth] of Object.entries(state.arcanaFear.arcana.roomEntryGrowth ?? {}))
    add({ kind: 'arcana', key }, growth.maxHealthGranted, growth.maxManaGranted);
  for (const [key, amounts] of Object.entries(state.keepsakes.maxManaGrants ?? {}))
    for (const amount of amounts) add({ kind: 'keepsake', key }, 0, amount);
  return Object.freeze(grants);
}

/** Lua `round`: `floor(x + 0.5)`. */
function round(value: number): number {
  return Math.floor(value + 0.5);
}

function valueAt(value: TraitMaxStatValue, rarity: TraitRarity | undefined): number | undefined {
  if (typeof value === 'number') return value;
  return rarity === undefined ? undefined : value[rarity as InRunTraitRarity];
}

/**
 * Derives both maxima from folded state: flat sources sum with fractions, the
 * summed multipliers scale base plus every flat source, and each total rounds
 * once. Magick resolves first because conversion reads `ceil(max Magick)`.
 */
export function deriveMaxStats(catalog: Catalog, state: SimulationState): MaxStats {
  const contributions = new Map<
    string,
    { source: MaxStatSource; maxHealth: number; maxMana: number }
  >();
  const add = (source: MaxStatSource, stat: MaxStatKey, amount: number) => {
    if (amount === 0) return;
    const key =
      source.kind === 'base' || source.kind === 'pickups'
        ? source.kind
        : `${source.kind}:${source.key}`;
    const entry = contributions.get(key) ?? { source, maxHealth: 0, maxMana: 0 };
    entry[stat] += amount;
    contributions.set(key, entry);
  };
  const multipliers = { maxHealth: 1, maxMana: 1 };
  let conversion = 0;
  const { traitHistory, arcanaFear, keepsakes, equipment, rewardHistory } = state;

  add({ kind: 'base' }, 'maxHealth', catalog.heroMaxStats.maxHealth);
  add({ kind: 'base' }, 'maxMana', catalog.heroMaxStats.maxMana);
  add({ kind: 'pickups' }, 'maxHealth', rewardHistory.maxStatGains.maxHealth);
  add({ kind: 'pickups' }, 'maxMana', rewardHistory.maxStatGains.maxMana);

  const aspect =
    equipment.aspectKey === null ? undefined : catalog.aspects.byKey[equipment.aspectKey];
  if (aspect?.maxStatBonus !== undefined) {
    const bonus = aspect.maxStatBonus;
    add(
      { kind: 'aspect', key: aspect.key },
      bonus.stat,
      aspectIsPerfect(catalog, traitHistory) ? bonus.upgradedAmount : bonus.amount,
    );
  }

  const familiar =
    equipment.familiarKey === null ? undefined : catalog.familiars.byKey[equipment.familiarKey];
  if (familiar?.maxStatPerStack !== undefined) {
    const stacks =
      (familiar.matureStatUpgradeCount + 1) * familiarStackMultiplier(catalog, traitHistory);
    add(
      { kind: 'familiar', key: familiar.key },
      familiar.maxStatPerStack.stat,
      familiar.maxStatPerStack.amount * stacks,
    );
  }

  for (const card of arcanaFear.arcana.active) {
    const bonus = catalog.arcanaCards.byKey[card.key]?.maxStatBonus;
    if (bonus === undefined) continue;
    add({ kind: 'arcana', key: card.key }, 'maxHealth', bonus.maxHealthByRarity[card.rarity]);
    add({ kind: 'arcana', key: card.key }, 'maxMana', bonus.maxManaByRarity[card.rarity]);
  }
  for (const [cardKey, growth] of Object.entries(arcanaFear.arcana.roomEntryGrowth ?? {})) {
    add({ kind: 'arcana', key: cardKey }, 'maxHealth', growth.maxHealthGranted);
    add({ kind: 'arcana', key: cardKey }, 'maxMana', growth.maxManaGranted);
  }

  for (const [keepsakeKey, grants] of Object.entries(keepsakes.maxManaGrants ?? {}))
    for (const grant of grants) add({ kind: 'keepsake', key: keepsakeKey }, 'maxMana', grant);
  const capEffect =
    keepsakes.maxHealthCap?.status === 'active'
      ? catalog.keepsakes.byKey[keepsakes.maxHealthCap.keepsakeKey]?.effect
      : undefined;
  const maxHealthCap =
    capEffect?.kind === 'maxHealthCap' && keepsakes.maxHealthCap !== undefined
      ? Object.freeze({
          maxHealth: capEffect.maxHealth,
          keepsakeKey: keepsakes.maxHealthCap.keepsakeKey,
        })
      : undefined;

  for (const [traitKey, grant] of Object.entries(traitHistory.maxStatGrants ?? {})) {
    add({ kind: 'trait', key: traitKey }, 'maxHealth', grant.maxHealth);
    add({ kind: 'trait', key: traitKey }, 'maxMana', grant.maxMana);
  }
  for (const equipped of Object.values(traitHistory.equippedTraits)) {
    const source = { kind: 'trait', key: equipped.traitKey } as const;
    const decay = equipped.roomDecay;
    if (decay?.startMaxima !== undefined) {
      add(source, 'maxHealth', decay.startMaxima.maxHealth * decay.fraction);
      add(source, 'maxMana', decay.startMaxima.maxMana * decay.fraction);
    }
    const effect = catalog.traits.byKey[equipped.traitKey]?.maxStatEffect;
    switch (effect?.kind) {
      case 'multiplier':
        for (const stat of ['maxHealth', 'maxMana'] as const) {
          const value =
            effect[stat] === undefined ? undefined : valueAt(effect[stat], equipped.rarity);
          if (value !== undefined) multipliers[stat] += value - 1;
        }
        break;
      case 'manaToHealthConversion':
        conversion += valueAt(effect.fraction, equipped.rarity) ?? 0;
        break;
      case 'perElement':
        add(source, effect.stat, effect.amount * traitHistory.elementCounts[effect.element]);
        break;
      case 'familiarStackMultiplier':
      case undefined:
        break;
    }
  }

  for (const curse of traitHistory.activeChaosCurses) {
    const operand = catalog.chaos.curses.byKey[curse.curseKey]?.maxStatOperand;
    if (operand !== undefined)
      add(
        { kind: 'chaos', key: curse.curseKey },
        operand.stat,
        curse.curseValues[operand.operandKey] ?? 0,
      );
  }
  for (const blessing of traitHistory.maturedChaosBlessings) {
    const operand = catalog.chaos.blessings.byKey[blessing.blessingKey]?.maxStatOperand;
    if (operand !== undefined)
      add(
        { kind: 'chaos', key: blessing.blessingKey },
        operand.stat,
        blessing.blessingValues[operand.operandKey] ?? 0,
      );
  }

  const flat = [...contributions.values()].map((entry) => Object.freeze({ ...entry }));
  const flatMana = flat.reduce((total, entry) => total + entry.maxMana, 0);
  const maxMana = round(flatMana * multipliers.maxMana);
  const convertedHealth = conversion * Math.ceil(maxMana);
  const flatHealth = flat.reduce((total, entry) => total + entry.maxHealth, 0) + convertedHealth;
  const maxHealth =
    maxHealthCap?.maxHealth ?? Math.max(1, round(flatHealth * multipliers.maxHealth));
  return Object.freeze({
    maxHealth,
    maxMana,
    flat: Object.freeze(flat),
    multipliers: Object.freeze(multipliers),
    convertedHealth,
    ...(maxHealthCap === undefined ? {} : { maxHealthCap }),
  });
}
