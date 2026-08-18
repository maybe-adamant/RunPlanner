import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import type { ExitDecision, OccurrenceId, RoomOccurrence } from '../../authored-project/model';
import { deriveFieldsActiveCageCount } from '../../authored-project/fields';

import type { CanonicalTargetContinuation } from './model';

type OccurrenceLookup = (occurrenceId: OccurrenceId) => RoomOccurrence | undefined;

/** Complete declaration-derived result for one configured Fields batch. */
export interface FieldsBatchFacts {
  readonly cageOutcome: 'min' | 'max';
  readonly batchCapacity: number;
  readonly cageTargetCount: number;
  readonly doorCageRewardCount: number;
}

function requireOccurrence(
  occurrenceFor: OccurrenceLookup,
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrenceFor(occurrenceId);
  if (occurrence === undefined) {
    throw new Error(`trusted topology lost occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function requireRoom(catalog: Catalog, occurrence: RoomOccurrence): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    throw new Error(`trusted topology lost room ${occurrence.gameName}`);
  }
  return room;
}

/**
 * A batch becomes a takeover as soon as any target owns the normal doors.
 * This remains independent from workspace presentation's ordinary/mixed
 * grouping because it governs the semantic batch state itself.
 */
export function batchTakesOverNormalDoors(
  catalog: Catalog,
  occurrenceFor: OccurrenceLookup,
  decision: ExitDecision,
): boolean {
  return (
    decision.normal.kind === 'batch' &&
    decision.normal.targets.some((target) => {
      const room = requireRoom(catalog, requireOccurrence(occurrenceFor, target.occurrenceId));
      return room.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
    })
  );
}

/**
 * Whether a batch semantically owns the editable Fields outcome. The outcome
 * can be awaiting authoring, so this is intentionally distinct from the
 * configured facts below.
 */
export function fieldsBatchOwnsCageOutcome(
  catalog: Catalog,
  layout: BiomeLayout,
  occurrenceFor: OccurrenceLookup,
  decision: ExitDecision,
): boolean {
  return (
    layout.progression.kind === 'generated' &&
    layout.progression.batchPolicy.kind === 'fields' &&
    decision.normal.kind === 'batch' &&
    !batchTakesOverNormalDoors(catalog, occurrenceFor, decision)
  );
}

/**
 * Derive the configured Fields batch facts once from its authored targets.
 * Non-Fields bounded child declarations do not participate in this policy.
 */
export function fieldsBatchFacts(
  catalog: Catalog,
  layout: BiomeLayout,
  occurrenceFor: OccurrenceLookup,
  decision: ExitDecision,
): FieldsBatchFacts | undefined {
  if (
    !fieldsBatchOwnsCageOutcome(catalog, layout, occurrenceFor, decision) ||
    decision.normal.kind !== 'batch' ||
    decision.normal.batchState === null
  ) {
    return undefined;
  }
  if (layout.progression.kind !== 'generated' || layout.progression.batchPolicy.kind !== 'fields') {
    return undefined;
  }

  let batchCapacity = layout.progression.batchPolicy.maxDoorCageRewards;
  let cageTargetCount = 0;
  const targetCapacities: number[] = [];
  for (const target of decision.normal.targets) {
    const room = requireRoom(catalog, requireOccurrence(occurrenceFor, target.occurrenceId));
    if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') continue;
    const cages = room.localChildren[0];
    if (cages?.kind !== 'boundedRewardSlots' || cages.key !== 'cages') {
      throw new Error(`${room.gameName} has no Fields cage capacity`);
    }
    cageTargetCount += 1;
    targetCapacities.push(cages.maxActiveSlots);
    batchCapacity = Math.min(batchCapacity, cages.maxActiveSlots);
  }
  const cageOutcome = decision.normal.batchState.cageOutcome;
  const doorCageRewardCount = deriveFieldsActiveCageCount(
    decision,
    layout.progression.batchPolicy,
    targetCapacities,
  );
  if (doorCageRewardCount === undefined) {
    throw new Error('configured Fields batch lost its active cage count');
  }
  return Object.freeze({
    cageOutcome,
    batchCapacity,
    cageTargetCount,
    doorCageRewardCount,
  });
}

/** The canonical target path when no evaluated target overlay is available. */
export function targetContinuation(
  picked: boolean,
  roomKind: RoomDeclaration['kind'],
): CanonicalTargetContinuation {
  if (!picked) return 'deadLeaf';
  return roomKind === 'Preboss' ? 'startsCompletion' : 'continuesSpine';
}
