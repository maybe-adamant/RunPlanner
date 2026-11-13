import type { ReactNode } from 'react';

import type { WorkspaceRowChoice } from '@planner/projections/structured-workspace';

/** Marks the control that settles one outcome of a Timeline row, which placing the row opens. */
export function RowChoice({
  children,
  choice,
  rowKey,
}: {
  readonly children: ReactNode;
  readonly choice: WorkspaceRowChoice;
  readonly rowKey: string;
}) {
  return (
    <span className="row-choice" data-row-choice={choice} data-row-choice-for={rowKey}>
      {children}
    </span>
  );
}
