import type { Catalog } from '../../catalog-schema';
import { traitGiverForAcquisitionRole, type AuthoredTraitOffer } from '../traits';
import type { ProjectDocument, RoomOccurrence, AuthoredRewardState } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { requireEphyraSideGroup } from './occurrence-ephyra';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { TraitOfferCommand } from './types';

function validateOffer(
  catalog: Catalog,
  value: AuthoredTraitOffer,
  command: TraitOfferCommand,
): AuthoredTraitOffer {
  const giver = catalog.traitGivers.byKey[value.giverKey];
  if (giver === undefined) failCommand(command, `unknown trait giver ${value.giverKey}`);
  if (value.options.length !== 3)
    failCommand(command, 'trait offers require exactly three options');
  if (new Set(value.options.map((option) => option.traitKey)).size !== 3)
    failCommand(command, 'trait option keys must be distinct');
  if (!['option1', 'option2', 'option3'].includes(value.selectedOptionKey))
    failCommand(command, 'selected option must be option1, option2, or option3');
  for (const [index, option] of value.options.entries()) {
    const trait = catalog.traits.byKey[option.traitKey];
    if (trait === undefined || !giver.traitKeys.includes(option.traitKey))
      failCommand(
        command,
        `option${index + 1} ${option.traitKey} is not in giver ${value.giverKey}`,
      );
    if (trait.rarityDomain.kind === 'none') {
      if (option.rarity !== undefined)
        failCommand(command, `Hammer option ${option.traitKey} has no rarity`);
    } else if (
      option.rarity === undefined ||
      !trait.rarityDomain.freshOfferRarities.includes(option.rarity)
    ) {
      failCommand(command, `unsupported fresh rarity for ${option.traitKey}`);
    }
  }
  return Object.freeze({
    giverKey: value.giverKey,
    options: Object.freeze(
      value.options.map((option) => Object.freeze({ ...option })),
    ) as AuthoredTraitOffer['options'],
    selectedOptionKey: value.selectedOptionKey,
  });
}

function updateReward(
  reward: AuthoredRewardState,
  role: string,
  value: AuthoredTraitOffer,
): AuthoredRewardState {
  return Object.freeze({
    ...reward,
    traitOffersByAcquisitionRole: Object.freeze({
      ...reward.traitOffersByAcquisitionRole,
      [role]: value,
    }),
  });
}

function locateReward(
  catalog: Catalog,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  command: TraitOfferCommand,
): AuthoredRewardState | undefined {
  const owner = command.trait.owner;
  switch (owner.kind) {
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'anomaly':
        case 'ephyraCombat':
        case 'freeReward':
          return state.reward;
        case 'none':
        case 'fieldsCombat':
        case 'shipCombat':
        case 'shop':
          failCommand(command, `incoming reward is not owned by ${occurrence.gameName}`);
      }
      break;
    case 'localReward':
      if (state.kind === 'fieldsCombat') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        const group = room?.localChildren.find((child) => child.key === owner.groupKey);
        if (group?.kind !== 'boundedRewardSlots') {
          failCommand(
            command,
            `${occurrence.gameName} has no Fields reward group ${owner.groupKey}`,
          );
        }
        if (!group.slotKeys.includes(owner.slotKey)) {
          failCommand(command, `${occurrence.gameName} has no Fields reward slot ${owner.slotKey}`);
        }
        const reward = state.cages[owner.slotKey];
        if (reward === undefined) failCommand(command, `missing Fields reward ${owner.slotKey}`);
        return reward;
      }
      if (state.kind === 'ephyraCombat') {
        const { state: ephyraState, group } = requireEphyraSideGroup(
          occurrence,
          catalog,
          located,
          owner.groupKey,
          command,
        );
        if (!group.slots.some((slot) => slot.slotKey === owner.slotKey)) {
          failCommand(command, `unknown side-room slot ${owner.slotKey}`);
        }
        const sideRoom = ephyraState.sideRooms[owner.slotKey];
        if (sideRoom === undefined) failCommand(command, `missing side-room ${owner.slotKey}`);
        return sideRoom.reward;
      }
      return failCommand(
        command,
        `${occurrence.gameName} has no local reward ${owner.groupKey}/${owner.slotKey}`,
      );
    case 'rewardWheelOffer':
      if (state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no reward wheel ${owner.wheelKey}`);
      }
      {
        const wheel = state.wheels[owner.wheelKey];
        const reward = wheel?.offers[owner.offerKey];
        if (wheel === undefined || reward === undefined) {
          failCommand(command, `missing reward wheel offer ${owner.wheelKey}/${owner.offerKey}`);
        }
        return reward;
      }
    case 'shopOffer':
      if (state.kind !== 'shop' || state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      }
      {
        const reward = state.shop.offers[owner.offerKey]?.reward;
        if (reward === undefined) failCommand(command, `missing Shop offer ${owner.offerKey}`);
        return reward;
      }
  }
}

function updateState(
  catalog: Catalog,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  command: TraitOfferCommand,
  value: AuthoredTraitOffer,
): RoomOccurrence['state'] {
  const owner = command.trait.owner;
  switch (owner.kind) {
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'anomaly':
        case 'ephyraCombat':
        case 'freeReward':
          return Object.freeze({
            ...state,
            reward: updateReward(state.reward, command.trait.acquisitionRole, value),
          });
        case 'none':
        case 'fieldsCombat':
        case 'shipCombat':
        case 'shop':
          failCommand(command, `incoming reward is not owned by ${occurrence.gameName}`);
      }
      break;
    case 'localReward':
      if (state.kind === 'fieldsCombat') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        const group = room?.localChildren.find((child) => child.key === owner.groupKey);
        if (group?.kind !== 'boundedRewardSlots') {
          failCommand(
            command,
            `${occurrence.gameName} has no Fields reward group ${owner.groupKey}`,
          );
        }
        if (!group.slotKeys.includes(owner.slotKey)) {
          failCommand(command, `${occurrence.gameName} has no Fields reward slot ${owner.slotKey}`);
        }
        const reward = state.cages[owner.slotKey];
        if (reward === undefined) failCommand(command, `missing Fields reward ${owner.slotKey}`);
        return Object.freeze({
          ...state,
          cages: Object.freeze({
            ...state.cages,
            [owner.slotKey]: updateReward(reward, command.trait.acquisitionRole, value),
          }),
        });
      }
      if (state.kind === 'ephyraCombat') {
        const { state: ephyraState, group } = requireEphyraSideGroup(
          occurrence,
          catalog,
          located,
          owner.groupKey,
          command,
        );
        if (!group.slots.some((slot) => slot.slotKey === owner.slotKey)) {
          failCommand(command, `unknown side-room slot ${owner.slotKey}`);
        }
        const sideRoom = ephyraState.sideRooms[owner.slotKey];
        if (sideRoom === undefined) failCommand(command, `missing side-room ${owner.slotKey}`);
        return Object.freeze({
          ...state,
          sideRooms: Object.freeze({
            ...state.sideRooms,
            [owner.slotKey]: Object.freeze({
              ...sideRoom,
              reward: updateReward(sideRoom.reward, command.trait.acquisitionRole, value),
            }),
          }),
        });
      }
      return failCommand(
        command,
        `${occurrence.gameName} has no local reward ${owner.groupKey}/${owner.slotKey}`,
      );
    case 'rewardWheelOffer':
      if (state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no reward wheel ${owner.wheelKey}`);
      }
      {
        const wheel = state.wheels[owner.wheelKey];
        const reward = wheel?.offers[owner.offerKey];
        if (wheel === undefined || reward === undefined) {
          failCommand(command, `missing reward wheel offer ${owner.wheelKey}/${owner.offerKey}`);
        }
        return Object.freeze({
          ...state,
          wheels: Object.freeze({
            ...state.wheels,
            [owner.wheelKey]: Object.freeze({
              ...wheel,
              offers: Object.freeze({
                ...wheel.offers,
                [owner.offerKey]: updateReward(reward, command.trait.acquisitionRole, value),
              }),
            }),
          }),
        });
      }
    case 'shopOffer':
      if (state.kind !== 'shop' || state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      }
      {
        const entry = state.shop.offers[owner.offerKey];
        if (entry === undefined) failCommand(command, `missing Shop offer ${owner.offerKey}`);
        return Object.freeze({
          ...state,
          shop: Object.freeze({
            ...state.shop,
            offers: Object.freeze({
              ...state.shop.offers,
              [owner.offerKey]: Object.freeze({
                ...entry,
                reward: updateReward(entry.reward, command.trait.acquisitionRole, value),
              }),
            }),
          }),
        });
      }
  }
}

export function applyTraitOfferCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: TraitOfferCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const owner = command.trait.owner;
  const occurrence = requireOccurrence(located.plan, owner.occurrenceId, command);
  if (owner.routeKey !== command.trait.routeKey || owner.biomeKey !== command.trait.biomeKey)
    failCommand(command, 'trait owner is outside its addressed biome');
  const reward = locateReward(catalog, located, occurrence, occurrence.state, command);
  if (reward === undefined)
    failCommand(command, `no trait offer at role ${command.trait.acquisitionRole}`);
  const existing = reward.traitOffersByAcquisitionRole[command.trait.acquisitionRole];
  if (existing === undefined)
    failCommand(command, `no trait offer at role ${command.trait.acquisitionRole}`);
  const expectedGiver = traitGiverForAcquisitionRole(
    catalog,
    reward.offer,
    command.trait.acquisitionRole,
  );
  if (expectedGiver === undefined) {
    failCommand(command, `no catalog trait provider at role ${command.trait.acquisitionRole}`);
  }
  if (existing.giverKey !== expectedGiver) {
    failCommand(command, `trait offer giver must be ${expectedGiver}`);
  }
  const value =
    command.kind === 'ReplaceTraitSelection'
      ? Object.freeze({ ...existing, selectedOptionKey: command.selectedOptionKey })
      : validateOffer(catalog, command.value, command);
  if (value.giverKey !== expectedGiver) {
    failCommand(command, `trait offer giver must be ${expectedGiver}`);
  }
  const state = updateState(catalog, located, occurrence, occurrence.state, command, value);
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, Object.freeze({ ...occurrence, state })),
  );
}
