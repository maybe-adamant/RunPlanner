import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { AcquisitionSiteCommand, DerivedShopEntryEditCommand } from './types';
import {
  createUnresolvedAcquisitionRewardState,
  createUnresolvedPickupRewardState,
} from '../traits';
import { selectedPickupProducers } from '../pickup-producers';
import {
  authoredAcquisitionEntry,
  authoredAcquisitionEntryAtSite,
  echoShopDuplicateOffer,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  replaceAuthoredAcquisitionEntryAtSite,
} from '../shop';
import { parseArtificerReplacementEntryKey } from '../artificer';
import {
  defaultHermesShrineDeliveryReward,
  parseHermesShrineDeliveryEntryKey,
} from '../hermes-shrine-delivery';
import { createBiomeAddress } from '../addresses';
import {
  roomActionDomainForOccurrence,
  scheduleRequiredRoomActions,
} from '../room-action-defaults';
import { roomActionKey } from '../room-actions';

function shrineDeliverySource(
  document: ProjectDocument,
  entryKey: string,
): import('../model').HermesShrineInventoryOffer | undefined {
  const parsed = parseHermesShrineDeliveryEntryKey(entryKey);
  if (parsed === undefined) return undefined;
  const source = document.routes
    .find((route) => route.routeKey === parsed.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === parsed.biomeKey)
    ?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === parsed.sourceOccurrenceId,
    );
  if (parsed.generationKey === 'travelDealRefill')
    return source?.hermesShrine?.travelDealRefill?.offer ?? undefined;
  const slotKey = parsed.generationKey.slice(
    'initial:'.length,
  ) as import('../model').HermesShrineSlotKey;
  return source?.hermesShrine?.offerBySlot[slotKey] ?? undefined;
}

function derivedShopEntryValue(
  catalog: Catalog,
  occurrence: import('../model').RoomOccurrence,
  entryKey: typeof TRAVEL_DEAL_REFILL_ENTRY_KEY | typeof ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  sourceOfferKey: string,
  command: AcquisitionSiteCommand | DerivedShopEntryEditCommand,
): import('../model').AuthoredRewardState | null {
  const shop = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  if (shop === undefined) failCommand(command, 'has no materialized Shop');
  const source =
    shop.offers[sourceOfferKey]?.reward ??
    occurrence.acquisitionSites?.roomExit?.pickupEntries?.[sourceOfferKey];
  if (source === undefined || source === null)
    failCommand(command, `has no concrete derived-entry source ${sourceOfferKey}`);
  if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) return null;
  const duplicateOffer = echoShopDuplicateOffer(catalog, source.offer);
  return duplicateOffer === null
    ? null
    : createUnresolvedAcquisitionRewardState(catalog, duplicateOffer, {
        kind: 'shopProfile',
        key: shop.profileKey,
      });
}

/**
 * The first authorable settlement point is a materialized Shop's room-exit
 * point.  The closed branch is deliberately narrow: future pickup families
 * add their own active-entry-domain authority here rather than making the
 * command infer room names or presentation state.
 */
export function applyAcquisitionSiteCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: AcquisitionSiteCommand,
): ProjectDocument {
  if (command.kind === 'PlaceHermesShrineDelivery') {
    const site = command.entry.site;
    if (site.owner.kind !== 'occurrence' || site.pointKey !== 'hermesShrineDelivery')
      failCommand(command, 'is not a Shrine delivery site');
    const topology = requireTopology(located.plan, command);
    const host = requireOccurrence(located.plan, site.owner.occurrenceId, command);
    const parsed = parseHermesShrineDeliveryEntryKey(command.entry.entryKey);
    if (parsed === undefined) failCommand(command, 'does not name an exact Shrine delivery');
    const source = document.routes
      .find((route) => route.routeKey === parsed.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === parsed.biomeKey)
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === parsed.sourceOccurrenceId,
      );
    if (source?.hermesShrine === undefined)
      failCommand(command, 'does not name a Shrine source occurrence');
    const sourceOffer =
      parsed.generationKey === 'travelDealRefill'
        ? source.hermesShrine.travelDealRefill?.offer
        : source.hermesShrine.offerBySlot[
            parsed.generationKey.slice('initial:'.length) as import('../model').HermesShrineSlotKey
          ];
    const purchase =
      parsed.generationKey === 'travelDealRefill'
        ? source.hermesShrine.travelDealRefill?.purchase
        : source.hermesShrine.purchaseBySlot?.[
            parsed.generationKey.slice('initial:'.length) as import('../model').HermesShrineSlotKey
          ];
    if (sourceOffer === undefined || sourceOffer === null || purchase === undefined)
      failCommand(command, 'does not name a purchased Shrine delivery');
    if (command.encounterPhaseKey.trim().length === 0)
      failCommand(command, 'has no due encounter phase');
    const sourceIsHost =
      parsed.routeKey === site.owner.routeKey &&
      parsed.biomeKey === site.owner.biomeKey &&
      parsed.sourceOccurrenceId === site.owner.occurrenceId;
    if (sourceIsHost)
      failCommand(command, 'same-room Shrine deliveries use the post-outgoing window');
    const deliveryReference = Object.freeze({
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'hermesShrineDelivery',
      entryKey: command.entry.entryKey,
      encounterPhaseKey: command.encounterPhaseKey,
    });
    const actionIndex = host.roomActions.order.findIndex(
      (reference) => roomActionKey(reference) === roomActionKey(deliveryReference),
    );
    const actionAlreadyOrdered = actionIndex >= 0;
    const existingEntries = host.acquisitionSites?.hermesShrineDelivery?.pickupEntries ?? {};
    const existingAction = actionAlreadyOrdered ? host.roomActions.order[actionIndex] : undefined;
    const phaseAlreadyPersisted =
      existingAction?.kind === 'interactAcquisitionEntry' &&
      existingAction.encounterPhaseKey === command.encounterPhaseKey;
    if (phaseAlreadyPersisted && existingEntries[command.entry.entryKey] !== undefined)
      return document;
    const nextHostWithoutActions = Object.freeze({
      ...host,
      acquisitionSites: Object.freeze({
        ...(host.acquisitionSites ?? {}),
        hermesShrineDelivery: Object.freeze({
          ...(host.acquisitionSites?.hermesShrineDelivery ?? {}),
          pickupEntries: Object.freeze({
            ...existingEntries,
            [command.entry.entryKey]:
              existingEntries[command.entry.entryKey] ??
              defaultHermesShrineDeliveryReward(catalog, sourceOffer.rewardType),
          }),
        }),
      }),
    });
    if (actionAlreadyOrdered) {
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          topology,
          Object.freeze({
            ...nextHostWithoutActions,
            roomActions: Object.freeze({
              order: Object.freeze(
                host.roomActions.order.map((reference, index) =>
                  index === actionIndex ? deliveryReference : reference,
                ),
              ),
            }),
          }),
        ),
      );
    }
    const provisionalDocument = updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        topology,
        Object.freeze({
          ...nextHostWithoutActions,
          roomActions: Object.freeze({
            order: Object.freeze([...host.roomActions.order, deliveryReference]),
          }),
        }),
      ),
    );
    const provisionalDomain = roomActionDomainForOccurrence(
      provisionalDocument,
      catalog,
      createBiomeAddress(site.routeKey, site.biomeKey),
      site.owner.occurrenceId,
    )?.domain;
    if (provisionalDomain === undefined)
      failCommand(command, 'delivery host has no room-action domain');
    const canonical = scheduleRequiredRoomActions({
      catalog,
      domain: provisionalDomain,
      order: host.roomActions.order,
      requiredKeys: new Set([roomActionKey(deliveryReference)]),
    });
    const canonicalIndex = canonical.findIndex(
      (reference) => roomActionKey(reference) === roomActionKey(deliveryReference),
    );
    if (
      !Number.isInteger(command.index) ||
      command.index < 0 ||
      command.index > host.roomActions.order.length
    )
      failCommand(
        command,
        `index must be an integer from 0 through ${host.roomActions.order.length}`,
      );
    if (command.index !== canonicalIndex)
      failCommand(command, `required room action canonical index is ${canonicalIndex}`);
    const nextOrder = [...host.roomActions.order];
    nextOrder.splice(command.index, 0, deliveryReference);
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        topology,
        Object.freeze({
          ...nextHostWithoutActions,
          roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
        }),
      ),
    );
  }
  if (command.kind === 'SelectDerivedShopEntry') {
    if (command.site.owner.kind !== 'occurrence' || command.site.pointKey !== 'roomExit')
      failCommand(command, 'is not an authorable Shop acquisition site');
    const topology = requireTopology(located.plan, command);
    const occurrence = requireOccurrence(located.plan, command.site.owner.occurrenceId, command);
    const profileKey =
      occurrence.state.kind === 'shop' ? occurrence.state.shop?.profileKey : undefined;
    if (profileKey === undefined) failCommand(command, 'has no materialized Shop');
    if (
      command.entryKey !== TRAVEL_DEAL_REFILL_ENTRY_KEY &&
      command.entryKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
    )
      failCommand(command, 'has an unknown derived Shop entry');
    const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries ?? {};
    const derivedValue = derivedShopEntryValue(
      catalog,
      occurrence,
      command.entryKey,
      command.sourceOfferKey,
      command,
    );
    const nextOccurrence = Object.freeze({
      ...occurrence,
      acquisitionSites: Object.freeze({
        ...(occurrence.acquisitionSites ?? {}),
        roomExit: Object.freeze({
          pickupEntries: Object.freeze({
            ...pickupEntries,
            [command.entryKey]: pickupEntries[command.entryKey] ?? derivedValue,
          }),
        }),
      }),
    });
    return updateOccurrenceTopology(document, located, replaceOccurrence(topology, nextOccurrence));
  }
  if (command.kind === 'ReplaceAcquisitionEntryOffer') {
    const site = command.entry.site;
    if (site.owner.kind !== 'occurrence') failCommand(command, 'is not an authorable pickup entry');
    const topology = requireTopology(located.plan, command);
    const occurrence = requireOccurrence(located.plan, site.owner.occurrenceId, command);
    const siteProducer = selectedPickupProducers(
      catalog,
      { kind: 'biome', routeKey: site.routeKey, biomeKey: site.biomeKey },
      occurrence,
    ).find(
      (candidate) =>
        candidate.siteKey === site.pointKey &&
        candidate.pickups.some((pickup) => pickup.key === command.entry.entryKey),
    );
    if (site.pointKey !== 'roomExit') {
      const shrineSource =
        site.pointKey === 'hermesShrineDelivery'
          ? shrineDeliverySource(document, command.entry.entryKey)
          : undefined;
      if (
        site.pointKey === 'hermesShrineDelivery' &&
        parseHermesShrineDeliveryEntryKey(command.entry.entryKey) !== undefined
      ) {
        if (shrineSource === undefined)
          failCommand(command, 'does not name an exact Shrine offer source');
        if (shrineSource.rewardType !== command.value.rewardType)
          failCommand(command, `must retain Shrine reward type ${shrineSource.rewardType}`);
        const existing = authoredAcquisitionEntryAtSite(occurrence, site, command.entry.entryKey);
        if (
          existing !== undefined &&
          existing !== null &&
          sameOccurrenceValue(existing.offer, command.value)
        )
          return document;
        const nextOccurrence =
          occurrence.acquisitionSites?.[site.pointKey] === undefined
            ? Object.freeze({
                ...occurrence,
                acquisitionSites: Object.freeze({
                  ...(occurrence.acquisitionSites ?? {}),
                  [site.pointKey]: Object.freeze({ pickupEntries: Object.freeze({}) }),
                }),
              })
            : occurrence;
        return updateOccurrenceTopology(
          document,
          located,
          replaceOccurrence(
            topology,
            replaceAuthoredAcquisitionEntryAtSite(
              nextOccurrence,
              site,
              command.entry.entryKey,
              createUnresolvedAcquisitionRewardState(catalog, command.value, {
                kind: 'producerLifecycle',
                key: 'HermesShrineDelivery',
              }),
            ),
          ),
        );
      }
      const parsed = parseArtificerReplacementEntryKey(command.entry.entryKey);
      const entry = authoredAcquisitionEntryAtSite(occurrence, site, command.entry.entryKey);
      const runProgress = catalog.rewards.stores.byKey.RunProgress;
      if (parsed === undefined && siteProducer !== undefined) {
        // A payload-bearing fixed pickup is structurally materialized as null
        // until the user supplies its exact offer.  Its source-scoped producer
        // still owns that unresolved entry.
        if (entry === undefined) failCommand(command, 'does not own a materialized pickup entry');
        const pickup = siteProducer.pickups.find(
          (candidate) => candidate.key === command.entry.entryKey,
        );
        if (pickup?.rewardType !== undefined && pickup.rewardType !== command.value.rewardType)
          failCommand(command, `must retain declared reward type ${pickup.rewardType}`);
        if (entry !== null && sameOccurrenceValue(entry.offer, command.value)) return document;
        return updateOccurrenceTopology(
          document,
          located,
          replaceOccurrence(
            topology,
            replaceAuthoredAcquisitionEntryAtSite(
              occurrence,
              site,
              command.entry.entryKey,
              createUnresolvedPickupRewardState(
                catalog,
                command.value,
                siteProducer.producerLifecycleKey,
              ),
            ),
          ),
        );
      }
      if (parsed === undefined || entry === undefined)
        failCommand(command, 'does not own an Artificer replacement entry');
      if (
        command.value.rewardType === 'Devotion' ||
        command.value.rewardType === 'SpellDrop' ||
        !runProgress?.entries.some((candidate) => candidate.rewardType === command.value.rewardType)
      )
        failCommand(command, 'must be an Artificer-eligible RunProgress reward');
      const value = createUnresolvedAcquisitionRewardState(catalog, command.value, {
        kind: 'producerLifecycle',
        key: 'RoomReward',
      });
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          topology,
          replaceAuthoredAcquisitionEntryAtSite(occurrence, site, command.entry.entryKey, value),
        ),
      );
    }
    const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
    const entry = authoredAcquisitionEntry(catalog, occurrence, command.entry.entryKey);
    const producer = selectedPickupProducers(
      catalog,
      { kind: 'biome', routeKey: site.routeKey, biomeKey: site.biomeKey },
      occurrence,
    ).find(
      (candidate) =>
        candidate.siteKey === 'roomExit' &&
        candidate.pickups.some((pickup) => pickup.key === command.entry.entryKey),
    );
    const pickup = producer?.pickups.find((candidate) => candidate.key === command.entry.entryKey);
    const supplementalEntry =
      command.entry.entryKey === INFERNAL_CONTRACT_ENTRY_KEY ||
      command.entry.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY ||
      command.entry.entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY;
    if (
      entry === undefined &&
      command.entry.entryKey !== TRAVEL_DEAL_REFILL_ENTRY_KEY &&
      command.entry.entryKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
    )
      failCommand(command, 'does not own a materialized pickup entry');
    if (
      !supplementalEntry &&
      pickup?.rewardType !== undefined &&
      pickup.rewardType !== command.value.rewardType
    )
      failCommand(command, `must retain declared reward type ${pickup.rewardType}`);
    if (entry !== undefined && entry !== null && sameOccurrenceValue(entry.offer, command.value))
      return document;
    const route = document.routes.find((candidate) => candidate.routeKey === site.routeKey);
    if (route === undefined) failCommand(command, `unknown route ${site.routeKey}`);
    if (supplementalEntry) {
      if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined)
        failCommand(command, 'supplemental entry requires a materialized Shop');
      const room = catalog.rooms.byKey[occurrence.gameName];
      const source =
        command.entry.entryKey === INFERNAL_CONTRACT_ENTRY_KEY
          ? room?.infernalContractReward
          : undefined;
      if (
        command.entry.entryKey === INFERNAL_CONTRACT_ENTRY_KEY &&
        (source === undefined || !source.rewardTypes.includes(command.value.rewardType))
      )
        failCommand(command, 'reward is outside the Infernal Contract pedestal domain');
      const effectSource =
        source === undefined
          ? ({ kind: 'shopProfile', key: occurrence.state.shop.profileKey } as const)
          : ({ kind: 'producerLifecycle', key: source.producerLifecycleKey } as const);
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          topology,
          Object.freeze({
            ...occurrence,
            acquisitionSites: Object.freeze({
              ...(occurrence.acquisitionSites ?? {}),
              roomExit: Object.freeze({
                pickupEntries: Object.freeze({
                  ...pickupEntries,
                  [command.entry.entryKey]: createUnresolvedAcquisitionRewardState(
                    catalog,
                    command.value,
                    effectSource,
                  ),
                }),
              }),
            }),
          }),
        ),
      );
    }
    if (producer === undefined) failCommand(command, 'has no selected pickup producer');
    if (!producer.pickups.some((pickup) => pickup.key === command.entry.entryKey))
      failCommand(command, 'does not name an active pickup entry');
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        topology,
        Object.freeze({
          ...occurrence,
          acquisitionSites: Object.freeze({
            ...(occurrence.acquisitionSites ?? {}),
            roomExit: Object.freeze({
              pickupEntries: Object.freeze({
                ...pickupEntries,
                [command.entry.entryKey]: createUnresolvedPickupRewardState(
                  catalog,
                  command.value,
                  producer.producerLifecycleKey,
                ),
              }),
            }),
          }),
        }),
      ),
    );
  }
  return failCommand(command, 'unknown acquisition-site command');
}

/** Persist only source-derived facts (or an unresolved leaf) before a nested edit. */
export function materializeDerivedShopEntry(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: DerivedShopEntryEditCommand,
): ProjectDocument {
  if (command.site.owner.kind !== 'occurrence' || command.site.pointKey !== 'roomExit')
    failCommand(command, 'is not an authorable Shop acquisition site');
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.site.owner.occurrenceId, command);
  const profileKey =
    occurrence.state.kind === 'shop' ? occurrence.state.shop?.profileKey : undefined;
  if (profileKey === undefined) failCommand(command, 'has no materialized Shop');
  if (
    command.entryKey !== TRAVEL_DEAL_REFILL_ENTRY_KEY &&
    command.entryKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
  )
    failCommand(command, 'has an unknown derived Shop entry');
  const site = occurrence.acquisitionSites?.roomExit;
  if (site?.pickupEntries?.[command.entryKey] !== undefined) return document;
  const derivedValue = derivedShopEntryValue(
    catalog,
    occurrence,
    command.entryKey,
    command.sourceOfferKey,
    command,
  );
  const nextOccurrence = Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      roomExit: Object.freeze({
        pickupEntries: Object.freeze({
          ...(site?.pickupEntries ?? {}),
          [command.entryKey]: derivedValue,
        }),
      }),
    }),
  });
  return updateOccurrenceTopology(document, located, replaceOccurrence(topology, nextOccurrence));
}
