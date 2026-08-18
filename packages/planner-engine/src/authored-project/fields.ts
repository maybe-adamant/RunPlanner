import type { BiomeLayout, Catalog, RoomDeclaration } from '../catalog-schema';
import type { BiomeTopology, ExitDecision, OccurrenceId } from './model';
import { normalDecisionProgressionForLayout } from './topology/query';

function fieldsCageCapacity(room: RoomDeclaration): number {
  const cages = room.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.key === 'cages',
  );
  if (cages?.kind !== 'boundedRewardSlots')
    throw new Error(`${room.gameName} has no Fields cage capacity`);
  return cages.maxActiveSlots;
}

export function deriveFieldsActiveCageCount(
  decision: ExitDecision,
  policy: { readonly minDoorCageRewards: number; readonly maxDoorCageRewards: number },
  targetCapacities: readonly number[],
): number | undefined {
  if (decision.normal.kind !== 'batch' || decision.normal.batchState === null) return undefined;
  if (targetCapacities.some((capacity) => !Number.isInteger(capacity) || capacity <= 0)) {
    throw new Error('Fields target capacities must be positive integers');
  }
  return decision.normal.batchState.cageOutcome === 'min'
    ? policy.minDoorCageRewards
    : Math.min(policy.maxDoorCageRewards, ...targetCapacities);
}

export function fieldsDefaultActiveCageCount(options: {
  readonly catalog: Catalog;
  readonly layout: BiomeLayout;
  readonly topology: BiomeTopology;
  readonly decision: ExitDecision;
  readonly room: RoomDeclaration;
  readonly replacingOccurrenceId?: OccurrenceId;
}): number | undefined {
  const { catalog, layout, topology, decision, room, replacingOccurrenceId } = options;
  if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') return undefined;
  const progression = normalDecisionProgressionForLayout(layout);
  if (
    progression?.batchPolicy.kind !== 'fields' ||
    decision.normal.kind !== 'batch' ||
    decision.normal.batchState === null
  ) {
    throw new Error(`${room.gameName} has no selected Fields batch outcome`);
  }
  const policy = progression.batchPolicy;
  const targetCapacities = decision.normal.targets.map((target) => {
    if (target.occurrenceId === replacingOccurrenceId) return fieldsCageCapacity(room);
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === target.occurrenceId,
    );
    const targetRoom =
      occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
    return targetRoom?.mode.kind === 'authored' && targetRoom.mode.templateKey === 'FieldsCombat'
      ? fieldsCageCapacity(targetRoom)
      : policy.maxDoorCageRewards;
  });
  if (replacingOccurrenceId === undefined) targetCapacities.push(fieldsCageCapacity(room));
  return deriveFieldsActiveCageCount(decision, policy, targetCapacities);
}
