import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';

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
  const panRef = useRef<
    | {
        readonly pointerId: number;
        readonly x: number;
        readonly y: number;
        readonly left: number;
        readonly top: number;
      }
    | undefined
  >(undefined);
  const zoomCenterRef = useRef<{ readonly x: number; readonly y: number } | undefined>(undefined);
  const [panning, setPanning] = useState(false);
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
  const displayedImageSize =
    fittedScale === undefined || imageSize === undefined
      ? undefined
      : {
          height: Math.round(imageSize.height * fittedScale * (zoom / 100)),
          width: Math.round(imageSize.width * fittedScale * (zoom / 100)),
        };
  const canPan =
    displayedImageSize !== undefined &&
    viewportSize !== undefined &&
    (displayedImageSize.width > viewportSize.width ||
      displayedImageSize.height > viewportSize.height);

  const changeZoom = (next: number) => {
    const scroll = scrollRef.current;
    zoomCenterRef.current =
      scroll === null || displayedImageSize === undefined
        ? { x: 0.5, y: 0.5 }
        : {
            x:
              (scroll.scrollLeft + Math.min(scroll.clientWidth, displayedImageSize.width) / 2) /
              displayedImageSize.width,
            y:
              (scroll.scrollTop + Math.min(scroll.clientHeight, displayedImageSize.height) / 2) /
              displayedImageSize.height,
          };
    setZoom(next);
  };

  const displayedWidth = displayedImageSize?.width;
  const displayedHeight = displayedImageSize?.height;
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const center = zoomCenterRef.current;
    if (
      scroll === null ||
      center === undefined ||
      displayedWidth === undefined ||
      displayedHeight === undefined
    )
      return;
    // A newly visible scrollbar can change the fit size during this zoom.
    if (viewportSize?.width !== scroll.clientWidth || viewportSize.height !== scroll.clientHeight) {
      setViewportSize({ width: scroll.clientWidth, height: scroll.clientHeight });
      return;
    }
    scroll.scrollLeft = Math.max(0, center.x * displayedWidth - scroll.clientWidth / 2);
    scroll.scrollTop = Math.max(0, center.y * displayedHeight - scroll.clientHeight / 2);
    zoomCenterRef.current = undefined;
  }, [displayedWidth, displayedHeight, viewportSize]);

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    if (
      !canPan ||
      scroll === null ||
      event.button !== 0 ||
      event.pointerType === 'touch' ||
      panRef.current !== undefined
    )
      return;
    event.preventDefault();
    scroll.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: scroll.scrollLeft,
      top: scroll.scrollTop,
    };
    setPanning(true);
  };

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    const pan = panRef.current;
    if (scroll === null || pan === undefined || pan.pointerId !== event.pointerId) return;
    scroll.scrollLeft = pan.left + pan.x - event.clientX;
    scroll.scrollTop = pan.top + pan.y - event.clientY;
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = undefined;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const fit = () => {
    zoomCenterRef.current = undefined;
    setZoom(100);
    const scroll = scrollRef.current;
    if (scroll === null) return;
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
            onClick={() => changeZoom(Math.max(minimumZoom, zoom - zoomStep))}
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
            onClick={() => changeZoom(Math.min(maximumZoom, zoom + zoomStep))}
            type="button"
          >
            +
          </button>
          {toolbarActions}
        </div>
      </header>
      <div
        aria-label={`Pan map of ${title}`}
        className="room-map-scroll"
        ref={scrollRef}
        role="region"
        tabIndex={0}
      >
        <div
          className="room-map-image-stage"
          data-pannable={canPan || undefined}
          data-panning={panning || undefined}
          onLostPointerCapture={endPan}
          onPointerCancel={endPan}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
        >
          <img
            alt={`Map of ${title}`}
            className="room-map-image"
            draggable={false}
            onError={() => setImageFailed(true)}
            onLoad={(event) => {
              setImageSize({
                height: event.currentTarget.naturalHeight,
                width: event.currentTarget.naturalWidth,
              });
            }}
            src={asset.src}
            {...(displayedImageSize === undefined ? {} : { style: displayedImageSize })}
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
