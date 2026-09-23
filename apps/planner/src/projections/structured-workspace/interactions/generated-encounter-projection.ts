import type {
  WorkspaceGeneratedEncounterAssessment,
  WorkspaceGeneratedWaveDraft,
  WorkspaceGeneratedWaveDraftChoice,
} from '../contracts/locals';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { GeneratedEncounterAssessment } from '@run-planner/engine/simulation';

import { projectStableIdentityPicker } from './room-feature-picker-model';

type ChoiceLabel = { readonly key: string; readonly label: string };

export function projectGeneratedEncounterHighlightPicker(
  assessment: GeneratedEncounterAssessment | undefined,
  selected: string | undefined,
  labels: readonly ChoiceLabel[],
  declarationKeys: readonly string[],
): ContextualPickerModel<string> {
  const labelFor = (key: string) =>
    labels.find((choice) => choice.key === key)?.label ?? 'Unavailable enemy';
  return projectStableIdentityPicker({
    assessment: assessment === undefined ? 'unassessed' : 'assessed',
    choices: [
      { label: 'Default', value: '' },
      ...(assessment?.eligibleHighlightKeys ?? declarationKeys).map((key) => ({
        label: labelFor(key),
        value: key,
      })),
    ],
    selected: selected ?? '',
    selectedLabel: selected === undefined ? 'Default' : labelFor(selected),
  });
}

function draftItem(
  key: string,
  label: string,
  value: WorkspaceGeneratedWaveDraftChoice,
  state: 'forced' | 'possible',
) {
  return Object.freeze({
    disabled: false,
    key,
    label,
    selected: false,
    state,
    value,
  });
}

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
    case 'allocationMembers':
      return `${wave}allocation samples must name generated members.`;
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
    issues: Object.freeze(
      assessment.issues.map((issue) => {
        const waveIndex = issueWaveIndex(issue);
        return Object.freeze({
          message: issueMessage(issue, assessment, labelFor),
          ...(waveIndex === undefined ? {} : { waveIndex }),
          ...(issue.reason === 'waveCount' || issue.reason === 'highlight'
            ? { field: issue.reason }
            : {}),
        });
      }),
    ),
    composition: assessment.composition,
    ...(assessment.budget === undefined ? {} : { budget: assessment.budget }),
    waves: Object.freeze(
      assessment.waves.map((wave) => {
        const generated = assessment.operands?.waves?.find(
          (operand) => operand.waveIndex === wave.waveIndex,
        );
        return Object.freeze({
          waveIndex: wave.waveIndex,
          additionalTypeCount: wave.additionalTypeCount,
          seeds: wave.seeds,
          ...(generated === undefined
            ? {}
            : {
                generatedMemberKeys: generated.typeKeys,
                countPreview: wave.countPreview,
              }),
        });
      }),
    ),
  });
}

/** Projects one app-local whole-wave draft from an exact engine assessment. */
export function projectGeneratedEncounterWaveDraft(
  assessment: GeneratedEncounterAssessment,
  waveIndex: number,
  confirmedSeedCount: number,
  typeKeys: readonly string[],
  labels: readonly ChoiceLabel[],
): WorkspaceGeneratedWaveDraft {
  const labelFor = (key: string) =>
    labels.find((choice) => choice.key === key)?.label ?? 'Unavailable enemy';
  const wave = assessment.waves.find((entry) => entry.waveIndex === waveIndex);
  if (wave === undefined) {
    return Object.freeze({
      picker: Object.freeze({ sections: Object.freeze([]) }),
      stepLabel: 'Wave is not active',
    });
  }
  const globalIssues = assessment.issues.filter((issue) => issueWaveIndex(issue) === undefined);
  const waveIssues = assessment.issues.filter((issue) => issueWaveIndex(issue) === waveIndex);
  const seedsConfirmed = confirmedSeedCount >= wave.seeds.length;
  const canFinish =
    assessment.composition === 'active' &&
    seedsConfirmed &&
    globalIssues.length === 0 &&
    waveIssues.length === 0;
  const sections: ContextualPickerModel<WorkspaceGeneratedWaveDraftChoice>['sections'][number][] =
    [];
  if (canFinish) {
    sections.push(
      Object.freeze({
        collapsible: false,
        items: Object.freeze([draftItem('finish', 'Finish Wave', { kind: 'finish' }, 'possible')]),
        key: 'finish',
        kind: 'category',
        label: 'Ready',
      }),
    );
  }
  if (assessment.composition === 'active' && !seedsConfirmed) {
    const seed = wave.seeds[confirmedSeedCount];
    if (seed !== undefined) {
      sections.push(
        Object.freeze({
          collapsible: false,
          items: Object.freeze([
            draftItem(
              `seed:${seed.key}`,
              labelFor(seed.key),
              { kind: 'confirmSeed', key: seed.key },
              'forced',
            ),
          ]),
          key: `seed:${confirmedSeedCount}`,
          kind: 'required',
          label: `Enemy ${confirmedSeedCount + 1} (${seed.kind})`,
        }),
      );
    }
  } else if (assessment.composition === 'active') {
    const position = typeKeys.length;
    const eligible = wave.eligibleKeysByPosition[position] ?? [];
    if (eligible.length > 0) {
      const required = position < wave.additionalTypeCount.min;
      sections.push(
        Object.freeze({
          collapsible: false,
          items: Object.freeze(
            eligible.map((key) =>
              draftItem(`enemy:${key}`, labelFor(key), { kind: 'enemy', key }, 'possible'),
            ),
          ),
          key: `enemy:${position}`,
          kind: required ? 'required' : 'category',
          label: required ? 'Required addition' : 'Optional additional enemy',
        }),
      );
    }
  }
  const blockingIssue = [...globalIssues, ...waveIssues][0];
  const hasFurtherCandidates =
    seedsConfirmed && (wave.eligibleKeysByPosition[typeKeys.length]?.length ?? 0) > 0;
  const stepLabel = !seedsConfirmed
    ? `Confirm Enemy ${confirmedSeedCount + 1} of ${wave.seeds.length}`
    : canFinish
      ? hasFurtherCandidates
        ? `Finish Wave or choose Enemy ${wave.seeds.length + typeKeys.length + 1}`
        : 'Finish Wave'
      : hasFurtherCandidates
        ? `Choose Enemy ${wave.seeds.length + typeKeys.length + 1}`
        : blockingIssue === undefined
          ? 'No further enemy choices'
          : issueMessage(blockingIssue, assessment, labelFor);
  return Object.freeze({
    picker: Object.freeze({ sections: Object.freeze(sections) }),
    stepLabel,
  });
}
