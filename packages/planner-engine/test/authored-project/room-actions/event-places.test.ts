import { describe, expect, it } from 'vitest';

import {
  nextWheelsOpen,
  roomEventPlaces,
  type RoomEventGraph,
  type RoomEventGraphPhase,
  type RoomEventPoint,
} from '../../../src/authored-project/room-actions/event-graph';
import type { EncounterScript } from '../../../src/catalog-schema';
import { testGraphEvents } from '../../support/event-graph';

const script = (waitReadyBeforeEnd: boolean): EncounterScript => ({
  beginTrigger: 'automatic',
  endEffects: 'run',
  records: true,
  generatedAt: 'preparation',
  gate: { kind: 'none' },
  waitReadyBeforeEnd,
  endsByInteraction: false,
  endsWithBossDefeated: false,
  hostsOutcome: [],
});

function graph(
  phases: readonly RoomEventGraphPhase[],
  options: { readonly generatesOutgoing?: boolean; readonly cages?: boolean } = {},
): RoomEventGraph {
  return {
    profileKey: 'test',
    activeEncounterSlotKeys: phases.map((phase) => phase.phaseKey),
    phases,
    pressFights: [],
    events: testGraphEvents(phases, {
      generatesOutgoing: options.generatesOutgoing ?? true,
      ...(options.cages === undefined ? {} : { cages: options.cages }),
    }),
  };
}

function points(room: RoomEventGraph): readonly RoomEventPoint[] {
  return [
    { kind: 'roomEntered' },
    ...room.phases.flatMap((phase): RoomEventPoint[] => [
      ...(phase.rewardWheelKey === undefined
        ? []
        : [{ kind: 'wheelsOpen' as const, wheelKey: phase.rewardWheelKey }]),
      { kind: 'gate', phaseKey: phase.phaseKey },
      { kind: 'encounterStarted', phaseKey: phase.phaseKey },
      { kind: 'encounterEnd', phaseKey: phase.phaseKey },
      { kind: 'endEffects', phaseKey: phase.phaseKey },
    ]),
    { kind: 'doorsOpened' },
    { kind: 'exitsReady' },
    { kind: 'leave' },
  ];
}

const name = (point: RoomEventPoint) =>
  'phaseKey' in point
    ? `${point.kind}:${point.phaseKey}`
    : 'wheelKey' in point
      ? `${point.kind}:${point.wheelKey}`
      : point.kind;

/**
 * The points the game makes simultaneous: a phase's end and its end effects
 * when its script does not wait for the room to be ready, a Ship phase's end
 * effects and the next phase's wheels, and the doors opening with the exits
 * ready. Row-placed phases (Fields cages) are ordered by their rows, not by
 * place: each of their points stands where its row opens.
 */
function simultaneous(room: RoomEventGraph, left: RoomEventPoint, right: RoomEventPoint): boolean {
  const pair = new Set([name(left), name(right)]);
  const has = (...names: string[]) => names.every((key) => pair.has(key));
  if (has('doorsOpened', 'exitsReady')) return true;
  const rowPlaced = (point: RoomEventPoint) =>
    room.phases.some(
      (phase) =>
        phase.standsAt !== undefined &&
        (('phaseKey' in point && point.phaseKey === phase.phaseKey) ||
          name(point) === name(phase.standsAt)),
    );
  if (rowPlaced(left) && rowPlaced(right)) return true;
  return room.phases.some((phase) => {
    const key = phase.phaseKey;
    const next = nextWheelsOpen(room, key);
    if (next !== undefined && has(`endEffects:${key}`, `wheelsOpen:${next.wheelKey}`)) return true;
    return (
      phase.script?.waitReadyBeforeEnd !== true && has(`encounterEnd:${key}`, `endEffects:${key}`)
    );
  });
}

const rooms: Readonly<Record<string, RoomEventGraph>> = {
  single: graph([{ phaseKey: 'Encounter', script: script(false) }]),
  doorless: graph([{ phaseKey: 'Encounter', script: script(false) }], { generatesOutgoing: false }),
  sequential: graph([
    { phaseKey: 'Intro', script: script(true) },
    { phaseKey: 'Combat', script: script(false) },
  ]),
  ship: graph([
    { phaseKey: 'Intro', script: script(true) },
    { phaseKey: 'Combat1', rewardWheelKey: 'wheel1', script: script(true) },
    { phaseKey: 'Combat2', rewardWheelKey: 'wheel2', script: script(true) },
  ]),
  fields: graph(
    ['Cage01', 'Cage02'].map((phaseKey) => ({
      phaseKey,
      script: script(false),
      standsAt: { kind: 'roomEntered' as const },
    })),
    { cages: true },
  ),
};

describe('room event places', () => {
  it.each(Object.entries(rooms))(
    'gives distinct points of a %s room distinct places unless the game makes them simultaneous',
    (_, room) => {
      const place = roomEventPlaces(room);
      const all = points(room);
      const shared = all.flatMap((left, index) =>
        all
          .slice(index + 1)
          .filter((right) => place(left) === place(right) && !simultaneous(room, left, right))
          .map((right) => `${name(left)} = ${name(right)}`),
      );
      expect(shared).toEqual([]);
    },
  );

  it('places waiting end effects after the encounter end, before the next phase', () => {
    const place = roomEventPlaces(rooms.sequential!);
    const end = place({ kind: 'encounterEnd', phaseKey: 'Intro' });
    const effects = place({ kind: 'endEffects', phaseKey: 'Intro' });
    expect(end).toBeLessThan(effects);
    expect(effects).toBeLessThan(place({ kind: 'gate', phaseKey: 'Combat' }));
  });
});
