import type { ProjectCommand, SemanticAddress } from '../../authored-project';
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
):
  | { readonly offer: ResolvedRewardOffer; readonly roomIndex: number; readonly exact: boolean }
  | undefined {
  const visits = context.occurrences.visitsOf(occurrenceId);
  if (visits.length > 0) {
    const index = visits[0]!;
    // A room entered without collecting keeps the offer its door showed.
    const source = context.record.rooms[index - 1];
    const offer =
      recordedOffer(context.catalog, context.record.rooms[index]!.reward) ??
      recordedOffer(
        context.catalog,
        source?.doors.find((door) => door.room === context.record.rooms[index]!.name)?.reward,
      );
    return offer === undefined ? undefined : devotionByPick(context, offer, index);
  }
  const offered = context.occurrences.offeredDoor(occurrenceId);
  if (offered === undefined) return undefined;
  const door = context.record.rooms[offered.roomIndex]?.doors.find(
    (candidate) => candidate.door === offered.door,
  );
  const offer = recordedOffer(context.catalog, door?.reward);
  return offer === undefined
    ? undefined
    : devotionByPick(context, offer, undefined, offered.roomIndex);
}

/**
 * A Trial's door lists its two gods as LootA/LootB, not by choice; the god
 * whose screen opens first is chosen before the fight, the other spurned
 * (`StartDevotionTest`, EncounterLogic.lua:1695-1707). A Trial never entered
 * shows no screen, so its order is not saved.
 */
function devotionByPick(
  context: RunImportContext,
  offer: ResolvedRewardOffer,
  enteredIndex: number | undefined,
  sourceIndex = (enteredIndex ?? 1) - 1,
): { readonly offer: ResolvedRewardOffer; readonly roomIndex: number; readonly exact: boolean } {
  const roomIndex = enteredIndex ?? sourceIndex;
  if (offer.payload?.kind !== 'DevotionPair') return { offer, roomIndex, exact: true };
  const { chosenSource, spurnedSource } = offer.payload;
  const first =
    enteredIndex === undefined
      ? undefined
      : context.record.rooms[enteredIndex]!.traitScreens.find(
          (screen) => screen.giver === chosenSource || screen.giver === spurnedSource,
        )?.giver;
  if (first === undefined) return { offer, roomIndex, exact: false };
  return {
    offer:
      first === spurnedSource
        ? {
            ...offer,
            payload: {
              kind: 'DevotionPair',
              chosenSource: spurnedSource,
              spurnedSource: chosenSource,
            },
          }
        : offer,
    roomIndex,
    exact: true,
  };
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
    const recorded = recordedRoomOffer(context, origin.occurrenceId);
    if (recorded === undefined) return false;
    const value = recorded.offer;
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'incomingReward', reward: origin, value });
    const command: ProjectCommand = { kind: 'ReplaceIncomingReward', reward: origin, value };
    if (supported(evaluation) && context.apply(command)) {
      // Which of a never-entered Trial's gods would be chosen is not saved.
      if (!recorded.exact)
        context.note({
          area: 'reward',
          reason: 'assumption',
          address: origin,
          applied: command,
          record: { roomIndex: recorded.roomIndex, visit: 0 },
        });
      return true;
    }
    context.refuse();
    return false;
  }
  return false;
}
