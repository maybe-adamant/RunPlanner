import type { Catalog } from '../../catalog-schema';
import type { AuthoredRewardState, ProjectDocument, RoomOccurrence } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { requireEphyraSideGroup } from './occurrence-ephyra';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { AcquisitionConversionCommand } from './types';
import { createDefaultConversionByAcquisitionRole } from '../reward-state';
import { authoredAcquisitionEntry, replaceAuthoredAcquisitionEntry } from '../shop';

function updateReward(
  reward: AuthoredRewardState,
  catalog: Catalog,
  role: string,
  value: 'normal' | 'gold',
): AuthoredRewardState {
  const defaults = createDefaultConversionByAcquisitionRole(catalog, reward.offer);
  const roleKeys = Object.keys(defaults);
  if (!roleKeys.includes(role)) throw new Error(`${role} is not an acquisition role`);
  return Object.freeze({
    ...reward,
    conversionByAcquisitionRole: Object.freeze({
      ...defaults,
      ...reward.conversionByAcquisitionRole,
      [role]: value,
    }),
  });
}

/**
 * One command owns only the persisted role-local disposition.  Eligibility is
 * deliberately evaluated later by the chronological acquisition evaluator so
 * invalid authored `gold` choices remain repairable findings.
 */
export function applyAcquisitionConversionCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: AcquisitionConversionCommand,
): ProjectDocument {
  if (command.value !== 'normal' && command.value !== 'gold') {
    failCommand(command, 'conversion must be normal or gold');
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
      const site = occurrence.acquisitionSites?.roomExit;
      const entry = authoredAcquisitionEntry(catalog, occurrence, owner.entryKey);
      if (site === undefined || entry === undefined) failCommand(command, 'missing pickup entry');
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          topology,
          replaceAuthoredAcquisitionEntry(occurrence, owner.entryKey, replace(entry)),
        ),
      );
    }
    case 'incomingReward':
      switch (occurrence.state.kind) {
        case 'counted':
        case 'fixed':
        case 'anomaly':
        case 'ephyraCombat':
        case 'freeReward':
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
        state = Object.freeze({
          ...occurrence.state,
          ...(owner.groupKey === 'cages'
            ? {
                cages: Object.freeze({
                  ...occurrence.state.cages,
                  [owner.slotKey]: replace(reward),
                }),
              }
            : {
                optionalRewards: Object.freeze({
                  ...occurrence.state.optionalRewards,
                  [owner.slotKey]: replace(reward),
                }),
              }),
        });
      } else if (occurrence.state.kind === 'ephyraCombat') {
        const { state: ephyra, group } = requireEphyraSideGroup(
          occurrence,
          catalog,
          located,
          owner.groupKey,
          command as unknown as import('./types').TraitOfferCommand,
        );
        if (!group.slots.some((slot) => slot.slotKey === owner.slotKey))
          failCommand(command, `unknown side-room slot ${owner.slotKey}`);
        const side = ephyra.sideRooms[owner.slotKey];
        if (side === undefined) failCommand(command, `missing side-room ${owner.slotKey}`);
        state = Object.freeze({
          ...occurrence.state,
          sideRooms: Object.freeze({
            ...ephyra.sideRooms,
            [owner.slotKey]: Object.freeze({ ...side, reward: replace(side.reward) }),
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
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, { ...occurrence, state }),
  );
}
