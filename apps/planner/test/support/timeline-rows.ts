import { waitFor } from '@testing-library/react';

/**
 * A Room Timeline action row found by its projected label, which names the row's
 * reorder handle, delete and Add controls; the row shows its reward as an icon.
 */
export function queryTimelineRow(
  label: string | RegExp,
  container: ParentNode = document,
): HTMLElement | null {
  const names = (row: Element) =>
    [...row.querySelectorAll('button')].flatMap((button) => {
      const name = button.getAttribute('aria-label') ?? '';
      const match = /^(?:Reorder |Add |Remove )(.*?)(?: from timeline)?$/.exec(name);
      return match === null ? [] : [match[1]!];
    });
  return (
    [...container.querySelectorAll<HTMLElement>('li[data-room-action-key]')].find((row) =>
      names(row).some((name) => (typeof label === 'string' ? name === label : label.test(name))),
    ) ?? null
  );
}

export function timelineRow(label: string | RegExp, container?: ParentNode): HTMLElement {
  const row = queryTimelineRow(label, container);
  if (row === null) {
    const shown = [...document.querySelectorAll('li[data-room-action-key] button')]
      .map((button) => button.getAttribute('aria-label'))
      .filter((name) => name !== null);
    throw new Error(`No timeline row ${String(label)}; row controls: ${shown.join(', ')}`);
  }
  return row;
}

export async function findTimelineRow(label: string | RegExp): Promise<HTMLElement> {
  return waitFor(() => timelineRow(label));
}

/** The one timeline action row that buys from inventory slot `slot`, named on its icon badge. */
export function slotRow(slot: number): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('li[data-room-action-key]')].filter(
    (row) => row.textContent?.includes(` · slot ${slot}`),
  );
  if (rows.length !== 1) throw new Error(`Expected one slot ${slot} row, found ${rows.length}`);
  return rows[0]!;
}
