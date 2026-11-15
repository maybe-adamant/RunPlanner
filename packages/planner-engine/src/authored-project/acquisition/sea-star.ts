import type {
  AcquisitionRoleAddress,
  AcquisitionSiteAddress,
  BiomeAddress,
  OccurrenceAddress,
} from '../addresses';
import type { Catalog } from '../../catalog-schema';
import type { AuthoredRewardState, OccurrenceId, RoomOccurrence } from '../model';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  semanticAddressKey,
} from '../addresses';
import { acquisitionSiteFromStorageKey, parseArtificerReplacementEntryKey } from './artificer';
import {
  acquisitionSourceIsParticipating,
  authoredAcquisitionSources,
} from './acquisition-sources';
import { createUnresolvedAcquisitionRewardState } from '../traits/state';
import { resolveAcquisitionRole } from '../../reward-kernel/history';
import { HERMES_SHRINE_DELIVERY_SITE_KEY } from '../hermes-shrine-delivery';
import { ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY } from '../shop';

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
  routeKey: string,
): AuthoredRewardState {
  if (seaStarDuplicateUsesFreshObject(catalog, source, acquisitionRole))
    return createUnresolvedAcquisitionRewardState(
      catalog,
      source.offer,
      { kind: 'producerLifecycle', key: 'RoomReward' },
      routeKey,
    );
  // The duplicate opens its own Path screen, chosen by its author.
  const { hexActivationsByAcquisitionRole: _screens, ...retained } = source;
  void _screens;
  return Object.freeze({
    ...retained,
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
  biome: import('../addresses').BiomeAddress,
  occurrence: RoomOccurrence,
  siteKey: string,
  routeStartIncoming?: AuthoredRewardState,
): boolean {
  const parsed = parseSeaStarDuplicateSiteKey(siteKey);
  if (parsed === undefined) return false;
  const matched = authoredAcquisitionSources(biome, occurrence, routeStartIncoming).find(
    (candidate) =>
      semanticAddressKey(candidate.acquisition.owner) === parsed.sourceKey &&
      candidate.acquisition.acquisitionRole === parsed.acquisitionRole,
  );
  if (matched === undefined) return false;
  // StoreLogic clears CanDuplicate for the purchased Shop offer itself. A
  // free acquisition-entry pickup generated within that room is independent
  // of the purchase and retains its own producer lifecycle.
  // The Contract pedestal's item is a store item too; a Shrine delivery
  // spawns through the same store-item path, and Gold Gold Gold's duplicate
  // clears CanDuplicate itself.
  const owner = matched.acquisition.owner;
  if (
    owner.kind === 'shopOffer' ||
    owner.kind === 'infernalContractPedestal' ||
    (owner.kind === 'acquisitionEntry' &&
      (owner.site.pointKey === HERMES_SHRINE_DELIVERY_SITE_KEY ||
        owner.entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY))
  )
    return false;
  return (
    matched.reward.dispositionByAcquisitionRole[parsed.acquisitionRole]?.kind === 'normal' &&
    catalog.rewards.rewardTypes.byKey[matched.reward.offer.rewardType]?.acquisitionRoles.byKey[
      parsed.acquisitionRole
    ] !== undefined &&
    acquisitionSourceIsParticipating(occurrence, matched)
  );
}

/** Whether the room's own encounter spawns its reward as one that can never duplicate. */
export function roomRewardCannotDuplicate(catalog: Catalog, gameName: string): boolean {
  return (catalog.rooms.byKey[gameName]?.encounterSlotBindings ?? []).some(
    (binding) =>
      binding.kind === 'fixed' &&
      catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]
        ?.incomingRewardCannotDuplicate === true,
  );
}

/**
 * Owners in one occurrence whose reward can never duplicate because its room's
 * encounter spawned it so: the room reward and every Artificer replacement
 * descended from it, which keeps its source's CanDuplicate.
 */
export function encounterUnduplicableOwnerKeys(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: {
    readonly occurrenceId: OccurrenceId;
    readonly gameName: string;
    readonly acquisitionSites?:
      | Readonly<Record<string, { readonly pickupEntries?: Readonly<Record<string, unknown>> }>>
      | undefined;
  },
): ReadonlySet<string> {
  if (!roomRewardCannotDuplicate(catalog, occurrence.gameName)) return new Set();
  const owners = new Set([
    semanticAddressKey(createIncomingRewardAddress(biome, occurrence.occurrenceId)),
  ]);
  const address = createOccurrenceAddress(biome, occurrence.occurrenceId);
  const replacements = Object.entries(occurrence.acquisitionSites ?? {}).flatMap(
    ([storageKey, site]) => {
      const siteAddress = acquisitionSiteFromStorageKey(address, storageKey);
      return siteAddress === undefined
        ? []
        : Object.keys(site.pickupEntries ?? {}).flatMap((entryKey) => {
            const parsed = parseArtificerReplacementEntryKey(entryKey);
            return parsed === undefined
              ? []
              : [
                  {
                    sourceKey: parsed.sourceKey,
                    ownerKey: semanticAddressKey(
                      createAcquisitionEntryAddress(siteAddress, entryKey),
                    ),
                  },
                ];
          });
    },
  );
  for (let grew = true; grew;) {
    grew = false;
    for (const { sourceKey, ownerKey } of replacements)
      if (owners.has(sourceKey) && !owners.has(ownerKey)) {
        owners.add(ownerKey);
        grew = true;
      }
  }
  return owners;
}
