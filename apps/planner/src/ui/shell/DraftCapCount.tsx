import type { DraftCapUsage } from '@run-planner/engine/simulation';

/** A basket cap's use, such as 3/12; accented once the cap is reached. */
export function DraftCapCount({ cap }: { readonly cap: DraftCapUsage | undefined }) {
  if (cap === undefined) return null;
  return (
    <span className="draft-cap" data-full={cap.count >= cap.cap || undefined}>
      {cap.count}/{cap.cap}
    </span>
  );
}
