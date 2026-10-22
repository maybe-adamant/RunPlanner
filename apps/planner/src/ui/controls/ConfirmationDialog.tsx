import type { ReactNode } from 'react';

import { ModalDialog } from './ModalDialog';

/** Asks before a destructive action, which is the dialog's danger button. */
export function ConfirmationDialog({
  children,
  confirmLabel,
  describedBy,
  id,
  onCancel,
  onConfirm,
  pending,
  title,
}: {
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly describedBy?: string;
  readonly id: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly pending: boolean;
  readonly title: string;
}) {
  return (
    <ModalDialog
      {...(describedBy === undefined ? {} : { describedBy })}
      labelledBy={id}
      onCancel={onCancel}
      pending={pending}
    >
      <header className="panel-heading">
        <h2 id={id}>{title}</h2>
      </header>
      {children}
      <footer className="game-publication-actions">
        <button className="quiet-action" disabled={pending} onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="danger-action" disabled={pending} onClick={onConfirm} type="button">
          {pending ? 'Please wait…' : confirmLabel}
        </button>
      </footer>
    </ModalDialog>
  );
}
