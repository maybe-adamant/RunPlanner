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

/** An entry's picker trigger in the room's Add area: a source family or a room object. */
export function addGroupButton(label: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    `.room-add button[aria-label="${CSS.escape(label)}"]`,
  );
  if (button === null) {
    const shown = [...document.querySelectorAll('.room-add button[aria-label]')].map((candidate) =>
      candidate.getAttribute('aria-label'),
    );
    throw new Error(`No Add group ${label}; groups: ${shown.join(', ')}`);
  }
  return button;
}

/** Opens one Add entry and returns its list of optional actions. */
export async function openAddGroup(
  user: { click: (element: Element) => Promise<void> },
  label: string,
): Promise<HTMLElement> {
  await user.click(addGroupButton(label));
  return waitFor(() => {
    const menu = document.querySelector<HTMLElement>('.contextual-picker-popover');
    if (menu === null) throw new Error(`${label} did not open`);
    return menu;
  });
}

/** One optional action's option in an open Add list, by its label. */
export function addActionOption(menu: HTMLElement, action: string | RegExp): HTMLElement {
  const option = [...menu.querySelectorAll<HTMLElement>('[role="option"]')].find((candidate) => {
    const text =
      candidate.querySelector('.contextual-picker-item-label')?.textContent?.trim() ?? '';
    return typeof action === 'string' ? text === action : action.test(text);
  });
  if (option === undefined) throw new Error(`No ${String(action)} in the open Add list`);
  return option;
}

/** Adds one optional action from its Add group; it appends at its last legal position. */
export async function pickAddAction(
  user: { click: (element: Element) => Promise<void> },
  group: string,
  action: string | RegExp,
): Promise<void> {
  await user.click(addActionOption(await openAddGroup(user, group), action));
}

/** The one timeline action row that buys from inventory slot `slot`, named on its icon badge. */
export function slotRow(slot: number): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('li[data-room-action-key]')].filter(
    (row) => row.textContent?.includes(` · slot ${slot}`),
  );
  if (rows.length !== 1) throw new Error(`Expected one slot ${slot} row, found ${rows.length}`);
  return rows[0]!;
}
