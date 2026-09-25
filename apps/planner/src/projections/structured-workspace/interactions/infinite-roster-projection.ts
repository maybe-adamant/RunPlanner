import type { InfiniteRosterAssessment } from '@run-planner/engine/simulation';
import type {
  WorkspaceInfiniteRosterDraft,
  WorkspaceInfiniteRosterDraftChoice,
} from '../contracts/locals';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';

function draftItem(key: string, label: string, value: WorkspaceInfiniteRosterDraftChoice) {
  return Object.freeze({
    disabled: false,
    key,
    label,
    selected: false,
    state: 'possible' as const,
    value,
  });
}

/** Projects one app-local ordered roster draft from its exact engine assessment. */
export function projectInfiniteRosterDraft(
  assessment: InfiniteRosterAssessment,
  typeKeys: readonly string[],
  labels: readonly { readonly key: string; readonly label: string }[],
): WorkspaceInfiniteRosterDraft {
  const labelFor = (key: string) =>
    labels.find((choice) => choice.key === key)?.label ?? 'Unavailable enemy';
  const sections: ContextualPickerModel<WorkspaceInfiniteRosterDraftChoice>['sections'][number][] =
    [];
  if (assessment.supported)
    sections.push(
      Object.freeze({
        collapsible: false,
        items: Object.freeze([draftItem('finish', 'Finish Roster', { kind: 'finish' })]),
        key: 'finish',
        kind: 'category',
        label: 'Ready',
      }),
    );
  const position = typeKeys.length;
  const eligible =
    assessment.activeMemberKeys.length === position
      ? (assessment.eligibleKeysByPosition[position] ?? [])
      : [];
  const required = position < assessment.typeCount.min;
  if (eligible.length > 0)
    sections.push(
      Object.freeze({
        collapsible: false,
        items: Object.freeze(
          eligible.map((key) => draftItem(`enemy:${key}`, labelFor(key), { kind: 'enemy', key })),
        ),
        key: `enemy:${position}`,
        kind: required ? 'required' : 'category',
        label: required ? 'Required enemy' : 'Optional enemy',
      }),
    );
  const next = `Enemy ${position + 1}`;
  return Object.freeze({
    picker: Object.freeze({ sections: Object.freeze(sections) }),
    stepLabel: assessment.supported
      ? eligible.length > 0
        ? `Finish Roster or choose ${next}`
        : 'Finish Roster'
      : eligible.length > 0
        ? `Choose ${next}`
        : 'No further enemy choices',
  });
}
