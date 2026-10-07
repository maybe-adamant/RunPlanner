import { useEffect, useRef, type ReactNode } from 'react';

import type { FindingAnchorProps } from '@planner/ui/feedback/useFindingTarget';

/** Attributes a finding anchor or focus target places on the dialog surface. */
export type ModalSurfaceProps = Partial<FindingAnchorProps> & { readonly tabIndex?: number };

/**
 * A native modal dialog. Escape cancels unless an action is pending; on unmount
 * the dialog leaves the top layer before focus returns to its launcher or opener.
 */
export function ModalDialog({
  backdropClassName = 'game-publication-dialog-backdrop',
  children,
  className,
  describedBy,
  labelledBy,
  onCancel,
  pending = false,
  returnFocusId,
  surfaceProps,
}: {
  readonly backdropClassName?: string;
  readonly children: ReactNode;
  /** The surface classes; defaults to the Game panel's width. */
  readonly className?: string;
  readonly describedBy?: string;
  readonly labelledBy: string;
  readonly onCancel: () => void;
  readonly pending?: boolean;
  /** The launcher that regains focus on close; the opener otherwise. */
  readonly returnFocusId?: string;
  readonly surfaceProps?: ModalSurfaceProps;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef(onCancel);
  const pendingRef = useRef(pending);
  const returnFocusIdRef = useRef(returnFocusId);
  useEffect(() => {
    cancelRef.current = onCancel;
    pendingRef.current = pending;
    returnFocusIdRef.current = returnFocusId;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Without a top layer, siblings are made inert so the dialog stays modal.
    const inertSiblings: HTMLElement[] = [];
    if (typeof dialog.showModal !== 'function' && dialog.parentElement !== null) {
      for (const sibling of Array.from(dialog.parentElement.children)) {
        if (sibling === dialog || !(sibling instanceof HTMLElement) || sibling.inert) continue;
        sibling.inert = true;
        inertSiblings.push(sibling);
      }
    }
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // A test DOM may expose showModal without implementing the top layer.
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    const cancel = (event: Event): void => {
      event.preventDefault();
      // A nested dialog's Escape must not also cancel the dialog around it.
      event.stopPropagation();
      if (!pendingRef.current) cancelRef.current();
    };
    // Native modals emit `cancel`; this covers DOMs without a top layer. A nested
    // picker that handles its own Escape prevents the default first.
    const keyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      cancel(event);
    };
    dialog.addEventListener('cancel', cancel);
    dialog.addEventListener('keydown', keyDown);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('keydown', keyDown);
      // Background controls stay inert until the dialog leaves the top layer.
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.removeAttribute('open');
      for (const sibling of inertSiblings) sibling.inert = false;
      // Focus returns only when it was lost with the dialog, never over a deliberate move.
      const active = document.activeElement;
      if (active !== null && active !== document.body && !dialog.contains(active)) return;
      const id = returnFocusIdRef.current;
      const launcher = id === undefined ? null : document.getElementById(id);
      (launcher?.isConnected ? launcher : opener?.isConnected ? opener : null)?.focus();
    };
  }, []);

  return (
    <dialog
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={backdropClassName}
      ref={dialogRef}
    >
      <section
        {...surfaceProps}
        className={className ?? 'game-publication-dialog game-panel-dialog'}
      >
        {children}
      </section>
    </dialog>
  );
}
