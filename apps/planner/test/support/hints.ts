import { buildQueries, queryHelpers } from '@testing-library/react';

/** Elements whose hover and focus hint is exactly this text. */
export function queryAllByHint(container: HTMLElement, hint: string): HTMLElement[] {
  return queryHelpers.queryAllByAttribute('data-hint', container, hint);
}

export const [queryByHint, getAllByHint, getByHint] = buildQueries(
  queryAllByHint,
  (_container, hint: string) => `Found multiple elements with the hint: ${hint}`,
  (_container, hint: string) => `Unable to find an element with the hint: ${hint}`,
);

/** The hover and focus hint an element shows, if any. */
export function hintOf(element: Element | null | undefined): string | null {
  return element?.getAttribute('data-hint') ?? null;
}
