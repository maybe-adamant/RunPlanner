import type {
  AcquisitionSiteAddress,
  OccurrenceAddress,
  SemanticAddress,
  TraitOfferOwnerAddress,
} from './addresses';
import { createAcquisitionSiteAddress, semanticAddressKey } from './addresses';

/** Collision-safe source-owned identity for the separately acquired replacement. */
export function artificerReplacementEntryKey(
  source: SemanticAddress | string,
  acquisitionRole: string,
): string {
  const sourceKey = typeof source === 'string' ? source : semanticAddressKey(source);
  return `artificer:${encodeURIComponent(sourceKey)}:${encodeURIComponent(acquisitionRole)}`;
}

export function parseArtificerReplacementEntryKey(
  key: string,
): { readonly sourceKey: string; readonly acquisitionRole: string } | undefined {
  if (!key.startsWith('artificer:')) return undefined;
  const separator = key.lastIndexOf(':');
  if (separator <= 'artificer:'.length) return undefined;
  try {
    return Object.freeze({
      sourceKey: decodeURIComponent(key.slice('artificer:'.length, separator)),
      acquisitionRole: decodeURIComponent(key.slice(separator + 1)),
    });
  } catch {
    return undefined;
  }
}

/** Exact occurrence-local site that stores one source's produced Artificer reward. */
export function artificerAcquisitionSite(
  occurrence: OccurrenceAddress,
  source: TraitOfferOwnerAddress,
): AcquisitionSiteAddress {
  if (occurrence.routeKey !== source.routeKey || occurrence.biomeKey !== source.biomeKey) {
    throw new Error('Artificer source is outside its occurrence biome');
  }
  return createAcquisitionSiteAddress(
    occurrence,
    `artificerSource:${encodeURIComponent(semanticAddressKey(source))}`,
  );
}

/** Collision-safe persisted key for one exact occurrence-owned acquisition site. */
export function acquisitionSiteStorageKey(site: AcquisitionSiteAddress): string {
  return site.pointKey === 'roomExit' ||
    site.pointKey.startsWith('traitGenerated:') ||
    site.pointKey.startsWith('nemesisGenerated:') ||
    site.pointKey === 'hermesShrineDelivery' ||
    site.pointKey.startsWith('seaStarDuplicate:')
    ? site.pointKey
    : semanticAddressKey(site);
}

/** Reattest one persisted occurrence-local site key at its owning occurrence. */
export function acquisitionSiteFromStorageKey(
  occurrence: OccurrenceAddress,
  storageKey: string,
): AcquisitionSiteAddress | undefined {
  if (storageKey === 'roomExit') return createAcquisitionSiteAddress(occurrence, 'roomExit');
  // Trait-generated sites are closed and reattested by the trait adapter/codec;
  // this parser only reconstructs the existing acquisition-site address.
  if (storageKey.startsWith('traitGenerated:'))
    return createAcquisitionSiteAddress(occurrence, storageKey);
  if (storageKey.startsWith('nemesisGenerated:'))
    return createAcquisitionSiteAddress(occurrence, storageKey);
  if (storageKey === 'hermesShrineDelivery')
    return createAcquisitionSiteAddress(occurrence, storageKey);
  if (storageKey.startsWith('seaStarDuplicate:'))
    return createAcquisitionSiteAddress(occurrence, storageKey);
  try {
    const value: unknown = JSON.parse(storageKey);
    if (!Array.isArray(value) || value.length !== 5) return undefined;
    const [kind, routeKey, biomeKey, ownerKey, pointKey] = value;
    if (
      kind !== 'acquisitionSite' ||
      routeKey !== occurrence.routeKey ||
      biomeKey !== occurrence.biomeKey ||
      ownerKey !== semanticAddressKey(occurrence) ||
      typeof pointKey !== 'string'
    )
      return undefined;
    return createAcquisitionSiteAddress(occurrence, pointKey);
  } catch {
    return undefined;
  }
}
