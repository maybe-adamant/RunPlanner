import type { BiomeHistoryPrefix, HistoryStateView, ProgressiveRoomHistoryViews } from './model';

/**
 * The selected history through one completed event sequence. Every view the
 * fold recorded for a later event is dropped; nothing is refolded.
 */
export function biomeHistoryThrough(
  history: BiomeHistoryPrefix,
  through: number,
): BiomeHistoryPrefix {
  const reached = (view: HistoryStateView | undefined) =>
    view !== undefined && view.sequence <= through;
  // A pre-event view sits one sequence before the event that recorded it.
  const precedes = (view: HistoryStateView | undefined) =>
    view !== undefined && view.sequence < through;
  const viewsBySequence = Object.freeze(
    Object.fromEntries(
      Object.entries(history.viewsBySequence).filter(([sequence]) => Number(sequence) <= through),
    ),
  );
  const current =
    history.viewsBySequence[through] ??
    Object.values(viewsBySequence)
      .filter((view) => view.sequence <= through)
      .sort((left, right) => right.sequence - left.sequence)[0] ??
    history.biomeStart;
  const rooms = history.rooms
    .filter((room) => reached(room.entry))
    .map((room): ProgressiveRoomHistoryViews => {
      const offerPoints = (room.offerPoints ?? [])
        .filter((point) => reached(point.after))
        .map((point) => {
          if (reached(point.acquisitionAfter)) return point;
          const { acquisitionBefore, acquisitionAfter, ...materialized } = point;
          void acquisitionBefore;
          void acquisitionAfter;
          return Object.freeze(materialized);
        });
      const acquisitionPoints = (room.acquisitionPoints ?? []).filter((point) =>
        reached(point.after),
      );
      const targetGenerations = room.targetGenerations.filter((generation) =>
        reached(generation.after),
      );
      return Object.freeze({
        origin: room.origin,
        preparation: room.preparation,
        entry: room.entry,
        encounterStarts: Object.freeze(
          room.encounterStarts.filter((start) => precedes(start.before)),
        ),
        ...(offerPoints.length === 0 ? {} : { offerPoints: Object.freeze(offerPoints) }),
        ...(acquisitionPoints.length === 0
          ? {}
          : { acquisitionPoints: Object.freeze(acquisitionPoints) }),
        ...(precedes(room.preOutgoing) ? { preOutgoing: room.preOutgoing } : {}),
        targetGenerations: Object.freeze(targetGenerations),
        ...(reached(room.outgoingGeneration)
          ? { outgoingGeneration: room.outgoingGeneration }
          : {}),
        ...(reached(room.postCommit) ? { postCommit: room.postCommit } : {}),
        ...(reached(room.exit) ? { exit: room.exit } : {}),
      });
    });
  return Object.freeze({
    routeKey: history.routeKey,
    biomeKey: history.biomeKey,
    events: Object.freeze(history.events.filter((event) => event.sequence <= through)),
    ledgers: current.ledgers,
    viewsBySequence,
    biomeStart: history.biomeStart,
    rooms: Object.freeze(rooms),
    current,
  });
}
