import type { ReactNode } from 'react';

/** Slot chips on one line, each numbered on its corner. */
export function NumberedSlots({
  children,
  label,
}: {
  readonly children: ReactNode;
  /** The group's accessible name, such as the object whose slots these are. */
  readonly label: string;
}) {
  return (
    <span aria-label={label} className="numbered-slots" role="group">
      {children}
    </span>
  );
}

/** One chip with its number as a corner badge. */
export function NumberedSlot({
  children,
  number,
  trailing,
}: {
  readonly children: ReactNode;
  readonly number: number;
  /** A value that belongs to this slot, after its chip on the same line. */
  readonly trailing?: ReactNode;
}) {
  return (
    <span className="numbered-slot" data-slot-number={number}>
      <span className="numbered-slot-chip">
        {children}
        <span aria-hidden="true" className="corner-badge timeline-slot-badge">
          {number}
        </span>
      </span>
      {trailing}
    </span>
  );
}
