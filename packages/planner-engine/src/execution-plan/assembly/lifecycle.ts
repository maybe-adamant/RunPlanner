import {
  fieldsRoom,
  wheelOfPhase,
  type RoomActionBounds,
  type RoomEventGraph,
} from '../../authored-project/room-actions/event-graph';
import type { ExecutionLifecycleWindow } from '../model';

/**
 * The execution protocol's contact for a row, from its bounds; the first rule
 * that matches wins.
 */
export function wireWindow(
  bounds: RoomActionBounds,
  graph: RoomEventGraph,
): ExecutionLifecycleWindow {
  const { spawn, enabler } = bounds;
  const phaseWheel = (phaseKey: string) => wheelOfPhase(graph, phaseKey);
  // 1. Usable once the doors open.
  if (enabler?.kind === 'doorsOpened' || enabler?.kind === 'exitsReady')
    return Object.freeze({ kind: 'postOutgoing' });
  // 2. A wheel phase's gate (its choice), or what stands from its wheels' roll.
  const gateWheel = enabler?.kind === 'gate' ? phaseWheel(enabler.phaseKey) : undefined;
  if (gateWheel !== undefined) return Object.freeze({ kind: 'shipPreCombat', wheelKey: gateWheel });
  if (spawn.kind === 'wheelsOpen')
    return Object.freeze({ kind: 'shipPreCombat', wheelKey: spawn.wheelKey });
  // 3. A wheel phase's spoils, spawned as its fight ends.
  const spoilsWheel = spawn.kind === 'encounterEnd' ? phaseWheel(spawn.phaseKey) : undefined;
  if (spoilsWheel !== undefined)
    return Object.freeze({ kind: 'shipPostCombat', wheelKey: spoilsWheel });
  // 4. A Fields cage's freed reward and what its fight spawns share the cage's encounter end.
  if (spawn.kind === 'encounterEnd' && fieldsRoom(graph))
    return Object.freeze({ kind: 'encounterEnd', phaseKey: spawn.phaseKey });
  // 5. Spawned by another encounter's end effects.
  if (spawn.kind === 'endEffects')
    return Object.freeze({ kind: 'encounterEnd', phaseKey: spawn.phaseKey });
  // 6. The room's combat gate.
  if (enabler?.kind === 'gate') return Object.freeze({ kind: 'standard', phase: 'beforeCombat' });
  // 7. Everything else follows the room's combat.
  return Object.freeze({ kind: 'standard', phase: 'afterCombat' });
}
