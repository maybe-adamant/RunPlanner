import type { ReleaseUpdateState } from '../persistence/releaseUpdates';

/** Whether the update notice shows; it takes the notice area before any event notice. */
export function releaseUpdateNoticeShown(state: ReleaseUpdateState): boolean {
  return (
    state.kind === 'available' ||
    state.kind === 'confirming' ||
    state.kind === 'saving' ||
    state.kind === 'installing' ||
    state.kind === 'installFailed'
  );
}
