import type { Catalog, EncounterRewardWheelAttachment } from '../../../catalog-schema';
import {
  createBiomeAddress,
  createRewardWheelOfferAddress,
  semanticAddressKey,
} from '../../addresses';
import type {
  OccurrenceId,
  ProjectDocument,
  RewardWheelState,
  RoomActionReference,
  RoomOccurrence,
} from '../../model';
import { requireShipCombatWheels } from '../../room-state/declaration';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from '../contract';
import { replaceOccurrence, updateOccurrenceTopology } from './mutation';
import { sameOccurrenceValue } from './leaf-value';
import type { ShipOccurrenceCommand } from '../types';
import {
  createUnresolvedAcquisitionRewardState,
  producerLevelEffectSource,
} from '../../traits/state';

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
    case 'SwapRewardWheelOffers':
      return swapRewardWheelOffers(document, catalog, located, command);
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
        if (offer !== null && sameOccurrenceValue(offer.offer, command.value)) return document;
        replacement = Object.freeze({
          ...wheel,
          offers: Object.freeze({
            ...wheel.offers,
            [command.offer.offerKey]: createUnresolvedAcquisitionRewardState(
              catalog,
              command.value,
              producerLevelEffectSource(descriptor.reward),
              located.routePosition.routeKey,
            ),
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

/**
 * Exchanges a two-offer wheel's offers: each offer's draw, acquisition
 * authorship and rerolled reward, and the presses that redrew it, move to the
 * other offer key, and the pick follows, so the plan holds the same picks on
 * the other sides.
 */
function swapRewardWheelOffers(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<ShipOccurrenceCommand, { readonly kind: 'SwapRewardWheelOffers' }>,
): ProjectDocument {
  const current = requireTopology(located.plan, command);
  const { occurrence, state, descriptor } = requireWheel(
    catalog,
    located,
    command.wheel.occurrenceId,
    command.wheel.wheelKey,
    command,
  );
  const wheel = state.wheels[command.wheel.wheelKey]!;
  const [first, second] = descriptor.offerKeys;
  if (wheel.offerCount !== 2 || first === undefined || second === undefined)
    failCommand(command, `${command.wheel.wheelKey} has no two offers to swap`);
  const other = (offerKey: string) =>
    offerKey === first ? second : offerKey === second ? first : offerKey;
  for (const offerKey of [first, second])
    if (derivedIdentityNames(document, command, offerKey))
      failCommand(command, `pickups or results generated from ${offerKey} cannot follow a swap`);
  const swapKeys = <Value>(record: Readonly<Record<string, Value>>) =>
    Object.freeze(
      Object.fromEntries(Object.entries(record).map(([key, value]) => [other(key), value])),
    );
  const replacement: RewardWheelState = Object.freeze({
    ...wheel,
    offers: swapKeys(wheel.offers),
    ...(wheel.rerolledOffers === undefined
      ? {}
      : { rerolledOffers: swapKeys(wheel.rerolledOffers) }),
    pickedOfferIndex: 3 - wheel.pickedOfferIndex,
  });
  const order = occurrence.roomActions.order.map((action): RoomActionReference =>
    action.kind === 'reroll' &&
    action.target.kind === 'wheelOffer' &&
    action.target.wheelKey === command.wheel.wheelKey
      ? Object.freeze({
          ...action,
          target: Object.freeze({ ...action.target, offerKey: other(action.target.offerKey) }),
        })
      : action,
  );
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      current,
      Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...state,
          wheels: Object.freeze({ ...state.wheels, [command.wheel.wheelKey]: replacement }),
        }),
        roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(order) }),
      }),
    ),
  );
}

/**
 * Whether any persisted key or name in the document derives from the offer:
 * generated pickup sites and entries, Artificer replacements, Sea Star
 * duplicates and clocked pickups all embed their source's address key, at
 * any nesting and URI-encoding depth.
 */
function derivedIdentityNames(
  document: ProjectDocument,
  command: Extract<ShipOccurrenceCommand, { readonly kind: 'SwapRewardWheelOffers' }>,
  offerKey: string,
): boolean {
  const { wheel } = command;
  const plain = (value: string) => {
    let decoded = value;
    for (;;) {
      let next: string;
      try {
        next = decodeURIComponent(decoded);
      } catch {
        break;
      }
      if (next === decoded) break;
      decoded = next;
    }
    return decoded.replaceAll('\\', '');
  };
  const key = semanticAddressKey(
    createRewardWheelOfferAddress(
      createBiomeAddress(wheel.routeKey, wheel.biomeKey),
      wheel.occurrenceId,
      wheel.wheelKey,
      offerKey,
    ),
  );
  const needle = plain(key.slice(1, -1));
  const names = (value: unknown): boolean => {
    if (typeof value === 'string')
      return value.includes('rewardWheelOffer') && plain(value).includes(needle);
    if (typeof value !== 'object' || value === null) return false;
    return Object.entries(value).some(([name, nested]) => names(name) || names(nested));
  };
  return names(document.route);
}
