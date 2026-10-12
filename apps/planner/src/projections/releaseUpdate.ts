import type { ReleaseUpdateState } from '../persistence/releaseUpdates';
import type { ProfileStatus } from '@planner/state/store';

import { gameSaveState } from './gamePanel';

export type UpdateInstallLabel = 'Install and restart' | 'Save and install' | 'Save and install…';

/** The update confirmation's primary action, from the same save facts that gate sending. */
export function updateInstallLabel(
  projectOpen: boolean,
  profileStatus: ProfileStatus,
  fileName: string | null,
): UpdateInstallLabel {
  if (!projectOpen) return 'Install and restart';
  switch (gameSaveState(profileStatus, fileName)) {
    case 'clean':
      return 'Install and restart';
    case 'dirty':
      return 'Save and install';
    case 'unsaved':
      return 'Save and install…';
  }
}

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
