import type { Catalog } from '@run-planner/engine/catalog-schema';

const fearVowGridOrder = Object.freeze([
  'EnemyDamageShrineUpgrade',
  'EnemyHealthShrineUpgrade',
  'EnemyShieldShrineUpgrade',
  'EnemySpeedShrineUpgrade',
  'EnemyCountShrineUpgrade',
  'NextBiomeEnemyShrineUpgrade',
  'EnemyRespawnShrineUpgrade',
  'EnemyEliteShrineUpgrade',
  'HealingReductionShrineUpgrade',
  'ShopPricesShrineUpgrade',
  'MinibossCountShrineUpgrade',
  'BoonSkipShrineUpgrade',
  'BiomeSpeedShrineUpgrade',
  'LimitGraspShrineUpgrade',
  'BoonManaReserveShrineUpgrade',
  'BanUnpickedBoonsShrineUpgrade',
  'BossDifficultyShrineUpgrade',
]);

/** The Vows in the game's grid order. */
export function fearVowsInGridOrder(catalog: Catalog) {
  return fearVowGridOrder.flatMap((key) => {
    const vow = catalog.fearVows.byKey[key];
    return vow === undefined ? [] : [vow];
  });
}

/** The highest Fear the Vows allow together. */
export function maximumFear(catalog: Catalog): number {
  return fearVowsInGridOrder(catalog).reduce(
    (total, vow) => total + vow.incrementalFear.reduce((sum, fear) => sum + fear, 0),
    0,
  );
}
