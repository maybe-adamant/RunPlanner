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
  if (owner.kind === 'shopOffer' && state.kind === 'shop')
    return state.shop?.offers[owner.offerKey]?.reward;
  if (owner.kind === 'rewardWheelOffer' && state.kind === 'shipCombat')
    return state.wheels[owner.wheelKey]?.offers[owner.offerKey];
  if (owner.kind === 'localReward' && state.kind === 'fieldsCombat')
    return state.cages[owner.slotKey];
  if (owner.kind === 'localReward' && state.kind === 'ephyraCombat') {
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
    return ephyraState.sideRooms[owner.slotKey]?.reward;
  }
  if ('reward' in state) return state.reward;
  return undefined;
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
  if (owner.kind === 'shopOffer' && state.kind === 'shop' && state.shop !== undefined) {
    const entry = state.shop.offers[owner.offerKey];
    if (entry === undefined) return state;
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
  if (owner.kind === 'rewardWheelOffer' && state.kind === 'shipCombat') {
    const wheel = state.wheels[owner.wheelKey];
    const reward = wheel?.offers[owner.offerKey];
    if (wheel === undefined || reward === undefined) return state;
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
  if (owner.kind === 'localReward' && state.kind === 'fieldsCombat') {
    const reward = state.cages[owner.slotKey];
    if (reward === undefined) return state;
    return Object.freeze({
      ...state,
      cages: Object.freeze({
        ...state.cages,
        [owner.slotKey]: updateReward(reward, command.trait.acquisitionRole, value),
      }),
    });
  }
  if (owner.kind === 'localReward' && state.kind === 'ephyraCombat') {
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
    if (sideRoom === undefined) return state;
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
  if ('reward' in state)
    return Object.freeze({
      ...state,
      reward: updateReward(state.reward, command.trait.acquisitionRole, value),
    });
  return state;
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
