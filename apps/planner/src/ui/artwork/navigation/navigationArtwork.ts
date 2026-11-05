import iconDraft from './assets/Draft.webp';
import iconLoadout from './assets/Loadout.webp';
import iconNpcs from './assets/Npcs.webp';
import iconPools from './assets/Pools.webp';
import iconResources from './assets/Resources.webp';
import iconRouteDream from './assets/RouteDream.webp';
import iconRouteSurface from './assets/RouteSurface.webp';
import iconRouteUnderworld from './assets/RouteUnderworld.webp';
import iconShrines from './assets/Shrines.webp';
import iconTraits from './assets/Traits.webp';
import iconWells from './assets/Wells.webp';

/** The editor's panel navigation icons by panel kind. */
export const navigationArtwork: Readonly<Record<string, string | null>> = {
  draft: iconDraft,
  loadout: iconLoadout,
  npcIndex: iconNpcs,
  traits: iconTraits,
  resources: iconResources,
  shrines: iconShrines,
  wells: iconWells,
  pools: iconPools,
};

/** The Route panel's icon: the route's own; a Fresh File plays the Underworld. */
export const routeNavigationArtwork: Readonly<Record<string, string | null>> = {
  Underworld: iconRouteUnderworld,
  FreshFile: iconRouteUnderworld,
  Surface: iconRouteSurface,
  Dream: iconRouteDream,
};
