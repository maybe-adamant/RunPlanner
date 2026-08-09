import {
  createExitDecisionAddress,
  createHubDecisionAddress,
  fixedWidthOneTakeoverTransitionForSource,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  semanticAddressKey,
  type ExitDecision,
  type ExitDecisionSourceAddress,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import {
  workspaceTakeoverInteractionRequirementKey,
  type WorkspaceFrontierInteractionRequirement,
  type WorkspaceHubTakeoverInteractionRequirement,
  type WorkspaceStartInteractionRequirement,
  type WorkspaceTakeoverInteractionRequirement,
  type WorkspaceTopologyRemovalInteractionRequirement,
} from '../interactions/interaction-requirements';
import { workspaceRoomTakesOverNormalDoors } from './room-policy';
import type { WorkspaceBiomeSource } from '../source-index';
import { workspaceDeclaredPhysicalExitKeys } from './topology-presentation';

/**
 * All topology-owned workspace products for one biome. It intentionally keeps
 * command requirements separate from decision and Hub presentation assembly.
 */
export interface WorkspaceTopologyInteractionAssembly {
  readonly frontierInteractionRequirements: readonly WorkspaceFrontierInteractionRequirement[];
  readonly hubTakeoverInteractionRequirements: readonly WorkspaceHubTakeoverInteractionRequirement[];
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
  const removals: WorkspaceTopologyRemovalInteractionRequirement['removals'][number][] = [
    Object.freeze({
      command: Object.freeze({ kind: 'ClearTopology' as const, biome }),
      key: semanticAddressKey(biome),
      owner: biome,
    }),
  ];
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      const owner = createHubDecisionAddress(biome, decision.hubKey);
      removals.push(
        Object.freeze({
          command: Object.freeze({ kind: 'RemoveHubDecision' as const, hub: owner }),
          key: semanticAddressKey(owner),
          owner,
        }),
      );
    } else {
      const owner = createExitDecisionAddress(biome, decision.source);
      removals.push(
        Object.freeze({
          command: Object.freeze({ kind: 'RemoveExitDecision' as const, decision: owner }),
          key: semanticAddressKey(owner),
          owner,
        }),
      );
    }
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

/**
 * Topology retains only already-authored takeover repair and the completed-Hub
 * handoff. Generated Preboss selection belongs to the empty decision's Door 1
 * Room control, where the ordinary and takeover candidate families meet.
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
  }
  const completeness = source.completeness;
  if (completeness.completion !== 'incomplete' || completeness.frontier.kind !== 'exitDecision') {
    return Object.freeze([...requirementsByOwner.values()]);
  }
  const owner = completeness.frontier;
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
  if (
    fixedTransition?.kind === 'completedHubHandoff' &&
    existing === undefined &&
    requiredExitKeys !== undefined
  ) {
    add(
      Object.freeze({
        action: 'create' as const,
        gameName: fixedTransition.room.gameName,
        kind: 'takeoverBatch' as const,
        owner,
        presentation: 'completedHubHandoff' as const,
        requiredExitKeys,
      }),
    );
  }
  return Object.freeze([...requirementsByOwner.values()]);
}

/**
 * A persisted exact terminal envelope is enough to publish the Hub action.
 * Candidate support is intentionally loaded later by binding; findings and
 * incomplete evaluation must not erase this authored control.
 */
function hubTakeoverInteractionRequirements(
  input: WorkspaceTopologyInteractionAssemblyInput,
): readonly WorkspaceHubTakeoverInteractionRequirement[] {
  const { catalog, source } = input;
  const { biome, layout, plan } = source;
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const requirements = new Map<string, WorkspaceHubTakeoverInteractionRequirement>();
  for (const decision of topology.decisions) {
    if (decision.kind !== 'exit' || !isExactTerminalTakeoverEnvelope(decision)) continue;
    const terminal = hubTerminalTakeoverForSource(catalog, layout, topology, decision.source);
    if (terminal === undefined) continue;
    const owner = createExitDecisionAddress(biome, decision.source);
    const requirement: WorkspaceHubTakeoverInteractionRequirement = Object.freeze({
      gameName: terminal.room.gameName,
      hub: createHubDecisionAddress(biome, terminal.hubKey),
      kind: 'hubTakeover' as const,
      owner,
    });
    const key = semanticAddressKey(owner);
    if (requirements.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected Hub takeover requirements`,
      );
    }
    requirements.set(key, requirement);
  }
  return Object.freeze([...requirements.values()]);
}

/**
 * A generated frontier exposes one bound continuation: create the next
 * decision envelope. Door 1 then owns the room choice, including any atomic
 * normal-door takeover Preboss selection.
 */
function frontierInteractionRequirements(
  input: WorkspaceTopologyInteractionAssemblyInput,
): readonly WorkspaceFrontierInteractionRequirement[] {
  const { source } = input;
  const { plan } = source;
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const completeness = source.completeness;
  if (completeness.completion !== 'incomplete') return Object.freeze([]);
  switch (completeness.frontier.kind) {
    case 'exitDecision': {
      const owner = completeness.frontier;
      const existing = source.exitDecision(owner.source);
      const structural =
        existing === undefined && owner.source.kind === 'occurrence'
          ? Object.freeze({ action: 'createBatch' as const })
          : undefined;
      if (structural === undefined) return Object.freeze([]);
      return Object.freeze([
        Object.freeze({
          capabilities: Object.freeze({ structural: structural.action }),
          kind: 'exitFrontier' as const,
          owner,
          structural,
        }),
      ]);
    }
    case 'hubDecision':
      return Object.freeze([]);
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
  return Object.freeze({
    frontierInteractionRequirements: frontierInteractionRequirements(input),
    hubTakeoverInteractionRequirements: hubTakeoverInteractionRequirements(input),
    startInteractionRequirements: startInteractionRequirements(input.source),
    takeoverInteractionRequirements: takeover,
    topologyRemovalInteractionRequirements: topologyRemovalInteractionRequirements(input),
  });
}
