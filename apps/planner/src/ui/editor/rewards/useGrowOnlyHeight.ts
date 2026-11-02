import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Holds a frame at the tallest content height reached across tabs, so switching
 * between screens of different content never shrinks the surrounding dialog.
 * A content change within one tab releases the floor to that tab's height.
 * Returns refs for the held frame and for the content it measures.
 */
export function useGrowOnlyHeight(
  activeTab: number,
): readonly [
  frame: (element: HTMLElement | null) => void,
  content: (element: HTMLElement | null) => void,
] {
  const frame = useRef<HTMLElement | null>(null);
  const active = useRef(activeTab);
  useLayoutEffect(() => {
    active.current = activeTab;
  }, [activeTab]);
  const observer = useRef<ResizeObserver | undefined>(undefined);
  const holdFrame = useCallback((element: HTMLElement | null) => {
    frame.current = element;
  }, []);
  const measureContent = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = undefined;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    let tallest = 0;
    let measuredTab: number | undefined;
    observer.current = new ResizeObserver(() => {
      const height = element.offsetHeight;
      const sameTab = measuredTab === active.current;
      measuredTab = active.current;
      const floor = sameTab ? height : Math.max(tallest, height);
      if (floor === tallest) return;
      tallest = floor;
      // Applied after the observation so the floor never re-enters this frame's layout.
      requestAnimationFrame(() => {
        if (frame.current !== null) frame.current.style.minHeight = `${tallest}px`;
      });
    });
    observer.current.observe(element);
  }, []);
  return [holdFrame, measureContent];
}
