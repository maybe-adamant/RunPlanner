import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { roomMapAssetFor } from './roomMapAssets';
import { roomMapOverlayFor } from './HubMapAnnotations';
import { RoomMapViewport } from './RoomMapViewport';

export function RoomMapDialog({
  gameName,
  launcherRef,
  onClose,
  title,
}: {
  readonly gameName: string;
  readonly launcherRef: RefObject<HTMLButtonElement | null>;
  readonly onClose: () => void;
  readonly title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    const dialog = dialogRef.current;
    // A native modal keeps background controls inert until it leaves the top
    // layer. Release it before returning focus to the launcher.
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    onClose();
    const launcher = launcherRef.current;
    (launcher?.isConnected ? launcher : previousFocusRef.current)?.focus();
  }, [launcherRef, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLButtonElement>('[data-room-map-close]')?.focus();
    const cancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', cancel);
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('keydown', onKeyDown);
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [close]);

  return (
    <dialog
      aria-labelledby="room-map-dialog-title"
      aria-modal="true"
      className="room-map-dialog-backdrop"
      ref={dialogRef}
    >
      <section className="room-map-dialog">
        <header className="room-map-dialog-heading">
          <div>
            <p className="eyebrow">Room reference</p>
            <h2 id="room-map-dialog-title">{title} map</h2>
            <p className="room-map-game-name">{gameName}</p>
          </div>
          <button
            aria-label="Close map"
            className="quiet-action action-compact"
            data-room-map-close
            onClick={close}
            type="button"
          >
            Close
          </button>
        </header>
        <RoomMapViewport
          asset={roomMapAssetFor(gameName)}
          key={gameName}
          overlay={roomMapOverlayFor(gameName)}
          title={title}
        />
      </section>
    </dialog>
  );
}

/** A transient, host-local launcher for one static room reference. */
export function RoomMapLauncher({
  gameName,
  hostId,
  label = 'View Map',
  title,
}: {
  readonly gameName: string;
  /** Changes of the containing owner close an inherited inspection dialog. */
  readonly hostId: string;
  /** Dense room identities keep the accessible action name while using a short label. */
  readonly label?: string;
  readonly title: string;
}) {
  const launcherRef = useRef<HTMLButtonElement>(null);
  const previousHostIdRef = useRef(hostId);
  const [open, setOpen] = useState(false);
  const closeDialog = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (previousHostIdRef.current !== hostId) {
      previousHostIdRef.current = hostId;
      setOpen(false);
    }
  }, [hostId]);

  return (
    <>
      <button
        aria-label={`View map for ${title}`}
        className="room-map-launcher quiet-action action-compact"
        onClick={() => setOpen(true)}
        ref={launcherRef}
        type="button"
      >
        {label}
      </button>
      {open ? (
        <RoomMapDialog
          gameName={gameName}
          launcherRef={launcherRef}
          onClose={closeDialog}
          title={title}
        />
      ) : null}
    </>
  );
}
