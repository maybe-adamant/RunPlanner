import type { Catalog, TraitRarity } from '../../catalog-schema';
import { failProjectDocument } from '../validation';

export interface TraitMaxHealthRollDomain {
  readonly minimum: number;
  readonly maximum: number;
}

/** The trait's roll offset width above its acquired rarity's minimum; undefined when it has no roll. */
export function traitMaxHealthRollWidth(catalog: Catalog, traitKey: string): number | undefined {
  return catalog.traits.byKey[traitKey]?.acquisitionMaxHealthRoll?.width;
}

/** The max-health range at one acquired rarity, when the trait rolls max health. */
export function traitMaxHealthRollDomain(
  catalog: Catalog,
  traitKey: string,
  rarity: TraitRarity | undefined,
): TraitMaxHealthRollDomain | undefined {
  const roll = catalog.traits.byKey[traitKey]?.acquisitionMaxHealthRoll;
  if (roll === undefined || rarity === undefined) return undefined;
  const minimum = (roll.minimumByRarity as Readonly<Partial<Record<TraitRarity, number>>>)[rarity];
  return minimum === undefined
    ? undefined
    : Object.freeze({ minimum, maximum: minimum + roll.width });
}

/** The max health realized at the acquired rarity: its minimum plus the authored offset. */
export function resolveTraitMaxHealthRoll(
  catalog: Catalog,
  traitKey: string,
  acquiredRarity: TraitRarity | undefined,
  offset: number | undefined,
): number | undefined {
  const domain = traitMaxHealthRollDomain(catalog, traitKey, acquiredRarity);
  return domain === undefined ? undefined : domain.minimum + (offset ?? 0);
}

/** Why a persisted roll offset is not representable for this trait, or undefined when it is. */
export function traitMaxHealthRollProblem(
  catalog: Catalog,
  traitKey: string,
  value: unknown,
): string | undefined {
  const width = traitMaxHealthRollWidth(catalog, traitKey);
  if (width === undefined) return `${traitKey} has no max-health roll`;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > width)
    return `must be an integer offset from 0 through ${width}`;
  return undefined;
}

export function decodeMaxHealthRoll(
  catalog: Catalog,
  traitKey: string,
  value: unknown,
  path: string,
): number | undefined {
  const problem = traitMaxHealthRollProblem(catalog, traitKey, value);
  if (problem !== undefined) failProjectDocument(path, problem);
  // A zero offset decodes to the canonical omission.
  return value === 0 ? undefined : (value as number);
}

/** Omits a zero offset, the canonical encoding of the minimum roll. */
export function canonicalMaxHealthRoll<Option extends { readonly maxHealthRoll?: number }>(
  option: Option,
): Option {
  if (option.maxHealthRoll !== 0) return option;
  const { maxHealthRoll: _roll, ...withoutRoll } = option;
  void _roll;
  return Object.freeze(withoutRoll) as Option;
}
