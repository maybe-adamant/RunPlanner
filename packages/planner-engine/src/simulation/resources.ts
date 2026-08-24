import type { Catalog, ResourceFamily } from '../catalog-schema';
import { createBiomeAddress, semanticAddressKey } from '../authored-project/addresses';
import type { AuthoredRoutePlan, ResourcePlacement } from '../authored-project/model';
import { composeBiomeHistoryPrefix } from './history/compose';
import type { RoomHistoryOrigin } from './lifecycle/model';
import { materializeBiomePrefix } from './materialization';

const resourceKind = Object.freeze({
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
  if (rule === undefined)
    return Object.freeze({
      legal: false,
      reasons: Object.freeze(['host resource rules unavailable']),
    });
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
    if (
      otherFamily === family &&
      otherIndex < index &&
      index - otherIndex <= rule.sameFamilyLookback
    )
      reasons.push('same-family lookback');
    if (
      otherFamily !== family &&
      otherIndex < index &&
      index - otherIndex <= rule.crossFamilyLookback[otherFamily]
    )
      reasons.push('cross-family lookback');
    if (
      other.biomeKey === placement.biomeKey &&
      room?.resourcePointSupport.ignoresBiomeLimit !== true &&
      otherFamily === family
    )
      reasons.push('biome family cap');
    if (other.biomeKey === placement.biomeKey && other.occurrenceId === placement.occurrenceId) {
      if (room?.resourcePointSupport.capacity === 'allTools')
        reasons.push('all-tool room capacity');
      else if (resourceKind[otherFamily] === resourceKind[family])
        reasons.push('room simple/complex capacity');
    }
  }
  return Object.freeze({ legal: reasons.length === 0, reasons: Object.freeze(reasons) });
}
