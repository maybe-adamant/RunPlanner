import type { OccurrenceAddress, SemanticAddress } from '../../authored-project/addresses';
import type { BiomeTopology, OccurrenceId } from '../../authored-project/model';
import {
  authoringBoundaryReadiness,
  compareAuthoringBoundaries,
  resolveAuthoringBoundary,
} from './authoring-boundary';
import type {
  ProjectBiomeEvaluation,
  ProjectEvaluationAssembly,
} from '../evaluation/evaluation-products';
import type { CanonicalBiome, MaterializedBiomePrefix } from '../materialization';
import { assertExactProjectEvaluationAssembly } from '../evaluation/project-evaluation-assembly';
import { planEndExtent, type PlanEndExtent } from '../plan-end';

export type AuthoringReadiness = 'editable' | 'locked';

function materialization(
  evaluation: ProjectBiomeEvaluation,
): CanonicalBiome | MaterializedBiomePrefix | undefined {
  return 'snapshot' in evaluation
    ? evaluation.snapshot
    : 'materializedPrefix' in evaluation
      ? evaluation.materializedPrefix
      : undefined;
}

/**
 * Answers one semantic edit against the exact project evaluation. The horizon
 * and owner use the same engine chronology; callers do not interpret region
 * keys or reconstruct route order.
 */
export function authoringReadinessAt(
  assembly: ProjectEvaluationAssembly,
  owner: SemanticAddress,
): AuthoringReadiness {
  assertExactProjectEvaluationAssembly(assembly);
  const horizon = assembly.evaluation.authoringHorizon;
  if (horizon.kind === 'open') return 'editable';

  if (owner.kind === 'project' || owner.kind === 'route') return 'editable';
  if (owner.kind === 'keepsakeSelection' && owner.owner === 'routeStart') return 'editable';
  if (!('biomeKey' in owner) || !('biomeKey' in horizon.blockedAfter)) return 'locked';
  if (owner.biomeKey === 'routeStart') return 'editable';

  const route = assembly.project.route;
  const horizonBiomeKey = horizon.blockedAfter.biomeKey;
  const ownerBiomeIndex = route.biomes.findIndex((biome) => biome.biomeKey === owner.biomeKey);
  const horizonBiomeIndex = route.biomes.findIndex((biome) => biome.biomeKey === horizonBiomeKey);
  if (ownerBiomeIndex !== horizonBiomeIndex) {
    return ownerBiomeIndex >= 0 && ownerBiomeIndex < horizonBiomeIndex ? 'editable' : 'locked';
  }
  if (owner.kind === 'biome' || owner.kind === 'biomeField') return 'editable';

  const evaluation = assembly.evaluation.route.biomes.find(
    (biome) => biome.biomeKey === owner.biomeKey,
  );
  const prefix = evaluation === undefined ? undefined : materialization(evaluation);
  if (prefix === undefined) return 'locked';
  if (horizon.kind === 'ended') {
    const topology = route.biomes[ownerBiomeIndex]?.topology;
    if (topology === null || topology === undefined) return 'locked';
    return endedReadiness(prefix, topology, owner, horizon.blockedAfter);
  }
  return authoringBoundaryReadiness(
    prefix,
    resolveAuthoringBoundary(prefix, owner),
    horizon.blockedAfter,
    evaluation?.requiredInputLocation,
  );
}

/** Whether the owner is a Hub visit, fountain use or reroll the plan reaches only after its end. */
function hubActionPastEnd(extent: PlanEndExtent, owner: SemanticAddress): boolean {
  const hubKey =
    owner.kind === 'hubVisit' || owner.kind === 'hubFountain' || owner.kind === 'hubReroll'
      ? owner.hubKey
      : owner.kind === 'fountainRarityOutcome' && owner.action.kind === 'hubFountain'
        ? owner.action.hubKey
        : undefined;
  const through = hubKey === undefined ? undefined : extent.hubActionsThroughEnd.get(hubKey);
  if (through === undefined) return false;
  switch (owner.kind) {
    case 'hubVisit':
      return owner.visitIndex > through.filter((action) => action.kind === 'roomVisit').length;
    case 'hubReroll':
      return !through.some(
        (action) => action.kind === 'reroll' && action.rerollId === owner.rerollId,
      );
    default:
      return !through.some((action) => action.kind === 'useFountain');
  }
}

/**
 * Inside an ended biome, everything the plan reaches through its end stays
 * editable: the end room, its peers at the decision that led to it and, at a
 * Hub main room, that whole visit with its side rooms. The end room's own exit,
 * the rooms and Hub actions after the end, and their offers are locked.
 */
function endedReadiness(
  prefix: CanonicalBiome | MaterializedBiomePrefix,
  topology: BiomeTopology,
  owner: SemanticAddress,
  end: OccurrenceAddress,
): AuthoringReadiness {
  const extent = planEndExtent(topology, end.occurrenceId);
  if (hubActionPastEnd(extent, owner)) return 'locked';
  // The end room's additional and hidden doors belong to its doors, past the end.
  if (
    (owner.kind === 'additionalExit' || owner.kind === 'phantomExit') &&
    owner.occurrenceId === end.occurrenceId
  )
    return 'locked';
  const boundary = resolveAuthoringBoundary(prefix, owner);
  if (boundary.kind === 'exitDecision') {
    // The plan's end room generates no doors: its own exit is past the end.
    if (boundary.source.kind === 'occurrence' && boundary.source.occurrenceId === end.occurrenceId)
      return 'locked';
  }
  if (boundary.kind === 'occurrence') {
    const room: OccurrenceId = boundary.occurrenceId;
    const visit = extent.sideRoomSource.get(room);
    if (extent.enteredAfter.has(room) || (visit !== undefined && extent.enteredAfter.has(visit)))
      return 'locked';
    if (extent.entered.has(room) || (visit !== undefined && extent.entered.has(visit)))
      return 'editable';
    // An unentered room offered beside the end room, or earlier, is inside the plan.
    const comparison = compareAuthoringBoundaries(prefix, boundary, end);
    return comparison !== undefined && comparison <= 0 ? 'editable' : 'locked';
  }
  return authoringBoundaryReadiness(prefix, boundary, end);
}
