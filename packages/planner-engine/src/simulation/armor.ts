import type { Catalog } from '../catalog-schema';
import type { SimulationState } from './state/model';

/** The owner of one lasting armor amount. */
export type ArmorSource =
  | { readonly kind: 'trait'; readonly key: string }
  | { readonly kind: 'items' }
  | { readonly kind: 'keepsake'; readonly key: string; readonly origin: 'ordinary' | 'echo' };

export interface ArmorContribution {
  readonly source: ArmorSource;
  readonly armor: number;
}

/** Lasting hero armor at one reached state, assuming no damage taken. */
export interface Armor {
  readonly armor: number;
  /** Held traits in acquisition order, then items, then the Silken Sash. */
  readonly sources: readonly ArmorContribution[];
}

const silkenSashKeys = new WeakMap<Catalog, string>();

/** The keepsake whose effect is the Silken Sash's, resolved once per catalog. */
function silkenSashKey(catalog: Catalog): string {
  let key = silkenSashKeys.get(catalog);
  if (key === undefined) {
    key = catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === 'silkenSash')?.key;
    if (key === undefined) throw new Error('Silken Sash state has no declared keepsake');
    silkenSashKeys.set(catalog, key);
  }
  return key;
}

/**
 * Sums held armor traits at their rarity and Pom level, the hidden
 * `MinorArmorBoon` item total and the held Silken Sash's `CurrentArmor`.
 */
export function deriveArmor(catalog: Catalog, state: SimulationState): Armor {
  const sources: ArmorContribution[] = [];
  const add = (source: ArmorSource, armor: number) => {
    if (armor > 0) sources.push(Object.freeze({ source: Object.freeze(source), armor }));
  };
  // `CostumeArmor` reads the first held trait of a source, so a later one adds nothing.
  const heldSources = new Set<string>();
  for (const equipped of Object.values(state.traitHistory.equippedTraits)) {
    const declared = catalog.traits.byKey[equipped.traitKey]?.armor;
    if (declared === undefined || heldSources.has(declared.source)) continue;
    heldSources.add(declared.source);
    let armor: number | undefined;
    if (declared.amount.kind === 'byAcquisitionOrdinal') {
      armor = equipped.armor;
    } else if (equipped.rarity !== undefined && equipped.rarity in declared.amount.byRarity) {
      const { byRarity, levelBonuses } = declared.amount;
      armor = byRarity[equipped.rarity as keyof typeof byRarity];
      for (let level = 1; level < (equipped.level ?? 1); level += 1)
        armor += levelBonuses[level - 1] ?? levelBonuses.at(-1) ?? 0;
    }
    if (armor !== undefined) add({ kind: 'trait', key: equipped.traitKey }, armor);
  }
  add({ kind: 'items' }, state.rewardHistory.itemArmor);
  const sash = state.keepsakes.silkenSash;
  if (sash !== undefined) {
    const sashKey = silkenSashKey(catalog);
    add({ kind: 'keepsake', key: sashKey, origin: sash.origin }, sash.currentArmor);
  }
  return Object.freeze({
    armor: sources.reduce((total, entry) => total + entry.armor, 0),
    sources: Object.freeze(sources),
  });
}
