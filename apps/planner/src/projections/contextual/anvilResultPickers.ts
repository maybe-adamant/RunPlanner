import type { ContextualPickerModel } from './contextualPicker';

/** An Anvil result being chosen; undefined marks a removal or Hammer not chosen yet. */
export interface AnvilResultDraft {
  readonly removedTraitKey: string | null | undefined;
  readonly firstAddedTraitKey: string | undefined;
  readonly secondAddedTraitKey: string | undefined;
}

export interface AnvilResultPickers {
  readonly removed: ContextualPickerModel<string | null>;
  readonly firstAdded: ContextualPickerModel<string>;
  readonly secondAdded: ContextualPickerModel<string>;
}

export function anvilRemovedTraitLabel(
  traitKey: string | null,
  traitLabel: (traitKey: string) => string,
): string {
  return traitKey === null ? 'No removable Hammer' : traitLabel(traitKey);
}

function pickerModel<T extends string | null>(
  values: readonly T[],
  selected: T | undefined,
  labelFor: (value: T) => string,
): ContextualPickerModel<T> {
  const available = values.map((value) =>
    Object.freeze({
      disabled: false,
      key: String(value),
      label: labelFor(value),
      selected: value === selected,
      state: 'possible' as const,
      value,
    }),
  );
  const stale =
    selected === undefined || values.includes(selected)
      ? []
      : [
          Object.freeze({
            disabled: true,
            key: String(selected),
            label: labelFor(selected),
            selected: true,
            state: 'impossible' as const,
            status: 'Current · unavailable',
            value: selected,
          }),
        ];
  const selectedItem = [...stale, ...available].find((item) => item.selected);
  return Object.freeze({
    ...(selectedItem === undefined ? {} : { selected: selectedItem }),
    sections: Object.freeze([
      ...(stale.length === 0
        ? []
        : [
            Object.freeze({
              collapsible: false,
              items: Object.freeze(stale),
              key: 'selected-invalid',
              kind: 'selectedInvalid' as const,
              label: 'Current selection',
            }),
          ]),
      Object.freeze({
        collapsible: false,
        items: Object.freeze(available),
        key: 'eligible',
        kind: 'category' as const,
        label: 'Eligible Hammers',
      }),
    ]),
  });
}

/** The removed and two added Hammer pickers; each added domain follows the earlier choices. */
export function projectAnvilResultPickers(
  domain: {
    readonly removedTraitKeys: readonly (string | null)[];
    readonly addedTraitKeysFor: (
      removedTraitKey: string | null,
      priorAddedTraitKeys: readonly string[],
    ) => readonly string[];
    readonly traitLabel: (traitKey: string) => string;
  },
  draft: AnvilResultDraft,
): AnvilResultPickers {
  const removed = draft.removedTraitKey;
  return Object.freeze({
    removed: pickerModel(domain.removedTraitKeys, removed, (traitKey) =>
      anvilRemovedTraitLabel(traitKey, domain.traitLabel),
    ),
    firstAdded: pickerModel(
      removed === undefined ? [] : domain.addedTraitKeysFor(removed, []),
      draft.firstAddedTraitKey,
      domain.traitLabel,
    ),
    secondAdded: pickerModel(
      removed === undefined
        ? []
        : domain.addedTraitKeysFor(
            removed,
            draft.firstAddedTraitKey === undefined ? [] : [draft.firstAddedTraitKey],
          ),
      draft.secondAddedTraitKey,
      domain.traitLabel,
    ),
  });
}
