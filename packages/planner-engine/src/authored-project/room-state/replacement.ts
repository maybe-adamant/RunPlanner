import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { AuthoredRoomState } from '../model';
import {
  requireFieldsCages,
  requireFieldsOptionalRewards,
  requireShipCombatWheels,
} from './declaration';

function countedOfferIsAdmitted(
  binding: CountedRewardBinding,
  offer: ResolvedRewardOffer,
): boolean {
  return binding.allowedRewardTypes.includes(offer.rewardType);
}

function roomUsesTemplate(room: RoomDeclaration, templateKey: string): boolean {
  return room.mode.kind === 'authored' && room.mode.templateKey === templateKey;
}

function shipEncounterCountIsAdmitted(
  catalog: Catalog,
  room: RoomDeclaration,
  encounterCount: 2 | 3,
): boolean {
  if (encounterCount === 2) {
    return true;
  }
  return (
    room.encounterEnvelopeKey === 'ShipEncounter' &&
    requireShipCombatWheels(catalog, room, room.gameName).some((wheel) => wheel.key === 'wheel2')
  );
}

function reconcileFieldsCombatState(
  catalog: Catalog,
  previousRoom: RoomDeclaration,
  previousState: Extract<AuthoredRoomState, { readonly kind: 'fieldsCombat' }>,
  replacementRoom: RoomDeclaration,
  replacementState: Extract<AuthoredRoomState, { readonly kind: 'fieldsCombat' }>,
): AuthoredRoomState {
  if (!roomUsesTemplate(previousRoom, 'FieldsCombat')) {
    return replacementState;
  }
  const previousDescriptor = requireFieldsCages(previousRoom, previousRoom.gameName);
  const replacementDescriptor = requireFieldsCages(replacementRoom, replacementRoom.gameName);
  if (previousDescriptor.key !== replacementDescriptor.key) {
    return replacementState;
  }
  const cages = Object.fromEntries(
    replacementDescriptor.slotKeys.map((slotKey) => {
      const previousReward = previousState.cages[slotKey];
      const replacementReward = replacementState.cages[slotKey];
      if (replacementReward === undefined) {
        throw new Error(`${replacementRoom.gameName} default omitted cage ${slotKey}`);
      }
      return [
        slotKey,
        previousReward !== undefined &&
        previousReward !== null &&
        previousDescriptor.slotKeys.includes(slotKey) &&
        countedOfferIsAdmitted(replacementDescriptor.reward, previousReward.offer)
          ? previousReward
          : previousReward === null && previousDescriptor.slotKeys.includes(slotKey)
            ? null
            : replacementReward,
      ];
    }),
  );
  const previousOptional = requireFieldsOptionalRewards(previousRoom, previousRoom.gameName);
  const replacementOptional = requireFieldsOptionalRewards(
    replacementRoom,
    replacementRoom.gameName,
  );
  const optionalRewards = Object.fromEntries(
    replacementOptional.slotKeys.map((slotKey) => {
      const previousReward = previousState.optionalRewards[slotKey];
      const replacementReward = replacementState.optionalRewards[slotKey];
      if (replacementReward === undefined) {
        throw new Error(`${replacementRoom.gameName} default omitted optional reward ${slotKey}`);
      }
      return [
        slotKey,
        previousReward !== undefined &&
        previousReward !== null &&
        previousOptional.slotKeys.includes(slotKey) &&
        countedOfferIsAdmitted(replacementOptional.reward, previousReward.offer)
          ? previousReward
          : previousReward === null && previousOptional.slotKeys.includes(slotKey)
            ? null
            : replacementReward,
      ];
    }),
  );
  const optionalRewardCount = Math.min(
    previousState.optionalRewardCount,
    replacementOptional.optionalRewardCapacity,
  );
  return Object.freeze({
    kind: 'fieldsCombat',
    cages: Object.freeze(cages),
    optionalRewardCount,
    optionalRewards: Object.freeze(optionalRewards),
  });
}

function reconcileShipCombatState(
  catalog: Catalog,
  previousRoom: RoomDeclaration,
  previousState: Extract<AuthoredRoomState, { readonly kind: 'shipCombat' }>,
  replacementRoom: RoomDeclaration,
  replacementState: Extract<AuthoredRoomState, { readonly kind: 'shipCombat' }>,
): AuthoredRoomState {
  if (!roomUsesTemplate(previousRoom, 'ShipCombat')) {
    return replacementState;
  }
  const previousDescriptors = requireShipCombatWheels(catalog, previousRoom, previousRoom.gameName);
  const replacementDescriptors = requireShipCombatWheels(
    catalog,
    replacementRoom,
    replacementRoom.gameName,
  );
  const previousDescriptorByKey = new Map(
    previousDescriptors.map((descriptor) => [descriptor.key, descriptor]),
  );
  const wheels = Object.fromEntries(
    replacementDescriptors.map((descriptor) => {
      const replacementWheel = replacementState.wheels[descriptor.key];
      if (replacementWheel === undefined) {
        throw new Error(`${replacementRoom.gameName} default omitted wheel ${descriptor.key}`);
      }
      const previousDescriptor = previousDescriptorByKey.get(descriptor.key);
      const previousWheel = previousState.wheels[descriptor.key];
      if (previousDescriptor === undefined || previousWheel === undefined) {
        return [descriptor.key, replacementWheel];
      }
      const offerCount =
        previousWheel.offerCount >= descriptor.offerCount.min &&
        previousWheel.offerCount <= descriptor.offerCount.max
          ? previousWheel.offerCount
          : replacementWheel.offerCount;
      const offers = Object.fromEntries(
        descriptor.offerKeys.map((offerKey) => {
          const previousReward = previousWheel.offers[offerKey];
          const replacementReward = replacementWheel.offers[offerKey];
          if (replacementReward === undefined) {
            throw new Error(
              `${replacementRoom.gameName} default omitted ${descriptor.key}.${offerKey}`,
            );
          }
          return [
            offerKey,
            previousDescriptor.offerKeys.includes(offerKey) &&
            previousReward !== undefined &&
            previousReward !== null &&
            countedOfferIsAdmitted(descriptor.reward, previousReward.offer)
              ? previousReward
              : previousReward === null
                ? null
                : replacementReward,
          ];
        }),
      );
      return [
        descriptor.key,
        Object.freeze({
          storeKey: descriptor.reward.storeKeys.includes(previousWheel.storeKey)
            ? previousWheel.storeKey
            : replacementWheel.storeKey,
          offerCount,
          offers: Object.freeze(offers),
          pickedOfferIndex:
            previousWheel.pickedOfferIndex <= offerCount
              ? previousWheel.pickedOfferIndex
              : replacementWheel.pickedOfferIndex,
        }),
      ];
    }),
  );
  return Object.freeze({
    kind: 'shipCombat',
    encounterCount: shipEncounterCountIsAdmitted(
      catalog,
      replacementRoom,
      previousState.encounterCount,
    )
      ? previousState.encounterCount
      : replacementState.encounterCount,
    wheels: Object.freeze(wheels),
  });
}

function reconcileEphyraCombatState(
  _catalog: Catalog,
  previousRoom: RoomDeclaration,
  previousState: Extract<AuthoredRoomState, { readonly kind: 'ephyraCombat' }>,
  replacementRoom: RoomDeclaration,
  replacementState: Extract<AuthoredRoomState, { readonly kind: 'ephyraCombat' }>,
): AuthoredRoomState {
  if (!roomUsesTemplate(previousRoom, 'EphyraCombat')) {
    return replacementState;
  }
  const parentBinding = replacementRoom.incomingReward;
  const parentReward =
    previousState.reward === null
      ? null
      : parentBinding.kind === 'countedChoice' &&
          countedOfferIsAdmitted(parentBinding, previousState.reward.offer)
        ? previousState.reward
        : replacementState.reward;
  return Object.freeze({
    kind: 'ephyraCombat',
    reward: parentReward,
  });
}

/**
 * Reconciles one replacement occurrence's existing leaves into a complete
 * replacement default state. Compatibility is declaration-bounded: this
 * function never evaluates current simulation support or repairs intent.
 * The current production surface retains counted offers plus declaration-keyed
 * Fields cages and ShipCombat wheels; other state families use defaults.
 */
export function reconcileReplacementRoomState(
  catalog: Catalog,
  previousRoom: RoomDeclaration,
  previousState: AuthoredRoomState,
  replacementRoom: RoomDeclaration,
  replacementState: AuthoredRoomState,
): AuthoredRoomState {
  switch (replacementState.kind) {
    case 'none':
      return replacementState;
    case 'counted':
      return previousState.kind === 'counted' &&
        replacementRoom.incomingReward.kind === 'countedChoice' &&
        (previousState.reward === null ||
          countedOfferIsAdmitted(replacementRoom.incomingReward, previousState.reward.offer))
        ? Object.freeze({
            kind: 'counted',
            reward: previousState.reward,
          })
        : replacementState;
    case 'anomaly':
    case 'fixed':
    case 'shop':
    case 'freeReward':
      return replacementState;
    case 'fieldsCombat':
      return previousState.kind === 'fieldsCombat' &&
        roomUsesTemplate(replacementRoom, 'FieldsCombat')
        ? reconcileFieldsCombatState(
            catalog,
            previousRoom,
            previousState,
            replacementRoom,
            replacementState,
          )
        : replacementState;
    case 'shipCombat':
      return previousState.kind === 'shipCombat' && roomUsesTemplate(replacementRoom, 'ShipCombat')
        ? reconcileShipCombatState(
            catalog,
            previousRoom,
            previousState,
            replacementRoom,
            replacementState,
          )
        : replacementState;
    case 'ephyraCombat':
      return previousState.kind === 'ephyraCombat' &&
        roomUsesTemplate(replacementRoom, 'EphyraCombat')
        ? reconcileEphyraCombatState(
            catalog,
            previousRoom,
            previousState,
            replacementRoom,
            replacementState,
          )
        : replacementState;
  }
}
