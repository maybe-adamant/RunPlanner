import type { AuthoredBiomePlan, OccurrenceId, RoomOccurrence } from '../../authored-project/model';
import type {
  BiomeMaterialization,
  CanonicalAdditionalContinuation,
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalDecision,
  CanonicalFixedRoomLink,
  CanonicalHubTarget,
  CanonicalTarget,
  MaterializedBiomePrefix,
} from './model';

/** The object itself when every update is already its value, else a frozen copy with them. */
function patched<T extends object>(value: T, updates: Partial<T>): T {
  const keys = Object.keys(updates) as (keyof T)[];
  if (keys.every((key) => value[key] === updates[key])) return value;
  const next: Partial<T> = { ...value };
  for (const key of keys) {
    if (updates[key] === undefined) delete next[key];
    else next[key] = updates[key];
  }
  return Object.freeze(next) as T;
}

/** The list itself when no element changed. */
function mapped<T>(list: readonly T[], map: (value: T) => T): readonly T[] {
  const next = list.map(map);
  return next.every((value, index) => value === list[index]) ? list : Object.freeze(next);
}

/**
 * Re-reads the materialized copies of a biome's stored positions (flip and
 * entry, object anchors, Fields points and Chaos gate spawn points) from a
 * plan that differs from the materialized one only in those positions.
 * Nothing the walk derived is touched, so it serves only a plan whose new
 * positions are the ones the walk already drew.
 */
export function withStoredPositions<Materialization extends BiomeMaterialization>(
  materialization: Materialization,
  plan: AuthoredBiomePlan,
): Materialization {
  const occurrences = new Map<OccurrenceId, RoomOccurrence>(
    (plan.topology?.occurrences ?? []).map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const room = <Room extends CanonicalAuthoredRoom>(value: Room): Room => {
    const occurrence = occurrences.get(value.occurrenceId);
    if (occurrence === undefined) return value;
    const state = occurrence.state;
    return patched<Room>(value, {
      layout: occurrence.layout,
      ...(value.purgingPool === undefined ? {} : { purgingPool: occurrence.purgingPool }),
      ...(value.hermesShrine === undefined ? {} : { hermesShrine: occurrence.hermesShrine }),
      ...(value.stygianWell === undefined ? {} : { stygianWell: occurrence.stygianWell }),
      ...(value.challengeSwitch === undefined
        ? {}
        : { challengeSwitch: occurrence.challengeSwitch }),
      ...(value.fieldsSpatial === undefined || !('spatial' in state)
        ? {}
        : { fieldsSpatial: state.spatial }),
    } as Partial<Room>);
  };
  const target = <Target extends CanonicalTarget | CanonicalHubTarget>(value: Target): Target =>
    patched<Target>(value, { room: room(value.room) } as Partial<Target>);
  const additional = (value: CanonicalAdditionalContinuation): CanonicalAdditionalContinuation => {
    const exit = occurrences
      .get(value.origin.occurrenceId)
      ?.additionalExits.find((candidate) => candidate.key === value.origin.additionalExitKey);
    return patched(value, {
      room: room(value.room),
      ...(exit?.kind === 'chaos' ? { spawnPointIndex: exit.spawnPointIndex } : {}),
    });
  };
  const batch = (value: CanonicalBatch): CanonicalBatch =>
    patched(value, {
      targets: mapped(value.targets, target),
      additional: mapped(value.additional, additional),
    });
  const decision = (value: CanonicalDecision): CanonicalDecision =>
    value.kind === 'batch'
      ? batch(value)
      : patched(value, {
          board: patched(value.board, { targets: mapped(value.board.targets, target) }),
          visits: mapped(value.visits, (visit) =>
            patched(visit, {
              target: target(visit.target),
              localSlots: mapped(visit.localSlots, room),
              enteredLocalRooms: mapped(visit.enteredLocalRooms, room),
            }),
          ),
        });
  const link = (value: CanonicalFixedRoomLink): CanonicalFixedRoomLink =>
    patched(value, { source: room(value.source), target: room(value.target) });
  const frontier = (
    value: NonNullable<MaterializedBiomePrefix['frontier']>,
  ): NonNullable<MaterializedBiomePrefix['frontier']> => {
    switch (value.kind) {
      case 'exitDecision':
        return patched(value, {
          targets: mapped(value.targets, target),
          additional: mapped(value.additional, additional),
          ...(value.partialBatch === undefined ? {} : { partialBatch: batch(value.partialBatch) }),
        });
      case 'hubVisit':
        return 'target' in value
          ? patched(value, {
              target: target(value.target),
              localSlots: mapped(value.localSlots, room),
              enteredLocalRooms: mapped(value.enteredLocalRooms, room),
            })
          : value;
      case 'hubBoard':
      case 'hubFountain':
        return value;
    }
  };
  const updates: Partial<BiomeMaterialization> = {
    ...(materialization.entryRoom === undefined
      ? {}
      : { entryRoom: room(materialization.entryRoom) }),
    decisions: mapped(materialization.decisions, decision),
    ...(materialization.fixedRoomLinks === undefined
      ? {}
      : { fixedRoomLinks: mapped(materialization.fixedRoomLinks, link) }),
    ...(materialization.kind === 'biomePrefix' && materialization.frontier !== undefined
      ? { frontier: frontier(materialization.frontier) }
      : {}),
  };
  return patched(materialization, updates as Partial<Materialization>);
}
