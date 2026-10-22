/** The name a new plan takes. */
export const DEFAULT_PROJECT_NAME = 'New plan';
/** Bound on a plan's name, in Unicode code points. */
export const PROJECT_NAME_MAX = 200;

/** The trimmed name, or null when it is blank or longer than the bound. */
export function normalizeProjectName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || Array.from(trimmed).length > PROJECT_NAME_MAX) return null;
  return trimmed;
}
