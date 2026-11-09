import type { LiHTMLAttributes, ReactNode } from 'react';

export type TimelineRowKind =
  'action' | 'boundary' | 'checkpoint' | 'continuation' | 'effect' | 'insertion';

/**
 * One Room Timeline row: handle, one sentence (its label, then its decisions),
 * money and the trash. A placement control (Add, Restore, Take) stands in the
 * money zone of a row outside the order. Every cell stays mounted so the money
 * and trash columns align down the Timeline. A notice tells what the game did:
 * it wears a dot where an action has its handle.
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
  notice = false,
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
  readonly notice?: boolean;
}) {
  const classes = ['timeline-row', notice ? 'timeline-row-notice' : undefined, className];
  return (
    <li
      {...item}
      className={classes.filter((name) => name !== undefined).join(' ')}
      data-timeline-row-kind={kind}
    >
      <span className="timeline-cell-handle" data-timeline-cell="handle">
        {notice ? <span aria-hidden="true" className="timeline-notice-dot" /> : handle}
      </span>
      <div className="timeline-cell-sentence" data-timeline-cell="sentence">
        <div className="timeline-cell-label" data-timeline-cell="label">
          {label}
        </div>
        <div className="timeline-cell-editors" data-timeline-cell="editors">
          {editors}
        </div>
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
