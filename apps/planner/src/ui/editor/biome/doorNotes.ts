import type { WorkspaceDoorNote } from '@planner/projections/structured-workspace';

/** What a note explains: one pool value, the hidden door, or the doors as a whole. */
export type DoorNoteTarget = WorkspaceDoorNote['target'];

/** The note on one explained value, absent where it has none. */
export type DoorNoteFor = (target: DoorNoteTarget) => string | undefined;

/** Each target's note; a target with several notes reads them one per line. */
export function doorNotesByTarget(notes: readonly WorkspaceDoorNote[]): DoorNoteFor {
  return (target) => {
    const lines = notes.flatMap((note) => (note.target === target ? [note.text] : []));
    return lines.length === 0 ? undefined : lines.join('\n');
  };
}
