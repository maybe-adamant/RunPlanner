export function pickerModel<T>(entries: readonly { readonly label: string; readonly value: T }[]) {
  return Object.freeze({
    sections: Object.freeze([
      Object.freeze({
        key: 'available',
        kind: 'category' as const,
        label: 'Available',
        collapsible: false,
        items: Object.freeze(
          entries.map((entry, index) =>
            Object.freeze({
              key: String(index),
              label: entry.label,
              value: entry.value,
              state: 'possible' as const,
              selected: false,
              disabled: false,
            }),
          ),
        ),
      }),
    ]),
  });
}

export function unavailablePickerModel<T>(
  label: string,
  value: T,
  additional: readonly { readonly label: string; readonly value: T }[] = Object.freeze([]),
) {
  const items = [Object.freeze({ label, value }), ...additional].map((entry) =>
    Object.freeze({
      key: String(entry.value),
      label: entry.label,
      value: entry.value,
      state: 'impossible' as const,
      selected: true,
      disabled: true,
      status: 'Current · unavailable',
      explanation: 'This outcome is not available at the current route frontier.',
    }),
  );
  const selected = items[0]!;
  return Object.freeze({
    selected,
    sections: Object.freeze([
      Object.freeze({
        key: 'selected-invalid',
        kind: 'selectedInvalid' as const,
        label: 'Current selection',
        collapsible: false,
        items: Object.freeze(items),
      }),
    ]),
  });
}
