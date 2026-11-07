import type { WorkspaceFieldsCageLabel } from '@planner/projections/structured-workspace';

/** A banner's spoken name: a Fields cage's banners add the cage their subscript marks. */
export function boundarySpokenLabel(label: string, fieldsCage?: WorkspaceFieldsCageLabel): string {
  return fieldsCage === undefined ? label : `${label}, ${fieldsCage.cage}`;
}
