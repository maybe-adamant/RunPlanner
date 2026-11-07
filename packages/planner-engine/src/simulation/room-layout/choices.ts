import type { RoomLayout } from '../../authored-project/model';
import type { RoomEntryOption } from './derivation';
import type { RoomLayoutSettlement } from './settlement';

/** The entries the settled layout lets the game pick, each with the flip it needs. */
export function roomEntryOptions(settlement: RoomLayoutSettlement): readonly RoomEntryOption[] {
  const entry = settlement.entry;
  return entry.kind === 'choice' ? entry.eligible : entry.kind === 'unknown' ? [] : [entry.point];
}

/**
 * The layout that picks an entry (null leaves it to the game): an entry that
 * needs one flip of a roll sets that flip, else the authored roll is kept.
 */
export function layoutWithEntry(
  settlement: RoomLayoutSettlement,
  authored: RoomLayout | undefined,
  entryStartPointId: number | null,
): RoomLayout {
  const roll = settlement.flip.kind === 'roll';
  const needed = roomEntryOptions(settlement).find(
    (option) => option.startPointId === entryStartPointId,
  )?.flipped;
  const flipped = roll ? (needed ?? authored?.flipped) : undefined;
  return Object.freeze({
    ...(flipped === undefined ? {} : { flipped }),
    ...(entryStartPointId === null ? {} : { entryStartPointId }),
  });
}

/** The layout that picks a rolled flip, dropping an authored entry the flip rules out. */
export function layoutWithFlip(
  settlement: RoomLayoutSettlement,
  authored: RoomLayout | undefined,
  flipped: boolean,
): RoomLayout {
  const start = authored?.entryStartPointId;
  const option = roomEntryOptions(settlement).find((entry) => entry.startPointId === start);
  const kept =
    start !== undefined &&
    option !== undefined &&
    (option.flipped === undefined || option.flipped === flipped);
  return Object.freeze({ flipped, ...(kept ? { entryStartPointId: start } : {}) });
}
