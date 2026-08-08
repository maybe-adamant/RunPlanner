import {
  createEncounterPhaseAddress,
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
  type AuthoredBiomePlan,
  type AuthoredRewardState,
  type BiomeAddress,
  type EncounterPhaseAddress,
  type ExitDecision,
  type OccurrenceId,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { workspaceSideRoomEntryOrderTestKey, workspaceTestOwnerKey } from './test-keys';

/**
 * Test-only, independently derived editable-leaf identities. These types do
 * not belong to the workspace contract: production builds workspace products,
 * while tests use this oracle to make omitted products observable.
 */
export type ExpectedWorkspaceLeafInteractionKind =
  | 'encounterPhase'
  | 'reward'
  | 'rewardWheelOfferCount'
  | 'rewardWheelPick'
  | 'rewardWheelStore'
  | 'shipCombatPhaseCount'
  | 'shopPurchase'
  | 'sideRoomEntryOrder'
  | 'sideRoomGeneration'
  | 'traitOffer';

export interface ExpectedWorkspaceLeafInteraction {
  readonly key: string;
  readonly kind: ExpectedWorkspaceLeafInteractionKind;
}

export interface ExpectedWorkspaceLeafRequirement {
  readonly address: SemanticAddress;
  readonly interactions: readonly ExpectedWorkspaceLeafInteraction[];
}

/**
 * Test-only capability from the exact engine evaluation. The oracle uses its
 * presence as the complete active-phase fact; it does not re-evaluate slot
 * activation, encounter requirements, or lifecycle history.
 */
export type ExpectedEncounterPhaseCandidateAt = (
  phase: EncounterPhaseAddress,
) => unknown | undefined;

function requireExpectedRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`room ${gameName} is missing`);
  return room;
}

function resolveExpectedFixedRewardType(room: RoomDeclaration): string {
  if (room.incomingReward.kind !== 'fixed') {
    throw new Error(`${room.gameName} fixed state has ${room.incomingReward.kind} reward binding`);
  }
  return room.incomingReward.offer.rewardType;
}

type AuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};
type AuthoredBatchTarget = AuthoredBatchDecision['normal']['targets'][number];

function authoredTargetIsSelected(
  decision: AuthoredBatchDecision,
  target: AuthoredBatchTarget,
): boolean {
  if (decision.selection.kind === 'normal') return decision.selection.exitKey === target.exitKey;
  return (
    decision.selection.kind === 'derived' && decision.normal.targets[0]?.exitKey === target.exitKey
  );
}

/**
 * Topology alone determines whether declaration-owned picked-room detail is
 * visible. It deliberately does not inspect simulation coverage or workspace
 * output.
 */
export function expectedWorkspaceDetailsActiveOccurrenceIds(
  plan: AuthoredBiomePlan,
): ReadonlySet<OccurrenceId> {
  const active = new Set<OccurrenceId>();
  const topology = plan.topology;
  if (topology === null) return active;
  active.add(topology.startOccurrenceId);
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      for (const slotKey of decision.visitOrder) {
        const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === slotKey);
        if (target !== undefined) active.add(target.occurrenceId);
      }
      continue;
    }
    const target = decision.normal.targets.find((candidate) =>
      authoredTargetIsSelected(decision as AuthoredBatchDecision, candidate),
    );
    if (target !== undefined) active.add(target.occurrenceId);
  }
  return active;
}

interface MutableExpectedWorkspaceLeafRequirement {
  readonly address: SemanticAddress;
  readonly interactions: Map<
    ExpectedWorkspaceLeafInteractionKind,
    ExpectedWorkspaceLeafInteraction
  >;
}

function expectedLeafInteraction(
  kind: ExpectedWorkspaceLeafInteractionKind,
  key: string,
): ExpectedWorkspaceLeafInteraction {
  return Object.freeze({ key, kind });
}

/**
 * Enumerate editable leaves from persisted room state and declarations without
 * importing any workspace producer, marker, presentation, binding, or facade
 * product. This is an identity/visibility oracle, not a payload mirror.
 */
export function expectedWorkspaceLeafRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
): readonly ExpectedWorkspaceLeafRequirement[] {
  const required = new Map<string, MutableExpectedWorkspaceLeafRequirement>();
  const requireLeaf = (
    address: SemanticAddress,
    ...interactions: readonly ExpectedWorkspaceLeafInteraction[]
  ): void => {
    const key = workspaceTestOwnerKey(address);
    let requirement = required.get(key);
    if (requirement === undefined) {
      requirement = { address, interactions: new Map() };
      required.set(key, requirement);
    }
    for (const interaction of interactions) {
      const existing = requirement.interactions.get(interaction.kind);
      if (existing !== undefined && existing.key !== interaction.key) {
        throw new Error(`${key} has conflicting expected ${interaction.kind} interaction keys`);
      }
      requirement.interactions.set(interaction.kind, interaction);
    }
  };
  const requireReward = (address: TraitOfferOwnerAddress): void =>
    requireLeaf(address, expectedLeafInteraction('reward', workspaceTestOwnerKey(address)));
  const requireTraitOffers = (
    address: TraitOfferOwnerAddress,
    reward: AuthoredRewardState,
  ): void => {
    if (!detailsActive.has(address.occurrenceId)) return;
    for (const acquisitionRole of Object.keys(reward.traitOffersByAcquisitionRole)) {
      const traitAddress = createTraitOfferAddress(address, acquisitionRole);
      requireLeaf(
        traitAddress,
        expectedLeafInteraction('traitOffer', workspaceTestOwnerKey(traitAddress)),
      );
    }
  };
  const requireRewardWithTraits = (
    address: TraitOfferOwnerAddress,
    reward: AuthoredRewardState,
  ): void => {
    requireReward(address);
    requireTraitOffers(address, reward);
  };
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const detailsActive = expectedWorkspaceDetailsActiveOccurrenceIds(plan);
  for (const occurrence of topology.occurrences) {
    const room = requireExpectedRoom(catalog, occurrence.gameName);
    const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
    const incoming = createIncomingRewardAddress(biome, occurrence.occurrenceId);
    switch (occurrence.state.kind) {
      case 'none':
        break;
      case 'fixed': {
        const rewardType = catalog.rewards.rewardTypes.byKey[resolveExpectedFixedRewardType(room)];
        if (rewardType?.payloadDomain !== undefined) {
          requireRewardWithTraits(incoming, occurrence.state.reward);
        }
        break;
      }
      case 'counted':
      case 'freeReward':
        requireRewardWithTraits(incoming, occurrence.state.reward);
        break;
      case 'ephyraCombat': {
        requireRewardWithTraits(incoming, occurrence.state.reward);
        if (!detailsActive.has(occurrence.occurrenceId)) break;
        const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
        if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) break;
        if (group?.kind !== 'fixedRoomSlots') {
          throw new Error(`${room.gameName} Ephyra state has no fixed side-room declaration`);
        }
        requireLeaf(createLocalChildGroupAddress(biome, occurrence.occurrenceId, group.key));
        for (const slot of group.slots) {
          const sideAddress = createLocalChildAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
            slot.slotKey,
          );
          requireLeaf(
            sideAddress,
            expectedLeafInteraction('sideRoomGeneration', workspaceTestOwnerKey(sideAddress)),
            expectedLeafInteraction(
              'sideRoomEntryOrder',
              workspaceSideRoomEntryOrderTestKey(sideAddress),
            ),
          );
          if (occurrence.state.sideRooms[slot.slotKey]?.generation === 'generated') {
            requireRewardWithTraits(
              createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slot.slotKey),
              occurrence.state.sideRooms[slot.slotKey]!.reward,
            );
          }
        }
        break;
      }
      case 'fieldsCombat': {
        const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
        if (group?.kind !== 'boundedRewardSlots') {
          throw new Error(`${room.gameName} Fields state has no bounded cage declaration`);
        }
        for (const slotKey of group.slotKeys) {
          const rewardAddress = createLocalRewardAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
            slotKey,
          );
          requireRewardWithTraits(rewardAddress, occurrence.state.cages[slotKey]!);
        }
        break;
      }
      case 'shipCombat': {
        const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
        if (envelope === undefined)
          throw new Error(`${room.gameName} Ship state has no encounter envelope`);
        requireLeaf(
          occurrenceAddress,
          expectedLeafInteraction('shipCombatPhaseCount', workspaceTestOwnerKey(occurrenceAddress)),
        );
        for (const slot of envelope.slots) {
          const wheel = slot.rewardAttachment;
          if (wheel?.kind !== 'rewardWheel') continue;
          const wheelAddress = createRewardWheelAddress(biome, occurrence.occurrenceId, wheel.key);
          const wheelKey = workspaceTestOwnerKey(wheelAddress);
          requireLeaf(
            wheelAddress,
            expectedLeafInteraction('rewardWheelOfferCount', wheelKey),
            expectedLeafInteraction('rewardWheelStore', wheelKey),
            expectedLeafInteraction('rewardWheelPick', wheelKey),
          );
          for (const offerKey of wheel.offerKeys) {
            const offerAddress = createRewardWheelOfferAddress(
              biome,
              occurrence.occurrenceId,
              wheel.key,
              offerKey,
            );
            requireRewardWithTraits(
              offerAddress,
              occurrence.state.wheels[wheel.key]!.offers[offerKey]!,
            );
          }
        }
        break;
      }
      case 'shop': {
        if (!detailsActive.has(occurrence.occurrenceId) || occurrence.state.shop === undefined) {
          break;
        }
        const profile = catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
        if (profile === undefined) {
          throw new Error(
            `${room.gameName} shop profile ${occurrence.state.shop.profileKey} is missing`,
          );
        }
        for (const slot of profile.slots.values) {
          const offer = createShopOfferAddress(biome, occurrence.occurrenceId, slot.key);
          requireRewardWithTraits(offer, occurrence.state.shop.offers[slot.key]!.reward);
          const purchase = createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key);
          requireLeaf(
            purchase,
            expectedLeafInteraction('shopPurchase', workspaceTestOwnerKey(purchase)),
          );
        }
        break;
      }
    }
  }
  return Object.freeze(
    [...required.values()].map((requirement) =>
      Object.freeze({
        address: requirement.address,
        interactions: Object.freeze([...requirement.interactions.values()]),
      }),
    ),
  );
}

/**
 * Independently enumerate every declaration-addressable pooled phase, then
 * retain only phase identities the exact engine publication exposes. This
 * closes the application handoff (marker, destination, and meaningful
 * selection interaction) without copying engine candidate or lifecycle policy
 * into test support.
 */
export function expectedWorkspaceEncounterPhaseLeafRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  encounterCandidateAt: ExpectedEncounterPhaseCandidateAt,
): readonly ExpectedWorkspaceLeafRequirement[] {
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const requirements = new Map<string, ExpectedWorkspaceLeafRequirement>();
  const append = (phase: EncounterPhaseAddress, customizable: boolean): void => {
    if (encounterCandidateAt(phase) === undefined) return;
    const key = workspaceTestOwnerKey(phase);
    if (requirements.has(key)) {
      throw new Error(`duplicate expected encounter phase ${key}`);
    }
    requirements.set(
      key,
      Object.freeze({
        address: phase,
        interactions: customizable
          ? Object.freeze([expectedLeafInteraction('encounterPhase', workspaceTestOwnerKey(phase))])
          : Object.freeze([]),
      }),
    );
  };
  const appendRoom = (room: RoomDeclaration, owner: EncounterPhaseAddress['owner']): void => {
    for (const binding of room.encounterSlotBindings) {
      if (binding.kind !== 'set') continue;
      const set = catalog.encounterSets.byKey[binding.encounterSetKey];
      if (set === undefined) {
        throw new Error(`${room.gameName} has no encounter set ${binding.encounterSetKey}`);
      }
      append(
        createEncounterPhaseAddress(biome, owner, binding.slotKey),
        set.encounterDefinitionKeys.length > 1,
      );
    }
  };

  for (const occurrence of topology.occurrences) {
    const room = requireExpectedRoom(catalog, occurrence.gameName);
    appendRoom(room, { kind: 'occurrence', occurrenceId: occurrence.occurrenceId });
    for (const group of room.localChildren) {
      if (group.kind !== 'fixedRoomSlots') continue;
      for (const slot of group.slots) {
        appendRoom(requireExpectedRoom(catalog, slot.roomGameName), {
          kind: 'localChild',
          occurrenceId: occurrence.occurrenceId,
          groupKey: group.key,
          slotKey: slot.slotKey,
        });
      }
    }
  }
  return Object.freeze([...requirements.values()]);
}
