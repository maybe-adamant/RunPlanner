import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** The Room Timeline's live row, where the room's live things are taken. */
export function liveRow(container: ParentNode = document): HTMLElement {
  const row = container.querySelector<HTMLElement>('.timeline-live-row');
  if (row === null) throw new Error('No live row');
  return row;
}

/** A live thing's chip by its name. */
export function liveChip(name: string | RegExp, container?: ParentNode): HTMLElement {
  return within(liveRow(container)).getByRole('button', { name });
}

/**
 * Takes a live thing as the author does: its chip opens its verbs, the verb is chosen, then
 * any value it lists first.
 */
export async function takeLive(
  user: UserEvent,
  thing: string | RegExp,
  verb: string | RegExp,
  value?: string | RegExp,
): Promise<void> {
  await user.click(await waitFor(() => liveChip(thing)));
  await user.click(await screen.findByRole('option', { name: verb }));
  if (value !== undefined) await user.click(await screen.findByRole('option', { name: value }));
}

/**
 * Takes a thing through the `+` above the row the walk stopped at, the last gap the Timeline
 * offers, where a walk stopped by anything but an unplaced required item shows no live row.
 */
export async function takeAtStop(
  user: UserEvent,
  thing: string | RegExp,
  verb: string | RegExp,
): Promise<void> {
  const controls = [...document.querySelectorAll<HTMLElement>('.timeline-gap-control')];
  const last = controls.reduce<HTMLElement | undefined>(
    (latest, control) =>
      latest === undefined || Number(control.dataset.liveGap) > Number(latest.dataset.liveGap)
        ? control
        : latest,
    undefined,
  );
  if (last === undefined) throw new Error('No Timeline gap');
  await user.click(last);
  const menu = await screen.findByRole('dialog', { name: 'Insert here' });
  await user.click(within(menu).getByRole('button', { name: thing }));
  await user.click(await screen.findByRole('option', { name: verb }));
}
