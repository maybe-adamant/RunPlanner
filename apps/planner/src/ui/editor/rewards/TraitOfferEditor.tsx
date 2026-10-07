import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useRef } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceTraitOfferInteraction,
  type WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed, traitOfferDialogOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { TraitOfferEditorShell } from './TraitOfferEditorShell';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function launcherId(address: TraitOfferAddress): string {
  return `trait-launcher-${semanticAddressKey(address)}`;
}

function traitOfferRevision(interaction: WorkspaceTraitOfferInteraction): string {
  return `${interaction.giver.key}|${JSON.stringify(interaction.value)}`;
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
  onChildCommit,
  onCommit,
  onReset,
}: {
  readonly address: TraitOfferAddress;
  readonly initialView?: 'outer' | 'echoLastRunBoon';
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onChildCommit?: (value: AuthoredTraitOffer) => void;
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
      {...(onChildCommit === undefined ? {} : { onChildCommit })}
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // A stale target may name an offer that is no longer projected.
  const interaction = interactions.traitOffers.get(workspaceInteractionKey(target));
  const unavailable = interaction === undefined || !interaction.contextReached;
  const close = useCallback((): void => {
    dispatch(traitOfferDialogClosed());
    const launcher = document.getElementById(launcherId(target));
    (launcher ?? previousFocusRef.current)?.focus();
  }, [dispatch, target]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const inertSiblings: HTMLElement[] = [];
    const parent = dialog.parentElement;
    const supportsModal = typeof dialog.showModal === 'function';
    if (!supportsModal && parent !== null) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === dialog || !(sibling instanceof HTMLElement)) continue;
        inertSiblings.push(sibling);
        (sibling as HTMLElement & { inert: boolean }).inert = true;
      }
    }

    if (supportsModal && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // A test DOM may expose showModal without implementing the top layer.
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }

    const exactControl =
      (focusedSemanticOwner?.kind === 'allTogetherSet' ||
        focusedSemanticOwner?.kind === 'traitAcquisitionTarget' ||
        focusedSemanticOwner?.kind === 'circeResolution' ||
        focusedSemanticOwner?.kind === 'echoPomTarget' ||
        focusedSemanticOwner?.kind === 'echoLastRunBoon' ||
        focusedSemanticOwner?.kind === 'naturalSelectionResult') &&
      semanticAddressKey(focusedSemanticOwner.trait) === semanticAddressKey(target)
        ? document.getElementById(semanticOwnerControlElementId(focusedSemanticOwner))
        : null;
    const first = dialog.querySelector<HTMLElement>('select, input, button');
    (exactControl instanceof HTMLElement && dialog.contains(exactControl)
      ? exactControl
      : first
    )?.focus();
    const onCancel = (event: Event): void => {
      event.preventDefault();
      close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      // Native modal dialogs emit `cancel`; this local fallback only covers
      // DOMs that cannot implement the dialog top layer (for example jsdom).
      // A nested picker handles its own Escape first and prevents the default;
      // preserve the in-progress local draft until a later Escape reaches us.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('keydown', onKeyDown);
      for (const sibling of inertSiblings) {
        (sibling as HTMLElement & { inert: boolean }).inert = false;
      }
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [close, focusedSemanticOwner, target]);
  // Every entry point shares this guard: an unreached offer has no editor.
  // The system closes a dialog whose context is lost; a later reach needs an explicit reopen.
  useEffect(() => {
    if (unavailable) dispatch(traitOfferDialogClosed());
  }, [dispatch, unavailable]);
  if (unavailable) return null;
  return (
    <dialog
      aria-labelledby={`trait-offer-dialog-title-${semanticAddressKey(target)}`}
      aria-modal="true"
      className="trait-offer-dialog-backdrop"
      ref={dialogRef}
    >
      {/* The feedback region lists the dialog's findings; its launcher carries the mark. */}
      <div className="trait-offer-dialog" {...findingAnchor(target)} tabIndex={-1}>
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Trait offer</p>
            <h2 id={`trait-offer-dialog-title-${semanticAddressKey(target)}`}>
              {interaction.giver.label}
            </h2>
          </div>
          <div className="panel-heading-actions">
            <button
              aria-label="Close trait offer"
              className="quiet-action"
              onClick={close}
              type="button"
            >
              Close
            </button>
          </div>
        </header>
        <TraitOfferEditor
          address={target}
          initialView={
            focusedSemanticOwner?.kind === 'echoLastRunBoon' &&
            semanticAddressKey(focusedSemanticOwner.trait) === semanticAddressKey(target)
              ? 'echoLastRunBoon'
              : 'outer'
          }
          interactions={interactions}
          key={`${semanticAddressKey(target)}:${traitOfferRevision(interaction)}`}
          onCommit={(value) => {
            executeIntent(interaction.intentFor(value));
            close();
          }}
          onChildCommit={(value) => {
            executeIntent(interaction.intentFor(value));
            dispatch(traitOfferDialogOpened(target));
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
      </div>
    </dialog>
  );
}
