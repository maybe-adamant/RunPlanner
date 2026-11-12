import type { Catalog } from '../../catalog-schema';
import { sameRewardOffer } from '../../reward-kernel';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import { createBiomeAddress, semanticAddressKey, type BiomeAddress } from '../addresses';
import type {
  BiomeTopology,
  HubAction,
  HubDecision,
  HubRerollAction,
  ProjectDocument,
  RerolledRewardState,
  ResolvedRerollTarget,
  RerollRoomAction,
  RerollTarget,
  RoomOccurrence,
} from '../model';
import {
  biomeRerolledOwners,
  biomeRerollPressesByOwner,
  heldRerolledRecords,
  hubRerollOwner,
  nextRerollId,
  rerolledRecordOf,
  rerollPressNeedsResult,
  rerollResult,
  rerollTargetOwner,
  roomRerollOwner,
  withRerolledAcquisition,
  withRerolledRecord,
  type RerolledRewardOwner,
} from '../rerolls';
import { roomActionKey } from '../room-actions/key';
import { unresolvedRerolledReward } from '../rerolled-acquisition';
import type { ResolvedRoutePosition } from '../route-context';
import {
  failCommand,
  locateConfiguredBiome,
  requireOccurrence,
  requireTopology,
  type LocatedBiome,
} from './contract';
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

/**
 * The record with its item set to this press, its outcomes unresolved; with
 * none while no press of its owner is effective, since the owner then acquires
 * its first draw.
 */
function withUnresolvedItem(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
  results: Readonly<Record<string, ResolvedRewardOffer>>,
  pressId: string,
  effective: boolean,
): RerolledRewardState {
  return withRerolledAcquisition(
    Object.freeze({ results, pressId }),
    effective
      ? unresolvedRerolledReward(catalog, routePosition, occurrence, owner, results[pressId]!)
      : undefined,
  );
}

/** Whether the record's effective item holds only its unresolved defaults. */
function rerolledOutcomesUnauthored(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
  record: RerolledRewardState,
): boolean {
  const offer = record.results[record.pressId];
  if (offer === undefined || record.acquisition === undefined) return true;
  const unresolved = unresolvedRerolledReward(catalog, routePosition, occurrence, owner, offer);
  const { offer: _offer, ...defaults } = unresolved ?? { offer };
  void _offer;
  return (
    canonicalJson(record.acquisition ?? null) ===
    canonicalJson(unresolved === undefined ? null : defaults)
  );
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
  target: ResolvedRerollTarget,
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
  if (
    exit?.kind !== 'exit' ||
    !exit.normal.targets.some(
      (candidate) =>
        candidate.exitKey === target.exitKey && candidate.occurrenceId === target.occurrenceId,
    )
  )
    failCommand(command, 'names no door of this room');
  if (target.kind === 'door') return;
  const destination = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === target.occurrenceId,
  );
  if (
    destination?.state.kind !== 'fieldsCombat' ||
    !Object.hasOwn(destination.state.cages, target.slotKey)
  )
    failCommand(command, 'names no cage of that door');
}

function hubRerolls(hub: HubDecision) {
  return hub.actions.flatMap((action) => (action.kind === 'reroll' ? [action] : []));
}

/** The topology with the owner's room holding this press's result. */
function withPressResult(
  topology: BiomeTopology,
  owner: RerolledRewardOwner,
  rerollId: string,
  reward: ResolvedRewardOffer,
): BiomeTopology {
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === owner.occurrenceId,
  );
  if (occurrence === undefined) return topology;
  const record = rerolledRecordOf(occurrence, owner);
  // A new owner's first press is its effective item; settlement of the edit fills its outcomes.
  const next: RerolledRewardState =
    record === undefined
      ? Object.freeze({ results: Object.freeze({ [rerollId]: reward }), pressId: rerollId })
      : Object.freeze({
          ...record,
          results: Object.freeze({ ...record.results, [rerollId]: reward }),
        });
  return replaceOccurrence(topology, withRerolledRecord(occurrence, owner, next));
}

/** The room press this address names, at its index in the room's order. */
function requireRoomPress(
  command: RerollCommand,
  source: RoomOccurrence,
  actionKey: string,
): { readonly index: number; readonly press: RerollRoomAction } {
  const index = source.roomActions.order.findIndex(
    (reference) => roomActionKey(reference) === actionKey,
  );
  const press = source.roomActions.order[index];
  if (press?.kind !== 'reroll') failCommand(command, 'room action is not an ordered reroll');
  return { index, press };
}

export function applyRerollCommand(
  document: ProjectDocument,
  located: LocatedBiome,
  command: RerollCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const biome = createBiomeAddress(located.routeKey, located.plan.biomeKey);
  switch (command.kind) {
    case 'InsertReroll': {
      const source = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      requireRerollTarget(command, topology, source, command.target);
      const order = source.roomActions.order;
      requireIndex(command, command.index, order.length);
      const { slotKey: _slotKey, ...target } = command.target as ResolvedRerollTarget & {
        readonly slotKey?: string;
      };
      void _slotKey;
      const reroll: RerollRoomAction = Object.freeze({
        kind: 'reroll',
        rerollId: nextRerollId(
          order.flatMap((reference) => (reference.kind === 'reroll' ? [reference.rerollId] : [])),
        ),
        target: Object.freeze(target) as RerollTarget,
      });
      const nextOrder = [...order];
      nextOrder.splice(command.index, 0, reroll);
      return updateOccurrenceTopology(
        document,
        located,
        withPressResult(
          replaceOccurrence(
            topology,
            Object.freeze({
              ...source,
              roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
            }),
          ),
          rerollTargetOwner(biome, source.occurrenceId, command.target),
          reroll.rerollId,
          command.reward,
        ),
      );
    }
    case 'ReplaceRerollReward': {
      const source = requireOccurrence(located.plan, command.action.occurrenceId, command);
      const { press } = requireRoomPress(command, source, command.action.actionKey);
      const owner = roomRerollOwner(biome, topology, source.occurrenceId, press);
      if (owner === undefined) failCommand(command, 'reroll redraws no reward of its target');
      const current = rerollResult(topology, owner, press.rerollId);
      if (current !== undefined && sameRewardOffer(current, command.reward)) return document;
      return updateOccurrenceTopology(
        document,
        located,
        withPressResult(topology, owner, press.rerollId, command.reward),
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
      let actions: HubAction[] = [...hub.actions];
      let result:
        { owner: RerolledRewardOwner; rerollId: string; reward: ResolvedRewardOffer } | undefined;
      if (command.kind === 'InsertHubReroll') {
        requireIndex(command, command.index, hub.actions.length);
        const press: HubRerollAction = Object.freeze({
          kind: 'reroll',
          rerollId: nextRerollId(hubRerolls(hub).map((reroll) => reroll.rerollId)),
          hubSlotKey: command.hubSlotKey,
        });
        const owner = hubRerollOwner(biome, hub, press);
        if (owner === undefined) failCommand(command, `${command.hubSlotKey} is not open`);
        actions.splice(command.index, 0, press);
        result = { owner, rerollId: press.rerollId, reward: command.reward };
      } else {
        const rerollId = command.reroll.rerollId;
        const index = hub.actions.findIndex(
          (action) => action.kind === 'reroll' && action.rerollId === rerollId,
        );
        const existing = hub.actions[index];
        if (existing?.kind !== 'reroll') failCommand(command, `unknown Hub reroll ${rerollId}`);
        if (command.kind === 'RemoveHubReroll') actions.splice(index, 1);
        else {
          const owner = hubRerollOwner(biome, hub, existing);
          if (owner === undefined) failCommand(command, `${existing.hubSlotKey} is not open`);
          const current = rerollResult(topology, owner, rerollId);
          if (current !== undefined && sameRewardOffer(current, command.reward)) return document;
          result = { owner, rerollId, reward: command.reward };
          actions = [...hub.actions];
        }
      }
      const next: BiomeTopology = Object.freeze({
        ...topology,
        decisions: Object.freeze(
          topology.decisions.map((decision) =>
            decision === hub
              ? Object.freeze({ ...hub, actions: Object.freeze(actions) })
              : decision,
          ),
        ),
      });
      return updateOccurrenceTopology(
        document,
        located,
        result === undefined
          ? next
          : withPressResult(next, result.owner, result.rerollId, result.reward),
      );
    }
  }
}

/**
 * The topology without the presses whose target can hold a result but holds
 * none: the item they redrew went with an edit that did not keep it, so they
 * go with it. The same topology when none is.
 */
function withoutPressesOffTheirItem(biome: BiomeAddress, topology: BiomeTopology): BiomeTopology {
  let changed = false;
  const occurrences = topology.occurrences.map((source) => {
    const order = source.roomActions.order.filter(
      (action) =>
        action.kind !== 'reroll' ||
        !rerollPressNeedsResult(topology, source, action) ||
        rerollResult(
          topology,
          roomRerollOwner(biome, topology, source.occurrenceId, action),
          action.rerollId,
        ) !== undefined,
    );
    if (order.length === source.roomActions.order.length) return source;
    changed = true;
    return Object.freeze({
      ...source,
      roomActions: Object.freeze({ ...source.roomActions, order: Object.freeze(order) }),
    });
  });
  const decisions = topology.decisions.map((decision) => {
    if (decision.kind !== 'hub') return decision;
    const actions = decision.actions.filter((action) => {
      if (action.kind !== 'reroll') return true;
      const owner = hubRerollOwner(biome, decision, action);
      return owner === undefined || rerollResult(topology, owner, action.rerollId) !== undefined;
    });
    if (actions.length === decision.actions.length) return decision;
    changed = true;
    return Object.freeze({ ...decision, actions: Object.freeze(actions) });
  });
  return changed
    ? Object.freeze({
        ...topology,
        occurrences: Object.freeze(occurrences),
        decisions: Object.freeze(decisions),
      })
    : topology;
}

/**
 * Keeps each touched biome's presses and rerolled records closed over each
 * other after an edit. A press whose target can hold a result but holds none
 * goes: the edit did not keep its item. A record names exactly the results of
 * the presses still naming its owner, and goes with the last of them. Its
 * effective item follows the edit:
 * - a new or still unauthored item follows the owner's effective press;
 * - an item whose press went, or whose result the edit changed in place, is
 *   replaced by the effective press's item, its outcomes unresolved;
 * - an item its owner can no longer draw holds no outcomes.
 * Authored outcomes whose press is still held but no longer effective stay for
 * settlement, which resets and announces them.
 */
export function closeRerolledRecords(
  catalog: Catalog,
  before: ProjectDocument,
  after: ProjectDocument,
  biomeKeys: ReadonlySet<string>,
): ProjectDocument {
  let next = after;
  for (const biomeKey of biomeKeys) {
    const located = locateConfiguredBiome(next, catalog, biomeKey);
    const edited = located?.plan.topology;
    if (located === undefined || edited === null || edited === undefined) continue;
    const biome = createBiomeAddress(located.routeKey, biomeKey);
    const topology = withoutPressesOffTheirItem(biome, edited);
    const held = heldRerolledRecords(biome, topology);
    if (held.length === 0) {
      if (topology !== edited) next = updateOccurrenceTopology(next, located, topology);
      continue;
    }
    const priorTopology = before.route.biomes.find((plan) => plan.biomeKey === biomeKey)?.topology;
    const pressesByOwner = biomeRerollPressesByOwner(biome, topology);
    const effective = biomeRerolledOwners(biome, topology);
    // The presses before the edit matter only for a record the edit left as it was.
    let priorMaps:
      | {
          readonly presses: ReturnType<typeof biomeRerollPressesByOwner>;
          readonly effective: ReturnType<typeof biomeRerolledOwners>;
        }
      | undefined;
    const beforeEdit = () =>
      (priorMaps ??=
        priorTopology === null || priorTopology === undefined
          ? { presses: new Map(), effective: new Map() }
          : {
              presses: biomeRerollPressesByOwner(biome, priorTopology),
              effective: biomeRerolledOwners(biome, priorTopology),
            });
    let closed = topology;
    for (const { owner, record } of held) {
      const key = semanticAddressKey(owner);
      const occurrence = closed.occurrences.find(
        (candidate) => candidate.occurrenceId === owner.occurrenceId,
      )!;
      const pressIds = pressesByOwner.get(key)?.rerollIds ?? [];
      const results = Object.freeze(
        Object.fromEntries(
          pressIds.flatMap((rerollId) =>
            Object.hasOwn(record.results, rerollId) ? [[rerollId, record.results[rerollId]!]] : [],
          ),
        ),
      );
      const kept = Object.keys(results);
      if (kept.length === 0) {
        closed = replaceOccurrence(closed, withRerolledRecord(occurrence, owner, undefined));
        continue;
      }
      const prior =
        priorTopology === null || priorTopology === undefined
          ? undefined
          : (() => {
              const priorOccurrence = priorTopology.occurrences.find(
                (candidate) => candidate.occurrenceId === owner.occurrenceId,
              );
              return priorOccurrence === undefined
                ? undefined
                : rerolledRecordOf(priorOccurrence, owner);
            })();
      const effectivePress = effective.get(key)?.rerolls.at(-1)?.rerollId;
      const latest = effectivePress ?? pressIds.at(-1)!;
      const touched =
        prior !== record ||
        (beforeEdit().presses.get(key)?.rerollIds ?? []).join(' ') !== pressIds.join(' ') ||
        beforeEdit().effective.get(key)?.rerolls.at(-1)?.rerollId !== effectivePress;
      const priorResult = prior?.results[record.pressId];
      const changedInPlace =
        priorResult !== undefined &&
        results[record.pressId] !== undefined &&
        !sameRewardOffer(priorResult, results[record.pressId]!);
      const follows =
        touched &&
        latest !== record.pressId &&
        (prior === undefined ||
          rerolledOutcomesUnauthored(catalog, located.routePosition, occurrence, owner, prior));
      const item = (pressId: string) =>
        withUnresolvedItem(
          catalog,
          located.routePosition,
          occurrence,
          owner,
          results,
          pressId,
          effectivePress !== undefined,
        );
      const closedRecord: RerolledRewardState =
        !Object.hasOwn(results, record.pressId) || follows
          ? item(latest)
          : changedInPlace ||
              // No effective press: the owner acquires its first draw, so this item holds nothing.
              (effectivePress === undefined && record.acquisition !== undefined) ||
              // A new item, or one the owner draws again, holds its unresolved outcomes.
              (effectivePress !== undefined && record.acquisition === undefined) ||
              // A rebuilt room that kept the item may no longer draw its reward.
              (record.acquisition !== undefined &&
                unresolvedRerolledReward(
                  catalog,
                  located.routePosition,
                  occurrence,
                  owner,
                  results[record.pressId]!,
                ) === undefined)
            ? item(record.pressId)
            : Object.freeze({ ...record, results });
      if (canonicalJson(closedRecord) === canonicalJson(record)) continue;
      closed = replaceOccurrence(closed, withRerolledRecord(occurrence, owner, closedRecord));
    }
    if (closed !== edited) next = updateOccurrenceTopology(next, located, closed);
  }
  return next;
}

/** Each rerolled record the plan holds, with what judging its press and outcomes reads. */
function heldRecords(catalog: Catalog, document: ProjectDocument) {
  return document.route.biomes.flatMap((plan) => {
    const topology = plan.topology;
    if (topology === null || topology === undefined) return [];
    const biome = createBiomeAddress(document.route.routeKey, plan.biomeKey);
    const held = heldRerolledRecords(biome, topology);
    // Only a biome holding records needs its route position.
    const located =
      held.length === 0 ? undefined : locateConfiguredBiome(document, catalog, plan.biomeKey);
    if (located === undefined) return [];
    const effective = biomeRerolledOwners(biome, topology);
    return held.map(({ owner, record }) => {
      const occurrence = topology.occurrences.find(
        (candidate) => candidate.occurrenceId === owner.occurrenceId,
      )!;
      const effectivePress = effective.get(semanticAddressKey(owner))?.rerolls.at(-1)?.rerollId;
      const unauthored = () =>
        rerolledOutcomesUnauthored(catalog, located.routePosition, occurrence, owner, record);
      return { owner, record, effectivePress, unauthored };
    });
  });
}

/**
 * Every rerolled record the plan holds off its press, by owner: its recorded
 * press is not its owner's effective one, or no press is effective while it
 * holds authored outcomes. Its outcomes belong to a replaced item.
 */
export function rerolledRewardsOffTheirPress(
  catalog: Catalog,
  document: ProjectDocument,
): RerolledRewardOwner[] {
  return heldRecords(catalog, document).flatMap(({ owner, record, effectivePress, unauthored }) =>
    (effectivePress === undefined ? !unauthored() : effectivePress !== record.pressId)
      ? [owner]
      : [],
  );
}

/**
 * The rerolled items whose authored outcomes an edit itself replaced in the
 * rooms it kept: its recorded press went, that press's result changed in
 * place, or no press of its owner is effective any more, so the edit's
 * closure reset or dropped them.
 */
export function rerolledItemsReplacedBetween(
  catalog: Catalog,
  before: ProjectDocument,
  after: ProjectDocument,
): RerolledRewardOwner[] {
  return heldRecords(catalog, before).flatMap(({ owner, record, unauthored }) => {
    const current = after.route.biomes
      .find((plan) => plan.biomeKey === owner.biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === owner.occurrenceId);
    // A room the edit removed takes its outcomes with it, unannounced.
    if (current === undefined) return [];
    const next = rerolledRecordOf(current, owner);
    if (next === record) return [];
    const result = record.results[record.pressId];
    const nextResult = next?.results[record.pressId];
    const sameItem =
      next?.acquisition !== undefined &&
      next.pressId === record.pressId &&
      result !== undefined &&
      nextResult !== undefined &&
      sameRewardOffer(result, nextResult);
    return sameItem || unauthored() ? [] : [owner];
  });
}

/**
 * Resets a rerolled record off its press to the unresolved acquisition of the
 * effective press's reward (else its own): its outcomes belonged to the
 * replaced item. The same document when the owner holds no record.
 */
export function resetRerolledRewardOffItsPress(
  document: ProjectDocument,
  catalog: Catalog,
  owner: RerolledRewardOwner,
): ProjectDocument {
  const located = locateConfiguredBiome(document, catalog, owner.biomeKey);
  const topology = located?.plan.topology;
  if (located === undefined || topology === null || topology === undefined) return document;
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === owner.occurrenceId,
  );
  const record = occurrence === undefined ? undefined : rerolledRecordOf(occurrence, owner);
  if (occurrence === undefined || record === undefined) return document;
  const effective = biomeRerolledOwners(
    createBiomeAddress(located.routeKey, owner.biomeKey),
    topology,
  )
    .get(semanticAddressKey(owner))
    ?.rerolls.at(-1)?.rerollId;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      withRerolledRecord(
        occurrence,
        owner,
        withUnresolvedItem(
          catalog,
          located.routePosition,
          occurrence,
          owner,
          record.results,
          effective ?? record.pressId,
          effective !== undefined,
        ),
      ),
    ),
  );
}
