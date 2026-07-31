import {
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createTargetAddress,
  declaredPhysicalExits,
  describeExitDecisionRemovalImpact,
  fixedWidthOneTakeoverForLayout,
  fixedWidthOneTakeoverTransitionForSource,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type ExitDecision,
  type ExitDecisionAddress,
  type HubDecision,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { evaluateBiomeCompleteness } from '@run-planner/engine/simulation';

/**
 * Test-only identity of a control whose existence comes from topology or
 * declaration policy. It intentionally says nothing about command payloads,
 * labels, choices, impacts, or candidate domains; focused family and binder
 * tests own those facts.
 */
export type ExpectedWorkspaceStructuralControlKind =
  | 'batchRewardStore'
  | 'exitFrontierCapability'
  | 'exitSelection'
  | 'fieldsCageOutcome'
  | 'hubSlot'
  | 'hubVisit'
  | 'roomPicker'
  | 'start'
  | 'structural'
  | 'takeoverBatch'
  | 'topologyRemoval';

export interface ExpectedWorkspaceStructuralControl {
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
    const key = semanticAddressKey(createExitDecisionAddress(biome, decision.source));
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
  if (decision.normal.kind !== 'batch') return false;
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

function hasTakeoverCandidate(catalog: Catalog, biomeKey: string): boolean {
  return catalog.rooms.values.some(
    (room) => room.biomeKey === biomeKey && takesOverNormalDoors(room),
  );
}

function missingTargetsAreAuthorable(layout: BiomeLayout, decision: ExitDecision): boolean {
  if (decision.normal.kind !== 'batch') return false;
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
  ): void => {
    const identity = `${kind}:${key}`;
    if (controls.has(identity)) throw new Error(`${identity} has multiple expected controls`);
    controls.set(identity, Object.freeze({ key, kind, owner }));
  };
  const topology = plan.topology;
  if (topology === null) {
    add('start', semanticAddressKey(biome), biome);
    return Object.freeze([...controls.values()]);
  }

  const decisions = authoredExitDecisions(plan);
  const decisionsByOwner = authoredDecisionIndex(biome, decisions);
  const fixedWidthOneTakeover = fixedWidthOneTakeoverForLayout(catalog, layout);
  const takeoverCandidates = hasTakeoverCandidate(catalog, plan.biomeKey);
  const takeoverOwners = new Set<string>();
  const addTakeover = (owner: ExitDecisionAddress): void => {
    const key = semanticAddressKey(owner);
    if (takeoverOwners.has(key)) return;
    takeoverOwners.add(key);
    add('takeoverBatch', key, owner);
  };

  add('topologyRemoval', semanticAddressKey(biome), biome);
  if (layout.start.kind === 'authoredChoice') {
    const start = topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === topology.startOccurrenceId,
    );
    if (start === undefined)
      throw new Error(`${topology.startOccurrenceId} authored start is missing`);
    const owner = createOccurrenceAddress(biome, start.occurrenceId);
    add('roomPicker', semanticAddressKey(owner), owner);
  }

  for (const decision of decisions) {
    const owner = createExitDecisionAddress(biome, decision.source);
    const ownerKey = semanticAddressKey(owner);
    if (describeExitDecisionRemovalImpact(topology, decision.source) !== undefined) {
      add('topologyRemoval', ownerKey, owner);
    }
    const takeover =
      decision.normal.kind === 'batch' && batchTakesOverNormalDoors(catalog, plan, decision);
    if (decision.normal.kind === 'batch') {
      if (decision.selection.kind !== 'derived') {
        add(
          'exitSelection',
          semanticAddressKey(createExitSelectionAddress(biome, decision.source)),
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
        add('batchRewardStore', semanticAddressKey(rewardStore), rewardStore);
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
          let firstMissingSeen = false;
          for (const exit of [...physical].sort((left, right) => left.index - right.index)) {
            const target = decision.normal.targets.find(
              (candidate) => candidate.exitKey === exit.exitKey,
            );
            const targetOwner = createTargetAddress(biome, decision.source, exit.exitKey);
            if (target !== undefined) {
              add('roomPicker', semanticAddressKey(targetOwner), targetOwner);
              continue;
            }
            if (
              !firstMissingSeen &&
              !targets.has(exit.exitKey) &&
              missingTargetsAreAuthorable(layout, decision)
            ) {
              add('roomPicker', semanticAddressKey(targetOwner), targetOwner);
            }
            firstMissingSeen = true;
          }
        }
      }
    }
    if (
      !takeover &&
      layout.progression.kind === 'generated' &&
      fixedWidthOneTakeover === undefined &&
      takeoverCandidates
    ) {
      addTakeover(owner);
    }
  }

  if (layout.progression.kind === 'hub') {
    const descriptor = layout.progression;
    const hub = topology.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === descriptor.hubKey,
    );
    if (hub !== undefined) {
      for (const slot of descriptor.slots) {
        const owner = createHubSlotAddress(biome, descriptor.hubKey, slot.slotKey);
        add('hubSlot', semanticAddressKey(owner), owner);
      }
      const visitCount = Math.min(descriptor.requiredVisits, hub.visitOrder.length + 1);
      for (let index = 1; index <= visitCount; index += 1) {
        const owner = createHubVisitAddress(biome, descriptor.hubKey, index);
        add('hubVisit', semanticAddressKey(owner), owner);
      }
    }
  }

  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete') return Object.freeze([...controls.values()]);
  switch (completeness.frontier.kind) {
    case 'exitDecision': {
      const owner = completeness.frontier;
      const ownerKey = semanticAddressKey(owner);
      const existing = decisionsByOwner.get(ownerKey);
      const fixedTransition = fixedWidthOneTakeoverTransitionForSource(
        catalog,
        layout,
        topology,
        owner.source,
      );
      if (
        existing === undefined &&
        fixedTransition !== undefined &&
        declaredPhysicalExits(catalog, layout, topology, owner.source) !== undefined
      ) {
        addTakeover(owner);
      } else if (
        existing === undefined &&
        layout.progression.kind === 'generated' &&
        fixedWidthOneTakeover === undefined &&
        takeoverCandidates
      ) {
        addTakeover(owner);
      }
      const structural =
        existing === undefined &&
        owner.source.kind === 'occurrence' &&
        fixedTransition === undefined;
      const takeover = existing === undefined && takeoverOwners.has(ownerKey);
      if (!structural && !takeover) break;
      add('exitFrontierCapability', ownerKey, owner);
      if (structural) add('structural', ownerKey, owner);
      break;
    }
    case 'hubDecision': {
      const owner = createHubDecisionAddress(biome, completeness.frontier.hubKey);
      add('structural', semanticAddressKey(owner), owner);
      break;
    }
    case 'hubOpenSet':
    case 'hubVisit':
      break;
  }
  return Object.freeze([...controls.values()]);
}
