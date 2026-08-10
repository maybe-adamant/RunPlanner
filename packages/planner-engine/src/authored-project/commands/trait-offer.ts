import type { Catalog } from '../../catalog-schema';
import {
  traitGiverForAcquisitionRole,
  traitGiverUsesOfferContext,
  type AuthoredTraitOffer,
} from '../traits';
import type { ProjectDocument, RoomOccurrence, AuthoredRewardState } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { requireEphyraSideGroup } from './occurrence-ephyra';
import { sameOccurrenceValue } from './occurrence-leaf-value';
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
      !trait.rarityDomain.equippedRarities.includes(option.rarity)
    ) {
      failCommand(command, `unsupported authored rarity for ${option.traitKey}`);
    }
    if (giver.rarityPolicy.kind === 'fixed' && option.rarity !== giver.rarityPolicy.rarity) {
      failCommand(command, `${option.traitKey} must use fixed rarity ${giver.rarityPolicy.rarity}`);
    }
    if (option.targetTraitKey !== undefined) {
      if (trait.targetedAcquisition === undefined)
        failCommand(command, `${option.traitKey} does not target another trait on acquisition`);
      if (catalog.traits.byKey[option.targetTraitKey] === undefined)
        failCommand(command, `unknown target trait ${option.targetTraitKey}`);
    }
  }
  const conditionApplicable = traitGiverUsesOfferContext(
    catalog,
    value.giverKey,
    'deathDefianceConditionMet',
  );
  if (conditionApplicable && typeof value.deathDefianceConditionMet !== 'boolean')
    failCommand(command, 'Death Defiance condition is required for this trait giver');
  if (!conditionApplicable && value.deathDefianceConditionMet !== undefined)
    failCommand(command, 'Death Defiance condition is not supported by this trait giver');
  return Object.freeze({
    giverKey: value.giverKey,
    options: Object.freeze(
      value.options.map((option) => Object.freeze({ ...option })),
    ) as AuthoredTraitOffer['options'],
    selectedOptionKey: value.selectedOptionKey,
    ...(conditionApplicable ? { deathDefianceConditionMet: value.deathDefianceConditionMet } : {}),
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
    case 'encounterPhase':
      return failCommand(command, 'encounter trait offers are updated by the encounter owner path');
  }
  return failCommand(command, `unsupported trait offer owner ${owner.kind}`);
}

export function applyTraitOfferCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: TraitOfferCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const owner = command.trait.owner;
  const occurrenceId =
    owner.kind === 'encounterPhase' ? owner.owner.occurrenceId : owner.occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  if (owner.routeKey !== command.trait.routeKey || owner.biomeKey !== command.trait.biomeKey)
    failCommand(command, 'trait owner is outside its addressed biome');
  if (owner.kind === 'encounterPhase') {
    const encounterOwner = owner.owner;
    let currentEncounters = occurrence.encounters;
    let localSide:
      | Extract<RoomOccurrence['state'], { readonly kind: 'ephyraCombat' }>['sideRooms'][string]
      | undefined;
    if (encounterOwner.kind === 'localChild') {
      if (occurrence.state.kind !== 'ephyraCombat')
        failCommand(command, `${occurrence.gameName} has no parent-local encounter children`);
      const parent = catalog.rooms.byKey[occurrence.gameName];
      const group = parent?.localChildren.find((child) => child.key === encounterOwner.groupKey);
      if (group?.kind !== 'fixedRoomSlots')
        failCommand(command, `unknown side-room group ${encounterOwner.groupKey}`);
      localSide = occurrence.state.sideRooms[encounterOwner.slotKey];
      if (localSide === undefined)
        failCommand(command, `missing side-room ${encounterOwner.slotKey}`);
      currentEncounters = localSide.encounters;
    }
    const phaseOffersValue = currentEncounters.traitOffersByPhase?.[owner.phaseKey];
    if (phaseOffersValue === undefined)
      failCommand(command, `no trait offer at phase ${owner.phaseKey}`);
    const phaseOffers = phaseOffersValue;
    const encounterKeyValue = currentEncounters.encounterKeyByPhase[owner.phaseKey];
    if (encounterKeyValue === undefined)
      failCommand(command, `no selected encounter at phase ${owner.phaseKey}`);
    const encounterKey = encounterKeyValue;
    const existing = phaseOffers[encounterKey];
    if (existing === undefined) failCommand(command, `no trait offer at phase ${owner.phaseKey}`);
    const expectedProducer = catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer;
    if (expectedProducer === undefined)
      failCommand(command, `encounter ${encounterKey} has no trait offer producer`);
    if (existing.giverKey !== expectedProducer.giverKey)
      failCommand(command, `trait offer giver must be ${expectedProducer.giverKey}`);
    if (owner.phaseKey.trim().length === 0 || command.trait.acquisitionRole !== 'selection')
      failCommand(command, 'encounter trait offers use selection acquisition role');
    if (
      command.kind === 'ReplaceTraitSelection' &&
      !['option1', 'option2', 'option3'].includes(command.selectedOptionKey)
    ) {
      failCommand(command, 'selected option must be option1, option2, or option3');
    }
    const value =
      command.kind === 'ReplaceTraitSelection'
        ? Object.freeze({ ...existing, selectedOptionKey: command.selectedOptionKey })
        : validateOffer(catalog, command.value, command);
    if (value.giverKey !== expectedProducer.giverKey)
      failCommand(command, `trait offer giver must be ${expectedProducer.giverKey}`);
    if (sameOccurrenceValue(value, existing)) return document;
    const nextPhaseOffers = Object.freeze({ ...phaseOffers, [encounterKey]: value });
    const nextEncounters = Object.freeze({
      ...currentEncounters,
      traitOffersByPhase: Object.freeze({
        ...(currentEncounters.traitOffersByPhase ?? {}),
        [owner.phaseKey]: nextPhaseOffers,
      }),
    });
    if (encounterOwner.kind === 'occurrence') {
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(topology, Object.freeze({ ...occurrence, encounters: nextEncounters })),
      );
    }
    if (encounterOwner.kind !== 'localChild' || localSide === undefined)
      failCommand(command, 'encounter owner must be a local child');
    if (occurrence.state.kind !== 'ephyraCombat')
      failCommand(command, `${occurrence.gameName} has no parent-local encounter children`);
    const ephyraState = occurrence.state;
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        topology,
        Object.freeze({
          ...occurrence,
          state: Object.freeze({
            ...occurrence.state,
            sideRooms: Object.freeze({
              ...ephyraState.sideRooms,
              [encounterOwner.slotKey]: Object.freeze({ ...localSide, encounters: nextEncounters }),
            }),
          }),
        }),
      ),
    );
  }
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
  if (
    command.kind === 'ReplaceTraitSelection' &&
    !['option1', 'option2', 'option3'].includes(command.selectedOptionKey)
  ) {
    failCommand(command, 'selected option must be option1, option2, or option3');
  }
  const value =
    command.kind === 'ReplaceTraitSelection'
      ? Object.freeze({ ...existing, selectedOptionKey: command.selectedOptionKey })
      : validateOffer(catalog, command.value, command);
  if (value.giverKey !== expectedGiver) {
    failCommand(command, `trait offer giver must be ${expectedGiver}`);
  }
  if (sameOccurrenceValue(value, existing)) return document;
  const state = updateState(catalog, located, occurrence, occurrence.state, command, value);
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, Object.freeze({ ...occurrence, state })),
  );
}
