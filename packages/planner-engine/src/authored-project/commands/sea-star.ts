import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { createBiomeAddress, createOccurrenceAddress } from '../addresses';
import { acquisitionSiteStorageKey } from '../artificer';
import {
  createSeaStarDuplicateRewardState,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  seaStarDuplicateAcquisitionSite,
} from '../sea-star';
import { authoredAcquisitionSourceAt } from '../acquisition-sources';
import { resolveAcquisitionRole } from '../../reward-kernel/history';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { SeaStarResultCommand } from './types';

export function applySeaStarResultCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: SeaStarResultCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const owner = command.acquisition.owner;
  const occurrenceId =
    owner.kind === 'acquisitionEntry'
      ? owner.site.owner.kind === 'occurrence'
        ? owner.site.owner.occurrenceId
        : failCommand(command, 'acquisition entry is not occurrence-owned')
      : owner.kind === 'encounterPhase'
        ? owner.owner.occurrenceId
        : owner.kind === 'gorgonPhase'
          ? owner.encounter.owner.occurrenceId
          : owner.occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  const source = authoredAcquisitionSourceAt(
    createBiomeAddress(command.acquisition.routeKey, command.acquisition.biomeKey),
    occurrence,
    command.acquisition,
  );
  if (source === undefined) failCommand(command, 'has no authored concrete acquisition');
  const reward = source.reward;
  if (command.procced) {
    if (
      command.acquisition.owner.kind === 'acquisitionEntry' &&
      command.acquisition.owner.site.pointKey.startsWith('seaStarDuplicate:')
    )
      failCommand(command, 'cannot duplicate a Sea Star duplicate');
    const resolved = resolveAcquisitionRole(
      catalog.rewards,
      reward.offer,
      command.acquisition.acquisitionRole,
      'roomRewardPickup',
    );
    if (catalog.rewards.acquisitions.byKey[resolved.acquisition.gameName]?.canDuplicate !== true)
      failCommand(command, 'source declaration cannot duplicate');
  }
  if (reward.dispositionByAcquisitionRole[command.acquisition.acquisitionRole] === undefined)
    failCommand(command, 'does not own the addressed acquisition role');
  const occurrenceAddress = createOccurrenceAddress(
    {
      kind: 'biome',
      routeKey: command.acquisition.routeKey,
      biomeKey: command.acquisition.biomeKey,
    },
    occurrence.occurrenceId,
  );
  const site = seaStarDuplicateAcquisitionSite(occurrenceAddress, command.acquisition);
  const siteKey = acquisitionSiteStorageKey(site);
  const sites = { ...(occurrence.acquisitionSites ?? {}) };
  if (command.procced) {
    const duplicate = createSeaStarDuplicateRewardState(
      catalog,
      reward,
      command.acquisition.acquisitionRole,
    );
    sites[siteKey] = Object.freeze({
      pickupEntries: Object.freeze({ [SEA_STAR_DUPLICATE_ENTRY_KEY]: duplicate }),
    });
  } else {
    delete sites[siteKey];
  }
  const actions = occurrence.roomActions.order.filter(
    (action) =>
      action.kind !== 'interactAcquisitionEntry' ||
      action.siteKey !== siteKey ||
      action.entryKey !== SEA_STAR_DUPLICATE_ENTRY_KEY,
  );
  if (command.procced)
    actions.push(
      Object.freeze({
        kind: 'interactAcquisitionEntry' as const,
        siteKey,
        entryKey: SEA_STAR_DUPLICATE_ENTRY_KEY,
      }),
    );
  const withoutSites = { ...occurrence };
  delete withoutSites.acquisitionSites;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...withoutSites,
        ...(Object.keys(sites).length === 0 ? {} : { acquisitionSites: Object.freeze(sites) }),
        roomActions: Object.freeze({ order: Object.freeze(actions) }),
      }),
    ),
  );
}
