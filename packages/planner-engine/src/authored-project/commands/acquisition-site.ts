import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { AcquisitionSiteCommand, DerivedShopEntryEditCommand } from './types';
import {
  createDefaultAcquisitionRewardState,
  createDefaultPickupRewardState,
  selectedPickupProducer,
} from '../traits';
import {
  authoredAcquisitionEntry,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../shop';
import { parseArtificerReplacementEntryKey } from '../artificer';

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
    const expected = createDefaultAcquisitionRewardState(
      catalog,
      command.defaultValue.offer,
      located.loadout,
      { kind: 'shopProfile', key: profileKey },
    );
    if (
      command.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY &&
      !sameOccurrenceValue(expected, command.defaultValue)
    )
      failCommand(command, 'must use the declaration-complete derived refill default');
    if (
      command.entryKey !== TRAVEL_DEAL_REFILL_ENTRY_KEY &&
      command.entryKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
    )
      failCommand(command, 'has an unknown derived Shop entry');
    if (!command.entryKeys.includes(command.entryKey))
      failCommand(command, `must include ${command.entryKey} in the acquisition order`);
    const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries ?? {};
    const nextOccurrence = Object.freeze({
      ...occurrence,
      acquisitionSites: Object.freeze({
        ...(occurrence.acquisitionSites ?? {}),
        roomExit: Object.freeze({
          order: Object.freeze([...command.entryKeys]),
          pickupEntries: Object.freeze({
            ...pickupEntries,
            [command.entryKey]: pickupEntries[command.entryKey] ?? command.defaultValue,
          }),
        }),
      }),
    });
    return updateOccurrenceTopology(document, located, replaceOccurrence(topology, nextOccurrence));
  }
  if (command.kind === 'ReplaceAcquisitionEntryOffer') {
    const site = command.entry.site;
    if (site.owner.kind !== 'occurrence' || site.pointKey !== 'roomExit')
      failCommand(command, 'is not an authorable pickup entry');
    const topology = requireTopology(located.plan, command);
    const occurrence = requireOccurrence(located.plan, site.owner.occurrenceId, command);
    const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
    const entry = authoredAcquisitionEntry(catalog, occurrence, command.entry.entryKey);
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
      entry !== undefined &&
      entry.offer.rewardType !== command.value.rewardType
    )
      failCommand(command, `must retain declared reward type ${entry.offer.rewardType}`);
    if (entry !== undefined && sameOccurrenceValue(entry.offer, command.value)) return document;
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
                order: occurrence.acquisitionSites?.roomExit?.order ?? [],
                pickupEntries: Object.freeze({
                  ...pickupEntries,
                  [command.entry.entryKey]: createDefaultAcquisitionRewardState(
                    catalog,
                    command.value,
                    route.loadout,
                    effectSource,
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
    const parsedArtificer = parseArtificerReplacementEntryKey(key);
    const artificerSource =
      parsedArtificer === undefined ? undefined : pickupEntries?.[parsedArtificer.sourceKey];
    const belongs =
      shopOffers === undefined
        ? pickupEntries?.[key] !== undefined ||
          artificerSource?.dispositionByAcquisitionRole[parsedArtificer!.acquisitionRole]?.kind ===
            'artificer'
        : shopOffers[key] !== undefined ||
          pickupEntries?.[key] !== undefined ||
          artificerSource?.dispositionByAcquisitionRole[parsedArtificer!.acquisitionRole]?.kind ===
            'artificer';
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

/** Persist a derived Shop payload default without selecting it in chronology. */
export function materializeDerivedShopEntryDefault(
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
  const expected = createDefaultAcquisitionRewardState(
    catalog,
    command.defaultValue.offer,
    located.loadout,
    { kind: 'shopProfile', key: profileKey },
  );
  if (
    command.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY &&
    !sameOccurrenceValue(expected, command.defaultValue)
  )
    failCommand(command, 'must use the declaration-complete derived entry default');
  const site = occurrence.acquisitionSites?.roomExit;
  if (site?.pickupEntries?.[command.entryKey] !== undefined) return document;
  const nextOccurrence = Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      roomExit: Object.freeze({
        order: site?.order ?? Object.freeze([]),
        pickupEntries: Object.freeze({
          ...(site?.pickupEntries ?? {}),
          [command.entryKey]: command.defaultValue,
        }),
      }),
    }),
  });
  return updateOccurrenceTopology(document, located, replaceOccurrence(topology, nextOccurrence));
}
