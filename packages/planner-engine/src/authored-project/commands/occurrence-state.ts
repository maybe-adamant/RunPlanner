import type { Catalog, RewardWheelOfferPoint } from '../../catalog-schema';
import type { BiomeTopology, OccurrenceId, ProjectDocument, RoomOccurrence } from '../model';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { OccurrenceStateCommand } from './types';

function sameOffer(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireWheel(
  topology: BiomeTopology,
  catalog: Catalog,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  wheelKey: string,
  command: OccurrenceStateCommand,
): {
  readonly occurrence: RoomOccurrence;
  readonly state: Extract<RoomOccurrence['state'], { readonly kind: 'shipCombat' }>;
  readonly descriptor: RewardWheelOfferPoint;
} {
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  if (occurrence.state.kind !== 'shipCombat') {
    failCommand(command, `${occurrence.gameName} has no reward wheels`);
  }
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const descriptor = catalog.encounterProfiles.byKey[room.encounterProfileKey]?.phases.find(
    (phase) => phase.offerPoint?.key === wheelKey,
  )?.offerPoint;
  if (descriptor === undefined)
    failCommand(command, `${occurrence.gameName} has no wheel ${wheelKey}`);
  if (occurrence.state.wheels[wheelKey] === undefined) {
    failCommand(command, `${occurrence.gameName} is missing wheel state ${wheelKey}`);
  }
  void topology;
  return { occurrence, state: occurrence.state, descriptor };
}

function requireEphyraSideGroup(
  occurrence: RoomOccurrence,
  catalog: Catalog,
  located: LocatedBiome,
  groupKey: string,
  command: OccurrenceStateCommand,
) {
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCommand(command, `${occurrence.gameName} has no Ephyra side-room state`);
  }
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const group = room.localChildren.find((child) => child.key === groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    failCommand(command, `${occurrence.gameName} has no side-room group ${groupKey}`);
  }
  return { state: occurrence.state, group };
}

export function applyOccurrenceStateCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: OccurrenceStateCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceShipEncounterCount': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no ShipCombat encounter count`);
      }
      if (command.encounterCount !== 2 && command.encounterCount !== 3) {
        failCommand(command, 'encounterCount must be 2 or 3');
      }
      if (occurrence.state.encounterCount === command.encounterCount) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          current,
          Object.freeze({
            ...occurrence,
            state: Object.freeze({ ...occurrence.state, encounterCount: command.encounterCount }),
          }),
        ),
      );
    }
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelPicked':
    case 'ReplaceRewardWheelOffer': {
      const current = requireTopology(located.plan, command);
      const address = command.kind === 'ReplaceRewardWheelOffer' ? command.offer : command.wheel;
      const { occurrence, state, descriptor } = requireWheel(
        current,
        catalog,
        located,
        address.occurrenceId,
        address.wheelKey,
        command,
      );
      const wheel = state.wheels[address.wheelKey];
      if (wheel === undefined)
        failCommand(command, `${occurrence.gameName} is missing ${address.wheelKey}`);
      let replacement: typeof wheel;
      if (command.kind === 'ReplaceRewardWheelOfferCount') {
        if (
          !Number.isInteger(command.offerCount) ||
          command.offerCount < descriptor.offerCount.min ||
          command.offerCount > descriptor.offerCount.max
        ) {
          failCommand(
            command,
            `offerCount must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
          );
        }
        replacement = Object.freeze({
          ...wheel,
          offerCount: command.offerCount,
          pickedOfferIndex: Math.min(wheel.pickedOfferIndex, command.offerCount),
        });
      } else if (command.kind === 'ReplaceRewardWheelStore') {
        if (!descriptor.reward.storeKeys.includes(command.storeKey)) {
          failCommand(command, `${command.storeKey} is not available from ${address.wheelKey}`);
        }
        replacement = Object.freeze({ ...wheel, storeKey: command.storeKey });
      } else if (command.kind === 'ReplaceRewardWheelPicked') {
        if (
          !Number.isInteger(command.pickedOfferIndex) ||
          command.pickedOfferIndex < 1 ||
          command.pickedOfferIndex > wheel.offerCount
        ) {
          failCommand(command, 'pickedOfferIndex must address an active offer');
        }
        replacement = Object.freeze({ ...wheel, pickedOfferIndex: command.pickedOfferIndex });
      } else {
        const offer = wheel.offers[command.offer.offerKey];
        if (offer === undefined || !descriptor.offerKeys.includes(command.offer.offerKey)) {
          failCommand(command, `unknown wheel offer ${command.offer.offerKey}`);
        }
        replacement = Object.freeze({
          ...wheel,
          offers: Object.freeze({
            ...wheel.offers,
            [command.offer.offerKey]: command.value,
          }),
        });
      }
      if (sameOffer(replacement, wheel)) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          current,
          Object.freeze({
            ...occurrence,
            state: Object.freeze({
              ...state,
              wheels: Object.freeze({ ...state.wheels, [address.wheelKey]: replacement }),
            }),
          }),
        ),
      );
    }
    case 'ReplaceIncomingReward': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.reward.occurrenceId, command);
      const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
      let state: RoomOccurrence['state'];
      if (occurrence.state.kind === 'fixed') {
        if (
          room.incomingReward.kind !== 'fixed' ||
          command.value.rewardType !== room.incomingReward.offer.rewardType
        ) {
          failCommand(command, `${occurrence.gameName} has a fixed reward type`);
        }
        state = Object.freeze({
          kind: 'fixed',
          ...(command.value.payload === undefined ? {} : { payload: command.value.payload }),
        });
      } else if (
        occurrence.state.kind === 'counted' ||
        occurrence.state.kind === 'freeReward' ||
        occurrence.state.kind === 'ephyraCombat'
      ) {
        state = Object.freeze({ ...occurrence.state, offer: command.value });
      } else {
        failCommand(command, `${occurrence.gameName} has no replaceable incoming reward`);
      }
      if (sameOffer(state, occurrence.state)) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(current, { ...occurrence, state }),
      );
    }
    case 'ReplaceLocalReward': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind === 'fieldsCombat') {
        const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
        const group = room.localChildren.find((child) => child.key === command.reward.groupKey);
        if (
          command.reward.groupKey !== 'cages' ||
          group?.kind !== 'boundedRewardSlots' ||
          !group.slotKeys.includes(command.reward.slotKey)
        ) {
          failCommand(
            command,
            `unknown local reward ${command.reward.groupKey}.${command.reward.slotKey}`,
          );
        }
        const offer = occurrence.state.cages[command.reward.slotKey];
        if (offer === undefined)
          failCommand(command, `missing local reward ${command.reward.slotKey}`);
        if (sameOffer(offer, command.value)) return document;
        return updateOccurrenceTopology(
          document,
          located,
          replaceOccurrence(
            current,
            Object.freeze({
              ...occurrence,
              state: Object.freeze({
                ...occurrence.state,
                cages: Object.freeze({
                  ...occurrence.state.cages,
                  [command.reward.slotKey]: command.value,
                }),
              }),
            }),
          ),
        );
      }
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        located,
        command.reward.groupKey,
        command,
      );
      if (!group.slots.some((slot) => slot.slotKey === command.reward.slotKey)) {
        failCommand(command, `unknown side-room slot ${command.reward.slotKey}`);
      }
      const sideRoom = state.sideRooms[command.reward.slotKey];
      if (sideRoom === undefined)
        failCommand(command, `missing side-room state ${command.reward.slotKey}`);
      if (sameOffer(sideRoom.offer, command.value)) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          current,
          Object.freeze({
            ...occurrence,
            state: Object.freeze({
              ...state,
              sideRooms: Object.freeze({
                ...state.sideRooms,
                [command.reward.slotKey]: Object.freeze({ ...sideRoom, offer: command.value }),
              }),
            }),
          }),
        ),
      );
    }
    case 'ReplaceSideRoomGeneration': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.sideRoom.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        located,
        command.sideRoom.groupKey,
        command,
      );
      if (!group.slots.some((slot) => slot.slotKey === command.sideRoom.slotKey)) {
        failCommand(command, `unknown side-room slot ${command.sideRoom.slotKey}`);
      }
      const sideRoom = state.sideRooms[command.sideRoom.slotKey];
      if (sideRoom === undefined)
        failCommand(command, `missing side-room state ${command.sideRoom.slotKey}`);
      if (command.generation === 'notGenerated' && sideRoom.enteredOrdinal !== null) {
        failCommand(command, 'remove the side room from entry order before disabling generation');
      }
      if (sideRoom.generation === command.generation) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          current,
          Object.freeze({
            ...occurrence,
            state: Object.freeze({
              ...state,
              sideRooms: Object.freeze({
                ...state.sideRooms,
                [command.sideRoom.slotKey]: Object.freeze({
                  ...sideRoom,
                  generation: command.generation,
                }),
              }),
            }),
          }),
        ),
      );
    }
    case 'ReplaceSideRoomEntryOrder': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.group.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        located,
        command.group.groupKey,
        command,
      );
      if (new Set(command.enteredSlotKeys).size !== command.enteredSlotKeys.length) {
        failCommand(command, 'side-room entry order must contain distinct slots');
      }
      for (const slotKey of command.enteredSlotKeys) {
        if (!group.slots.some((slot) => slot.slotKey === slotKey)) {
          failCommand(command, `unknown side-room slot ${slotKey}`);
        }
        if (state.sideRooms[slotKey]?.generation !== 'generated') {
          failCommand(command, `${slotKey} must be generated before it can be entered`);
        }
      }
      const sideRooms = Object.freeze(
        Object.fromEntries(
          Object.entries(state.sideRooms).map(([slotKey, sideRoom]) => {
            const index = command.enteredSlotKeys.indexOf(slotKey);
            return [
              slotKey,
              Object.freeze({ ...sideRoom, enteredOrdinal: index < 0 ? null : index + 1 }),
            ];
          }),
        ),
      );
      if (sameOffer(sideRooms, state.sideRooms)) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          current,
          Object.freeze({ ...occurrence, state: { ...state, sideRooms } }),
        ),
      );
    }
    case 'ReplaceShopOffer':
    case 'SetShopPurchase': {
      const current = requireTopology(located.plan, command);
      const address = command.kind === 'ReplaceShopOffer' ? command.offer : command.purchase;
      const occurrence = requireOccurrence(located.plan, address.occurrenceId, command);
      if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
      }
      const offer = occurrence.state.shop.offers[address.offerKey];
      if (offer === undefined) failCommand(command, `unknown shop offer ${address.offerKey}`);
      if (command.kind === 'SetShopPurchase' && typeof command.purchased !== 'boolean') {
        failCommand(command, 'purchased must be a boolean');
      }
      const replacement =
        command.kind === 'ReplaceShopOffer'
          ? Object.freeze({ ...offer, offer: command.value })
          : Object.freeze({ ...offer, purchased: command.purchased });
      if (sameOffer(replacement, offer)) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          current,
          Object.freeze({
            ...occurrence,
            state: Object.freeze({
              ...occurrence.state,
              shop: Object.freeze({
                ...occurrence.state.shop,
                offers: Object.freeze({
                  ...occurrence.state.shop.offers,
                  [address.offerKey]: replacement,
                }),
              }),
            }),
          }),
        ),
      );
    }
  }
}
