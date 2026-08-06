import {
  createBatchRewardStoreAddress,
  createAdditionalExitAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createTargetAddress,
  declaredPhysicalExits,
  fixedWidthOneTakeoverTransitionForSource,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  normalDecisionProgressionForLayout,
  selectedExitTarget,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type ExitDecision,
  type ExitDecisionAddress,
  type HubDecision,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { evaluateBiomeCompleteness } from '@run-planner/engine/simulation';

import { workspaceExpectedControlIdentity, workspaceTestOwnerKey } from './test-keys';

/**
 * Test-only identity of a control whose existence comes from topology or
 * declaration policy. It intentionally says nothing about command payloads,
 * labels, choices, impacts, or candidate domains; focused family and binder
 * tests own those facts.
 */
export type ExpectedWorkspaceStructuralControlKind =
  | 'batchRewardStore'
  | 'decisionEntryRoomPicker'
  | 'exitFrontierCapability'
  | 'exitSelection'
  | 'fieldsCageOutcome'
  | 'hubTakeover'
  | 'hubSlot'
  | 'hubVisitOrder'
  | 'roomPicker'
  | 'start'
  | 'structural'
  | 'takeoverBatch'
  | 'topologyRemoval'
  | 'zagreusSpawn';

export interface ExpectedWorkspaceStructuralControl {
  /** Present only when Door 1 embeds a decision-owned takeover option. */
  readonly decisionOwner?: ExitDecisionAddress;
  readonly key: string;
  readonly kind: ExpectedWorkspaceStructuralControlKind;
  readonly owner: SemanticAddress;
}

function requireLayout(catalog: Catalog, biomeKey: string): BiomeLayout {
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (layout === undefined) throw new Error(`catalog has no ${biomeKey} biome layout`);
  return layout;
}

function requireRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`catalog has no ${gameName} room declaration`);
  return room;
}

function takesOverNormalDoors(room: RoomDeclaration): boolean {
  return room.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
}

function authoredExitDecisions(plan: AuthoredBiomePlan): readonly ExitDecision[] {
  return Object.freeze(
    (plan.topology?.decisions ?? []).filter(
      (decision): decision is ExitDecision => decision.kind === 'exit',
    ),
  );
}

function authoredDecisionIndex(
  biome: BiomeAddress,
  decisions: readonly ExitDecision[],
): ReadonlyMap<string, ExitDecision> {
  const byOwner = new Map<string, ExitDecision>();
  for (const decision of decisions) {
    const key = workspaceTestOwnerKey(createExitDecisionAddress(biome, decision.source));
    if (byOwner.has(key)) throw new Error(`${key} has multiple authored exit decisions`);
    byOwner.set(key, decision);
  }
  return byOwner;
}

function batchTakesOverNormalDoors(
  catalog: Catalog,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
): boolean {
  const occurrences = new Map(
    (plan.topology?.occurrences ?? []).map(
      (occurrence) => [occurrence.occurrenceId, occurrence] as const,
    ),
  );
  const rooms = decision.normal.targets.map((target) => {
    const occurrence = occurrences.get(target.occurrenceId);
    if (occurrence === undefined) {
      throw new Error(`${target.occurrenceId} is absent from authored topology`);
    }
    return requireRoom(catalog, occurrence.gameName);
  });
  return rooms.length > 0 && rooms.every(takesOverNormalDoors);
}

function missingTargetsAreAuthorable(layout: BiomeLayout, decision: ExitDecision): boolean {
  if (
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    return false;
  }
  return !(
    layout.progression.kind === 'generated' &&
    layout.progression.batchPolicy.kind === 'fields' &&
    decision.normal.batchState === null
  );
}

/**
 * Independently derive the non-leaf workspace controls from persisted topology
 * and catalog declarations. This helper deliberately never imports workspace
 * assembly, source indexing, marker ownership, presentation, or binding.
 */
export function expectedWorkspaceStructuralControls(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
): readonly ExpectedWorkspaceStructuralControl[] {
  const layout = requireLayout(catalog, plan.biomeKey);
  const controls = new Map<string, ExpectedWorkspaceStructuralControl>();
  const add = (
    kind: ExpectedWorkspaceStructuralControlKind,
    key: string,
    owner: SemanticAddress,
    decisionOwner?: ExitDecisionAddress,
  ): void => {
    const identity = workspaceExpectedControlIdentity(kind, key);
    if (controls.has(identity)) throw new Error(`${identity} has multiple expected controls`);
    controls.set(
      identity,
      Object.freeze({
        ...(decisionOwner === undefined ? {} : { decisionOwner }),
        key,
        kind,
        owner,
      }),
    );
  };
  const topology = plan.topology;
  if (topology === null) {
    add('start', workspaceTestOwnerKey(biome), biome);
    return Object.freeze([...controls.values()]);
  }

  const decisions = authoredExitDecisions(plan);
  const occurrencesById = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence] as const),
  );
  const activeOccurrenceIds = new Set([topology.startOccurrenceId]);
  for (const decision of decisions) {
    const selected = selectedExitTarget(decision);
    if (selected !== undefined) activeOccurrenceIds.add(selected.occurrenceId);
  }
  const decisionsByOwner = authoredDecisionIndex(biome, decisions);
  const takeoverOwners = new Set<string>();
  const addTakeover = (owner: ExitDecisionAddress): void => {
    const key = workspaceTestOwnerKey(owner);
    if (takeoverOwners.has(key)) return;
    takeoverOwners.add(key);
    add('takeoverBatch', key, owner);
  };

  add('topologyRemoval', workspaceTestOwnerKey(biome), biome);
  if (layout.start.kind === 'authoredChoice') {
    const start = topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === topology.startOccurrenceId,
    );
    if (start === undefined)
      throw new Error(`${topology.startOccurrenceId} authored start is missing`);
    const owner = createOccurrenceAddress(biome, start.occurrenceId);
    add('roomPicker', workspaceTestOwnerKey(owner), owner);
  }

  for (const decision of decisions) {
    const owner = createExitDecisionAddress(biome, decision.source);
    const ownerKey = workspaceTestOwnerKey(owner);
    add('topologyRemoval', ownerKey, owner);
    if (decision.source.kind === 'occurrence') {
      const sourceOccurrence = occurrencesById.get(decision.source.occurrenceId);
      const sourceRoom =
        sourceOccurrence === undefined
          ? undefined
          : requireRoom(catalog, sourceOccurrence.gameName);
      const contract = sourceRoom?.additionalExits.find(
        (candidate) => candidate.kind === 'zagreusContract',
      );
      if (
        contract !== undefined &&
        (sourceOccurrence?.additionalExits?.length ?? 0) === 0 &&
        activeOccurrenceIds.has(decision.source.occurrenceId) &&
        sourceOccurrence?.state.kind === 'shop' &&
        sourceOccurrence.state.shop !== undefined
      ) {
        const additional = createAdditionalExitAddress(
          biome,
          decision.source.occurrenceId,
          contract.key,
        );
        add('zagreusSpawn', workspaceTestOwnerKey(additional), additional);
      }
    }
    const takeover = batchTakesOverNormalDoors(catalog, plan, decision);
    if (decision.selection.kind !== 'derived') {
      add(
        'exitSelection',
        workspaceTestOwnerKey(createExitSelectionAddress(biome, decision.source)),
        owner,
      );
    }
    const rewardStorePolicy =
      layout.progression.kind === 'generated' ? layout.progression.rewardStorePolicy : undefined;
    if (
      decision.normal.rewardStore.kind === 'authoredBaseStore' &&
      (!takeover || decision.normal.rewardStore.baseRewardStoreKey !== null) &&
      rewardStorePolicy?.kind === 'authoredBaseStore'
    ) {
      const rewardStore = createBatchRewardStoreAddress(biome, decision.source);
      add('batchRewardStore', workspaceTestOwnerKey(rewardStore), rewardStore);
    }
    if (
      !takeover &&
      layout.progression.kind === 'generated' &&
      layout.progression.batchPolicy.kind === 'fields'
    ) {
      add('fieldsCageOutcome', ownerKey, owner);
    }
    if (takeover) {
      if (declaredPhysicalExits(catalog, layout, topology, decision.source) !== undefined) {
        addTakeover(owner);
      }
    } else if (decision.source.kind === 'occurrence') {
      const physical = declaredPhysicalExits(catalog, layout, topology, decision.source);
      if (physical !== undefined) {
        const targets = new Set(decision.normal.targets.map((target) => target.exitKey));
        const isEmptyNormalDecision =
          normalDecisionProgressionForLayout(layout) !== undefined &&
          decision.normal.targets.length === 0;
        let firstMissingSeen = false;
        for (const exit of [...physical].sort((left, right) => left.index - right.index)) {
          const target = decision.normal.targets.find(
            (candidate) => candidate.exitKey === exit.exitKey,
          );
          const targetOwner = createTargetAddress(biome, decision.source, exit.exitKey);
          if (target !== undefined) {
            add('roomPicker', workspaceTestOwnerKey(targetOwner), targetOwner);
            continue;
          }
          if (!firstMissingSeen && !targets.has(exit.exitKey)) {
            if (isEmptyNormalDecision) {
              add(
                'decisionEntryRoomPicker',
                workspaceTestOwnerKey(targetOwner),
                targetOwner,
                owner,
              );
            } else if (missingTargetsAreAuthorable(layout, decision)) {
              add('roomPicker', workspaceTestOwnerKey(targetOwner), targetOwner);
            }
          }
          firstMissingSeen = true;
        }
      }
    }
    if (
      isExactTerminalTakeoverEnvelope(decision) &&
      hubTerminalTakeoverForSource(catalog, layout, topology, decision.source) !== undefined
    ) {
      add('hubTakeover', ownerKey, owner);
    }
  }

  if (layout.progression.kind === 'hub') {
    const descriptor = layout.progression;
    const hub = topology.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === descriptor.hubKey,
    );
    if (hub !== undefined) {
      const hubOwner = createHubDecisionAddress(biome, descriptor.hubKey);
      add('topologyRemoval', workspaceTestOwnerKey(hubOwner), hubOwner);
      for (const slot of descriptor.slots) {
        const owner = createHubSlotAddress(biome, descriptor.hubKey, slot.slotKey);
        add('hubSlot', workspaceTestOwnerKey(owner), owner);
      }
      // Visit lifecycle markers stay independently reachable through topology
      // closure. One Hub-decision interaction owns every complete order
      // proposal, so this oracle intentionally does not impose a per-position
      // UI interaction shape.
      add('hubVisitOrder', workspaceTestOwnerKey(hubOwner), hubOwner);
    }
  }

  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete') return Object.freeze([...controls.values()]);
  switch (completeness.frontier.kind) {
    case 'exitDecision': {
      const owner = completeness.frontier;
      const ownerKey = workspaceTestOwnerKey(owner);
      const existing = decisionsByOwner.get(ownerKey);
      const fixedTransition = fixedWidthOneTakeoverTransitionForSource(
        catalog,
        layout,
        topology,
        owner.source,
      );
      if (
        existing === undefined &&
        fixedTransition?.kind === 'completedHubHandoff' &&
        declaredPhysicalExits(catalog, layout, topology, owner.source) !== undefined
      ) {
        addTakeover(owner);
      }
      const structural = existing === undefined && owner.source.kind === 'occurrence';
      if (!structural) break;
      add('exitFrontierCapability', ownerKey, owner);
      add('structural', ownerKey, owner);
      break;
    }
    case 'hubDecision':
      break;
    case 'hubOpenSet':
    case 'hubVisit':
      break;
  }
  return Object.freeze([...controls.values()]);
}
