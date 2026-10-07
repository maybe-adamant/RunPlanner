/**
 * The authored-value identity that keys an editor dialog's local draft: a changed
 * authored value replaces the draft, while a changed context alone keeps it.
 */
export function draftValueIdentity(value: unknown): string {
  return JSON.stringify(value) ?? 'undefined';
}
