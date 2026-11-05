import iconDraft from './assets/Draft.webp';
import iconLoadout from './assets/Loadout.webp';
import iconNpcs from './assets/Npcs.webp';
import iconPools from './assets/Pools.webp';
import iconResources from './assets/Resources.webp';
import iconRoute from './assets/Route.webp';
import iconShrines from './assets/Shrines.webp';
import iconTraits from './assets/Traits.webp';
import iconWells from './assets/Wells.webp';

/** The editor's panel navigation icons by panel kind. */
export const navigationArtwork: Readonly<Record<string, string | null>> = {
  route: iconRoute,
  draft: iconDraft,
  loadout: iconLoadout,
  npcIndex: iconNpcs,
  traits: iconTraits,
  resources: iconResources,
  shrines: iconShrines,
  wells: iconWells,
  pools: iconPools,
};
