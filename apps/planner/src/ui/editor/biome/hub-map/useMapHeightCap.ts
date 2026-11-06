import { useLayoutEffect, type RefObject } from 'react';

function scrollParentOf(element: HTMLElement): HTMLElement | undefined {
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return parent;
  }
  return undefined;
}

function bottomChrome(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return (
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderBottomWidth) +
    parseFloat(style.marginBottom)
  );
}

/**
 * Publishes `--hub-map-height-cap`: the height the map's canvas may take so
 * that, scrolled to the top, it ends inside its scrolling panel. It measures
 * the real space under the header, heading and tabs at the current scale.
 */
export function useMapHeightCap(map: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const section = map.current;
    const layout = section?.parentElement;
    if (section == null || layout == null) return;
    const scroll = scrollParentOf(section);
    if (scroll === undefined) return;
    const measure = (): void => {
      const canvas = section.querySelector<HTMLElement>('.room-map-canvas');
      if (canvas === null) return;
      const scrollRect = scroll.getBoundingClientRect();
      // The map may stick while scrolled; its unstuck top is its layout row's.
      const top =
        layout.getBoundingClientRect().top -
        scrollRect.top -
        scroll.clientTop +
        scroll.scrollTop +
        (canvas.getBoundingClientRect().top - section.getBoundingClientRect().top);
      let below = 0;
      for (let element: HTMLElement | null = layout; element !== null && element !== scroll;) {
        below += bottomChrome(element);
        element = element.parentElement;
      }
      below += parseFloat(getComputedStyle(scroll).paddingBottom);
      const available = Math.floor(scroll.clientHeight - top - below);
      section.style.setProperty('--hub-map-height-cap', `${Math.max(available, 0)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    observer.observe(layout);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [map]);
}
