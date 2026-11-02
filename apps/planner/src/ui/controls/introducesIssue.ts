import type { EditorDialogIssue } from './EditorDialog';

/**
 * Whether a draft has a finding its saved value lacks, matched by key: inherited
 * findings, even partly repaired or reworded, never count.
 */
export function introducesIssue(
  draft: readonly EditorDialogIssue[],
  saved: readonly EditorDialogIssue[],
): boolean {
  return draft.some(([key]) => !saved.some(([savedKey]) => savedKey === key));
}
