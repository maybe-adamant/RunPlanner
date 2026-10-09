import {
  semanticAddressKey,
  type AcquisitionRoleAddress,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useState } from 'react';

import type {
  WorkspaceHexActivationBoard,
  WorkspaceHexActivationInteraction,
} from '@planner/projections/structured-workspace';
import {
  EditorDialog,
  EditorDialogDraftActions,
  EditorDialogFeedback,
} from '@planner/ui/controls/EditorDialog';
import {
  hexActivationDialogClosed,
  hexActivationDialogOpened,
} from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { HexBoard } from './HexBoard';
import { LauncherButton } from './LauncherButton';

const taken = new Set(['invested', 'selected']);

/** The plain tree at one Path screen; clicking a node adds or removes it from the draft. */
function HexActivationBoard({
  board,
  cleared,
  onSelect,
}: {
  readonly board: WorkspaceHexActivationBoard;
  /** Whether the draft is already empty. */
  readonly cleared: boolean;
  readonly onSelect: (selection: readonly string[]) => void;
}) {
  return (
    <div className="hex-tree-editor">
      <div className="hex-tree-toolbar">
        <p className="hex-activation-points">{board.pointsLabel}</p>
        {/* Clears nodes the board cannot show, such as a lost God Sent pair. */}
        <button
          className="quiet-action"
          disabled={cleared}
          onClick={() => onSelect([])}
          type="button"
        >
          Clear selection
        </button>
      </div>
      <HexBoard
        boardProps={{ 'aria-label': board.treeLabel }}
        linkProps={(from, to) => ({
          'data-taken': (taken.has(from.state) && taken.has(to.state)) || undefined,
          'data-olympian': to.kind.startsWith('olympian') || undefined,
        })}
        nodes={board.nodes}
        renderNode={(node, style) => {
          const common = {
            'data-kind': node.kind,
            'data-state': node.state,
            style,
          };
          const toggled = node.toggled;
          if (toggled === undefined)
            return (
              <span
                className="hex-tree-node"
                key={node.nodeKey}
                {...common}
                aria-disabled="true"
                aria-label={node.name}
                role="note"
                tabIndex={0}
                {...(node.hint === undefined ? {} : hintProps(node.hint))}
              >
                {node.talentLabel}
              </span>
            );
          return (
            <button
              className="hex-tree-node"
              data-has-findings={node.conflict}
              key={node.nodeKey}
              {...common}
              aria-label={node.name}
              aria-pressed={node.state === 'selected'}
              onClick={() => onSelect(toggled)}
              type="button"
            >
              {node.talentLabel}
            </button>
          );
        }}
      />
    </div>
  );
}

function HexActivationDialog({
  interaction,
  launcherId,
  onClose,
}: {
  readonly interaction: WorkspaceHexActivationInteraction;
  readonly launcherId: string;
  readonly onClose: () => void;
}) {
  const executeIntent = useCommandIntent();
  const saved = interaction.selectedNodeKeys;
  const [draft, setDraft] = useState<readonly string[]>(saved ?? []);
  const board = interaction.boardFor(draft);
  return (
    <EditorDialog
      eyebrow="Path of Stars"
      feedback={
        <EditorDialogFeedback entries={board?.issues ?? []} name="Path of Stars feedback" />
      }
      footer={
        <EditorDialogDraftActions
          onCancel={onClose}
          onSave={() => {
            // The selection is a set; an empty draft still settles an unsaved screen.
            if (
              saved === undefined ||
              saved.length !== draft.length ||
              draft.some((key) => !saved.includes(key))
            )
              executeIntent(interaction.intentFor(draft));
            onClose();
          }}
          saveDisabled={board === undefined}
          saveName="Save Path of Stars nodes"
        />
      }
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={launcherId}
      size="hexTree"
      title="Choose Path of Stars nodes"
    >
      {board === undefined ? null : (
        <HexActivationBoard board={board} cleared={draft.length === 0} onSelect={setDraft} />
      )}
    </EditorDialog>
  );
}

/** The Path screen launcher beside its acquisition's other editors. */
export function HexActivationLauncher({
  interaction,
  owner,
}: {
  readonly interaction: WorkspaceHexActivationInteraction;
  readonly owner: AcquisitionRoleAddress;
}) {
  const findingMark = useFindingMark();
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => {
    const target = state.editorSession.hexActivationDialogTarget ?? null;
    return target !== null && semanticAddressKey(target) === semanticAddressKey(owner);
  });
  const close = useCallback(() => dispatch(hexActivationDialogClosed()), [dispatch]);
  // The system closes a dialog whose context is lost; a later reach needs an explicit reopen.
  useEffect(() => {
    if (open && !interaction.contextReached) close();
  }, [close, interaction.contextReached, open]);
  const id = `${semanticOwnerControlElementId(owner)}-hex-activation`;
  return (
    <>
      <LauncherButton
        contextReached={interaction.contextReached}
        launcher={interaction.launcher}
        onClick={() => dispatch(hexActivationDialogOpened(owner))}
        target={{ ...findingMark(owner, 'hexActivation'), id }}
      />
      {open && interaction.contextReached ? (
        <HexActivationDialog
          interaction={interaction}
          // A changed saved selection replaces the draft.
          key={JSON.stringify(interaction.selectedNodeKeys ?? null)}
          launcherId={id}
          onClose={close}
        />
      ) : null}
    </>
  );
}
