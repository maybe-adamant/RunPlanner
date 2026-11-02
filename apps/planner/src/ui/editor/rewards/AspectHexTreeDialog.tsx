import { useEffect, useMemo, useState } from 'react';

import type { WorkspaceAspectHexTreeControl } from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { EditorDialog, EditorDialogDraftActions } from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { introducesIssue } from '@planner/ui/controls/introducesIssue';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
} from '@planner/ui/controls/useWorkspaceInteraction';
import { HexTreeBoard } from './HexTreeBoard';

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
  const [draft, setDraft] = useState(control.value);
  const atRest = draftValueIdentity(draft) === draftValueIdentity(control.value);
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
  return (
    <EditorDialog
      icon={<ArtworkIcon className="artwork-label-icon" source={traitIcon('SpellMoonBeamTrait')} />}
      layout="header"
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={returnFocusId}
      size="hexTree"
      title="Sky Fall Hex tree"
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
        // A conflict this draft introduced blocks Save; inherited conflicts do not.
        saveDisabled={
          atRest || domain === undefined || introducesIssue(issues, saved.result?.treeIssues ?? [])
        }
      />
      {domain === undefined ? (
        <p>Loading Hex tree…</p>
      ) : (
        <HexTreeBoard
          domain={domain}
          onEdit={(edit) => setDraft(domain.edit(edit))}
          resettable={false}
        />
      )}
    </EditorDialog>
  );
}
