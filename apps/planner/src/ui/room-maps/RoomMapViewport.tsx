import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { RoomMapAsset } from './roomMapAssets';

const minimumZoom = 50;
const maximumZoom = 200;
const zoomStep = 25;

export function RoomMapViewport({
  asset,
  title,
  toolbarTitle,
  toolbarActions,
}: {
  readonly asset: RoomMapAsset | undefined;
  readonly title: string;
  readonly toolbarTitle?: string;
  readonly toolbarActions?: ReactNode;
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
      <header className="room-map-toolbar">
        {toolbarTitle === undefined ? null : <h4>{toolbarTitle}</h4>}
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
          {toolbarActions}
        </div>
      </header>
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
