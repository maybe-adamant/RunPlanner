import { semanticAddressKey } from '../../authored-project/addresses';
import type { RerollRoomAction } from '../../authored-project/model';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalHubDecision,
} from '../../simulation/materialization';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import type { ExecutionReroll, ExecutionRoomGuideDescription } from '../model';
import { executionRewardFromOffer } from './overview';

/** One room reroll as the game steers it: its target and the reward of its redraw. */
export function executionReroll(
  room: CanonicalAuthoredRoom,
  batch: CanonicalBatch | undefined,
  reroll: RerollRoomAction,
): Omit<ExecutionReroll, 'owner'> {
  const target = reroll.target;
  const missing = (): never => {
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} reroll ${reroll.rerollId} lacks its target`,
    );
  };
  if (target.kind === 'wheelOffer') {
    const wheel = room.rewardWheels?.find((candidate) => candidate.wheelKey === target.wheelKey);
    if (wheel === undefined) return missing();
    return Object.freeze({
      target: Object.freeze({ ...target }),
      reward: executionRewardFromOffer(reroll.reward, wheel.producerLifecycleKey, wheel.storeKey),
    });
  }
  const door = batch?.targets.find(
    (candidate) =>
      candidate.origin.exitKey === target.exitKey &&
      candidate.room.occurrenceId === target.occurrenceId,
  );
  if (door === undefined) return missing();
  if (target.kind === 'cage') {
    const cages = door.room.localRewards?.filter((reward) => reward.groupKey === 'cages') ?? [];
    const index = cages.findIndex((cage) => cage.slotKey === target.slotKey);
    const cage = cages[index];
    if (cage === undefined) return missing();
    return Object.freeze({
      target: Object.freeze({ kind: 'cage', exitKey: target.exitKey, cageIndex: index + 1 }),
      reward: executionRewardFromOffer(
        reroll.reward,
        cage.producerLifecycleKey,
        cage.resolvedStoreKey,
      ),
    });
  }
  const incoming = door.room.incomingReward;
  if (incoming === undefined) return missing();
  return Object.freeze({
    target: Object.freeze({ kind: 'door', exitKey: target.exitKey }),
    reward: executionRewardFromOffer(
      reroll.reward,
      incoming.producerLifecycleKey,
      incoming.resolvedStoreKey,
    ),
  });
}

/** The room's ranked rerolls in its action order. */
export function executionRoomRerolls(
  room: CanonicalAuthoredRoom,
  batch: CanonicalBatch | undefined,
): readonly ExecutionReroll[] | undefined {
  const rows = room.roomActionRoster.rows
    .filter((row) => !row.stale && row.rank !== null && row.reference.kind === 'reroll')
    .sort((left, right) => left.rank! - right.rank!);
  if (rows.length === 0) return undefined;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        owner: semanticAddressKey(row.owner),
        ...executionReroll(room, batch, row.reference as RerollRoomAction),
      }),
    ),
  );
}

/** A room guide row's reroll description. */
export function rerollGuideDescription(
  room: CanonicalAuthoredRoom,
  batch: CanonicalBatch | undefined,
  reroll: RerollRoomAction,
): ExecutionRoomGuideDescription {
  return Object.freeze({ kind: 'reroll', ...executionReroll(room, batch, reroll) });
}

/** The Hub's board rerolls; each draws from its slot room's store. */
export function executionHubRerolls(
  hub: CanonicalHubDecision,
): NonNullable<NonNullable<import('../model').ExecutionOverview['hub']>['rerolls']> | undefined {
  if (hub.rerolls.length === 0) return undefined;
  return Object.freeze(
    hub.rerolls.map((reroll) => {
      const incoming = hub.board.targets.find((target) => target.hubSlotKey === reroll.hubSlotKey)
        ?.room.incomingReward;
      if (incoming === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `Hub reroll ${reroll.origin.rerollId} lacks its slot`,
        );
      return Object.freeze({
        owner: semanticAddressKey(reroll.origin),
        slotKey: reroll.hubSlotKey,
        reward: executionRewardFromOffer(
          reroll.reward,
          incoming.producerLifecycleKey,
          incoming.resolvedStoreKey,
        ),
      });
    }),
  );
}
