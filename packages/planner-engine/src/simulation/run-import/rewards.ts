import {
  createBiomeAddress,
  createIncomingRewardAddress,
  type IncomingRewardAddress,
  type OccurrenceId,
  type ProjectCommand,
  type SemanticAddress,
} from '../../authored-project';
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
  const offered =
    context.occurrences.offeredDoor(occurrenceId) ?? sideRoomDoor(context, occurrenceId);
  if (offered === undefined) return undefined;
  const door = context.record.rooms[offered.roomIndex]?.doors.find(
    (candidate) => candidate.door === offered.door,
  );
  const offer = recordedOffer(context.catalog, door?.reward);
  return offer === undefined
    ? undefined
    : devotionByPick(context, offer, undefined, offered.roomIndex);
}

/** The main room's visit that offered a side room's physical door, never entered. */
function sideRoomDoor(
  context: RunImportContext,
  occurrenceId: string,
): { readonly roomIndex: number; readonly door: number } | undefined {
  for (const biome of context.assembly().project.route.biomes) {
    const topology = biome.topology;
    for (const decision of topology?.decisions ?? []) {
      if (decision.kind !== 'localVisit') continue;
      const slotKey = Object.entries(decision.targetsBySlot).find(
        ([, target]) => target.occurrenceId === occurrenceId,
      )?.[0];
      if (slotKey === undefined) continue;
      const source = topology!.occurrences.find(
        (entry) => entry.occurrenceId === decision.sourceOccurrenceId,
      );
      const door = context.catalog.rooms.byKey[source?.gameName ?? '']?.localChildren
        .flatMap((child) => (child.kind === 'fixedRoomSlots' ? child.slots : []))
        .find((slot) => slot.slotKey === slotKey)?.physicalDoorId;
      const roomIndex = context.occurrences
        .visitsOf(decision.sourceOccurrenceId)
        .find((index) => context.record.rooms[index]!.doors.some((entry) => entry.door === door));
      return door === undefined || roomIndex === undefined ? undefined : { roomIndex, door };
    }
  }
  return undefined;
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

/** The other targets generated in the same door batch as an occurrence, Hub board included. */
function batchPeers(
  context: RunImportContext,
  origin: IncomingRewardAddress,
): readonly OccurrenceId[] {
  const topology = context
    .assembly()
    .project.route.biomes.find((entry) => entry.biomeKey === origin.biomeKey)?.topology;
  for (const decision of topology?.decisions ?? []) {
    const targets =
      decision.kind === 'exit'
        ? decision.normal.targets
        : decision.kind === 'hub'
          ? decision.openTargets
          : [];
    const ids = targets.map((target) => target.occurrenceId);
    if (ids.includes(origin.occurrenceId)) return ids.filter((id) => id !== origin.occurrenceId);
  }
  return [];
}

/**
 * A batch's doors share one god exclusion set: a god repeats only once the
 * batch's distinct gods are offered (`ordinaryPeerSupport`; RewardLogic.lua:188-262).
 * Before a door repeating a god, every peer bringing a god no authored peer
 * offers is authored first, one door per god.
 */
function authorNewGodsFirst(
  context: RunImportContext,
  origin: IncomingRewardAddress,
  value: ResolvedRewardOffer,
): void {
  if (value.payload?.kind !== 'BoonSource') return;
  const biome = createBiomeAddress(origin.routeKey, origin.biomeKey);
  const peers = batchPeers(context, origin);
  const gods = new Set<string>();
  for (const peer of peers) {
    const reward = rewardOf(context, origin.biomeKey, peer);
    if (reward?.offer.payload?.kind === 'BoonSource') gods.add(reward.offer.payload.source);
  }
  if (!gods.has(value.payload.source)) return;
  for (const peer of peers) {
    if (rewardOf(context, origin.biomeKey, peer) !== null) continue;
    const recorded = recordedRoomOffer(context, peer);
    const payload = recorded?.offer.payload;
    if (!recorded?.exact || payload?.kind !== 'BoonSource' || gods.has(payload.source)) continue;
    const reward = createIncomingRewardAddress(biome, peer);
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'incomingReward', reward, value: recorded.offer });
    if (
      supported(evaluation) &&
      context.apply({ kind: 'ReplaceIncomingReward', reward, value: recorded.offer })
    )
      gods.add(payload.source);
  }
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
    authorNewGodsFirst(context, origin, value);
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
