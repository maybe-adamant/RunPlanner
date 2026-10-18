import type { DraftCapKey } from '@planner/projections/draftSpec';

export interface DraftCapValue {
  readonly held: number;
  readonly cap: number;
}

/** Engine counts for each basket cap; undefined while a count is unavailable. */
export type DraftCapCounts = (cap: DraftCapKey) => DraftCapValue | undefined;

export function DraftCapCount({
  cap,
  counts,
  label,
}: {
  readonly cap: DraftCapKey | undefined;
  readonly counts: DraftCapCounts;
  readonly label: string;
}) {
  if (cap === undefined) return null;
  const value = counts(cap);
  return (
    <span
      aria-label={value === undefined ? undefined : `${label} ${value.held} of ${value.cap}`}
      className="draft-cap"
      data-full={(value !== undefined && value.held >= value.cap) || undefined}
      data-placeholder={value === undefined || undefined}
    >
      {value === undefined ? '–/–' : `${value.held}/${value.cap}`}
    </span>
  );
}
