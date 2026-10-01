import { roomActionKey } from '../../authored-project/room-actions/state';
import {
  roomLifecycleWindowOrdinal,
  type RoomLifecycleStructure,
} from '../../authored-project/room-actions/lifecycle-structure';
import type { RoomActionRow } from './model';

/** Classifies existing obligations; it does not add ordering or participation constraints. */
export function withRequiredScopes(
  rows: readonly RoomActionRow[],
  structure: RoomLifecycleStructure,
): readonly RoomActionRow[] {
  const phaseBound = new Set<string>();
  const active = rows.filter(
    (row) => !row.stale && (row.participation === 'required' || row.rank !== null),
  );
  const roomEnd = roomLifecycleWindowOrdinal(structure, { kind: 'standard', phase: 'afterCombat' });
  for (const row of active) {
    const window = row.window;
    if (
      row.reference.kind === 'completeFieldsCage' ||
      window.kind === 'shipPreCombat' ||
      window.kind === 'shipPostCombat' ||
      (window.kind !== 'fields' &&
        window.kind !== 'postOutgoing' &&
        structure.points.some((point) => point.kind === 'encounterStart') &&
        roomLifecycleWindowOrdinal(structure, window) < roomEnd) ||
      row.dependencies.some(
        (dependency) =>
          dependency.kind === 'beforeCheckpoint' &&
          structure.points.some(
            (point) =>
              (point.kind === 'encounterEnd' &&
                dependency.checkpointKey === `combat:${point.phaseKey}`) ||
              (point.kind === 'nextPhase' &&
                dependency.checkpointKey === `nextPhaseUsable:${point.previousWheelKey}`),
          ),
      )
    )
      phaseBound.add(row.key);
  }
  // A prerequisite inherits an encounter deadline from the action that needs it.
  // In Fields this captures Gorgon/NPC barriers without treating cage rewards as phase-local.
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of active) {
      if (!phaseBound.has(row.key)) continue;
      for (const dependency of row.dependencies) {
        if (dependency.kind !== 'afterAction') continue;
        const key = roomActionKey(dependency.action);
        if (phaseBound.has(key)) continue;
        phaseBound.add(key);
        changed = true;
      }
    }
  }
  return Object.freeze(
    rows.map((previous) => {
      const row = { ...previous };
      delete row.requiredScope;
      return Object.freeze({
        ...row,
        ...(row.stale || row.participation !== 'required'
          ? {}
          : {
              requiredScope: phaseBound.has(row.key) ? ('phase' as const) : ('room' as const),
            }),
      });
    }),
  );
}
