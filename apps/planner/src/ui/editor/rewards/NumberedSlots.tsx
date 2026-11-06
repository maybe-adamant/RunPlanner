import type { ReactNode } from 'react';
import { hintProps } from '@planner/ui/controls/hint';

/** Slot chips on one line, each numbered underneath. */
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

/** One chip with its number under it; the number tells what it counts on hover. */
export function NumberedSlot({
  children,
  hint,
  number,
  trailing,
}: {
  readonly children: ReactNode;
  readonly hint: string;
  readonly number: number;
  /** A value that belongs to this slot, after its chip on the same line. */
  readonly trailing?: ReactNode;
}) {
  return (
    <span className="numbered-slot" data-slot-number={number}>
      <span className="numbered-slot-chip">
        {children}
        <span {...hintProps(hint)} aria-hidden="true" className="numbered-slot-number">
          {number}
        </span>
      </span>
      {trailing}
    </span>
  );
}
