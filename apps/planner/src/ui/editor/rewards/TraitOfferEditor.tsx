import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceTraitOfferInteraction,
  type WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed, traitOfferDialogOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { EditorDialog } from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { TraitOfferEditorShell } from './TraitOfferEditorShell';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function launcherId(address: TraitOfferAddress): string {
  return `trait-launcher-${semanticAddressKey(address)}`;
}

function traitOfferRevision(interaction: WorkspaceTraitOfferInteraction): string {
  return `${interaction.giver.key}|${draftValueIdentity(interaction.value)}`;
}

export function TraitOfferLauncher({
  control,
  interactions,
}: {
  readonly control: WorkspaceTraitOfferControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(control.address),
  );
  const selectedOptionIndex =
    control.offer?.kind === 'traits' ? OPTION_KEYS.indexOf(control.offer.selectedOptionKey) : -1;
  const selected =
    control.offer?.kind === 'traits' ? control.offer.options[selectedOptionIndex] : undefined;
  const traitLabel =
    control.offer === null
      ? control.giver.providerKind === 'chaos'
        ? 'Choose Chaos outcome'
        : 'Choose Trait'
      : control.offer.kind === 'chaos'
        ? (interaction.chaos?.blessingLabel(control.offer.blessingKey) ?? control.offer.blessingKey)
        : control.offer.kind === 'fallbackGold'
          ? 'Fallback Gold'
          : selected === undefined
            ? control.giver.providerKind === 'chaos'
              ? 'Choose Chaos outcome'
              : 'Choose Trait'
            : (interaction.choices.find((choice) => choice.value === selected.traitKey)?.label ??
              selected.traitKey);
  const status = control.status;
  const spellOffer = interaction.giver.providerKind === 'spell';
  const label = spellOffer
    ? selected === undefined
      ? 'Edit Spell - Choose Spell'
      : `Edit Spell - ${traitLabel}`
    : control.offer === null
      ? traitLabel
      : control.giver.providerKind === 'chaos'
        ? `Edit Chaos outcome - ${traitLabel}`
        : `Edit Trait · ${traitLabel}`;
  const statusLabel =
    status === 'unspecified'
      ? `${spellOffer ? 'spell' : 'trait'} is not selected`
      : status === 'invalid'
        ? `${spellOffer ? 'spell' : 'trait'} offer needs attention`
        : `${spellOffer ? 'spell' : 'trait'} configuration has no findings`;
  return (
    <button
      {...findingTarget(control.address, launcherId(control.address))}
      aria-label={`${label}; ${statusLabel}`}
      className="trait-offer-launcher quiet-action action-compact"
      data-trait-status={status}
      disabled={!interaction.contextReached || undefined}
      id={launcherId(control.address)}
      onClick={() => dispatch(traitOfferDialogOpened(control.address))}
      title={interaction.contextReached ? undefined : 'Waits on an earlier choice'}
      type="button"
    >
      {label}
    </button>
  );
}

export function TraitOfferEditor({
  address,
  initialView = 'outer',
  interactions,
  onCancel,
  onCommit,
  onReset,
}: {
  readonly address: TraitOfferAddress;
  readonly initialView?: 'outer' | 'echoLastRunBoon';
  readonly interactions: WorkspaceInteractionCatalog;
  /** Discards the draft; absent outside a dialog. */
  readonly onCancel?: () => void;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
  readonly onReset?: () => void;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(address),
  );
  const initialValue =
    interaction.value ??
    interaction.chaos?.startingDraft() ??
    interaction.traitOfferStartingOutcome?.();
  if (initialValue === undefined)
    throw new Error(`${workspaceInteractionKey(address)} opened before its context was reached`);
  return (
    <TraitOfferEditorShell
      initialValue={initialValue}
      initialView={initialView}
      interaction={interaction}
      key={traitOfferRevision(interaction)}
      {...(onCancel === undefined ? {} : { onCancel })}
      {...(onCommit === undefined ? {} : { onCommit })}
      {...(onReset === undefined ? {} : { onReset })}
    />
  );
}

export function TraitOfferDialog({
  interactions,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: TraitOfferAddress;
}) {
  const findingAnchor = useFindingAnchor();
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const focusedSemanticOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  // A stale target may name an offer that is no longer projected.
  const interaction = interactions.traitOffers.get(workspaceInteractionKey(target));
  const unavailable = interaction === undefined || !interaction.contextReached;
  const close = useCallback((): void => {
    dispatch(traitOfferDialogClosed());
  }, [dispatch]);
  // Every entry point shares this guard: an unreached offer has no editor.
  // The system closes a dialog whose context is lost; a later reach needs an explicit reopen.
  useEffect(() => {
    if (unavailable) dispatch(traitOfferDialogClosed());
  }, [dispatch, unavailable]);
  if (unavailable) return null;
  const exactChild =
    (focusedSemanticOwner?.kind === 'allTogetherSet' ||
      focusedSemanticOwner?.kind === 'traitAcquisitionTarget' ||
      focusedSemanticOwner?.kind === 'circeResolution' ||
      focusedSemanticOwner?.kind === 'echoPomTarget' ||
      focusedSemanticOwner?.kind === 'echoLastRunBoon' ||
      focusedSemanticOwner?.kind === 'naturalSelectionResult') &&
    semanticAddressKey(focusedSemanticOwner.trait) === semanticAddressKey(target)
      ? focusedSemanticOwner
      : undefined;
  return (
    <EditorDialog
      // The feedback region lists the dialog's findings; its launcher carries the mark.
      anchorProps={{ ...findingAnchor(target), tabIndex: -1 }}
      eyebrow="Trait offer"
      {...(exactChild === undefined
        ? {}
        : { initialFocusId: semanticOwnerControlElementId(exactChild) })}
      model={{ kind: 'draft', onCancel: close }}
      returnFocusId={launcherId(target)}
      title={interaction.giver.label}
    >
      <TraitOfferEditor
        address={target}
        initialView={exactChild?.kind === 'echoLastRunBoon' ? 'echoLastRunBoon' : 'outer'}
        interactions={interactions}
        key={`${semanticAddressKey(target)}:${traitOfferRevision(interaction)}`}
        onCancel={close}
        onCommit={(value) => {
          executeIntent(interaction.intentFor(value));
          close();
        }}
        {...(interaction.resetIntent === undefined
          ? {}
          : {
              onReset: () => {
                executeIntent(interaction.resetIntent!);
                close();
              },
            })}
      />
    </EditorDialog>
  );
}
