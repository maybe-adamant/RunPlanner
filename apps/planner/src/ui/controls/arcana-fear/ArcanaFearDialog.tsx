import { useEffect, useId, useRef, type ReactNode } from 'react';

export function ArcanaFearDialog({
  title,
  kind,
  onClose,
  onSave,
  onReset,
  saveDisabled = false,
  children,
}: {
  readonly title: string;
  readonly kind: 'arcana' | 'fear';
  readonly onClose: () => void;
  readonly onSave?: () => void;
  readonly onReset?: () => void;
  readonly saveDisabled?: boolean;
  readonly children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeRef.current?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={`arcana-fear-dialog${kind === 'arcana' ? ' arcana-grid-dialog' : ''}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="arcana-fear-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <div className="arcana-fear-dialog-actions">
          {onReset === undefined ? null : (
            <button className="danger-action" type="button" onClick={onReset}>
              Reset
            </button>
          )}
          {onSave === undefined ? null : (
            <button
              className="primary-action"
              type="button"
              disabled={saveDisabled}
              onClick={() => {
                onSave();
                onClose();
              }}
            >
              Save
            </button>
          )}
          <button
            ref={closeRef}
            className="quiet-action"
            aria-label={`Close ${title}`}
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </header>
      <div className="arcana-fear-dialog-content">{children}</div>
    </dialog>
  );
}
