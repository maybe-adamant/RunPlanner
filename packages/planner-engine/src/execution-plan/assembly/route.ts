import type { RunStateSnapshot } from '../../simulation/rewards/run-state';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../simulation/materialization';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation-products';
import { semanticAddressKey } from '../../authored-project/addresses';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { executionRoomOwnerKey } from './support';
import type { ExecutionAssemblerInput } from '../model';

export function executionRoomSnapshots(
  biome: CompleteValidBiomeProjectEvaluation,
): ReadonlyMap<string, RunStateSnapshot> {
  const result = new Map<string, RunStateSnapshot>();
  for (const snapshot of biome.rewards.runStateSnapshots) {
    result.set(semanticAddressKey(snapshot.owner), snapshot);
  }
  return result;
}

function addRoom(
  rooms: CanonicalAuthoredRoom[],
  seen: Set<string>,
  room: CanonicalAuthoredRoom,
): void {
  const key = executionRoomOwnerKey(room);
  if (seen.has(key)) return;
  seen.add(key);
  rooms.push(room);
}

export function orderedExecutionRooms(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): CanonicalAuthoredRoom[] {
  const rooms: CanonicalAuthoredRoom[] = [];
  const seen = new Set<string>();
  for (const evaluation of biomes) {
    const snapshot = evaluation.snapshot;
    addRoom(rooms, seen, snapshot.entryRoom);
    for (const decision of snapshot.decisions) {
      if (decision.kind !== 'batch') continue;
      for (const target of decision.targets) addRoom(rooms, seen, target.room);
      for (const additional of decision.additional) addRoom(rooms, seen, additional.room);
    }
    for (const link of snapshot.fixedRoomLinks) {
      addRoom(rooms, seen, link.source);
      addRoom(rooms, seen, link.target);
    }
  }
  return rooms;
}

export function executionBatchesByRoom(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): ReadonlyMap<string, CanonicalBatch> {
  const result = new Map<string, CanonicalBatch>();
  for (const evaluation of biomes) {
    for (const decision of evaluation.snapshot.decisions) {
      if (decision.kind !== 'batch' || decision.parent.origin.kind !== 'occurrence') continue;
      result.set(semanticAddressKey(decision.parent.origin), decision);
    }
  }
  return result;
}

export function executionFixedTargetsByRoom(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): ReadonlyMap<string, CanonicalAuthoredRoom> {
  const result = new Map<string, CanonicalAuthoredRoom>();
  for (const evaluation of biomes) {
    for (const link of evaluation.snapshot.fixedRoomLinks) {
      result.set(executionRoomOwnerKey(link.source), link.target);
    }
  }
  return result;
}

export function completeExecutionBiomes(
  assembly: ExecutionAssemblerInput['assembly'],
): CompleteValidBiomeProjectEvaluation[] {
  const route = assembly.evaluation.route;
  if (!route.summary.eligibleForExecutionPlan) {
    throw new CompilerError('notEligible', 'project evaluation is not eligible for execution');
  }
  const values: CompleteValidBiomeProjectEvaluation[] = [];
  for (const biome of route.biomes) {
    if (biome.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new CompilerError('notEligible', `${biome.biomeKey} is not complete-valid`);
    }
    values.push(biome);
  }
  return values;
}
