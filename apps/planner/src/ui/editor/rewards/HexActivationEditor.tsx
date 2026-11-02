import {
  semanticAddressKey,
  type AcquisitionRoleAddress,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  WorkspaceHexActivationBoard,
  WorkspaceHexActivationInteraction,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { hexNodeArtwork } from '@planner/ui/artwork/hex-nodes/hexNodeArtwork';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import {
  EditorDialog,
  EditorDialogDraftActions,
  EditorDialogTitleAction,
} from '@planner/ui/controls/EditorDialog';
import { introducesIssue } from '@planner/ui/controls/introducesIssue';
import {
  hexActivationDialogClosed,
  hexActivationDialogOpened,
} from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { hintProps } from '@planner/ui/controls/hint';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { HexBoard } from './HexBoard';
import { LauncherButton } from './LauncherButton';

const taken = new Set(['invested', 'selected']);

/** The plain tree at one Path screen; clicking a node adds or removes it from the draft. */
function HexActivationBoard({
  board,
  onSelect,
}: {
  readonly board: WorkspaceHexActivationBoard;
  readonly onSelect: (selection: readonly string[]) => void;
}) {
  return (
    <div className="hex-tree-editor">
      <EditorDialogTitleAction>
        <span className="hex-activation-points">{board.pointsLabel}</span>
      </EditorDialogTitleAction>
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
                <ArtworkIcon
                  className="hex-tree-node-icon"
                  source={hexNodeArtwork[node.talentKey] ?? undefined}
                />
                <span className="hex-tree-node-label" onMouseEnter={showTruncatedTitle}>
                  {node.talentLabel}
                </span>
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
              <ArtworkIcon
                className="hex-tree-node-icon"
                source={hexNodeArtwork[node.talentKey] ?? undefined}
              />
              <span className="hex-tree-node-label" onMouseEnter={showTruncatedTitle}>
                {node.talentLabel}
              </span>
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
  const savedIssues = useMemo(
    () => interaction.boardFor(saved ?? [])?.issues ?? [],
    [interaction, saved],
  );
  // The selection is a set; an unsaved screen is never at rest.
  const atRest =
    saved !== undefined &&
    saved.length === draft.length &&
    draft.every((key) => saved.includes(key));
  const issues = board?.issues ?? [];
  return (
    <EditorDialog
      icon={<ArtworkIcon className="artwork-label-icon" source={rewardIcon('TalentDrop')} />}
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={launcherId}
      size="hexTree"
      title="Choose Path of Stars nodes"
    >
      <EditorDialogDraftActions
        issues={issues}
        onCancel={onClose}
        // Reset also clears nodes the board cannot show, such as a lost God Sent pair.
        onReset={() => setDraft([])}
        onSave={() => {
          executeIntent(interaction.intentFor(draft));
          onClose();
        }}
        // A wrong point count is incomplete; any other issue blocks only when this draft introduced it.
        saveDisabled={
          atRest ||
          board === undefined ||
          issues.some(([key]) => key === 'selectionCount') ||
          introducesIssue(issues, savedIssues)
        }
        resetDisabled={draft.length === 0}
        saveName="Save Path of Stars nodes"
      />
      {board === undefined ? null : <HexActivationBoard board={board} onSelect={setDraft} />}
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
