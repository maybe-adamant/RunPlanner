import { roomActionKey } from '../../authored-project/room-actions/state';
import {
  windowAnchor,
  type RoomActionBounds,
  type RoomActionWindow,
  type RoomEventGraph,
  type RoomEventPoint,
} from '../../authored-project/room-actions/event-graph';
import type { RoomActionRow, RoomActionRowLabel } from './model';

/** A row before its phase, label and required scope are named. */
export type RoomActionRowFacts = Omit<RoomActionRow, 'label' | 'bounds'> & {
  readonly label?: RoomActionRowLabel;
  readonly bounds?: RoomActionBounds;
};

const point = <Point extends RoomEventPoint>(value: Point): Point => Object.freeze(value);

function windowBounds(row: RoomActionRowFacts, structure: RoomEventGraph): RoomActionBounds {
  const phases = structure.phases;
  const first = phases[0]?.phaseKey;
  const last = phases.at(-1)?.phaseKey;
  const doors = point({ kind: 'doorsOpened' });
  const entered = point({ kind: 'roomEntered' });
  const wheelPhase = (wheelKey: string) =>
    phases.find((phase) => phase.rewardWheelKey === wheelKey)?.phaseKey ?? wheelKey;
  const window = row.window;
  let bounds: RoomActionBounds = { spawn: entered, deadline: doors };
  switch (window.kind) {
    case 'standard':
      bounds =
        window.phase === 'beforeCombat' && first !== undefined
          ? {
              spawn: entered,
              enabler: point({ kind: 'gate', phaseKey: first }),
              deadline: point({ kind: 'encounterStarted', phaseKey: first }),
            }
          : {
              spawn: last === undefined ? entered : point({ kind: 'encounterEnd', phaseKey: last }),
              deadline: doors,
            };
      break;
    case 'encounterEnd': {
      const next = nextWheelPhaseKey(window.phaseKey, structure);
      bounds = {
        spawn: point({ kind: 'endEffects', phaseKey: window.phaseKey }),
        deadline: next === undefined ? doors : point({ kind: 'gate', phaseKey: next }),
      };
      break;
    }
    case 'fields':
      bounds = {
        spawn:
          window.phaseKey === undefined
            ? entered
            : point({ kind: 'encounterEnd', phaseKey: window.phaseKey }),
        deadline: doors,
      };
      break;
    case 'postOutgoing':
      bounds = { spawn: entered, enabler: doors, deadline: point({ kind: 'leave' }) };
      break;
    case 'shipPreCombat':
      bounds = {
        spawn: point({ kind: 'wheelsOpen', wheelKey: window.wheelKey }),
        enabler: point({ kind: 'gate', phaseKey: wheelPhase(window.wheelKey) }),
        deadline: point({ kind: 'encounterStarted', phaseKey: wheelPhase(window.wheelKey) }),
      };
      break;
    case 'shipWheelsOpen':
      bounds = {
        spawn: point({ kind: 'wheelsOpen', wheelKey: window.wheelKey }),
        deadline: point({ kind: 'gate', phaseKey: wheelPhase(window.wheelKey) }),
      };
      break;
    case 'shipPostCombat':
      bounds = {
        spawn: point({ kind: 'encounterEnd', phaseKey: wheelPhase(window.wheelKey) }),
        deadline: point({ kind: 'endEffects', phaseKey: wheelPhase(window.wheelKey) }),
      };
      break;
  }
  if (
    row.dependencies.some(
      (dependency) =>
        dependency.kind === 'afterCheckpoint' && dependency.checkpointKey === 'exitUsable',
    )
  )
    bounds = { ...bounds, enabler: point({ kind: 'exitsReady' }) };
  return Object.freeze(bounds);
}

/** The phase whose wheel opens after this phase ends, when one does. */
function nextWheelPhaseKey(phaseKey: string, structure: RoomEventGraph): string | undefined {
  const index = structure.phases.findIndex((phase) => phase.phaseKey === phaseKey);
  const next = index < 0 ? undefined : structure.phases[index + 1];
  return next?.rewardWheelKey === undefined ? undefined : next.phaseKey;
}

function wheelPhaseKey(wheelKey: string, structure: RoomEventGraph): string | undefined {
  return structure.phases.find((phase) => phase.rewardWheelKey === wheelKey)?.phaseKey;
}

/** A Ship phase's end-effect pickups wait for the next wheel, so they belong to its phase. */
function rowPhaseKey(window: RoomActionWindow, structure: RoomEventGraph): string | undefined {
  const phases = structure.phases;
  switch (window.kind) {
    case 'encounterEnd':
      return phases.some((phase) => phase.phaseKey === window.phaseKey)
        ? (nextWheelPhaseKey(window.phaseKey, structure) ?? window.phaseKey)
        : undefined;
    case 'shipPreCombat':
    case 'shipWheelsOpen':
    case 'shipPostCombat':
      return wheelPhaseKey(window.wheelKey, structure);
    case 'standard':
      return (window.phase === 'beforeCombat' ? phases[0] : phases.at(-1))?.phaseKey;
    case 'fields':
      return window.phaseKey !== undefined &&
        phases.some((phase) => phase.phaseKey === window.phaseKey)
        ? window.phaseKey
        : phases.at(-1)?.phaseKey;
    case 'postOutgoing':
      return phases.at(-1)?.phaseKey;
  }
}

function rowLabel(window: RoomActionWindow, structure: RoomEventGraph): RoomActionRowLabel {
  const wheel = (
    kind: 'beforeWheelPhase' | 'beforeWheelChoice' | 'afterWheelPhase',
    wheelKey: string,
  ): RoomActionRowLabel => {
    const phaseKey = wheelPhaseKey(wheelKey, structure);
    return Object.freeze({ kind, wheelKey, ...(phaseKey === undefined ? {} : { phaseKey }) });
  };
  switch (window.kind) {
    case 'standard':
      return Object.freeze({ kind: window.phase });
    case 'encounterEnd': {
      const next = nextWheelPhaseKey(window.phaseKey, structure);
      return Object.freeze({
        kind: 'afterEncounterEnd',
        phaseKey: window.phaseKey,
        ...(next === undefined ? {} : { beforeWheelChoicePhaseKey: next }),
      });
    }
    case 'fields':
      return Object.freeze({ kind: 'fields' });
    case 'postOutgoing':
      return Object.freeze({ kind: 'afterDoorsOpen' });
    case 'shipPreCombat':
      return wheel('beforeWheelPhase', window.wheelKey);
    case 'shipWheelsOpen':
      return wheel('beforeWheelChoice', window.wheelKey);
    case 'shipPostCombat':
      return wheel('afterWheelPhase', window.wheelKey);
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
  const roomEnd = windowAnchor({ kind: 'standard', phase: 'afterCombat' }, structure);
  for (const row of active) {
    const window = row.window;
    if (
      row.reference.kind === 'completeFieldsCage' ||
      window.kind === 'shipPreCombat' ||
      window.kind === 'shipWheelsOpen' ||
      window.kind === 'shipPostCombat' ||
      (window.kind !== 'fields' &&
        window.kind !== 'postOutgoing' &&
        structure.phases.length > 0 &&
        windowAnchor(window, structure) < roomEnd) ||
      row.dependencies.some(
        (dependency) =>
          dependency.kind === 'beforeCheckpoint' &&
          structure.phases.some((phase) => dependency.checkpointKey === `combat:${phase.phaseKey}`),
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
      delete row.phaseKey;
      delete row.bounds;
      const phaseKey = rowPhaseKey(row.window, structure);
      return Object.freeze({
        ...row,
        ...(phaseKey === undefined ? {} : { phaseKey }),
        label: rowLabel(row.window, structure),
        bounds: windowBounds(row, structure),
        ...(row.stale || row.participation !== 'required'
          ? {}
          : {
              requiredScope: phaseBound.has(row.key) ? ('phase' as const) : ('room' as const),
            }),
      });
    }),
  );
}
