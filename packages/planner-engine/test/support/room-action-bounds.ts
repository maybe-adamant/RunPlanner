import {
  nextWheelsOpen,
  roomFightsEnd,
  type RoomActionBounds,
  type RoomEventGraph,
  type RoomEventPoint,
} from '../../src/authored-project/room-actions/event-graph';
import type { RoomActionRowLabel } from '../../src/simulation/room-actions/model';

/** Where a test row stands, named like a published row label; a Fields row may name its cage. */
export type TestRowPlacement =
  | Exclude<RoomActionRowLabel, { readonly kind: 'fields' }>
  | { readonly kind: 'fields'; readonly phaseKey?: string };

const point = <Point extends RoomEventPoint>(value: Point): Point => Object.freeze(value);

/** The bounds a test row with this placement takes in the test's graph. */
export function boundsForPlacement(
  placement: TestRowPlacement,
  graph: RoomEventGraph,
): RoomActionBounds {
  const first = graph.phases[0]?.phaseKey ?? 'Encounter';
  const wheelPhase = (wheelKey: string) =>
    graph.phases.find((phase) => phase.rewardWheelKey === wheelKey)?.phaseKey ?? wheelKey;
  const doors = point({ kind: 'doorsOpened' });
  switch (placement.kind) {
    case 'afterDoorsOpen':
      return {
        spawn: point({ kind: 'roomEntered' }),
        enabler: doors,
        deadline: point({ kind: 'leave' }),
      };
    case 'afterCombat':
      return { spawn: roomFightsEnd(graph), deadline: doors };
    case 'beforeCombat':
      return {
        spawn: point({ kind: 'roomEntered' }),
        enabler: point({ kind: 'gate', phaseKey: first }),
        deadline: point({ kind: 'encounterStarted', phaseKey: first }),
      };
    case 'fields':
      return {
        spawn:
          !('phaseKey' in placement) || placement.phaseKey === undefined
            ? point({ kind: 'roomEntered' })
            : point({ kind: 'encounterEnd', phaseKey: placement.phaseKey }),
        deadline: doors,
      };
    case 'afterEncounterEnd': {
      const next = nextWheelsOpen(graph, placement.phaseKey)?.phaseKey;
      return {
        spawn: point({ kind: 'endEffects', phaseKey: placement.phaseKey }),
        deadline: next === undefined ? doors : point({ kind: 'gate', phaseKey: next }),
      };
    }
    case 'beforeWheelPhase':
      return {
        spawn: point({ kind: 'wheelsOpen', wheelKey: placement.wheelKey }),
        enabler: point({ kind: 'gate', phaseKey: wheelPhase(placement.wheelKey) }),
        deadline: point({ kind: 'encounterStarted', phaseKey: wheelPhase(placement.wheelKey) }),
      };
    case 'beforeWheelChoice':
      return {
        spawn: point({ kind: 'wheelsOpen', wheelKey: placement.wheelKey }),
        deadline: point({ kind: 'gate', phaseKey: wheelPhase(placement.wheelKey) }),
      };
    case 'afterWheelPhase':
      return {
        spawn: point({ kind: 'encounterEnd', phaseKey: wheelPhase(placement.wheelKey) }),
        deadline: point({ kind: 'endEffects', phaseKey: wheelPhase(placement.wheelKey) }),
      };
  }
}
