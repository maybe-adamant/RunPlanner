import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { AcquisitionSiteCommand } from './types';
import {
  createDefaultAcquisitionRewardState,
  createDefaultPickupRewardState,
  selectedPickupProducer,
} from '../traits';
import {
  authoredAcquisitionEntry,
  echoShopDuplicateOfferMatches,
  echoShopDuplicateSourceOfferKey,
} from '../shop';

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
  if (command.kind === 'ReplaceAcquisitionEntryOffer') {
    const site = command.entry.site;
    if (site.owner.kind !== 'occurrence' || site.pointKey !== 'roomExit')
      failCommand(command, 'is not an authorable pickup entry');
    const topology = requireTopology(located.plan, command);
    const occurrence = requireOccurrence(located.plan, site.owner.occurrenceId, command);
    const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
    const entry = authoredAcquisitionEntry(
      catalog,
      occurrence,
      command.entry.entryKey,
      located.loadout,
    );
    if (entry === undefined) failCommand(command, 'does not own a materialized pickup entry');
    if (entry.offer.rewardType !== command.value.rewardType)
      failCommand(command, `must retain declared reward type ${entry.offer.rewardType}`);
    if (sameOccurrenceValue(entry.offer, command.value)) return document;
    const duplicateSourceKey = echoShopDuplicateSourceOfferKey(command.entry.entryKey);
    const duplicateSource =
      duplicateSourceKey === undefined || occurrence.state.kind !== 'shop'
        ? undefined
        : occurrence.state.shop?.offers[duplicateSourceKey]?.reward.offer;
    if (
      duplicateSourceKey !== undefined &&
      (duplicateSource === undefined ||
        !echoShopDuplicateOfferMatches(catalog, duplicateSource, command.value))
    )
      failCommand(command, 'Echo Shop duplicate must retain its paid source reward identity');
    const route = document.routes.find((candidate) => candidate.routeKey === site.routeKey);
    if (route === undefined) failCommand(command, `unknown route ${site.routeKey}`);
    if (duplicateSourceKey !== undefined) {
      const profileKey =
        occurrence.state.kind === 'shop' ? occurrence.state.shop?.profileKey : undefined;
      if (profileKey === undefined) failCommand(command, 'has no Shop acquisition profile');
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
                order: occurrence.acquisitionSites?.roomExit?.order ?? [],
                pickupEntries: Object.freeze({
                  ...pickupEntries,
                  [command.entry.entryKey]: createDefaultAcquisitionRewardState(
                    catalog,
                    command.value,
                    route.loadout,
                    { kind: 'shopProfile', key: profileKey },
                  ),
                }),
              }),
            }),
          }),
        ),
      );
    }
    const producer = selectedPickupProducer(catalog, occurrence.encounters);
    if (producer === undefined) failCommand(command, 'has no selected pickup producer');
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
              order: occurrence.acquisitionSites?.roomExit?.order ?? [],
              pickupEntries: Object.freeze({
                ...pickupEntries,
                [command.entry.entryKey]: createDefaultPickupRewardState(
                  catalog,
                  command.value,
                  route.loadout,
                  producer.disposition.producerLifecycleKey,
                ),
              }),
            }),
          }),
        }),
      ),
    );
  }
  if (command.site.owner.kind !== 'occurrence' || command.site.pointKey !== 'roomExit') {
    failCommand(command, 'is not an authorable acquisition site');
  }
  if (
    !Array.isArray(command.entryKeys) ||
    !command.entryKeys.every((key) => typeof key === 'string')
  ) {
    failCommand(command, 'entryKeys must be an array of entry keys');
  }
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.site.owner.occurrenceId, command);
  const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
  const shopOffers =
    occurrence.state.kind === 'shop' && occurrence.state.shop !== undefined
      ? occurrence.state.shop.offers
      : undefined;
  if (shopOffers === undefined && pickupEntries === undefined)
    failCommand(command, 'does not own a materialized authorable acquisition site');
  const seen = new Set<string>();
  for (const key of command.entryKeys) {
    const belongs =
      shopOffers === undefined ? pickupEntries?.[key] !== undefined : shopOffers[key] !== undefined;
    if (!belongs) failCommand(command, `unknown entry ${key}`);
    if (seen.has(key)) failCommand(command, `entry ${key} is duplicated`);
    seen.add(key);
  }
  const existing = occurrence.acquisitionSites?.[command.site.pointKey]?.order ?? [];
  if (sameOccurrenceValue(command.entryKeys, existing)) return document;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        acquisitionSites: Object.freeze({
          ...(occurrence.acquisitionSites ?? {}),
          [command.site.pointKey]: Object.freeze({
            order: Object.freeze([...command.entryKeys]),
            ...(pickupEntries === undefined ? {} : { pickupEntries }),
          }),
        }),
      }),
    ),
  );
}
