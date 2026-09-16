import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { roomMapAssetFor, type RoomMapAsset } from './roomMapAssets';

const minimumZoom = 50;
const maximumZoom = 200;
const zoomStep = 25;

function RoomMapViewport({
  asset,
  title,
}: {
  readonly asset: RoomMapAsset | undefined;
  readonly title: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSize, setImageSize] = useState<{ readonly height: number; readonly width: number }>();
  const [viewportSize, setViewportSize] = useState<{
    readonly height: number;
    readonly width: number;
  }>();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll === null) return;
    const measure = () =>
      setViewportSize({ height: scroll.clientHeight, width: scroll.clientWidth });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, []);

  const fittedScale =
    imageSize === undefined ||
    viewportSize === undefined ||
    viewportSize.width === 0 ||
    viewportSize.height === 0
      ? undefined
      : Math.min(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height);
  const displayedImageStyle =
    fittedScale === undefined || imageSize === undefined
      ? undefined
      : {
          height: `${Math.round(imageSize.height * fittedScale * (zoom / 100))}px`,
          width: `${Math.round(imageSize.width * fittedScale * (zoom / 100))}px`,
        };

  const fit = () => {
    setZoom(100);
    const scroll = scrollRef.current;
    if (scroll === undefined || scroll === null) return;
    if (typeof scroll.scrollTo === 'function') {
      scroll.scrollTo({ left: 0, top: 0 });
      return;
    }
    scroll.scrollLeft = 0;
    scroll.scrollTop = 0;
  };

  if (asset === undefined) {
    return (
      <p className="room-map-load-error" role="status">
        This room does not have a packaged map image.
      </p>
    );
  }

  return (
    <section aria-label={`${title} map viewport`} className="room-map-viewport">
      <div className="room-map-controls">
        <button className="quiet-action action-compact" onClick={fit} type="button">
          Fit
        </button>
        <button
          aria-label="Zoom out"
          className="quiet-action action-compact"
          disabled={zoom <= minimumZoom}
          onClick={() => setZoom((current) => Math.max(minimumZoom, current - zoomStep))}
          type="button"
        >
          −
        </button>
        <output aria-live="polite" className="room-map-zoom">
          {zoom}%
        </output>
        <button
          aria-label="Zoom in"
          className="quiet-action action-compact"
          disabled={zoom >= maximumZoom}
          onClick={() => setZoom((current) => Math.min(maximumZoom, current + zoomStep))}
          type="button"
        >
          +
        </button>
      </div>
      <div className="room-map-scroll" ref={scrollRef} tabIndex={0}>
        <div className="room-map-image-stage">
          <img
            alt={`Map of ${title}`}
            className="room-map-image"
            onError={() => setImageFailed(true)}
            onLoad={(event) => {
              setImageSize({
                height: event.currentTarget.naturalHeight,
                width: event.currentTarget.naturalWidth,
              });
            }}
            src={asset.src}
            {...(displayedImageStyle === undefined ? {} : { style: displayedImageStyle })}
          />
        </div>
      </div>
      {imageFailed ? (
        <p className="room-map-load-error" role="status">
          Unable to load this map image.
        </p>
      ) : null}
    </section>
  );
}

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
        <RoomMapViewport asset={roomMapAssetFor(gameName)} key={gameName} title={title} />
      </section>
    </dialog>
  );
}

/** A transient, host-local launcher for one static room reference. */
export function RoomMapLauncher({
  gameName,
  hostId,
  title,
}: {
  readonly gameName: string;
  /** Changes of the containing owner close an inherited inspection dialog. */
  readonly hostId: string;
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
        View Map
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
