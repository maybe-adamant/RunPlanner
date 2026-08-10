import {
  createAdditionalExitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type EncounterPhaseAddress,
  type LocalChildAddress,
  type RoomOccurrence,
  type SemanticAddress,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import { traitGiverForAcquisitionRole } from '@run-planner/engine/authored-project';
import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  CanonicalAuthoredRoom,
  EncounterPhaseSequenceStatus,
  FieldsBatchFacts,
} from '@run-planner/engine/simulation';
import {
  encounterPhaseAuthoringDomainForRoom,
  type EncounterPhaseAuthoringRoomOptions,
} from '@run-planner/engine/simulation';

import type {
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '@planner/projections/candidateProjection';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';

import {
  requireWorkspaceRoom as requireRoom,
  resolveWorkspaceFixedRewardOffer,
} from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  workspaceSideRoomEntryOrderKey,
  type WorkspaceEphyraSideRoomEntryOption,
  type WorkspaceEphyraSideRoomEntryOrderControl,
  type WorkspaceEncounterPhase,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceRewardControl,
  type WorkspaceTraitOfferControl,
  type WorkspaceRoomLocal,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
} from '../contract';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';
import {
  workspaceCustomizationMarkers,
  workspaceLocalDetailMarkers,
  workspaceOccurrenceOwnedMarkers,
} from '../navigation/marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { workspaceRewardStoreLabel } from './reward-labels';

/**
 * The occurrence assembler consumes only the lifecycle facts needed to project
 * this occurrence. Expected-owner enumeration remains intentionally elsewhere.
 */
export interface WorkspaceOccurrenceProjectionFacts {
  readonly authoredAdditionalExitKeys: readonly string[];
  readonly detailsActive: boolean;
}

/** Exact authored/evaluated inputs for one room-local workspace product. */
export interface WorkspaceOccurrenceAssemblyInput {
  /** Closed declaration-owned map domain for an Anomaly replacement in this biome. */
  readonly anomalyReplacementRoomGameNames?: readonly string[];
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly encounterPhaseStatus: (
    phase: EncounterPhaseAddress,
  ) => EncounterPhaseSequenceStatus | undefined;
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
  /** Shared decision-owned Fields derivation for this target occurrence. */
  readonly fieldsBatchFacts?: FieldsBatchFacts;
  readonly facts: WorkspaceOccurrenceProjectionFacts;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

/** Immutable occurrence-owned workspace products consumed by decision and Hub assembly. */
export interface WorkspaceOccurrenceAssembly {
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  readonly occurrenceInteractionRequirements: readonly WorkspaceOccurrenceInteractionRequirement[];
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
}

/**
 * A family can request one authored occurrence product without gaining access
 * to the biome-local lifecycle facts or marker registration builder.
 */
export interface WorkspaceOccurrenceAssemblyRequest {
  readonly anomalyReplacementRoomGameNames?: readonly string[];
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
  /** Present only when this occurrence belongs to a configured Fields batch. */
  readonly fieldsBatchFacts?: FieldsBatchFacts;
  readonly occurrence: RoomOccurrence;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

export type WorkspaceOccurrenceAssembler = (
  input: WorkspaceOccurrenceAssemblyRequest,
) => WorkspaceOccurrenceAssembly;

function traitOfferControls(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RewardCandidateOwner,
  reward: AuthoredRewardState,
): readonly WorkspaceTraitOfferControl[] {
  if (!input.facts.detailsActive) return Object.freeze([]);
  const controls: WorkspaceTraitOfferControl[] = [];
  for (const [acquisitionRole, offer] of Object.entries(reward.traitOffersByAcquisitionRole)) {
    const giverKey = traitGiverForAcquisitionRole(input.catalog, reward.offer, acquisitionRole);
    if (giverKey === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner.address)} has trait role ${acquisitionRole} without an in-scope giver`,
      );
    }
    if (giverKey !== offer.giverKey) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner.address)} trait role ${acquisitionRole} has giver ${offer.giverKey}, expected ${giverKey}`,
      );
    }
    const giver = input.catalog.traitGivers.byKey[giverKey];
    if (giver === undefined) continue;
    const address = createTraitOfferAddress(owner.address, acquisitionRole);
    const acquisitionRoleLabel =
      acquisitionRole === 'chosenSource'
        ? 'Chosen God'
        : acquisitionRole === 'spurnedSource'
          ? 'Spurned God'
          : acquisitionRole
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .replace(/^./, (character) => character.toUpperCase());
    controls.push(
      Object.freeze({
        acquisitionRoleLabel,
        address,
        giver,
        marker: input.markerDestinations.marker(address),
        offer,
        rewardOwner: owner.address,
      }),
    );
  }
  return Object.freeze(controls);
}

function rewardControl(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RewardCandidateOwner,
  binding: CountedRewardBinding | undefined,
  offer: ResolvedRewardOffer,
  authoredReward: AuthoredRewardState,
  explicitRewardTypes: readonly string[] = Object.freeze([offer.rewardType]),
): WorkspaceRewardControl {
  return binding === undefined
    ? Object.freeze({
        kind: 'explicitReward' as const,
        marker: input.markerDestinations.marker(owner.address),
        offer,
        owner,
        traitOffers: traitOfferControls(input, owner, authoredReward),
        rewardTypes: Object.freeze([...explicitRewardTypes]),
      })
    : Object.freeze({
        kind: 'countedReward' as const,
        binding,
        marker: input.markerDestinations.marker(owner.address),
        offer,
        owner: owner as CountedRewardCandidateOwner,
        traitOffers: traitOfferControls(input, owner, authoredReward),
      });
}

function incomingRewardBinding(
  room: RoomDeclaration,
  state: Extract<
    RoomOccurrence['state'],
    { readonly kind: 'anomaly' | 'counted' | 'ephyraCombat' | 'freeReward' }
  >,
): CountedRewardBinding {
  if (state.kind === 'freeReward') {
    const policy = room.prebossBatchPolicy;
    if (policy?.kind !== 'takeOverNormalDoors' || policy.remainingOffers.kind !== 'counted') {
      throw new StructuredWorkspaceProjectionContractError(
        `${room.gameName} free Preboss reward has no declared counted binding`,
      );
    }
    return policy.remainingOffers.reward;
  }
  if (room.incomingReward.kind !== 'countedChoice') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} counted incoming reward has no declared binding`,
    );
  }
  return room.incomingReward;
}

function controlsForOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
): readonly WorkspaceRewardControl[] {
  const { occurrence } = input;
  const controls: WorkspaceRewardControl[] = [];
  const incoming = createIncomingRewardAddress(input.biome, occurrence.occurrenceId);
  const addIncoming = (
    state: Extract<
      RoomOccurrence['state'],
      { readonly kind: 'anomaly' | 'counted' | 'ephyraCombat' | 'freeReward' }
    >,
  ) => {
    controls.push(
      rewardControl(
        input,
        { kind: 'incomingReward', address: incoming },
        incomingRewardBinding(room, state),
        state.reward.offer,
        state.reward,
      ),
    );
  };
  switch (occurrence.state.kind) {
    case 'anomaly':
    case 'counted':
    case 'freeReward':
      addIncoming(occurrence.state);
      break;
    case 'ephyraCombat': {
      addIncoming(occurrence.state);
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) break;
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state has no fixed side-room declaration`,
        );
      }
      if (!input.facts.detailsActive) break;
      for (const [slotKey, side] of Object.entries(occurrence.state.sideRooms)) {
        const slot = group.slots.find((candidate) => candidate.slotKey === slotKey);
        if (slot === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} has no side-room slot ${slotKey}`,
          );
        }
        const sideRoom = requireRoom(input.catalog, slot.roomGameName);
        if (sideRoom.incomingReward.kind !== 'countedChoice') {
          throw new StructuredWorkspaceProjectionContractError(
            `${sideRoom.gameName} side room has no counted reward binding`,
          );
        }
        if (side.generation !== 'generated') continue;
        const address = createLocalRewardAddress(
          input.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        controls.push(
          rewardControl(
            input,
            { kind: 'localReward', address },
            sideRoom.incomingReward,
            side.reward.offer,
            side.reward,
          ),
        );
      }
      break;
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') break;
      for (const [slotKey, offer] of Object.entries(occurrence.state.cages)) {
        const address = createLocalRewardAddress(
          input.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        controls.push(
          rewardControl(input, { kind: 'localReward', address }, group.reward, offer.offer, offer),
        );
      }
      break;
    }
    case 'shipCombat': {
      const envelope = requireEncounterEnvelope(input.catalog, room);
      for (const slot of envelope.slots) {
        const declaration = slot.rewardAttachment;
        if (declaration?.kind !== 'rewardWheel') continue;
        const wheel = occurrence.state.wheels[declaration.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${declaration.key}`,
          );
        }
        for (const [offerKey, offer] of Object.entries(wheel.offers)) {
          const address = createRewardWheelOfferAddress(
            input.biome,
            occurrence.occurrenceId,
            declaration.key,
            offerKey,
          );
          controls.push(
            rewardControl(
              input,
              { kind: 'rewardWheelOffer', address },
              declaration.reward,
              offer.offer,
              offer,
            ),
          );
        }
      }
      break;
    }
    case 'shop': {
      // Selecting a Shop target creates its declaration-owned inventory. A
      // retained, selected Shop stays editable before evaluation reaches it;
      // an unpicked Shop remains a dormant structural leaf.
      if (!input.facts.detailsActive || occurrence.state.shop === undefined) break;
      const profile = input.catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${occurrence.state.shop.profileKey} is missing`,
        );
      }
      for (const [offerKey, shopOffer] of Object.entries(occurrence.state.shop.offers)) {
        const slot = profile.slots.byKey[offerKey];
        const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
        if (group === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop offer ${offerKey} has no declared reward domain`,
          );
        }
        const address = createShopOfferAddress(input.biome, occurrence.occurrenceId, offerKey);
        controls.push(
          rewardControl(
            input,
            { kind: 'shopOffer', address },
            undefined,
            shopOffer.reward.offer,
            shopOffer.reward,
            group.rewardTypes,
          ),
        );
      }
      break;
    }
    case 'fixed': {
      const offer = resolveWorkspaceFixedRewardOffer(room, occurrence.state);
      const rewardType = input.catalog.rewards.rewardTypes.byKey[offer.rewardType];
      if (rewardType?.payloadDomain !== undefined) {
        controls.push(
          rewardControl(
            input,
            { kind: 'incomingReward', address: incoming },
            undefined,
            offer,
            occurrence.state.reward,
            Object.freeze([offer.rewardType]),
          ),
        );
      }
      break;
    }
    case 'none':
      break;
  }
  return Object.freeze(controls);
}

function requireProjectedRewardControl<TKind extends WorkspaceRewardControl['kind']>(
  controls: readonly WorkspaceRewardControl[],
  address: SemanticAddress,
  kind: TKind,
): Extract<WorkspaceRewardControl, { readonly kind: TKind }> {
  const control = controls.find(
    (candidate) => semanticAddressKey(candidate.owner.address) === semanticAddressKey(address),
  );
  if (control?.kind !== kind) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(address)} has no ${kind} room-local control`,
    );
  }
  return control as Extract<WorkspaceRewardControl, { readonly kind: TKind }>;
}

function requireEncounterEnvelope(catalog: Catalog, room: RoomDeclaration) {
  const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  if (envelope === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} has no encounter envelope ${room.encounterEnvelopeKey}`,
    );
  }
  return envelope;
}

function requireRewardWheelAttachment(
  catalog: Catalog,
  room: RoomDeclaration,
  wheelKey: string,
): EncounterRewardWheelAttachment {
  const attachment = requireEncounterEnvelope(catalog, room).slots.find(
    (slot) =>
      slot.rewardAttachment?.kind === 'rewardWheel' && slot.rewardAttachment.key === wheelKey,
  )?.rewardAttachment;
  if (attachment?.kind !== 'rewardWheel') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} has no reward-wheel attachment ${wheelKey}`,
    );
  }
  return attachment;
}

/**
 * Maps a declaration-owned pool into one renderable phase from the authored
 * encounter domain. Candidate eligibility remains a lazy interaction product;
 * it never controls whether the authored phase exists in the workspace.
 */
function activeEncounterPhasesForOwner(
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
  owner: EncounterPhaseAddress['owner'],
  encounters: RoomOccurrence['encounters'],
  options: EncounterPhaseAuthoringRoomOptions = {},
): readonly WorkspaceEncounterPhase[] {
  const phases: WorkspaceEncounterPhase[] = [];
  for (const domain of encounterPhaseAuthoringDomainForRoom(
    input.catalog,
    input.biome,
    room,
    owner,
    encounters,
    options,
  )) {
    const address = domain.origin;
    if (input.encounterPhaseStatus(address)?.kind === 'dormantSuffix') continue;
    const candidateChoices = Object.freeze(
      domain.declaredEncounterKeys.map((encounterKey) => {
        const definition = input.catalog.encounterDefinitions.byKey[encounterKey];
        if (definition === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(address)} has no encounter definition ${encounterKey}`,
          );
        }
        return Object.freeze({ label: definition.label, value: definition.key });
      }),
    );
    const selectedDefinition =
      input.catalog.encounterDefinitions.byKey[domain.selectedEncounterKey];
    if (selectedDefinition === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} has no selected encounter definition ${domain.selectedEncounterKey}`,
      );
    }
    phases.push(
      Object.freeze({
        address,
        candidateChoices,
        customizable: domain.declaredEncounterKeys.length > 1,
        label: domain.slotKey,
        marker: input.markerDestinations.marker(address),
        resettable: domain.selectedEncounterKey !== domain.defaultEncounterKey,
        selectedEncounter: Object.freeze({
          key: selectedDefinition.key,
          label: selectedDefinition.label,
        }),
      }),
    );
  }
  return Object.freeze(phases);
}

function ordinalLabel(position: number): string {
  const remainder = position % 100;
  if (remainder >= 11 && remainder <= 13) return `${position}th`;
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

/**
 * Shop-specific complete-order proposals stay in the occurrence projection so
 * React only selects one already-authored transition. This is deliberately not
 * a generic ordering abstraction: Shop membership and order are one fact.
 */
function uniqueShopPurchaseOrders(
  orders: readonly (readonly string[])[],
): readonly (readonly string[])[] {
  const seen = new Set<string>();
  const unique: (readonly string[])[] = [];
  for (const order of orders) {
    const key = JSON.stringify(order);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(Object.freeze([...order]));
  }
  return Object.freeze(unique);
}

function ephyraSideRoomEntryOrderControl(
  address: LocalChildAddress,
  enteredSlotKeys: readonly string[],
  slotKey: string,
): WorkspaceEphyraSideRoomEntryOrderControl {
  const index = enteredSlotKeys.indexOf(slotKey);
  const withoutSlot = Object.freeze(enteredSlotKeys.filter((candidate) => candidate !== slotKey));
  const options: WorkspaceEphyraSideRoomEntryOption[] = [
    Object.freeze({
      key: 'notEntered',
      label: 'Not visited',
      position: null,
      proposedEnteredSlotKeys: withoutSlot,
    }),
  ];
  for (let insertionIndex = 0; insertionIndex <= withoutSlot.length; insertionIndex += 1) {
    const position = insertionIndex + 1;
    options.push(
      Object.freeze({
        key: `position:${position}`,
        label: ordinalLabel(position),
        position,
        proposedEnteredSlotKeys: Object.freeze([
          ...withoutSlot.slice(0, insertionIndex),
          slotKey,
          ...withoutSlot.slice(insertionIndex),
        ]),
      }),
    );
  }
  return Object.freeze({
    interactionKey: workspaceSideRoomEntryOrderKey(address),
    options: Object.freeze(options),
    selectedKey: index < 0 ? 'notEntered' : `position:${index + 1}`,
  });
}

function roomLocalForOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
  controls: readonly WorkspaceRewardControl[],
): WorkspaceRoomLocal {
  const { occurrence } = input;
  const incoming = createIncomingRewardAddress(input.biome, occurrence.occurrenceId);
  switch (occurrence.state.kind) {
    case 'none':
      return Object.freeze({ kind: 'none' as const });
    case 'fixed': {
      const offer = resolveWorkspaceFixedRewardOffer(room, occurrence.state);
      const rewardType = input.catalog.rewards.rewardTypes.byKey[offer.rewardType];
      const control =
        rewardType?.payloadDomain === undefined
          ? undefined
          : requireProjectedRewardControl(controls, incoming, 'explicitReward');
      return Object.freeze({
        kind: 'fixed' as const,
        marker: input.markerDestinations.marker(incoming),
        offer,
        summary: summarizeRewardOffer(input.catalog, offer),
        ...(control === undefined ? {} : { control }),
      });
    }
    case 'counted':
    case 'anomaly':
    case 'freeReward': {
      const control = requireProjectedRewardControl(controls, incoming, 'countedReward');
      return Object.freeze({
        kind: 'incomingReward' as const,
        control,
        ...(input.evaluatedRoom?.clockworkReward === undefined
          ? {}
          : { clockworkReward: input.evaluatedRoom.clockworkReward }),
      });
    }
    case 'ephyraCombat': {
      const state = occurrence.state;
      const incomingReward = requireProjectedRewardControl(controls, incoming, 'countedReward');
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      // Ephyra combat state owns the incoming Hub reward for every Hub room;
      // only declarations with fixed side-room slots expose the extra local lifecycle.
      if (group === undefined && Object.keys(state.sideRooms).length === 0) {
        return Object.freeze({ kind: 'incomingReward' as const, control: incomingReward });
      }
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state has no fixed side-room declaration`,
        );
      }
      if (!input.facts.detailsActive) {
        return Object.freeze({
          kind: 'ephyra' as const,
          incomingReward,
          sideRooms: Object.freeze({ kind: 'withheld' as const }),
        });
      }
      const groupAddress = createLocalChildGroupAddress(
        input.biome,
        occurrence.occurrenceId,
        group.key,
      );
      const enteredSlotKeys = Object.entries(state.sideRooms)
        .filter(([, side]) => side.enteredOrdinal !== null)
        .sort((left, right) => left[1].enteredOrdinal! - right[1].enteredOrdinal!)
        .map(([slotKey]) => slotKey);
      const slots = [...group.slots]
        .sort((left, right) => left.availabilityRank - right.availabilityRank)
        .map((slot) => {
          const side = state.sideRooms[slot.slotKey];
          if (side === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${room.gameName} Ephyra state is missing side room ${slot.slotKey}`,
            );
          }
          const sideRoom = requireRoom(input.catalog, slot.roomGameName);
          const address = createLocalChildAddress(
            input.biome,
            occurrence.occurrenceId,
            group.key,
            slot.slotKey,
          );
          const encounterPhases =
            side.generation === 'generated'
              ? activeEncounterPhasesForOwner(
                  input,
                  sideRoom,
                  {
                    kind: 'localChild',
                    occurrenceId: occurrence.occurrenceId,
                    groupKey: group.key,
                    slotKey: slot.slotKey,
                  },
                  side.encounters,
                )
              : Object.freeze([]);
          const descriptor = {
            address,
            availabilityRank: slot.availabilityRank,
            entered: side.enteredOrdinal !== null,
            enteredOrdinal: side.enteredOrdinal,
            encounterPhases,
            entryOrder: ephyraSideRoomEntryOrderControl(address, enteredSlotKeys, slot.slotKey),
            key: slot.slotKey,
            label: sideRoom.label,
            marker: input.markerDestinations.marker(address),
            physicalDoorId: slot.physicalDoorId,
          };
          if (side.generation === 'notGenerated') {
            return Object.freeze({ ...descriptor, generation: side.generation });
          }
          const reward = createLocalRewardAddress(
            input.biome,
            occurrence.occurrenceId,
            group.key,
            slot.slotKey,
          );
          return Object.freeze({
            ...descriptor,
            generation: side.generation,
            rewardControl: requireProjectedRewardControl(controls, reward, 'countedReward'),
          });
        });
      return Object.freeze({
        kind: 'ephyra' as const,
        incomingReward,
        sideRooms: Object.freeze({
          group: Object.freeze({
            address: groupAddress,
            enteredSlotKeys: Object.freeze(enteredSlotKeys),
            marker: input.markerDestinations.marker(groupAddress),
            slots: Object.freeze(slots),
          }),
          kind: 'published' as const,
        }),
      });
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no bounded cage declaration`,
        );
      }
      const active = new Set(
        input.fieldsBatchFacts === undefined
          ? []
          : group.slotKeys
              .slice(0, input.fieldsBatchFacts.doorCageRewardCount)
              .map((slotKey) =>
                semanticAddressKey(
                  createLocalRewardAddress(
                    input.biome,
                    occurrence.occurrenceId,
                    group.key,
                    slotKey,
                  ),
                ),
              ),
      );
      const cages = group.slotKeys.map((slotKey, index) => {
        const address = createLocalRewardAddress(
          input.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        return Object.freeze({
          active: active.has(semanticAddressKey(address)),
          control: requireProjectedRewardControl(controls, address, 'countedReward'),
          key: slotKey,
          label: `Cage ${index + 1}`,
        });
      });
      return Object.freeze({
        kind: 'fields' as const,
        cages: Object.freeze(cages),
        groupKey: group.key,
      });
    }
    case 'shipCombat': {
      const state = occurrence.state;
      const envelope = requireEncounterEnvelope(input.catalog, room);
      let wheelOrdinal = 0;
      const wheels = envelope.slots.flatMap((slot, phaseIndex) => {
        const declaration = slot.rewardAttachment;
        if (declaration?.kind !== 'rewardWheel') return [];
        const wheel = state.wheels[declaration.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${declaration.key}`,
          );
        }
        const address = createRewardWheelAddress(
          input.biome,
          occurrence.occurrenceId,
          declaration.key,
        );
        const active = phaseIndex < state.encounterCount;
        const label = `Combat ${wheelOrdinal + 1} reward`;
        wheelOrdinal += 1;
        const offers = declaration.offerKeys.map((offerKey, offerIndex) => {
          const offerAddress = createRewardWheelOfferAddress(
            input.biome,
            occurrence.occurrenceId,
            declaration.key,
            offerKey,
          );
          return Object.freeze({
            active: active && offerIndex < wheel.offerCount,
            control: requireProjectedRewardControl(controls, offerAddress, 'countedReward'),
            key: offerKey,
            label: `Offer ${offerIndex + 1}`,
          });
        });
        return [
          Object.freeze({
            active,
            address,
            key: declaration.key,
            label,
            marker: input.markerDestinations.marker(address),
            offerCount: wheel.offerCount,
            offers: Object.freeze(offers),
            pickedOfferIndex: wheel.pickedOfferIndex,
            storeKey: wheel.storeKey,
          }),
        ];
      });
      return Object.freeze({
        kind: 'ship' as const,
        combatPhaseCount: state.encounterCount,
        wheels: Object.freeze(wheels),
      });
    }
    case 'shop': {
      const state = occurrence.state;
      const shop = state.shop;
      if (!input.facts.detailsActive || shop === undefined) {
        return Object.freeze({
          kind: 'shop' as const,
          materialized: false,
          offers: Object.freeze([]),
          purchaseOrder: Object.freeze([]),
        });
      }
      const profile = input.catalog.rewards.shops.byKey[shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${shop.profileKey} is missing`,
        );
      }
      const purchaseOrder = Object.freeze([...shop.purchaseOrder]);
      const purchasedKeys = new Set<string>();
      for (const offerKey of purchaseOrder) {
        if (shop.offers[offerKey] === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Shop purchase order has unknown offer ${offerKey}`,
          );
        }
        if (purchasedKeys.has(offerKey)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Shop purchase order duplicates ${offerKey}`,
          );
        }
        purchasedKeys.add(offerKey);
      }
      const offers = profile.slots.values.map((slot) => {
        if (shop.offers[slot.key] === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop state is missing ${slot.key}`,
          );
        }
        const offerAddress = createShopOfferAddress(input.biome, occurrence.occurrenceId, slot.key);
        const purchaseAddress = createShopPurchaseAddress(
          input.biome,
          occurrence.occurrenceId,
          slot.key,
        );
        const purchaseIndex = purchaseOrder.indexOf(slot.key);
        const withoutSlot = Object.freeze(
          purchaseOrder.filter((offerKey) => offerKey !== slot.key),
        );
        const toggleOfferKeys = Object.freeze(
          purchaseIndex < 0 ? [...purchaseOrder, slot.key] : [...withoutSlot],
        );
        const positionOptions =
          purchaseIndex < 0
            ? Object.freeze([])
            : Object.freeze(
                Array.from({ length: withoutSlot.length + 1 }, (_, insertionIndex) => {
                  const position = insertionIndex + 1;
                  return Object.freeze({
                    label: ordinalLabel(position),
                    offerKeys: Object.freeze([
                      ...withoutSlot.slice(0, insertionIndex),
                      slot.key,
                      ...withoutSlot.slice(insertionIndex),
                    ]),
                    position,
                  });
                }),
              );
        return Object.freeze({
          key: slot.key,
          label: slot.label,
          purchase: Object.freeze({
            address: purchaseAddress,
            marker: input.markerDestinations.marker(purchaseAddress),
            purchased: purchaseIndex >= 0,
            position: purchaseIndex < 0 ? null : purchaseIndex + 1,
            toggleOfferKeys,
            positionOptions,
            proposalOfferKeys: uniqueShopPurchaseOrders([
              purchaseOrder,
              toggleOfferKeys,
              ...positionOptions.map((option) => option.offerKeys),
            ]),
          }),
          rewardControl: requireProjectedRewardControl(controls, offerAddress, 'explicitReward'),
        });
      });
      return Object.freeze({
        kind: 'shop' as const,
        materialized: true,
        offers: Object.freeze(offers),
        purchaseOrder,
      });
    }
  }
}

function encounterPhaseInteractionRequirement(
  owner: LocalChildAddress | WorkspaceRoomSummary['address'],
  phases: readonly WorkspaceEncounterPhase[],
): WorkspaceOccurrenceInteractionRequirement | undefined {
  const customizablePhases = phases.filter((phase) => phase.customizable);
  if (customizablePhases.length === 0) return undefined;
  return Object.freeze({
    kind: 'encounterPhases' as const,
    owner,
    phases: Object.freeze(
      customizablePhases.map((phase) =>
        Object.freeze({
          candidateChoices: phase.candidateChoices,
          owner: phase.address,
          selectedEncounterKey: phase.selectedEncounter.key,
        }),
      ),
    ),
  });
}

/**
 * A room-local surface exists only when its authored detail is meaningful to
 * change or explain. A singleton encounter remains an exact semantic owner,
 * but its selector would be a no-op; a live phase finding still earns a
 * read-only diagnostic surface.
 */
function hasRoomLocalCustomization(
  detailsActive: boolean,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  roomLocal: WorkspaceRoomLocal,
  additionalSpawnAvailable: boolean,
): boolean {
  if (!detailsActive) return false;
  if (additionalSpawnAvailable) return true;
  if (encounterPhases.some((phase) => phase.customizable || phase.marker.findingCount > 0)) {
    return true;
  }
  switch (roomLocal.kind) {
    case 'ephyra':
      return roomLocal.sideRooms.kind === 'published';
    case 'fields':
    case 'ship':
      return false;
    case 'shop':
      return false;
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return false;
  }
}

function occurrenceInteractionRequirements(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
): readonly WorkspaceOccurrenceInteractionRequirement[] {
  const requirements: WorkspaceOccurrenceInteractionRequirement[] = [];
  const topLevelEncounterRequirement = encounterPhaseInteractionRequirement(
    room.address,
    room.encounterPhases,
  );
  if (topLevelEncounterRequirement !== undefined) requirements.push(topLevelEncounterRequirement);

  if (room.zagreusSpawn?.materialized === true) {
    requirements.push(
      Object.freeze({ kind: 'zagreusSpawn' as const, owner: room.zagreusSpawn.owner }),
    );
  }
  if (room.naturalChaosSpawn !== undefined) {
    requirements.push(
      Object.freeze({ kind: 'naturalChaosSpawn' as const, owner: room.naturalChaosSpawn.owner }),
    );
  }

  if (room.roomLocal.kind === 'ephyra' && room.roomLocal.sideRooms.kind === 'published') {
    for (const sideRoom of room.roomLocal.sideRooms.group.slots) {
      const localEncounterRequirement = encounterPhaseInteractionRequirement(
        sideRoom.address,
        sideRoom.encounterPhases,
      );
      if (localEncounterRequirement !== undefined) requirements.push(localEncounterRequirement);
    }
  }

  switch (room.roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
    case 'fields':
      return Object.freeze(requirements);
    case 'ephyra': {
      if (room.roomLocal.sideRooms.kind === 'withheld') return Object.freeze(requirements);
      const group = room.roomLocal.sideRooms.group;
      const sideRooms = group.slots.map((sideRoom) =>
        Object.freeze({
          address: sideRoom.address,
          entryOrder: sideRoom.entryOrder,
          generation: sideRoom.generation,
        }),
      );
      if (sideRooms.length === 0) return Object.freeze(requirements);
      requirements.push(
        Object.freeze({
          kind: 'ephyraSideRooms' as const,
          generationChoices: Object.freeze([
            Object.freeze({ label: 'Generated', value: 'generated' as const }),
            Object.freeze({ label: 'Not generated', value: 'notGenerated' as const }),
          ]),
          owner: group.address,
          sideRooms: Object.freeze(sideRooms),
        }),
      );
      return Object.freeze(requirements);
    }
    case 'ship': {
      const declaration = requireRoom(catalog, room.gameName);
      const wheels = room.roomLocal.wheels.map((wheel) => {
        const attachment = requireRewardWheelAttachment(catalog, declaration, wheel.key);
        return Object.freeze({
          address: wheel.address,
          offerCount: wheel.offerCount,
          offerCountChoices: Object.freeze(
            Array.from(
              { length: attachment.offerCount.max - attachment.offerCount.min + 1 },
              (_, index) => {
                const value = attachment.offerCount.min + index;
                return Object.freeze({ label: String(value), value });
              },
            ),
          ),
          pickChoices: Object.freeze(
            Array.from({ length: wheel.offerCount }, (_, index) => {
              const value = index + 1;
              return Object.freeze({ label: `Offer ${value}`, value });
            }),
          ),
          pickedOfferIndex: wheel.pickedOfferIndex,
          storeKey: wheel.storeKey,
          storeChoices: Object.freeze(
            attachment.reward.storeKeys.map((value) =>
              Object.freeze({ label: workspaceRewardStoreLabel(value), value }),
            ),
          ),
        });
      });
      requirements.push(
        Object.freeze({
          combatPhaseCount: room.roomLocal.combatPhaseCount,
          combatPhaseCountChoices: Object.freeze([
            Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
            Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
          ]),
          kind: 'shipCombatPhaseCount' as const,
          owner: room.address,
          wheels: Object.freeze(wheels),
        }),
      );
      return Object.freeze(requirements);
    }
    case 'shop': {
      const shop = room.roomLocal;
      if (!shop.materialized || shop.offers.length === 0) {
        return Object.freeze(requirements);
      }
      requirements.push(
        Object.freeze({
          kind: 'shopPurchaseOrders' as const,
          owner: room.address,
          purchases: Object.freeze(
            shop.offers.map((offer) =>
              Object.freeze({
                owner: offer.purchase.address,
                proposalOfferKeys: offer.purchase.proposalOfferKeys,
                selectedOfferKeys: shop.purchaseOrder,
              }),
            ),
          ),
        }),
      );
      return Object.freeze(requirements);
    }
  }
}

/**
 * Assemble one reachable authored occurrence without consulting topology,
 * source indexes, candidate services, or registrations from other occurrences.
 */
export function assembleWorkspaceOccurrence(
  input: WorkspaceOccurrenceAssemblyInput,
): WorkspaceOccurrenceAssembly {
  const { occurrence } = input;
  const room = requireRoom(input.catalog, occurrence.gameName);
  const address = createOccurrenceAddress(input.biome, occurrence.occurrenceId);
  if (
    input.roomPicker !== undefined &&
    semanticAddressKey(input.roomPicker.address) !== semanticAddressKey(address)
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(address)} received a room picker for ${semanticAddressKey(input.roomPicker.address)}`,
    );
  }
  const entered = input.evaluatedRoom?.entered ?? false;
  const rewardControls = controlsForOccurrence(input, room);
  const roomControls =
    input.roomPicker === undefined ? Object.freeze([]) : Object.freeze([input.roomPicker]);
  const encounterPhases = input.facts.detailsActive
    ? activeEncounterPhasesForOwner(
        input,
        room,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        occurrence.encounters,
        {
          ...(occurrence.state.kind === 'shipCombat'
            ? { shipEncounterCount: occurrence.state.encounterCount }
            : {}),
          ...(occurrence.state.kind === 'fieldsCombat'
            ? {
                fieldsCageRewardCount: input.fieldsBatchFacts?.doorCageRewardCount ?? 0,
              }
            : {}),
        },
      )
    : Object.freeze([]);
  const roomLocal = roomLocalForOccurrence(input, room, rewardControls);
  const zagreusDeclaration = room.additionalExits.find(
    (candidate) => candidate.kind === 'zagreusContract',
  );
  const zagreusSpawn =
    zagreusDeclaration === undefined ||
    input.facts.authoredAdditionalExitKeys.includes(zagreusDeclaration.key) ||
    !input.facts.detailsActive ||
    roomLocal.kind !== 'shop' ||
    !roomLocal.materialized
      ? undefined
      : (() => {
          const owner = createAdditionalExitAddress(
            input.biome,
            occurrence.occurrenceId,
            zagreusDeclaration.key,
          );
          return Object.freeze({
            marker: input.markerDestinations.marker(owner),
            materialized: true,
            owner,
          });
        })();
  const naturalChaosDeclaration = room.additionalExits.find(
    (candidate) => candidate.kind === 'naturalChaos',
  );
  const naturalChaosSpawn =
    naturalChaosDeclaration === undefined ||
    input.facts.authoredAdditionalExitKeys.includes(naturalChaosDeclaration.key) ||
    !input.facts.detailsActive
      ? undefined
      : (() => {
          const owner = createAdditionalExitAddress(
            input.biome,
            occurrence.occurrenceId,
            naturalChaosDeclaration.key,
          );
          return Object.freeze({
            marker: input.markerDestinations.marker(owner),
            owner,
          });
        })();
  const localDetailMarkers = Object.freeze([
    ...encounterPhases.map((phase) => phase.marker),
    ...workspaceLocalDetailMarkers(roomLocal),
    ...(zagreusSpawn === undefined ? [] : [zagreusSpawn.marker]),
    ...(naturalChaosSpawn === undefined ? [] : [naturalChaosSpawn.marker]),
  ]);
  const customizationMarkers = Object.freeze([
    ...encounterPhases.map((phase) => phase.marker),
    ...workspaceCustomizationMarkers(roomLocal),
    ...(zagreusSpawn === undefined ? [] : [zagreusSpawn.marker]),
    ...(naturalChaosSpawn === undefined ? [] : [naturalChaosSpawn.marker]),
  ]);
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    customizationMarkers,
    detailsActive: input.facts.detailsActive,
    encounterPhases,
    entered,
    gameName: occurrence.gameName,
    hasRoomLocalCustomization: hasRoomLocalCustomization(
      input.facts.detailsActive,
      encounterPhases,
      roomLocal,
      zagreusSpawn?.materialized === true || naturalChaosSpawn !== undefined,
    ),
    kind: room.kind,
    label: room.label,
    localDetailMarkers,
    marker: input.markerDestinations.marker(address),
    occurrenceId: occurrence.occurrenceId,
    ...(occurrence.state.kind !== 'anomaly'
      ? {}
      : (() => {
          if (input.anomalyReplacementRoomGameNames === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(address)} Anomaly has no declared replacement map domain`,
            );
          }
          if (occurrence.anomalyReplacement === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(address)} Anomaly has no replacement provenance`,
            );
          }
          const remembered = requireRoom(
            input.catalog,
            occurrence.anomalyReplacement.replacedRoomGameName,
          );
          return {
            anomaly: Object.freeze({
              mapChoices: Object.freeze(
                input.anomalyReplacementRoomGameNames.map((gameName) => {
                  const map = requireRoom(input.catalog, gameName);
                  return Object.freeze({ label: map.label, value: map.gameName });
                }),
              ),
              rememberedRoomLabel: remembered.label,
              success: occurrence.state.success,
            }),
          };
        })()),
    ...(input.roomPicker === undefined ? {} : { roomPicker: input.roomPicker }),
    ...(zagreusSpawn === undefined ? {} : { zagreusSpawn }),
    ...(naturalChaosSpawn === undefined ? {} : { naturalChaosSpawn }),
    roomLocal,
    rewardControls,
  });
  const node: WorkspaceOccurrenceWorkbenchNode = Object.freeze({
    inspectorPresentation: 'full' as const,
    kind: 'occurrenceWorkbench' as const,
    key: `occurrence:${semanticAddressKey(address)}`,
    localDetailMarkers: roomSummary.localDetailMarkers,
    marker: roomSummary.marker,
    room: roomSummary,
  });
  const localInteractionRequirements = occurrenceInteractionRequirements(
    input.catalog,
    roomSummary,
  );
  input.markerDestinations.redirect(workspaceOccurrenceOwnedMarkers(node.room), node.key);
  return Object.freeze({
    node,
    occurrenceInteractionRequirements: localInteractionRequirements,
    roomControls,
    rewardControls,
  });
}
