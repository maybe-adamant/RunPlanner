import { semanticAddressKey } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type {
  BiomeFieldCandidateQuery,
  FieldsCageOutcomeCandidateQuery,
  ProjectCandidateEvaluation,
} from './model';

import {
  applyCandidateCommand,
  coverageNotReached,
  evaluateCandidateBiome,
  failCandidate,
  immutableQuery,
  isCandidateContextUnavailable,
  locateCandidateLinear,
  locateIndexedLinearPlan,
  unavailableCandidate,
  type PreparedCandidateContext,
} from './context';

export function evaluateBiomeFieldCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: BiomeFieldCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as BiomeFieldCandidateQuery;
  locateIndexedLinearPlan(context, stableQuery);
  const proposal = applyCandidateCommand(catalog, project, stableQuery, {
    kind: 'ReplaceBiomeField',
    field: stableQuery.field,
    value: stableQuery.value,
  });
  const biome = evaluateCandidateBiome(catalog, proposal, context, stableQuery);
  if (isCandidateContextUnavailable(biome)) {
    return unavailableCandidate(stableQuery, biome);
  }
  const findings = Object.freeze([...biome.roomGeneration.findings, ...biome.rewards.findings]);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateValue: stableQuery.value,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

export function evaluateFieldsCageOutcomeCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: FieldsCageOutcomeCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as FieldsCageOutcomeCandidateQuery;
  if (stableQuery.cageOutcome !== 'min' && stableQuery.cageOutcome !== 'max') {
    failCandidate(stableQuery, `unknown Fields cage outcome ${String(stableQuery.cageOutcome)}`);
  }
  const plan = locateIndexedLinearPlan(context, stableQuery);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  const continuation = plan.topology?.continuations.find(
    (candidate) =>
      candidate.kind === 'batch' &&
      candidate.parentOccurrenceId === stableQuery.continuation.parentOccurrenceId,
  );
  if (
    layout?.kind !== 'LinearBiome' ||
    layout.continuation.batchPolicy.kind !== 'fields' ||
    continuation?.kind !== 'batch'
  ) {
    failCandidate(stableQuery, 'semantic owner has no Fields cage outcome');
  }
  const biome = locateCandidateLinear(context, stableQuery);
  if (isCandidateContextUnavailable(biome)) {
    return unavailableCandidate(stableQuery, biome);
  }
  const exactKey = semanticAddressKey(stableQuery.continuation);
  const selected = context.index.fieldsCageOutcomesByOwner.get(exactKey);
  if (selected === undefined) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, biome));
  }
  const selectedPossible = selected.supportOutcomes.includes(stableQuery.cageOutcome);
  const findings = selectedPossible
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({
          code: 'fieldsCageOutcomeUnavailable' as const,
          severity: 'error' as const,
          phase: 'roomGeneration' as const,
          origin: stableQuery.continuation,
          evidence: Object.freeze({
            beforeSequence: selected.beforeSequence,
            biomeDepthCache: selected.biomeDepthCache,
            fieldsMaxDoorsRolled: selected.fieldsMaxDoorsRolled,
            maxDoorCageCeiling: selected.maxDoorCageCeiling,
            selectedOutcome: stableQuery.cageOutcome,
            supportOutcomes: selected.supportOutcomes,
          }),
        }),
      ]);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible
      ? selected.supportOutcomes.length === 1
        ? 'forced'
        : 'possible'
      : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateOutcome: stableQuery.cageOutcome,
      beforeSequence: selected.beforeSequence,
      biomeDepthCache: selected.biomeDepthCache,
      fieldsMaxDoorsRolled: selected.fieldsMaxDoorsRolled,
      maxDoorCageCeiling: selected.maxDoorCageCeiling,
      supportOutcomes: selected.supportOutcomes,
    }),
  });
}
