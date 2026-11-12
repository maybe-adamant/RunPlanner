/**
 * The stages of a room's walk, in order; every history event records the
 * stage it was emitted under as its `operationIndex`. The Overview is every
 * stage through the room's entry and its offer point.
 */
export const ROOM_WALK_STAGES = Object.freeze({
  prepare: 0,
  offerBeforeEntry: 1,
  enter: 2,
  offerAfterEntry: 3,
  requiredObjectsSpawn: 4,
  encounters: 6,
  afterCombat: 7,
  doorsOpened: 8,
  leave: 9,
  exit: 10,
} as const);

/** The first stage of a room's Timeline. */
export const ROOM_TIMELINE_STAGE = ROOM_WALK_STAGES.requiredObjectsSpawn;
