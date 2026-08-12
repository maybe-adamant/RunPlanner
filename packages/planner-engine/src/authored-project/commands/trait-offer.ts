import type { Catalog } from '../../catalog-schema';
import {
  traitGiverForAcquisitionRole,
  traitGiverUsesOfferContext,
  createDefaultSelectedPickupEntries,
  selectedPickupProducer,
  type AuthoredTraitOffer,
} from '../traits';
import type { ProjectDocument, RoomOccurrence, AuthoredRewardState } from '../model';
import type { AuthoredLevelResolution } from '../traits';
import { selectedEncounterDefinitionKey } from '../room-state/encounters';
import { requireShipCombatWheels } from '../room-state/declaration';
import { incomingLevelEffectSource } from '../room-state/level-effects';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { requireEphyraSideGroup } from './occurrence-ephyra';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { TraitOfferCommand } from './types';
import type { LevelResolutionEffectSource } from '../../reward-kernel/level-effects';

function reconcileSelectedPickupEntries(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
): RoomOccurrence {
  const producer = selectedPickupProducer(catalog, occurrence.encounters);
  const defaults: Readonly<Record<string, AuthoredRewardState>> =
    producer === undefined
      ? Object.freeze({})
      : createDefaultSelectedPickupEntries(catalog, producer.traitKey, loadout);
  const current = occurrence.acquisitionSites?.roomExit;
  const existing = current?.pickupEntries ?? {};
  const pickupEntries = Object.freeze(
    Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => {
        const retained = existing[key];
        return [
          key,
          retained?.offer.rewardType === fallback.offer.rewardType ? retained : fallback,
        ];
      }),
    ),
  );
  if (Object.keys(pickupEntries).length === 0) {
    if (current?.pickupEntries === undefined) return occurrence;
    const { roomExit, ...otherSites } = occurrence.acquisitionSites ?? {};
    const nextSites =
      roomExit === undefined
        ? otherSites
        : roomExit.order.length === 0
          ? otherSites
          : { ...otherSites, roomExit: Object.freeze({ order: roomExit.order }) };
    const without = { ...occurrence };
    delete without.acquisitionSites;
    return Object.freeze({
      ...without,
      ...(Object.keys(nextSites).length === 0
        ? {}
        : { acquisitionSites: Object.freeze(nextSites) }),
    });
  }
  const order = Object.freeze(
    (current?.order ?? []).filter((key) => pickupEntries[key] !== undefined),
  );
  return Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      roomExit: Object.freeze({ order, pickupEntries }),
    }),
  });
}

export interface LocatedTraitReward {
  readonly reward: AuthoredRewardState;
  readonly levelEffectSource: LevelResolutionEffectSource;
}

function pickupEntrySource(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  entryKey: string,
  command: TraitOfferCommand,
): LocatedTraitReward {
  const entry = occurrence.acquisitionSites?.roomExit?.pickupEntries?.[entryKey];
  if (entry === undefined) failCommand(command, `missing pickup entry ${entryKey}`);
  const producer = selectedPickupProducer(catalog, occurrence.encounters);
  if (producer === undefined) failCommand(command, 'pickup entry has no unique selected producer');
  return Object.freeze({
    reward: entry,
    levelEffectSource: {
      kind: 'producerLifecycle' as const,
      key: producer.disposition.producerLifecycleKey,
    },
  });
}

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

export function updateLevelResolutionReward(
  reward: AuthoredRewardState,
  role: string,
  value: AuthoredLevelResolution,
): AuthoredRewardState {
  return Object.freeze({
    ...reward,
    levelResolutionsByAcquisitionRole: Object.freeze({
      ...(reward.levelResolutionsByAcquisitionRole ?? {}),
      [role]: value,
    }),
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

export function locateTraitReward(
  catalog: Catalog,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  command: TraitOfferCommand,
): LocatedTraitReward | undefined {
  const owner = command.trait.owner;
  switch (owner.kind) {
    case 'acquisitionEntry':
      return pickupEntrySource(catalog, occurrence, owner.entryKey, command);
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'ephyraCombat': {
          const room = catalog.rooms.byKey[occurrence.gameName];
          const binding = room?.incomingReward;
          if (binding === undefined || binding.kind === 'none')
            failCommand(command, `${occurrence.gameName} has no incoming reward binding`);
          return Object.freeze({
            reward: state.reward,
            levelEffectSource: {
              kind: 'producerLifecycle',
              key: binding.producerLifecycleKey,
            } as const,
          });
        }
        case 'anomaly':
        case 'freeReward': {
          const levelEffectSource = incomingLevelEffectSource(catalog, occurrence);
          if (levelEffectSource === undefined)
            failCommand(command, `${occurrence.gameName} has no declared incoming reward binding`);
          return Object.freeze({ reward: state.reward, levelEffectSource });
        }
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
          reward,
          levelEffectSource: {
            kind: 'producerLifecycle',
            key: group.reward.producerLifecycleKey,
          } as const,
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
        const slot = group.slots.find((candidate) => candidate.slotKey === owner.slotKey);
        const sideDeclaration =
          slot === undefined ? undefined : catalog.rooms.byKey[slot.roomGameName];
        const binding = sideDeclaration?.incomingReward;
        if (binding === undefined || binding.kind === 'none')
          failCommand(command, `side room has no incoming reward binding`);
        return Object.freeze({
          reward: sideRoom.reward,
          levelEffectSource: {
            kind: 'producerLifecycle',
            key: binding.producerLifecycleKey,
          } as const,
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
        const room = catalog.rooms.byKey[occurrence.gameName];
        if (room === undefined) failCommand(command, `unknown room ${occurrence.gameName}`);
        const descriptor = requireShipCombatWheels(catalog, room, occurrence.gameName).find(
          (candidate) => candidate.key === owner.wheelKey,
        );
        if (descriptor === undefined)
          failCommand(command, `unknown reward wheel ${owner.wheelKey}`);
        return Object.freeze({
          reward,
          levelEffectSource: {
            kind: 'producerLifecycle',
            key: descriptor.reward.producerLifecycleKey,
          } as const,
        });
      }
    case 'shopOffer':
      if (state.kind !== 'shop' || state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      }
      {
        const reward = state.shop.offers[owner.offerKey]?.reward;
        if (reward === undefined) failCommand(command, `missing Shop offer ${owner.offerKey}`);
        return Object.freeze({
          reward,
          levelEffectSource: { kind: 'shopProfile', key: state.shop.profileKey } as const,
        });
      }
  }
}

export function updateTraitRewardState(
  catalog: Catalog,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  command: TraitOfferCommand,
  value: AuthoredTraitOffer,
  update: (
    reward: AuthoredRewardState,
    role: string,
    value: AuthoredTraitOffer,
  ) => AuthoredRewardState = updateReward,
): RoomOccurrence['state'] {
  const owner = command.trait.owner;
  switch (owner.kind) {
    case 'acquisitionEntry':
      return failCommand(command, 'site pickup entries are updated on their occurrence overlay');
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'anomaly':
        case 'ephyraCombat':
        case 'freeReward':
          return Object.freeze({
            ...state,
            reward: update(state.reward, command.trait.acquisitionRole, value),
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
            [owner.slotKey]: update(reward, command.trait.acquisitionRole, value),
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
              reward: update(sideRoom.reward, command.trait.acquisitionRole, value),
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
                [owner.offerKey]: update(reward, command.trait.acquisitionRole, value),
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
                reward: update(entry.reward, command.trait.acquisitionRole, value),
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
    owner.kind === 'encounterPhase'
      ? owner.owner.occurrenceId
      : owner.kind === 'acquisitionEntry'
        ? owner.site.owner.kind === 'occurrence'
          ? owner.site.owner.occurrenceId
          : failCommand(command, 'acquisition entry is not occurrence-owned')
        : owner.occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  if (owner.routeKey !== command.trait.routeKey || owner.biomeKey !== command.trait.biomeKey)
    failCommand(command, 'trait owner is outside its addressed biome');
  if (owner.kind === 'encounterPhase') {
    const encounterOwner = owner.owner;
    let currentEncounters = occurrence.encounters;
    let encounterRoom = catalog.rooms.byKey[occurrence.gameName];
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
      const sideRoom = group.slots.find((slot) => slot.slotKey === encounterOwner.slotKey);
      encounterRoom =
        sideRoom === undefined ? undefined : catalog.rooms.byKey[sideRoom.roomGameName];
    }
    if (encounterRoom === undefined)
      failCommand(command, `unknown encounter room for ${owner.phaseKey}`);
    const phaseOffersValue = currentEncounters.traitOffersByPhase?.[owner.phaseKey];
    if (phaseOffersValue === undefined)
      failCommand(command, `no trait offer at phase ${owner.phaseKey}`);
    const phaseOffers = phaseOffersValue;
    const encounterKey = selectedEncounterDefinitionKey(
      catalog,
      encounterRoom,
      currentEncounters,
      owner.phaseKey,
      occurrence.gameName,
    );
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
      const reconciled = reconcileSelectedPickupEntries(
        catalog,
        Object.freeze({ ...occurrence, encounters: nextEncounters }),
        located.loadout,
      );
      return updateOccurrenceTopology(document, located, replaceOccurrence(topology, reconciled));
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
  const reward = locateTraitReward(catalog, located, occurrence, occurrence.state, command);
  if (reward === undefined)
    failCommand(command, `no trait offer at role ${command.trait.acquisitionRole}`);
  const existing = reward.reward.traitOffersByAcquisitionRole[command.trait.acquisitionRole];
  if (existing === undefined)
    failCommand(command, `no trait offer at role ${command.trait.acquisitionRole}`);
  const expectedGiver = traitGiverForAcquisitionRole(
    catalog,
    reward.reward.offer,
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
  if (owner.kind === 'acquisitionEntry') {
    const site = occurrence.acquisitionSites?.roomExit;
    const pickup = site?.pickupEntries?.[owner.entryKey];
    if (site === undefined || pickup === undefined)
      failCommand(command, `missing pickup entry ${owner.entryKey}`);
    const nextPickup = updateReward(pickup, command.trait.acquisitionRole, value);
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
              ...site,
              pickupEntries: Object.freeze({ ...site.pickupEntries, [owner.entryKey]: nextPickup }),
            }),
          }),
        }),
      ),
    );
  }
  const state = updateTraitRewardState(
    catalog,
    located,
    occurrence,
    occurrence.state,
    command,
    value,
  );
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, Object.freeze({ ...occurrence, state })),
  );
}
