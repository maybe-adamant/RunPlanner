import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RewardProducerBinding } from '../../reward-kernel/bindings';
import type { ResolvedRoutePosition } from '../route-context';
import { routeBindsRunStartReward, routeRoomDeclaration } from '../route-profile';

/**
 * Resolves the room a route position realizes: the route's overlay, then its
 * contextual encounter rule. Reward ownership is bound separately by the
 * route-start product.
 */
export function resolveEntryDeclaration(
  declaration: RoomDeclaration,
  routePosition: ResolvedRoutePosition,
): RoomDeclaration {
  const routed = routeRoomDeclaration(declaration, routePosition.routeKey);
  const contextualEncounter = routed.entryContextualEncounterRules?.find(
    (rule) =>
      rule.routeKey === routePosition.routeKey &&
      (rule.position === 'every' || (rule.position === 'first' && routePosition.isFirst)),
  );
  if (contextualEncounter === undefined) return routed;
  return Object.freeze({
    ...routed,
    encounterSlotBindings: Object.freeze([
      Object.freeze({
        slotKey: 'Encounter',
        kind: 'fixed' as const,
        encounterDefinitionKey: contextualEncounter.encounterDefinitionKey,
      }),
    ]),
  });
}

/** Complete declaration-owned entry contract after the route position is known. */
export interface ResolvedEntryRoom {
  readonly declaration: RoomDeclaration;
  /** Whether this entry binds the route-owned run-start reward. */
  readonly runStartReward: boolean;
  readonly incomingRewardBinding: RewardProducerBinding;
  readonly lifecycleProfileKey?: string;
  /** The run-start producer's resolved store; it is not an entered-store history record. */
  readonly incomingRewardStoreKey?: string;
  /** The resolved run-start offer contributes only when the entry declaration participates. */
  readonly enteredRewardStoreKey?: string;
}

/**
 * The route's first active topology entry binds the one route-owned reward;
 * all other entries retain their rewardless room declarations.
 */
export function resolveEntryRoom(
  catalog: Catalog,
  declaration: RoomDeclaration,
  routePosition: ResolvedRoutePosition,
  entry: boolean,
): ResolvedEntryRoom {
  const contextualDeclaration = resolveEntryDeclaration(declaration, routePosition);
  const runStartReward = routeBindsRunStartReward(catalog, routePosition.routeKey);
  if (!entry || !routePosition.isFirst || !runStartReward)
    return Object.freeze({
      declaration:
        entry && contextualDeclaration.enteredRewardStoreHistory.kind !== 'none'
          ? Object.freeze({
              ...contextualDeclaration,
              enteredRewardStoreHistory: Object.freeze({ kind: 'none' as const }),
            })
          : contextualDeclaration,
      runStartReward: false,
      incomingRewardBinding: contextualDeclaration.incomingReward,
      ...(entry
        ? {
            lifecycleProfileKey:
              contextualDeclaration.encounterEnvelopeKey === 'EmptyEncounter'
                ? 'RewardlessRoom'
                : 'RewardlessCombatRoom',
          }
        : {}),
    });
  const binding = catalog.runStartReward.incomingReward;
  if (binding.storeKeys.length !== 1)
    throw new Error('run-start reward must declare one counted reward store');
  return Object.freeze({
    declaration: contextualDeclaration,
    runStartReward: true,
    incomingRewardBinding: binding,
    lifecycleProfileKey:
      contextualDeclaration.encounterEnvelopeKey === 'EmptyEncounter'
        ? 'OpeningRewardNoEncounterRoom'
        : 'OpeningRewardRoom',
    ...(binding.storeKeys[0] === undefined ? {} : { incomingRewardStoreKey: binding.storeKeys[0] }),
    ...(contextualDeclaration.enteredRewardStoreHistory.kind !== 'resolvedOffer' ||
    binding.storeKeys[0] === undefined
      ? {}
      : { enteredRewardStoreKey: binding.storeKeys[0] }),
  });
}
