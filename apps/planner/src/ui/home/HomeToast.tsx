import { useEffect, useRef } from 'react';

/** How long a notice stays before it dismisses itself. */
const NOTICE_MS = 8_000;

/**
 * A floating notice at the bottom of Home with one optional action. It dismisses itself after
 * a few seconds unless `lasting`; give each new notice its own `key` to restart the timer.
 */
export function HomeToast({
  action,
  lasting = false,
  onDismiss,
  text,
}: {
  readonly text: string;
  readonly action?: { readonly label: string; readonly run: () => void };
  /** Stays until dismissed, for a notice with a problem to read. */
  readonly lasting?: boolean;
  readonly onDismiss: () => void;
}) {
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    if (lasting) return;
    const timer = window.setTimeout(() => dismiss.current(), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [lasting]);
  return (
    <div className="home-toast" role="status">
      <span>{text}</span>
      {action === undefined ? null : (
        <button className="secondary-action action-compact" onClick={action.run} type="button">
          {action.label}
        </button>
      )}
      {lasting ? (
        <button className="quiet-action action-compact" onClick={onDismiss} type="button">
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
