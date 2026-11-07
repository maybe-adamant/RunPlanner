import type { GoldCatalogDeclaration, GoldFixedEstimate } from '@run-planner/engine/catalog-schema';

import { requireNonNegativeInteger, requirePositiveInteger } from './common';
import { fail } from './errors';

const SALE_RARITIES = ['Common', 'Rare', 'Epic', 'Heroic', 'Duo', 'Legendary'] as const;

function range(
  raw: { readonly min: number; readonly max: number },
  path: string,
): { readonly min: number; readonly max: number } {
  const min = requirePositiveInteger(raw.min, `${path}.min`);
  const max = requirePositiveInteger(raw.max, `${path}.max`);
  if (max < min) fail(`${path}.max`, 'must not precede min');
  return Object.freeze({ min, max });
}

/** A fixed gold estimate: whole gold inside the range the game can pay. */
export function normalizeGoldFixedEstimate(
  raw: GoldFixedEstimate,
  path: string,
): GoldFixedEstimate {
  const min = requireNonNegativeInteger(raw.range.min, `${path}.range.min`);
  const max = requirePositiveInteger(raw.range.max, `${path}.range.max`);
  const value = requirePositiveInteger(raw.value, `${path}.value`);
  if (value < min || value > max) fail(`${path}.value`, 'must lie within its range');
  return Object.freeze({ value, range: Object.freeze({ min, max }) });
}

export function normalizeGold(raw: GoldCatalogDeclaration): GoldCatalogDeclaration {
  const sale = raw.purgingPoolSale;
  if (Object.keys(sale.byRarity).length !== SALE_RARITIES.length)
    fail('gold.purgingPoolSale.byRarity', 'must declare every sellable rarity');
  return Object.freeze({
    fallbackGold: requirePositiveInteger(raw.fallbackGold, 'gold.fallbackGold'),
    purgingPoolSale: Object.freeze({
      byRarity: Object.freeze(
        Object.fromEntries(
          SALE_RARITIES.map((rarity) => [
            rarity,
            range(sale.byRarity[rarity], `gold.purgingPoolSale.byRarity.${rarity}`),
          ]),
        ),
      ) as GoldCatalogDeclaration['purgingPoolSale']['byRarity'],
      infusion: range(sale.infusion, 'gold.purgingPoolSale.infusion'),
      unranked: requirePositiveInteger(sale.unranked, 'gold.purgingPoolSale.unranked'),
      perLevel: requireNonNegativeInteger(sale.perLevel, 'gold.purgingPoolSale.perLevel'),
      roundDownTo: requirePositiveInteger(sale.roundDownTo, 'gold.purgingPoolSale.roundDownTo'),
    }),
  });
}
