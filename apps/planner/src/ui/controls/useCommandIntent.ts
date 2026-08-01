import { useCallback } from 'react';

import type { WorkspaceCommandIntent } from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, type AppDispatch } from '@planner/state/store';

/** Dispatch one complete interaction intent in its explicitly declared order. */
export function dispatchCommandIntent(dispatch: AppDispatch, intent: WorkspaceCommandIntent): void {
  if (intent.focus?.timing === 'before') {
    dispatch(semanticOwnerFocused(intent.focus.owner));
  }
  dispatch(authoredProjectCommandDispatched(intent.command));
  if (intent.focus?.timing === 'after') {
    dispatch(semanticOwnerFocused(intent.focus.owner));
  }
}

export function useCommandIntent(): (intent: WorkspaceCommandIntent) => void {
  const dispatch = useAppDispatch();
  return useCallback((intent) => dispatchCommandIntent(dispatch, intent), [dispatch]);
}
