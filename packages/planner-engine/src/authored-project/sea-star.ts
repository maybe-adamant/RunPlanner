import type {
  AcquisitionRoleAddress,
  AcquisitionSiteAddress,
  OccurrenceAddress,
} from './addresses';
import type { Catalog } from '../catalog-schema';
import type { AuthoredRewardState, RoomOccurrence } from './model';
import { createAcquisitionSiteAddress, semanticAddressKey } from './addresses';
import {
  acquisitionSourceIsParticipating,
  authoredAcquisitionSources,
} from './acquisition-sources';
import { createUnresolvedAcquisitionRewardState } from './traits';
import { resolveAcquisitionRole } from '../reward-kernel/history';

export const SEA_STAR_DUPLICATE_ENTRY_KEY = 'seaStarDuplicate';

/** A duplicate loot acquisition is a fresh object; consumables/resources retain their object. */
export function seaStarDuplicateUsesFreshObject(
  catalog: Catalog,
  source: AuthoredRewardState,
  acquisitionRole: string,
): boolean {
  const resolved = resolveAcquisitionRole(
    catalog.rewards,
    source.offer,
    acquisitionRole,
    'roomRewardPickup',
  );
  return (
    catalog.rewards.acquisitions.byKey[resolved.acquisition.gameName]?.canDuplicate === true &&
    resolved.acquisition.kind === 'loot'
  );
}

/**
 * Sea Star's two deliberately distinct authored outcomes. Consumables retain
 * their same-object authored choices for a second use; full Poms are a fresh
 * RoomReward acquisition with none of the source's child authoring copied.
 */
export function createSeaStarDuplicateRewardState(
  catalog: Catalog,
  source: AuthoredRewardState,
  acquisitionRole: string,
): AuthoredRewardState {
  if (seaStarDuplicateUsesFreshObject(catalog, source, acquisitionRole))
    return createUnresolvedAcquisitionRewardState(catalog, source.offer, {
      kind: 'producerLifecycle',
      key: 'RoomReward',
    });
  return Object.freeze({
    ...source,
    ...(source.levelResolutionsByAcquisitionRole === undefined
      ? {}
      : {
          levelResolutionsByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.entries(source.levelResolutionsByAcquisitionRole).map(([role, value]) => [
                role,
                value.kind === 'random'
                  ? Object.freeze({ kind: 'random' as const, targetTraitKey: null })
                  : value,
              ]),
            ),
          ),
        }),
  });
}

/** Closed address for the one non-recursive duplicate owned by a source role. */
export function seaStarDuplicateSiteKey(source: AcquisitionRoleAddress): string {
  return `seaStarDuplicate:${encodeURIComponent(semanticAddressKey(source.owner))}:${encodeURIComponent(source.acquisitionRole)}`;
}

export function parseSeaStarDuplicateSiteKey(
  key: string,
): { readonly sourceKey: string; readonly acquisitionRole: string } | undefined {
  if (!key.startsWith('seaStarDuplicate:')) return undefined;
  const separator = key.lastIndexOf(':');
  if (separator <= 'seaStarDuplicate:'.length || separator === key.length - 1) return undefined;
  try {
    const sourceKey = decodeURIComponent(key.slice('seaStarDuplicate:'.length, separator));
    const acquisitionRole = decodeURIComponent(key.slice(separator + 1));
    return sourceKey.length === 0 || acquisitionRole.length === 0
      ? undefined
      : Object.freeze({ sourceKey, acquisitionRole });
  } catch {
    return undefined;
  }
}

export function seaStarDuplicateAcquisitionSite(
  occurrence: OccurrenceAddress,
  source: AcquisitionRoleAddress,
): AcquisitionSiteAddress {
  if (occurrence.routeKey !== source.routeKey || occurrence.biomeKey !== source.biomeKey)
    throw new Error('Sea Star source is outside its occurrence biome');
  return createAcquisitionSiteAddress(occurrence, seaStarDuplicateSiteKey(source));
}

/** Reattests a retained duplicate at its exact participating normal parent. */
export function seaStarDuplicateSourceIsActive(
  catalog: Catalog,
  biome: import('./addresses').BiomeAddress,
  occurrence: RoomOccurrence,
  siteKey: string,
): boolean {
  const parsed = parseSeaStarDuplicateSiteKey(siteKey);
  if (parsed === undefined) return false;
  const matched = authoredAcquisitionSources(biome, occurrence).find(
    (candidate) =>
      semanticAddressKey(candidate.acquisition.owner) === parsed.sourceKey &&
      candidate.acquisition.acquisitionRole === parsed.acquisitionRole,
  );
  if (matched === undefined) return false;
  // StoreLogic clears CanDuplicate for the purchased Shop offer itself. A
  // free acquisition-entry pickup generated within that room is independent
  // of the purchase and retains its own producer lifecycle.
  if (matched.acquisition.owner.kind === 'shopOffer') return false;
  return (
    matched.reward.dispositionByAcquisitionRole[parsed.acquisitionRole]?.kind === 'normal' &&
    catalog.rewards.rewardTypes.byKey[matched.reward.offer.rewardType]?.acquisitionRoles.byKey[
      parsed.acquisitionRole
    ] !== undefined &&
    acquisitionSourceIsParticipating(occurrence, matched)
  );
}
