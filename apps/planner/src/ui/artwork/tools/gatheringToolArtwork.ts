import iconExorcism from './assets/Exorcism.webp';
import iconFishing from './assets/Fishing.webp';
import iconPickaxe from './assets/Pickaxe.webp';
import iconShovel from './assets/Shovel.webp';

/** Gathering tool icons by catalog resource family; `null` marks a key with no icon yet. */
export const gatheringToolArtwork: Readonly<Record<string, string | null>> = {
  Exorcism: iconExorcism,
  Fishing: iconFishing,
  Pickaxe: iconPickaxe,
  Shovel: iconShovel,
};
