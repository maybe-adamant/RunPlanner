import {
  createBiomeFieldAddress,
  createCompletionRoomAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type ExitDecision,
  type OccurrenceAddress,
  type RoomOccurrence,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredFieldDescriptor,
  BiomeLayout,
  Catalog,
} from '@run-planner/engine/catalog-schema';
import type { ProjectBiomeEvaluation } from '@run-planner/engine/simulation';
import { evaluateBiomeCompleteness } from '@run-planner/engine/simulation';

import {
  appendUniqueRewardControls,
  appendUniqueRoomControls,
  appendUniqueWorkspaceNodes,
} from './assembly-products';
import { requireWorkspaceRoom } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceAuthoringFrontier,
  type WorkspaceAssessment,
  type WorkspaceBiomeField,
  type WorkspaceCompletionNode,
  type WorkspaceInspectorDestination,
  type WorkspaceMarker,
  type WorkspaceNode,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceProjectionSource,
  type WorkspaceRewardControl,
  type WorkspaceRoomPickerControl,
  type WorkspaceStatus,
} from './contract';
import {
  assembleWorkspaceDecision,
  type WorkspaceAuthoredBatchDecision,
  type WorkspaceAuthoredLinkedExitDecision,
  type WorkspaceDecisionAssembly,
} from './decision-assembly';
import { assembleWorkspaceHub } from './hub-assembly';
import {
  appendUniqueBatchInteractionRequirements,
  appendUniqueFrontierInteractionRequirements,
  appendUniqueHubInteractionRequirements,
  appendUniqueOccurrenceInteractionRequirements,
  appendUniqueStartInteractionRequirements,
  appendUniqueTakeoverInteractionRequirements,
  appendUniqueTopologyRemovalInteractionRequirements,
  type WorkspaceBatchInteractionRequirement,
  type WorkspaceFrontierInteractionRequirement,
  type WorkspaceHubInteractionRequirement,
  type WorkspaceOccurrenceInteractionRequirement,
  type WorkspaceStartInteractionRequirement,
  type WorkspaceTakeoverInteractionRequirement,
  type WorkspaceTopologyRemovalInteractionRequirement,
} from './interaction-requirements';
import {
  createWorkspaceBiomeMarkerDestinationBuilder,
  type WorkspaceMarkerDestinationEmitter,
} from './marker-builder';
import {
  assembleWorkspaceOccurrence,
  type WorkspaceOccurrenceAssembler,
} from './occurrence-assembly';
import {
  createWorkspaceBiomeOccurrenceAssemblyFacts,
  type WorkspaceBiomeOccurrenceAssemblyFacts,
  type WorkspaceOccurrenceAssemblyFact,
} from './occurrence-facts';
import { createWorkspaceFieldsActiveCageCounts } from './fields-cage-counts';
import type { WorkspaceDecisionBatchNode } from './marker-ownership';
import type { WorkspaceBiomeSource } from './source-index';
import { assembleWorkspaceTopologyInteractions } from './topology-interaction-assembly';

/**
 * Complete semantic product for one biome. It is produced before audits,
 * interaction binding, rails, default-inspector selection, and destination
 * presentation binding. The private marker builder is never returned.
 */
export interface WorkspaceBiomeSemanticAssembly {
  readonly biome: BiomeAddress;
  readonly biomeKey: string;
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly completion: readonly WorkspaceCompletionNode[];
  readonly completionOutline: readonly WorkspaceCompletionNode[];
  readonly entry?: WorkspaceOccurrenceWorkbenchNode;
  readonly fields: readonly WorkspaceBiomeField[];
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly frontierInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceFrontierInteractionRequirement
  >;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly nodes: readonly WorkspaceNode[];
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly preliminaryFocusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
  /** Presentation needs only this declared rail policy, never the full layout. */
  readonly progressionKind: BiomeLayout['progression']['kind'];
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly source: WorkspaceProjectionSource;
  readonly startInteractionRequirements: ReadonlyMap<string, WorkspaceStartInteractionRequirement>;
  readonly status: WorkspaceStatus;
  readonly structuralNodes: readonly WorkspaceNode[];
  readonly takeoverInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTakeoverInteractionRequirement
  >;
  readonly topologyRemovalInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTopologyRemovalInteractionRequirement
  >;
}

function statusFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceStatus {
  if (evaluation === undefined) return 'blocked';
  if (evaluation.authoring === 'incomplete') return 'incomplete';
  return evaluation.validity;
}

function sourceFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceProjectionSource {
  if (evaluation === undefined) return 'authored';
  return evaluation.authoring === 'complete' ? 'canonical' : 'progressive';
}

function assessmentForSource(
  source: WorkspaceBiomeSource,
  address: SemanticAddress,
): WorkspaceAssessment {
  const { evaluation } = source;
  if (evaluation === undefined) return 'blocked';
  if (evaluation.coverage.kind === 'none') return 'unassessed';
  if (evaluation.coverage.kind === 'complete') return 'assessed';
  return source.isAssessed(address) || source.findingsFor(address).length > 0
    ? 'assessed'
    : 'unassessed';
}

function biomeFieldLabel(field: AuthoredFieldDescriptor): string {
  switch (field.key) {
    case 'maxNonGoalRewards':
      return 'Rolled non-goal limit';
    default:
      return field.key;
  }
}

function projectBiomeFields(
  biome: BiomeAddress,
  marker: WorkspaceMarkerDestinationEmitter,
  plan: AuthoredBiomePlan,
  layout: BiomeLayout,
): readonly WorkspaceBiomeField[] {
  return Object.freeze(
    layout.fields.map((field) => {
      const address = createBiomeFieldAddress(biome, field.key);
      const value = plan.state[field.key] ?? null;
      const base = {
        address,
        key: field.key,
        label: biomeFieldLabel(field),
        marker: marker.marker(address),
      };
      switch (field.kind) {
        case 'boolean':
          if (value !== null && typeof value !== 'boolean') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not boolean`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'boolean' as const,
            value,
            values: Object.freeze([false, true]),
          });
        case 'boundedInteger':
          if (value !== null && typeof value !== 'number') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not numeric`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'boundedInteger' as const,
            value,
            values: Object.freeze(
              Array.from({ length: field.max - field.min + 1 }, (_, index) => field.min + index),
            ),
          });
        case 'enum':
          if (value !== null && typeof value !== 'string') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not an enum value`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'enum' as const,
            value,
            values: field.values,
          });
      }
    }),
  );
}

function requireOccurrenceAssemblyFacts(
  biome: BiomeAddress,
  factsByOccurrence: WorkspaceBiomeOccurrenceAssemblyFacts,
  occurrence: RoomOccurrence,
): WorkspaceOccurrenceAssemblyFact {
  const facts = factsByOccurrence.occurrence(occurrence.occurrenceId);
  if (facts === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(createOccurrenceAddress(biome, occurrence.occurrenceId))} has no authored occurrence assembly facts`,
    );
  }
  return facts;
}

function authoringFrontier(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
  marker: WorkspaceMarkerDestinationEmitter,
): WorkspaceAuthoringFrontier | null {
  const { biome, plan } = source;
  if (plan.topology === null) {
    return Object.freeze({
      kind: 'start' as const,
      interactionKey: semanticAddressKey(biome),
      marker: marker.marker(biome),
      owner: biome,
    });
  }
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion === 'complete') return null;
  const frontier = completeness.frontier;
  switch (frontier.kind) {
    case 'exitDecision': {
      const predecessorNodeKey =
        frontier.source.kind === 'occurrence'
          ? `occurrence:${semanticAddressKey(
              createOccurrenceAddress(biome, frontier.source.occurrenceId),
            )}`
          : undefined;
      return Object.freeze({
        kind: 'exitDecision' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker.marker(frontier),
        owner: frontier,
        ...(predecessorNodeKey === undefined ? {} : { predecessorNodeKey }),
      });
    }
    case 'hubDecision':
      return Object.freeze({
        kind: 'hubDecision' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker.marker(frontier),
        owner: frontier,
      });
    case 'hubVisit':
      return Object.freeze({
        kind: 'hubVisit' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker.marker(frontier),
        owner: frontier,
      });
    case 'hubOpenSet':
      return Object.freeze({
        kind: 'hubOpenSet' as const,
        marker: marker.marker(frontier),
        owner: frontier,
      });
    default:
      return null;
  }
}

function startRoomControl(
  address: OccurrenceAddress,
  candidateGameNames: readonly string[],
  selectedGameName: string,
): WorkspaceRoomPickerControl {
  return Object.freeze({
    address,
    candidateGameNames: Object.freeze([...candidateGameNames]),
    kind: 'startRoomPicker' as const,
    selectedGameName,
  });
}

function appendDecisionAssembly(
  assembly: WorkspaceDecisionAssembly,
  nodes: WorkspaceNode[],
  batchInteractionRequirements: Map<string, WorkspaceBatchInteractionRequirement>,
  occurrenceInteractionRequirements: Map<string, WorkspaceOccurrenceInteractionRequirement>,
  roomControls: Map<string, WorkspaceRoomPickerControl>,
  rewardControls: Map<string, WorkspaceRewardControl>,
): void {
  if (assembly.kind === 'linkedExit') {
    appendUniqueOccurrenceInteractionRequirements(
      occurrenceInteractionRequirements,
      assembly.occurrenceInteractionRequirements,
    );
    appendUniqueRoomControls(roomControls, assembly.roomControls);
    appendUniqueRewardControls(rewardControls, assembly.rewardControls);
    appendUniqueWorkspaceNodes(nodes, [assembly.node, assembly.workbench]);
    return;
  }
  appendUniqueBatchInteractionRequirements(
    batchInteractionRequirements,
    assembly.batchInteractionRequirements,
  );
  appendUniqueOccurrenceInteractionRequirements(
    occurrenceInteractionRequirements,
    assembly.occurrenceInteractionRequirements,
  );
  appendUniqueRoomControls(roomControls, assembly.roomControls);
  appendUniqueRewardControls(rewardControls, assembly.rewardControls);
  appendUniqueWorkspaceNodes(nodes, [assembly.batch, ...assembly.workbenches]);
}

function appendHubAssembly(
  assembly: ReturnType<typeof assembleWorkspaceHub>,
  nodes: WorkspaceNode[],
  hubInteractionRequirements: Map<string, WorkspaceHubInteractionRequirement>,
  occurrenceInteractionRequirements: Map<string, WorkspaceOccurrenceInteractionRequirement>,
  roomControls: Map<string, WorkspaceRoomPickerControl>,
  rewardControls: Map<string, WorkspaceRewardControl>,
): void {
  appendUniqueHubInteractionRequirements(
    hubInteractionRequirements,
    assembly.hubInteractionRequirements,
  );
  appendUniqueOccurrenceInteractionRequirements(
    occurrenceInteractionRequirements,
    assembly.occurrenceInteractionRequirements,
  );
  appendUniqueRoomControls(roomControls, assembly.roomControls);
  appendUniqueRewardControls(rewardControls, assembly.rewardControls);
  appendUniqueWorkspaceNodes(nodes, [assembly.node, ...assembly.workbenches]);
}

function enrichFrontierPredecessor(
  frontier: WorkspaceAuthoringFrontier | null,
  structuralNodes: readonly WorkspaceNode[],
): WorkspaceAuthoringFrontier | null {
  if (frontier?.kind !== 'exitDecision' || frontier.owner.source.kind !== 'occurrence') {
    return frontier;
  }
  const predecessorOccurrenceId = frontier.owner.source.occurrenceId;
  const predecessorDecision = structuralNodes.find(
    (node): node is WorkspaceDecisionBatchNode =>
      (node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch') &&
      node.targets.some((target) => target.room.occurrenceId === predecessorOccurrenceId),
  );
  return predecessorDecision === undefined
    ? frontier
    : Object.freeze({
        ...frontier,
        predecessorNodeKey: predecessorDecision.key,
      });
}

/** Assemble every biome semantic family in stable authored stage order. */
export function assembleWorkspaceBiomeSemantics(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
): WorkspaceBiomeSemanticAssembly {
  const { biome, evaluation, layout, plan } = source;
  const occurrenceFacts = createWorkspaceBiomeOccurrenceAssemblyFacts(source);
  const fieldsActiveCageCounts = createWorkspaceFieldsActiveCageCounts(catalog, source);
  const markerBuilder = createWorkspaceBiomeMarkerDestinationBuilder({
    assessmentFor: (address) => assessmentForSource(source, address),
    biome,
    findingCountFor: (address) => source.findingsFor(address).length,
    routeKey: biome.routeKey,
  });
  const { emitter: markerDestinations } = markerBuilder;
  const occurrenceInteractionRequirements = new Map<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >();
  const batchInteractionRequirements = new Map<string, WorkspaceBatchInteractionRequirement>();
  const hubInteractionRequirements = new Map<string, WorkspaceHubInteractionRequirement>();
  const topologyRemovalInteractionRequirements = new Map<
    string,
    WorkspaceTopologyRemovalInteractionRequirement
  >();
  const startInteractionRequirements = new Map<string, WorkspaceStartInteractionRequirement>();
  const takeoverInteractionRequirements = new Map<
    string,
    WorkspaceTakeoverInteractionRequirement
  >();
  const frontierInteractionRequirements = new Map<
    string,
    WorkspaceFrontierInteractionRequirement
  >();
  const roomControls = new Map<string, WorkspaceRoomPickerControl>();
  const rewardControls = new Map<string, WorkspaceRewardControl>();
  const topologyInteractions = assembleWorkspaceTopologyInteractions({ catalog, source });
  let frontier = authoringFrontier(catalog, source, markerDestinations);
  const nextHubVisitIndex = frontier?.kind === 'hubVisit' ? frontier.owner.visitIndex : undefined;
  const fields = projectBiomeFields(biome, markerDestinations, plan, layout);
  let startRoomPicker: WorkspaceRoomPickerControl | undefined;
  if (plan.topology !== null && layout.start.kind === 'authoredChoice') {
    const start = source.occurrence(plan.topology.startOccurrenceId);
    if (start !== undefined) {
      startRoomPicker = startRoomControl(
        createOccurrenceAddress(biome, start.occurrenceId),
        layout.start.roomGameNames,
        start.gameName,
      );
    }
  }
  const assembleOccurrence: WorkspaceOccurrenceAssembler = (request) => {
    const fieldsActiveCageCount = fieldsActiveCageCounts.countForOccurrence(
      request.occurrence.occurrenceId,
    );
    return assembleWorkspaceOccurrence({
      biome,
      catalog,
      ...(request.evaluatedRoom === undefined ? {} : { evaluatedRoom: request.evaluatedRoom }),
      ...(fieldsActiveCageCount === undefined ? {} : { fieldsActiveCageCount }),
      facts: requireOccurrenceAssemblyFacts(biome, occurrenceFacts, request.occurrence),
      markerDestinations,
      occurrence: request.occurrence,
      ...(request.roomPicker === undefined ? {} : { roomPicker: request.roomPicker }),
    });
  };
  const nodes: WorkspaceNode[] = [];
  let entry: WorkspaceOccurrenceWorkbenchNode | undefined;
  if (plan.topology !== null) {
    const start = source.occurrence(plan.topology.startOccurrenceId);
    if (start !== undefined) {
      if (
        source.entryRoom !== undefined &&
        (source.entryRoom.occurrenceId !== start.occurrenceId ||
          source.entryRoom.gameName !== start.gameName ||
          semanticAddressKey(source.entryRoom.origin) !==
            semanticAddressKey(createOccurrenceAddress(biome, start.occurrenceId)))
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} evaluated entry does not match the authored start`,
        );
      }
      const projectedEntry = assembleOccurrence(
        Object.freeze({
          ...(source.entryRoom === undefined ? {} : { evaluatedRoom: source.entryRoom }),
          occurrence: start,
          ...(startRoomPicker === undefined ? {} : { roomPicker: startRoomPicker }),
        }),
      );
      entry = projectedEntry.node;
      appendUniqueOccurrenceInteractionRequirements(
        occurrenceInteractionRequirements,
        projectedEntry.occurrenceInteractionRequirements,
      );
      appendUniqueRoomControls(roomControls, projectedEntry.roomControls);
      appendUniqueRewardControls(rewardControls, projectedEntry.rewardControls);
      appendUniqueWorkspaceNodes(nodes, [entry]);
    }
  }
  if (source.entryRoom !== undefined && entry === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} has an evaluated entry without an authored start`,
    );
  }
  const projectAuthoredExitDecision = (decision: ExitDecision): void => {
    const owner = createExitDecisionAddress(biome, decision.source);
    let assembly: WorkspaceDecisionAssembly;
    if (decision.normal.kind === 'linked') {
      const evaluated = source.evaluatedLinkedExit(owner);
      assembly =
        evaluated === undefined
          ? assembleWorkspaceDecision({
              assembleOccurrence,
              catalog,
              decision: decision as WorkspaceAuthoredLinkedExitDecision,
              fieldsActiveCageCounts,
              kind: 'linkedExit',
              markerDestinations,
              source,
            })
          : assembleWorkspaceDecision({
              assembleOccurrence,
              catalog,
              decision: decision as WorkspaceAuthoredLinkedExitDecision,
              evaluated,
              fieldsActiveCageCounts,
              kind: 'linkedExit',
              markerDestinations,
              source,
            });
    } else {
      const evaluated = source.evaluatedBatch(owner);
      assembly =
        evaluated === undefined
          ? assembleWorkspaceDecision({
              assembleOccurrence,
              catalog,
              decision: decision as WorkspaceAuthoredBatchDecision,
              fieldsActiveCageCounts,
              kind: 'batch',
              markerDestinations,
              source,
            })
          : assembleWorkspaceDecision({
              assembleOccurrence,
              catalog,
              decision: decision as WorkspaceAuthoredBatchDecision,
              evaluated,
              fieldsActiveCageCounts,
              kind: 'batch',
              markerDestinations,
              source,
            });
    }
    appendDecisionAssembly(
      assembly,
      nodes,
      batchInteractionRequirements,
      occurrenceInteractionRequirements,
      roomControls,
      rewardControls,
    );
  };
  // Hub-owned handoffs remain after the persistent board, even if the authored
  // topology serializes them elsewhere.
  for (const decision of source.exitDecisions) {
    if (decision.source.kind === 'hubDecision') continue;
    projectAuthoredExitDecision(decision);
  }
  if (layout.progression.kind === 'hub') {
    const descriptor = layout.progression;
    const hub = source.hubDecision(descriptor.hubKey);
    const owner = createHubDecisionAddress(biome, descriptor.hubKey);
    const sharedHubInput = {
      assembleOccurrence,
      biome,
      catalog,
      descriptor,
      markerDestinations,
      ...(nextHubVisitIndex === undefined ? {} : { nextVisitIndex: nextHubVisitIndex }),
      topology: plan.topology,
    };
    const evaluated = hub === undefined ? undefined : source.evaluatedHub(owner);
    const assembly =
      hub === undefined
        ? assembleWorkspaceHub(sharedHubInput)
        : evaluated === undefined
          ? assembleWorkspaceHub({ ...sharedHubInput, hub })
          : assembleWorkspaceHub({ ...sharedHubInput, evaluated, hub });
    appendHubAssembly(
      assembly,
      nodes,
      hubInteractionRequirements,
      occurrenceInteractionRequirements,
      roomControls,
      rewardControls,
    );
  }
  for (const decision of source.exitDecisions) {
    if (decision.source.kind !== 'hubDecision') continue;
    projectAuthoredExitDecision(decision);
  }
  const structuralNodes = Object.freeze([...nodes]);
  frontier = enrichFrontierPredecessor(frontier, structuralNodes);
  const completion = Object.freeze(
    layout.completion.rooms.map((descriptor) => {
      const address = createCompletionRoomAddress(biome, descriptor.role);
      const node: WorkspaceCompletionNode = Object.freeze({
        kind: 'completion' as const,
        key: `completion:${semanticAddressKey(address)}`,
        marker: markerDestinations.marker(address),
        role: descriptor.role,
        gameName: descriptor.roomGameName,
        label: requireWorkspaceRoom(catalog, descriptor.roomGameName).label,
      });
      markerDestinations.redirect(Object.freeze([node.marker]), node.key);
      return node;
    }),
  );
  appendUniqueWorkspaceNodes(nodes, completion);
  const completedNodes = Object.freeze([...nodes]);
  appendUniqueTopologyRemovalInteractionRequirements(
    topologyRemovalInteractionRequirements,
    topologyInteractions.topologyRemovalInteractionRequirements,
  );
  appendUniqueStartInteractionRequirements(
    startInteractionRequirements,
    topologyInteractions.startInteractionRequirements,
  );
  appendUniqueTakeoverInteractionRequirements(
    takeoverInteractionRequirements,
    topologyInteractions.takeoverInteractionRequirements,
  );
  appendUniqueFrontierInteractionRequirements(
    frontierInteractionRequirements,
    topologyInteractions.frontierInteractionRequirements,
  );
  const biomeMarker = markerDestinations.marker(biome, `biome:${biome.routeKey}:${plan.biomeKey}`);
  const preliminaryFocusDestinations = markerBuilder.destinations();
  return Object.freeze({
    biome,
    biomeKey: plan.biomeKey,
    batchInteractionRequirements,
    completion,
    completionOutline: completion,
    ...(entry === undefined ? {} : { entry }),
    fields,
    frontier,
    frontierInteractionRequirements,
    hubInteractionRequirements,
    label: catalog.biomes.byKey[plan.biomeKey]?.label ?? plan.biomeKey,
    marker: biomeMarker,
    nodes: completedNodes,
    occurrenceInteractionRequirements,
    preliminaryFocusDestinations,
    progressionKind: layout.progression.kind,
    roomControls,
    rewardControls,
    source: sourceFor(evaluation),
    startInteractionRequirements,
    status: statusFor(evaluation),
    structuralNodes,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  });
}
