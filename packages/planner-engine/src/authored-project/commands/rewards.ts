import type { Catalog, LinearBiomeLayout, RewardWheelOfferPoint } from '../../catalog-schema';
import type { RewardWheelAddress, RewardWheelOfferAddress } from '../addresses';
import type { LinearBiomePlan, ProjectDocument, RoomOccurrence } from '../model';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  sameOffer,
  withBiome,
  type LocatedBiome,
} from './contract';
import { authoredBaseStorePolicy, replaceOccurrence, requireContinuation } from './topology-linear';
import type { LinearRewardProjectCommand, ProjectCommand } from './types';
function requireRewardWheel(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  address: RewardWheelAddress | RewardWheelOfferAddress,
  command: ProjectCommand,
): {
  readonly occurrence: RoomOccurrence;
  readonly state: Extract<RoomOccurrence['state'], { readonly kind: 'shipCombat' }>;
  readonly descriptor: RewardWheelOfferPoint;
} {
  const occurrence = requireOccurrence(plan, address.occurrenceId, command);
  if (occurrence.state.kind !== 'shipCombat') {
    failCommand(command, `${occurrence.gameName} has no reward wheels`);
  }
  const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  const descriptor = profile?.phases.find(
    (phase) => phase.offerPoint?.key === address.wheelKey,
  )?.offerPoint;
  if (descriptor === undefined) {
    failCommand(command, `${occurrence.gameName} has no wheel ${address.wheelKey}`);
  }
  if (occurrence.state.wheels[address.wheelKey] === undefined) {
    failCommand(command, `${occurrence.gameName} is missing wheel state ${address.wheelKey}`);
  }
  return { occurrence, state: occurrence.state, descriptor };
}

export function applyLinearRewardCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  plan: LinearBiomePlan,
  layout: LinearBiomeLayout,
  command: LinearRewardProjectCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceBatchRewardStore': {
      const topology = requireTopology(plan, command);
      const continuation = topology.continuations.find(
        (candidate) => candidate.parentOccurrenceId === command.rewardStore.parentOccurrenceId,
      );
      if (continuation === undefined || continuation.rewardStore?.kind !== 'authoredBaseStore') {
        failCommand(command, 'continuation does not expose an authored base store');
      }
      if (!authoredBaseStorePolicy(layout).storeKeys.includes(command.storeKey)) {
        failCommand(command, `${command.storeKey} is not available from this batch policy`);
      }
      if (continuation.rewardStore.baseRewardStoreKey === command.storeKey) {
        return document;
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          continuations: topology.continuations.map((candidate) =>
            candidate.parentOccurrenceId === continuation.parentOccurrenceId
              ? {
                  ...continuation,
                  rewardStore: {
                    kind: 'authoredBaseStore',
                    baseRewardStoreKey: command.storeKey,
                  },
                }
              : candidate,
          ),
        },
      });
    }
    case 'ReplaceFieldsCageOutcome': {
      if (layout.continuation.batchPolicy.kind !== 'fields') {
        failCommand(command, 'batch does not expose a Fields cage outcome');
      }
      if (command.cageOutcome !== 'min' && command.cageOutcome !== 'max') {
        failCommand(command, 'cageOutcome must be min or max');
      }
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.continuation.parentOccurrenceId,
        'batch',
        command,
      );
      if (continuation.batchState?.cageOutcome === command.cageOutcome) {
        return document;
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          continuations: topology.continuations.map((candidate) =>
            candidate.parentOccurrenceId === continuation.parentOccurrenceId
              ? {
                  ...continuation,
                  batchState: Object.freeze({ cageOutcome: command.cageOutcome }),
                }
              : candidate,
          ),
        },
      });
    }
    case 'ReplaceShipEncounterCount': {
      const occurrence = requireOccurrence(plan, command.occurrence.occurrenceId, command);
      if (occurrence.state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no ShipCombat encounter count`);
      }
      if (command.encounterCount !== 2 && command.encounterCount !== 3) {
        failCommand(command, 'encounterCount must be 2 or 3');
      }
      if (occurrence.state.encounterCount === command.encounterCount) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceOccurrence(
          plan,
          {
            ...occurrence,
            state: { ...occurrence.state, encounterCount: command.encounterCount },
          },
          command,
        ),
      );
    }
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelPicked':
    case 'ReplaceRewardWheelOffer': {
      const address = command.kind === 'ReplaceRewardWheelOffer' ? command.offer : command.wheel;
      const { occurrence, state, descriptor } = requireRewardWheel(
        plan,
        catalog,
        layout,
        address,
        command,
      );
      const wheel = state.wheels[address.wheelKey];
      if (wheel === undefined) {
        failCommand(command, `${occurrence.gameName} lost wheel ${address.wheelKey}`);
      }
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
        if (wheel.offerCount === command.offerCount) {
          return document;
        }
        replacement = {
          ...wheel,
          offerCount: command.offerCount,
          pickedOfferIndex: Math.min(wheel.pickedOfferIndex, command.offerCount),
        };
      } else if (command.kind === 'ReplaceRewardWheelStore') {
        if (!descriptor.reward.storeKeys.includes(command.storeKey)) {
          failCommand(command, `${command.storeKey} is not available from ${address.wheelKey}`);
        }
        if (wheel.storeKey === command.storeKey) {
          return document;
        }
        replacement = { ...wheel, storeKey: command.storeKey };
      } else if (command.kind === 'ReplaceRewardWheelPicked') {
        if (
          !Number.isInteger(command.pickedOfferIndex) ||
          command.pickedOfferIndex < 1 ||
          command.pickedOfferIndex > wheel.offerCount
        ) {
          failCommand(command, 'pickedOfferIndex must address an active offer');
        }
        if (wheel.pickedOfferIndex === command.pickedOfferIndex) {
          return document;
        }
        replacement = { ...wheel, pickedOfferIndex: command.pickedOfferIndex };
      } else {
        if (!descriptor.offerKeys.includes(command.offer.offerKey)) {
          failCommand(command, `unknown wheel offer ${command.offer.offerKey}`);
        }
        const current = wheel.offers[command.offer.offerKey];
        if (current === undefined) {
          failCommand(command, `missing wheel offer ${command.offer.offerKey}`);
        }
        if (sameOffer(current, command.value)) {
          return document;
        }
        replacement = {
          ...wheel,
          offers: { ...wheel.offers, [command.offer.offerKey]: command.value },
        };
      }
      return withBiome(
        document,
        located,
        replaceOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...state,
              wheels: { ...state.wheels, [address.wheelKey]: replacement },
            },
          },
          command,
        ),
      );
    }
    case 'ReplaceIncomingReward': {
      const occurrence = requireOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind === 'fixed') {
        const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
        if (
          room.incomingReward.kind !== 'fixed' ||
          command.value.rewardType !== room.incomingReward.offer.rewardType
        ) {
          failCommand(command, `${occurrence.gameName} has a fixed reward type`);
        }
        const current = {
          rewardType: room.incomingReward.offer.rewardType,
          ...(occurrence.state.payload === undefined
            ? room.incomingReward.offer.payload === undefined
              ? {}
              : { payload: room.incomingReward.offer.payload }
            : { payload: occurrence.state.payload }),
        };
        if (sameOffer(current, command.value)) {
          return document;
        }
        const replacement = {
          ...occurrence,
          state: {
            kind: 'fixed' as const,
            ...(command.value.payload === undefined ? {} : { payload: command.value.payload }),
          },
        };
        return withBiome(document, located, replaceOccurrence(plan, replacement, command));
      }
      if (occurrence.state.kind !== 'counted' && occurrence.state.kind !== 'freeReward') {
        failCommand(command, `${occurrence.gameName} has no replaceable counted reward`);
      }
      if (sameOffer(occurrence.state.offer, command.value)) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: { ...occurrence.state, offer: command.value },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'ReplaceLocalReward': {
      const occurrence = requireOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind !== 'fieldsCombat' || command.reward.groupKey !== 'cages') {
        failCommand(command, `${occurrence.gameName} has no replaceable local reward group`);
      }
      const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
      const cages = room.localChildren.find((child) => child.key === command.reward.groupKey);
      if (
        cages?.kind !== 'boundedRewardSlots' ||
        !cages.slotKeys.includes(command.reward.slotKey)
      ) {
        failCommand(
          command,
          `unknown local reward ${command.reward.groupKey}.${command.reward.slotKey}`,
        );
      }
      const offer = occurrence.state.cages[command.reward.slotKey];
      if (offer === undefined) {
        failCommand(
          command,
          `missing local reward ${command.reward.groupKey}.${command.reward.slotKey}`,
        );
      }
      if (sameOffer(offer, command.value)) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: {
          ...occurrence.state,
          cages: { ...occurrence.state.cages, [command.reward.slotKey]: command.value },
        },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'ReplaceShopOffer': {
      const occurrence = requireOccurrence(plan, command.offer.occurrenceId, command);
      if (occurrence.state.kind !== 'shop') {
        failCommand(command, `${occurrence.gameName} has no shop offer state`);
      }
      if (occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
      }
      const offer = occurrence.state.shop.offers[command.offer.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
      }
      if (sameOffer(offer.offer, command.value)) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: {
          ...occurrence.state,
          shop: {
            ...occurrence.state.shop,
            offers: {
              ...occurrence.state.shop.offers,
              [command.offer.offerKey]: { ...offer, offer: command.value },
            },
          },
        },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'SetShopPurchase': {
      const occurrence = requireOccurrence(plan, command.purchase.occurrenceId, command);
      if (occurrence.state.kind !== 'shop') {
        failCommand(command, `${occurrence.gameName} has no shop purchase state`);
      }
      if (occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
      }
      const offer = occurrence.state.shop.offers[command.purchase.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${command.purchase.offerKey}`);
      }
      if (typeof command.purchased !== 'boolean') {
        failCommand(command, 'purchased must be a boolean');
      }
      if (offer.purchased === command.purchased) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: {
          ...occurrence.state,
          shop: {
            ...occurrence.state.shop,
            offers: {
              ...occurrence.state.shop.offers,
              [command.purchase.offerKey]: { ...offer, purchased: command.purchased },
            },
          },
        },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
  }
}
