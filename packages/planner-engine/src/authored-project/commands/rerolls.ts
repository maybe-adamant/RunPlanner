import type { Catalog } from '../../catalog-schema';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import { createBiomeAddress, semanticAddressKey, type BiomeAddress } from '../addresses';
import type {
  AuthoredRewardState,
  BiomeTopology,
  HubAction,
  HubDecision,
  ProjectDocument,
  RerollRoomAction,
  RerollTarget,
  RoomOccurrence,
} from '../model';
import {
  biomeRerolledOwners,
  nextRerollId,
  rerolledRewardOf,
  rerollTargetOwner,
  withRerolledReward,
  type RerolledRewardOwner,
} from '../rerolls';
import { roomActionKey } from '../room-actions/key';
import { requireShipCombatWheels } from '../room-state/declaration';
import { resolveEntryDeclaration } from '../room-state/entry-resolution';
import { createUnresolvedAcquisitionRewardState } from '../traits/state';
import type { ResolvedRoutePosition } from '../route-context';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence/mutation';
import type { RerollCommand } from './types';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        )
      : entry,
  );
}

function sameOffer(left: ResolvedRewardOffer, right: ResolvedRewardOffer): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

/** The counted binding whose acquisition an owner's rerolled reward follows. */
function rerolledRewardBinding(
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

function unresolvedRerolledReward(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
  offer: ResolvedRewardOffer,
): AuthoredRewardState | undefined {
  const binding = rerolledRewardBinding(catalog, routePosition, occurrence, owner);
  // A reward the owner can never draw gets no acquisition; its reroll reports it.
  return binding === undefined || !binding.allowedRewardTypes.includes(offer.rewardType)
    ? undefined
    : createUnresolvedAcquisitionRewardState(
        catalog,
        offer,
        { kind: 'producerLifecycle', key: binding.producerLifecycleKey },
        routePosition.routeKey,
      );
}

function ownerOccurrenceId(owner: RerolledRewardOwner) {
  return owner.occurrenceId;
}

/**
 * Keeps each touched owner's rerolled reward in step with its effective offer
 * only where nothing was authored: a missing one is created unresolved, and an
 * untouched unresolved one follows the offer or leaves with the last reroll.
 * An authored acquisition that no longer matches stays for repair.
 */
function reconcileRerolledRewards(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  biome: BiomeAddress,
  topology: BiomeTopology,
  owners: readonly RerolledRewardOwner[],
): BiomeTopology {
  const effective = biomeRerolledOwners(biome, topology);
  let next = topology;
  for (const owner of owners) {
    const occurrence = next.occurrences.find(
      (candidate) => candidate.occurrenceId === ownerOccurrenceId(owner),
    );
    if (occurrence === undefined) continue;
    const existing = rerolledRewardOf(occurrence, owner);
    const offer = effective.get(semanticAddressKey(owner))?.effectiveOffer;
    const unauthored =
      existing !== undefined &&
      canonicalJson(existing) ===
        canonicalJson(
          unresolvedRerolledReward(catalog, routePosition, occurrence, owner, existing.offer),
        );
    let reward = existing;
    if (offer === undefined) {
      if (unauthored) reward = undefined;
    } else if (existing === undefined || (unauthored && !sameOffer(existing.offer, offer))) {
      reward = unresolvedRerolledReward(catalog, routePosition, occurrence, owner, offer);
    }
    if (reward !== existing)
      next = replaceOccurrence(next, withRerolledReward(occurrence, owner, reward));
  }
  return next;
}

function requireIndex(command: RerollCommand, index: number, maximum: number): void {
  if (!Number.isInteger(index) || index < 0 || index > maximum)
    failCommand(command, `index must be an integer from 0 through ${maximum}`);
}

/** The structural target a new room reroll may name; legality is the simulation's. */
function requireRerollTarget(
  command: RerollCommand,
  topology: BiomeTopology,
  source: RoomOccurrence,
  target: RerollTarget,
): void {
  if (target.kind === 'wheelOffer') {
    const wheel =
      source.state.kind === 'shipCombat' ? source.state.wheels[target.wheelKey] : undefined;
    if (wheel === undefined || !Object.hasOwn(wheel.offers, target.offerKey))
      failCommand(command, 'names no wheel offer of this room');
    return;
  }
  const exit = topology.decisions.find(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === source.occurrenceId,
  );
  const door =
    exit?.kind === 'exit'
      ? exit.normal.targets.find(
          (candidate) =>
            candidate.exitKey === target.exitKey && candidate.occurrenceId === target.occurrenceId,
        )
      : undefined;
  if (door === undefined) failCommand(command, 'names no door of this room');
  if (target.kind === 'cage') {
    const destination = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === target.occurrenceId,
    );
    if (
      destination?.state.kind !== 'fieldsCombat' ||
      !Object.hasOwn(destination.state.cages, target.slotKey)
    )
      failCommand(command, 'names no cage of that door');
  }
}

function hubRerolls(hub: HubDecision) {
  return hub.actions.flatMap((action) => (action.kind === 'reroll' ? [action] : []));
}

function slotOwner(biome: BiomeAddress, hub: HubDecision, hubSlotKey: string) {
  const target = hub.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  return target === undefined
    ? undefined
    : ({
        kind: 'incomingReward',
        routeKey: biome.routeKey,
        biomeKey: biome.biomeKey,
        occurrenceId: target.occurrenceId,
      } as const);
}

export function applyRerollCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: RerollCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const biome = createBiomeAddress(located.routeKey, located.plan.biomeKey);
  const finish = (next: BiomeTopology, owners: readonly (RerolledRewardOwner | undefined)[]) =>
    updateOccurrenceTopology(
      document,
      located,
      reconcileRerolledRewards(
        catalog,
        located.routePosition,
        biome,
        next,
        owners.flatMap((owner) => (owner === undefined ? [] : [owner])),
      ),
    );
  switch (command.kind) {
    case 'InsertReroll': {
      const source = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      requireRerollTarget(command, topology, source, command.target);
      const order = source.roomActions.order;
      requireIndex(command, command.index, order.length);
      const reroll: RerollRoomAction = Object.freeze({
        kind: 'reroll',
        rerollId: nextRerollId(
          order.flatMap((reference) => (reference.kind === 'reroll' ? [reference] : [])),
        ),
        target: Object.freeze({ ...command.target }),
        reward: command.reward,
      });
      const nextOrder = [...order];
      nextOrder.splice(command.index, 0, reroll);
      return finish(
        replaceOccurrence(
          topology,
          Object.freeze({
            ...source,
            roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
          }),
        ),
        [rerollTargetOwner(biome, source.occurrenceId, reroll)],
      );
    }
    case 'ReplaceRerollReward': {
      const source = requireOccurrence(located.plan, command.action.occurrenceId, command);
      const index = source.roomActions.order.findIndex(
        (reference) => roomActionKey(reference) === command.action.actionKey,
      );
      const existing = source.roomActions.order[index];
      if (existing?.kind !== 'reroll') failCommand(command, 'room action is not an ordered reroll');
      if (sameOffer(existing.reward, command.reward)) return document;
      const nextOrder = [...source.roomActions.order];
      nextOrder[index] = Object.freeze({ ...existing, reward: command.reward });
      return finish(
        replaceOccurrence(
          topology,
          Object.freeze({
            ...source,
            roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
          }),
        ),
        [rerollTargetOwner(biome, source.occurrenceId, existing)],
      );
    }
    case 'InsertHubReroll':
    case 'ReplaceHubRerollReward':
    case 'RemoveHubReroll': {
      const hubKey =
        command.kind === 'InsertHubReroll' ? command.hub.hubKey : command.reroll.hubKey;
      const hub = topology.decisions.find(
        (decision): decision is HubDecision =>
          decision.kind === 'hub' && decision.hubKey === hubKey,
      );
      if (hub === undefined) failCommand(command, `unknown Hub ${hubKey}`);
      let actions: HubAction[];
      let owner: RerolledRewardOwner | undefined;
      if (command.kind === 'InsertHubReroll') {
        owner = slotOwner(biome, hub, command.hubSlotKey);
        if (owner === undefined) failCommand(command, `${command.hubSlotKey} is not open`);
        requireIndex(command, command.index, hub.actions.length);
        actions = [...hub.actions];
        actions.splice(
          command.index,
          0,
          Object.freeze({
            kind: 'reroll',
            rerollId: nextRerollId(hubRerolls(hub)),
            hubSlotKey: command.hubSlotKey,
            reward: command.reward,
          }),
        );
      } else {
        const rerollId = command.reroll.rerollId;
        const index = hub.actions.findIndex(
          (action) => action.kind === 'reroll' && action.rerollId === rerollId,
        );
        const existing = hub.actions[index];
        if (existing?.kind !== 'reroll') failCommand(command, `unknown Hub reroll ${rerollId}`);
        owner = slotOwner(biome, hub, existing.hubSlotKey);
        actions = [...hub.actions];
        if (command.kind === 'RemoveHubReroll') actions.splice(index, 1);
        else {
          if (sameOffer(existing.reward, command.reward)) return document;
          actions[index] = Object.freeze({ ...existing, reward: command.reward });
        }
      }
      return finish(
        Object.freeze({
          ...topology,
          decisions: Object.freeze(
            topology.decisions.map((decision) =>
              decision === hub
                ? Object.freeze({ ...hub, actions: Object.freeze(actions) })
                : decision,
            ),
          ),
        }),
        [owner],
      );
    }
    case 'DropRerolledReward':
    case 'AdoptRerolledReward': {
      const occurrence = requireOccurrence(located.plan, command.owner.occurrenceId, command);
      const existing = rerolledRewardOf(occurrence, command.owner);
      if (command.kind === 'DropRerolledReward') {
        if (existing === undefined) return document;
        return updateOccurrenceTopology(
          document,
          located,
          replaceOccurrence(topology, withRerolledReward(occurrence, command.owner, undefined)),
        );
      }
      const offer = biomeRerolledOwners(biome, topology).get(
        semanticAddressKey(command.owner),
      )?.effectiveOffer;
      if (offer === undefined) failCommand(command, 'owner has no reroll');
      if (existing !== undefined && sameOffer(existing.offer, offer)) return document;
      const reward = unresolvedRerolledReward(
        catalog,
        located.routePosition,
        occurrence,
        command.owner,
        offer,
      );
      if (reward === undefined) failCommand(command, 'owner draws no rerollable reward');
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(topology, withRerolledReward(occurrence, command.owner, reward)),
      );
    }
  }
}

/** Reconciles every slot a Hub's rerolls target after its actions were reordered. */
export function reconcileHubRerolledRewards(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  hub: HubDecision,
): BiomeTopology {
  const biome = createBiomeAddress(located.routeKey, located.plan.biomeKey);
  return reconcileRerolledRewards(
    catalog,
    located.routePosition,
    biome,
    topology,
    hubRerolls(hub).flatMap((reroll) => {
      const owner = slotOwner(biome, hub, reroll.hubSlotKey);
      return owner === undefined ? [] : [owner];
    }),
  );
}

/** Reconciles the owner a removed or moved room reroll targeted. */
export function reconcileRemovedOrMovedReroll(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  source: RoomOccurrence,
  reroll: RerollRoomAction,
): ProjectDocument {
  const plan = document.route.biomes[located.biomeIndex];
  const topology = plan?.topology;
  if (plan === undefined || topology === null || topology === undefined) return document;
  const biome = createBiomeAddress(located.routeKey, plan.biomeKey);
  const reconciled = reconcileRerolledRewards(catalog, located.routePosition, biome, topology, [
    rerollTargetOwner(biome, source.occurrenceId, reroll),
  ]);
  return reconciled === topology
    ? document
    : updateOccurrenceTopology(document, { ...located, plan }, reconciled);
}
