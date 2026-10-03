import type { OccurrenceAddress } from './addresses';
import type { Catalog } from '../catalog-schema';
import { locallyValidRewardOffers } from '../reward-kernel';
import type {
  AuthoredRoutePlan,
  AuthoredRewardState,
  BiomeTopology,
  HermesShrineGenerationKey,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from './model';
import { structurallyActiveOccurrenceIds } from './topology/query';
import { roomActionKey } from './room-actions/key';
import { createUnresolvedAcquisitionRewardState } from './traits/state';

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
  routeKey: string,
): AuthoredRewardState | null {
  const offers = locallyValidRewardOffers(catalog.rewards, rewardType);
  if (offers.length !== 1) return null;
  return createUnresolvedAcquisitionRewardState(
    catalog,
    offers[0]!,
    { kind: 'producerLifecycle', key: 'HermesShrineDelivery' },
    routeKey,
  );
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

interface HermesShrineDeliverySource {
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly sourceOccurrenceId: OccurrenceId;
  readonly generationKey: HermesShrineGenerationKey;
}

/** Lazily computed structural activity per biome; `null` marks an absent topology. */
function structurallyActiveIdsByBiome(route: AuthoredRoutePlan) {
  const cache = new Map<string, ReadonlySet<OccurrenceId> | null>();
  return (biomeKey: string): ReadonlySet<OccurrenceId> | null => {
    const cached = cache.get(biomeKey);
    if (cached !== undefined) return cached;
    const topology: BiomeTopology | null =
      route.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology ?? null;
    const active = topology === null ? null : structurallyActiveOccurrenceIds(topology);
    cache.set(biomeKey, active);
    return active;
  };
}

export function hermesShrineDeliverySourceIsStructurallyActive(
  route: AuthoredRoutePlan,
  source: HermesShrineDeliverySource,
): boolean {
  if (source.routeKey !== route.routeKey) return false;
  const occurrence = route.biomes
    .find((biome) => biome.biomeKey === source.biomeKey)
    ?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === source.sourceOccurrenceId,
    );
  if (occurrence?.hermesShrine === undefined) return false;
  const purchase =
    source.generationKey === 'travelDealRefill'
      ? occurrence.hermesShrine.travelDealRefill?.purchase
      : occurrence.hermesShrine.purchaseBySlot?.[
          source.generationKey.slice('initial:'.length) as import('./model').HermesShrineSlotKey
        ];
  if (purchase === undefined) return false;
  return (
    structurallyActiveIdsByBiome(route)(source.biomeKey)?.has(source.sourceOccurrenceId) ?? false
  );
}

function mapOccurrences(
  document: ProjectDocument,
  transform: (routeKey: string, biomeKey: string, occurrence: RoomOccurrence) => RoomOccurrence,
): ProjectDocument {
  let changed = false;
  const route = document.route;
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
  return changed
    ? Object.freeze({
        ...document,
        route: Object.freeze({ ...route, biomes: Object.freeze(biomes) }),
      })
    : document;
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

/**
 * Removing a Shrine feature invalidates every active delivery it sourced,
 * regardless of the later occurrence that was selected as its host. Delivery
 * payload remains in its existing site as dormant repair detail.
 */
export function unplaceHermesShrineDeliveriesFromSource(
  document: ProjectDocument,
  source: OccurrenceAddress,
): ProjectDocument {
  return mapOccurrences(document, (routeKey, biomeKey, occurrence) => {
    const nextOrder = occurrence.roomActions.order.filter((reference) => {
      if (
        reference.kind !== 'interactAcquisitionEntry' ||
        reference.siteKey !== HERMES_SHRINE_DELIVERY_SITE_KEY
      )
        return true;
      const parsed = parseHermesShrineDeliveryEntryKey(reference.entryKey);
      return !(
        parsed?.routeKey === source.routeKey &&
        parsed.biomeKey === source.biomeKey &&
        parsed.sourceOccurrenceId === source.occurrenceId
      );
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

/**
 * Reconciles active delivery actions after a semantic command removes a
 * Shrine-bearing occurrence or its Shrine feature, or stops the source from
 * being entered in the authored topology. Retained delivery payload remains
 * dormant for repair.
 */
export function retractMissingHermesShrineDeliveryActions(
  previous: ProjectDocument,
  document: ProjectDocument,
): ProjectDocument {
  let reconciled = document;
  const previousActiveIds = structurallyActiveIdsByBiome(previous.route);
  const currentActiveIds = structurallyActiveIdsByBiome(document.route);
  for (const previousBiome of previous.route.biomes) {
    const currentBiome = document.route.biomes.find(
      (biome) => biome.biomeKey === previousBiome.biomeKey,
    );
    if (currentBiome === previousBiome) continue;
    for (const previousOccurrence of previousBiome.topology?.occurrences ?? []) {
      if (previousOccurrence.hermesShrine === undefined) continue;
      const currentOccurrence = currentBiome?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === previousOccurrence.occurrenceId,
      );
      if (currentOccurrence?.hermesShrine !== undefined) {
        const wasActive =
          previousActiveIds(previousBiome.biomeKey)?.has(previousOccurrence.occurrenceId) ?? false;
        const isActive =
          currentActiveIds(previousBiome.biomeKey)?.has(previousOccurrence.occurrenceId) ?? false;
        if (!wasActive || isActive) continue;
      }
      reconciled = unplaceHermesShrineDeliveriesFromSource(reconciled, {
        kind: 'occurrence',
        routeKey: previous.route.routeKey,
        biomeKey: previousBiome.biomeKey,
        occurrenceId: previousOccurrence.occurrenceId,
      });
    }
  }
  return reconciled;
}

/** Find one retained payload, preferring the destination's context-specific draft. */
export function retainedHermesShrineDeliveryReward(
  document: ProjectDocument,
  entryKey: string,
  preferredHost: OccurrenceAddress,
): AuthoredRewardState | null | undefined {
  let fallback: AuthoredRewardState | null | undefined;
  let foundFallback = false;
  const route = document.route;
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
  return fallback;
}

/**
 * Once the simulator identifies the new due host, the concrete delivery has
 * exactly one payload owner and one timeline reference again.
 */
export function removeHermesShrineDeliveryFromOtherHosts(
  document: ProjectDocument,
  entryKey: string,
  host?: OccurrenceAddress,
): ProjectDocument {
  return mapOccurrences(document, (routeKey, biomeKey, occurrence) => {
    if (host !== undefined && occurrenceMatchesAddress(routeKey, biomeKey, occurrence, host))
      return occurrence;
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

/** Edit settlement has proven that this exact obligation changed contact. */
export function discardDisplacedHermesShrineDelivery(
  document: ProjectDocument,
  entryKey: string,
): ProjectDocument {
  return removeHermesShrineDeliveryFromOtherHosts(document, entryKey);
}
