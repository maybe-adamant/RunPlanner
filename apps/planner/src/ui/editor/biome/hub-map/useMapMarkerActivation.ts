import { useRef, type MouseEvent, type PointerEvent } from 'react';

/** Map markers pan with the image; a pointer drag past a few pixels is never a click. */
export function useMapMarkerActivation(
  onActivate: (input: 'keyboard' | 'pointer') => void,
  onPointerStart?: () => void,
) {
  const pointerStart = useRef<{ readonly x: number; readonly y: number } | undefined>(undefined);
  const dragged = useRef(false);
  const trackPointer = (event: PointerEvent<HTMLElement>): void => {
    const start = pointerStart.current;
    if (start !== undefined && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) {
      dragged.current = true;
    }
  };
  return {
    onClick: (event: MouseEvent<HTMLElement>): void => {
      const pointerClick = event.detail !== 0;
      if (pointerClick && dragged.current) {
        dragged.current = false;
        return;
      }
      // A canceled pointer sequence must not lock out the next keyboard action.
      dragged.current = false;
      onActivate(pointerClick ? 'pointer' : 'keyboard');
    },
    onPointerCancel: () => {
      pointerStart.current = undefined;
      dragged.current = true;
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      event.stopPropagation();
      dragged.current = false;
      pointerStart.current = { x: event.clientX, y: event.clientY };
      onPointerStart?.();
    },
    onPointerMove: trackPointer,
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      trackPointer(event);
      pointerStart.current = undefined;
    },
  };
}
