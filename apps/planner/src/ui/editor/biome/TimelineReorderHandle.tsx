import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { hintProps } from '@planner/ui/controls/hint';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import {
  reorderAnchorElement,
  type TimelineReorderItem,
  type TimelineReorderSession,
} from './useTimelineReorder';

function positionY(root: HTMLElement | null, position: TimelineReorderItem['positions'][number]) {
  const bounds = reorderAnchorElement(root, position.anchor)?.getBoundingClientRect();
  if (bounds === undefined) return undefined;
  if (position.edge === 'before') return bounds.top;
  if (position.edge === 'after') return bounds.bottom;
  return bounds.top + bounds.height / 2;
}

/** The legal place nearest the pointer; places outside the rendered list are skipped. */
function nearestPosition(root: HTMLElement | null, item: TimelineReorderItem, y: number) {
  let best: { index: number; distance: number } | undefined;
  item.positions.forEach((position, index) => {
    const at = positionY(root, position);
    if (at === undefined) return;
    const distance = Math.abs(at - y);
    if (best === undefined || distance < best.distance) best = { index, distance };
  });
  return best?.index;
}

const ownLabel = 'Current position';

/**
 * Drag handle that reorders its row through the projected moves only: pointer
 * drag, or Space/Enter to pick up, arrows to step, Space/Enter to drop, Escape
 * to cancel.
 */
export function TimelineReorderHandle({
  disabled: blocked = false,
  disabledHint,
  findingMark,
  item,
  session,
}: {
  readonly disabled?: boolean;
  /** Hover text while the handle cannot move its row. */
  readonly disabledHint?: string;
  readonly findingMark?: FindingMarkProps;
  readonly item: TimelineReorderItem;
  readonly session: TimelineReorderSession;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const pending = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  const lifted = session.lift?.item.key === item.key ? session.lift : undefined;
  const ownIndex = item.positions.findIndex((position) => position.edge === 'self');
  // The keyboard steps through authorable places only; pointer drag also names the others.
  const legal = item.positions.flatMap((position, index) =>
    position.unavailable === undefined ? [index] : [],
  );
  const disabled =
    blocked ||
    disabledHint !== undefined ||
    !item.positions.some((position) => position.move !== undefined && !position.unavailable);
  const owesFocus = session.pendingFocus === item.key;
  const { focusClaimed } = session;
  useEffect(() => {
    if (!owesFocus) return;
    const active = document.activeElement;
    if (active === null || active === document.body) button.current?.focus({ preventScroll: true });
    focusClaimed();
  }, [owesFocus, focusClaimed]);
  const labelAt = (index: number) => {
    const position = item.positions[index];
    if (position === undefined || position.edge === 'self') return ownLabel;
    return position.unavailable === undefined
      ? position.label
      : `${position.label}: unavailable. ${position.unavailable}`;
  };
  const cancel = (announce: boolean) => {
    session.setLift(undefined);
    if (announce) session.announce(`Cancelled. ${item.label} stays in place.`);
  };
  const drop = (index: number) => {
    const position = item.positions[index];
    const move = position?.move;
    session.setLift(undefined);
    if (position?.unavailable !== undefined) {
      session.announce(`Not moved. ${position.unavailable}`);
      return;
    }
    if (move === undefined) {
      session.announce(`${item.label} stays in place.`);
      return;
    }
    session.announce(`Moved ${item.label}: ${labelAt(index)}.`);
    session.refocusAfterMove(item.key);
    item.onMove(move);
  };
  const step = (next: number | undefined) => {
    if (lifted === undefined || next === undefined || next === lifted.index) return;
    session.setLift({ ...lifted, item, index: next });
    session.announce(labelAt(next));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (lifted === undefined) return;
    const at = legal.indexOf(lifted.index);
    const moves: Partial<Record<string, number | undefined>> = {
      ArrowUp: legal[Math.max(0, at - 1)],
      ArrowDown: legal[Math.min(legal.length - 1, at + 1)],
      Home: legal[0],
      End: legal.at(-1),
    };
    if (event.key in moves) {
      event.preventDefault();
      step(moves[event.key]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel(true);
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pending.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = pending.current;
    if (origin === undefined || origin.pointerId !== event.pointerId) return;
    if (
      lifted?.via !== 'pointer' &&
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 6
    )
      return;
    const index = nearestPosition(session.root(), item, event.clientY) ?? ownIndex;
    if (lifted?.via !== 'pointer') session.announce(`Picked up ${item.label}.`);
    else if (index !== lifted.index) session.announce(labelAt(index));
    session.setLift({ item, index, via: 'pointer', x: event.clientX, y: event.clientY });
  };
  const endPointer = (event: PointerEvent<HTMLButtonElement>, complete: boolean) => {
    if (pending.current?.pointerId !== event.pointerId) return;
    pending.current = undefined;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (lifted?.via !== 'pointer') return;
    if (complete) drop(lifted.index);
    else cancel(true);
  };
  return (
    <button
      {...findingMark}
      {...hintProps(disabled ? disabledHint : undefined, findingMark?.['aria-description'])}
      aria-describedby={disabled ? undefined : session.instructionsId}
      aria-disabled={disabled || undefined}
      aria-label={`Reorder ${item.label}`}
      aria-pressed={lifted === undefined ? undefined : true}
      className="timeline-reorder-handle"
      data-lifted={lifted?.via}
      data-reorder-handle={item.key}
      onBlur={() => {
        if (lifted?.via === 'keyboard') cancel(true);
      }}
      onClick={(event) => {
        // Keyboard and assistive activation report no pointer clicks.
        if (event.detail !== 0 || disabled) return;
        if (lifted === undefined) {
          session.setLift({ item, index: Math.max(ownIndex, 0), via: 'keyboard', x: 0, y: 0 });
          session.announce(`Picked up ${item.label}. ${ownLabel}.`);
        } else drop(lifted.index);
      }}
      onKeyDown={onKeyDown}
      onLostPointerCapture={(event) => endPointer(event, false)}
      onPointerCancel={(event) => endPointer(event, false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endPointer(event, true)}
      ref={button}
      type="button"
    >
      <span aria-hidden="true">⠿</span>
    </button>
  );
}

/** The list's live announcements, handle instructions and pointer drag preview. */
export function TimelineReorderStatus({ session }: { readonly session: TimelineReorderSession }) {
  const lift = session.lift;
  const position = lift?.item.positions[lift.index];
  return (
    <>
      <p aria-live="polite" className="visually-hidden">
        {session.announcement}
      </p>
      <p className="visually-hidden" id={session.instructionsId}>
        Press Space to pick up, the arrow keys to choose a position, Space to drop and Escape to
        cancel.
      </p>
      {lift?.via !== 'pointer' ? null : (
        <div
          aria-hidden="true"
          className="room-action-drag-preview"
          style={{
            transform: `translate3d(calc(${lift.x + 14}px / var(--app-scale, 1)), calc(${lift.y + 14}px / var(--app-scale, 1)), 0)`,
          }}
        >
          <div className="room-action-drag-header">
            <span aria-hidden="true">⠿</span>
            <strong>{lift.item.label}</strong>
          </div>
          <span className="room-action-drag-feedback" data-unavailable={!!position?.unavailable}>
            {position === undefined || position.edge === 'self'
              ? ownLabel
              : position.unavailable === undefined
                ? position.label
                : `Unavailable: ${position.unavailable}`}
          </span>
        </div>
      )}
    </>
  );
}
