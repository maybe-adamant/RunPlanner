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

export function ProjectHistoryControls() {
  const canUndo = useAppSelector(selectCanUndoProject);
  const canRedo = useAppSelector(selectCanRedoProject);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [canRedo, canUndo, dispatch]);

  return (
    <div aria-label="Project history" className="history-controls" role="group">
      <button
        aria-keyshortcuts="Control+Z Meta+Z"
        className="quiet-action action-compact"
        disabled={!canUndo}
        onClick={() => dispatch(authoredProjectUndoRequested())}
        title="Undo project edit (Ctrl/Cmd+Z)"
        type="button"
      >
        Undo
      </button>
      <button
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        className="quiet-action action-compact"
        disabled={!canRedo}
        onClick={() => dispatch(authoredProjectRedoRequested())}
        title="Redo project edit (Ctrl/Cmd+Shift+Z or Ctrl+Y)"
        type="button"
      >
        Redo
      </button>
    </div>
  );
}
