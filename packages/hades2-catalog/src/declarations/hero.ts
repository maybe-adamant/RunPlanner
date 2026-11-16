/** HeroData.lua: the hero's base maxima before any trait. */
export const heroMaxStats = { maxHealth: 30, maxMana: 50 } as const;

/**
 * HeroData.lua:71-72. `ChooseNextRewardStore` falls back to it in a room whose room set's base
 * block declares no target (RoomLogic.lua:3852): only the biome bases F, G, H, I, O, P and Q
 * declare one.
 */
export const heroMetaRewardsTarget = {
  targetMetaRewardsRatio: 0.45,
  targetMetaRewardsAdjustSpeed: 10,
} as const;
