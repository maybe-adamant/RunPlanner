import type { Catalog } from '../../catalog-schema';
import type {
  AcquisitionDisposition,
  AuthoredRewardState,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { AcquisitionDispositionCommand } from './types';
import { createNormalDispositionByAcquisitionRole } from '../reward-state';
import { authoredAcquisitionEntryAtSite, replaceAuthoredAcquisitionEntryAtSite } from '../shop';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
} from '../artificer';
import { createOccurrenceAddress } from '../addresses';

function retainArtificerReplacementEntry(
  occurrence: RoomOccurrence,
  located: LocatedBiome,
  source: import('../addresses').TraitOfferOwnerAddress,
  acquisitionRole: string,
  active: boolean,
): RoomOccurrence {
  if (!active) return occurrence;
  const site = artificerAcquisitionSite(
    createOccurrenceAddress(
      { routeKey: source.routeKey, biomeKey: source.biomeKey, kind: 'biome' },
      occurrence.occurrenceId,
    ),
    source,
  );
  const siteKey = acquisitionSiteStorageKey(site);
  const entryKey = artificerReplacementEntryKey(source, acquisitionRole);
  const current = occurrence.acquisitionSites?.[siteKey];
  return Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      [siteKey]: Object.freeze({
        ...current,
        pickupEntries: Object.freeze({
          ...(current?.pickupEntries ?? {}),
          [entryKey]: current?.pickupEntries?.[entryKey] ?? null,
        }),
      }),
    }),
  });
}

function updateReward(
  reward: AuthoredRewardState,
  catalog: Catalog,
  role: string,
  value: AcquisitionDisposition,
): AuthoredRewardState {
  const normalDisposition = createNormalDispositionByAcquisitionRole(catalog, reward.offer);
  const roleKeys = Object.keys(normalDisposition);
  if (!roleKeys.includes(role)) throw new Error(`${role} is not an acquisition role`);
  return Object.freeze({
    ...reward,
    dispositionByAcquisitionRole: Object.freeze({
      ...normalDisposition,
      ...reward.dispositionByAcquisitionRole,
      [role]: value,
    }),
  });
}

/**
 * One command owns only the persisted role-local disposition.  Eligibility is
 * deliberately evaluated later by the chronological acquisition evaluator so
 * invalid authored acquisition dispositions remain repairable findings.
 */
export function applyAcquisitionDispositionCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: AcquisitionDispositionCommand,
): ProjectDocument {
  if (
    command.value.kind !== 'normal' &&
    command.value.kind !== 'timePiece' &&
    command.value.kind !== 'artificer'
  ) {
    failCommand(command, 'disposition must be normal, timePiece, or artificer');
  }
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
  if (
    owner.routeKey !== command.acquisition.routeKey ||
    owner.biomeKey !== command.acquisition.biomeKey
  ) {
    failCommand(command, 'acquisition owner is outside its addressed biome');
  }
  const role = command.acquisition.acquisitionRole;
  const replace = (reward: AuthoredRewardState) => {
    try {
      return updateReward(reward, catalog, role, command.value);
    } catch (error) {
      return failCommand(
        command,
        error instanceof Error ? error.message : 'invalid acquisition role',
      );
    }
  };
  let state: RoomOccurrence['state'];
  switch (owner.kind) {
    case 'gorgonPhase':
      failCommand(command, 'Gorgon phase has no acquisition conversion surface');
      break;
    case 'acquisitionEntry': {
      const entry = authoredAcquisitionEntryAtSite(occurrence, owner.site, owner.entryKey);
      if (entry === undefined || entry === null)
        failCommand(command, 'missing or unresolved pickup entry');
      const replaced = replaceOccurrence(
        topology,
        retainArtificerReplacementEntry(
          replaceAuthoredAcquisitionEntryAtSite(
            occurrence,
            owner.site,
            owner.entryKey,
            replace(entry),
          ),
          located,
          owner,
          role,
          command.value.kind === 'artificer',
        ),
      );
      return updateOccurrenceTopology(document, located, replaced);
    }
    case 'incomingReward':
      switch (occurrence.state.kind) {
        case 'counted':
        case 'fixed':
        case 'anomaly':
        case 'ephyraCombat':
        case 'freeReward':
          if (occurrence.state.reward === null)
            failCommand(command, 'cannot edit acquisition disposition before reward authorship');
          state = Object.freeze({ ...occurrence.state, reward: replace(occurrence.state.reward) });
          break;
        default:
          return failCommand(command, `${occurrence.gameName} has no incoming reward`);
      }
      break;
    case 'localReward':
      if (occurrence.state.kind === 'fieldsCombat') {
        const rewards =
          owner.groupKey === 'cages'
            ? occurrence.state.cages
            : owner.groupKey === 'optionalRewards'
              ? occurrence.state.optionalRewards
              : undefined;
        const reward = rewards?.[owner.slotKey];
        if (reward === undefined) failCommand(command, `missing local reward ${owner.slotKey}`);
        if (reward === null)
          failCommand(command, 'cannot edit acquisition disposition before reward authorship');
        const nextReward = replace(reward);
        state = Object.freeze({
          ...occurrence.state,
          ...(owner.groupKey === 'cages'
            ? {
                cages: Object.freeze({
                  ...occurrence.state.cages,
                  [owner.slotKey]: nextReward,
                }),
              }
            : {
                optionalRewards: Object.freeze({
                  ...occurrence.state.optionalRewards,
                  [owner.slotKey]: nextReward,
                }),
              }),
        });
      } else {
        return failCommand(command, `${occurrence.gameName} has no local reward`);
      }
      break;
    case 'rewardWheelOffer': {
      if (occurrence.state.kind !== 'shipCombat')
        return failCommand(command, `${occurrence.gameName} has no reward wheel`);
      const wheel = occurrence.state.wheels[owner.wheelKey];
      const reward = wheel?.offers[owner.offerKey];
      if (wheel === undefined || reward === undefined)
        return failCommand(
          command,
          `missing reward wheel offer ${owner.wheelKey}/${owner.offerKey}`,
        );
      if (reward === null)
        failCommand(command, 'cannot edit acquisition disposition before reward authorship');
      state = Object.freeze({
        ...occurrence.state,
        wheels: Object.freeze({
          ...occurrence.state.wheels,
          [owner.wheelKey]: Object.freeze({
            ...wheel,
            offers: Object.freeze({ ...wheel.offers, [owner.offerKey]: replace(reward) }),
          }),
        }),
      });
      break;
    }
    case 'shopOffer': {
      if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined)
        return failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      const entry = occurrence.state.shop.offers[owner.offerKey];
      if (entry === undefined) return failCommand(command, `missing Shop offer ${owner.offerKey}`);
      if (entry.reward === null)
        failCommand(command, 'cannot edit acquisition disposition before reward authorship');
      state = Object.freeze({
        ...occurrence.state,
        shop: Object.freeze({
          ...occurrence.state.shop,
          offers: Object.freeze({
            ...occurrence.state.shop.offers,
            [owner.offerKey]: Object.freeze({ ...entry, reward: replace(entry.reward) }),
          }),
        }),
      });
      break;
    }
    case 'encounterPhase':
      return failCommand(command, 'encounter trait offers are not reward acquisition roles');
  }
  const replacedOccurrence = retainArtificerReplacementEntry(
    Object.freeze({ ...occurrence, state }),
    located,
    owner,
    role,
    command.value.kind === 'artificer',
  );
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, replacedOccurrence),
  );
}
