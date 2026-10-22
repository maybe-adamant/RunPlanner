import { useEffect } from 'react';

import {
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  selectCanRedoProject,
  selectCanUndoProject,
  useAppDispatch,
  useAppSelector,
} from '@planner/state/store';
import { projectHistoryShortcut } from './projectHistoryShortcuts';
import { ActionIcon } from '../controls/ActionIcon';
import { hintProps } from '@planner/ui/controls/hint';

export function ProjectHistoryControls({ hasProject = true }: { readonly hasProject?: boolean }) {
  const canUndo = useAppSelector(selectCanUndoProject);
  const canRedo = useAppSelector(selectCanRedoProject);
  // History shortcuts wait while a dialog holds an unsaved draft.
  const draftOpen = useAppSelector((state) => state.editorSession.openDraftEditors > 0);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (draftOpen) return;
      const shortcut = projectHistoryShortcut(event);
      if (shortcut === 'undo' && canUndo) {
        event.preventDefault();
        dispatch(authoredProjectUndoRequested());
      } else if (shortcut === 'redo' && canRedo) {
        event.preventDefault();
        dispatch(authoredProjectRedoRequested());
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, dispatch, draftOpen]);

  if (!hasProject) return null;
  return (
    <div aria-label="Project history" className="history-controls" role="group">
      <button
        aria-keyshortcuts="Control+Z Meta+Z"
        aria-label="Undo"
        className="quiet-action action-compact icon-action"
        disabled={!canUndo}
        onClick={() => dispatch(authoredProjectUndoRequested())}
        {...hintProps('Undo (Ctrl/Cmd+Z)')}
        type="button"
      >
        <ActionIcon name="undo" />
      </button>
      <button
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        aria-label="Redo"
        className="quiet-action action-compact icon-action"
        disabled={!canRedo}
        onClick={() => dispatch(authoredProjectRedoRequested())}
        {...hintProps('Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)')}
        type="button"
      >
        <ActionIcon name="redo" />
      </button>
    </div>
  );
}
