import type { Catalog } from '../catalog-schema';
import type {
  AuthoredBiomePlan,
  BiomeTopology,
  HubAction,
  HubDecision,
  LocalVisitDecision,
  NextRoomDecision,
  OccurrenceId,
} from '../authored-project/model';
import type { ResolvedRoutePosition } from '../authored-project/route-context';
import { isRouteCompletionRoom } from '../authored-project/completion-boss';
import {
  isExactTerminalTakeoverEnvelope,
  structurallyActiveOccurrenceIds,
} from '../authored-project/topology/query';

/**
 * How a plan end applies to its biome. A cut at the biome's terminal
 * completion room is the ordinary biome end; any other reached room ends the
 * biome at its Leave point, through the authored structure before it.
 */
export type BiomePlanEnd =
  | { readonly kind: 'terminal'; readonly occurrenceId: OccurrenceId }
  | {
      readonly kind: 'cut';
      readonly occurrenceId: OccurrenceId;
      /** The authored plan with the end room's exit selection and everything after it left out. */
      readonly plan: AuthoredBiomePlan;
    }
  | { readonly kind: 'unreached'; readonly occurrenceId: OccurrenceId };

const cutPlans = new WeakMap<AuthoredBiomePlan, Map<OccurrenceId, AuthoredBiomePlan>>();

export function resolveBiomePlanEnd(
  catalog: Catalog,
  routePosition: ResolvedRoutePosition,
  plan: AuthoredBiomePlan,
  occurrenceId: OccurrenceId,
): BiomePlanEnd {
  const topology = plan.topology;
  if (topology === null || !structurallyActiveOccurrenceIds(topology).has(occurrenceId))
    return Object.freeze({ kind: 'unreached', occurrenceId });
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (
    occurrence !== undefined &&
    isRouteCompletionRoom(catalog, routePosition, occurrence.gameName) &&
    !topology.fixedRoomLinks.some((link) => link.sourceOccurrenceId === occurrenceId)
  )
    return Object.freeze({ kind: 'terminal', occurrenceId });
  let byOccurrence = cutPlans.get(plan);
  if (byOccurrence === undefined) cutPlans.set(plan, (byOccurrence = new Map()));
  let cut = byOccurrence.get(occurrenceId);
  if (cut === undefined) {
    cut = Object.freeze({ ...plan, topology: topologyThroughEnd(topology, occurrenceId) });
    byOccurrence.set(occurrenceId, cut);
  }
  return Object.freeze({ kind: 'cut', occurrenceId, plan: cut });
}

/**
 * The rooms behind the end room's doors: its doors open and offer them, but
 * the plan ends before any is entered, so nothing inside them is assessed.
 */
export function roomsBehindEndDoors(
  topology: BiomeTopology,
  end: OccurrenceId,
): ReadonlySet<OccurrenceId> {
  const doors = topology.decisions.find(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === end,
  );
  const additional =
    topology.occurrences.find((occurrence) => occurrence.occurrenceId === end)?.additionalExits ??
    [];
  return new Set([
    ...(doors?.kind === 'exit' ? doors.normal.targets.map((target) => target.occurrenceId) : []),
    ...additional.map((exit) => exit.occurrenceId),
  ]);
}

/** Which authored structure of a biome lies inside its plan end and which lies past it. */
export interface PlanEndExtent {
  /** Rooms the selected plan enters through its end room, the end room included. */
  readonly entered: ReadonlySet<OccurrenceId>;
  /** Rooms the authored plan enters only after its end. */
  readonly enteredAfter: ReadonlySet<OccurrenceId>;
  /**
   * For a Hub whose stay the plan ends in (or whose entry room is the end), the
   * authored actions through the end; anything else at that Hub is past it.
   */
  readonly hubActionsThroughEnd: ReadonlyMap<string, readonly HubAction[]>;
  /** The Hub main room whose visit a side room belongs to, for every side-room slot. */
  readonly sideRoomSource: ReadonlyMap<OccurrenceId, OccurrenceId>;
}

const extents = new WeakMap<BiomeTopology, Map<OccurrenceId, PlanEndExtent>>();

export function planEndExtent(topology: BiomeTopology, end: OccurrenceId): PlanEndExtent {
  let byEnd = extents.get(topology);
  if (byEnd === undefined) extents.set(topology, (byEnd = new Map()));
  const known = byEnd.get(end);
  if (known !== undefined) return known;
  const through = topologyThroughEnd(topology, end);
  const entered = structurallyActiveOccurrenceIds(through);
  const enteredAfter = new Set(
    [...structurallyActiveOccurrenceIds(topology)].filter((id) => !entered.has(id)),
  );
  const localVisits = topology.decisions.filter(
    (decision): decision is LocalVisitDecision => decision.kind === 'localVisit',
  );
  const hubActionsThroughEnd = new Map(
    topology.decisions.flatMap((decision) => {
      if (decision.kind !== 'hub') return [];
      if (decision.source.occurrenceId === end)
        return [[decision.hubKey, Object.freeze([]) as readonly HubAction[]] as const];
      if (hubVisitEntering(decision, localVisits, end) === undefined) return [];
      const kept = through.decisions.find(
        (candidate) => candidate.kind === 'hub' && candidate.hubKey === decision.hubKey,
      );
      return kept?.kind === 'hub' ? [[decision.hubKey, kept.actions] as const] : [];
    }),
  );
  const sideRoomSource = new Map(
    topology.decisions.flatMap((decision) =>
      decision.kind === 'localVisit'
        ? Object.values(decision.targetsBySlot).map(
            (target) => [target.occurrenceId, decision.sourceOccurrenceId] as const,
          )
        : [],
    ),
  );
  const extent = Object.freeze({ entered, enteredAfter, hubActionsThroughEnd, sideRoomSource });
  byEnd.set(end, extent);
  return extent;
}

/** The Hub visit ordinal (1-based) whose stay enters the occurrence, if any. */
function hubVisitEntering(
  hub: HubDecision,
  localVisits: readonly LocalVisitDecision[],
  occurrenceId: OccurrenceId,
): number | undefined {
  const slotByOccurrence = new Map(
    hub.openTargets.map((target) => [target.occurrenceId, target.hubSlotKey]),
  );
  const parent =
    localVisits.find((visit) => visit.visitOrder.includes(occurrenceId))?.sourceOccurrenceId ??
    occurrenceId;
  const slotKey = slotByOccurrence.get(parent);
  if (slotKey === undefined) return undefined;
  let ordinal = 0;
  for (const action of hub.actions) {
    if (action.kind !== 'roomVisit') continue;
    ordinal += 1;
    if (action.hubSlotKey === slotKey) return ordinal;
  }
  return undefined;
}

/**
 * Leaves out what follows the end room's Leave point: its exit selection (its
 * doors still open, with their rewards and rerolls), the fixed link it opens
 * and, at its Hub, every action after its visit and the side rooms entered
 * after it. An end at a Hub main room ends that whole visit. Occurrences stay;
 * only referenced ones are evaluated.
 */
function topologyThroughEnd(topology: BiomeTopology, end: OccurrenceId): BiomeTopology {
  const localVisits = topology.decisions.filter(
    (decision): decision is LocalVisitDecision => decision.kind === 'localVisit',
  );
  // A cut inside a Hub stay also leaves out the completed-Hub exit.
  const cutHubKeys = new Set(
    topology.decisions.flatMap((decision) =>
      decision.kind === 'hub' && hubVisitEntering(decision, localVisits, end) !== undefined
        ? [decision.hubKey]
        : [],
    ),
  );
  const decisions = topology.decisions.flatMap((decision): NextRoomDecision[] => {
    switch (decision.kind) {
      case 'exit':
        if (decision.source.kind === 'hubDecision')
          return cutHubKeys.has(decision.source.decisionKey) ? [] : [decision];
        if (decision.source.occurrenceId !== end) return [decision];
        // An authored door batch opens without a selection; a Hub's empty
        // takeover envelope, or a room whose Hub follows it, opens none.
        return isExactTerminalTakeoverEnvelope(decision) ||
          topology.decisions.some(
            (candidate) => candidate.kind === 'hub' && candidate.source.occurrenceId === end,
          )
          ? []
          : [Object.freeze({ ...decision, selection: Object.freeze({ kind: 'unresolved' }) })];
      case 'hub': {
        if (decision.source.occurrenceId === end) return [];
        const visit = hubVisitEntering(decision, localVisits, end);
        if (visit === undefined) return [decision];
        let ordinal = 0;
        const through = decision.actions.findIndex(
          (action) => action.kind === 'roomVisit' && (ordinal += 1) === visit,
        );
        return [
          Object.freeze({
            ...decision,
            actions: Object.freeze(decision.actions.slice(0, through + 1)),
          }),
        ];
      }
      case 'localVisit': {
        // A main room's end is the end of its visit, side rooms included.
        const at = decision.visitOrder.indexOf(end);
        if (at < 0) return [decision];
        return [
          Object.freeze({
            ...decision,
            visitOrder: Object.freeze(decision.visitOrder.slice(0, at + 1)),
          }),
        ];
      }
    }
  });
  return Object.freeze({
    ...topology,
    decisions: Object.freeze(decisions),
    fixedRoomLinks: Object.freeze(
      topology.fixedRoomLinks.filter((link) => link.sourceOccurrenceId !== end),
    ),
  });
}
