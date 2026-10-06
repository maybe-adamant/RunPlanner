import type { LiHTMLAttributes, ReactNode } from 'react';

export type TimelineRowKind =
  'action' | 'boundary' | 'checkpoint' | 'continuation' | 'effect' | 'insertion';

/**
 * One Room Timeline row: handle, ordinal, label, editors and the two action
 * slots (placement, delete). Every cell stays mounted so columns align.
 */
export function TimelineRow({
  kind,
  className,
  handle,
  ordinal,
  label,
  editors,
  placement,
  removal,
  ...item
}: Omit<LiHTMLAttributes<HTMLLIElement>, 'children'> & {
  readonly kind: TimelineRowKind;
  readonly handle?: ReactNode;
  readonly ordinal?: ReactNode;
  readonly label?: ReactNode;
  readonly editors?: ReactNode;
  readonly placement?: ReactNode;
  readonly removal?: ReactNode;
}) {
  return (
    <li
      {...item}
      className={className === undefined ? 'timeline-row' : `timeline-row ${className}`}
      data-timeline-row-kind={kind}
    >
      <span aria-hidden="true" className="timeline-cell-handle" data-timeline-cell="handle">
        {handle}
      </span>
      <span aria-hidden="true" className="timeline-cell-ordinal" data-timeline-cell="ordinal">
        {ordinal}
      </span>
      <div className="timeline-cell-label" data-timeline-cell="label">
        {label}
      </div>
      <div className="timeline-cell-editors" data-timeline-cell="editors">
        {editors}
      </div>
      <div className="timeline-cell-actions" data-timeline-cell="actions">
        <span className="timeline-action-slot" data-timeline-action-slot="placement">
          {placement}
        </span>
        <span className="timeline-action-slot" data-timeline-action-slot="delete">
          {removal}
        </span>
      </div>
    </li>
  );
}
