import type { Catalog } from '../catalog-schema';
import type { CountedRewardBinding } from '../reward-kernel/bindings';
import type { ResolvedRewardOffer } from '../reward-kernel/model';
import type { AuthoredRewardState, RoomOccurrence } from './model';
import type { RerolledRewardOwner } from './rerolls';
import { requireShipCombatWheels } from './room-state/declaration';
import { resolveEntryDeclaration } from './room-state/entry-resolution';
import type { ResolvedRoutePosition } from './route-context';
import { createUnresolvedAcquisitionRewardState } from './traits/state';

/** The counted binding whose acquisition an owner's rerolled reward follows. */
export function rerolledRewardBinding(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
): CountedRewardBinding | undefined {
  const raw = catalog.rooms.byKey[occurrence.gameName];
  if (raw === undefined) return undefined;
  const room = resolveEntryDeclaration(raw, routePosition);
  switch (owner.kind) {
    case 'incomingReward':
      return room.incomingReward.kind === 'countedChoice' ? room.incomingReward : undefined;
    case 'localReward': {
      const cages = room.localChildren.find((child) => child.key === owner.groupKey);
      return cages?.kind === 'boundedRewardSlots' ? cages.reward : undefined;
    }
    case 'rewardWheelOffer':
      return requireShipCombatWheels(catalog, room, occurrence.gameName).find(
        (wheel) => wheel.key === owner.wheelKey,
      )?.reward;
  }
}

/**
 * The unresolved acquisition of a reward an owner's press drew; undefined when
 * the owner can never draw it, so its item holds no outcomes (its press
 * reports it).
 */
export function unresolvedRerolledReward(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
  offer: ResolvedRewardOffer,
): AuthoredRewardState | undefined {
  const binding = rerolledRewardBinding(catalog, routePosition, occurrence, owner);
  return binding === undefined || !binding.allowedRewardTypes.includes(offer.rewardType)
    ? undefined
    : createUnresolvedAcquisitionRewardState(
        catalog,
        offer,
        { kind: 'producerLifecycle', key: binding.producerLifecycleKey },
        routePosition.routeKey,
      );
}
