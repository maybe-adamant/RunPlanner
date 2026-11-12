import { roomActionKey } from '../../authored-project/room-actions/state';
import {
  cagePhase,
  fieldsRoom,
  nextWheelsOpen,
  phaseOfWheel,
  playsPhase,
  roomActionOpeningPoint,
  wheelOfPhase,
  roomEventPlaces,
  type RoomActionBounds,
  type RoomEventGraph,
} from '../../authored-project/room-actions/event-graph';
import type { RoomActionRow, RoomActionRowLabel } from './model';

/** A row before its phase, label and required scope are named. */
export type RoomActionRowFacts = Omit<RoomActionRow, 'label'> & {
  readonly label?: RoomActionRowLabel;
};

/**
 * The label a row's bounds name: after the doors open, before a phase's
 * Combat (a wheel phase's choice), at a wheel's roll, after an encounter's
 * end effects (before the next wheel's choice when its wheels open then),
 * after a wheel phase's fight, during a Fields room, or after the room's fights.
 */
function boundsLabel(bounds: RoomActionBounds, structure: RoomEventGraph): RoomActionRowLabel {
  const { spawn, enabler } = bounds;
  const wheel = (
    kind: 'beforeWheelPhase' | 'beforeWheelChoice' | 'afterWheelPhase',
    wheelKey: string,
  ): RoomActionRowLabel => {
    const phaseKey = phaseOfWheel(structure, wheelKey);
    return Object.freeze({ kind, wheelKey, ...(phaseKey === undefined ? {} : { phaseKey }) });
  };
  if (enabler?.kind === 'doorsOpened' || enabler?.kind === 'exitsReady')
    return Object.freeze({ kind: 'afterDoorsOpen' });
  if (enabler?.kind === 'gate') {
    const wheelKey = wheelOfPhase(structure, enabler.phaseKey);
    return wheelKey === undefined
      ? Object.freeze({ kind: 'beforeCombat' })
      : wheel('beforeWheelPhase', wheelKey);
  }
  switch (spawn.kind) {
    case 'wheelsOpen':
      return wheel('beforeWheelChoice', spawn.wheelKey);
    case 'endEffects': {
      // A Fields cage's due pickups stand with the room's free cage rows.
      if (cagePhase(structure, spawn.phaseKey)) return Object.freeze({ kind: 'fields' });
      const next = nextWheelsOpen(structure, spawn.phaseKey)?.phaseKey;
      return Object.freeze({
        kind: 'afterEncounterEnd',
        phaseKey: spawn.phaseKey,
        ...(next === undefined ? {} : { beforeWheelChoicePhaseKey: next }),
      });
    }
    case 'encounterEnd': {
      const wheelKey = wheelOfPhase(structure, spawn.phaseKey);
      if (wheelKey !== undefined) return wheel('afterWheelPhase', wheelKey);
      return Object.freeze({ kind: fieldsRoom(structure) ? 'fields' : 'afterCombat' });
    }
    default:
      return Object.freeze({ kind: fieldsRoom(structure) ? 'fields' : 'afterCombat' });
  }
}

/**
 * The phase a row belongs to: a wheel phase's rows to it, an encounter's end
 * effects to that phase, or to the next one when its wheels open with them,
 * a Fields cage's rows to its cage, rows before Combat to that phase and
 * every other to the last.
 */
function boundsPhaseKey(bounds: RoomActionBounds, structure: RoomEventGraph): string | undefined {
  const last = structure.phases.at(-1)?.phaseKey;
  const { spawn, enabler } = bounds;
  if (enabler?.kind === 'gate')
    return playsPhase(structure, enabler.phaseKey) ? enabler.phaseKey : undefined;
  if (enabler !== undefined) return last;
  switch (spawn.kind) {
    case 'wheelsOpen':
      return phaseOfWheel(structure, spawn.wheelKey);
    case 'endEffects':
      return playsPhase(structure, spawn.phaseKey)
        ? (nextWheelsOpen(structure, spawn.phaseKey)?.phaseKey ?? spawn.phaseKey)
        : undefined;
    case 'encounterEnd':
      return playsPhase(structure, spawn.phaseKey) &&
        (fieldsRoom(structure) || wheelOfPhase(structure, spawn.phaseKey) !== undefined)
        ? spawn.phaseKey
        : last;
    default:
      return last;
  }
}

/**
 * Classifies existing obligations and names each row's phase and label; it
 * does not add ordering or participation constraints.
 */
export function withRequiredScopes(
  rows: readonly RoomActionRowFacts[],
  structure: RoomEventGraph,
): readonly RoomActionRow[] {
  const phaseBound = new Set<string>();
  const active = rows.filter(
    (row) => !row.stale && (row.participation === 'required' || row.rank !== null),
  );
  const place = roomEventPlaces(structure);
  const last = structure.phases.at(-1)?.phaseKey;
  const roomEnd =
    last === undefined ? 1 : place(Object.freeze({ kind: 'encounterEnd', phaseKey: last }));
  const fields = fieldsRoom(structure);
  for (const row of active) {
    const label = boundsLabel(row.bounds, structure);
    if (
      row.reference.kind === 'completeFieldsCage' ||
      label.kind === 'beforeWheelPhase' ||
      label.kind === 'beforeWheelChoice' ||
      label.kind === 'afterWheelPhase' ||
      (!fields &&
        label.kind !== 'afterDoorsOpen' &&
        structure.phases.length > 0 &&
        place(roomActionOpeningPoint(row.bounds)) < roomEnd)
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
      delete row.phaseKey;
      const phaseKey = boundsPhaseKey(row.bounds, structure);
      return Object.freeze({
        ...row,
        ...(phaseKey === undefined ? {} : { phaseKey }),
        label: boundsLabel(row.bounds, structure),
        ...(row.stale || row.participation !== 'required'
          ? {}
          : {
              requiredScope: phaseBound.has(row.key) ? ('phase' as const) : ('room' as const),
            }),
      });
    }),
  );
}
