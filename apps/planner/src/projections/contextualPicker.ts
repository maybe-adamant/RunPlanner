import type {
  ContextualOption,
  ContextualOptionResolver,
  ContextualOptionState,
  ContextualOptionPresentation,
} from './contextualOptions';
import type { CandidateOptionProjection } from './candidateProjection';

export type ContextualPickerSectionKind =
  'required' | 'selectedInvalid' | 'category' | 'unassessed' | 'unavailable';

export interface ContextualPickerItem<T> {
  readonly key: string;
  readonly value: T;
  readonly label: string;
  readonly state: ContextualOptionState;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly status?: string;
  readonly explanation?: string;
}

export interface ContextualPickerSection<T> {
  readonly key: string;
  readonly kind: ContextualPickerSectionKind;
  readonly label: string;
  readonly collapsible: boolean;
  readonly items: readonly ContextualPickerItem<T>[];
}

export interface ContextualPickerModel<T> {
  readonly selected?: ContextualPickerItem<T>;
  readonly sections: readonly ContextualPickerSection<T>[];
}

export interface ContextualPickerProjectionService {
  readonly project: <T>(
    options: readonly CandidateOptionProjection<T>[],
    presentationFor: (option: CandidateOptionProjection<T>) => ContextualOptionPresentation,
    keyFor: (value: T) => string,
  ) => ContextualPickerModel<T>;
}

interface MutableSection<T> {
  readonly key: string;
  readonly kind: ContextualPickerSectionKind;
  readonly label: string;
  readonly collapsible: boolean;
  readonly items: ContextualPickerItem<T>[];
}

function pickerItem<T>(option: ContextualOption<T>, keyFor: (value: T) => string) {
  const status =
    option.state === 'forced'
      ? 'Required'
      : option.state === 'unassessed'
        ? 'Not evaluated'
        : option.state === 'impossible'
          ? option.selected
            ? 'Current · unavailable'
            : 'Unavailable'
          : undefined;
  return Object.freeze({
    key: keyFor(option.value),
    value: option.value,
    label: option.label,
    state: option.state,
    selected: option.selected,
    disabled: option.state === 'impossible',
    ...(status === undefined ? {} : { status }),
    ...(option.explanation === undefined ? {} : { explanation: option.explanation.message }),
  });
}

function categoryLabel(category: string | undefined): string {
  return category ?? 'Available';
}

function pushGrouped<T>(
  sections: MutableSection<T>[],
  byKey: Map<string, MutableSection<T>>,
  item: ContextualPickerItem<T>,
  kind: 'category' | 'unassessed',
  category: string | undefined,
): void {
  const label =
    kind === 'category'
      ? categoryLabel(category)
      : category === undefined
        ? 'Not evaluated'
        : `${category} · Not evaluated`;
  const key = `${kind}:${category ?? 'available'}`;
  let section = byKey.get(key);
  if (section === undefined) {
    section = { key, kind, label, collapsible: false, items: [] };
    byKey.set(key, section);
    sections.push(section);
  }
  section.items.push(item);
}

function freezeSection<T>(section: MutableSection<T>): ContextualPickerSection<T> {
  return Object.freeze({
    key: section.key,
    kind: section.kind,
    label: section.label,
    collapsible: section.collapsible,
    items: Object.freeze(section.items),
  });
}

function projectOptions<T>(
  options: readonly ContextualOption<T>[],
  keyFor: (value: T) => string,
): ContextualPickerModel<T> {
  const required: MutableSection<T> = {
    key: 'required',
    kind: 'required',
    label: 'Required now',
    collapsible: false,
    items: [],
  };
  const selectedInvalid: MutableSection<T> = {
    key: 'selected-invalid',
    kind: 'selectedInvalid',
    label: 'Current selection',
    collapsible: false,
    items: [],
  };
  const possible: MutableSection<T>[] = [];
  const possibleByKey = new Map<string, MutableSection<T>>();
  const unassessed: MutableSection<T>[] = [];
  const unassessedByKey = new Map<string, MutableSection<T>>();
  const unavailable: MutableSection<T> = {
    key: 'unavailable',
    kind: 'unavailable',
    label: 'Unavailable',
    collapsible: true,
    items: [],
  };
  let selected: ContextualPickerItem<T> | undefined;

  for (const option of options) {
    const item = pickerItem(option, keyFor);
    if (item.selected) {
      selected = item;
    }
    switch (option.state) {
      case 'forced':
        required.items.push(item);
        break;
      case 'possible':
        pushGrouped(possible, possibleByKey, item, 'category', option.category);
        break;
      case 'unassessed':
        pushGrouped(unassessed, unassessedByKey, item, 'unassessed', option.category);
        break;
      case 'impossible':
        if (option.selected) {
          selectedInvalid.items.push(item);
        } else {
          unavailable.items.push(item);
        }
        break;
    }
  }

  const sections = [
    ...(required.items.length === 0 ? [] : [required]),
    ...(selectedInvalid.items.length === 0 ? [] : [selectedInvalid]),
    ...possible,
    ...unassessed,
    ...(unavailable.items.length === 0 ? [] : [unavailable]),
  ].map(freezeSection);

  return Object.freeze({
    ...(selected === undefined ? {} : { selected }),
    sections: Object.freeze(sections),
  });
}

export function createContextualPickerProjection(
  resolver: ContextualOptionResolver,
): ContextualPickerProjectionService {
  const cache = new WeakMap<
    readonly ContextualOption<unknown>[],
    Map<string, ContextualPickerModel<unknown>>
  >();
  return Object.freeze({
    project<T>(
      options: readonly CandidateOptionProjection<T>[],
      presentationFor: (option: CandidateOptionProjection<T>) => ContextualOptionPresentation,
      keyFor: (value: T) => string,
    ): ContextualPickerModel<T> {
      const contextual = resolver.resolve(options, presentationFor);
      const key = JSON.stringify(contextual.map((option) => keyFor(option.value)));
      let byKey = cache.get(contextual);
      if (byKey === undefined) {
        byKey = new Map();
        cache.set(contextual, byKey);
      }
      const existing = byKey.get(key);
      if (existing !== undefined) {
        return existing as ContextualPickerModel<T>;
      }
      const projected = projectOptions(contextual, keyFor);
      byKey.set(key, projected);
      return projected;
    },
  });
}
