import {
  createBiomeAddress,
  createOccurrenceAddress,
  type AcquisitionEntryAddress,
  type OccurrenceAddress,
} from './addresses';
import type { Catalog, RoomDeclaration } from '../catalog-schema';
import { locallyValidRewardOffers } from '../reward-kernel';
import {
  hermesShrineInitialSlotKey,
  type AuthoredRoutePlan,
  type AuthoredRewardState,
  type BiomeTopology,
  type HermesShrineGenerationKey,
  type HermesShrineInventoryOffer,
  type HermesShrineState,
  type OccurrenceId,
  type ProjectDocument,
  type RoomActionReference,
  type RoomOccurrence,
} from './model';
import { structurallyActiveOccurrenceIds } from './topology/query';
import { roomActionKey } from './room-actions/key';
import { reconcileGeneratedPickupProducerState } from './acquisition/pickup-producers';
import { createUnresolvedAcquisitionRewardState } from './traits/state';

const GENERATION_KEYS = [
  'initial:first',
  'initial:secondLeft',
  'initial:secondRight',
  'travelDealRefill',
] as const satisfies readonly HermesShrineGenerationKey[];

export const HERMES_SHRINE_DELIVERY_SITE_KEY = 'hermesShrineDelivery' as const;

/** Where and how one Shrine of Hermes purchase arrives; `due` is absent while it counts down. */
export interface HermesDeliveryObligation {
  readonly entryKey: string;
  /** The Shrine room that sold the item. */
  readonly source: OccurrenceAddress;
  readonly generationKey: HermesShrineGenerationKey;
  readonly rewardType: string;
  readonly rushed: boolean;
  readonly due?: HermesDeliveryDueContact;
}

export interface HermesDeliveryDueContact {
  readonly host: OccurrenceAddress;
  /** The phase whose end effects it fell due at; absent for a rush and the Preboss flush. */
  readonly encounterPhaseKey?: string;
  readonly cause: 'rush' | 'countdown' | 'flush';
  readonly historySequence: number;
}

/** A rushed item is delivered in the Shrine room itself. */
export function isSameRoomDelivery(source: OccurrenceAddress, host: OccurrenceAddress): boolean {
  return (
    source.routeKey === host.routeKey &&
    source.biomeKey === host.biomeKey &&
    source.occurrenceId === host.occurrenceId
  );
}

/** Whether an acquisition entry is a Shrine delivery rushed in the Shrine room that sold it. */
export function isSameRoomHermesShrineDeliveryEntry(entry: AcquisitionEntryAddress): boolean {
  const host = entry.site.owner;
  if (entry.site.pointKey !== HERMES_SHRINE_DELIVERY_SITE_KEY || host.kind !== 'occurrence')
    return false;
  const parsed = parseHermesShrineDeliveryEntryKey(entry.entryKey);
  return (
    parsed !== undefined && isSameRoomDelivery(hermesShrineDeliverySourceAddress(parsed), host)
  );
}

export type HermesShrinePurchaseAction = Extract<
  RoomActionReference,
  { readonly kind: 'purchaseHermesShrineOffer' }
>;

/** The timeline purchase action of one Shrine generation. */
export function hermesShrinePurchaseAction(
  order: readonly RoomActionReference[],
  generationKey: HermesShrineGenerationKey,
): HermesShrinePurchaseAction | undefined {
  return order.find(
    (reference): reference is HermesShrinePurchaseAction =>
      reference.kind === 'purchaseHermesShrineOffer' && reference.generationKey === generationKey,
  );
}

export type HermesShrineRushAction = Extract<
  RoomActionReference,
  { readonly kind: 'rushHermesShrineOffer' }
>;

/** The rush of one bought Shrine generation, a later interaction with its item. */
export function hermesShrineRushAction(
  order: readonly RoomActionReference[],
  generationKey: HermesShrineGenerationKey,
): HermesShrineRushAction | undefined {
  return order.find(
    (reference): reference is HermesShrineRushAction =>
      reference.kind === 'rushHermesShrineOffer' && reference.generationKey === generationKey,
  );
}

/**
 * The earliest initial rush in timeline order: the first rush that can refill
 * with Travel Deal. Simulation finds the first one made with the trait.
 */
export function firstInitialRush(
  order: readonly RoomActionReference[],
): HermesShrineRushAction | undefined {
  return order.find(
    (reference): reference is HermesShrineRushAction =>
      reference.kind === 'rushHermesShrineOffer' && reference.generationKey !== 'travelDealRefill',
  );
}

/** The visible inventory offer behind one Shrine generation; `null` is an empty slot. */
export function offerFor(
  shrine: HermesShrineState | undefined,
  generationKey: HermesShrineGenerationKey,
): HermesShrineInventoryOffer | null | undefined {
  if (shrine === undefined) return undefined;
  if (generationKey === 'travelDealRefill') return shrine.travelDealRefill?.offer;
  const slotKey = hermesShrineInitialSlotKey(generationKey);
  return slotKey === undefined ? undefined : shrine.offerBySlot[slotKey];
}

/**
 * The item a Shrine generation sold: its offer while a purchase action holds
 * it, whose delay times a delayed delivery.
 */
export function purchasedOfferFor(
  shrine: HermesShrineState | undefined,
  order: readonly RoomActionReference[],
  generationKey: HermesShrineGenerationKey,
): HermesShrineInventoryOffer | undefined {
  if (hermesShrinePurchaseAction(order, generationKey) === undefined) return undefined;
  return offerFor(shrine, generationKey) ?? undefined;
}

/**
 * Native flushes every pending Shrine delivery at the Preboss of the fourth
 * entered biome (`EnteredBiomes == 4`), whether through the Preboss room
 * event or Q's in-person Hermes trigger. A shorter itinerary never flushes.
 */
export function isDeliveryFlushHost(
  declaration: Pick<RoomDeclaration, 'kind'> | undefined,
  routePosition: { readonly ordinal: number },
): boolean {
  return declaration?.kind === 'Preboss' && routePosition.ordinal === 4;
}

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

/** The Shrine room named by a parsed delivery entry key. */
export function hermesShrineDeliverySourceAddress(
  source: Omit<HermesShrineDeliverySource, 'generationKey'>,
): OccurrenceAddress {
  return createOccurrenceAddress(
    createBiomeAddress(source.routeKey, source.biomeKey),
    source.sourceOccurrenceId,
  );
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
  if (
    occurrence === undefined ||
    purchasedOfferFor(
      occurrence.hermesShrine,
      occurrence.roomActions.order,
      source.generationKey,
    ) === undefined
  )
    return false;
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

/**
 * Drops a delivery's retained item at one host, with the generated pickup
 * sites its choices owned: the delivery now comes due elsewhere as a new item.
 */
export function discardRetainedHermesShrineDelivery(
  catalog: Catalog,
  document: ProjectDocument,
  entryKey: string,
  host: OccurrenceAddress,
): ProjectDocument {
  const discarded = mapOccurrences(document, (routeKey, biomeKey, occurrence) => {
    const site = occurrence.acquisitionSites?.[HERMES_SHRINE_DELIVERY_SITE_KEY];
    if (
      !occurrenceMatchesAddress(routeKey, biomeKey, occurrence, host) ||
      site?.pickupEntries?.[entryKey] === undefined
    )
      return occurrence;
    const pickupEntries = { ...site.pickupEntries };
    delete pickupEntries[entryKey];
    const acquisitionSites = { ...occurrence.acquisitionSites };
    if (Object.keys(pickupEntries).length === 0)
      delete acquisitionSites[HERMES_SHRINE_DELIVERY_SITE_KEY];
    else
      acquisitionSites[HERMES_SHRINE_DELIVERY_SITE_KEY] = Object.freeze({
        ...site,
        pickupEntries: Object.freeze(pickupEntries),
      });
    const { acquisitionSites: _sites, ...rest } = occurrence;
    void _sites;
    return Object.freeze(
      Object.keys(acquisitionSites).length === 0
        ? rest
        : { ...rest, acquisitionSites: Object.freeze(acquisitionSites) },
    );
  });
  return reconcileGeneratedPickupProducerState(document, discarded, catalog);
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
