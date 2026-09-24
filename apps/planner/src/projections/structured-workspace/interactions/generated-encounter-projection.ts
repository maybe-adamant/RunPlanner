import type {
  WorkspaceGeneratedEncounterAssessment,
  WorkspaceGeneratedWaveDraft,
  WorkspaceGeneratedWaveDraftChoice,
  WorkspaceGeneratedFangsDraft,
  WorkspaceGeneratedFangsDraftChoice,
} from '../contracts/locals';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { GeneratedEncounterAssessment } from '@run-planner/engine/simulation';
import type { AuthoredGeneratedEncounterCustomization } from '@run-planner/engine/authored-project';

import { projectStableIdentityPicker } from './room-feature-picker-model';

type ChoiceLabel = {
  readonly key: string;
  readonly label: string;
  readonly fangsCaveat?: 'squad';
  readonly blacklistAfterAppearance?: true;
  readonly menace?: import('@run-planner/engine/catalog-schema').EncounterEnemyChoice['menace'];
};

export function generatedEnemyLabel(label: string): string {
  return label.endsWith(' (Elite)') ? `Elite ${label.slice(0, -8)}` : label;
}

export function projectGeneratedMenace(
  fact: import('@run-planner/engine/catalog-schema').EncounterEnemyChoice['menace'],
) {
  if (fact?.kind === 'mapped')
    return { ...fact, targetLabel: generatedEnemyLabel(fact.targetLabel ?? 'Unavailable enemy') };
  if (fact?.kind === 'random')
    return {
      ...fact,
      targetLabels: Object.freeze(
        Object.fromEntries(
          fact.targetNativeIds.map((key) => [
            key,
            generatedEnemyLabel(fact.targetLabels?.[key] ?? 'Unavailable enemy'),
          ]),
        ),
      ),
    };
  return fact;
}

export function projectGeneratedEncounterHighlightPicker(
  assessment: GeneratedEncounterAssessment | undefined,
  selected: string | undefined,
  labels: readonly ChoiceLabel[],
  declarationKeys: readonly string[],
): ContextualPickerModel<string> {
  const labelFor = (key: string) =>
    generatedEnemyLabel(labels.find((choice) => choice.key === key)?.label ?? 'Unavailable enemy');
  return projectStableIdentityPicker({
    assessment: assessment === undefined ? 'unassessed' : 'assessed',
    choices: [
      ...(assessment?.eligibleHighlightKeys ?? declarationKeys).map((key) => ({
        label: labelFor(key),
        value: key,
      })),
    ],
    selected,
    selectedLabel: selected === undefined ? undefined : labelFor(selected),
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
  switch (issue.reason) {
    case 'required':
      return issue.field === 'waveCount'
        ? 'Choose the number of waves.'
        : issue.field === 'baseRoll'
          ? 'Choose an encounter budget.'
          : issue.field === 'highlight'
            ? 'Choose the shared enemy.'
            : issue.field === 'wave'
              ? 'Choose its enemies.'
              : 'Set each editable enemy budget.';
    case 'baseRoll':
      return `Stored budget ${issue.actual} is unavailable. Choose a supported budget.`;
    case 'waveCount':
      return `Wave count ${issue.actual} is outside ${issue.allowed.min}–${issue.allowed.max}.`;
    case 'highlight':
      return `Shared enemy ${labelFor(issue.key)} is not available in this encounter context.`;
    case 'enemyUnavailable':
      return `Enemy ${issue.position} (${labelFor(issue.key)}) is not available.`;
    case 'typeCount': {
      const seeds = assessment.waves.find((entry) => entry.waveIndex === waveIndex)?.seeds ?? [];
      const excess = Math.max(0, issue.actual - issue.allowed.max);
      const missing = Math.max(0, issue.allowed.min - issue.actual);
      if (missing > 0)
        return `Needs at least ${plural(issue.allowed.min, 'total type')}; add ${plural(missing, 'type')}.`;
      if (issue.allowed.min === issue.allowed.max && seeds.length === issue.allowed.max)
        return `Allows only ${seeds.map((seed) => (seed.kind === 'highlight' ? 'the shared enemy' : labelFor(seed.key))).join(' and ')}; remove ${plural(excess, 'additional type')}.`;
      return `Allows ${plural(issue.allowed.max, 'total type')}${
        seeds.some((seed) => seed.kind === 'highlight') ? ' including the shared enemy' : ''
      }; remove ${plural(excess, 'type')}.`;
    }
    case 'placeholderCount':
      return `Needs ${issue.allowed} generated companion; found ${issue.actual}.`;
    case 'allocationMembers':
      return 'Budgets include an enemy that no longer has an editable budget. Edit the affected wave.';
    case 'fangs':
      return issue.issue === 'typeUnavailable'
        ? 'The stored Fangs elite is not in the active encounter composition. Choose an available elite.'
        : issue.issue === 'perkUnavailable'
          ? 'The stored Fangs perks are no longer a legal native pick order. Repair the selection.'
          : 'Choose the next available Fangs perk.';
    case 'menace':
      return issue.issue === 'targetRequired'
        ? `Choose a Menace replacement before converting ${labelFor(issue.key)}.`
        : issue.issue === 'targetUnavailable'
          ? `The stored Menace replacement for ${labelFor(issue.key)} is unavailable. Choose another replacement.`
          : `Converted ${labelFor(issue.key)} requests exceed its current count. Reduce Menace Count.`;
    default:
      return 'This customization needs repair for the current encounter context.';
  }
}

/** Adapts the engine assessment into the only generated-composition product React receives. */
export function projectGeneratedEncounterAssessment(
  assessment: GeneratedEncounterAssessment,
  labels: readonly ChoiceLabel[],
  authored?: AuthoredGeneratedEncounterCustomization,
): WorkspaceGeneratedEncounterAssessment {
  const labelFor = (key: string) =>
    generatedEnemyLabel(labels.find((choice) => choice.key === key)?.label ?? 'Unavailable enemy');
  return Object.freeze({
    issues: Object.freeze(
      assessment.issues.map((issue) => {
        const waveIndex = issueWaveIndex(issue);
        return Object.freeze({
          message: issueMessage(issue, assessment, labelFor),
          ...(waveIndex === undefined ? {} : { waveIndex }),
          ...(issue.reason === 'enemyUnavailable' ||
          issue.reason === 'typeCount' ||
          issue.reason === 'placeholderCount' ||
          (issue.reason === 'required' && issue.field === 'wave')
            ? { field: 'enemies' as const }
            : {}),
          ...(issue.reason === 'required' &&
          (issue.field === 'baseRoll' || issue.field === 'waveCount' || issue.field === 'highlight')
            ? { field: issue.field }
            : {}),
          ...(issue.reason === 'baseRoll' ||
          issue.reason === 'waveCount' ||
          issue.reason === 'highlight' ||
          issue.reason === 'fangs'
            ? { field: issue.reason }
            : {}),
        });
      }),
    ),
    composition: assessment.composition,
    warnings: Object.freeze(
      [...new Set(assessment.waves.flatMap((wave) => wave.activeMemberKeys))]
        .filter(
          (key) => labels.find((choice) => choice.key === key)?.blacklistAfterAppearance === true,
        )
        .map(
          (key) =>
            `${labelFor(key)} can appear only once per run. An earlier uncustomized encounter may already include it.`,
        ),
    ),
    ...(assessment.budgetDomain === undefined ? {} : { budgetDomain: assessment.budgetDomain }),
    ...(assessment.budget === undefined ? {} : { budget: assessment.budget }),
    ...(assessment.fangs === undefined
      ? {}
      : { fangs: Object.freeze({ active: assessment.fangs.active }) }),
    ...(assessment.menace === undefined
      ? {}
      : { menace: Object.freeze({ active: assessment.menace.active }) }),
    waves: Object.freeze(
      assessment.waves.map((wave) => {
        return Object.freeze({
          waveIndex: wave.waveIndex,
          menaceCells: Object.freeze(
            Object.fromEntries(
              (wave.menaceSources ?? []).map((source) => {
                const fact = labels.find((entry) => entry.key === source.sourceKey)?.menace;
                const selected = authored?.menace?.find(
                  (entry) => entry.waveIndex === wave.waveIndex,
                )?.conversions[source.sourceKey]?.targetKey;
                const labelFor = (key: string) =>
                  generatedEnemyLabel(
                    fact?.kind === 'random'
                      ? (fact.targetLabels?.[key] ?? 'Unavailable enemy')
                      : 'Unavailable enemy',
                  );
                return [
                  source.sourceKey,
                  Object.freeze({
                    replacementLabel:
                      source.targetNativeId === undefined
                        ? selected === undefined
                          ? 'Select replacement'
                          : labelFor(selected)
                        : generatedEnemyLabel(
                            fact?.kind === 'mapped'
                              ? (fact.targetLabel ?? 'Unavailable enemy')
                              : 'Unavailable enemy',
                          ),
                    ...(source.targetNativeIds === undefined
                      ? {}
                      : {
                          picker: projectStableIdentityPicker({
                            assessment: 'assessed',
                            choices: source.targetNativeIds.map((key) => ({
                              value: key,
                              label: labelFor(key),
                            })),
                            selected,
                            selectedLabel:
                              selected === undefined ? 'Select replacement' : labelFor(selected),
                          }),
                        }),
                  }),
                ];
              }),
            ),
          ),
          additionalTypeCount: wave.additionalTypeCount,
          seeds: wave.seeds,
          sampledBudgetKeys: wave.sampledBudgetKeys,
          ...(wave.countPreview === undefined ? {} : { countPreview: wave.countPreview }),
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
    generatedEnemyLabel(labels.find((choice) => choice.key === key)?.label ?? 'Unavailable enemy');
  const wave = assessment.waves.find((entry) => entry.waveIndex === waveIndex);
  if (wave === undefined) {
    return Object.freeze({
      picker: Object.freeze({ sections: Object.freeze([]) }),
      stepLabel: 'Wave is not active',
      sampledBudgetKeys: Object.freeze([]),
    });
  }
  const waveIssues = assessment.issues.filter(
    (issue) =>
      issueWaveIndex(issue) === waveIndex &&
      issue.reason !== 'required' &&
      issue.reason !== 'menace' &&
      issue.reason !== 'allocationMembers',
  );
  const seedsConfirmed = confirmedSeedCount >= wave.seeds.length;
  const canFinish =
    assessment.composition === 'active' && seedsConfirmed && waveIssues.length === 0;
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
          label: `Enemy ${confirmedSeedCount + 1} (${seed.kind === 'highlight' ? 'shared enemy' : 'fixed'})`,
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
  const blockingIssue = waveIssues[0];
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
    sampledBudgetKeys: wave.sampledBudgetKeys,
  });
}

/** Target selection is authored immediately; perk prefixes remain transient until Finish. */
export function projectGeneratedFangsDraft(
  assessment: GeneratedEncounterAssessment,
  value: { readonly typeKey: string; readonly perkKeys: readonly string[] } | undefined,
  labels: readonly ChoiceLabel[],
  perkLabels: Readonly<Record<string, { readonly label: string; readonly maxPerRoom?: number }>>,
): WorkspaceGeneratedFangsDraft {
  const fangs = assessment.fangs;
  const enemy = (key: string) => labels.find((entry) => entry.key === key);
  const label = (key: string) => {
    const choice = enemy(key);
    return `${generatedEnemyLabel(choice?.label ?? 'Unavailable enemy')}${
      choice?.fangsCaveat === 'squad' ? ' (squad selection)' : ''
    }`;
  };
  const item = (key: string, text: string, value: WorkspaceGeneratedFangsDraftChoice) =>
    Object.freeze({
      key,
      label: text,
      value,
      selected: false,
      disabled: false,
      state: 'possible' as const,
    });
  const sections: ContextualPickerModel<WorkspaceGeneratedFangsDraftChoice>['sections'][number][] =
    [];
  if (fangs === undefined || !fangs.active || fangs.next === 'unavailable')
    return Object.freeze({
      picker: Object.freeze({ sections: Object.freeze(sections) }),
      stepLabel: 'No Fangs selection is available for this composition',
    });
  if (fangs.next === 'type') {
    sections.push(
      Object.freeze({
        key: 'type',
        kind: 'required',
        label: 'Elite enemy',
        collapsible: false,
        items: Object.freeze(
          fangs.eligibleTypeKeys.map((key) =>
            item(`type:${key}`, label(key), { kind: 'type', key }),
          ),
        ),
      }),
    );
    return Object.freeze({
      picker: Object.freeze({ sections: Object.freeze(sections) }),
      stepLabel: 'Choose an elite enemy',
    });
  }
  const selected = value?.perkKeys ?? [];
  if (selected.length > 0) {
    sections.push(
      Object.freeze({
        key: 'selected',
        kind: 'category',
        label: 'Selected perks',
        collapsible: false,
        items: Object.freeze(
          selected.map((key, index) =>
            item(`prefix:${index}`, `${perkLabels[key]?.label ?? key} · edit from here`, {
              kind: 'perkPrefix',
              perkKeys: Object.freeze(selected.slice(0, index)),
            }),
          ),
        ),
      }),
    );
  }
  if (fangs.canFinish) {
    sections.push(
      Object.freeze({
        key: 'finish',
        kind: 'category',
        label: 'Ready',
        collapsible: false,
        items: Object.freeze([item('finish', 'Finish', { kind: 'finish' })]),
      }),
    );
    return Object.freeze({
      picker: Object.freeze({ sections: Object.freeze(sections) }),
      stepLabel: 'Finish Fangs selection',
    });
  }
  if (fangs.eligiblePerkKeys.length > 0)
    sections.push(
      Object.freeze({
        key: 'perk',
        kind: 'required',
        label: `Perk ${selected.length + 1}`,
        collapsible: false,
        items: Object.freeze(
          fangs.eligiblePerkKeys.map((key) =>
            item(
              `perk:${key}`,
              `${perkLabels[key]?.label ?? key}${perkLabels[key]?.maxPerRoom === 1 ? ' (one per room)' : ''}`,
              { kind: 'perk', key },
            ),
          ),
        ),
      }),
    );
  return Object.freeze({
    picker: Object.freeze({ sections: Object.freeze(sections) }),
    stepLabel:
      fangs.next === 'perk' ? `Choose perk ${selected.length + 1}` : 'Repair the Fangs selection',
  });
}
