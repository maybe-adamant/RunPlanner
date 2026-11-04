import {
  createBiomeAddress,
  type AuthoredRewardState,
  type RoomOccurrence,
  acquisitionSourceIsParticipating,
  authoredAcquisitionSources,
  type AuthoredAcquisitionSource,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { resolveAcquisitionRole } from '@run-planner/engine/reward-kernel';
import type { RunImportContext } from './import';
import type { RunRecordRoom } from './run-record/model';

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
 * A room's recorded uses the plan's collected pickups leave, by object name,
 * challenge switches' own presses excluded. Each collected pickup explains one
 * use of its object; a consumable's Sea Star duplicate is the same object used
 * again, and a duplicated loot a fresh object, so either explains one more.
 */
export function usesLeftByPlan(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
): Map<string, number> {
  const room = context.record.rooms[roomIndex]!;
  const left = new Map(
    Object.entries(room.uses).filter(([name]) => !isChallengeSwitch(context.catalog, name)),
  );
  for (const source of collectedSources(context, biomeKey, occurrence)) {
    const name = pickupObjectName(context, source.reward, source.acquisition.acquisitionRole);
    const count = name === undefined ? undefined : left.get(name);
    if (count !== undefined) left.set(name!, count - 1);
  }
  return left;
}

/**
 * A room's recorded uses the plan's collected pickups do not explain, by
 * object name. Generated pickups and Sea Star duplicates both draw on this one
 * count. Until the import authors a used switch, its possible claim pickups
 * take only what the plan's pickups leave.
 */
export function unexplainedRoomUses(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
): Map<string, number> {
  const unexplained = usesLeftByPlan(context, biomeKey, occurrence, roomIndex);
  if (occurrence.challengeSwitch !== undefined) return unexplained;
  for (const [name, count] of challengeSwitchPickups(
    context.catalog,
    context.record.rooms[roomIndex]!,
  )) {
    const left = unexplained.get(name);
    if (left !== undefined && left > 0) unexplained.set(name, Math.max(0, left - count));
  }
  return unexplained;
}

/** Whether a recorded use is a challenge switch press: its name is the switch's obstacle variant. */
export const isChallengeSwitch = (catalog: Catalog, name: string): boolean =>
  catalog.challengeSwitches.variants.byKey[name] !== undefined;

/**
 * The pickups a room's pressed challenge switch can claim, at most one each
 * (`HandleChallengeLoot`, EventLogic.lua): its consumable reward, or a Perfect
 * Clear's hit reward, and the bonus Nectar. A Time switch gushes gold, no
 * object. Each is the native object its reward type names.
 */
export function challengeSwitchPickups(
  catalog: Catalog,
  room: RunRecordRoom,
): ReadonlyMap<string, number> {
  const pickups = new Map<string, number>();
  const add = (name: string) => pickups.set(name, (pickups.get(name) ?? 0) + 1);
  const switches = catalog.challengeSwitches;
  for (const name of Object.keys(room.uses)) {
    const variant = switches.variants.byKey[name];
    const kind = variant === undefined ? undefined : switches.kinds.byKey[variant.switchKind];
    if (variant === undefined || kind === undefined) continue;
    if (!kind.goldReward) add(variant.rewardType);
    if (kind.hitRewardType !== undefined) add(kind.hitRewardType);
    add(switches.bonusReward.rewardType);
  }
  return pickups;
}
