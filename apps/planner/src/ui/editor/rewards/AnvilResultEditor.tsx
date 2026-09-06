import type { AuthoredAnvilResult } from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { WorkspaceAcquisitionConversionInteraction } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

type AnvilInteraction = NonNullable<WorkspaceAcquisitionConversionInteraction['anvil']>;
type AnvilDraft = {
  readonly removedTraitKey: string | null | undefined;
  readonly firstAddedTraitKey: string | undefined;
  readonly secondAddedTraitKey: string | undefined;
};

function draftFor(value: AuthoredAnvilResult | null): AnvilDraft {
  return value === null
    ? Object.freeze({
        removedTraitKey: undefined,
        firstAddedTraitKey: undefined,
        secondAddedTraitKey: undefined,
      })
    : Object.freeze({
        removedTraitKey: value.removedTraitKey,
        firstAddedTraitKey: value.addedTraitKeys[0],
        secondAddedTraitKey: value.addedTraitKeys[1],
      });
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

function resultFor(draft: AnvilDraft): AuthoredAnvilResult | undefined {
  return draft.removedTraitKey === undefined ||
    draft.firstAddedTraitKey === undefined ||
    draft.secondAddedTraitKey === undefined
    ? undefined
    : Object.freeze({
        kind: 'anvilOfFates' as const,
        removedTraitKey: draft.removedTraitKey,
        addedTraitKeys: Object.freeze([
          draft.firstAddedTraitKey,
          draft.secondAddedTraitKey,
        ]) as readonly [string, string],
      });
}

function AnvilResultDialog({
  interaction,
  onClose,
}: {
  readonly interaction: AnvilInteraction;
  readonly onClose: () => void;
}) {
  const executeIntent = useCommandIntent();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) dialog.setAttribute('open', '');
    const cancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', cancel);
    return () => dialog.removeEventListener('cancel', cancel);
  }, [onClose]);
  return (
    <dialog
      aria-labelledby="anvil-result-dialog-title"
      aria-modal="true"
      className="trait-offer-dialog-backdrop"
      ref={dialogRef}
    >
      <div className="trait-offer-dialog anvil-result-dialog">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Anvil of Fates</p>
            <h2 id="anvil-result-dialog-title">Choose Hammer result</h2>
          </div>
          <button
            aria-label="Close Anvil result"
            className="quiet-action"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>
        <AnvilResultEditor
          interaction={interaction}
          onCommit={(result) => {
            executeIntent(interaction.intentFor(result));
            onClose();
          }}
        />
      </div>
    </dialog>
  );
}

export function AnvilResultEditor({
  interaction,
  onCommit,
}: {
  readonly interaction: AnvilInteraction;
  readonly onCommit: (result: AuthoredAnvilResult) => void;
}) {
  const [draft, setDraft] = useState(() => draftFor(interaction.value));
  const removalValues =
    interaction.removableTraitKeys.length === 0
      ? Object.freeze([null])
      : interaction.removableTraitKeys;
  const firstValues =
    draft.removedTraitKey === undefined
      ? Object.freeze([])
      : interaction.addedTraitKeysFor(draft.removedTraitKey, []);
  const secondValues =
    draft.removedTraitKey === undefined
      ? Object.freeze([])
      : interaction.addedTraitKeysFor(
          draft.removedTraitKey,
          draft.firstAddedTraitKey === undefined ? [] : [draft.firstAddedTraitKey],
        );
  const result = resultFor(draft);
  return (
    <>
      <div className="anvil-result-pickers">
        <ContextualPicker
          ariaLabel="Removed Hammer"
          id="anvil-removed-hammer"
          label="Removed Hammer"
          model={pickerModel(removalValues, draft.removedTraitKey, (traitKey) =>
            traitKey === null ? 'No removable Hammer' : interaction.traitLabel(traitKey),
          )}
          onSelect={(removedTraitKey) =>
            setDraft(
              Object.freeze({
                removedTraitKey,
                firstAddedTraitKey: undefined,
                secondAddedTraitKey: undefined,
              }),
            )
          }
          placeholder="Choose removed Hammer"
          {...(draft.removedTraitKey === undefined
            ? {}
            : {
                triggerLabel:
                  draft.removedTraitKey === null
                    ? 'No removable Hammer'
                    : interaction.traitLabel(draft.removedTraitKey),
              })}
        />
        <ContextualPicker
          ariaLabel="Added Hammer 1"
          disabled={draft.removedTraitKey === undefined}
          id="anvil-added-hammer-1"
          label="Added Hammer 1"
          model={pickerModel(firstValues, draft.firstAddedTraitKey, interaction.traitLabel)}
          onSelect={(firstAddedTraitKey) =>
            setDraft(
              Object.freeze({
                ...draft,
                firstAddedTraitKey,
                secondAddedTraitKey: undefined,
              }),
            )
          }
          placeholder="Choose first Hammer"
          {...(draft.firstAddedTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(draft.firstAddedTraitKey) })}
        />
        <ContextualPicker
          ariaLabel="Added Hammer 2"
          disabled={draft.firstAddedTraitKey === undefined}
          id="anvil-added-hammer-2"
          label="Added Hammer 2"
          model={pickerModel(secondValues, draft.secondAddedTraitKey, interaction.traitLabel)}
          onSelect={(secondAddedTraitKey) =>
            setDraft(Object.freeze({ ...draft, secondAddedTraitKey }))
          }
          placeholder="Choose second Hammer"
          {...(draft.secondAddedTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(draft.secondAddedTraitKey) })}
        />
      </div>
      <button
        className="primary-action"
        disabled={result === undefined}
        onClick={() => {
          if (result !== undefined) onCommit(result);
        }}
        type="button"
      >
        Save Anvil result
      </button>
    </>
  );
}

export function AnvilResultLauncher({ interaction }: { readonly interaction: AnvilInteraction }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const label =
    interaction.value === null
      ? 'Edit Anvil: Choose result'
      : `Edit Anvil: ${
          interaction.value.removedTraitKey === null
            ? 'No removal'
            : interaction.traitLabel(interaction.value.removedTraitKey)
        } → ${interaction.value.addedTraitKeys.map(interaction.traitLabel).join(', ')}`;
  return (
    <>
      <button
        className="trait-offer-launcher quiet-action action-compact"
        onClick={() => setOpen(true)}
        type="button"
      >
        {label}
      </button>
      {open ? <AnvilResultDialog interaction={interaction} onClose={close} /> : null}
    </>
  );
}
