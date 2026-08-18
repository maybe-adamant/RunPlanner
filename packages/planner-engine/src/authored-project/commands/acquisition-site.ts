import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { AcquisitionSiteCommand, DerivedShopEntryEditCommand } from './types';
import {
  createUnresolvedAcquisitionRewardState,
  createUnresolvedPickupRewardState,
  selectedPickupProducer,
} from '../traits';
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
    if (site.pointKey !== 'roomExit') {
      const parsed = parseArtificerReplacementEntryKey(command.entry.entryKey);
      const entry = authoredAcquisitionEntryAtSite(occurrence, site, command.entry.entryKey);
      const runProgress = catalog.rewards.stores.byKey.RunProgress;
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
    const producer = selectedPickupProducer(catalog, occurrence.encounters);
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
