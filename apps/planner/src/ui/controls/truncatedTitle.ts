import type { MouseEvent } from 'react';

/** Shows an ellipsized label's full text as its title, only while it is cut off. */
export function showTruncatedTitle(event: MouseEvent<HTMLElement>): void {
  const element = event.currentTarget;
  element.title = element.scrollWidth > element.clientWidth ? (element.textContent ?? '') : '';
}
