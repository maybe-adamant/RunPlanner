import {
  createExitDecisionAddress,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  fixedWidthOneTakeoverForLayout,
  fixedWidthOneTakeoverTransitionForSource,
  semanticAddressKey,
  type ExitDecision,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { evaluateBiomeCompleteness } from '@run-planner/engine/simulation';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceTakeoverReplacementImpact,
  type WorkspaceTopologyRemovalInteraction,
} from '../contract';
import {
  workspaceTakeoverInteractionRequirementKey,
  type WorkspaceFrontierInteractionRequirement,
  type WorkspaceStartInteractionRequirement,
  type WorkspaceTakeoverInteractionRequirement,
  type WorkspaceTopologyRemovalInteractionRequirement,
} from '../interactions/interaction-requirements';
import { workspaceRoomTakesOverNormalDoors } from './room-policy';
import type { WorkspaceBiomeSource } from '../source-index';
import {
  workspaceDeclaredPhysicalExitKeys,
  workspaceRemovalScopeForRoots,
  workspaceTopologyRemovalScope,
} from './topology-presentation';

/**
 * All topology-owned workspace products for one biome. It intentionally keeps
 * command requirements separate from decision and Hub presentation assembly.
 */
export interface WorkspaceTopologyInteractionAssembly {
  readonly frontierInteractionRequirements: readonly WorkspaceFrontierInteractionRequirement[];
  readonly startInteractionRequirements: readonly WorkspaceStartInteractionRequirement[];
  readonly takeoverInteractionRequirements: readonly WorkspaceTakeoverInteractionRequirement[];
  readonly topologyRemovalInteractionRequirements: readonly WorkspaceTopologyRemovalInteractionRequirement[];
}

/**
 * The topology adapter receives only addressed biome source and catalog facts.
 * It does not receive projection context, candidate services, markers,
 * interaction maps, or rendered nodes.
 */
export interface WorkspaceTopologyInteractionAssemblyInput {
  readonly catalog: Catalog;
  readonly source: WorkspaceBiomeSource;
}

function authoredExitDecisionsByOwner(
  source: WorkspaceBiomeSource,
): ReadonlyMap<string, ExitDecision> {
  const decisions = new Map<string, ExitDecision>();
  for (const decision of source.exitDecisions) {
    const key = semanticAddressKey(createExitDecisionAddress(source.biome, decision.source));
    if (decisions.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple authored exit decisions for workspace assembly`,
      );
    }
    decisions.set(key, decision);
  }
  return decisions;
}

function topologyRemovalInteractionRequirements(
  input: WorkspaceTopologyInteractionAssemblyInput,
): readonly WorkspaceTopologyRemovalInteractionRequirement[] {
  const { biome, plan } = input.source;
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const removals: WorkspaceTopologyRemovalInteraction[] = [
    Object.freeze({
      action: 'clearTopology' as const,
      command: Object.freeze({ kind: 'ClearTopology' as const, biome }),
      impact: workspaceTopologyRemovalScope(biome, describeClearTopologyImpact(topology)),
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
        impact: workspaceTopologyRemovalScope(biome, impact),
        key: semanticAddressKey(owner),
        owner,
      }),
    );
  }
  return Object.freeze([
    Object.freeze({
      kind: 'topologyRemovals' as const,
      owner: biome,
      removals: Object.freeze(removals),
    }),
  ]);
}

function startInteractionRequirements(
  source: WorkspaceBiomeSource,
): readonly WorkspaceStartInteractionRequirement[] {
  const { biome, layout, plan } = source;
  if (plan.topology !== null) return Object.freeze([]);
  if (layout.start.kind === 'fixedAuthored') {
    return Object.freeze([
      Object.freeze({
        kind: 'start' as const,
        owner: biome,
        start: Object.freeze({ gameName: layout.start.roomGameName, kind: 'fixed' as const }),
      }),
    ]);
  }
  const [firstGameName, ...laterGameNames] = layout.start.roomGameNames;
  if (firstGameName === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(biome)} authored-choice start has no declared room`,
    );
  }
  return Object.freeze([
    Object.freeze({
      kind: 'start' as const,
      owner: biome,
      start: Object.freeze({
        gameNames: Object.freeze([firstGameName, ...laterGameNames]) as readonly [
          string,
          ...string[],
        ],
        kind: 'choice' as const,
      }),
    }),
  ]);
}

function takeoverCandidateGameNames(
  catalog: Catalog,
  biomeKey: string,
): readonly [string, ...string[]] | undefined {
  const gameNames = catalog.rooms.values
    .filter((room) => room.biomeKey === biomeKey && workspaceRoomTakesOverNormalDoors(room))
    .map((room) => room.gameName);
  const [firstGameName, ...laterGameNames] = gameNames;
  return firstGameName === undefined
    ? undefined
    : (Object.freeze([firstGameName, ...laterGameNames]) as readonly [string, ...string[]]);
}

function takeoverExistingTargets(
  decision: ExitDecision,
): readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[] {
  if (decision.normal.kind !== 'batch') return Object.freeze([]);
  return Object.freeze(
    decision.normal.targets.map((target) =>
      Object.freeze({ exitKey: target.exitKey, occurrenceId: target.occurrenceId }),
    ),
  );
}

function authoredBatchTakeoverGameName(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
  decision: ExitDecision,
): string | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  const targetRooms = decision.normal.targets.map((target) =>
    source.occurrence(target.occurrenceId),
  );
  const targetDeclarations = targetRooms.map((room) =>
    room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
  );
  return targetDeclarations.length > 0 &&
    targetDeclarations.every(workspaceRoomTakesOverNormalDoors)
    ? targetRooms[0]?.gameName
    : undefined;
}

function declaredTakeoverExitKeys(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
  decisionSource: ExitDecisionSourceAddress,
): readonly string[] | undefined {
  return workspaceDeclaredPhysicalExitKeys(catalog, source.layout, source.plan, decisionSource);
}

function takeoverReplacementImpact(
  source: WorkspaceBiomeSource,
  decision: ExitDecision,
): WorkspaceTakeoverReplacementImpact | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  const replacedOccurrenceIds = new Set(
    decision.normal.targets.map((target) => target.occurrenceId),
  );
  const removal = workspaceRemovalScopeForRoots(source.biome, source.plan, replacedOccurrenceIds);
  if (removal === undefined) return undefined;
  return Object.freeze({
    command: 'ReplaceWithTakeoverBatch',
    owner: createExitDecisionAddress(source.biome, decision.source),
    removedDecisionOwners: removal.removedDecisionOwners,
    removedOccurrenceIds: removal.removedOccurrenceIds,
    replacedOccurrenceIds: Object.freeze(
      source.plan.topology?.occurrences
        .filter((occurrence) => replacedOccurrenceIds.has(occurrence.occurrenceId))
        .map((occurrence) => occurrence.occurrenceId) ?? [],
    ),
  });
}

function takeoverRequirementForOwner(
  requirements: ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement>,
  owner: ExitDecisionAddress,
): WorkspaceTakeoverInteractionRequirement | undefined {
  const key = `takeoverBatch:${semanticAddressKey(owner)}`;
  const requirement = requirements.get(key);
  if (
    requirement !== undefined &&
    semanticAddressKey(requirement.owner) !== semanticAddressKey(owner)
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${key} takeover interaction requirement has a conflicting semantic owner`,
    );
  }
  return requirement;
}

/**
 * Takeover controls are authored topology and declaration-policy facts. Emit
 * the complete family before binding so retained decisions and an incomplete
 * frontier do not depend on a second raw-project traversal in the binder.
 */
function takeoverInteractionRequirements(
  input: WorkspaceTopologyInteractionAssemblyInput,
): readonly WorkspaceTakeoverInteractionRequirement[] {
  const { catalog, source } = input;
  const { biome, layout, plan } = source;
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const requirementsByOwner = new Map<string, WorkspaceTakeoverInteractionRequirement>();
  const add = (requirement: WorkspaceTakeoverInteractionRequirement): void => {
    const key = workspaceTakeoverInteractionRequirementKey(requirement);
    if (requirementsByOwner.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected takeover interaction requirements`,
      );
    }
    requirementsByOwner.set(key, requirement);
  };
  const authoredDecisions = authoredExitDecisionsByOwner(source);
  const candidateGameNames = takeoverCandidateGameNames(catalog, plan.biomeKey);
  const fixedWidthOneTakeover = fixedWidthOneTakeoverForLayout(catalog, layout);
  for (const decision of authoredDecisions.values()) {
    const owner = createExitDecisionAddress(biome, decision.source);
    const existingTargets = takeoverExistingTargets(decision);
    const takeoverGameName = authoredBatchTakeoverGameName(catalog, source, decision);
    if (takeoverGameName !== undefined) {
      const requiredExitKeys = declaredTakeoverExitKeys(catalog, source, decision.source);
      if (requiredExitKeys !== undefined) {
        add(
          Object.freeze({
            action: 'reconcile' as const,
            existingTargets,
            gameName: takeoverGameName,
            kind: 'takeoverBatch' as const,
            owner,
            presentation: 'repair' as const,
            requiredExitKeys,
          }),
        );
      }
      continue;
    }
    if (layout.progression.kind !== 'generated' || fixedWidthOneTakeover !== undefined) continue;
    if (candidateGameNames === undefined) continue;
    const impact =
      decision.normal.kind === 'batch' ? takeoverReplacementImpact(source, decision) : undefined;
    add(
      Object.freeze({
        action: decision.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
        existingTargets,
        gameNames: candidateGameNames,
        ...(impact === undefined ? {} : { impact }),
        kind: 'takeoverBatch' as const,
        owner,
        presentation: 'candidate' as const,
      }),
    );
  }
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete' || completeness.frontier.kind !== 'exitDecision') {
    return Object.freeze([...requirementsByOwner.values()]);
  }
  const owner = completeness.frontier;
  const ownerKey = `takeoverBatch:${semanticAddressKey(owner)}`;
  const existing = authoredDecisions.get(semanticAddressKey(owner));
  const fixedTransition = fixedWidthOneTakeoverTransitionForSource(
    catalog,
    layout,
    topology,
    owner.source,
  );
  const requiredExitKeys =
    fixedTransition === undefined
      ? undefined
      : declaredTakeoverExitKeys(catalog, source, owner.source);
  if (fixedTransition !== undefined && existing === undefined && requiredExitKeys !== undefined) {
    add(
      Object.freeze({
        action: 'create' as const,
        gameName: fixedTransition.room.gameName,
        kind: 'takeoverBatch' as const,
        owner,
        presentation:
          fixedTransition.kind === 'completedHubHandoff'
            ? ('completedHubHandoff' as const)
            : ('fixedWidthOneTakeover' as const),
        requiredExitKeys,
      }),
    );
  } else if (
    layout.progression.kind === 'generated' &&
    fixedWidthOneTakeover === undefined &&
    candidateGameNames !== undefined &&
    !requirementsByOwner.has(ownerKey)
  ) {
    add(
      Object.freeze({
        action: existing?.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
        existingTargets:
          existing?.normal.kind === 'batch' ? takeoverExistingTargets(existing) : Object.freeze([]),
        gameNames: candidateGameNames,
        kind: 'takeoverBatch' as const,
        owner,
        presentation: 'candidate' as const,
      }),
    );
  }
  return Object.freeze([...requirementsByOwner.values()]);
}

/**
 * Frontier capability and structural creation are one presentation contract:
 * an exit capability authorizes the UI lookup of its exact structural or
 * takeover action. Takeover requirements are already assembled from the same
 * authored plan, so this package can advertise a frontier action without
 * re-deriving candidate policy or consulting bound interactions.
 */
function frontierInteractionRequirements(
  input: WorkspaceTopologyInteractionAssemblyInput,
  takeoverRequirements: ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement>,
): readonly WorkspaceFrontierInteractionRequirement[] {
  const { catalog, source } = input;
  const { biome, layout, plan } = source;
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete') return Object.freeze([]);
  switch (completeness.frontier.kind) {
    case 'exitDecision': {
      const owner = completeness.frontier;
      const existing = source.exitDecision(owner.source);
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
      const takeoverRequirement = takeoverRequirementForOwner(takeoverRequirements, owner);
      const takeover = existing === undefined && takeoverRequirement !== undefined;
      if (takeover && takeoverRequirement.action !== 'create') {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(owner)} active frontier takeover must create rather than ${takeoverRequirement.action}`,
        );
      }
      if (structural === undefined && !takeover) return Object.freeze([]);
      return Object.freeze([
        Object.freeze({
          capabilities: Object.freeze({
            ...(structural === undefined ? {} : { structural: structural.action }),
            ...(takeover ? { takeover: true as const } : {}),
          }),
          kind: 'exitFrontier' as const,
          owner,
          ...(structural === undefined ? {} : { structural }),
        }),
      ]);
    }
    case 'hubDecision':
      return Object.freeze([
        Object.freeze({
          kind: 'hubDecisionFrontier' as const,
          owner: completeness.frontier,
          structural: Object.freeze({ action: 'createHubDecision' as const }),
        }),
      ]);
    case 'hubOpenSet':
    case 'hubVisit':
      return Object.freeze([]);
  }
  return Object.freeze([]);
}

export function assembleWorkspaceTopologyInteractions(
  input: WorkspaceTopologyInteractionAssemblyInput,
): WorkspaceTopologyInteractionAssembly {
  const takeover = takeoverInteractionRequirements(input);
  const takeoverByOwner = new Map(
    takeover.map((requirement) => [
      workspaceTakeoverInteractionRequirementKey(requirement),
      requirement,
    ]),
  );
  return Object.freeze({
    frontierInteractionRequirements: frontierInteractionRequirements(input, takeoverByOwner),
    startInteractionRequirements: startInteractionRequirements(input.source),
    takeoverInteractionRequirements: takeover,
    topologyRemovalInteractionRequirements: topologyRemovalInteractionRequirements(input),
  });
}
