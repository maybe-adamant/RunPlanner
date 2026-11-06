import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type { WorkspaceDoorNote } from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useId, useState } from 'react';
import { flushSync } from 'react-dom';

/** What a note explains: one pool value, the hidden door, or the doors as a whole. */
export type DoorNoteTarget = WorkspaceDoorNote['target'];

/** The link between one explained value and its note. */
export interface DoorNoteMark {
  /** Absent on a note about the doors as a whole, which marks no single value. */
  readonly symbol?: string;
  /** The note's element id, which the value names as its description. */
  readonly noteId: string;
  readonly active: boolean;
  readonly setActive: (active: boolean) => void;
  /** Names, as `data-door-note-focus`, the element that takes focus when the note is opened. */
  readonly focusKey: string;
}

export interface DoorNoteItem {
  readonly key: string;
  readonly text: string;
  readonly mark?: DoorNoteMark;
  /** Navigates to the note's value, opening the doors; absent where nothing navigates there. */
  readonly open?: () => void;
}

const symbols = ['*', '†', '‡'] as const;

/**
 * Marks each note that explains a value with the next footnote symbol, in
 * order of appearance, tracks which note is highlighted, and opens a note's
 * value by navigating to its owner, the way a finding does.
 */
export function useDoorNotes(
  notes: readonly WorkspaceDoorNote[],
  /** The owner whose navigation opens the doors on a note's value. */
  ownerFor: (target: DoorNoteTarget) => SemanticAddress | undefined,
): {
  readonly items: readonly DoorNoteItem[];
  readonly markFor: (target: DoorNoteTarget) => DoorNoteMark | undefined;
  /** The note being hovered or focused. */
  readonly active: DoorNoteTarget | undefined;
} {
  const prefix = useId();
  const dispatch = useAppDispatch();
  const [active, setActiveTarget] = useState<DoorNoteTarget>();
  let next = 0;
  const marks = new Map<DoorNoteTarget, DoorNoteMark>();
  const items = notes.map((note, index): DoorNoteItem => {
    const key = `${index}-${note.text}`;
    const target = note.target;
    if (target !== 'batch' && next >= symbols.length) return { key, text: note.text };
    const mark: DoorNoteMark = {
      ...(target === 'batch' ? {} : { symbol: symbols[next++]! }),
      noteId: `${prefix}-note-${target === 'batch' ? index : target}`,
      active: active === target,
      setActive: (on) =>
        setActiveTarget((current) => (on ? target : current === target ? undefined : current)),
      focusKey: `${prefix}-${target}`,
    };
    marks.set(target, mark);
    const owner = ownerFor(target);
    return {
      key,
      text: note.text,
      mark,
      ...(owner === undefined
        ? {}
        : {
            open: () => {
              // The navigation shows the value before it takes focus.
              flushSync(() => dispatch(semanticOwnerFocused(owner)));
              document
                .querySelector<HTMLElement>(`[data-door-note-focus="${mark.focusKey}"]`)
                ?.focus();
            },
          }),
    };
  });
  return {
    items,
    markFor: (target) => marks.get(target),
    active: active !== undefined && marks.has(active) ? active : undefined,
  };
}
