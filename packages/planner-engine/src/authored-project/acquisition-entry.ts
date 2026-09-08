import type { Catalog } from '../catalog-schema';

import type { AuthoredRewardState, RoomOccurrence } from './model';
import { rewardSourceResolvesAtAcquisition } from './reward-state';

/**
 * Reconciles the sparse child owned by a participating acquisition-resolved
 * reward. Its carrier decides participation; the child owns eventual payload.
 */
export function reconcileAcquisitionResolvedRewardEntry(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  entryKey: string,
  participating: boolean,
  carrierReward: AuthoredRewardState | null | undefined,
): RoomOccurrence {
  const ownsEntry =
    participating &&
    carrierReward !== null &&
    carrierReward !== undefined &&
    rewardSourceResolvesAtAcquisition(catalog, carrierReward.offer);
  const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries ?? {};
  const current = pickupEntries[entryKey];
  const hasCurrent = Object.hasOwn(pickupEntries, entryKey);
  if (!ownsEntry && !hasCurrent) return occurrence;
  if (
    ownsEntry &&
    hasCurrent &&
    (current === null || current?.offer.rewardType === carrierReward.offer.rewardType)
  )
    return occurrence;

  const { [entryKey]: removed, ...remaining } = pickupEntries;
  void removed;
  return Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      roomExit: Object.freeze({
        ...(occurrence.acquisitionSites?.roomExit ?? {}),
        pickupEntries: Object.freeze({
          ...remaining,
          ...(ownsEntry ? { [entryKey]: null } : {}),
        }),
      }),
    }),
  });
}
