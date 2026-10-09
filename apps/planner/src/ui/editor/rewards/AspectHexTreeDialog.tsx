import { useEffect, useMemo, useState } from 'react';

import type { WorkspaceAspectHexTreeControl } from '@planner/projections/structured-workspace';
import {
  EditorDialog,
  EditorDialogDraftActions,
  EditorDialogFeedback,
} from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { HexTreeBoard } from './HexTreeBoard';
import { HexTreeRulesHelp } from './HexTreeRulesHelp';

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
  const loadable = useMemo(
    () => (atRest ? control : control.forDraft(draft)),
    [atRest, control, draft],
  );
  const { activate, result: domain } = useWorkspaceInteraction(loadable);
  useEffect(() => {
    activate();
    // Activation follows the projected draft, not each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
  // The region names the board's conflicts by talent, saved or drafted alike.
  const entries = domain?.treeIssue === undefined ? [] : [['hex-tree', domain.treeIssue] as const];
  return (
    <EditorDialog
      eyebrow="Loadout"
      feedback={<EditorDialogFeedback entries={entries} name="Hex tree feedback" />}
      footer={
        <EditorDialogDraftActions
          onCancel={onClose}
          onSave={() => {
            if (!atRest) executeIntent(control.intentFor(draft));
            onClose();
          }}
          saveDisabled={domain === undefined}
        />
      }
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={returnFocusId}
      size="hexTree"
      headerAction={<HexTreeRulesHelp />}
      title="Sky Fall Hex tree"
    >
      {domain === undefined ? (
        <p>Loading Hex tree…</p>
      ) : (
        <HexTreeBoard domain={domain} onEdit={(edit) => setDraft(domain.edit(edit))} />
      )}
    </EditorDialog>
  );
}
