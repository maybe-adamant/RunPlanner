import type { Catalog, ResourceFamily, TraitElement } from '../catalog-schema';
import { createBiomeAddress, semanticAddressKey } from '../authored-project/addresses';
import type { AuthoredRoutePlan, ResourcePlacement } from '../authored-project/model';
import { composeBiomeHistoryPrefix } from './history/compose';
import type { RoomHistoryOrigin } from './lifecycle/model';
import { materializeBiomePrefix } from './materialization';

const resourceKindByFamily = Object.freeze({
  Pickaxe: 'simple',
  Exorcism: 'complex',
  Shovel: 'simple',
  Fishing: 'complex',
} as const);

export interface ResourcePlacementLegality {
  readonly legal: boolean;
  readonly reasons: readonly string[];
}

export interface ResourceEnteredRoom {
  readonly biomeKey: string;
  readonly origin: RoomHistoryOrigin;
  readonly gameName: string;
}

export type ResourcePointDisposition = 'native' | 'suppress' | 'force';

/** Engine-owned route product for native resource points and element rolls. */
export interface ResourceExecutionPolicy {
  readonly occurrences: readonly {
    readonly occurrenceId: string;
    readonly pointDispositions: Readonly<Record<ResourceFamily, ResourcePointDisposition>>;
    readonly postExitElementCounts?: Readonly<Record<TraitElement, number>>;
  }[];
}

export interface RouteResourceAuthoring {
  readonly entered: readonly ResourceEnteredRoom[];
  readonly placements: Readonly<Record<ResourceFamily, ResourcePlacement | null>>;
  readonly assessmentByFamily: Readonly<
    Record<ResourceFamily, ResourcePlacementLegality | undefined>
  >;
  readonly legalTargetsByFamily: Readonly<Record<ResourceFamily, readonly ResourcePlacement[]>>;
}

/**
 * Context-invalid retained selections remain visible to authoring but never
 * become physical successful points in any simulation or candidate replay.
 */
export function effectiveRouteResourcePlacements(
  catalog: Catalog,
  route: AuthoredRoutePlan,
): Readonly<Record<ResourceFamily, ResourcePlacement | null>> {
  const authoring = routeResourceAuthoring(catalog, route);
  return Object.freeze(
    Object.fromEntries(
      (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => [
        family,
        authoring.assessmentByFamily[family]?.legal === true ? authoring.placements[family] : null,
      ]),
    ) as Record<ResourceFamily, ResourcePlacement | null>,
  );
}

/**
 * Materialization and history composition own selected chronology. This query
 * only projects their room-created sequence into resource candidate addresses.
 */
export function routeResourceAuthoring(
  catalog: Catalog,
  route: AuthoredRoutePlan,
): RouteResourceAuthoring {
  const entered: ResourceEnteredRoom[] = [];
  for (const biome of route.biomes) {
    const prefix = materializeBiomePrefix(
      catalog,
      createBiomeAddress(route.routeKey, biome.biomeKey),
      biome,
      route.loadout,
    );
    if (prefix?.entryRoom === undefined) break;
    const history = composeBiomeHistoryPrefix(catalog, prefix);
    if (history === null) break;
    const names = new Map<string, string>();
    for (const event of history.events) {
      if (event.kind === 'roomCreated') names.set(semanticAddressKey(event.origin), event.gameName);
    }
    for (const event of history.events) {
      if (event.kind !== 'roomEntered') continue;
      const gameName = names.get(semanticAddressKey(event.origin));
      if (gameName !== undefined)
        entered.push(Object.freeze({ biomeKey: biome.biomeKey, origin: event.origin, gameName }));
    }
    if (prefix.frontier !== undefined) break;
  }
  const legalTargetsByFamily = Object.fromEntries(
    (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => {
      const targets = entered.flatMap((entry) => {
        if (entry.origin.kind !== 'occurrence') return [];
        const room = catalog.rooms.byKey[entry.gameName];
        if (room?.resourcePointSupport.families.includes(family) !== true) return [];
        const placement = Object.freeze({
          biomeKey: entry.biomeKey,
          occurrenceId: entry.origin.occurrenceId,
        });
        const proposal = { ...route.resourcePlacements, [family]: placement };
        const globallyLegal = (
          Object.entries(proposal) as [ResourceFamily, ResourcePlacement | null][]
        ).every(
          ([selectedFamily, selectedPlacement]) =>
            selectedPlacement === null ||
            assessResourcePlacement(catalog, selectedFamily, selectedPlacement, entered, proposal)
              .legal,
        );
        return globallyLegal ? [placement] : [];
      });
      return [family, Object.freeze(targets)] as const;
    }),
  ) as RouteResourceAuthoring['legalTargetsByFamily'];
  const assessmentByFamily = Object.fromEntries(
    (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => {
      const placement = route.resourcePlacements[family];
      return [
        family,
        placement === null
          ? undefined
          : assessResourcePlacement(catalog, family, placement, entered, route.resourcePlacements),
      ] as const;
    }),
  ) as RouteResourceAuthoring['assessmentByFamily'];
  return Object.freeze({
    entered: Object.freeze(entered),
    placements: route.resourcePlacements,
    assessmentByFamily: Object.freeze(assessmentByFamily),
    legalTargetsByFamily: Object.freeze(legalTargetsByFamily),
  });
}

/** The caller supplies the actual entered order; topology storage order is never used as chronology. */
export function assessResourcePlacement(
  catalog: Catalog,
  family: ResourceFamily,
  placement: ResourcePlacement,
  entered: readonly ResourceEnteredRoom[],
  selected: Readonly<Record<ResourceFamily, ResourcePlacement | null>>,
): ResourcePlacementLegality {
  const index = entered.findIndex(
    (entry) =>
      entry.origin.kind === 'occurrence' &&
      entry.biomeKey === placement.biomeKey &&
      entry.origin.occurrenceId === placement.occurrenceId,
  );
  const target = index < 0 ? undefined : entered[index];
  const reasons: string[] = [];
  const room = target === undefined ? undefined : catalog.rooms.byKey[target.gameName];
  if (room === undefined || !room.resourcePointSupport.families.includes(family))
    reasons.push('host does not declare the resource family');
  const rule = room?.resourcePointSupport.rules[family];
  if (room === undefined || rule === undefined)
    return Object.freeze({
      legal: false,
      reasons: Object.freeze(['host resource rules unavailable']),
    });
  const targetCandidate: ResourceCandidate = {
    biomeKey: placement.biomeKey,
    occurrenceId: placement.occurrenceId,
    index,
    room,
  };
  for (const [otherFamily, other] of Object.entries(selected) as [
    ResourceFamily,
    ResourcePlacement | null,
  ][]) {
    if (
      other === null ||
      (otherFamily === family &&
        other.biomeKey === placement.biomeKey &&
        other.occurrenceId === placement.occurrenceId)
    )
      continue;
    const otherIndex = entered.findIndex(
      (entry) =>
        entry.origin.kind === 'occurrence' &&
        entry.biomeKey === other.biomeKey &&
        entry.origin.occurrenceId === other.occurrenceId,
    );
    if (otherIndex < 0 || index < 0) continue;
    const otherEntry = entered[otherIndex];
    const otherRoom =
      otherEntry === undefined ? undefined : catalog.rooms.byKey[otherEntry.gameName];
    if (otherEntry === undefined || otherRoom === undefined) continue;
    const otherCandidate: ResourceCandidate = {
      biomeKey: other.biomeKey,
      occurrenceId: other.occurrenceId,
      index: otherIndex,
      room: otherRoom,
    };
    for (const reason of [
      ...resourcePointConflictReasons(
        { family, candidate: targetCandidate },
        { family: otherFamily, candidate: otherCandidate },
      ),
      ...resourcePointConflictReasons(
        { family: otherFamily, candidate: otherCandidate },
        { family, candidate: targetCandidate },
      ),
    ]) {
      if (!reasons.includes(reason)) reasons.push(reason);
    }
  }
  return Object.freeze({ legal: reasons.length === 0, reasons: Object.freeze(reasons) });
}

const resourceFamilies = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
const traitElements = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;

type ResourceCandidate = {
  readonly biomeKey: string;
  readonly occurrenceId: string;
  readonly index: number;
  readonly room: NonNullable<Catalog['rooms']['byKey'][string]>;
};

interface ResourcePointReference {
  readonly family: ResourceFamily;
  readonly candidate: ResourceCandidate;
}

/** The narrow evaluation surface needed to publish the route resource product. */
interface ResourcePolicyEvaluation {
  readonly history: {
    readonly rooms: readonly { readonly origin: RoomHistoryOrigin }[];
  };
  readonly rewards: {
    readonly roomExitElementCounts: readonly {
      readonly origin: { readonly occurrenceId: string };
      readonly elementCounts: Readonly<Record<TraitElement, number>>;
    }[];
  };
}

function resourcePointConflictReasons(
  target: ResourcePointReference,
  candidate: ResourcePointReference,
): readonly string[] {
  const reasons: string[] = [];
  if (candidate.candidate.index < target.candidate.index) {
    const targetRule = target.candidate.room.resourcePointSupport.rules[target.family];
    if (targetRule !== undefined) {
      const distance = target.candidate.index - candidate.candidate.index;
      if (target.family === candidate.family && distance <= targetRule.sameFamilyLookback)
        reasons.push('same-family lookback');
      if (
        target.family !== candidate.family &&
        distance <= targetRule.crossFamilyLookback[candidate.family]
      )
        reasons.push('cross-family lookback');
      if (
        target.family === candidate.family &&
        candidate.candidate.biomeKey === target.candidate.biomeKey &&
        target.candidate.room.resourcePointSupport.ignoresBiomeLimit !== true
      )
        reasons.push('biome family cap');
    }
  }
  if (candidate.candidate.index === target.candidate.index && candidate.family !== target.family) {
    if (target.candidate.room.resourcePointSupport.capacity === 'allTools')
      reasons.push('all-tool room capacity');
    else if (resourceKindByFamily[candidate.family] === resourceKindByFamily[target.family])
      reasons.push('room simple/complex capacity');
  }
  return reasons;
}

function resourceCounts(
  counts: Readonly<Record<TraitElement, number>>,
): Readonly<Record<TraitElement, number>> {
  return Object.freeze(
    Object.fromEntries(traitElements.map((element) => [element, counts[element] ?? 0])) as Record<
      TraitElement,
      number
    >,
  );
}

/**
 * Derive the complete point/roll envelope after route chronology and reward
 * branches have been evaluated. This is the sole producer consumed by the
 * execution-plan assembler.
 */
export function deriveResourceExecutionPolicy(
  catalog: Catalog,
  evaluations: readonly ResourcePolicyEvaluation[],
  authoring: RouteResourceAuthoring,
): ResourceExecutionPolicy {
  const enteredOccurrenceIds = new Set(
    evaluations.flatMap((evaluation) =>
      evaluation.history.rooms.flatMap((view) =>
        view.origin.kind === 'occurrence' ? [view.origin.occurrenceId] : [],
      ),
    ),
  );
  const candidates: ResourceCandidate[] = authoring.entered.flatMap((entry, index) => {
    if (entry.origin.kind !== 'occurrence' || !enteredOccurrenceIds.has(entry.origin.occurrenceId))
      return [];
    const room = catalog.rooms.byKey[entry.gameName];
    return room === undefined
      ? []
      : [{ biomeKey: entry.biomeKey, occurrenceId: entry.origin.occurrenceId, index, room }];
  });
  const placements = Object.fromEntries(
    resourceFamilies.map((family) => [
      family,
      authoring.assessmentByFamily[family]?.legal === true ? authoring.placements[family] : null,
    ]),
  ) as Record<ResourceFamily, ResourcePlacement | null>;
  const targets = new Map<ResourceFamily, ResourceCandidate>();
  for (const family of resourceFamilies) {
    const placement = placements[family];
    if (placement === null) continue;
    const target = candidates.find(
      (candidate) =>
        candidate.biomeKey === placement.biomeKey &&
        candidate.occurrenceId === placement.occurrenceId,
    );
    if (target === undefined) continue;
    targets.set(family, target);
  }

  const pointDispositions = new Map<string, Record<ResourceFamily, ResourcePointDisposition>>();
  for (const candidate of candidates) {
    pointDispositions.set(
      candidate.occurrenceId,
      Object.fromEntries(resourceFamilies.map((family) => [family, 'native'])) as Record<
        ResourceFamily,
        ResourcePointDisposition
      >,
    );
  }
  const suppress = (
    family: ResourceFamily,
    candidate: ResourceCandidate,
    target: ResourceCandidate,
  ): void => {
    const points = pointDispositions.get(candidate.occurrenceId);
    if (points === undefined || !candidate.room.resourcePointSupport.families.includes(family))
      return;
    if (points[family] === 'force')
      throw new Error(`resource ${family} selected point conflicts with ${target.occurrenceId}`);
    points[family] = 'suppress';
  };
  for (const [targetFamily, target] of targets) {
    pointDispositions.get(target.occurrenceId)![targetFamily] = 'force';
    for (const candidate of candidates) {
      for (const family of resourceFamilies) {
        if (
          resourcePointConflictReasons(
            { family: targetFamily, candidate: target },
            { family, candidate },
          ).length > 0
        )
          suppress(family, candidate, target);
      }
    }
  }

  const postExitCounts = new Map<string, Readonly<Record<TraitElement, number>>>();
  for (const evaluation of evaluations)
    for (const checkpoint of evaluation.rewards.roomExitElementCounts)
      postExitCounts.set(checkpoint.origin.occurrenceId, resourceCounts(checkpoint.elementCounts));
  const terminalOccurrenceId = candidates.at(-1)?.occurrenceId;
  const occurrences = candidates.map((candidate) => {
    const postExitElementCounts =
      candidate.occurrenceId === terminalOccurrenceId
        ? undefined
        : postExitCounts.get(candidate.occurrenceId);
    if (candidate.occurrenceId !== terminalOccurrenceId && postExitElementCounts === undefined)
      throw new Error(`${candidate.room.gameName} lacks post-exit element counts`);
    return Object.freeze({
      occurrenceId: candidate.occurrenceId,
      pointDispositions: Object.freeze({ ...pointDispositions.get(candidate.occurrenceId)! }),
      ...(postExitElementCounts === undefined ? {} : { postExitElementCounts }),
    });
  });
  return Object.freeze({
    occurrences: Object.freeze(occurrences),
  });
}
