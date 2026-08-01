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
  type AuthoredBiomePlan,
  type BiomeAddress,
  type ExitDecision,
  type OccurrenceId,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { workspaceSideRoomEntryOrderTestKey, workspaceTestOwnerKey } from './test-keys';

/**
 * Test-only, independently derived editable-leaf identities. These types do
 * not belong to the workspace contract: production builds workspace products,
 * while tests use this oracle to make omitted products observable.
 */
export type ExpectedWorkspaceLeafInteractionKind =
  | 'reward'
  | 'rewardWheelOfferCount'
  | 'rewardWheelPick'
  | 'rewardWheelStore'
  | 'shipEncounterCount'
  | 'shopPurchase'
  | 'sideRoomEntryOrder'
  | 'sideRoomGeneration';

export interface ExpectedWorkspaceLeafInteraction {
  readonly key: string;
  readonly kind: ExpectedWorkspaceLeafInteractionKind;
}

export interface ExpectedWorkspaceLeafRequirement {
  readonly address: SemanticAddress;
  readonly interactions: readonly ExpectedWorkspaceLeafInteraction[];
}

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
    if (decision.normal.kind === 'linked') {
      active.add(decision.normal.occurrenceId);
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
  const requireReward = (address: SemanticAddress): void =>
    requireLeaf(address, expectedLeafInteraction('reward', workspaceTestOwnerKey(address)));
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
        requireLeaf(
          incoming,
          ...(rewardType?.payloadDomain === undefined
            ? []
            : [expectedLeafInteraction('reward', workspaceTestOwnerKey(incoming))]),
        );
        break;
      }
      case 'counted':
      case 'freeReward':
        requireReward(incoming);
        break;
      case 'ephyraCombat': {
        requireReward(incoming);
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
          requireReward(
            createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slot.slotKey),
          );
        }
        break;
      }
      case 'fieldsCombat': {
        const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
        if (group?.kind !== 'boundedRewardSlots') {
          throw new Error(`${room.gameName} Fields state has no bounded cage declaration`);
        }
        for (const slotKey of group.slotKeys) {
          requireReward(
            createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slotKey),
          );
        }
        break;
      }
      case 'shipCombat': {
        const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
        if (profile === undefined)
          throw new Error(`${room.gameName} Ship state has no encounter profile`);
        requireLeaf(
          occurrenceAddress,
          expectedLeafInteraction('shipEncounterCount', workspaceTestOwnerKey(occurrenceAddress)),
        );
        for (const phase of profile.phases) {
          const wheel = phase.offerPoint;
          if (wheel === undefined) continue;
          const wheelAddress = createRewardWheelAddress(biome, occurrence.occurrenceId, wheel.key);
          const wheelKey = workspaceTestOwnerKey(wheelAddress);
          requireLeaf(
            wheelAddress,
            expectedLeafInteraction('rewardWheelOfferCount', wheelKey),
            expectedLeafInteraction('rewardWheelStore', wheelKey),
            expectedLeafInteraction('rewardWheelPick', wheelKey),
          );
          for (const offerKey of wheel.offerKeys) {
            requireReward(
              createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheel.key, offerKey),
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
          requireReward(offer);
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
