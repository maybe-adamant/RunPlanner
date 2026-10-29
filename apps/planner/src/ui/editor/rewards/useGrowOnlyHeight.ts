import { useCallback, useRef } from 'react';

/**
 * Holds an element at the tallest height it has reached, so switching between
 * screens of different content never shrinks the surrounding dialog.
 */
export function useGrowOnlyHeight(enabled: boolean): (element: HTMLElement | null) => void {
  const observer = useRef<ResizeObserver | undefined>(undefined);
  return useCallback(
    (element: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = undefined;
      if (element === null || !enabled || typeof ResizeObserver === 'undefined') return;
      let tallest = 0;
      observer.current = new ResizeObserver(() => {
        const height = element.offsetHeight;
        if (height <= tallest) return;
        tallest = height;
        // Applied after the observation so the floor never re-enters this frame's layout.
        requestAnimationFrame(() => {
          element.style.minHeight = `${tallest}px`;
        });
      });
      observer.current.observe(element);
    },
    [enabled],
  );
}
