import {
  semanticAddressKey,
  type AcquisitionRoleAddress,
  type AuthoredAnvilResult,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useState } from 'react';

import {
  anvilRemovedTraitLabel,
  type AnvilResultDraft,
} from '@planner/projections/contextual/anvilResultPickers';
import type { WorkspaceAcquisitionConversionInteraction } from '@planner/projections/structured-workspace';
import {
  anvilResultDialogClosed,
  anvilResultDialogOpened,
} from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import {
  EditorDialog,
  EditorDialogDraftActions,
  EditorDialogFeedback,
} from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingTitle } from '@planner/ui/feedback/candidatePresentation';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

type AnvilInteraction = NonNullable<WorkspaceAcquisitionConversionInteraction['anvil']>;

function draftFor(value: AuthoredAnvilResult | null): AnvilResultDraft {
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

function resultFor(draft: AnvilResultDraft): AuthoredAnvilResult | undefined {
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
  launcherId,
  onClose,
}: {
  readonly interaction: AnvilInteraction;
  readonly launcherId: string;
  readonly onClose: () => void;
}) {
  const executeIntent = useCommandIntent();
  return (
    <EditorDialog
      eyebrow="Anvil of Fates"
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={launcherId}
      title="Choose Hammer result"
    >
      <AnvilResultEditor
        interaction={interaction}
        // A changed authored result replaces the draft; a changed context keeps it.
        key={draftValueIdentity(interaction.value)}
        onCancel={onClose}
        onCommit={(result) => {
          executeIntent(interaction.intentFor(result));
          onClose();
        }}
      />
    </EditorDialog>
  );
}

export function AnvilResultEditor({
  interaction,
  onCancel,
  onCommit,
}: {
  readonly interaction: AnvilInteraction;
  /** Discards the draft; absent outside a dialog. */
  readonly onCancel?: () => void;
  readonly onCommit: (result: AuthoredAnvilResult) => void;
}) {
  const [draft, setDraft] = useState(() => draftFor(interaction.value));
  const pickers = interaction.pickersFor(draft);
  const result = resultFor(draft);
  return (
    <>
      <div className="anvil-result-pickers">
        <ContextualPicker
          ariaLabel="Removed Hammer"
          id="anvil-removed-hammer"
          label="Removed Hammer"
          model={pickers.removed}
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
                triggerLabel: anvilRemovedTraitLabel(draft.removedTraitKey, interaction.traitLabel),
              })}
        />
        <ContextualPicker
          ariaLabel="Added Hammer 1"
          disabled={draft.removedTraitKey === undefined}
          id="anvil-added-hammer-1"
          label="Added Hammer 1"
          model={pickers.firstAdded}
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
          model={pickers.secondAdded}
          onSelect={(secondAddedTraitKey) =>
            setDraft(Object.freeze({ ...draft, secondAddedTraitKey }))
          }
          placeholder="Choose second Hammer"
          {...(draft.secondAddedTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(draft.secondAddedTraitKey) })}
        />
      </div>
      <EditorDialogFeedback name="Anvil feedback" />
      <EditorDialogDraftActions
        {...(onCancel === undefined ? {} : { onCancel })}
        onSave={() => {
          if (result !== undefined) onCommit(result);
        }}
        saveDisabled={result === undefined}
        saveName="Save Anvil result"
      />
    </>
  );
}

export function AnvilResultLauncher({
  interaction,
  owner,
}: {
  readonly interaction: AnvilInteraction;
  readonly owner: AcquisitionRoleAddress;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => {
    const target = state.editorSession.anvilDialogTarget ?? null;
    return target !== null && semanticAddressKey(target) === semanticAddressKey(owner);
  });
  const close = useCallback(() => dispatch(anvilResultDialogClosed()), [dispatch]);
  // The system closes a dialog whose context is lost; a later reach needs an explicit reopen.
  useEffect(() => {
    if (open && !interaction.contextReached) close();
  }, [close, interaction.contextReached, open]);
  const label =
    interaction.value === null
      ? 'Edit Anvil: Choose result'
      : `Edit Anvil: ${
          interaction.value.removedTraitKey === null
            ? 'No removal'
            : interaction.traitLabel(interaction.value.removedTraitKey)
        } → ${interaction.value.addedTraitKeys.map(interaction.traitLabel).join(', ')}`;
  const launcher = findingTarget(owner);
  return (
    <>
      <button
        {...launcher}
        className="trait-offer-launcher quiet-action action-compact"
        disabled={!interaction.contextReached || undefined}
        onClick={() => dispatch(anvilResultDialogOpened(owner))}
        title={interaction.contextReached ? undefined : candidateWaitingTitle}
        type="button"
      >
        {label}
      </button>
      {open && interaction.contextReached ? (
        <AnvilResultDialog interaction={interaction} launcherId={launcher.id} onClose={close} />
      ) : null}
    </>
  );
}
