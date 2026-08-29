import type { OccurrenceAddress } from './addresses';
import type { Catalog } from '../catalog-schema';
import { locallyValidRewardOffers } from '../reward-kernel';
import type {
  AuthoredRewardState,
  HermesShrineGenerationKey,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from './model';
import { roomActionKey } from './room-actions';
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

function mapOccurrences(
  document: ProjectDocument,
  transform: (routeKey: string, biomeKey: string, occurrence: RoomOccurrence) => RoomOccurrence,
): ProjectDocument {
  let changed = false;
  const routes = document.routes.map((route) => {
    const biomes = route.biomes.map((biome) => {
      if (biome.topology === null) return biome;
      const occurrences = biome.topology.occurrences.map((occurrence) => {
        const next = transform(route.routeKey, biome.biomeKey, occurrence);
        if (next !== occurrence) changed = true;
        return next;
      });
      return occurrences.some(
        (occurrence, index) => occurrence !== biome.topology!.occurrences[index],
      )
        ? Object.freeze({
            ...biome,
            topology: Object.freeze({ ...biome.topology, occurrences: Object.freeze(occurrences) }),
          })
        : biome;
    });
    return biomes.some((biome, index) => biome !== route.biomes[index])
      ? Object.freeze({ ...route, biomes: Object.freeze(biomes) })
      : route;
  });
  return changed ? Object.freeze({ ...document, routes: Object.freeze(routes) }) : document;
}

function occurrenceMatchesAddress(
  routeKey: string,
  biomeKey: string,
  occurrence: RoomOccurrence,
  address: OccurrenceAddress,
): boolean {
  return (
    routeKey === address.routeKey &&
    biomeKey === address.biomeKey &&
    occurrence.occurrenceId === address.occurrenceId
  );
}

/**
 * A timing edit invalidates the prior active host before simulation derives a
 * replacement. Retained payload remains dormant until the new exact host is
 * placed, while every old timeline footprint is removed atomically.
 */
export function unplaceHermesShrineDelivery(
  document: ProjectDocument,
  entryKey: string,
  keepActionAt?: OccurrenceAddress,
): ProjectDocument {
  return mapOccurrences(document, (routeKey, biomeKey, occurrence) => {
    const nextOrder = occurrence.roomActions.order.filter((reference) => {
      if (
        reference.kind !== 'interactAcquisitionEntry' ||
        reference.siteKey !== HERMES_SHRINE_DELIVERY_SITE_KEY ||
        reference.entryKey !== entryKey
      )
        return true;
      if (keepActionAt === undefined) return false;
      return occurrenceMatchesAddress(routeKey, biomeKey, occurrence, keepActionAt);
    });
    return nextOrder.length === occurrence.roomActions.order.length
      ? occurrence
      : Object.freeze({
          ...occurrence,
          roomActions: Object.freeze({
            ...occurrence.roomActions,
            order: Object.freeze(nextOrder),
          }),
        });
  });
}

/** Find one retained payload, preferring the destination's context-specific draft. */
export function retainedHermesShrineDeliveryReward(
  document: ProjectDocument,
  entryKey: string,
  preferredHost: OccurrenceAddress,
): AuthoredRewardState | null | undefined {
  let fallback: AuthoredRewardState | null | undefined;
  let foundFallback = false;
  for (const route of document.routes) {
    for (const biome of route.biomes) {
      for (const occurrence of biome.topology?.occurrences ?? []) {
        const retained =
          occurrence.acquisitionSites?.[HERMES_SHRINE_DELIVERY_SITE_KEY]?.pickupEntries?.[entryKey];
        if (retained === undefined) continue;
        if (occurrenceMatchesAddress(route.routeKey, biome.biomeKey, occurrence, preferredHost))
          return retained;
        if (!foundFallback) {
          fallback = retained;
          foundFallback = true;
        }
      }
    }
  }
  return fallback;
}

/**
 * Once the simulator identifies the new due host, the concrete delivery has
 * exactly one payload owner and one timeline reference again.
 */
export function removeHermesShrineDeliveryFromOtherHosts(
  document: ProjectDocument,
  entryKey: string,
  host: OccurrenceAddress,
): ProjectDocument {
  return mapOccurrences(document, (routeKey, biomeKey, occurrence) => {
    if (occurrenceMatchesAddress(routeKey, biomeKey, occurrence, host)) return occurrence;
    const site = occurrence.acquisitionSites?.[HERMES_SHRINE_DELIVERY_SITE_KEY];
    const hasEntry = site?.pickupEntries?.[entryKey] !== undefined;
    const actionKey = roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: HERMES_SHRINE_DELIVERY_SITE_KEY,
      entryKey,
    });
    const nextOrder = occurrence.roomActions.order.filter(
      (reference) => roomActionKey(reference) !== actionKey,
    );
    if (!hasEntry && nextOrder.length === occurrence.roomActions.order.length) return occurrence;
    const nextEntries = { ...(site?.pickupEntries ?? {}) };
    delete nextEntries[entryKey];
    return Object.freeze({
      ...occurrence,
      roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(nextOrder) }),
      ...(site === undefined
        ? {}
        : {
            acquisitionSites: Object.freeze({
              ...(occurrence.acquisitionSites ?? {}),
              [HERMES_SHRINE_DELIVERY_SITE_KEY]: Object.freeze({
                ...site,
                pickupEntries: Object.freeze(nextEntries),
              }),
            }),
          }),
    });
  });
}
