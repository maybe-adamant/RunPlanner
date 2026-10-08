import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { useCallback, useEffect, type ReactNode } from 'react';

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
import {
  DialogFindingScope,
  useFindingAnchor,
  useFindingTarget,
} from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { LauncherButton } from './LauncherButton';
import { TraitOfferEditorShell } from './TraitOfferEditorShell';

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
  return (
    <LauncherButton
      contextReached={interaction.contextReached}
      launcher={interaction.launcher}
      onClick={() => dispatch(traitOfferDialogOpened(control.address))}
      target={findingTarget(control.address, launcherId(control.address))}
    />
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
  findings,
  interactions,
  target,
}: {
  /** The dialog's own marks, keyed by each finding's owner control. */
  readonly findings?: ReadonlyMap<string, readonly SemanticFinding[]>;
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
      <DialogFindings findings={findings}>
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
      </DialogFindings>
    </EditorDialog>
  );
}

function DialogFindings({
  children,
  findings,
}: {
  readonly children: ReactNode;
  readonly findings: ReadonlyMap<string, readonly SemanticFinding[]> | undefined;
}) {
  return findings === undefined ? (
    children
  ) : (
    <DialogFindingScope findings={findings}>{children}</DialogFindingScope>
  );
}
