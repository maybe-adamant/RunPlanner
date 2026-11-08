import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

/** How far a two-line table's one-line width must come under its space to return to one line. */
const returnMargin = 16;

/**
 * Gives the table two lines per row only where its one-line width exceeds the width it is
 * given. It returns to one line only with a margin to spare, so a scrollbar or rounding
 * that its own height brings never flips it back and forth.
 */
function fitTable(table: HTMLElement): void {
  const { style } = table;
  const twoLine = table.getAttribute('data-layout') === 'two-line';
  // The one-line layout at its own width, then the table as wide as it may be.
  table.removeAttribute('data-layout');
  style.width = 'max-content';
  style.maxWidth = 'none';
  const needed = table.getBoundingClientRect().width;
  style.width = '100%';
  style.maxWidth = '';
  const available = table.getBoundingClientRect().width;
  style.width = '';
  const next = twoLine ? needed > available - returnMargin : needed > available + 0.5;
  if (next) table.setAttribute('data-layout', 'two-line');
}

/** Fits the table on every render, which may change a row, and as its space changes. */
function useTwoLineFallback(): RefObject<HTMLDivElement | null> {
  const table = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (table.current !== null) fitTable(table.current);
  });
  useLayoutEffect(() => {
    const element = table.current;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    // A frame later, so its own resize never loops back into this observation.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitTable(element));
    });
    // Its space reaches it through its own width: max-content within it, or all of it.
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return table;
}

/**
 * A doors table: its header and one row per exit, on one line each while the table fits
 * its space, otherwise two lines each: identity and room, then reward and actions.
 */
export function DoorRows({
  ariaLabel,
  children,
  className,
  columns,
  role,
}: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  /** A further class naming the table's kind. */
  readonly className?: string;
  /** `offer`: a wheel's offers, without room or map columns. */
  readonly columns?: 'offer';
  readonly role?: 'group';
}) {
  const table = useTwoLineFallback();
  return (
    <div
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      className={className === undefined ? 'door-rows' : `door-rows ${className}`}
      data-columns={columns}
      ref={table}
      role={role}
    >
      {children}
    </div>
  );
}
