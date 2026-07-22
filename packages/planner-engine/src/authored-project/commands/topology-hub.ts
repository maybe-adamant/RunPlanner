import type { Catalog, FixedAuthoredSlotDescriptor, HubBiomeLayout } from '../../catalog-schema';
import type {
  HubBiomePlan,
  HubBiomeTopology,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { createDefaultRoomState } from '../roomState';

import {
  failCommand,
  requireRoom,
  roomStateContext,
  sameOffer,
  withBiome,
  type LocatedBiome,
} from './contract';
import type { HubProjectCommand, ProjectCommand } from './types';

function requireHubTopology(plan: HubBiomePlan, command: ProjectCommand): HubBiomeTopology {
  if (plan.topology === null) {
    failCommand(command, 'Hub topology has not been started');
  }
  return plan.topology;
}

function requireHubOccurrence(
  plan: HubBiomePlan,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
): RoomOccurrence {
  const occurrence = requireHubTopology(plan, command).occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) {
    failCommand(command, `unknown Hub occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function replaceHubOccurrence(
  plan: HubBiomePlan,
  replacement: RoomOccurrence,
  command: ProjectCommand,
): HubBiomePlan {
  const topology = requireHubTopology(plan, command);
  return {
    ...plan,
    topology: {
      ...topology,
      occurrences: topology.occurrences.map((occurrence) =>
        occurrence.occurrenceId === replacement.occurrenceId ? replacement : occurrence,
      ),
    },
  };
}

function requireEphyraSideGroup(
  occurrence: RoomOccurrence,
  catalog: Catalog,
  layout: HubBiomeLayout,
  groupKey: string,
  command: ProjectCommand,
) {
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCommand(command, `${occurrence.gameName} has no Ephyra side-room state`);
  }
  const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
  const group = room.localChildren.find((child) => child.key === groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    failCommand(command, `${occurrence.gameName} has no side-room group ${groupKey}`);
  }
  return { state: occurrence.state, group };
}

export function applyHubCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  plan: HubBiomePlan,
  layout: HubBiomeLayout,
  command: HubProjectCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'CreateHubTopology': {
      if (plan.topology !== null) {
        failCommand(command, 'Hub topology already exists');
      }
      if (
        layout.entries.some((entry) => entry.kind !== 'fixedAuthoredSlot') ||
        layout.terminal.kind !== 'fixedAuthoredSlot'
      ) {
        failCommand(command, `${layout.biomeKey} has no supported fixed Hub boundary`);
      }
      const descriptors: readonly FixedAuthoredSlotDescriptor[] = [
        ...(layout.entries as readonly FixedAuthoredSlotDescriptor[]),
        layout.terminal,
      ];
      const terminalSlotKey = layout.terminal.slotKey;
      const expectedKeys = descriptors.map((descriptor) => descriptor.slotKey).sort();
      const actualKeys = Object.keys(command.fixedOccurrenceIds).sort();
      if (
        expectedKeys.length !== actualKeys.length ||
        expectedKeys.some((key, index) => key !== actualKeys[index])
      ) {
        failCommand(command, `fixed occurrence IDs must contain ${expectedKeys.join(', ')}`);
      }
      const ids = descriptors.map((descriptor) => command.fixedOccurrenceIds[descriptor.slotKey]);
      if (ids.some((id) => id === undefined) || new Set(ids).size !== ids.length) {
        failCommand(command, 'fixed occurrence IDs must be present and unique');
      }
      const occurrences = descriptors.map((descriptor, index): RoomOccurrence => {
        const id = ids[index];
        if (id === undefined) {
          failCommand(command, `missing occurrence ID for ${descriptor.slotKey}`);
        }
        const room = requireRoom(catalog, descriptor.roomGameName, layout.biomeKey, command);
        return {
          occurrenceId: id,
          gameName: room.gameName,
          state: createDefaultRoomState(
            catalog,
            room,
            roomStateContext(
              descriptor.slotKey === terminalSlotKey ? 'terminalShop' : 'ordinary',
              room.forcedRewardStoreKey ?? room.individualRewardStoreKey,
              true,
            ),
          ),
        };
      });
      return withBiome(document, located, {
        ...plan,
        topology: {
          occurrences,
          fixedRooms: descriptors.map((descriptor, index) => {
            const occurrence = occurrences[index];
            if (occurrence === undefined) {
              failCommand(command, `missing fixed occurrence for ${descriptor.slotKey}`);
            }
            return {
              fixedSlotKey: descriptor.slotKey,
              occurrenceId: occurrence.occurrenceId,
            };
          }),
          openTargets: [],
          visitOrder: [],
        },
      });
    }
    case 'OpenHubSlot': {
      const topology = requireHubTopology(plan, command);
      if (topology.openTargets.length >= layout.hub.openCount.max) {
        failCommand(command, `Hub already has ${layout.hub.openCount.max} open slots`);
      }
      if (topology.openTargets.some((target) => target.hubSlotKey === command.slot.hubSlotKey)) {
        failCommand(command, `${command.slot.hubSlotKey} is already open`);
      }
      if (
        topology.occurrences.some((occurrence) => occurrence.occurrenceId === command.occurrenceId)
      ) {
        failCommand(command, `occurrence ${command.occurrenceId} already exists`);
      }
      const slot = layout.hub.slots.find(
        (candidate) => candidate.slotKey === command.slot.hubSlotKey,
      );
      if (slot === undefined) {
        failCommand(command, `unknown Hub slot ${command.slot.hubSlotKey}`);
      }
      const room = requireRoom(catalog, slot.roomGameName, layout.biomeKey, command);
      const occurrence: RoomOccurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(
          catalog,
          room,
          roomStateContext(
            'ordinary',
            room.forcedRewardStoreKey ?? room.individualRewardStoreKey,
            false,
          ),
        ),
      };
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          occurrences: [...topology.occurrences, occurrence],
          openTargets: [
            ...topology.openTargets,
            { hubSlotKey: slot.slotKey, occurrenceId: occurrence.occurrenceId },
          ],
        },
      });
    }
    case 'CloseHubSlot': {
      const topology = requireHubTopology(plan, command);
      const target = topology.openTargets.find(
        (candidate) => candidate.hubSlotKey === command.slot.hubSlotKey,
      );
      if (target === undefined) {
        failCommand(command, `${command.slot.hubSlotKey} is not open`);
      }
      if (topology.visitOrder.includes(command.slot.hubSlotKey)) {
        failCommand(command, 'replace or remove the referenced Hub visit before closing this slot');
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          occurrences: topology.occurrences.filter(
            (occurrence) => occurrence.occurrenceId !== target.occurrenceId,
          ),
          openTargets: topology.openTargets.filter(
            (candidate) => candidate.hubSlotKey !== command.slot.hubSlotKey,
          ),
        },
      });
    }
    case 'AppendHubVisit': {
      const topology = requireHubTopology(plan, command);
      if (command.visit.visitIndex !== topology.visitOrder.length + 1) {
        failCommand(command, `next Hub visit index is ${topology.visitOrder.length + 1}`);
      }
      if (topology.visitOrder.length >= layout.hub.requiredVisits) {
        failCommand(command, `Hub already has ${layout.hub.requiredVisits} visits`);
      }
      if (!topology.openTargets.some((target) => target.hubSlotKey === command.hubSlotKey)) {
        failCommand(command, `${command.hubSlotKey} is not an open Hub slot`);
      }
      if (topology.visitOrder.includes(command.hubSlotKey)) {
        failCommand(command, `${command.hubSlotKey} is already visited`);
      }
      return withBiome(document, located, {
        ...plan,
        topology: { ...topology, visitOrder: [...topology.visitOrder, command.hubSlotKey] },
      });
    }
    case 'ReplaceHubVisit': {
      const topology = requireHubTopology(plan, command);
      const visitIndex = command.visit.visitIndex - 1;
      if (topology.visitOrder[visitIndex] === undefined) {
        failCommand(command, `unknown Hub visit ${command.visit.visitIndex}`);
      }
      if (!topology.openTargets.some((target) => target.hubSlotKey === command.hubSlotKey)) {
        failCommand(command, `${command.hubSlotKey} is not an open Hub slot`);
      }
      if (
        topology.visitOrder.some(
          (hubSlotKey, index) => index !== visitIndex && hubSlotKey === command.hubSlotKey,
        )
      ) {
        failCommand(command, `${command.hubSlotKey} is already visited`);
      }
      if (topology.visitOrder[visitIndex] === command.hubSlotKey) {
        return document;
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          visitOrder: topology.visitOrder.map((hubSlotKey, index) =>
            index === visitIndex ? command.hubSlotKey : hubSlotKey,
          ),
        },
      });
    }
    case 'RemoveHubVisitsFrom': {
      const topology = requireHubTopology(plan, command);
      const visitIndex = command.visit.visitIndex - 1;
      if (topology.visitOrder[visitIndex] === undefined) {
        failCommand(command, `unknown Hub visit ${command.visit.visitIndex}`);
      }
      return withBiome(document, located, {
        ...plan,
        topology: { ...topology, visitOrder: topology.visitOrder.slice(0, visitIndex) },
      });
    }
    case 'ReplaceSideRoomGeneration': {
      const occurrence = requireHubOccurrence(plan, command.sideRoom.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        layout,
        command.sideRoom.groupKey,
        command,
      );
      if (!group.slots.some((slot) => slot.slotKey === command.sideRoom.slotKey)) {
        failCommand(command, `unknown side-room slot ${command.sideRoom.slotKey}`);
      }
      const sideRoom = state.sideRooms[command.sideRoom.slotKey];
      if (sideRoom === undefined) {
        failCommand(command, `missing side-room state ${command.sideRoom.slotKey}`);
      }
      if (command.generation !== 'generated' && command.generation !== 'notGenerated') {
        failCommand(command, 'side-room generation must be generated or notGenerated');
      }
      if (command.generation === 'notGenerated' && sideRoom.enteredOrdinal !== null) {
        failCommand(command, 'remove the side room from entry order before disabling generation');
      }
      if (sideRoom.generation === command.generation) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...state,
              sideRooms: {
                ...state.sideRooms,
                [command.sideRoom.slotKey]: {
                  ...sideRoom,
                  generation: command.generation,
                },
              },
            },
          },
          command,
        ),
      );
    }
    case 'ReplaceSideRoomEntryOrder': {
      const occurrence = requireHubOccurrence(plan, command.group.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        layout,
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
      const sideRooms = Object.fromEntries(
        Object.entries(state.sideRooms).map(([slotKey, sideRoom]) => {
          const index = command.enteredSlotKeys.indexOf(slotKey);
          return [slotKey, { ...sideRoom, enteredOrdinal: index < 0 ? null : index + 1 }];
        }),
      );
      if (
        Object.entries(state.sideRooms).every(
          ([slotKey, sideRoom]) => sideRoom.enteredOrdinal === sideRooms[slotKey]?.enteredOrdinal,
        )
      ) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(plan, { ...occurrence, state: { ...state, sideRooms } }, command),
      );
    }
    case 'ClearTopology':
      return plan.topology === null
        ? document
        : withBiome(document, located, { ...plan, topology: null });
    case 'ReplaceIncomingReward': {
      const occurrence = requireHubOccurrence(plan, command.reward.occurrenceId, command);
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
        return withBiome(
          document,
          located,
          replaceHubOccurrence(
            plan,
            {
              ...occurrence,
              state: {
                kind: 'fixed',
                ...(command.value.payload === undefined ? {} : { payload: command.value.payload }),
              },
            },
            command,
          ),
        );
      }
      if (
        occurrence.state.kind !== 'counted' &&
        occurrence.state.kind !== 'freeReward' &&
        occurrence.state.kind !== 'ephyraCombat'
      ) {
        failCommand(command, `${occurrence.gameName} has no replaceable counted reward`);
      }
      if (sameOffer(occurrence.state.offer, command.value)) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          { ...occurrence, state: { ...occurrence.state, offer: command.value } },
          command,
        ),
      );
    }
    case 'ReplaceLocalReward': {
      const occurrence = requireHubOccurrence(plan, command.reward.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        layout,
        command.reward.groupKey,
        command,
      );
      if (!group.slots.some((slot) => slot.slotKey === command.reward.slotKey)) {
        failCommand(command, `unknown side-room slot ${command.reward.slotKey}`);
      }
      const sideRoom = state.sideRooms[command.reward.slotKey];
      if (sideRoom === undefined) {
        failCommand(command, `missing side-room state ${command.reward.slotKey}`);
      }
      if (sameOffer(sideRoom.offer, command.value)) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...state,
              sideRooms: {
                ...state.sideRooms,
                [command.reward.slotKey]: { ...sideRoom, offer: command.value },
              },
            },
          },
          command,
        ),
      );
    }
    case 'ReplaceShopOffer':
    case 'SetShopPurchase': {
      const address = command.kind === 'ReplaceShopOffer' ? command.offer : command.purchase;
      const occurrence = requireHubOccurrence(plan, address.occurrenceId, command);
      if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
      }
      const offer = occurrence.state.shop.offers[address.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${address.offerKey}`);
      }
      if (command.kind === 'ReplaceShopOffer' && sameOffer(offer.offer, command.value)) {
        return document;
      }
      if (command.kind === 'SetShopPurchase') {
        if (typeof command.purchased !== 'boolean') {
          failCommand(command, 'purchased must be a boolean');
        }
        if (offer.purchased === command.purchased) {
          return document;
        }
      }
      const replacementOffer =
        command.kind === 'ReplaceShopOffer'
          ? { ...offer, offer: command.value }
          : { ...offer, purchased: command.purchased };
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...occurrence.state,
              shop: {
                ...occurrence.state.shop,
                offers: {
                  ...occurrence.state.shop.offers,
                  [address.offerKey]: replacementOffer,
                },
              },
            },
          },
          command,
        ),
      );
    }
  }
}
