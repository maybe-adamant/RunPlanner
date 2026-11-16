import type { NotHostRefusal, ResourcePlacementRefusal } from './room-feature-refusals';
import type { Catalog, ResourceFamily } from '../catalog-schema';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
} from '../authored-project/addresses';
import type { SemanticFinding } from './model';
import { findingRegion, ownerRegion, type FindingRegionEntry } from './finding-regions';
import type { HistoryEvent } from './history';
import type { AuthoredRoutePlan, OccurrenceId, ResourcePlacement } from '../authored-project/model';
import { resolveRoutePosition } from '../authored-project/route-context';
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
  readonly refusals: readonly ResourcePlacementRefusal[];
}

/** One RoomHistory entry: a room's entry or a restore of it. */
export interface ResourceRoomAppearance {
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
  }[];
}

export interface RouteResourceAuthoring {
  /** Exact saved route identity used for declaration-owned point availability. */
  readonly routeKey: string;
  /** The route's room appearances in RoomHistory order, Hub and restores included. */
  readonly appearances: readonly ResourceRoomAppearance[];
  readonly placements: Readonly<Record<ResourceFamily, ResourcePlacement | null>>;
  readonly assessmentByFamily: Readonly<
    Record<ResourceFamily, ResourcePlacementLegality | undefined>
  >;
  readonly legalTargetsByFamily: Readonly<Record<ResourceFamily, readonly ResourcePlacement[]>>;
  /**
   * Each entered host of a family it cannot take now, with every rule
   * refusing it. A room that never hosts the family is no target.
   */
  readonly refusedTargetsByFamily: Readonly<
    Record<
      ResourceFamily,
      readonly {
        readonly placement: ResourcePlacement;
        readonly refusals: readonly Exclude<ResourcePlacementRefusal, NotHostRefusal>[];
      }[]
    >
  >;
}

/** Route assessment retains each invalid selection's exact resource-feature repair owner. */
export function resourcePlacementFindings(
  routeKey: string,
  authoring: RouteResourceAuthoring,
): readonly SemanticFinding[] {
  return Object.freeze(
    (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).flatMap((family) => {
      const placement = authoring.placements[family];
      const assessment = authoring.assessmentByFamily[family];
      if (placement === null || assessment?.legal === true) return [];
      return [
        Object.freeze({
          code: 'resourcePlacementUnavailable' as const,
          phase: 'roomGeneration' as const,
          origin: createRoomFeatureAddress(
            createOccurrenceAddress(
              createBiomeAddress(routeKey, placement.biomeKey),
              placement.occurrenceId,
            ),
            { kind: 'resource', family },
          ),
          evidence: Object.freeze({ family, refusals: assessment?.refusals ?? [] }),
        }),
      ];
    }),
  );
}

/**
 * A picked host's placement is fixed on entry, so its legality belongs to the
 * room's Overview; an unpicked host has a structural repair at its door.
 */
export function resourcePlacementFindingRegions(
  event: Extract<HistoryEvent, { readonly kind: 'roomCreated' | 'roomEntered' }>,
  findings: readonly SemanticFinding[],
): readonly FindingRegionEntry[] {
  if (event.kind === 'roomCreated' && event.picked) return Object.freeze([]);
  return Object.freeze(
    findings
      .filter(
        (finding) =>
          finding.origin.kind === 'roomFeature' &&
          event.origin.kind === 'occurrence' &&
          finding.origin.biomeKey === event.origin.biomeKey &&
          finding.origin.occurrenceId === event.origin.occurrenceId,
      )
      .map((finding) =>
        findingRegion(
          finding,
          ownerRegion(finding.origin),
          // An unpicked host's placement is assessed as its door is created.
          { kind: 'history', sequence: event.sequence, boundary: 'at' },
        ),
      ),
  );
}

/**
 * Context-invalid retained selections remain visible to authoring but never
 * become physical successful points in any simulation or candidate replay.
 */
export function effectiveRouteResourcePlacements(
  authoring: RouteResourceAuthoring,
): Readonly<Record<ResourceFamily, ResourcePlacement | null>> {
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
 * only projects their room-appearance ledger into resource candidate addresses.
 */
export function routeResourceAuthoring(
  catalog: Catalog,
  route: AuthoredRoutePlan,
): RouteResourceAuthoring {
  const appearances: ResourceRoomAppearance[] = [];
  for (const biome of route.biomes) {
    const routePosition = resolveRoutePosition(catalog, route, biome.biomeKey);
    const prefix = materializeBiomePrefix(
      catalog,
      createBiomeAddress(route.routeKey, biome.biomeKey),
      routePosition,
      biome,
      route.loadout,
    );
    if (prefix?.entryRoom === undefined) break;
    const history = composeBiomeHistoryPrefix(catalog, prefix, routePosition);
    if (history === null) break;
    for (const { origin, gameName } of history.ledgers.roomAppearances)
      appearances.push(Object.freeze({ biomeKey: biome.biomeKey, origin, gameName }));
    if (prefix.frontier !== undefined) break;
  }
  const assessmentByFamily = Object.fromEntries(
    (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => {
      const placement = route.resourcePlacements[family];
      return [
        family,
        placement === null
          ? undefined
          : assessResourcePlacement(
              catalog,
              route.routeKey,
              family,
              placement,
              appearances,
              route.resourcePlacements,
            ),
      ] as const;
    }),
  ) as RouteResourceAuthoring['assessmentByFamily'];
  // Another family's invalid placement keeps its own finding and never locks
  // this family's targets; conflicts are pairwise, so the target's own
  // assessment against the legal placements covers both directions.
  const legalPlacements = Object.fromEntries(
    (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => [
      family,
      assessmentByFamily[family]?.legal === true ? route.resourcePlacements[family] : null,
    ]),
  ) as Record<ResourceFamily, ResourcePlacement | null>;
  const entered = enteredOccurrences(appearances);
  const assessedTargets = (family: ResourceFamily) =>
    entered.flatMap((entry): RouteResourceAuthoring['refusedTargetsByFamily'][ResourceFamily] => {
      const room = catalog.rooms.byKey[entry.gameName];
      if (
        room?.resourcePointSupport.families.includes(family) !== true ||
        room.resourcePointSupport.rules[family] === undefined
      )
        return [];
      const placement = Object.freeze({
        biomeKey: entry.biomeKey,
        occurrenceId: entry.occurrenceId,
      });
      const proposal = { ...legalPlacements, [family]: placement };
      const refusals = assessResourcePlacement(
        catalog,
        route.routeKey,
        family,
        placement,
        appearances,
        proposal,
      ).refusals.filter(
        (refusal): refusal is Exclude<ResourcePlacementRefusal, NotHostRefusal> =>
          refusal.reason !== 'notHost',
      );
      return [{ placement, refusals }];
    });
  const families = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
  const targetsByFamily = new Map(families.map((family) => [family, assessedTargets(family)]));
  const legalTargetsByFamily = Object.fromEntries(
    families.map((family) => [
      family,
      Object.freeze(
        targetsByFamily
          .get(family)!
          .flatMap(({ placement, refusals }) => (refusals.length === 0 ? [placement] : [])),
      ),
    ]),
  ) as RouteResourceAuthoring['legalTargetsByFamily'];
  const refusedTargetsByFamily = Object.fromEntries(
    families.map((family) => [
      family,
      Object.freeze(
        targetsByFamily
          .get(family)!
          .filter(({ refusals }) => refusals.length > 0)
          .map((target) => Object.freeze(target)),
      ),
    ]),
  ) as RouteResourceAuthoring['refusedTargetsByFamily'];
  return Object.freeze({
    routeKey: route.routeKey,
    appearances: Object.freeze(appearances),
    placements: route.resourcePlacements,
    assessmentByFamily: Object.freeze(assessmentByFamily),
    legalTargetsByFamily: Object.freeze(legalTargetsByFamily),
    refusedTargetsByFamily: Object.freeze(refusedTargetsByFamily),
  });
}

/** The caller supplies the actual appearance order; topology storage order is never used as chronology. */
export function assessResourcePlacement(
  catalog: Catalog,
  routeKey: string,
  family: ResourceFamily,
  placement: ResourcePlacement,
  appearances: readonly ResourceRoomAppearance[],
  selected: Readonly<Record<ResourceFamily, ResourcePlacement | null>>,
): ResourcePlacementLegality {
  const indices = appearanceIndices(appearances, placement);
  const target = indices.length === 0 ? undefined : appearances[indices[0]!];
  const refusals: ResourcePlacementRefusal[] = [];
  const refuse = (refusal: ResourcePlacementRefusal) => {
    const key = JSON.stringify(refusal);
    if (!refusals.some((existing) => JSON.stringify(existing) === key))
      refusals.push(Object.freeze(refusal));
  };
  const room = target === undefined ? undefined : catalog.rooms.byKey[target.gameName];
  const rule = room?.resourcePointSupport.rules[family];
  if (
    room === undefined ||
    !room.resourcePointSupport.families.includes(family) ||
    rule === undefined
  )
    return Object.freeze({
      legal: false,
      refusals: Object.freeze([Object.freeze({ reason: 'notHost' as const })]),
    });
  if (room.resourcePointSupport.excludedRouteKeys?.includes(routeKey) === true)
    refuse({ reason: 'routeExcluded' });
  const targetCandidate: ResourceCandidate = {
    biomeKey: placement.biomeKey,
    occurrenceId: placement.occurrenceId,
    appearances: indices,
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
    const otherIndices = appearanceIndices(appearances, other);
    const otherEntry = otherIndices.length === 0 ? undefined : appearances[otherIndices[0]!];
    const otherRoom =
      otherEntry === undefined ? undefined : catalog.rooms.byKey[otherEntry.gameName];
    if (otherRoom === undefined) continue;
    const otherCandidate: ResourceCandidate = {
      biomeKey: other.biomeKey,
      occurrenceId: other.occurrenceId,
      appearances: otherIndices,
      room: otherRoom,
    };
    for (const refusal of [
      ...resourcePointConflicts(
        { family, candidate: targetCandidate },
        { family: otherFamily, candidate: otherCandidate },
      ),
      // The other spot's own rule: this host lies before it, within its lookback.
      ...resourcePointConflicts(
        { family: otherFamily, candidate: otherCandidate },
        { family, candidate: targetCandidate },
      ).map((refusal) =>
        refusal.reason === 'resourceLookback' ? { ...refusal, order: 'after' as const } : refusal,
      ),
    ])
      refuse({ ...refusal, ...('family' in refusal ? { family: otherFamily } : {}) });
  }
  return Object.freeze({ legal: refusals.length === 0, refusals: Object.freeze(refusals) });
}

const resourceFamilies = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
type ResourceCandidate = {
  readonly biomeKey: string;
  readonly occurrenceId: string;
  /** Ascending appearance indices; the first is the room's entry, where its points spawn. */
  readonly appearances: readonly number[];
  readonly room: NonNullable<Catalog['rooms']['byKey'][string]>;
};

function appearanceIndices(
  appearances: readonly ResourceRoomAppearance[],
  placement: ResourcePlacement,
): readonly number[] {
  return appearances.flatMap((appearance, index) =>
    appearance.origin.kind === 'occurrence' &&
    appearance.biomeKey === placement.biomeKey &&
    appearance.origin.occurrenceId === placement.occurrenceId
      ? [index]
      : [],
  );
}

/** Each entered occurrence once, in entry order, with every appearance of it. */
function enteredOccurrences(appearances: readonly ResourceRoomAppearance[]): readonly {
  readonly biomeKey: string;
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly appearances: readonly number[];
}[] {
  const byKey = new Map<
    string,
    { biomeKey: string; occurrenceId: OccurrenceId; gameName: string; appearances: number[] }
  >();
  appearances.forEach((appearance, index) => {
    if (appearance.origin.kind !== 'occurrence') return;
    const key = semanticAddressKey(appearance.origin);
    const known = byKey.get(key);
    if (known !== undefined) known.appearances.push(index);
    else
      byKey.set(key, {
        biomeKey: appearance.biomeKey,
        occurrenceId: appearance.origin.occurrenceId,
        gameName: appearance.gameName,
        appearances: [index],
      });
  });
  return [...byKey.values()];
}

interface ResourcePointReference {
  readonly family: ResourceFamily;
  readonly candidate: ResourceCandidate;
}

/** The narrow evaluation surface needed to publish the route resource product. */
interface ResourcePolicyEvaluation {
  readonly history: {
    readonly rooms: readonly { readonly origin: RoomHistoryOrigin }[];
  };
}

/**
 * The rules `target` breaks beside `candidate`, by the target host's rule.
 * Each family-bearing rule names the conflicting family; the caller sets it.
 */
function resourcePointConflicts(
  target: ResourcePointReference,
  candidate: ResourcePointReference,
): readonly ResourcePlacementRefusal[] {
  const refusals: ResourcePlacementRefusal[] = [];
  const targetEntry = target.candidate.appearances[0]!;
  const candidateEntry = candidate.candidate.appearances[0]!;
  if (candidateEntry < targetEntry) {
    const targetRule = target.candidate.room.resourcePointSupport.rules[target.family];
    if (targetRule !== undefined) {
      // CreateRoom rolls the point in the room left before entry (restores re-create doors,
      // RoomLogic.lua:1577): SumPrevRooms = n reads the n appearances up to and including it.
      const distance =
        targetEntry - candidate.candidate.appearances.findLast((index) => index < targetEntry)!;
      if (target.family === candidate.family && distance <= targetRule.sameFamilyLookback)
        refusals.push({
          reason: 'resourceLookback',
          family: candidate.family,
          scope: 'sameFamily',
          order: 'before',
          rooms: targetRule.sameFamilyLookback,
        });
      if (
        target.family !== candidate.family &&
        distance <= targetRule.crossFamilyLookback[candidate.family]
      )
        refusals.push({
          reason: 'resourceLookback',
          family: candidate.family,
          scope: 'crossFamily',
          order: 'before',
          rooms: targetRule.crossFamilyLookback[candidate.family],
        });
      if (
        target.family === candidate.family &&
        candidate.candidate.biomeKey === target.candidate.biomeKey &&
        target.candidate.room.resourcePointSupport.ignoresBiomeLimit !== true
      )
        refusals.push({ reason: 'capReached', per: 'biome', count: 1, maximum: 1 });
    }
  }
  if (candidateEntry === targetEntry && candidate.family !== target.family) {
    if (target.candidate.room.resourcePointSupport.capacity === 'allTools')
      refusals.push({ reason: 'roomCapacity', family: candidate.family, capacity: 'allTools' });
    else if (resourceKindByFamily[candidate.family] === resourceKindByFamily[target.family])
      refusals.push({
        reason: 'roomCapacity',
        family: candidate.family,
        capacity: 'simpleComplex',
      });
  }
  return refusals;
}

/**
 * Derive the complete point/roll envelope after route chronology and reward
 * settlement have been evaluated. This is the sole producer consumed by the
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
  const candidates: ResourceCandidate[] = enteredOccurrences(authoring.appearances).flatMap(
    (entry) => {
      if (!enteredOccurrenceIds.has(entry.occurrenceId)) return [];
      const room = catalog.rooms.byKey[entry.gameName];
      return room === undefined ||
        room.resourcePointSupport.excludedRouteKeys?.includes(authoring.routeKey)
        ? []
        : [
            {
              biomeKey: entry.biomeKey,
              occurrenceId: entry.occurrenceId,
              appearances: entry.appearances,
              room,
            },
          ];
    },
  );
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
          resourcePointConflicts({ family: targetFamily, candidate: target }, { family, candidate })
            .length > 0
        )
          suppress(family, candidate, target);
      }
    }
  }

  const occurrences = candidates.map((candidate) => {
    return Object.freeze({
      occurrenceId: candidate.occurrenceId,
      pointDispositions: Object.freeze({ ...pointDispositions.get(candidate.occurrenceId)! }),
    });
  });
  return Object.freeze({
    occurrences: Object.freeze(occurrences),
  });
}
