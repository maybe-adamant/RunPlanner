import type { RoomActionWindow } from '../../authored-project/room-action-domain';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import type { ExecutionLifecycleWindow } from '../model';

/** Map the closed F/G Room Action windows into the execution protocol. */
export function assembleLifecycleWindow(row: RoomActionWindow): ExecutionLifecycleWindow {
  if (row.kind === 'standard') return Object.freeze({ kind: row.kind, phase: row.phase });
  if (row.kind === 'encounterEnd') return Object.freeze({ kind: row.kind, phaseKey: row.phaseKey });
  if (row.kind === 'postOutgoing') return Object.freeze({ kind: row.kind });
  throw new CompilerError(
    'executionCoverageMissing',
    `lifecycle window ${row.kind} is outside the supported F/G execution slice`,
  );
}
