import type { WorkspaceGeneratedEncounterAssessment } from '../contracts/locals';
import type { GeneratedEncounterAssessment } from '@run-planner/engine/simulation';

type ChoiceLabel = { readonly key: string; readonly label: string };

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function issueWaveIndex(issue: GeneratedEncounterAssessment['issues'][number]) {
  return 'waveIndex' in issue ? issue.waveIndex : undefined;
}

function issueMessage(
  issue: GeneratedEncounterAssessment['issues'][number],
  assessment: GeneratedEncounterAssessment,
  labelFor: (key: string) => string,
): string {
  const waveIndex = issueWaveIndex(issue);
  const wave = waveIndex === undefined ? '' : `Wave ${waveIndex}: `;
  switch (issue.reason) {
    case 'waveCount':
      return `Wave count ${issue.actual} is outside ${issue.allowed.min}–${issue.allowed.max}.`;
    case 'highlight':
      return `Highlight ${labelFor(issue.key)} is not available in this encounter context.`;
    case 'waveOutsideCount':
      return `${wave}is outside the selected count of ${issue.allowed}.`;
    case 'enemyUnavailable':
      return `${wave}enemy ${issue.position} (${labelFor(issue.key)}) is not available.`;
    case 'typeCount': {
      const seeds = assessment.waves.find((entry) => entry.waveIndex === waveIndex)?.seeds ?? [];
      const excess = Math.max(0, issue.actual - issue.allowed.max);
      const missing = Math.max(0, issue.allowed.min - issue.actual);
      if (missing > 0)
        return `${wave}needs at least ${plural(issue.allowed.min, 'total type')}; add ${plural(missing, 'type')}.`;
      if (issue.allowed.min === issue.allowed.max && seeds.length === issue.allowed.max)
        return `${wave}allows only ${seeds.map((seed) => (seed.kind === 'highlight' ? 'the highlight' : labelFor(seed.key))).join(' and ')}; remove ${plural(excess, 'additional type')}.`;
      return `${wave}allows ${plural(issue.allowed.max, 'total type')}${
        seeds.some((seed) => seed.kind === 'highlight') ? ' including the highlight' : ''
      }; remove ${plural(excess, 'type')}.`;
    }
    case 'placeholderCount':
      return `${wave}needs ${issue.allowed} generated companion; found ${issue.actual}.`;
    case 'weightMembers':
      return `${wave}weights must cover every generated member with positive values.`;
    default:
      return 'This customization needs repair for the current encounter context.';
  }
}

/** Adapts the engine assessment into the only generated-composition product React receives. */
export function projectGeneratedEncounterAssessment(
  assessment: GeneratedEncounterAssessment,
  labels: readonly ChoiceLabel[],
): WorkspaceGeneratedEncounterAssessment {
  const labelFor = (key: string) =>
    labels.find((choice) => choice.key === key)?.label ?? 'Unavailable enemy';
  return Object.freeze({
    supported: assessment.supported,
    issues: Object.freeze(
      assessment.issues.map((issue) => {
        const waveIndex = issueWaveIndex(issue);
        return Object.freeze(
          waveIndex === undefined
            ? { message: issueMessage(issue, assessment, labelFor) }
            : { message: issueMessage(issue, assessment, labelFor), waveIndex },
        );
      }),
    ),
    ...(assessment.effectiveWaveCount === undefined
      ? {}
      : { effectiveWaveCount: assessment.effectiveWaveCount }),
    composition: assessment.composition,
    eligibleHighlightKeys: assessment.eligibleHighlightKeys,
    waves: Object.freeze(
      assessment.waves.map((wave) => {
        const generated = assessment.operands?.waves?.find(
          (operand) => operand.waveIndex === wave.waveIndex,
        );
        return Object.freeze({
          waveIndex: wave.waveIndex,
          typeCount: wave.typeCount,
          additionalTypeCount: wave.additionalTypeCount,
          seeds: wave.seeds,
          exhausted: wave.exhausted,
          eligibleKeysByPosition: wave.eligibleKeysByPosition,
          ...(generated === undefined
            ? {}
            : {
                generatedMemberKeys: generated.typeKeys,
                ...(generated.shares === undefined ? {} : { normalizedShares: generated.shares }),
              }),
        });
      }),
    ),
  });
}
