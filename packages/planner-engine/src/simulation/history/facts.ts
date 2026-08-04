import { semanticAddressKey } from '../../authored-project/addresses';
import type { RoomHistoryOrigin } from '../lifecycle';
import type { ResolvedEncounterPhase } from '../encounters/model';
import type { EncounterHistoryEntry, HistoryStateView } from './model';

export interface RecentEncounterEnvelopeSlotFact {
  readonly envelopeKey: string;
  readonly slotKeys: readonly string[];
}

/**
 * The room preparation event establishes the lifecycle checkpoint at which
 * encounter identities are recorded. It has no ledger effect of its own, but
 * it occupies a real canonical sequence position before every preparation
 * record. Keeping that position in the transient evaluator prevents later
 * phase support and finding evidence from describing a checkpoint one event
 * earlier than the composed history.
 */
export function projectRoomPreparationCheckpoint(view: HistoryStateView): HistoryStateView {
  return Object.freeze({
    sequence: view.sequence + 1,
    ledgers: view.ledgers,
  });
}

/**
 * An immutable preparation checkpoint for a later phase in the same room.
 * It carries only the exact record facts that the earlier valid phase will
 * publish at the canonical preparation checkpoint. Starts, completions,
 * counters, room appearance, and all reward effects deliberately remain the
 * predecessor values.
 *
 * This is a transient evaluator view, not a second history ledger: when the
 * enclosing room remains executable, lifecycle composition emits the same
 * preparation and record events into the single canonical fold. When a later
 * phase blocks, composition emits precisely that preparation-and-record
 * prefix and nothing else.
 */
export function projectEncounterRecordPreparation(
  view: HistoryStateView,
  origin: RoomHistoryOrigin,
  gameName: string,
  phase: ResolvedEncounterPhase,
): HistoryStateView {
  const sequence = view.sequence + 1;
  const entry: EncounterHistoryEntry = Object.freeze({
    sequence,
    origin,
    gameName,
    encounterEnvelopeKey: phase.envelopeKey,
    slotKey: phase.slotKey,
    encounterKey: phase.encounterKey,
    phaseKind: phase.kind,
  });
  return Object.freeze({
    sequence,
    ledgers: Object.freeze({
      ...view.ledgers,
      encounterRecords: Object.freeze([...view.ledgers.encounterRecords, entry]),
    }),
  });
}

export function projectRecentEncounterEnvelopeSlots(
  view: HistoryStateView,
): readonly RecentEncounterEnvelopeSlotFact[] {
  const ordered = new Map<string, { readonly envelopeKey: string; readonly slotKeys: string[] }>();
  for (const encounter of view.ledgers.encounterStarts) {
    const key = semanticAddressKey(encounter.origin);
    const current = ordered.get(key);
    if (current === undefined) {
      ordered.set(key, {
        envelopeKey: encounter.encounterEnvelopeKey,
        slotKeys: [encounter.slotKey],
      });
    } else {
      current.slotKeys.push(encounter.slotKey);
    }
  }
  return Object.freeze(
    [...ordered.values()].map((entry) =>
      Object.freeze({ envelopeKey: entry.envelopeKey, slotKeys: Object.freeze(entry.slotKeys) }),
    ),
  );
}
