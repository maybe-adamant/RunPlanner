import type { RequiredRewardDropDeclaration } from '@run-planner/engine/catalog-schema';

/**
 * ConsumableData.lua boss drops and their HelpText display names. Each adds one
 * profile resource; only DreamPointsDrop ramps (`AddResourceIncreasePerBiomeCleared`,
 * applied per `CurrentRun.EnteredBiomes - 1` by InteractLogic.lua:1240).
 */
export const requiredRewardDrops = [
  drop('MixerFBossDrop', 'Cinder', 'MixerFBoss'),
  drop('MixerGBossDrop', 'Pearl', 'MixerGBoss'),
  drop('MixerHBossDrop', 'Tears', 'MixerHBoss'),
  drop('MixerIBossDrop', 'Zodiac Sand', 'MixerIBoss'),
  drop('MixerNBossDrop', 'Wool', 'MixerNBoss'),
  drop('MixerOBossDrop', 'Golden Apple', 'MixerOBoss'),
  drop('MixerPBossDrop', 'Feather', 'MixerPBoss'),
  drop('MixerQBossDrop', 'Void Lens', 'MixerQBoss'),
  drop('GemPointsBigDrop', 'Gemstones', 'GemPoints', 50),
  drop('DreamPointsDrop', 'Shiny Stars', 'DreamPoints', 1, 1),
] as const satisfies readonly RequiredRewardDropDeclaration[];

function drop(
  key: string,
  label: string,
  resourceKey: string,
  amount = 1,
  amountPerClearedBiome = 0,
): RequiredRewardDropDeclaration {
  return { key, label, resourceKey, amount, amountPerClearedBiome };
}
