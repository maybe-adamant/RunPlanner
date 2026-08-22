import type { Catalog } from '../catalog-schema';

/** Postboss chronology follows the structural completion role, not room identity or biome order. */
export function postbossCapabilities(
  catalog: Catalog,
  biomeKey: string,
): {
  readonly hasPostbossRoom: boolean;
  readonly hasKeepsakeRack: boolean;
  readonly hasRoomActions: boolean;
} {
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  const hasPostbossRoom =
    layout?.completion.rooms.some((room) => room.role === 'postboss') === true;
  const hasKeepsakeRack = catalog.biomes.byKey[biomeKey]?.hasPostbossKeepsakeRack === true;
  return {
    hasPostbossRoom,
    hasKeepsakeRack,
    hasRoomActions: hasPostbossRoom || hasKeepsakeRack,
  };
}
