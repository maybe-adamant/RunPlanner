import type { FigurineArcanaAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { FigurineArcanaCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../evaluation-products';
import type { SemanticFinding } from '../model';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface FigurineArcanaCandidateQuery {
  readonly kind: 'figurineArcana';
  readonly figurine: FigurineArcanaAddress;
  readonly arcanaKeys: readonly string[];
}
export interface EvaluatedFigurineArcanaCandidate {
  readonly kind: 'figurineArcana';
  readonly result: {
    readonly requiredCount: number;
    readonly inactiveArcanaKeys: readonly string[];
    readonly rarity: import('../../catalog-schema').TraitRarity;
    readonly selectedPossible: boolean;
    readonly findings: readonly SemanticFinding[];
  };
}

export function evaluateFigurineArcanaCandidate(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: FigurineArcanaCandidateArtifacts | undefined,
  query: FigurineArcanaCandidateQuery,
): CandidateContextUnavailable | EvaluatedFigurineArcanaCandidate {
  const capability = artifacts?.at(query.figurine);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.figurine.routeKey,
      query.figurine.biomeKey,
      query.figurine,
      'afterRoomLifecycle',
    );
  const seen = new Set<string>();
  const findings: SemanticFinding[] = [];
  const finding = (code: SemanticFinding['code'], evidence: Record<string, string | number>) =>
    Object.freeze({
      code,
      severity: 'error' as const,
      phase: 'rewardGeneration' as const,
      origin: query.figurine,
      evidence: Object.freeze(evidence),
    });
  for (const key of query.arcanaKeys) {
    if (catalog.arcanaCards.byKey[key] === undefined)
      findings.push(finding('figurineOutcomeTargetUnavailable', { key, reason: 'unknown' }));
    else if (seen.has(key))
      findings.push(finding('figurineOutcomeTargetUnavailable', { key, reason: 'duplicate' }));
    else if (!capability.inactiveArcanaKeys.includes(key))
      findings.push(finding('figurineOutcomeTargetUnavailable', { key, reason: 'unavailable' }));
    seen.add(key);
  }
  if (query.arcanaKeys.length !== capability.requiredCount)
    findings.push(
      finding('figurineOutcomeWrongCardinality', {
        required: capability.requiredCount,
        selected: query.arcanaKeys.length,
      }),
    );
  return Object.freeze({
    kind: 'figurineArcana',
    result: Object.freeze({
      requiredCount: capability.requiredCount,
      inactiveArcanaKeys: capability.inactiveArcanaKeys,
      rarity: capability.rarity,
      selectedPossible: findings.length === 0,
      findings: Object.freeze(findings),
    }),
  });
}
