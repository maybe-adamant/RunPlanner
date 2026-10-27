import type { SemanticAddress } from '../../authored-project';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';
import { recordedOffer } from './vocabulary';

const rewardCodes: ReadonlySet<string> = new Set([
  'rewardMissing',
  'rewardBagEntryUnavailable',
  'rewardSourceUnavailable',
  'rewardAcquisitionUnavailable',
]);

const supported = (evaluation: { readonly kind: string }): boolean => {
  if (!('result' in evaluation)) return false;
  const result = evaluation.result as {
    readonly supported?: boolean;
    readonly findings?: unknown[];
  };
  return result.supported === true && (result.findings?.length ?? 0) === 0;
};

/** The reward a room's record names: the entered visit's own, else the door that offered it. */
export function recordedRoomOffer(
  context: RunImportContext,
  occurrenceId: string,
): ResolvedRewardOffer | undefined {
  const visits = context.occurrences.visitsOf(occurrenceId);
  if (visits.length > 0) {
    const index = visits[0]!;
    const own = recordedOffer(context.catalog, context.record.rooms[index]!.reward);
    if (own !== undefined) return own;
    // A room entered without collecting keeps the offer its door showed.
    const source = context.record.rooms[index - 1];
    return recordedOffer(
      context.catalog,
      source?.doors.find((door) => door.room === context.record.rooms[index]!.name)?.reward,
    );
  }
  const match = /-r(\d+)-d(\d+)$/.exec(occurrenceId);
  if (match === null) return undefined;
  const door = context.record.rooms[Number(match[1])]?.doors.find(
    (candidate) => candidate.door === Number(match[2]),
  );
  return recordedOffer(context.catalog, door?.reward);
}

function rewardOf(context: RunImportContext, biomeKey: string, occurrenceId: string) {
  const state = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)?.state;
  return state !== undefined && 'reward' in state ? state.reward : undefined;
}

/** Answers a room's incoming reward and the run's starting reward from the record. */
export function answerReward(context: RunImportContext, reason: SemanticFinding): boolean {
  const origin: SemanticAddress = reason.origin;
  // An unauthored reward owns no actions yet; authoring it schedules them.
  const unauthored =
    reason.code === 'roomActionPlacementRequired' &&
    origin.kind === 'incomingReward' &&
    rewardOf(context, origin.biomeKey, origin.occurrenceId) === null;
  if (!rewardCodes.has(reason.code) && !unauthored) return false;
  if (origin.kind === 'startingReward') {
    const value = recordedOffer(context.catalog, context.record.rooms[0]?.reward);
    if (value === undefined) return false;
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'startingReward', reward: origin, value });
    if (
      supported(evaluation) &&
      context.apply({ kind: 'ReplaceStartingReward', reward: origin, value })
    )
      return true;
    context.refuse();
    return false;
  }
  if (origin.kind === 'incomingReward') {
    const value = recordedRoomOffer(context, origin.occurrenceId);
    if (value === undefined) return false;
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'incomingReward', reward: origin, value });
    if (
      supported(evaluation) &&
      context.apply({ kind: 'ReplaceIncomingReward', reward: origin, value })
    )
      return true;
    context.refuse();
    return false;
  }
  return false;
}
