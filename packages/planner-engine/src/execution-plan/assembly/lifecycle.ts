import type { RoomActionWindow } from '../../authored-project/room-lifecycle-structure';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import type { ExecutionLifecycleWindow } from '../model';

/** Map Room Action windows into the execution protocol's existing contacts. */
export function assembleLifecycleWindow(row: RoomActionWindow): ExecutionLifecycleWindow {
  if (row.kind === 'standard') return Object.freeze({ kind: row.kind, phase: row.phase });
  if (row.kind === 'encounterEnd') return Object.freeze({ kind: row.kind, phaseKey: row.phaseKey });
  // Fields cage actions share the native encounter-end contact. The explicit
  // phase key preserves the indexed cage binding; completion-only rows have no
  // execution transaction and therefore validate against the room's ordinary
  // post-combat window.
  if (row.kind === 'fields')
    return row.phaseKey === undefined
      ? Object.freeze({ kind: 'standard', phase: 'afterCombat' })
      : Object.freeze({ kind: 'encounterEnd', phaseKey: row.phaseKey });
  if (row.kind === 'shipPreCombat' || row.kind === 'shipPostCombat')
    return Object.freeze({ kind: row.kind, wheelKey: row.wheelKey });
  if (row.kind === 'postOutgoing') return Object.freeze({ kind: row.kind });
  throw new CompilerError(
    'executionCoverageMissing',
    'lifecycle window is outside the supported execution slice',
  );
}
