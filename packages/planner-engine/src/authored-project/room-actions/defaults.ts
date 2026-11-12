import type { Catalog } from '../../catalog-schema';
import type { BiomeAddress } from '../addresses';
import { resolveRoutePosition, type ResolvedRoutePosition } from '../route-context';
import { resolveEntryRoom } from '../room-state/entry-resolution';
import { composeStartingReward } from '../room-state/starting-reward';
import type {
  AuthoredBiomePlan,
  BiomeTopology,
  OccurrenceId,
  ProjectDocument,
  RoomActionReference,
  RoomOccurrence,
} from '../model';
import {
  assembleRoomActionDomain,
  type RoomActionContribution,
  type RoomActionDomain,
} from './domain';
import { roomActionOpeningPoint, roomEventPlaces } from './event-graph';
import { roomLifecycleProfileKey, roomRunsProducer } from './lifecycle-profile';
import { clockworkDoors, forcedDoorReward } from '../clockwork-doors';
import { fieldsDefaultActiveCageCount } from '../fields';
import { roomActionKey } from './state';
import { encounterEnvelopeSlots } from '../room-state/encounter-envelope';

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

export { structurallyActiveOccurrenceIds } from '../topology/query';

function fieldsPhaseOrder(
  catalog: Catalog,
  domain: RoomActionDomain,
  order: readonly RoomActionReference[],
) {
  const retained = order.flatMap((reference) =>
    reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
  );
  const declared = encounterEnvelopeSlots(
    catalog,
    domain.declaration,
    domain.declaration.gameName,
  ).flatMap((phase) => (phase.rewardAttachment?.kind === 'localReward' ? [phase.key] : []));
  return [...retained, ...declared.filter((phaseKey) => !retained.includes(phaseKey))];
}

function score(
  catalog: Catalog,
  domain: RoomActionDomain,
  order: readonly RoomActionReference[],
  action: RoomActionContribution,
): number {
  const reference = action.reference;
  // A Fields room's rows score from their cage order below.
  const cagePhaseKey =
    action.bounds.spawn.kind === 'encounterEnd' || action.bounds.spawn.kind === 'endEffects'
      ? action.bounds.spawn.phaseKey
      : undefined;
  const fields = domain.eventGraph.events.some(
    (event) => event.kind === 'encounterBegun' && event.trigger.kind === 'action',
  );
  if (!fields)
    return roomEventPlaces(domain.eventGraph)(roomActionOpeningPoint(action.bounds)) * 100;
  const phaseOrder = fieldsPhaseOrder(catalog, domain, order);
  if (reference.kind === 'interactEncounter' || reference.kind === 'interactGorgon') {
    const ordinal = phaseOrder.indexOf(reference.phaseKey);
    return ordinal < 0 ? 100 : 2100 + ordinal * 200;
  }
  if (reference.kind === 'completeFieldsCage') {
    const ordinal = phaseOrder.indexOf(reference.phaseKey);
    return 2000 + Math.max(0, ordinal) * 200;
  }
  if (reference.kind === 'interactLocalReward' && reference.groupKey === 'cages') {
    const ordinal = phaseOrder.indexOf(cagePhaseKey ?? '');
    if (ordinal < 0) throw new Error(`${domain.declaration.gameName} cage reward has no phase`);
    return 2150 + ordinal * 200;
  }
  // A cage end's delivery or clocked drop is collected with its cage, after the reward.
  if (reference.kind === 'interactAcquisitionEntry' && cagePhaseKey !== undefined) {
    const ordinal = phaseOrder.indexOf(cagePhaseKey);
    if (ordinal >= 0) return 2175 + ordinal * 200;
  }
  return 8000;
}

function sortedCohort(
  catalog: Catalog,
  domain: RoomActionDomain,
  order: readonly RoomActionReference[],
  actions: readonly RoomActionContribution[],
): readonly RoomActionContribution[] {
  const pending = new Map(actions.map((action) => [roomActionKey(action.reference), action]));
  const contributionOrdinal = new Map(
    domain.contributions.flatMap((entry, index) =>
      entry.kind === 'action' ? [[roomActionKey(entry.reference), index] as const] : [],
    ),
  );
  const result: RoomActionContribution[] = [];
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((action) =>
      action.dependencies.every(
        (dependency) =>
          dependency.kind !== 'afterAction' ||
          !pending.has(roomActionKey(dependency.action)) ||
          result.some(
            (candidate) => roomActionKey(candidate.reference) === roomActionKey(dependency.action),
          ),
      ),
    );
    if (ready.length === 0) {
      throw new Error(`${domain.declaration.gameName} has a cyclic required Room Action cohort`);
    }
    ready.sort(
      (left, right) =>
        score(catalog, domain, order, left) - score(catalog, domain, order, right) ||
        (contributionOrdinal.get(roomActionKey(left.reference)) ?? Number.MAX_SAFE_INTEGER) -
          (contributionOrdinal.get(roomActionKey(right.reference)) ?? Number.MAX_SAFE_INTEGER) ||
        roomActionKey(left.reference).localeCompare(roomActionKey(right.reference)),
    );
    const next = ready[0]!;
    pending.delete(roomActionKey(next.reference));
    result.push(next);
  }
  return frozen(result);
}

/** Add the exact required cohort at deterministic lifecycle defaults, retaining authored order. */
export function scheduleRequiredRoomActions(options: {
  readonly catalog: Catalog;
  readonly domain: RoomActionDomain;
  readonly order: readonly RoomActionReference[];
  readonly requiredKeys: ReadonlySet<string>;
  /** `any` also ranks named optional actions, such as a rushed Shrine pickup. */
  readonly participation?: 'required' | 'any';
}): readonly RoomActionReference[] {
  const authoredKeys = new Set(options.order.map(roomActionKey));
  const activeActions = options.domain.contributions.filter(
    (entry): entry is RoomActionContribution => entry.kind === 'action',
  );
  const byKey = new Map(activeActions.map((action) => [roomActionKey(action.reference), action]));
  const contributionOrdinal = new Map(
    activeActions.map((action, index) => [roomActionKey(action.reference), index]),
  );
  const cohort = activeActions.filter(
    (action) =>
      (action.participation === 'required' || options.participation === 'any') &&
      options.requiredKeys.has(roomActionKey(action.reference)) &&
      !authoredKeys.has(roomActionKey(action.reference)),
  );
  if (cohort.length === 0) return options.order;
  const result = [...options.order];
  for (const action of sortedCohort(options.catalog, options.domain, result, cohort)) {
    const actionScore = score(options.catalog, options.domain, result, action);
    let lowerBound = 0;
    for (const dependency of action.dependencies) {
      if (dependency.kind !== 'afterAction') continue;
      const index = result.findIndex(
        (reference) => roomActionKey(reference) === roomActionKey(dependency.action),
      );
      if (index >= 0) lowerBound = Math.max(lowerBound, index + 1);
    }
    let upperBound = result.length;
    for (let index = 0; index < result.length; index += 1) {
      const retained = byKey.get(roomActionKey(result[index]!));
      if (retained === undefined) continue;
      const retainedDependsOnAction = retained.dependencies.some(
        (dependency) =>
          dependency.kind === 'afterAction' &&
          roomActionKey(dependency.action) === roomActionKey(action.reference),
      );
      if (
        retainedDependsOnAction ||
        score(options.catalog, options.domain, result, retained) > actionScore ||
        (score(options.catalog, options.domain, result, retained) === actionScore &&
          (contributionOrdinal.get(roomActionKey(retained.reference)) ?? Number.MAX_SAFE_INTEGER) >
            (contributionOrdinal.get(roomActionKey(action.reference)) ?? Number.MAX_SAFE_INTEGER))
      ) {
        upperBound = index;
        break;
      }
    }
    const insertionIndex = Math.max(lowerBound, upperBound);
    result.splice(Math.min(insertionIndex, result.length), 0, action.reference);
    authoredKeys.add(roomActionKey(action.reference));
  }
  return frozen(result);
}

/**
 * The lifecycle an authored occurrence runs where its plan places it, in its
 * Hub role if it has one, and whether it runs its reward's producer: the same
 * answers materialization publishes for the room.
 */
export function occurrenceLifecycle(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  plan: AuthoredBiomePlan,
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
): { readonly lifecycleProfileKey: string; readonly producer: boolean } {
  const rawDeclaration = catalog.rooms.byKey[occurrence.gameName];
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (rawDeclaration === undefined || layout === undefined)
    throw new Error(`missing Room Action declaration context for ${occurrence.gameName}`);
  const entry = topology.startOccurrenceId === occurrence.occurrenceId;
  const resolved = resolveEntryRoom(catalog, rawDeclaration, routePosition, entry);
  const role = topology.decisions.some(
    (decision) =>
      decision.kind === 'localVisit' &&
      Object.values(decision.targetsBySlot).some(
        (target) => target.occurrenceId === occurrence.occurrenceId,
      ),
  )
    ? 'localVisit'
    : topology.decisions.some(
          (decision) =>
            decision.kind === 'hub' &&
            decision.openTargets.some((target) => target.occurrenceId === occurrence.occurrenceId),
        )
      ? 'hubTarget'
      : 'ordinary';
  return Object.freeze({
    lifecycleProfileKey: roomLifecycleProfileKey(resolved.declaration, role, occurrence),
    producer: roomRunsProducer(
      resolved,
      entry,
      forcedDoorReward(
        clockworkDoors(catalog, layout, topology, plan.state),
        occurrence.occurrenceId,
      ),
    ),
  });
}

function roomActionDomainContext(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  plan: AuthoredBiomePlan,
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
  loadout: ProjectDocument['route']['loadout'],
): {
  readonly lifecycleProfileKey: string;
  readonly producer: boolean;
  readonly incomingRewardBinding?: import('../../reward-kernel/bindings').RewardProducerBinding;
  readonly incomingRewardState?: import('../model').AuthoredRewardState | null;
  readonly activeEncounterSlotKeys?: readonly string[];
} {
  const rawDeclaration = catalog.rooms.byKey[occurrence.gameName];
  const entry = topology.startOccurrenceId === occurrence.occurrenceId;
  const resolved =
    rawDeclaration === undefined
      ? undefined
      : resolveEntryRoom(catalog, rawDeclaration, routePosition, entry);
  const declaration = resolved?.declaration;
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (resolved === undefined || declaration === undefined || layout === undefined) {
    throw new Error(`missing Room Action declaration context for ${occurrence.gameName}`);
  }
  const lifecycle = occurrenceLifecycle(catalog, routePosition, plan, topology, occurrence);
  const startingReward =
    entry && routePosition.isFirst
      ? composeStartingReward(loadout.startingReward, occurrence.startingRewardAcquisition)
      : undefined;
  const entryRewardContext =
    startingReward === undefined
      ? {}
      : {
          incomingRewardBinding: resolved.incomingRewardBinding,
          incomingRewardState: startingReward,
        };
  if (declaration.mode.kind !== 'authored' || declaration.mode.templateKey !== 'FieldsCombat') {
    return frozen({ ...lifecycle, ...entryRewardContext });
  }
  const decision = topology.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      candidate.normal.targets.some((target) => target.occurrenceId === occurrence.occurrenceId),
  );
  if (decision?.kind !== 'exit') return frozen({ ...lifecycle, ...entryRewardContext });
  const activeCageCount = fieldsDefaultActiveCageCount({
    catalog,
    layout,
    topology,
    decision,
    room: declaration,
    replacingOccurrenceId: occurrence.occurrenceId,
  });
  if (activeCageCount === undefined) return frozen({ ...lifecycle, ...entryRewardContext });
  const slots = encounterEnvelopeSlots(catalog, declaration, occurrence.gameName);
  const passive = slots.filter((phase) => phase.rewardAttachment?.kind !== 'localReward');
  const cages = slots.filter((phase) => phase.rewardAttachment?.kind === 'localReward');
  return frozen({
    ...lifecycle,
    ...entryRewardContext,
    activeEncounterSlotKeys: frozen([
      ...passive.map((phase) => phase.key),
      ...cages.slice(0, activeCageCount).map((phase) => phase.key),
    ]),
  });
}

export function replaceOccurrenceOrders(
  proposed: ProjectDocument,
  replacements: ReadonlyMap<string, readonly RoomActionReference[]>,
): ProjectDocument {
  const route = proposed.route;
  return frozen({
    ...proposed,
    route: frozen({
      ...route,
      biomes: frozen(
        route.biomes.map((plan): AuthoredBiomePlan => {
          const replaceOrder = (occurrence: RoomOccurrence): RoomOccurrence => {
            const key = JSON.stringify([route.routeKey, plan.biomeKey, occurrence.occurrenceId]);
            const order = replacements.get(key);
            return order === undefined
              ? occurrence
              : frozen({ ...occurrence, roomActions: frozen({ order }) });
          };
          if (plan.topology === null) return plan;
          const occurrences = plan.topology.occurrences.map(replaceOrder);
          return frozen({
            ...plan,
            topology: frozen({ ...plan.topology, occurrences: frozen(occurrences) }),
          });
        }),
      ),
    }),
  });
}

export function roomActionDomainForOccurrence(
  document: ProjectDocument,
  catalog: Catalog,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): { readonly occurrence: RoomOccurrence; readonly domain: RoomActionDomain } | undefined {
  const plan =
    document.route.routeKey === biome.routeKey
      ? document.route.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
      : undefined;
  const topology = plan?.topology ?? undefined;
  const occurrence = topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (plan === undefined || topology === undefined || occurrence === undefined) return undefined;
  const routePosition = resolveRoutePosition(catalog, document.route, biome.biomeKey);
  return frozen({
    occurrence,
    domain: assembleRoomActionDomain({
      catalog,
      biome,
      topology,
      occurrence,
      routePosition,
      ...roomActionDomainContext(
        catalog,
        routePosition,
        plan,
        topology,
        occurrence,
        document.route.loadout,
      ),
    }),
  });
}
