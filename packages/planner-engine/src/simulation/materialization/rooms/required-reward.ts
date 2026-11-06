import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { RequiredRewardDrop } from '../model';

/**
 * The drop a room forces as its required reward at its route position: a Dream
 * run's drop replaces it where the room can spawn the Dream reward, and a
 * ramping drop adds its step for each biome entered before this one.
 */
export function resolveRequiredRewardDrop(
  catalog: Catalog,
  room: RoomDeclaration,
  routePosition: ResolvedRoutePosition,
): RequiredRewardDrop | undefined {
  const declared = room.requiredReward;
  if (declared === undefined) return undefined;
  const dreamDropKey = declared.canSpawnDreamReward
    ? catalog.routes.byKey[routePosition.routeKey]?.dreamRewardDropKey
    : undefined;
  const dropKey = dreamDropKey ?? declared.dropKey;
  const drop = catalog.requiredRewardDrops.byKey[dropKey];
  if (drop === undefined) throw new Error(`${room.gameName} forces unknown drop ${dropKey}`);
  return Object.freeze({
    consumableKey: drop.key,
    resourceKey: drop.resourceKey,
    amount: drop.amount + drop.amountPerClearedBiome * (routePosition.ordinal - 1),
  });
}
