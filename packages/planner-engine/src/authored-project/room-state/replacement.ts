import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { AuthoredRoomState } from '../model';
import { requireEphyraSideRooms, requireFieldsCages, requireShipCombatWheels } from './declaration';
import { reconcileRoomEncounterState } from './encounters';

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
      const previousOffer = previousState.cages[slotKey];
      const replacementOffer = replacementState.cages[slotKey];
      if (replacementOffer === undefined) {
        throw new Error(`${replacementRoom.gameName} default omitted cage ${slotKey}`);
      }
      return [
        slotKey,
        previousOffer !== undefined &&
        previousDescriptor.slotKeys.includes(slotKey) &&
        countedOfferIsAdmitted(replacementDescriptor.reward, previousOffer)
          ? previousOffer
          : replacementOffer,
      ];
    }),
  );
  return Object.freeze({ kind: 'fieldsCombat', cages: Object.freeze(cages) });
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
          const previousOffer = previousWheel.offers[offerKey];
          const replacementOffer = replacementWheel.offers[offerKey];
          if (replacementOffer === undefined) {
            throw new Error(
              `${replacementRoom.gameName} default omitted ${descriptor.key}.${offerKey}`,
            );
          }
          return [
            offerKey,
            previousDescriptor.offerKeys.includes(offerKey) &&
            previousOffer !== undefined &&
            countedOfferIsAdmitted(descriptor.reward, previousOffer)
              ? previousOffer
              : replacementOffer,
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
  catalog: Catalog,
  previousRoom: RoomDeclaration,
  previousState: Extract<AuthoredRoomState, { readonly kind: 'ephyraCombat' }>,
  replacementRoom: RoomDeclaration,
  replacementState: Extract<AuthoredRoomState, { readonly kind: 'ephyraCombat' }>,
): AuthoredRoomState {
  if (!roomUsesTemplate(previousRoom, 'EphyraCombat')) {
    return replacementState;
  }
  const previousDescriptor = requireEphyraSideRooms(previousRoom, previousRoom.gameName);
  const replacementDescriptor = requireEphyraSideRooms(replacementRoom, replacementRoom.gameName);
  if (
    previousDescriptor?.key !== replacementDescriptor?.key ||
    previousDescriptor === undefined ||
    replacementDescriptor === undefined
  ) {
    return replacementState;
  }
  const previousSlots = new Map(previousDescriptor.slots.map((slot) => [slot.slotKey, slot]));
  const retainedEntryOrder: { readonly slotKey: string; readonly ordinal: number }[] = [];
  const reconciled = replacementDescriptor.slots.map((slot) => {
    const fallback = replacementState.sideRooms[slot.slotKey];
    if (fallback === undefined) {
      throw new Error(`${replacementRoom.gameName} default omitted side room ${slot.slotKey}`);
    }
    const previousSlot = previousSlots.get(slot.slotKey);
    const previousSide = previousState.sideRooms[slot.slotKey];
    if (
      previousSlot === undefined ||
      previousSlot.roomGameName !== slot.roomGameName ||
      previousSide === undefined
    ) {
      return { slotKey: slot.slotKey, state: fallback };
    }
    const previousChild = catalog.rooms.byKey[previousSlot.roomGameName];
    const replacementChild = catalog.rooms.byKey[slot.roomGameName];
    if (previousChild === undefined || replacementChild === undefined) {
      throw new Error(`${replacementRoom.gameName} references an unknown side-room declaration`);
    }
    if (previousSide.enteredOrdinal !== null && previousSide.generation === 'generated') {
      retainedEntryOrder.push({ slotKey: slot.slotKey, ordinal: previousSide.enteredOrdinal });
    }
    const childBinding = replacementChild.incomingReward;
    const offer =
      childBinding.kind === 'countedChoice' &&
      countedOfferIsAdmitted(childBinding, previousSide.offer)
        ? previousSide.offer
        : fallback.offer;
    return {
      slotKey: slot.slotKey,
      state: Object.freeze({
        generation: previousSide.generation,
        enteredOrdinal: null,
        offer,
        encounters: reconcileRoomEncounterState(
          catalog,
          previousChild,
          previousSide.encounters,
          replacementChild,
          fallback.encounters,
        ),
      }),
    };
  });
  retainedEntryOrder.sort((left, right) => left.ordinal - right.ordinal);
  const retainedOrdinalBySlot = new Map(
    retainedEntryOrder.map((entry, index) => [entry.slotKey, index + 1]),
  );
  const sideRooms = Object.fromEntries(
    reconciled.map(({ slotKey, state }) => [
      slotKey,
      retainedOrdinalBySlot.has(slotKey)
        ? Object.freeze({ ...state, enteredOrdinal: retainedOrdinalBySlot.get(slotKey) ?? null })
        : state,
    ]),
  );
  const parentBinding = replacementRoom.incomingReward;
  return Object.freeze({
    kind: 'ephyraCombat',
    offer:
      parentBinding.kind === 'countedChoice' &&
      countedOfferIsAdmitted(parentBinding, previousState.offer)
        ? previousState.offer
        : replacementState.offer,
    sideRooms: Object.freeze(sideRooms),
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
        countedOfferIsAdmitted(replacementRoom.incomingReward, previousState.offer)
        ? Object.freeze({ kind: 'counted', offer: previousState.offer })
        : replacementState;
    case 'anomaly':
    case 'fixed':
    case 'shop':
    case 'freeReward':
      return replacementState;
    case 'fieldsCombat':
      return previousState.kind === 'fieldsCombat' &&
        roomUsesTemplate(replacementRoom, 'FieldsCombat')
        ? reconcileFieldsCombatState(previousRoom, previousState, replacementRoom, replacementState)
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
