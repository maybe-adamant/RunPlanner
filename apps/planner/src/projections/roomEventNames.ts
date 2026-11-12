import type { RoomEventPoint } from '@run-planner/engine/authored-project';

/** Each room event as its Timeline marker reads. */
export const roomEventMarker = Object.freeze({
  roomEntered: 'Room entered',
  encounterBegun: 'Encounter',
  encounterStarted: 'Combat',
  encounterEnd: 'Encounter ended',
  bossDefeated: 'Boss defeated',
  wheelsOpen: 'Wheels open',
  doorsOpened: 'Doors open',
} as const);

/** A marker of one phase in a room of several, as its banner names it. */
export function phaseMarker(marker: string, phaseLabel: string | undefined): string {
  return phaseLabel === undefined ? marker : `${marker} · ${phaseLabel}`;
}

/** How a room's phases are named where a point belongs to one of them. */
export interface RoomEventPhaseNames {
  readonly label: (phaseKey: string) => string;
  /** More than one phase plays, so a phase's point names its phase. */
  readonly multiPhase: boolean;
  /** A Ship's phases: its Combat is named by the phase alone. */
  readonly ship: boolean;
  readonly phaseOfWheel: (wheelKey: string) => string | undefined;
  /** The phase's Combat starts as its wheel is chosen. */
  readonly choosesWheel: (phaseKey: string) => boolean;
}

/**
 * A bound's point, named as its Timeline marker or the choice it waits on.
 * Without the room's phases, a phase's point is named by its marker alone.
 */
export function roomEventPointName(point: RoomEventPoint, phases?: RoomEventPhaseNames): string {
  const phase = (phaseKey: string) =>
    phases?.multiPhase === true ? phases.label(phaseKey) : undefined;
  switch (point.kind) {
    case 'roomEntered':
      return roomEventMarker.roomEntered;
    case 'wheelsOpen': {
      const phaseKey = phases?.phaseOfWheel(point.wheelKey);
      return phaseMarker(
        roomEventMarker.wheelsOpen,
        phaseKey === undefined ? undefined : phases!.label(phaseKey),
      );
    }
    case 'gate': {
      if (phases?.choosesWheel(point.phaseKey) === true)
        return `choosing the ${phases.label(point.phaseKey)} wheel`;
      const label = phase(point.phaseKey);
      return label === undefined
        ? roomEventMarker.encounterBegun
        : `${label}'s ${roomEventMarker.encounterBegun}`;
    }
    case 'encounterStarted': {
      const label = phase(point.phaseKey);
      return label === undefined
        ? roomEventMarker.encounterStarted
        : phases!.ship
          ? label
          : `${label}'s ${roomEventMarker.encounterStarted}`;
    }
    case 'encounterEnd':
    case 'endEffects':
      return phaseMarker(roomEventMarker.encounterEnd, phase(point.phaseKey));
    case 'doorsOpened':
      return roomEventMarker.doorsOpened;
    case 'exitsReady':
      return 'the last required action';
    case 'leave':
      return 'Leave';
  }
}
