import type { WorkspaceRowChoice } from '@planner/projections/structured-workspace';

/** Finds, focuses and opens a room action's Timeline row from a control beside it. */

export function actionRowElement(from: HTMLElement, actionKey: string): HTMLElement | null {
  const selector = `[data-room-action-key="${CSS.escape(actionKey)}"]`;
  return (
    from.closest('.room-actions-workbench')?.querySelector<HTMLElement>(selector) ??
    from.ownerDocument.querySelector<HTMLElement>(selector)
  );
}

/** Brings an action's Timeline row into view and focuses it. */
export function focusActionRow(row: HTMLElement): void {
  row.focus({ preventScroll: true });
  row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

const enabled = (control: HTMLElement) =>
  !control.matches(':disabled') && control.getAttribute('aria-disabled') !== 'true';

/**
 * Opens one row's outcome control within a scope: a picker opens, a toggle takes focus.
 * False when the row shows no enabled control for it.
 */
export function openRowChoice(
  scope: ParentNode,
  rowKey: string,
  choice: WorkspaceRowChoice,
  reveal: HTMLElement,
): boolean {
  const holder = scope.querySelector<HTMLElement>(
    `[data-row-choice-for="${CSS.escape(rowKey)}"][data-row-choice="${CSS.escape(choice)}"]`,
  );
  const control = [...(holder?.querySelectorAll<HTMLElement>('button') ?? [])].find(enabled);
  if (control === undefined) return false;
  control.focus({ preventScroll: true });
  reveal.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  if (!control.hasAttribute('aria-pressed')) control.click();
  return true;
}

/**
 * A newly placed row opens the outcome its placement names, where the row shows it.
 * Otherwise the row is focused.
 */
export function openPlacedRow(row: HTMLElement, choice: WorkspaceRowChoice): void {
  const rowKey = row.getAttribute('data-room-action-key') ?? '';
  const scope = row.closest('.room-actions-workbench') ?? row.ownerDocument;
  if (!openRowChoice(scope, rowKey, choice, row)) focusActionRow(row);
}
