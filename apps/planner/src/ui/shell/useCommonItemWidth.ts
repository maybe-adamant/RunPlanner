import { useLayoutEffect, useRef } from 'react';

/**
 * Gives every `.route-loadout-row` item under the container one width: the widest
 * item's natural width, published as `--route-loadout-item-width`.
 */
export function useCommonItemWidth<Container extends HTMLElement>() {
  const ref = useRef<Container>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    if (container === null) return;
    // A launcher's open dialog renders beside it but is not one of the row's controls.
    const items = [...container.querySelectorAll<HTMLElement>('.route-loadout-row > :not(dialog)')];
    for (const item of items) item.style.width = 'max-content';
    const widest = Math.max(0, ...items.map((item) => item.getBoundingClientRect().width));
    for (const item of items) item.style.width = '';
    // Unmeasured rows (hidden, or without layout) keep their natural widths.
    if (widest === 0) container.style.removeProperty('--route-loadout-item-width');
    else container.style.setProperty('--route-loadout-item-width', `${Math.ceil(widest)}px`);
  });
  return ref;
}
