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
}: {
  readonly cap: DraftCapKey | undefined;
  readonly counts: DraftCapCounts;
}) {
  if (cap === undefined) return null;
  const value = counts(cap);
  if (value === undefined)
    return (
      <span aria-hidden="true" className="draft-cap" data-placeholder>
        –/–
      </span>
    );
  return (
    <span className="draft-cap" data-full={value.held >= value.cap || undefined}>
      {value.held}/{value.cap}
    </span>
  );
}
