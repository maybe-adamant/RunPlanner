import type { Catalog, EncounterRewardWheelAttachment } from '../../catalog-schema';
import type { OccurrenceId, ProjectDocument, RoomOccurrence } from '../model';
import { requireShipCombatWheels } from '../room-state/declaration';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { ShipOccurrenceCommand } from './types';

function requireWheel(
  catalog: Catalog,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  wheelKey: string,
  command: ShipOccurrenceCommand,
): {
  readonly occurrence: RoomOccurrence;
  readonly state: Extract<RoomOccurrence['state'], { readonly kind: 'shipCombat' }>;
  readonly descriptor: EncounterRewardWheelAttachment;
} {
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  if (occurrence.state.kind !== 'shipCombat') {
    failCommand(command, `${occurrence.gameName} has no reward wheels`);
  }
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const descriptor = requireShipCombatWheels(catalog, room, room.gameName).find(
    (wheel) => wheel.key === wheelKey,
  );
  if (descriptor === undefined)
    failCommand(command, `${occurrence.gameName} has no wheel ${wheelKey}`);
  if (occurrence.state.wheels[wheelKey] === undefined) {
    failCommand(command, `${occurrence.gameName} is missing wheel state ${wheelKey}`);
  }
  return { occurrence, state: occurrence.state, descriptor };
}

export function applyShipOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: ShipOccurrenceCommand,
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
      if (sameOccurrenceValue(replacement, wheel)) return document;
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
  }
}
