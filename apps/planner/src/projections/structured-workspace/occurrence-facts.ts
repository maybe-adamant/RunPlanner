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
  type AuthoredBiomePlan,
  type BiomeAddress,
  type ExitDecision,
  type OccurrenceId,
  type RoomOccurrence,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { StructuredWorkspaceProjectionContractError } from './contract';
import type { WorkspaceBiomeSource } from './source-index';

/**
 * Lifecycle and surface publication are distinct: a dormant value can remain
 * visibly editable when its declaration calls for that. An address not
 * represented here is absent.
 */
export type WorkspaceOccurrenceLeafLifecycle = 'active' | 'dormant' | 'absent';
export type WorkspaceOccurrenceLeafSurface = 'published' | 'withheld' | 'absent';

export interface WorkspaceOccurrenceLeafFact {
  readonly address: SemanticAddress;
  readonly lifecycle: Exclude<WorkspaceOccurrenceLeafLifecycle, 'absent'>;
  readonly surface: Exclude<WorkspaceOccurrenceLeafSurface, 'absent'>;
}

export interface WorkspaceOccurrenceAssemblyFact {
  readonly detailsActive: boolean;
  readonly fieldsActiveCageCount?: number;
  readonly leaves: readonly WorkspaceOccurrenceLeafFact[];
  readonly occurrenceId: OccurrenceId;
  leafLifecycle(address: SemanticAddress): WorkspaceOccurrenceLeafLifecycle;
  leafSurface(address: SemanticAddress): WorkspaceOccurrenceLeafSurface;
}

export interface WorkspaceBiomeOccurrenceAssemblyFacts {
  readonly biome: BiomeAddress;
  readonly occurrences: readonly WorkspaceOccurrenceAssemblyFact[];
  leafLifecycle(address: SemanticAddress): WorkspaceOccurrenceLeafLifecycle;
  leafSurface(address: SemanticAddress): WorkspaceOccurrenceLeafSurface;
  occurrence(occurrenceId: OccurrenceId): WorkspaceOccurrenceAssemblyFact | undefined;
}

function requireRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
}

/**
 * Fields cage participation is batch-derived but owns room-local leaves. Keep
 * that narrow derivation beside the room-local lifecycle facts instead of
 * asking each occurrence projection to reconstruct it.
 */
export function authoredFieldsActiveCageCountForDecision(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
  decision: AuthoredBatchDecision,
): number | undefined {
  const layout = source.layout;
  if (
    layout.progression.kind !== 'generated' ||
    layout.progression.batchPolicy.kind !== 'fields' ||
    decision.normal.batchState === null
  ) {
    return undefined;
  }
  let maxCount = layout.progression.batchPolicy.maxDoorCageRewards;
  for (const target of decision.normal.targets) {
    const occurrence = source.occurrence(target.occurrenceId);
    if (occurrence === undefined) continue;
    const room = requireRoom(catalog, occurrence.gameName);
    const cages = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
    if (cages?.kind === 'boundedRewardSlots') {
      maxCount = Math.min(maxCount, cages.maxActiveSlots);
    }
  }
  return decision.normal.batchState.cageOutcome === 'min'
    ? layout.progression.batchPolicy.minDoorCageRewards
    : maxCount;
}

function authoredFieldsActiveCageCounts(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
): ReadonlyMap<OccurrenceId, number> {
  const counts = new Map<OccurrenceId, number>();
  for (const decision of source.exitDecisions) {
    if (decision.normal.kind !== 'batch') continue;
    const activeCount = authoredFieldsActiveCageCountForDecision(
      catalog,
      source,
      decision as AuthoredBatchDecision,
    );
    if (activeCount === undefined) continue;
    for (const target of decision.normal.targets) {
      if (source.occurrence(target.occurrenceId)?.state.kind === 'fieldsCombat') {
        counts.set(target.occurrenceId, activeCount);
      }
    }
  }
  return counts;
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
 * This is production assembly input only. The closure audit deliberately
 * derives its expected active path independently from persisted topology.
 */
function authoredDetailsActiveOccurrenceIds(plan: AuthoredBiomePlan): ReadonlySet<OccurrenceId> {
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

function occurrenceLeafFacts(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  detailsActive: boolean,
  fieldsActiveCageCount: number | undefined,
): WorkspaceOccurrenceAssemblyFact {
  const room = requireRoom(catalog, occurrence.gameName);
  const leaves = new Map<string, WorkspaceOccurrenceLeafFact>();
  const add = (
    address: SemanticAddress,
    lifecycle: Exclude<WorkspaceOccurrenceLeafLifecycle, 'absent'>,
    surface: Exclude<WorkspaceOccurrenceLeafSurface, 'absent'>,
  ): void => {
    const key = semanticAddressKey(address);
    const existing = leaves.get(key);
    if (
      existing !== undefined &&
      (existing.lifecycle !== lifecycle || existing.surface !== surface)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has conflicting authored occurrence leaf facts`,
      );
    }
    if (existing === undefined) leaves.set(key, Object.freeze({ address, lifecycle, surface }));
  };
  const incoming = createIncomingRewardAddress(biome, occurrence.occurrenceId);
  const detailLifecycle = detailsActive ? ('active' as const) : ('dormant' as const);
  const pickedDetailSurface = detailsActive ? ('published' as const) : ('withheld' as const);
  switch (occurrence.state.kind) {
    case 'none':
      break;
    case 'fixed':
    case 'counted':
    case 'freeReward':
      add(incoming, 'active', 'published');
      break;
    case 'ephyraCombat': {
      add(incoming, 'active', 'published');
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) break;
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
      add(
        createLocalChildGroupAddress(biome, occurrence.occurrenceId, group.key),
        detailLifecycle,
        pickedDetailSurface,
      );
      for (const slot of group.slots) {
        add(
          createLocalChildAddress(biome, occurrence.occurrenceId, group.key, slot.slotKey),
          detailLifecycle,
          pickedDetailSurface,
        );
        add(
          createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slot.slotKey),
          detailLifecycle,
          pickedDetailSurface,
        );
      }
      break;
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no bounded cage declaration`,
        );
      }
      for (const [index, slotKey] of group.slotKeys.entries()) {
        add(
          createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slotKey),
          index < (fieldsActiveCageCount ?? 0) ? 'active' : 'dormant',
          'published',
        );
      }
      break;
    }
    case 'shipCombat': {
      const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} encounter profile is missing`,
        );
      }
      add(createOccurrenceAddress(biome, occurrence.occurrenceId), 'active', 'published');
      for (const [phaseIndex, phase] of profile.phases.entries()) {
        const wheel = phase.offerPoint;
        if (wheel === undefined) continue;
        const authoredWheel = occurrence.state.wheels[wheel.key];
        if (authoredWheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${wheel.key}`,
          );
        }
        const wheelLifecycle =
          phaseIndex < occurrence.state.encounterCount ? ('active' as const) : ('dormant' as const);
        add(
          createRewardWheelAddress(biome, occurrence.occurrenceId, wheel.key),
          wheelLifecycle,
          'published',
        );
        for (const [offerIndex, offerKey] of wheel.offerKeys.entries()) {
          const offerLifecycle =
            wheelLifecycle === 'active' && offerIndex < authoredWheel.offerCount
              ? ('active' as const)
              : ('dormant' as const);
          add(
            createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheel.key, offerKey),
            offerLifecycle,
            'published',
          );
        }
      }
      break;
    }
    case 'shop': {
      const shop = occurrence.state.shop;
      if (shop === undefined) break;
      const profile = catalog.rewards.shops.byKey[shop.profileKey];
      // A dormant malformed inventory remains dormant. The existing active
      // room assembly reports its declaration error when the room is picked.
      if (profile === undefined) {
        if (detailsActive) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop profile ${shop.profileKey} is missing`,
          );
        }
        break;
      }
      for (const slot of profile.slots.values) {
        add(
          createShopOfferAddress(biome, occurrence.occurrenceId, slot.key),
          detailLifecycle,
          pickedDetailSurface,
        );
        add(
          createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key),
          detailLifecycle,
          pickedDetailSurface,
        );
      }
      break;
    }
  }
  const frozenLeaves = Object.freeze([...leaves.values()]);
  const leafByAddress = new Map(
    frozenLeaves.map((leaf) => [semanticAddressKey(leaf.address), leaf] as const),
  );
  return Object.freeze({
    detailsActive,
    ...(fieldsActiveCageCount === undefined ? {} : { fieldsActiveCageCount }),
    leaves: frozenLeaves,
    occurrenceId: occurrence.occurrenceId,
    leafLifecycle: (address: SemanticAddress) =>
      leafByAddress.get(semanticAddressKey(address))?.lifecycle ?? 'absent',
    leafSurface: (address: SemanticAddress) =>
      leafByAddress.get(semanticAddressKey(address))?.surface ?? 'absent',
  });
}

/**
 * Immutable lifecycle classification for one authored biome. It owns only
 * authored occurrence detail activation and declaration-owned local leaves;
 * evaluator entry and projection output are intentionally outside this seam.
 */
export function createWorkspaceBiomeOccurrenceAssemblyFacts(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
): WorkspaceBiomeOccurrenceAssemblyFacts {
  const active = authoredDetailsActiveOccurrenceIds(source.plan);
  const fieldsActiveCageCounts = authoredFieldsActiveCageCounts(catalog, source);
  const occurrences = Object.freeze(
    (source.plan.topology?.occurrences ?? []).map((occurrence) =>
      occurrenceLeafFacts(
        catalog,
        source.biome,
        occurrence,
        active.has(occurrence.occurrenceId),
        fieldsActiveCageCounts.get(occurrence.occurrenceId),
      ),
    ),
  );
  const byOccurrence = new Map<OccurrenceId, WorkspaceOccurrenceAssemblyFact>();
  const leavesByAddress = new Map<string, WorkspaceOccurrenceLeafFact>();
  for (const occurrence of occurrences) {
    if (byOccurrence.has(occurrence.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(source.biome, occurrence.occurrenceId))} has duplicate authored occurrence facts`,
      );
    }
    byOccurrence.set(occurrence.occurrenceId, occurrence);
    for (const leaf of occurrence.leaves) {
      const key = semanticAddressKey(leaf.address);
      if (leavesByAddress.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has duplicate authored occurrence leaf facts`,
        );
      }
      leavesByAddress.set(key, leaf);
    }
  }
  return Object.freeze({
    biome: source.biome,
    occurrences,
    leafLifecycle: (address: SemanticAddress) =>
      leavesByAddress.get(semanticAddressKey(address))?.lifecycle ?? 'absent',
    leafSurface: (address: SemanticAddress) =>
      leavesByAddress.get(semanticAddressKey(address))?.surface ?? 'absent',
    occurrence: (occurrenceId: OccurrenceId) => byOccurrence.get(occurrenceId),
  });
}
