import type {
  BoonRarityContribution,
  BoonRarityOverride,
  BoonRarityValues,
  TraitRarity,
} from '../catalog-schema';

export const BOON_RARITY_CHECKS = ['Rare', 'Epic', 'Duo', 'Legendary'] as const;
type Check = (typeof BOON_RARITY_CHECKS)[number];

export interface BoonRarityFacts {
  readonly providerBase: BoonRarityValues;
  readonly roomOverride?: BoonRarityOverride;
  readonly itemOverride?: BoonRarityOverride;
  readonly contributions: readonly BoonRarityContribution[];
}

export interface BoonRarityLedger {
  readonly values: BoonRarityValues;
  readonly possibleFreshRarities: readonly TraitRarity[];
}

const emptyValues = (): Record<Check, number> => ({ Rare: 0, Epic: 0, Duo: 0, Legendary: 0 });

/** Assembles the game ordered chance table without probability normalization. */
export function deriveBoonRarityLedger(
  facts: BoonRarityFacts,
  supportedRarities: readonly TraitRarity[],
): BoonRarityLedger {
  const override = facts.roomOverride ?? facts.itemOverride;
  const values: Record<Check, number> = emptyValues();
  for (const check of BOON_RARITY_CHECKS)
    values[check] = override?.[check] ?? facts.providerBase[check];
  for (const contribution of facts.contributions) {
    for (const check of BOON_RARITY_CHECKS) values[check] += contribution.additive?.[check] ?? 0;
  }
  for (const contribution of facts.contributions) {
    for (const check of BOON_RARITY_CHECKS)
      values[check] *= contribution.multiplicative?.[check] ?? 1;
  }
  const supportedChecks = BOON_RARITY_CHECKS.filter((check) => supportedRarities.includes(check));
  const possible = new Set<TraitRarity>();
  for (let index = 0; index < supportedChecks.length; index += 1) {
    const check = supportedChecks[index]!;
    if (values[check] <= 0) continue;
    if (supportedChecks.slice(index + 1).every((later) => values[later] < 1)) {
      possible.add(check);
    }
  }
  if (supportedChecks.every((check) => values[check] < 1)) possible.add('Common');
  return Object.freeze({
    values: Object.freeze(values),
    possibleFreshRarities: Object.freeze(
      supportedRarities.filter((rarity) => possible.has(rarity)),
    ),
  });
}

export function boonRarityRollUnavailable(
  facts: BoonRarityFacts,
  rarity: TraitRarity,
  supportedRarities: readonly TraitRarity[],
): boolean {
  if (rarity === 'Heroic') return false;
  return !deriveBoonRarityLedger(facts, supportedRarities).possibleFreshRarities.includes(rarity);
}
