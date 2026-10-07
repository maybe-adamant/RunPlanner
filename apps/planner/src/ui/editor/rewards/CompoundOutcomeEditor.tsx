import type { ReactNode } from 'react';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';

export interface CompoundOutcomeEditorRow {
  readonly key: string;
  readonly label: string;
  readonly controlId?: string;
  readonly findingTarget?: FindingTargetProps;
}

/** Shared presentation shell for ordered multi-part reward outcomes. */
export function CompoundOutcomeEditor({
  activeIndex,
  children,
  complete,
  findingTarget,
  legend,
  onBegin,
  rows,
  startLabel,
}: {
  readonly activeIndex: number | undefined;
  readonly children?: ReactNode;
  readonly complete: boolean;
  readonly findingTarget?: FindingTargetProps;
  /** The row label. */
  readonly legend: string;
  readonly onBegin: (index?: number) => void;
  readonly rows: readonly CompoundOutcomeEditorRow[];
  readonly startLabel?: string;
}) {
  return (
    <div
      {...findingTarget}
      tabIndex={findingTarget === undefined ? undefined : -1}
      className="field-control field-control-inline trait-outcome-row trait-selected-outcome-detail"
      role="group"
      aria-label={legend}
    >
      <span>{legend}</span>
      <div className="trait-outcome-row-control">
        <div className="trait-outcome-summary-list">
          {rows.map((row, index) => (
            <button
              {...row.findingTarget}
              className="quiet-action action-compact"
              id={row.controlId}
              key={row.key}
              onClick={() => onBegin(index)}
              type="button"
            >
              {row.label}
            </button>
          ))}
        </div>
        {activeIndex === undefined ? null : children}
        {!complete && activeIndex === undefined ? (
          <button className="quiet-action action-compact" onClick={() => onBegin()} type="button">
            {startLabel ?? 'Choose all'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
