import { useEffect, useMemo, useRef, useState } from 'react';

import type { WorkspaceAspectHexTreeControl } from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { EditorDialog, EditorDialogDraftActions } from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { introducesIssue } from '@planner/ui/controls/introducesIssue';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
} from '@planner/ui/controls/useWorkspaceInteraction';
import { HexTreeBoard, HexTreeLayoutPicker } from './HexTreeBoard';

/** Aspect of Selene's Sky Fall tree, edited as one draft that Save commits. */
export function AspectHexTreeDialog({
  control,
  onClose,
  returnFocusId,
}: {
  readonly control: WorkspaceAspectHexTreeControl;
  readonly onClose: () => void;
  readonly returnFocusId: string;
}) {
  const executeIntent = useCommandIntent();
  // A changed saved tree replaces the draft; a changed context keeps it.
  const valueIdentity = draftValueIdentity(control.value);
  const [draftState, setDraftState] = useState(() => ({
    identity: valueIdentity,
    tree: control.value,
  }));
  const draft = draftState.identity === valueIdentity ? draftState.tree : control.value;
  const setDraft = (tree: typeof control.value): void =>
    setDraftState({ identity: valueIdentity, tree });
  const atRest = draftValueIdentity(draft) === valueIdentity;
  const saved = useWorkspaceInteraction(control);
  const activateSaved = saved.activate;
  useEffect(() => {
    activateSaved();
  }, [activateSaved]);
  const draftLoadable = useMemo(
    () => (atRest ? undefined : control.forDraft(draft)),
    [atRest, control, draft],
  );
  const drafted = useOptionalWorkspaceInteraction(draftLoadable);
  const activateDrafted = drafted.activate;
  useEffect(() => {
    activateDrafted();
    // Activation follows the projected draft, not each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoadable]);
  const domain = atRest ? saved.result : drafted.result;
  const issues = domain?.treeIssues ?? [];
  // The layout on the title line takes focus once the tree loads.
  const layoutFocused = useRef(false);
  const loaded = domain !== undefined;
  useEffect(() => {
    if (!loaded || layoutFocused.current) return;
    layoutFocused.current = true;
    document.getElementById(`${semanticOwnerControlElementId(control.address)}-layout`)?.focus();
  }, [control.address, loaded]);
  return (
    <EditorDialog
      icon={<ArtworkIcon className="artwork-label-icon" source={traitIcon('SpellMoonBeamTrait')} />}
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={returnFocusId}
      size="hexTree"
      title="Sky Fall Hex tree"
      {...(domain === undefined
        ? {}
        : {
            titleExtra: (
              <>
                <HexTreeLayoutPicker
                  domain={domain}
                  onEdit={(edit) => setDraft(domain.edit(edit))}
                />
              </>
            ),
          })}
    >
      <EditorDialogDraftActions
        issues={issues}
        onCancel={onClose}
        // Reset restores the chosen layout's default tree.
        onReset={() => {
          if (domain !== undefined) setDraft(domain.edit({ kind: 'reset' }));
        }}
        onSave={() => {
          executeIntent(control.intentFor(draft));
          onClose();
        }}
        resetDisabled={domain === undefined}
        // Save waits for both trees to load; a conflict this draft introduced blocks it,
        // inherited conflicts do not.
        saveDisabled={
          atRest ||
          domain === undefined ||
          saved.result === undefined ||
          introducesIssue(issues, saved.result.treeIssues)
        }
      />
      {domain === undefined ? (
        <p>Loading Hex tree…</p>
      ) : (
        <HexTreeBoard domain={domain} onEdit={(edit) => setDraft(domain.edit(edit))} />
      )}
    </EditorDialog>
  );
}
