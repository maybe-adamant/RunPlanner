import type { Catalog, RewardWheelOfferPoint, RoomDeclaration } from '../../catalog-schema';
import type {
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import type { RoomOccurrenceRole, RoomStateContext } from '../room-state/declaration';
import { createDefaultRoomState } from '../room-state/defaults';
import { reconcileReplacementRoomState } from '../room-state/replacement';
import { selectedExitKey, selectedOrdinaryBatchIndex } from '../topology/query';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  withBiome,
  type LocatedBiome,
} from './contract';
import type { OccurrenceStateCommand } from './types';

function sameOffer(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function replaceOccurrence(topology: BiomeTopology, replacement: RoomOccurrence): BiomeTopology {
  return Object.freeze({
    ...topology,
    occurrences: Object.freeze(
      topology.occurrences.map((occurrence) =>
        occurrence.occurrenceId === replacement.occurrenceId ? replacement : occurrence,
      ),
    ),
  });
}

function updateTopology(
  document: ProjectDocument,
  located: LocatedBiome,
  topology: BiomeTopology,
): ProjectDocument {
  return withBiome(document, located, { ...located.plan, topology });
}

function resolvedBatchStore(
  topology: BiomeTopology,
  decision: ExitDecision,
  command: OccurrenceStateCommand,
): string | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  if (decision.normal.rewardStore.kind === 'authoredBaseStore') {
    return decision.normal.rewardStore.baseRewardStoreKey ?? undefined;
  }
  if (decision.normal.rewardStore.kind === 'none') return undefined;
  if (decision.source.kind !== 'occurrence') {
    failCommand(command, 'a Hub batch cannot derive a source reward wheel');
  }
  const sourceId = decision.source.occurrenceId;
  const source = topology.occurrences.find((occurrence) => occurrence.occurrenceId === sourceId);
  if (source?.state.kind !== 'shipCombat') {
    failCommand(command, 'source-derived reward store requires ShipCombat source state');
  }
  const wheel = source.state.wheels[source.state.encounterCount === 3 ? 'wheel2' : 'wheel1'];
  if (wheel === undefined)
    failCommand(command, 'source-derived reward store is missing its active wheel');
  return wheel.storeKey;
}

function incomingStore(
  topology: BiomeTopology,
  source: ExitDecisionSource,
  command: OccurrenceStateCommand,
): string | undefined {
  if (source.kind !== 'occurrence') return undefined;
  const owner = topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      decision.normal.targets.some((target) => target.occurrenceId === source.occurrenceId),
  );
  return owner === undefined ? undefined : resolvedBatchStore(topology, owner, command);
}

function prebossRole(
  room: RoomDeclaration,
  targetIndex: number,
  command: OccurrenceStateCommand,
): RoomOccurrenceRole {
  if (room.kind !== 'Preboss') return 'ordinary';
  const policy = room.prebossBatchPolicy;
  if (policy === undefined) failCommand(command, `${room.gameName} has no Preboss batch policy`);
  if (policy.kind === 'retainNormalPeers' || targetIndex === 0) return 'prebossShop';
  if (policy.remainingOffers.kind !== 'counted') {
    failCommand(command, `${room.gameName} has no remaining Preboss offer for this exit`);
  }
  return 'prebossFreeReward';
}

interface OccurrenceContext {
  readonly role: RoomOccurrenceRole;
  readonly entryActive: boolean;
  readonly resolvedStoreKey?: string;
  readonly owner?: ExitDecision;
}

function occurrenceContext(
  topology: BiomeTopology,
  catalog: Catalog,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  command: OccurrenceStateCommand,
  replacementRoom?: RoomDeclaration,
): OccurrenceContext {
  if (topology.startOccurrenceId === occurrenceId) {
    return Object.freeze({ role: 'ordinary', entryActive: true });
  }
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      if (decision.openTargets.some((target) => target.occurrenceId === occurrenceId)) {
        return Object.freeze({
          role: 'ordinary',
          entryActive: decision.openTargets.some(
            (target) =>
              target.occurrenceId === occurrenceId &&
              decision.visitOrder.includes(target.hubSlotKey),
          ),
        });
      }
      continue;
    }
    if (decision.normal.kind === 'linked' && decision.normal.occurrenceId === occurrenceId) {
      return Object.freeze({ role: 'ordinary', entryActive: true, owner: decision });
    }
    if (decision.normal.kind !== 'batch') continue;
    const targetIndex = decision.normal.targets.findIndex(
      (target) => target.occurrenceId === occurrenceId,
    );
    if (targetIndex < 0) continue;
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    const room =
      replacementRoom ??
      (occurrence === undefined
        ? undefined
        : requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command));
    if (room === undefined) failCommand(command, `unknown occurrence ${occurrenceId}`);
    const role = prebossRole(room, targetIndex, command);
    const selected = selectedExitKey(decision);
    const target = decision.normal.targets[targetIndex];
    const resolvedStoreKey =
      role === 'prebossFreeReward'
        ? (room.forcedRewardStoreKey ??
          room.individualRewardStoreKey ??
          incomingStore(topology, decision.source, command))
        : resolvedBatchStore(topology, decision, command);
    return Object.freeze({
      role,
      entryActive: target?.exitKey === selected,
      ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
      owner: decision,
    });
  }
  failCommand(command, `occurrence ${occurrenceId} has no structural owner`);
}

function asRoomStateContext(context: OccurrenceContext): RoomStateContext {
  return Object.freeze({
    role: context.role,
    entryActive: context.entryActive,
    ...(context.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: context.resolvedStoreKey }),
  });
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

function requireOrdinaryBatchTarget(
  topology: BiomeTopology,
  catalog: Catalog,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  replacement: RoomDeclaration,
  command: OccurrenceStateCommand,
): void {
  const context = occurrenceContext(topology, catalog, located, occurrenceId, command, replacement);
  if (context.owner === undefined || context.owner.normal.kind !== 'batch') return;
  const ownerTargets = context.owner.normal.targets.map((target) => {
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === target.occurrenceId,
    );
    return occurrence?.occurrenceId === occurrenceId
      ? replacement
      : occurrence === undefined
        ? undefined
        : catalog.rooms.byKey[occurrence.gameName];
  });
  if (ownerTargets.some((room) => room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors')) {
    failCommand(
      command,
      'takeover Preboss targets can only change through their atomic batch command',
    );
  }
  if (
    replacement.kind === 'Intro' ||
    replacement.kind === 'Opening' ||
    replacement.kind === 'PreHub'
  ) {
    failCommand(command, `${replacement.gameName} is not an ordinary normal-door target`);
  }
  if (replacement.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
    failCommand(command, 'takeover Preboss targets require an atomic takeover batch command');
  }
  if (
    located.layout.progression.kind === 'generated' &&
    located.layout.progression.progressionPolicy.kind === 'staged'
  ) {
    const batchIndex =
      context.owner.source.kind === 'occurrence'
        ? selectedOrdinaryBatchIndex(topology, context.owner.source.occurrenceId)
        : undefined;
    const stage =
      batchIndex === undefined
        ? undefined
        : located.layout.progression.progressionPolicy.stages[batchIndex];
    if (stage === undefined || !stage.roomGameNames.includes(replacement.gameName)) {
      failCommand(
        command,
        `${replacement.gameName} is not available in stage ${stage?.key ?? '?'}`,
      );
    }
  }
}

function reconcileSourceRewardStore(
  topology: BiomeTopology,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  replacementRoom: RoomDeclaration,
): BiomeTopology {
  if (located.layout.progression.kind !== 'generated') return topology;
  const policy =
    located.layout.progression.rewardStoreOverrides.find(
      (override) => override.sourceEncounterProfileKey === replacementRoom.encounterProfileKey,
    )?.policy ?? located.layout.progression.rewardStorePolicy;
  return Object.freeze({
    ...topology,
    decisions: Object.freeze(
      topology.decisions.map((decision) => {
        if (
          decision.kind !== 'exit' ||
          decision.source.kind !== 'occurrence' ||
          decision.source.occurrenceId !== occurrenceId ||
          decision.normal.kind !== 'batch'
        ) {
          return decision;
        }
        const current = decision.normal.rewardStore;
        const rewardStore =
          policy.kind === 'authoredBaseStore' &&
          current.kind === 'authoredBaseStore' &&
          (current.baseRewardStoreKey === null ||
            policy.storeKeys.includes(current.baseRewardStoreKey))
            ? current
            : policy.kind === 'authoredBaseStore'
              ? Object.freeze({ kind: 'authoredBaseStore' as const, baseRewardStoreKey: null })
              : Object.freeze({ kind: policy.kind });
        return rewardStore === current
          ? decision
          : Object.freeze({
              ...decision,
              normal: Object.freeze({ ...decision.normal, rewardStore }),
            });
      }),
    ),
  });
}

export function applyOccurrenceStateCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: OccurrenceStateCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceOccurrenceRoom': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.gameName === command.gameName) return document;
      const replacementRoom = requireRoom(
        catalog,
        command.gameName,
        located.layout.biomeKey,
        command,
      );
      if (current.startOccurrenceId === occurrence.occurrenceId) {
        const allowed =
          located.layout.start.kind === 'authoredChoice'
            ? located.layout.start.roomGameNames
            : [located.layout.start.roomGameName];
        if (!allowed.includes(replacementRoom.gameName)) {
          failCommand(command, `${replacementRoom.gameName} is not a declared start room`);
        }
      }
      const linked = current.decisions.find(
        (decision): decision is ExitDecision =>
          decision.kind === 'exit' &&
          decision.normal.kind === 'linked' &&
          decision.normal.occurrenceId === occurrence.occurrenceId,
      );
      if (linked !== undefined) {
        const expected =
          located.layout.progression.kind === 'hub'
            ? located.layout.progression.linkedExit.roomGameName
            : undefined;
        if (replacementRoom.gameName !== expected) {
          failCommand(command, 'linked target identity is declaration-fixed');
        }
      }
      const hubTarget = current.decisions.find(
        (decision) =>
          decision.kind === 'hub' &&
          decision.openTargets.some((target) => target.occurrenceId === occurrence.occurrenceId),
      );
      if (hubTarget !== undefined) failCommand(command, 'Hub slot identity is declaration-fixed');
      requireOrdinaryBatchTarget(
        current,
        catalog,
        located,
        occurrence.occurrenceId,
        replacementRoom,
        command,
      );
      if (
        replacementRoom.kind === 'Preboss' &&
        current.decisions.some(
          (decision) =>
            decision.kind === 'exit' &&
            decision.source.kind === 'occurrence' &&
            decision.source.occurrenceId === occurrence.occurrenceId,
        )
      ) {
        failCommand(command, 'remove the downstream exit decision before selecting a Preboss room');
      }
      const context = occurrenceContext(
        current,
        catalog,
        located,
        occurrence.occurrenceId,
        command,
        replacementRoom,
      );
      const replacementDefault = createDefaultRoomState(
        catalog,
        replacementRoom,
        asRoomStateContext(context),
      );
      const replacement: RoomOccurrence = Object.freeze({
        occurrenceId: occurrence.occurrenceId,
        gameName: replacementRoom.gameName,
        state: reconcileReplacementRoomState(
          catalog,
          requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command),
          occurrence.state,
          replacementRoom,
          replacementDefault,
        ),
      });
      return updateTopology(
        document,
        located,
        reconcileSourceRewardStore(
          replaceOccurrence(current, replacement),
          located,
          occurrence.occurrenceId,
          replacementRoom,
        ),
      );
    }
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
      return updateTopology(
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
      return updateTopology(
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
      return updateTopology(
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
        return updateTopology(
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
      return updateTopology(
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
      return updateTopology(
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
      return updateTopology(
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
      return updateTopology(
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
