import {
  traitMaxHealthRollDomain,
  traitMaxHealthRollWidth,
} from '@run-planner/engine/authored-project';
import type { Catalog, TraitRarity } from '@run-planner/engine/catalog-schema';
import type { WorkspaceMaxHealthRoll } from '@planner/projections/structured-workspace/contracts/traits';

/** One option's authored roll offset presented as realized health at its acquired rarity. */
export function projectMaxHealthRoll(
  catalog: Catalog,
  option: { readonly traitKey: string; readonly maxHealthRoll?: number },
  acquiredRarity: TraitRarity | undefined,
): WorkspaceMaxHealthRoll | undefined {
  const width = traitMaxHealthRollWidth(catalog, option.traitKey);
  const domain = traitMaxHealthRollDomain(catalog, option.traitKey, acquiredRarity);
  if (width === undefined || domain === undefined) return undefined;
  return Object.freeze({
    offset: option.maxHealthRoll ?? 0,
    width,
    minimum: domain.minimum,
    maximum: domain.maximum,
    healthFor: (offset: number) => domain.minimum + offset,
  });
}
