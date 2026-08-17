import type { EvaluatedDirectTraitOutcomeCandidate } from '@run-planner/engine/simulation';

import type {
  ContextualPickerItem,
  ContextualPickerModel,
  ContextualPickerSection,
} from './contextualPicker';

function item<T>(
  candidate: EvaluatedDirectTraitOutcomeCandidate<T>,
  label: (value: T) => string,
  key: (value: T) => string,
): ContextualPickerItem<T> {
  const state = candidate.support;
  const status =
    state === 'forced'
      ? 'Required'
      : state === 'impossible'
        ? candidate.selected
          ? 'Current · unavailable'
          : 'Unavailable'
        : undefined;
  const explanation =
    candidate.reason === 'branchDivergence'
      ? 'This outcome is not supported by every current route branch.'
      : candidate.reason === 'unavailable'
        ? 'This outcome is not available at the current route frontier.'
        : undefined;
  return Object.freeze({
    key: key(candidate.value),
    value: candidate.value,
    label: label(candidate.value),
    state,
    selected: candidate.selected,
    disabled: state === 'impossible',
    ...(status === undefined ? {} : { status }),
    ...(explanation === undefined ? {} : { explanation }),
  });
}

function section<T>(
  key: string,
  kind: ContextualPickerSection<T>['kind'],
  label: string,
  items: readonly ContextualPickerItem<T>[],
  collapsible = false,
): ContextualPickerSection<T> {
  return Object.freeze({ key, kind, label, items: Object.freeze(items), collapsible });
}

export function projectDirectTraitOutcomePicker<T>(
  candidates: readonly EvaluatedDirectTraitOutcomeCandidate<T>[],
  label: (value: T) => string,
  key: (value: T) => string,
): ContextualPickerModel<T> {
  const items = candidates.map((candidate) => item(candidate, label, key));
  const forced = items.filter((candidate) => candidate.state === 'forced');
  const selectedInvalid = items.filter(
    (candidate) => candidate.state === 'impossible' && candidate.selected,
  );
  const available = items.filter((candidate) => candidate.state === 'possible');
  const unavailable = items.filter(
    (candidate) => candidate.state === 'impossible' && !candidate.selected,
  );
  const selected = items.find((candidate) => candidate.selected);
  return Object.freeze({
    ...(selected === undefined ? {} : { selected }),
    sections: Object.freeze([
      ...(forced.length === 0 ? [] : [section('required', 'required', 'Required now', forced)]),
      ...(selectedInvalid.length === 0
        ? []
        : [section('selected-invalid', 'selectedInvalid', 'Current selection', selectedInvalid)]),
      ...(available.length === 0 ? [] : [section('available', 'category', 'Available', available)]),
      ...(unavailable.length === 0
        ? []
        : [section('unavailable', 'unavailable', 'Unavailable', unavailable, true)]),
    ]),
  });
}

export function withoutDirectTraitOutcomeValues<T>(
  candidates: readonly EvaluatedDirectTraitOutcomeCandidate<T>[],
  values: readonly T[],
): readonly EvaluatedDirectTraitOutcomeCandidate<T>[] {
  return Object.freeze(
    candidates.filter((candidate) => !values.some((value) => Object.is(value, candidate.value))),
  );
}

export function withDirectTraitOutcomeSelection<T>(
  candidates: readonly EvaluatedDirectTraitOutcomeCandidate<T>[],
  values: readonly T[],
): readonly EvaluatedDirectTraitOutcomeCandidate<T>[] {
  return Object.freeze(
    candidates.map((candidate) =>
      Object.freeze({
        ...candidate,
        selected: values.some((value) => Object.is(value, candidate.value)),
      }),
    ),
  );
}
