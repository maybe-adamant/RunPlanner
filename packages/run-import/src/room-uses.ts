import {
  createBiomeAddress,
  type AuthoredRewardState,
  type RoomOccurrence,
  acquisitionSourceIsParticipating,
  authoredAcquisitionSources,
  type AuthoredAcquisitionSource,
} from '@run-planner/engine/authored-project';
import { resolveAcquisitionRole } from '@run-planner/engine/reward-kernel';
import type { RunImportContext } from './import';
import type { RunImportReportEntry } from './report';
import type { RunRecord, RunRecordRoom } from './run-record/model';

/** The object a pickup of `role` uses, by the name the record counts its uses under. */
export function pickupObjectName(
  context: RunImportContext,
  reward: Pick<AuthoredRewardState, 'offer'>,
  role: string,
): string | undefined {
  try {
    return resolveAcquisitionRole(context.catalog.rewards, reward.offer, role, 'roomRewardPickup')
      .acquisition.gameName;
  } catch {
    return undefined;
  }
}

/** A room's authored acquisitions the plan collects unconverted, Sea Star duplicates included. */
export function collectedSources(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
): readonly AuthoredAcquisitionSource[] {
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  // A converted pickup is no longer its own object.
  return authoredAcquisitionSources(biome, occurrence).filter(
    (source) =>
      source.reward.dispositionByAcquisitionRole[source.acquisition.acquisitionRole]?.kind ===
        'normal' && acquisitionSourceIsParticipating(occurrence, source),
  );
}

/**
 * A room's recorded uses the plan's collected pickups do not explain, by
 * object name. Each collected pickup explains one use of its object; a
 * consumable's Sea Star duplicate is the same object used again, and a
 * duplicated loot a fresh object, so either explains one more. Generated
 * pickups and Sea Star duplicates both draw on this one count.
 */
export function unexplainedRoomUses(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
): Map<string, number> {
  const room = context.record.rooms[roomIndex]!;
  const unexplained = new Map(
    Object.entries(room.uses).filter(([name]) => !isChallengeSwitch(name)),
  );
  for (const source of collectedSources(context, biomeKey, occurrence)) {
    const name = pickupObjectName(context, source.reward, source.acquisition.acquisitionRole);
    const left = name === undefined ? undefined : unexplained.get(name);
    if (left !== undefined) unexplained.set(name!, left - 1);
  }
  // A used switch's pickups take only what the plan's pickups leave.
  for (const [name, count] of challengeSwitchPickups(room)) {
    const left = unexplained.get(name);
    if (left !== undefined && left > 0) unexplained.set(name, Math.max(0, left - count));
  }
  return unexplained;
}

const isChallengeSwitch = (name: string) => /ChallengeSwitch/.test(name);

/**
 * The reward object each challenge switch spawns once its challenge ends
 * (`ObstacleData.lua` `RewardType`); an Infernal Trove gushes gold, no object.
 */
const CHALLENGE_SWITCH_REWARDS: Readonly<Record<string, string | undefined>> = {
  TimeChallengeSwitch_Money: undefined,
  PerfectClearChallengeSwitch_Pom: 'StackUpgrade',
  PerfectClearChallengeSwitch_MaxHealth: 'MaxHealthDrop',
  EliteChallengeSwitch_Talent: 'TalentDrop',
  EliteChallengeSwitch_MaxMana: 'MaxManaDrop',
};

/**
 * The pickups a room's used challenge switches can explain, at most one each
 * (`HandleChallengeLoot`, EventLogic.lua): its reward object, or a Perfect
 * Clear's consolation prize once hit, and the challenge's chance Nectar
 * (`LootDrops`). No save says which dropped, so they only absorb uses the
 * plan's pickups leave unexplained.
 */
export function challengeSwitchPickups(room: RunRecordRoom): ReadonlyMap<string, number> {
  const pickups = new Map<string, number>();
  const add = (name: string) => pickups.set(name, (pickups.get(name) ?? 0) + 1);
  for (const name of Object.keys(room.uses)) {
    if (!isChallengeSwitch(name)) continue;
    const reward = CHALLENGE_SWITCH_REWARDS[name];
    if (reward !== undefined) add(reward);
    if (name.startsWith('PerfectClear')) add('RoomRewardConsolationPrize');
    add('GiftDrop');
  }
  return pickups;
}

/**
 * Rooms where a challenge switch was used (an Infernal Trove or Unseen Sigil:
 * its interaction is the switch's obstacle name). The plan models no
 * challenge encounter or its reward, so each such room is reported.
 */
export function unsupportedChallengeSwitches(record: RunRecord): readonly RunImportReportEntry[] {
  return record.rooms.flatMap((room, roomIndex): RunImportReportEntry[] =>
    Object.keys(room.uses).some(isChallengeSwitch)
      ? [{ area: 'other', reason: 'unsupportedArea', record: { roomIndex, visit: 0 } }]
      : [],
  );
}
