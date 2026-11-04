import type { Catalog } from '../catalog-schema';
import type {
  AuthoredBiomePlan,
  BiomeTopology,
  HubDecision,
  LocalVisitDecision,
  NextRoomDecision,
  OccurrenceId,
} from '../authored-project/model';
import type { ResolvedRoutePosition } from '../authored-project/route-context';
import { isRouteCompletionRoom } from '../authored-project/completion-boss';
import { structurallyActiveOccurrenceIds } from '../authored-project/topology/query';

/**
 * How a plan end applies to its biome. A cut at the biome's terminal
 * completion room is the ordinary biome end; any other reached room ends the
 * biome after its Timeline, through the authored structure before it.
 */
export type BiomePlanEnd =
  | { readonly kind: 'terminal'; readonly occurrenceId: OccurrenceId }
  | {
      readonly kind: 'cut';
      readonly occurrenceId: OccurrenceId;
      /** The authored plan with everything after the end room left out. */
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
 * Leaves out the end room's outgoing structure: its exit decision, the fixed
 * link it opens and, at its Hub, every action after its visit and the side
 * rooms entered after it. An end at a Hub main room ends that whole visit.
 * Occurrences stay; only referenced ones are evaluated.
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
        return (decision.source.kind === 'occurrence' && decision.source.occurrenceId === end) ||
          (decision.source.kind === 'hubDecision' && cutHubKeys.has(decision.source.decisionKey))
          ? []
          : [decision];
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
