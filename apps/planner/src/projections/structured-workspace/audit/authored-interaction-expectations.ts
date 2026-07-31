import {
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeHubSlotClosureImpact,
  describeTopologyRemovalImpact,
  fixedWidthOneTakeoverForLayout,
  fixedWidthOneTakeoverTransitionForSource,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type ExitDecision,
  type ExitDecisionAddress,
  type HubDecision,
  type HubDecisionAddress,
  type HubSlotAddress,
  type HubVisitAddress,
  type OccurrenceId,
  type TopologyRemovalImpact,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { evaluateBiomeCompleteness } from '@run-planner/engine/simulation';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceExitFrontierCapabilities,
  type WorkspaceHubSlotInteraction,
  type WorkspaceTakeoverReplacementImpact,
  type WorkspaceTopologyRemovalInteraction,
  type WorkspaceTopologyRemovalScope,
} from '../contract';
import type {
  WorkspaceExitFrontierStructuralRequirement,
  WorkspaceStartInteractionRequirement,
} from '../interaction-requirements';

function requireExpectedRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
}

function expectedRoomTakesOverNormalDoors(room: RoomDeclaration | undefined): boolean {
  return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
}

function expectedTopologyRemovalScope(
  biome: BiomeAddress,
  impact: TopologyRemovalImpact,
): WorkspaceTopologyRemovalScope {
  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedHubDecisionKeys: impact.removedHubDecisionKeys,
    removedOccurrenceIds: impact.removedOccurrenceIds,
  });
}

function expectedRemovalScopeForRoots(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  roots: ReadonlySet<OccurrenceId>,
):
  | {
      readonly removedDecisionOwners: readonly ExitDecisionAddress[];
      readonly removedOccurrenceIds: readonly OccurrenceId[];
    }
  | undefined {
  const topology = plan.topology;
  if (topology === null || roots.size === 0) return undefined;
  const impact = describeTopologyRemovalImpact(topology, roots);
  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedOccurrenceIds: impact.removedOccurrenceIds,
  });
}

export interface WorkspaceExpectedBatchInteractionRequirement {
  readonly exitSelection?: {
    readonly key: string;
    readonly owner: ExitDecisionAddress;
  };
  readonly fieldsCageOutcome?: {
    readonly key: string;
    readonly owner: ExitDecisionAddress;
  };
  readonly owner: ExitDecisionAddress;
  readonly rewardStore?: {
    readonly key: string;
    readonly owner: BatchRewardStoreAddress;
  };
}

/**
 * Independently enumerate batch-control owners from authored topology and
 * declaration policy. This makes a missing package observable before binding
 * or rendered-node closure can merely report its missing interaction.
 */
export function expectedBatchInteractionRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedBatchInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence] as const),
  );
  const expected = new Map<string, WorkspaceExpectedBatchInteractionRequirement>();
  for (const decision of topology.decisions) {
    if (decision.kind !== 'exit' || decision.normal.kind !== 'batch') continue;
    const owner = createExitDecisionAddress(biome, decision.source);
    const targetDeclarations = decision.normal.targets.map((target) => {
      const occurrence = occurrences.get(target.occurrenceId);
      return occurrence === undefined
        ? undefined
        : requireExpectedRoom(catalog, occurrence.gameName);
    });
    const takeover =
      targetDeclarations.length > 0 && targetDeclarations.every(expectedRoomTakesOverNormalDoors);
    const selection =
      decision.selection.kind === 'derived'
        ? undefined
        : Object.freeze({
            key: semanticAddressKey(createExitSelectionAddress(biome, decision.source)),
            owner,
          });
    const authoredRewardStore =
      decision.normal.rewardStore.kind === 'authoredBaseStore'
        ? decision.normal.rewardStore
        : undefined;
    const policy =
      layout.progression.kind === 'generated' ? layout.progression.rewardStorePolicy : undefined;
    const rewardStore =
      authoredRewardStore !== undefined &&
      (!takeover || authoredRewardStore.baseRewardStoreKey !== null) &&
      policy?.kind === 'authoredBaseStore'
        ? (() => {
            const address = createBatchRewardStoreAddress(biome, decision.source);
            return Object.freeze({ key: semanticAddressKey(address), owner: address });
          })()
        : undefined;
    const fieldsCageOutcome =
      !takeover &&
      layout.progression.kind === 'generated' &&
      layout.progression.batchPolicy.kind === 'fields'
        ? Object.freeze({ key: semanticAddressKey(owner), owner })
        : undefined;
    if (selection === undefined && rewardStore === undefined && fieldsCageOutcome === undefined) {
      continue;
    }
    const requirement = Object.freeze({
      ...(selection === undefined ? {} : { exitSelection: selection }),
      ...(fieldsCageOutcome === undefined ? {} : { fieldsCageOutcome }),
      owner,
      ...(rewardStore === undefined ? {} : { rewardStore }),
    });
    const key = `batchControls:${semanticAddressKey(owner)}`;
    if (expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored batch interaction packages`,
      );
    }
    expected.set(key, requirement);
  }
  return expected;
}

export interface WorkspaceExpectedHubInteractionRequirement {
  readonly owner: HubDecisionAddress;
  readonly slots: readonly {
    readonly close?: NonNullable<WorkspaceHubSlotInteraction['close']>;
    readonly openedOccurrenceId?: OccurrenceId;
    readonly owner: HubSlotAddress;
    readonly roomGameName: string;
    readonly selected: boolean;
  }[];
  readonly visits: readonly {
    readonly choices: readonly string[];
    readonly owner: HubVisitAddress;
    readonly selectedHubSlotKey?: string;
  }[];
}

export function expectedHubInteractionRequirements(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedHubInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null || layout.progression.kind !== 'hub') return new Map();
  const descriptor = layout.progression;
  const authoredHubs = topology.decisions.filter(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' && decision.hubKey === descriptor.hubKey,
  );
  if (authoredHubs.length === 0) return new Map();
  if (authoredHubs.length > 1) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(createHubDecisionAddress(biome, descriptor.hubKey))} has multiple authored Hub boards`,
    );
  }
  const hub = authoredHubs[0]!;
  const owner = createHubDecisionAddress(biome, descriptor.hubKey);
  const slots = Object.freeze(
    descriptor.slots.map((slot) => {
      const opened = hub.openTargets.find((target) => target.hubSlotKey === slot.slotKey);
      const address = createHubSlotAddress(biome, descriptor.hubKey, slot.slotKey);
      const closeImpact =
        opened === undefined
          ? undefined
          : describeHubSlotClosureImpact(
              topology,
              descriptor.hubKey,
              slot.slotKey,
              descriptor.openCount.min,
            );
      return Object.freeze({
        ...(closeImpact === undefined
          ? {}
          : {
              close: Object.freeze({
                command: Object.freeze({ kind: 'CloseHubSlot' as const, slot: address }),
                impact: expectedTopologyRemovalScope(biome, closeImpact),
              }),
            }),
        ...(opened === undefined ? {} : { openedOccurrenceId: opened.occurrenceId }),
        owner: address,
        roomGameName: slot.roomGameName,
        selected: opened !== undefined,
      });
    }),
  );
  const openSlots = Object.freeze(
    descriptor.slots.filter((slot) =>
      hub.openTargets.some((target) => target.hubSlotKey === slot.slotKey),
    ),
  );
  const visits = Object.freeze(
    Array.from(
      { length: Math.min(descriptor.requiredVisits, hub.visitOrder.length + 1) },
      (_, index) => {
        const selectedHubSlotKey = hub.visitOrder[index];
        return Object.freeze({
          choices: Object.freeze(
            openSlots
              .filter(
                (slot) =>
                  slot.slotKey === selectedHubSlotKey || !hub.visitOrder.includes(slot.slotKey),
              )
              .map((slot) => slot.slotKey),
          ),
          owner: createHubVisitAddress(biome, descriptor.hubKey, index + 1),
          ...(selectedHubSlotKey === undefined ? {} : { selectedHubSlotKey }),
        });
      },
    ),
  );
  const key = `hubControls:${semanticAddressKey(owner)}`;
  return new Map([[key, Object.freeze({ owner, slots, visits })]]);
}

export interface WorkspaceExpectedTopologyRemovalInteractionRequirement {
  readonly owner: BiomeAddress;
  readonly removals: readonly WorkspaceTopologyRemovalInteraction[];
}

/**
 * Independently enumerate generic removal controls from persisted topology.
 * This does not rely on projected nodes, so blocked and disconnected suffixes
 * cannot silently lose their semantic removal owner.
 */
export function expectedTopologyRemovalInteractionRequirements(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedTopologyRemovalInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const removals: WorkspaceTopologyRemovalInteraction[] = [
    Object.freeze({
      action: 'clearTopology' as const,
      command: Object.freeze({ kind: 'ClearTopology' as const, biome }),
      impact: expectedTopologyRemovalScope(biome, describeClearTopologyImpact(topology)),
      key: semanticAddressKey(biome),
      owner: biome,
    }),
  ];
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') continue;
    const owner = createExitDecisionAddress(biome, decision.source);
    const impact = describeExitDecisionRemovalImpact(topology, decision.source);
    if (impact === undefined) continue;
    removals.push(
      Object.freeze({
        action: 'removeExitDecision' as const,
        command: Object.freeze({ kind: 'RemoveExitDecision' as const, decision: owner }),
        impact: expectedTopologyRemovalScope(biome, impact),
        key: semanticAddressKey(owner),
        owner,
      }),
    );
  }
  const key = `topologyRemovals:${semanticAddressKey(biome)}`;
  return new Map([[key, Object.freeze({ owner: biome, removals: Object.freeze(removals) })]]);
}

export interface WorkspaceExpectedStartInteractionRequirement {
  readonly owner: BiomeAddress;
  readonly start: WorkspaceStartInteractionRequirement['start'];
}

/** Independently enumerate start policy from the persisted topology and layout. */
export function expectedStartInteractionRequirements(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedStartInteractionRequirement> {
  if (plan.topology !== null) return new Map();
  const start =
    layout.start.kind === 'fixedAuthored'
      ? Object.freeze({ gameName: layout.start.roomGameName, kind: 'fixed' as const })
      : Object.freeze({
          gameNames: Object.freeze([...layout.start.roomGameNames]) as readonly [
            string,
            ...string[],
          ],
          kind: 'choice' as const,
        });
  const key = `start:${semanticAddressKey(biome)}`;
  return new Map([[key, Object.freeze({ owner: biome, start })]]);
}

export type WorkspaceExpectedTakeoverInteractionRequirement =
  | {
      readonly action: 'create' | 'replace';
      readonly existingTargets: readonly {
        readonly exitKey: string;
        readonly occurrenceId: OccurrenceId;
      }[];
      readonly gameNames: readonly string[];
      readonly impact?: WorkspaceTakeoverReplacementImpact;
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'candidate';
    }
  | {
      readonly action: 'reconcile';
      readonly existingTargets: readonly {
        readonly exitKey: string;
        readonly occurrenceId: OccurrenceId;
      }[];
      readonly gameName: string;
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'repair';
      readonly requiredExitKeys: readonly string[];
    }
  | {
      readonly action: 'create';
      readonly gameName: string;
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'fixedWidthOneTakeover' | 'completedHubHandoff';
      readonly requiredExitKeys: readonly string[];
    };

/** Independent expected-side derivation; it never consumes assembly output. */
function expectedTakeoverReplacementImpact(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
): WorkspaceTakeoverReplacementImpact | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  const replacedOccurrenceIds = new Set(
    decision.normal.targets.map((target) => target.occurrenceId),
  );
  const removal = expectedRemovalScopeForRoots(biome, plan, replacedOccurrenceIds);
  if (removal === undefined) return undefined;
  return Object.freeze({
    command: 'ReplaceWithTakeoverBatch',
    owner: createExitDecisionAddress(biome, decision.source),
    removedDecisionOwners: removal.removedDecisionOwners,
    removedOccurrenceIds: removal.removedOccurrenceIds,
    replacedOccurrenceIds: Object.freeze(
      plan.topology?.occurrences
        .filter((occurrence) => replacedOccurrenceIds.has(occurrence.occurrenceId))
        .map((occurrence) => occurrence.occurrenceId) ?? [],
    ),
  });
}

/**
 * Independently enumerate takeover controls from persisted topology,
 * declaration policy, and structural completeness. This must not use
 * projected workbenches, interaction requirements, or evaluation coverage.
 */
export function expectedTakeoverInteractionRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedTakeoverInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const expected = new Map<string, WorkspaceExpectedTakeoverInteractionRequirement>();
  const add = (requirement: WorkspaceExpectedTakeoverInteractionRequirement): void => {
    const key = `takeoverBatch:${semanticAddressKey(requirement.owner)}`;
    if (expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored takeover interaction requirements`,
      );
    }
    expected.set(key, requirement);
  };
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence] as const),
  );
  const authoredDecisions = new Map<string, ExitDecision>();
  for (const decision of topology.decisions) {
    if (decision.kind !== 'exit') continue;
    const key = semanticAddressKey(createExitDecisionAddress(biome, decision.source));
    if (authoredDecisions.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored takeover decision owners`,
      );
    }
    authoredDecisions.set(key, decision);
  }
  const candidateGameNames = catalog.rooms.values
    .filter((room) => room.biomeKey === plan.biomeKey && expectedRoomTakesOverNormalDoors(room))
    .map((room) => room.gameName);
  const fixedWidthOneTakeover = fixedWidthOneTakeoverForLayout(catalog, layout);
  for (const decision of authoredDecisions.values()) {
    const owner = createExitDecisionAddress(biome, decision.source);
    const existingTargets =
      decision.normal.kind === 'batch'
        ? Object.freeze(
            decision.normal.targets.map((target) =>
              Object.freeze({ exitKey: target.exitKey, occurrenceId: target.occurrenceId }),
            ),
          )
        : Object.freeze([]);
    const targetRooms =
      decision.normal.kind === 'batch'
        ? decision.normal.targets.map((target) => occurrences.get(target.occurrenceId))
        : Object.freeze([]);
    const targetDeclarations = targetRooms.map((room) =>
      room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
    );
    const takeoverGameName =
      targetDeclarations.length > 0 && targetDeclarations.every(expectedRoomTakesOverNormalDoors)
        ? targetRooms[0]?.gameName
        : undefined;
    if (takeoverGameName !== undefined) {
      const exits = resolveDeclaredPhysicalExits(catalog, layout, topology, decision.source);
      if (exits !== undefined) {
        add(
          Object.freeze({
            action: 'reconcile' as const,
            existingTargets,
            gameName: takeoverGameName,
            owner,
            presentation: 'repair' as const,
            requiredExitKeys: Object.freeze(exits.map((exit) => exit.exitKey)),
          }),
        );
      }
      continue;
    }
    if (
      layout.progression.kind !== 'generated' ||
      fixedWidthOneTakeover !== undefined ||
      candidateGameNames.length === 0
    ) {
      continue;
    }
    const impact =
      decision.normal.kind === 'batch'
        ? expectedTakeoverReplacementImpact(biome, plan, decision)
        : undefined;
    add(
      Object.freeze({
        action: decision.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
        existingTargets,
        gameNames: Object.freeze([...candidateGameNames]),
        ...(impact === undefined ? {} : { impact }),
        owner,
        presentation: 'candidate' as const,
      }),
    );
  }
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete' || completeness.frontier.kind !== 'exitDecision') {
    return expected;
  }
  const owner = completeness.frontier;
  const existing = authoredDecisions.get(semanticAddressKey(owner));
  const fixedTransition = fixedWidthOneTakeoverTransitionForSource(
    catalog,
    layout,
    topology,
    owner.source,
  );
  const requiredExits =
    fixedTransition === undefined
      ? undefined
      : resolveDeclaredPhysicalExits(catalog, layout, topology, owner.source);
  if (fixedTransition !== undefined && existing === undefined && requiredExits !== undefined) {
    add(
      Object.freeze({
        action: 'create' as const,
        gameName: fixedTransition.room.gameName,
        owner,
        presentation:
          fixedTransition.kind === 'completedHubHandoff'
            ? ('completedHubHandoff' as const)
            : ('fixedWidthOneTakeover' as const),
        requiredExitKeys: Object.freeze(requiredExits.map((exit) => exit.exitKey)),
      }),
    );
  } else if (
    layout.progression.kind === 'generated' &&
    fixedWidthOneTakeover === undefined &&
    candidateGameNames.length > 0 &&
    !expected.has(`takeoverBatch:${semanticAddressKey(owner)}`)
  ) {
    const existingTargets =
      existing?.normal.kind === 'batch'
        ? Object.freeze(
            existing.normal.targets.map((target) =>
              Object.freeze({ exitKey: target.exitKey, occurrenceId: target.occurrenceId }),
            ),
          )
        : Object.freeze([]);
    add(
      Object.freeze({
        action: existing?.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
        existingTargets,
        gameNames: Object.freeze([...candidateGameNames]),
        owner,
        presentation: 'candidate' as const,
      }),
    );
  }
  return expected;
}

export type WorkspaceExpectedFrontierInteractionRequirement =
  | {
      readonly capabilities: WorkspaceExitFrontierCapabilities;
      readonly kind: 'exitFrontier';
      readonly owner: ExitDecisionAddress;
      readonly structural?: WorkspaceExitFrontierStructuralRequirement;
    }
  | {
      readonly kind: 'hubDecisionFrontier';
      readonly owner: HubDecisionAddress;
      readonly structural: { readonly action: 'createHubDecision' };
    };

/**
 * Independently enumerate structural frontier packages from persisted
 * topology, completeness, and layout policy. This intentionally does not
 * inspect a projected frontier, another requirement collection, source-index
 * lookup, or bound interaction map: omission of the frontier package itself
 * must remain observable.
 */
export function expectedFrontierInteractionRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedFrontierInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const expected = new Map<string, WorkspaceExpectedFrontierInteractionRequirement>();
  const add = (requirement: WorkspaceExpectedFrontierInteractionRequirement): void => {
    const key = `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
    if (expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected frontier interaction requirements`,
      );
    }
    expected.set(key, requirement);
  };
  const authoredDecisions = new Map<string, ExitDecision>();
  for (const decision of topology.decisions) {
    if (decision.kind !== 'exit') continue;
    const key = semanticAddressKey(createExitDecisionAddress(biome, decision.source));
    if (authoredDecisions.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored frontier decision owners`,
      );
    }
    authoredDecisions.set(key, decision);
  }
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete') return expected;
  switch (completeness.frontier.kind) {
    case 'exitDecision': {
      const owner = completeness.frontier;
      const existing = authoredDecisions.get(semanticAddressKey(owner));
      const fixedTransition = fixedWidthOneTakeoverTransitionForSource(
        catalog,
        layout,
        topology,
        owner.source,
      );
      const structural =
        existing === undefined &&
        owner.source.kind === 'occurrence' &&
        fixedTransition === undefined
          ? layout.progression.kind === 'hub' &&
            owner.source.occurrenceId === topology.startOccurrenceId
            ? Object.freeze({
                action: 'createLinkedExit' as const,
                targetGameName: layout.progression.linkedExit.roomGameName,
              })
            : Object.freeze({ action: 'createBatch' as const })
          : undefined;
      const fixedExits =
        fixedTransition === undefined
          ? undefined
          : resolveDeclaredPhysicalExits(catalog, layout, topology, owner.source);
      const candidateGameNames = catalog.rooms.values
        .filter((room) => room.biomeKey === plan.biomeKey && expectedRoomTakesOverNormalDoors(room))
        .map((room) => room.gameName);
      const takeover =
        existing === undefined &&
        ((fixedTransition !== undefined && fixedExits !== undefined) ||
          (fixedTransition === undefined &&
            layout.progression.kind === 'generated' &&
            fixedWidthOneTakeoverForLayout(catalog, layout) === undefined &&
            candidateGameNames.length > 0));
      if (structural === undefined && !takeover) return expected;
      add(
        Object.freeze({
          capabilities: Object.freeze({
            ...(structural === undefined ? {} : { structural: structural.action }),
            ...(takeover ? { takeover: true as const } : {}),
          }),
          kind: 'exitFrontier' as const,
          owner,
          ...(structural === undefined ? {} : { structural }),
        }),
      );
      return expected;
    }
    case 'hubDecision':
      add(
        Object.freeze({
          kind: 'hubDecisionFrontier' as const,
          owner: completeness.frontier,
          structural: Object.freeze({ action: 'createHubDecision' as const }),
        }),
      );
      return expected;
    case 'hubOpenSet':
    case 'hubVisit':
      return expected;
  }
  return expected;
}
