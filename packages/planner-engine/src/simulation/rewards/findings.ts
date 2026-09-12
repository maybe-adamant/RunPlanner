import { semanticAddressKey } from '../../authored-project/addresses';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { FindingEvidence, RewardGenerationFindingCode, SemanticFinding } from '../model';
import {
  findingIdentityKey,
  findingRegion,
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../finding-regions';
import type { ReachedLevelResolutionEvaluation } from '../traits';

export function rewardFinding(
  code: RewardGenerationFindingCode,
  origin: SemanticFinding['origin'],
  evidence: FindingEvidence,
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze(evidence),
  });
}

function findingKey(value: SemanticFinding): string {
  return findingIdentityKey(value);
}

export function addRewardFinding(
  findings: Map<string, FindingRegionEntry>,
  value: SemanticFinding,
  atomicRegion = ownerRegion(value.origin),
  chronology?: FindingChronology,
  levelResolutionEvaluation?: ReachedLevelResolutionEvaluation,
): void {
  const key = findingKey(value);
  const existing = findings.get(key);
  const region = findingRegion(value, atomicRegion, chronology, 'reward');
  const evaluations = [
    ...(existing?.levelResolutionEvaluations ?? []),
    ...(levelResolutionEvaluation === undefined ? [] : [levelResolutionEvaluation]),
  ].filter(
    (evaluation, index, all) =>
      all.findIndex(
        (candidate) =>
          semanticAddressKey(candidate.address) === semanticAddressKey(evaluation.address) &&
          JSON.stringify([
            candidate.before,
            candidate.value,
            candidate.effectKind,
            candidate.levelCount,
          ]) ===
            JSON.stringify([
              evaluation.before,
              evaluation.value,
              evaluation.effectKind,
              evaluation.levelCount,
            ]),
      ) === index,
  );
  findings.set(
    key,
    evaluations.length === 0
      ? region
      : Object.freeze({ ...region, levelResolutionEvaluations: Object.freeze(evaluations) }),
  );
}

/** Merges ordered reward finding emissions through the sole finding writer. */
export function mergeRewardFindingEmissions(
  findings: Map<string, FindingRegionEntry>,
  emissions: readonly FindingRegionEntry[],
): void {
  for (const emission of emissions) {
    if (emission.levelResolutionEvaluations === undefined) {
      addRewardFinding(findings, emission.finding, emission.atomicRegion, emission.chronology);
      continue;
    }
    for (const evaluation of emission.levelResolutionEvaluations) {
      addRewardFinding(
        findings,
        emission.finding,
        emission.atomicRegion,
        emission.chronology,
        evaluation,
      );
    }
  }
}

export function offerEvidence(offer: ResolvedRewardOffer): FindingEvidence {
  const payload = offer.payload;
  return {
    rewardType: offer.rewardType,
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { chosenSource: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  };
}

export function historyChronology(sequence: number): FindingChronology {
  return Object.freeze({ kind: 'history', sequence, boundary: 'at' });
}
