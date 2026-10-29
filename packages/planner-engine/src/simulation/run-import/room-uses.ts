import {
  createBiomeAddress,
  type AuthoredRewardState,
  type RoomOccurrence,
} from '../../authored-project';
import {
  acquisitionSourceIsParticipating,
  authoredAcquisitionSources,
  type AuthoredAcquisitionSource,
} from '../../authored-project/acquisition/acquisition-sources';
import { resolveAcquisitionRole } from '../../reward-kernel';
import type { RunImportContext } from './import';

/** The object a pickup of `role` uses, by the name the record counts its uses under. */
export function pickupObjectName(
  context: RunImportContext,
  reward: AuthoredRewardState,
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
  const state = occurrence.state;
  return authoredAcquisitionSources(biome, occurrence).filter((source) => {
    const owner = source.acquisition.owner;
    // A wheel's action collects only its picked offer.
    if (
      owner.kind === 'rewardWheelOffer' &&
      (state.kind !== 'shipCombat' ||
        owner.offerKey !== `offer${state.wheels[owner.wheelKey]?.pickedOfferIndex}`)
    )
      return false;
    // A converted pickup is no longer its own object.
    return (
      source.reward.dispositionByAcquisitionRole[source.acquisition.acquisitionRole]?.kind ===
        'normal' && acquisitionSourceIsParticipating(occurrence, source)
    );
  });
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
  const unexplained = new Map(Object.entries(context.record.rooms[roomIndex]!.uses));
  for (const source of collectedSources(context, biomeKey, occurrence)) {
    const name = pickupObjectName(context, source.reward, source.acquisition.acquisitionRole);
    const left = name === undefined ? undefined : unexplained.get(name);
    if (left !== undefined) unexplained.set(name!, left - 1);
  }
  return unexplained;
}
