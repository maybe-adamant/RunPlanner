import type { Catalog } from '../../catalog-schema';
import { semanticAddressKey, type ExitDecisionAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import { fieldsCageOutcomeCandidateSupport } from '../generation';
import type { SemanticFinding } from '../model';
import type { ProjectEvaluation } from '../project';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';
import { candidateBiome, candidatePrefix, planFor, prefixAuthoredRooms } from './evaluated-biome';

export interface FieldsCageOutcomeCandidateQuery {
  readonly kind: 'fieldsCageOutcome';
  readonly decision: ExitDecisionAddress;
  readonly cageOutcome: 'min' | 'max';
}

export interface FieldsCageOutcomeCandidateSupport {
  readonly cageOutcome: 'min' | 'max';
  readonly supportOutcomes: readonly ('min' | 'max')[];
  readonly selectedPossible: boolean;
  readonly findings: readonly SemanticFinding[];
}

export interface EvaluatedFieldsCageOutcomeCandidate {
  readonly kind: 'fieldsCageOutcome';
  readonly result: FieldsCageOutcomeCandidateSupport;
}

export type FieldsCageOutcomeCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedFieldsCageOutcomeCandidate;

function fieldsOutcomeSupport(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: FieldsCageOutcomeCandidateQuery,
) {
  const biome = candidateBiome(
    catalog,
    project,
    evaluation,
    query.decision.routeKey,
    query.decision.biomeKey,
  );
  const selected = biome?.roomGeneration.ordinary.fieldsCageOutcomes.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(query.decision),
  );
  if (selected !== undefined) return selected;
  const prefix = candidatePrefix(biome);
  if (prefix?.materializedPrefix.frontier?.kind !== 'exitDecision') return undefined;
  if (
    semanticAddressKey(prefix.materializedPrefix.frontier.origin) !==
    semanticAddressKey(query.decision)
  ) {
    return undefined;
  }
  const parent = prefix.materializedPrefix.frontier.parent;
  if (parent.origin.kind !== 'occurrence') return undefined;
  const room = prefixAuthoredRooms(prefix.materializedPrefix).find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(parent.origin),
  );
  const history =
    room === undefined
      ? undefined
      : prefix.history.rooms.find(
          (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
        )?.preOutgoing;
  const layout =
    catalog.biomeLayouts.byKey[
      planFor(project, query.decision.routeKey, query.decision.biomeKey).biomeKey
    ];
  if (
    room === undefined ||
    history === undefined ||
    layout?.progression.kind !== 'generated' ||
    layout.progression.batchPolicy.kind !== 'fields'
  ) {
    return undefined;
  }
  return fieldsCageOutcomeCandidateSupport(layout.progression.batchPolicy, query.decision, history);
}

export function evaluateFieldsCageOutcomeCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: FieldsCageOutcomeCandidateQuery,
): FieldsCageOutcomeCandidateEvaluation {
  const support = fieldsOutcomeSupport(catalog, project, evaluation, query);
  if (support === undefined) {
    return unavailableForBiome(
      evaluation,
      query.decision.routeKey,
      query.decision.biomeKey,
      query.decision,
      'afterTargetGeneration',
    );
  }
  const selectedPossible = support.supportOutcomes.includes(query.cageOutcome);
  const findings = selectedPossible
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({
          code: 'fieldsCageOutcomeUnavailable' as const,
          severity: 'error' as const,
          phase: 'roomGeneration' as const,
          origin: query.decision,
          evidence: Object.freeze({
            beforeSequence: support.beforeSequence,
            biomeDepthCache: support.biomeDepthCache,
            fieldsMaxDoorsRolled: support.fieldsMaxDoorsRolled,
            maxDoorCageCeiling: support.maxDoorCageCeiling,
            selectedOutcome: query.cageOutcome,
            supportOutcomes: support.supportOutcomes,
          }),
        }),
      ]);
  return Object.freeze({
    kind: 'fieldsCageOutcome',
    result: Object.freeze({
      cageOutcome: query.cageOutcome,
      supportOutcomes: support.supportOutcomes,
      selectedPossible,
      findings,
    }),
  });
}
