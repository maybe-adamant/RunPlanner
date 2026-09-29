import type {
  BiomeLayout,
  Catalog,
  RoomDeclaration,
  RouteInitialProfileDeclaration,
} from '../catalog-schema';
import type { SaveFileGodHistory } from '../reward-kernel/model';
import type { RouteWeaponAspectLoadout } from './model';

export function routeInitialProfile(
  catalog: Catalog,
  routeKey: string,
): RouteInitialProfileDeclaration {
  const route = catalog.routes.byKey[routeKey];
  if (route === undefined) throw new Error(`unknown route ${routeKey}`);
  return route.initialProfile;
}

/** The run's actual equipment: authored on a mature save, the fixed Staff on a fresh one. */
export function resolveRouteEquipment(
  catalog: Catalog,
  routeKey: string,
  loadout: RouteWeaponAspectLoadout,
): { readonly weaponKey: string; readonly aspectKey: string | null } {
  const profile = routeInitialProfile(catalog, routeKey);
  if (profile.kind === 'freshFile')
    return Object.freeze({ weaponKey: profile.fixedWeaponKey, aspectKey: null });
  if (loadout.weaponKey === null || loadout.aspectKey === null)
    throw new Error(`${routeKey} mature loadout requires a weapon and aspect`);
  return Object.freeze({ weaponKey: loadout.weaponKey, aspectKey: loadout.aspectKey });
}

/** Whether the route's first entry receives the route-owned starting reward. */
export function routeBindsRunStartReward(catalog: Catalog, routeKey: string): boolean {
  return routeInitialProfile(catalog, routeKey).kind === 'matureSave';
}

/** The god use and pickup history the route's save file starts with. */
export function routeSaveFileGodHistory(catalog: Catalog, routeKey: string): SaveFileGodHistory {
  return routeInitialProfile(catalog, routeKey).kind === 'freshFile' ? 'closed' : 'mature';
}

/** The declared start pool of one biome under the route's save profile. */
export function resolveBiomeStart(
  catalog: Catalog,
  routeKey: string,
  layout: BiomeLayout,
): BiomeLayout['start'] {
  const profile = routeInitialProfile(catalog, routeKey);
  if (
    profile.kind === 'freshFile' &&
    catalog.rooms.byKey[profile.openingRoomGameName]?.roomSetKey === layout.biomeKey
  ) {
    return Object.freeze({ kind: 'fixedAuthored', roomGameName: profile.openingRoomGameName });
  }
  return layout.start;
}

/** Every room the resolved start pool admits. */
export function biomeStartRoomGameNames(start: BiomeLayout['start']): readonly string[] {
  return start.kind === 'authoredChoice' ? start.roomGameNames : [start.roomGameName];
}

/**
 * Generated encounter customization is unavailable on a fresh profile, whose
 * first encounters depend on native enemy introductions.
 */
export function routeSupportsGeneratedEncounterCustomization(
  catalog: Catalog,
  routeKey: string,
): boolean {
  return routeInitialProfile(catalog, routeKey).kind === 'matureSave';
}

/** The room's Stygian Well host on this route; absent where the route's profile lacks it. */
export function routeRoomShop(
  room: RoomDeclaration | undefined,
  routeKey: string,
): RoomDeclaration['roomShop'] {
  return room?.roomShop?.excludedRouteKeys?.includes(routeKey) === true
    ? undefined
    : room?.roomShop;
}

/** The room's usable Purging Pool on this route. */
export function routePurgingPool(
  room: RoomDeclaration | undefined,
  routeKey: string,
): RoomDeclaration['purgingPool'] {
  return room?.purgingPool?.excludedRouteKeys?.includes(routeKey) === true
    ? undefined
    : room?.purgingPool;
}

/** Whether the room offers its keepsake rack on this route. */
export function routeHasKeepsakeRack(room: RoomDeclaration | undefined, routeKey: string): boolean {
  return (
    room?.hasKeepsakeRack === true &&
    room.keepsakeRackExcludedRouteKeys?.includes(routeKey) !== true
  );
}
