import type { GoldCatalogDeclaration } from '@run-planner/engine/catalog-schema';

export const gold = {
  // TraitData.lua:1147-1175 FallbackGold MoneyDropAmount 90 (UpgradeChoiceLogic.lua:149-151).
  fallbackGold: 90,
  // SellTraitData.lua:172-187; SellTraitLogic.lua:443-468 GetBaseRarityValue / GetTraitValue.
  purgingPoolSale: {
    byRarity: {
      Common: { min: 30, max: 50 },
      Rare: { min: 70, max: 90 },
      Epic: { min: 140, max: 160 },
      Heroic: { min: 210, max: 230 },
      Duo: { min: 250, max: 270 },
      Legendary: { min: 400, max: 450 },
    },
    infusion: { min: 100, max: 130 },
    unranked: 20,
    perLevel: 20,
    roundDownTo: 5,
  },
} as const satisfies GoldCatalogDeclaration;
