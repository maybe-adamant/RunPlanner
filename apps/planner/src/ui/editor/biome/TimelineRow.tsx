import type { LiHTMLAttributes, ReactNode } from 'react';

export type TimelineRowKind =
  'action' | 'boundary' | 'checkpoint' | 'continuation' | 'effect' | 'insertion';

/**
 * One Room Timeline row: handle, label, decisions (editors), money and the
 * trash. A placement control (Add, Restore, Take) stands in the money zone of
 * a row outside the order. Every cell stays mounted so columns align.
 */
export function TimelineRow({
  kind,
  className,
  handle,
  label,
  editors,
  money,
  placement,
  removal,
  ...item
}: Omit<LiHTMLAttributes<HTMLLIElement>, 'children'> & {
  readonly kind: TimelineRowKind;
  readonly handle?: ReactNode;
  readonly label?: ReactNode;
  readonly editors?: ReactNode;
  /** Price and chance to afford, or gold gained. */
  readonly money?: ReactNode;
  readonly placement?: ReactNode;
  readonly removal?: ReactNode;
}) {
  return (
    <li
      {...item}
      className={className === undefined ? 'timeline-row' : `timeline-row ${className}`}
      data-timeline-row-kind={kind}
    >
      <span className="timeline-cell-handle" data-timeline-cell="handle">
        {handle}
      </span>
      <div className="timeline-cell-label" data-timeline-cell="label">
        {label}
      </div>
      <div className="timeline-cell-editors" data-timeline-cell="editors">
        {editors}
      </div>
      <div className="timeline-cell-money" data-timeline-cell="money">
        {money}
        {placement}
      </div>
      <div className="timeline-cell-actions" data-timeline-cell="actions">
        {removal}
      </div>
    </li>
  );
}
