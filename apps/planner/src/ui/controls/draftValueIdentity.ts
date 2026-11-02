/**
 * The authored-value identity that keys an editor dialog's local draft: a changed
 * authored value replaces the draft, while a changed context alone keeps it.
 * Object key order is not part of a value, so keys are sorted.
 */
export function draftValueIdentity(value: unknown): string {
  return (
    JSON.stringify(value, (_key, entry: unknown) =>
      entry === null || typeof entry !== 'object' || Array.isArray(entry)
        ? entry
        : Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((key) => [key, (entry as Record<string, unknown>)[key]]),
          ),
    ) ?? 'undefined'
  );
}
