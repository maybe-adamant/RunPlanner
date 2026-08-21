import type { Catalog } from '../catalog-schema';
import { createBiomeAddress, type BiomeAddress } from './addresses';
import type {
  AuthoredBiomePlan,
  BiomeTopology,
  OccurrenceId,
  ProjectDocument,
  RoomActionReference,
  RoomOccurrence,
} from './model';
import {
  assembleRoomActionDomain,
  authoredRoomLifecycleProfileKey,
  roomLifecycleWindowOrdinal,
  type RoomActionContribution,
  type RoomActionDomain,
} from './room-action-domain';
import { fieldsDefaultActiveCageCount } from './fields';
import { roomActionKey } from './room-actions';
import { additionalExitsForDecision, selectedExitContinuation } from './topology/query';
import { encounterEnvelopeSlots } from './room-state/encounters';

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

/** Structurally entered occurrence identities, independent of evaluation reach. */
export function structurallyActiveOccurrenceIds(
  topology: BiomeTopology,
): ReadonlySet<OccurrenceId> {
  const active = new Set<OccurrenceId>([topology.startOccurrenceId]);
  const activeHubDecisions = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const decision of topology.decisions) {
      if (decision.kind === 'localVisit') {
        if (!active.has(decision.sourceOccurrenceId)) continue;
        for (const occurrenceId of decision.visitOrder) {
          const target = Object.values(decision.targetsBySlot).find(
            (candidate) => candidate.occurrenceId === occurrenceId,
          );
          if (target?.generation !== 'generated' || active.has(occurrenceId)) continue;
          active.add(occurrenceId);
          changed = true;
        }
        continue;
      }
      if (decision.kind === 'hub') {
        if (!active.has(decision.source.occurrenceId)) continue;
        if (!activeHubDecisions.has(decision.hubKey)) {
          activeHubDecisions.add(decision.hubKey);
          changed = true;
        }
        const bySlot = new Map(decision.openTargets.map((target) => [target.hubSlotKey, target]));
        for (const slotKey of decision.visitOrder) {
          const target = bySlot.get(slotKey);
          if (target === undefined || active.has(target.occurrenceId)) continue;
          active.add(target.occurrenceId);
          changed = true;
        }
        continue;
      }
      const sourceActive =
        decision.source.kind === 'occurrence'
          ? active.has(decision.source.occurrenceId)
          : activeHubDecisions.has(decision.source.decisionKey);
      if (!sourceActive) continue;
      const continuation = selectedExitContinuation(
        decision,
        additionalExitsForDecision(topology, decision),
      );
      const occurrenceId =
        continuation?.kind === 'normal'
          ? continuation.target.occurrenceId
          : continuation?.kind === 'additional'
            ? continuation.exit.occurrenceId
            : undefined;
      if (occurrenceId !== undefined && !active.has(occurrenceId)) {
        active.add(occurrenceId);
        changed = true;
      }
    }
  }
  return active;
}

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
  if (action.window.kind !== 'fields') {
    return roomLifecycleWindowOrdinal(domain.lifecycleStructure, action.window) * 100;
  }
  const phaseOrder = fieldsPhaseOrder(catalog, domain, order);
  if (reference.kind === 'interactEncounter' || reference.kind === 'interactGorgon') {
    const ordinal = phaseOrder.indexOf(reference.phaseKey);
    return ordinal < 0 ? 100 : 2100 + ordinal * 200;
  }
  if (reference.kind === 'completeFieldsCage') {
    const ordinal = phaseOrder.indexOf(reference.phaseKey);
    return 2000 + Math.max(0, ordinal) * 200;
  }
  if (reference.kind === 'interactLocalReward' && reference.groupKey === 'cages') return 9000;
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

/** Add the exact required cohort at deterministic latest lifecycle positions. */
export function scheduleRequiredRoomActions(options: {
  readonly catalog: Catalog;
  readonly domain: RoomActionDomain;
  readonly order: readonly RoomActionReference[];
  readonly requiredKeys: ReadonlySet<string>;
}): readonly RoomActionReference[] {
  const authoredKeys = new Set(options.order.map(roomActionKey));
  const activeActions = options.domain.contributions.filter(
    (entry): entry is RoomActionContribution => entry.kind === 'action',
  );
  const byKey = new Map(activeActions.map((action) => [roomActionKey(action.reference), action]));
  const cohort = activeActions.filter(
    (action) =>
      action.participation === 'required' &&
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
        score(options.catalog, options.domain, result, retained) > actionScore
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

function activeDomains(
  document: ProjectDocument,
  catalog: Catalog,
  biomeKeys: ReadonlySet<string>,
): ReadonlyMap<string, RoomActionDomain> {
  const result = new Map<string, RoomActionDomain>();
  for (const route of document.routes) {
    for (const plan of route.biomes) {
      if (!biomeKeys.has(JSON.stringify([route.routeKey, plan.biomeKey]))) continue;
      if (plan.topology === null) continue;
      const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
      const active = structurallyActiveOccurrenceIds(plan.topology);
      for (const occurrence of plan.topology.occurrences) {
        if (!active.has(occurrence.occurrenceId)) continue;
        result.set(
          JSON.stringify([route.routeKey, plan.biomeKey, occurrence.occurrenceId]),
          assembleRoomActionDomain({
            catalog,
            biome,
            occurrence,
            ...roomActionDomainContext(catalog, plan, plan.topology, occurrence),
          }),
        );
      }
    }
  }
  return result;
}

function changedBiomeKeys(before: ProjectDocument, proposed: ProjectDocument): ReadonlySet<string> {
  const beforePlans = new Map(
    before.routes.flatMap((route) =>
      route.biomes.map((plan) => [JSON.stringify([route.routeKey, plan.biomeKey]), plan] as const),
    ),
  );
  const afterPlans = new Map(
    proposed.routes.flatMap((route) =>
      route.biomes.map((plan) => [JSON.stringify([route.routeKey, plan.biomeKey]), plan] as const),
    ),
  );
  return new Set(
    [...new Set([...beforePlans.keys(), ...afterPlans.keys()])].filter(
      (key) => beforePlans.get(key) !== afterPlans.get(key),
    ),
  );
}

function roomActionDomainContext(
  catalog: Catalog,
  plan: AuthoredBiomePlan,
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
): { readonly lifecycleProfileKey: string; readonly activeEncounterSlotKeys?: readonly string[] } {
  const declaration = catalog.rooms.byKey[occurrence.gameName];
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (declaration === undefined || layout === undefined) {
    throw new Error(`missing Room Action declaration context for ${occurrence.gameName}`);
  }
  const isLocalVisit = topology.decisions.some(
    (decision) =>
      decision.kind === 'localVisit' &&
      Object.values(decision.targetsBySlot).some(
        (target) => target.occurrenceId === occurrence.occurrenceId,
      ),
  );
  const role = isLocalVisit ? 'ephyraSide' : 'ordinary';
  const lifecycleProfileKey = authoredRoomLifecycleProfileKey(declaration, occurrence, role);
  if (declaration.mode.kind !== 'authored' || declaration.mode.templateKey !== 'FieldsCombat') {
    return frozen({ lifecycleProfileKey });
  }
  const decision = topology.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      candidate.normal.targets.some((target) => target.occurrenceId === occurrence.occurrenceId),
  );
  if (decision?.kind !== 'exit') return frozen({ lifecycleProfileKey });
  const activeCageCount = fieldsDefaultActiveCageCount({
    catalog,
    layout,
    topology,
    decision,
    room: declaration,
    replacingOccurrenceId: occurrence.occurrenceId,
  });
  if (activeCageCount === undefined) return frozen({ lifecycleProfileKey });
  const slots = encounterEnvelopeSlots(catalog, declaration, occurrence.gameName);
  const passive = slots.filter((phase) => phase.rewardAttachment?.kind !== 'localReward');
  const cages = slots.filter((phase) => phase.rewardAttachment?.kind === 'localReward');
  return frozen({
    lifecycleProfileKey,
    activeEncounterSlotKeys: frozen([
      ...passive.map((phase) => phase.key),
      ...cages.slice(0, activeCageCount).map((phase) => phase.key),
    ]),
  });
}

/** Close only the required-action delta activated by one semantic command. */
export function reconcileNewRequiredRoomActions(
  before: ProjectDocument,
  proposed: ProjectDocument,
  catalog: Catalog,
): ProjectDocument {
  const changedBiomes = changedBiomeKeys(before, proposed);
  if (changedBiomes.size === 0) return proposed;
  const beforeDomains = activeDomains(before, catalog, changedBiomes);
  const afterDomains = activeDomains(proposed, catalog, changedBiomes);
  const replacements = new Map<string, readonly RoomActionReference[]>();
  for (const [ownerKey, domain] of afterDomains) {
    const beforeRequired = new Set(
      (beforeDomains.get(ownerKey)?.contributions ?? []).flatMap((entry) =>
        entry.kind === 'action' && entry.participation === 'required'
          ? [roomActionKey(entry.reference)]
          : [],
      ),
    );
    const newlyRequired = new Set(
      domain.contributions.flatMap((entry) =>
        entry.kind === 'action' &&
        entry.participation === 'required' &&
        !beforeRequired.has(roomActionKey(entry.reference))
          ? [roomActionKey(entry.reference)]
          : [],
      ),
    );
    if (newlyRequired.size === 0) continue;
    const [routeKey, biomeKey, occurrenceId] = JSON.parse(ownerKey) as [string, string, string];
    const occurrence = proposed.routes
      .find((route) => route.routeKey === routeKey)
      ?.biomes.find((plan) => plan.biomeKey === biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    if (occurrence === undefined)
      throw new Error(`active Room Action owner ${ownerKey} disappeared`);
    const order = scheduleRequiredRoomActions({
      catalog,
      domain,
      order: occurrence.roomActions.order,
      requiredKeys: newlyRequired,
    });
    if (order !== occurrence.roomActions.order) replacements.set(ownerKey, order);
  }
  if (replacements.size === 0) return proposed;
  return frozen({
    ...proposed,
    routes: frozen(
      proposed.routes.map((route) =>
        frozen({
          ...route,
          biomes: frozen(
            route.biomes.map((plan): AuthoredBiomePlan => {
              if (plan.topology === null) return plan;
              const occurrences = plan.topology.occurrences.map((occurrence): RoomOccurrence => {
                const key = JSON.stringify([
                  route.routeKey,
                  plan.biomeKey,
                  occurrence.occurrenceId,
                ]);
                const order = replacements.get(key);
                return order === undefined
                  ? occurrence
                  : frozen({ ...occurrence, roomActions: frozen({ order }) });
              });
              return frozen({
                ...plan,
                topology: frozen({ ...plan.topology, occurrences: frozen(occurrences) }),
              });
            }),
          ),
        }),
      ),
    ),
  });
}

export function roomActionDomainForOccurrence(
  document: ProjectDocument,
  catalog: Catalog,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): { readonly occurrence: RoomOccurrence; readonly domain: RoomActionDomain } | undefined {
  const plan = document.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  const occurrence = plan?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  return occurrence === undefined
    ? undefined
    : frozen({
        occurrence,
        domain: assembleRoomActionDomain({
          catalog,
          biome,
          occurrence,
          ...(plan?.topology === null || plan?.topology === undefined
            ? {}
            : roomActionDomainContext(catalog, plan, plan.topology, occurrence)),
        }),
      });
}
