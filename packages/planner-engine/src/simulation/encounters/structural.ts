import { semanticAddressKey } from '../../authored-project/addresses';
import type {
  CanonicalAuthoredRoom,
  CanonicalBiome,
  CanonicalLocalChildRoom,
  MaterializedBiomePrefix,
} from '../materialization';

export type EncounterStructuralSnapshot =
  CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom });

export type EncounterStructuralRoom = CanonicalAuthoredRoom | CanonicalLocalChildRoom;

function decisions(snapshot: EncounterStructuralSnapshot) {
  const partialBatch =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? snapshot.frontier.partialBatch
      : undefined;
  return partialBatch === undefined
    ? snapshot.decisions
    : Object.freeze([...snapshot.decisions, partialBatch]);
}

/**
 * Returns editable room-local encounter owners in their authored traversal
 * order. Hub board declaration order is intentionally not traversal order:
 * only its ordered visits enter rooms, and each visit's local children follow
 * its parent before the next visit begins.
 */
export function structurallyActiveEncounterRooms(
  snapshot: EncounterStructuralSnapshot,
): readonly EncounterStructuralRoom[] {
  const rooms: EncounterStructuralRoom[] = [snapshot.entryRoom];
  for (const decision of decisions(snapshot)) {
    if (decision.kind === 'batch') {
      rooms.push(...decision.targets.map((target) => target.room));
      continue;
    }
    for (const visit of decision.visits) {
      rooms.push(visit.target.room, ...visit.enteredLocalRooms);
    }
  }
  const seen = new Set<string>();
  return Object.freeze(
    rooms.filter((room) => {
      if (!room.entered) return false;
      const key = semanticAddressKey(room.origin);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}
