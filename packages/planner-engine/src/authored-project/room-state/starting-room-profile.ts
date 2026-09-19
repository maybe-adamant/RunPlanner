import type { RoomDeclaration } from '../../catalog-schema';
import type { ResolvedRoutePosition } from '../route-context';

/**
 * Resolves the declaration-owned starting-room profile at the one
 * route-position authority. The resulting declaration is ephemeral: authored
 * occurrence identity and acquisition state stay with their existing owners.
 */
export function resolveStartingRoomDeclaration(
  declaration: RoomDeclaration,
  routePosition: ResolvedRoutePosition,
): RoomDeclaration {
  const profile = routePosition.isFirst
    ? declaration.startingRoomProfiles?.routeFirst
    : declaration.startingRoomProfiles?.routeLater;
  if (profile === undefined) return declaration;
  const encounterDefinitionKey =
    routePosition.routeKey === 'Dream' ? profile.dreamEncounterDefinitionKey : undefined;
  const { forcedRewardStoreKey: _staticForcedRewardStoreKey, ...base } = declaration;
  void _staticForcedRewardStoreKey;
  return Object.freeze({
    ...base,
    mode: Object.freeze({ kind: 'authored' as const, templateKey: profile.templateKey }),
    incomingReward: profile.incomingReward,
    offerRewardBinding:
      profile.incomingReward.kind === 'none' || profile.incomingReward.kind === 'shop'
        ? Object.freeze({ kind: 'none' as const })
        : Object.freeze({ kind: 'incomingReward' as const }),
    lifecycleProfileKey: profile.lifecycleProfileKey,
    enteredRewardStoreHistory: profile.enteredRewardStoreHistory,
    ...(profile.forcedRewardStoreKey === undefined
      ? {}
      : { forcedRewardStoreKey: profile.forcedRewardStoreKey }),
    ...(encounterDefinitionKey === undefined
      ? {}
      : {
          encounterSlotBindings: Object.freeze([
            Object.freeze({
              slotKey: 'Encounter',
              kind: 'fixed' as const,
              encounterDefinitionKey,
            }),
          ]),
        }),
  });
}
