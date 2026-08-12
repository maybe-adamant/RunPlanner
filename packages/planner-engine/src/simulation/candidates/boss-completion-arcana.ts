import type { Catalog } from '../../catalog-schema';
import type { BossCompletionArcanaAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { BossCompletionArcanaCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../project';
import type { SemanticFinding } from '../model';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface BossCompletionArcanaCandidateQuery {
  readonly kind: 'bossCompletionArcana';
  readonly completion: BossCompletionArcanaAddress;
  readonly arcanaKeys: readonly string[];
}
export interface EvaluatedBossCompletionArcanaCandidate {
  readonly kind: 'bossCompletionArcana';
  readonly result: {
    readonly requiredCount: number;
    readonly inactiveArcanaKeys: readonly string[];
    readonly selectedPossible: boolean;
    readonly findings: readonly SemanticFinding[];
  };
}
export function evaluateBossCompletionArcanaCandidate(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: BossCompletionArcanaCandidateArtifacts | undefined,
  query: BossCompletionArcanaCandidateQuery,
): CandidateContextUnavailable | EvaluatedBossCompletionArcanaCandidate {
  const capability = artifacts?.at(query.completion);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.completion.routeKey,
      query.completion.biomeKey,
      query.completion,
      'afterRoomLifecycle',
    );
  const seen = new Set<string>();
  const findings: SemanticFinding[] = [];
  const finding = (code: SemanticFinding['code'], evidence: Record<string, string | number>) =>
    Object.freeze({
      code,
      severity: 'error' as const,
      phase: 'rewardGeneration' as const,
      origin: query.completion,
      evidence: Object.freeze(evidence),
    });
  for (const key of query.arcanaKeys) {
    if (catalog.arcanaCards.byKey[key] === undefined)
      findings.push(finding('judgmentOutcomeTargetUnavailable', { key, reason: 'unknown' }));
    else if (seen.has(key))
      findings.push(finding('judgmentOutcomeTargetUnavailable', { key, reason: 'duplicate' }));
    else if (!capability.inactiveArcanaKeys.includes(key))
      findings.push(finding('judgmentOutcomeTargetUnavailable', { key, reason: 'unavailable' }));
    seen.add(key);
  }
  if (query.arcanaKeys.length !== capability.requiredCount)
    findings.push(
      finding('judgmentOutcomeWrongCardinality', {
        required: capability.requiredCount,
        selected: query.arcanaKeys.length,
      }),
    );
  return Object.freeze({
    kind: 'bossCompletionArcana',
    result: Object.freeze({
      requiredCount: capability.requiredCount,
      inactiveArcanaKeys: capability.inactiveArcanaKeys,
      selectedPossible: findings.length === 0,
      findings: Object.freeze(findings),
    }),
  });
}
