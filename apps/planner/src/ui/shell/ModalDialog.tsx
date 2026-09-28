import { useEffect, useRef, type ReactNode } from 'react';

/** A native modal dialog; Escape cancels unless an action is pending. */
export function ModalDialog({
  children,
  wide = true,
  describedBy,
  labelledBy,
  onCancel,
  pending,
}: {
  readonly children: ReactNode;
  /** The Game panel's width; otherwise the base dialog width. */
  readonly wide?: boolean;
  readonly describedBy?: string;
  readonly labelledBy: string;
  readonly onCancel: () => void;
  readonly pending: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
  }, []);

  return (
    <dialog
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="game-publication-dialog-backdrop"
      onCancel={(event) => {
        event.preventDefault();
        // A nested dialog's Escape must not also cancel the dialog around it.
        event.stopPropagation();
        if (!pending) onCancel();
      }}
      ref={dialogRef}
    >
      <section
        className={wide ? 'game-publication-dialog game-panel-dialog' : 'game-publication-dialog'}
      >
        {children}
      </section>
    </dialog>
  );
}
