import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createExitDecisionAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import { applyProjectCommand } from '../../authored-project/commands/dispatch';
import type {
  ExitDecision,
  FieldsCombatAction,
  ProjectDocument,
} from '../../authored-project/model';
import {
  additionalExitsForDecision,
  selectedExitContinuation,
} from '../../authored-project/topology/query';
import type { SemanticFinding } from '../model';
import {
  replayProjectBiomeFromEvaluatedPredecessor,
  type ProjectBiomeEvaluation,
  type ProjectEvaluation,
} from '../project';
import {
  coverageUnavailable,
  unavailableForBiome,
  type CandidateContextUnavailable,
} from './availability';
import { candidateAssessmentPrefix, candidateBiome, prefixAuthoredRooms } from './evaluated-biome';

export interface FieldsActionOrderCandidateQuery {
  readonly kind: 'fieldsActionOrder';
  readonly occurrence: OccurrenceAddress;
  readonly actionOrder: readonly FieldsCombatAction[];
}

export interface FieldsActionOrderCandidateSupport {
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedFieldsActionOrderCandidate {
  readonly kind: 'fieldsActionOrder';
  readonly result: FieldsActionOrderCandidateSupport;
}

export type FieldsActionOrderCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedFieldsActionOrderCandidate;

const actionFindingCodes = new Set([
  'fieldsActionMissing',
  'fieldsActionInactive',
  'fieldsActionDependency',
]);

function ownedActionFindings(
  findings: readonly SemanticFinding[],
  occurrence: OccurrenceAddress,
): readonly SemanticFinding[] {
  return Object.freeze(
    findings.filter(
      (finding) =>
        actionFindingCodes.has(finding.code) &&
        finding.origin.kind === 'fieldsAction' &&
        finding.origin.routeKey === occurrence.routeKey &&
        finding.origin.biomeKey === occurrence.biomeKey &&
        finding.origin.occurrenceId === occurrence.occurrenceId,
    ),
  );
}

function findingKey(finding: SemanticFinding): string {
  return `${finding.phase}:${finding.code}:${semanticAddressKey(finding.origin)}:${JSON.stringify(
    finding.evidence,
  )}`;
}

/**
 * Exact lifecycle reachability for this owner. A Fields chronology that is
 * itself the next incomplete target remains repairable, while every owner
 * beyond a semantic block remains unavailable.
 */
function fieldsActionOwnerReached(
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  occurrence: OccurrenceAddress,
): boolean {
  const biome = candidateBiome(evaluation, occurrence.routeKey, occurrence.biomeKey);
  if (biome === undefined) return false;
  if (biome.coverage.kind === 'complete') return true;
  const prefix = candidateAssessmentPrefix(biome);
  if (
    prefix !== undefined &&
    prefixAuthoredRooms(prefix).some(
      (room) =>
        room.origin.kind === 'occurrence' && room.origin.occurrenceId === occurrence.occurrenceId,
    )
  ) {
    return true;
  }
  if (biome.coverage.kind === 'prefix' && biome.coverage.blockedAt !== undefined) return false;
  const frontier = prefix?.frontier;
  if (frontier?.kind !== 'exitDecision') return false;
  const plan = project.routes
    .find((route) => route.routeKey === occurrence.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === occurrence.biomeKey);
  const topology = plan?.topology;
  if (topology === null || topology === undefined) return false;
  const biomeAddress = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const decision = topology.decisions.find(
    (candidate): candidate is ExitDecision =>
      candidate.kind === 'exit' &&
      semanticAddressKey(createExitDecisionAddress(biomeAddress, candidate.source)) ===
        semanticAddressKey(frontier.origin),
  );
  if (decision === undefined) return false;
  const selected = selectedExitContinuation(
    decision,
    additionalExitsForDecision(topology, decision),
  );
  return (
    selected?.kind === 'normal' &&
    selected.target.occurrenceId === occurrence.occurrenceId &&
    ownedActionFindings(evaluation.findings, occurrence).length > 0
  );
}

/** Replay only the affected biome from its already evaluated predecessor. */
function replayFieldsActionBiome(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: FieldsActionOrderCandidateQuery,
): ProjectBiomeEvaluation {
  const candidateProject = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFieldsActionOrder',
    occurrence: query.occurrence,
    actionOrder: query.actionOrder,
  });
  return replayProjectBiomeFromEvaluatedPredecessor(
    catalog,
    candidateProject,
    evaluation,
    createBiomeAddress(query.occurrence.routeKey, query.occurrence.biomeKey),
  );
}

/**
 * Evaluate one owner-covered transition through an exact affected-biome replay.
 * An incomplete chronology may still take a strict one-edit repair step.
 */
export function evaluateFieldsActionOrderCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: FieldsActionOrderCandidateQuery,
  observeReplay?: (owner: OccurrenceAddress) => void,
): FieldsActionOrderCandidateEvaluation {
  if (
    candidateBiome(evaluation, query.occurrence.routeKey, query.occurrence.biomeKey) === undefined
  ) {
    return unavailableForBiome(
      evaluation,
      query.occurrence.routeKey,
      query.occurrence.biomeKey,
      query.occurrence,
      'afterRoomLifecycle',
    );
  }
  if (!fieldsActionOwnerReached(project, evaluation, query.occurrence)) {
    return coverageUnavailable(evaluation, query.occurrence, 'afterRoomLifecycle');
  }
  observeReplay?.(query.occurrence);
  const candidateEvaluation = replayFieldsActionBiome(catalog, project, evaluation, query);
  const selectedActionFindings = ownedActionFindings(evaluation.findings, query.occurrence);
  const candidateActionFindings = ownedActionFindings(
    candidateEvaluation.findings,
    query.occurrence,
  );
  const selectedFindingKeys = new Set(evaluation.findings.map(findingKey));
  const newlyIntroduced = candidateEvaluation.findings.filter(
    (finding) => !selectedFindingKeys.has(findingKey(finding)),
  );
  return Object.freeze({
    kind: 'fieldsActionOrder',
    result: Object.freeze({
      findings: Object.freeze(newlyIntroduced),
      selectedPossible:
        candidateActionFindings.length < selectedActionFindings.length ||
        newlyIntroduced.length === 0,
    }),
  });
}
