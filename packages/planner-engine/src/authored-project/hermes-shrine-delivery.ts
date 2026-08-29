import type { OccurrenceAddress } from './addresses';
import type { Catalog } from '../catalog-schema';
import { locallyValidRewardOffers } from '../reward-kernel';
import type { AuthoredRewardState, HermesShrineGenerationKey, OccurrenceId } from './model';
import { createUnresolvedAcquisitionRewardState } from './traits';

const GENERATION_KEYS = [
  'initial:first',
  'initial:secondLeft',
  'initial:secondRight',
  'travelDealRefill',
] as const satisfies readonly HermesShrineGenerationKey[];

export const HERMES_SHRINE_DELIVERY_SITE_KEY = 'hermesShrineDelivery' as const;

/**
 * Materializes only payload-free Shrine identities. Payload-bearing identities
 * stay unresolved until the concrete delivery pickup is authored.
 */
export function defaultHermesShrineDeliveryReward(
  catalog: Catalog,
  rewardType: string,
): AuthoredRewardState | null {
  const offers = locallyValidRewardOffers(catalog.rewards, rewardType);
  if (offers.length !== 1) return null;
  return createUnresolvedAcquisitionRewardState(catalog, offers[0]!, {
    kind: 'producerLifecycle',
    key: 'HermesShrineDelivery',
  });
}

/** Stable source identity for a host-owned Shrine delivery entry. */
export function hermesShrineDeliveryEntryKey(
  source: OccurrenceAddress,
  generationKey: HermesShrineGenerationKey,
): string {
  return `hermesShrineDelivery:${encodeURIComponent(
    JSON.stringify([source.routeKey, source.biomeKey, source.occurrenceId, generationKey]),
  )}`;
}

export function parseHermesShrineDeliveryEntryKey(key: string):
  | {
      readonly routeKey: string;
      readonly biomeKey: string;
      readonly sourceOccurrenceId: OccurrenceId;
      readonly generationKey: HermesShrineGenerationKey;
    }
  | undefined {
  if (!key.startsWith('hermesShrineDelivery:')) return undefined;
  const encoded = key.slice('hermesShrineDelivery:'.length);
  if (encoded.length === 0) return undefined;
  try {
    const tuple: unknown = JSON.parse(decodeURIComponent(encoded));
    if (
      !Array.isArray(tuple) ||
      tuple.length !== 4 ||
      tuple.some((value) => typeof value !== 'string')
    )
      return undefined;
    const [routeKey, biomeKey, sourceOccurrenceId, generationKey] = tuple as [
      string,
      string,
      string,
      string,
    ];
    if (
      routeKey.length === 0 ||
      biomeKey.length === 0 ||
      sourceOccurrenceId.length === 0 ||
      !GENERATION_KEYS.includes(generationKey as HermesShrineGenerationKey)
    )
      return undefined;
    return Object.freeze({
      routeKey,
      biomeKey,
      sourceOccurrenceId: sourceOccurrenceId as OccurrenceId,
      generationKey: generationKey as HermesShrineGenerationKey,
    });
  } catch {
    return undefined;
  }
}
