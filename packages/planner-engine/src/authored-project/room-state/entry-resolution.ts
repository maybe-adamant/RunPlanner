import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { CountedRewardBinding, RewardProducerBinding } from '../../reward-kernel/bindings';
import type { ResolvedRoutePosition } from '../route-context';
import {
  routeBindsRunStartReward,
  routeInitialProfile,
  routeRoomDeclaration,
} from '../route-profile';

/**
 * Resolves the room a route position realizes: the route's overlay, then its
 * contextual encounter rule. Reward ownership is bound separately by the
 * route-start product.
 */
export function resolveEntryDeclaration(
  declaration: RoomDeclaration,
  routePosition: Pick<ResolvedRoutePosition, 'routeKey' | 'isFirst'>,
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
  /** A fresh profile's opening draws the run-start reward's type and spawns nothing. */
  readonly unspawnedRunStartRoll?: UnspawnedRewardRoll;
}

/** A counted draw that removes one reward type from its store with no offer or acquisition. */
export interface UnspawnedRewardRoll {
  readonly binding: CountedRewardBinding;
  readonly storeKey: string;
}

/**
 * The route's first active topology entry binds the one route-owned reward, or
 * on a fresh profile only rolls it; all other entries retain their rewardless
 * room declarations.
 */
export function resolveEntryRoom(
  catalog: Catalog,
  declaration: RoomDeclaration,
  routePosition: ResolvedRoutePosition,
  entry: boolean,
): ResolvedEntryRoom {
  const contextualDeclaration = resolveEntryDeclaration(declaration, routePosition);
  const runStartReward = routeBindsRunStartReward(catalog, routePosition.routeKey);
  const binding = catalog.runStartReward.incomingReward;
  const storeKey = binding.storeKeys[0];
  if (binding.storeKeys.length !== 1 || storeKey === undefined)
    throw new Error('run-start reward must declare one counted reward store');
  const entersStore = contextualDeclaration.enteredRewardStoreHistory.kind === 'resolvedOffer';
  if (
    entry &&
    routePosition.isFirst &&
    routeInitialProfile(catalog, routePosition.routeKey).kind === 'freshFile'
  )
    return Object.freeze({
      declaration: contextualDeclaration,
      runStartReward: false,
      incomingRewardBinding: contextualDeclaration.incomingReward,
      lifecycleProfileKey:
        contextualDeclaration.encounterEnvelopeKey === 'EmptyEncounter'
          ? 'RewardlessRoom'
          : 'RewardlessCombatRoom',
      ...(entersStore ? { enteredRewardStoreKey: storeKey } : {}),
      unspawnedRunStartRoll: Object.freeze({ binding, storeKey }),
    });
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
  return Object.freeze({
    declaration: contextualDeclaration,
    runStartReward: true,
    incomingRewardBinding: binding,
    lifecycleProfileKey:
      contextualDeclaration.encounterEnvelopeKey === 'EmptyEncounter'
        ? 'OpeningRewardNoEncounterRoom'
        : 'OpeningRewardRoom',
    incomingRewardStoreKey: storeKey,
    ...(entersStore ? { enteredRewardStoreKey: storeKey } : {}),
  });
}
