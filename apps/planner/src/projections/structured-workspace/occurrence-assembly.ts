import {
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  semanticAddressKey,
  type BiomeAddress,
  type LocalChildAddress,
  type RoomOccurrence,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CanonicalAuthoredRoom } from '@run-planner/engine/simulation';

import type { CountedRewardCandidateOwner, RewardCandidateOwner } from '../candidateProjection';
import { summarizeRewardOffer } from '../rewardPicker';

import {
  requireWorkspaceRoom as requireRoom,
  resolveWorkspaceFixedRewardOffer,
} from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  workspaceSideRoomEntryOrderKey,
  type WorkspaceEphyraSideRoomEntryOption,
  type WorkspaceEphyraSideRoomEntryOrderControl,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceRewardControl,
  type WorkspaceRoomLocal,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
} from './contract';
import type { WorkspaceOccurrenceInteractionRequirement } from './interaction-requirements';
import { workspaceLocalDetailMarkers, workspaceOccurrenceOwnedMarkers } from './marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from './marker-builder';
import { workspaceRewardStoreLabel } from './reward-labels';

/**
 * The occurrence assembler consumes only the lifecycle facts needed to project
 * this occurrence. Expected-owner enumeration remains intentionally elsewhere.
 */
export interface WorkspaceOccurrenceProjectionFacts {
  readonly detailsActive: boolean;
}

/** Exact authored/evaluated inputs for one room-local workspace product. */
export interface WorkspaceOccurrenceAssemblyInput {
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
  /** Shared decision-owned Fields derivation for this target occurrence. */
  readonly fieldsActiveCageCount?: number;
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
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
  readonly occurrence: RoomOccurrence;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

export type WorkspaceOccurrenceAssembler = (
  input: WorkspaceOccurrenceAssemblyRequest,
) => WorkspaceOccurrenceAssembly;

function summarizeOffers(catalog: Catalog, offers: readonly ResolvedRewardOffer[]): string {
  return offers.map((offer) => summarizeRewardOffer(catalog, offer)).join(', ');
}

function rewardSummary(
  catalog: Catalog,
  room: RoomDeclaration,
  state: RoomOccurrence['state'],
): string | undefined {
  switch (state.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return summarizeRewardOffer(catalog, resolveWorkspaceFixedRewardOffer(room, state));
    case 'counted':
    case 'freeReward':
    case 'ephyraCombat':
      return summarizeRewardOffer(catalog, state.offer);
    case 'fieldsCombat': {
      const offers = Object.values(state.cages);
      return offers.length === 0
        ? 'Cages not configured'
        : `Cages · ${summarizeOffers(catalog, offers)}`;
    }
    case 'shipCombat': {
      const offers = Object.values(state.wheels).flatMap((wheel) => Object.values(wheel.offers));
      return offers.length === 0
        ? `${state.encounterCount} encounters · Wheels not configured`
        : `${state.encounterCount} encounters · ${summarizeOffers(catalog, offers)}`;
    }
    case 'shop': {
      if (state.shop === undefined) return 'Shop not configured';
      const offers = Object.values(state.shop.offers);
      return `${offers.length} offers · ${offers.filter((offer) => offer.purchased).length} purchased`;
    }
  }
}

function rewardControl(
  input: WorkspaceOccurrenceAssemblyInput,
  owner: RewardCandidateOwner,
  binding: CountedRewardBinding | undefined,
  offer: ResolvedRewardOffer,
  explicitRewardTypes: readonly string[] = Object.freeze([offer.rewardType]),
): WorkspaceRewardControl {
  return binding === undefined
    ? Object.freeze({
        kind: 'explicitReward' as const,
        marker: input.markerDestinations.marker(owner.address),
        offer,
        owner,
        rewardTypes: Object.freeze([...explicitRewardTypes]),
      })
    : Object.freeze({
        kind: 'countedReward' as const,
        binding,
        marker: input.markerDestinations.marker(owner.address),
        offer,
        owner: owner as CountedRewardCandidateOwner,
      });
}

function incomingRewardBinding(
  room: RoomDeclaration,
  state: Extract<
    RoomOccurrence['state'],
    { readonly kind: 'counted' | 'ephyraCombat' | 'freeReward' }
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

/**
 * Validate declaration-owned persisted state before any active/dormant surface
 * branch. In particular, unpicked Ephyra rooms with withheld side details are
 * still malformed when their state names an unknown slot or omits a declared
 * one.
 */
function assertOccurrenceStateCoherence(
  input: WorkspaceOccurrenceAssemblyInput,
  room: RoomDeclaration,
): void {
  const { occurrence } = input;
  switch (occurrence.state.kind) {
    case 'ephyraCombat': {
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) return;
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state has no fixed side-room declaration`,
        );
      }
      for (const slotKey of Object.keys(occurrence.state.sideRooms)) {
        if (group.slots.some((slot) => slot.slotKey === slotKey)) continue;
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} has no side-room slot ${slotKey}`,
        );
      }
      for (const slot of group.slots) {
        if (occurrence.state.sideRooms[slot.slotKey] !== undefined) continue;
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state is missing side room ${slot.slotKey}`,
        );
      }
      return;
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no bounded cage declaration`,
        );
      }
      return;
    }
    case 'shipCombat': {
      const profile = input.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} encounter profile is missing`,
        );
      }
      for (const phase of profile.phases) {
        const wheel = phase.offerPoint;
        if (wheel === undefined || occurrence.state.wheels[wheel.key] !== undefined) continue;
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ship state is missing ${wheel.key}`,
        );
      }
      return;
    }
    case 'none':
    case 'fixed':
    case 'counted':
    case 'freeReward':
    case 'shop':
      return;
  }
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
      { readonly kind: 'counted' | 'ephyraCombat' | 'freeReward' }
    >,
  ) => {
    controls.push(
      rewardControl(
        input,
        { kind: 'incomingReward', address: incoming },
        incomingRewardBinding(room, state),
        state.offer,
      ),
    );
  };
  switch (occurrence.state.kind) {
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
            side.offer,
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
        controls.push(rewardControl(input, { kind: 'localReward', address }, group.reward, offer));
      }
      break;
    }
    case 'shipCombat': {
      const profile = input.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} encounter profile is missing`,
        );
      }
      for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels)) {
        const declaration = profile.phases.find(
          (phase) => phase.offerPoint?.key === wheelKey,
        )?.offerPoint;
        if (declaration === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} wheel ${wheelKey} has no reward declaration`,
          );
        }
        for (const [offerKey, offer] of Object.entries(wheel.offers)) {
          const address = createRewardWheelOfferAddress(
            input.biome,
            occurrence.occurrenceId,
            wheelKey,
            offerKey,
          );
          controls.push(
            rewardControl(input, { kind: 'rewardWheelOffer', address }, declaration.reward, offer),
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
            shopOffer.offer,
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
      label: 'Not entered',
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
        summary: summarizeRewardOffer(input.catalog, offer),
        ...(control === undefined ? {} : { control }),
      });
    }
    case 'counted':
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
      const slots = group.slots.map((slot) => {
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
        const reward = createLocalRewardAddress(
          input.biome,
          occurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        return Object.freeze({
          address,
          entered: side.enteredOrdinal !== null,
          enteredOrdinal: side.enteredOrdinal,
          entryOrder: ephyraSideRoomEntryOrderControl(address, enteredSlotKeys, slot.slotKey),
          generation: side.generation,
          key: slot.slotKey,
          label: sideRoom.label,
          marker: input.markerDestinations.marker(address),
          physicalDoorId: slot.physicalDoorId,
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
        input.evaluatedRoom?.localRewards?.map((reward) => semanticAddressKey(reward.origin)) ??
          (input.fieldsActiveCageCount === undefined
            ? []
            : group.slotKeys
                .slice(0, input.fieldsActiveCageCount)
                .map((slotKey) =>
                  semanticAddressKey(
                    createLocalRewardAddress(
                      input.biome,
                      occurrence.occurrenceId,
                      group.key,
                      slotKey,
                    ),
                  ),
                )),
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
      const profile = input.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ship state has no encounter profile`,
        );
      }
      let wheelOrdinal = 0;
      const wheels = profile.phases.flatMap((phase, phaseIndex) => {
        const declaration = phase.offerPoint;
        if (declaration === undefined) return [];
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
        const label = `Reward wheel ${wheelOrdinal + 1}`;
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
        encounterCount: state.encounterCount,
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
        });
      }
      const profile = input.catalog.rewards.shops.byKey[shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${shop.profileKey} is missing`,
        );
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
        return Object.freeze({
          key: slot.key,
          label: slot.label,
          purchase: Object.freeze({
            address: purchaseAddress,
            marker: input.markerDestinations.marker(purchaseAddress),
            purchased: shop.offers[slot.key]!.purchased,
          }),
          rewardControl: requireProjectedRewardControl(controls, offerAddress, 'explicitReward'),
        });
      });
      return Object.freeze({
        kind: 'shop' as const,
        materialized: true,
        offers: Object.freeze(offers),
      });
    }
  }
}

function occurrenceInteractionRequirements(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
): readonly WorkspaceOccurrenceInteractionRequirement[] {
  switch (room.roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
    case 'fields':
      return Object.freeze([]);
    case 'ephyra': {
      if (room.roomLocal.sideRooms.kind === 'withheld') return Object.freeze([]);
      const group = room.roomLocal.sideRooms.group;
      const sideRooms = group.slots.map((sideRoom) =>
        Object.freeze({
          address: sideRoom.address,
          entryOrder: sideRoom.entryOrder,
          generation: sideRoom.generation,
        }),
      );
      if (sideRooms.length === 0) return Object.freeze([]);
      return Object.freeze([
        Object.freeze({
          kind: 'ephyraSideRooms' as const,
          generationChoices: Object.freeze([
            Object.freeze({ label: 'Generated', value: 'generated' as const }),
            Object.freeze({ label: 'Not generated', value: 'notGenerated' as const }),
          ]),
          owner: group.address,
          sideRooms: Object.freeze(sideRooms),
        }),
      ]);
    }
    case 'ship': {
      const declaration = requireRoom(catalog, room.gameName);
      const profile = catalog.encounterProfiles.byKey[declaration.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${declaration.gameName} Ship projection has no encounter profile`,
        );
      }
      const wheels = room.roomLocal.wheels.map((wheel) => {
        const offerPoint = profile.phases.find(
          (phase) => phase.offerPoint?.key === wheel.key,
        )?.offerPoint;
        if (offerPoint === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${declaration.gameName} Ship projection has no ${wheel.key} wheel declaration`,
          );
        }
        return Object.freeze({
          address: wheel.address,
          offerCount: wheel.offerCount,
          offerCountChoices: Object.freeze(
            Array.from(
              { length: offerPoint.offerCount.max - offerPoint.offerCount.min + 1 },
              (_, index) => {
                const value = offerPoint.offerCount.min + index;
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
            offerPoint.reward.storeKeys.map((value) =>
              Object.freeze({ label: workspaceRewardStoreLabel(value), value }),
            ),
          ),
        });
      });
      return Object.freeze([
        Object.freeze({
          encounterCount: room.roomLocal.encounterCount,
          encounterCountChoices: Object.freeze([
            Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
            Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
          ]),
          kind: 'shipCombat' as const,
          owner: room.address,
          wheels: Object.freeze(wheels),
        }),
      ]);
    }
    case 'shop': {
      if (!room.roomLocal.materialized || room.roomLocal.offers.length === 0) {
        return Object.freeze([]);
      }
      return Object.freeze([
        Object.freeze({
          kind: 'shopPurchases' as const,
          owner: room.address,
          purchaseChoices: Object.freeze([
            Object.freeze({ label: 'Not purchased', value: false }),
            Object.freeze({ label: 'Purchased', value: true }),
          ]),
          purchases: Object.freeze(
            room.roomLocal.offers.map((offer) =>
              Object.freeze({
                owner: offer.purchase.address,
                purchased: offer.purchase.purchased,
              }),
            ),
          ),
        }),
      ]);
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
  assertOccurrenceStateCoherence(input, room);
  const entered = input.evaluatedRoom?.entered ?? false;
  // A dormant Shop is a dead leaf. Its persisted inventory remains available
  // to the command model if the room is picked again, but neither its offer
  // summary nor its editable lifecycle controls are active.
  const summary =
    occurrence.state.kind === 'shop' && !input.facts.detailsActive
      ? undefined
      : rewardSummary(input.catalog, room, occurrence.state);
  const rewardControls = controlsForOccurrence(input, room);
  const roomControls =
    input.roomPicker === undefined ? Object.freeze([]) : Object.freeze([input.roomPicker]);
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    detailsActive: input.facts.detailsActive,
    entered,
    gameName: occurrence.gameName,
    kind: room.kind,
    label: room.label,
    marker: input.markerDestinations.marker(address),
    occurrenceId: occurrence.occurrenceId,
    ...(input.roomPicker === undefined ? {} : { roomPicker: input.roomPicker }),
    roomLocal: roomLocalForOccurrence(input, room, rewardControls),
    rewardControls,
    ...(summary === undefined ? {} : { rewardSummary: summary }),
  });
  const node: WorkspaceOccurrenceWorkbenchNode = Object.freeze({
    inspectorPresentation: 'full' as const,
    kind: 'occurrenceWorkbench' as const,
    key: `occurrence:${semanticAddressKey(address)}`,
    localDetailMarkers: workspaceLocalDetailMarkers(roomSummary.roomLocal),
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
