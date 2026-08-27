import type {
  ContextualPickerItem,
  ContextualPickerModel,
} from '@planner/projections/contextualPicker';

import type { WorkspaceFeatureAssessment } from '../contract';

export interface StableIdentityPickerChoice<T> {
  readonly label: string;
  readonly value: T;
}

export interface StableIdentityPickerInput<T> {
  readonly assessment?: WorkspaceFeatureAssessment;
  readonly choices: readonly StableIdentityPickerChoice<T>[];
  readonly selected: T | undefined;
  readonly selectedLabel: string | undefined;
}

/**
 * Project one identity domain while retaining authored selections for repair.
 * Room-feature assessments are explicit: an unreached domain remains editable
 * but unassessed, whereas a reached domain can mark an excluded selection
 * invalid.
 */
export function projectStableIdentityPicker<T>({
  assessment = 'assessed',
  choices,
  selected,
  selectedLabel,
}: StableIdentityPickerInput<T>): ContextualPickerModel<T> {
  const selectedChoice = choices.find((choice) => Object.is(choice.value, selected));
  const selectedIsStale =
    assessment === 'assessed' && selected !== undefined && selectedChoice === undefined;
  const itemState = assessment === 'assessed' ? ('possible' as const) : ('unassessed' as const);
  const selectedItem = selectedIsStale
    ? Object.freeze({
        disabled: true,
        explanation: 'This current choice is no longer available here.',
        key: String(selected),
        label: selectedLabel ?? String(selected),
        selected: true,
        state: 'impossible' as const,
        status: 'Current · unavailable',
        value: selected,
      })
    : selectedChoice === undefined
      ? undefined
      : Object.freeze({
          disabled: false,
          key: String(selectedChoice.value),
          label: selectedChoice.label,
          selected: true,
          state: itemState,
          value: selectedChoice.value,
        });
  const items: readonly ContextualPickerItem<T>[] = choices.map((choice) =>
    Object.freeze({
      disabled: false,
      key: String(choice.value),
      label: choice.label,
      selected: Object.is(choice.value, selected),
      state: itemState,
      value: choice.value,
    }),
  );
  const retainedUnassessed =
    assessment === 'unassessed' && selected !== undefined && selectedChoice === undefined
      ? Object.freeze({
          disabled: false,
          key: String(selected),
          label: selectedLabel ?? String(selected),
          selected: true,
          state: 'unassessed' as const,
          status: 'Not evaluated',
          value: selected,
        })
      : undefined;
  const unassessedItems: readonly ContextualPickerItem<T>[] =
    retainedUnassessed === undefined ? items : Object.freeze([...items, retainedUnassessed]);
  const availableSection =
    assessment === 'assessed'
      ? Object.freeze({
          collapsible: false,
          items: unassessedItems,
          key: 'category:available',
          kind: 'category' as const,
          label: 'Available',
        })
      : Object.freeze({
          collapsible: false,
          items: unassessedItems,
          key: 'unassessed:available',
          kind: 'unassessed' as const,
          label: 'Not evaluated',
        });
  return Object.freeze({
    ...(selectedItem === undefined
      ? retainedUnassessed === undefined
        ? {}
        : { selected: retainedUnassessed }
      : { selected: selectedItem }),
    sections: Object.freeze([
      ...(selectedIsStale && selectedItem !== undefined
        ? [
            Object.freeze({
              collapsible: false,
              items: Object.freeze([selectedItem]),
              key: 'selected-invalid',
              kind: 'selectedInvalid' as const,
              label: 'Current selection',
            }),
          ]
        : []),
      ...(unassessedItems.length === 0 ? [] : [availableSection]),
    ]),
  });
}

/** Keep stable room-feature models lazy while avoiding repeated wiring IIFEs. */
export function createMemoizedStableIdentityPickerLoad<T>(
  input: StableIdentityPickerInput<T>,
): () => ContextualPickerModel<T> {
  let model: ContextualPickerModel<T> | undefined;
  return () => (model ??= projectStableIdentityPicker(input));
}
