import type { WorkspaceDoorNote } from '@planner/projections/structured-workspace';
import { useId, useState } from 'react';

/** The pool values a note can mark; a note about the whole batch marks none. */
export type DoorNoteTarget = Exclude<WorkspaceDoorNote['target'], 'batch'>;

/** The link between one explained value and its note. */
export interface DoorNoteMark {
  readonly symbol: string;
  /** The note's element id, which the value names as its description. */
  readonly noteId: string;
  readonly active: boolean;
  readonly setActive: (active: boolean) => void;
}

export interface DoorNoteItem {
  readonly key: string;
  readonly text: string;
  readonly mark?: DoorNoteMark;
}

const symbols = ['*', '†', '‡'] as const;

/**
 * Marks each note that explains a value with the next footnote symbol, in
 * order of appearance, and tracks which marked pair is highlighted.
 */
export function useDoorNotes(notes: readonly WorkspaceDoorNote[]): {
  readonly items: readonly DoorNoteItem[];
  readonly markFor: (target: DoorNoteTarget) => DoorNoteMark | undefined;
} {
  const prefix = useId();
  const [active, setActiveTarget] = useState<DoorNoteTarget>();
  let next = 0;
  const marks = new Map<DoorNoteTarget, DoorNoteMark>();
  const items = notes.map((note, index): DoorNoteItem => {
    const key = `${index}-${note.text}`;
    if (note.target === 'batch' || next >= symbols.length) return { key, text: note.text };
    const target = note.target;
    const mark: DoorNoteMark = {
      symbol: symbols[next++]!,
      noteId: `${prefix}-note-${target}`,
      active: active === target,
      setActive: (on) =>
        setActiveTarget((current) => (on ? target : current === target ? undefined : current)),
    };
    marks.set(target, mark);
    return { key, text: note.text, mark };
  });
  return { items, markFor: (target) => marks.get(target) };
}
