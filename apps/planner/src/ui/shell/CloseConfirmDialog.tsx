import { useSyncExternalStore } from 'react';

import type { CloseRequestController } from '@planner/workspace/closeRequest';
import { ModalDialog } from '../controls/ModalDialog';

/** Asks whether to close while the open plan's latest edits could not be saved. */
export function CloseConfirmDialog({
  controller,
}: {
  readonly controller: CloseRequestController;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  if (state.kind !== 'confirming') return null;
  return (
    <ModalDialog
      describedBy="close-unsaved-message"
      labelledBy="close-unsaved-title"
      onCancel={() => controller.answer(false)}
    >
      <header className="panel-heading">
        <h2 id="close-unsaved-title">Not saved — close anyway?</h2>
      </header>
      <p className="game-publication-message" id="close-unsaved-message">
        {state.message}
      </p>
      <footer className="game-publication-actions">
        <button className="quiet-action" onClick={() => controller.answer(false)} type="button">
          Keep open
        </button>
        <button className="danger-action" onClick={() => controller.answer(true)} type="button">
          Close anyway
        </button>
      </footer>
    </ModalDialog>
  );
}
