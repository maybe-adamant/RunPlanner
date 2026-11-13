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

/** A newly placed row's first unfinished choice opens; otherwise the row is focused. */
export function openPlacedRow(row: HTMLElement): void {
  const choice = [
    ...row.querySelectorAll<HTMLElement>('.timeline-cell-editors button[data-has-findings="true"]'),
  ].find((button) => !button.matches(':disabled') && button.ariaDisabled !== 'true');
  if (choice === undefined) {
    focusActionRow(row);
    return;
  }
  choice.focus({ preventScroll: true });
  row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  choice.click();
}
