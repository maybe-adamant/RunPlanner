import { semanticAddressKey } from '../../authored-project/addresses';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../simulation/materialization';
import type { ExecutionDoorTarget, ExecutionDoors, ExecutionReward } from '../model';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';

interface ExecutionDoorsInput {
  readonly room: CanonicalAuthoredRoom;
  readonly batches: ReadonlyMap<string, CanonicalBatch>;
  readonly fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>;
  readonly crossBiomeTarget: CanonicalAuthoredRoom | undefined;
  readonly crossBiomeSourceId: string | undefined;
  readonly rewardForRoom: (room: CanonicalAuthoredRoom) => ExecutionReward | undefined;
}

export function assembleExecutionDoors({
  room,
  batches,
  fixedTargets,
  crossBiomeTarget,
  crossBiomeSourceId,
  rewardForRoom,
}: ExecutionDoorsInput): ExecutionDoors {
  const owner = semanticAddressKey(room.origin);
  const batch = batches.get(owner);
  if (batch !== undefined) {
    if (batch.selectedExitKey === null && batch.additional.length === 0)
      throw new CompilerError('openingSelectionMissing', `${room.gameName} has no selected exit`);
    const targets: readonly ExecutionDoorTarget[] = Object.freeze(
      batch.targets.map((target) => {
        const reward = rewardForRoom(target.room);
        return Object.freeze({
          exitKey: target.exit.exitKey,
          index: target.exit.index,
          room: Object.freeze({
            id: target.room.occurrenceId,
            biomeKey: target.room.origin.biomeKey,
            gameName: target.room.gameName,
          }),
          ...(reward === undefined ? {} : { reward }),
        });
      }),
    );
    const automaticContinuation =
      targets.length === 1 &&
      batch.additional.length === 0 &&
      batch.targets[0]?.exit.kind === 'available' &&
      batch.targets[0].exit.behavior.kind === 'automaticHostContinuation';
    if (automaticContinuation) {
      const target = targets[0]!.room;
      return Object.freeze({
        owner: semanticAddressKey(batch.origin),
        kind: 'fixed',
        target: Object.freeze({ ...target }),
      });
    }
    return Object.freeze({
      owner: semanticAddressKey(batch.origin),
      kind: 'batch',
      targets,
      ...(batch.resolvedSharedRewardStoreKey === undefined
        ? {}
        : { resolvedSharedRewardStoreKey: batch.resolvedSharedRewardStoreKey }),
    });
  }
  const fixed =
    fixedTargets.get(owner) ?? (owner === crossBiomeSourceId ? crossBiomeTarget : undefined);
  if (fixed !== undefined)
    return Object.freeze({
      owner,
      kind: 'fixed',
      target: Object.freeze({
        id: fixed.occurrenceId,
        biomeKey: fixed.origin.biomeKey,
        gameName: fixed.gameName,
      }),
    });
  return Object.freeze({ owner, kind: 'terminal' });
}
