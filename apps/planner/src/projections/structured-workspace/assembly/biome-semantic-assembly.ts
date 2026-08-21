import {
  createBiomeFieldAddress,
  createBossCompletionArcanaAddress,
  createCompletionRoomAddress,
  createExitDecisionAddress,
  createInitialExitDecision,
  createHubDecisionAddress,
  createKeepsakeEquipResultAddress,
  createEchoKeepsakeReplayAddress,
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
  normalDecisionProgressionForLayout,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type ExitDecision,
  type KeepsakeEquipResultAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type RoomOccurrence,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredFieldDescriptor,
  BiomeLayout,
  Catalog,
} from '@run-planner/engine/catalog-schema';
import type { ProjectBiomeEvaluation } from '@run-planner/engine/simulation';

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
  type WorkspaceOccurrenceStageOutgoing,
  type WorkspaceProjectionSource,
  type WorkspaceRewardControl,
  type WorkspaceRunStateLauncher,
  type WorkspaceRoomPickerControl,
  type WorkspaceStatus,
} from '../contract';
import {
  assembleWorkspaceDecision,
  type WorkspaceAuthoredBatchDecision,
  type WorkspaceDecisionAssembly,
} from './decision-assembly';
import { assembleWorkspaceHub } from './hub-assembly';
import {
  appendUniqueBatchInteractionRequirements,
  appendUniqueHubInteractionRequirements,
  appendUniqueOccurrenceInteractionRequirements,
  appendUniqueStartInteractionRequirements,
  appendUniqueTakeoverInteractionRequirements,
  appendUniqueTopologyRemovalInteractionRequirements,
  type WorkspaceBatchInteractionRequirement,
  type WorkspaceHubInteractionRequirement,
  type WorkspaceOccurrenceInteractionRequirement,
  type WorkspaceStartInteractionRequirement,
  type WorkspaceTakeoverInteractionRequirement,
  type WorkspaceTopologyRemovalInteractionRequirement,
} from '../interactions/interaction-requirements';
import {
  createWorkspaceBiomeMarkerDestinationBuilder,
  type WorkspaceMarkerDestinationEmitter,
} from '../navigation/marker-builder';
import {
  assembleWorkspaceOccurrence,
  type WorkspaceOccurrenceAssembly,
  type WorkspaceOccurrenceAssembler,
  type WorkspaceOccurrenceAssemblyRequest,
} from './occurrence-assembly';
import {
  createWorkspaceBiomeOccurrenceAssemblyFacts,
  type WorkspaceBiomeOccurrenceAssemblyFacts,
  type WorkspaceOccurrenceAssemblyFact,
} from './occurrence-facts';
import type { WorkspaceDecisionBatchNode } from '../navigation/marker-ownership';
import { workspaceDecisionOwnedMarkers } from '../navigation/marker-ownership';
import type { WorkspaceBiomeSource } from '../source-index';
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
  readonly echoKeepsakeReplay?: {
    readonly address: KeepsakeEquipResultAddress & { readonly resultKind: 'experimentalHammer' };
    readonly marker: WorkspaceMarker;
  };
  readonly fields: readonly WorkspaceBiomeField[];
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly nodes: readonly WorkspaceNode[];
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly occurrenceOutgoing: ReadonlyMap<OccurrenceId, WorkspaceOccurrenceStageOutgoing>;
  readonly preliminaryFocusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
  /** Presentation needs only this declared rail policy, never the full layout. */
  readonly progressionKind: BiomeLayout['progression']['kind'];
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly runStateLaunchers: ReadonlyMap<string, WorkspaceRunStateLauncher>;
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

interface CachedOccurrenceAssembly {
  readonly assembly: WorkspaceOccurrenceAssembly;
  readonly request: WorkspaceOccurrenceAssemblyRequest;
}

/**
 * One occurrence has one projection package within a biome assembly. Request
 * overlays are part of that package's semantic input, so a second requester
 * may reuse it only when it asks for the exact same facts.
 */
function requireCompatibleOccurrenceAssemblyRequest(
  biome: BiomeAddress,
  cached: WorkspaceOccurrenceAssemblyRequest,
  request: WorkspaceOccurrenceAssemblyRequest,
): void {
  if (
    cached.occurrence !== request.occurrence ||
    cached.evaluatedRoom !== request.evaluatedRoom ||
    cached.fieldsBatchFacts !== request.fieldsBatchFacts ||
    cached.isEntry !== request.isEntry ||
    cached.roomPicker !== request.roomPicker ||
    cached.anomalyReplacementRoomGameNames !== request.anomalyReplacementRoomGameNames
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(createOccurrenceAddress(biome, request.occurrence.occurrenceId))} received conflicting occurrence assembly inputs`,
    );
  }
}

function statusFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceStatus {
  if (evaluation === undefined) return 'blocked';
  if (evaluation.authoring === 'incomplete') {
    return evaluation.validity === 'invalid' ? 'invalid' : 'incomplete';
  }
  return evaluation.validity;
}

function sourceFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceProjectionSource {
  if (evaluation === undefined) return 'authored';
  return evaluation.authoring === 'complete' && evaluation.validity === 'valid'
    ? 'canonical'
    : 'progressive';
}

function assessmentForSource(
  source: WorkspaceBiomeSource,
  address: SemanticAddress,
): WorkspaceAssessment {
  const { evaluation } = source;
  if (evaluation === undefined) return 'blocked';
  if (evaluation.coverage.kind === 'none') return 'unassessed';
  if (evaluation.authoring === 'complete' && evaluation.validity === 'valid') {
    return 'assessed';
  }
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

type WorkspaceExitDecisionFrontierSeed = Omit<
  Extract<WorkspaceAuthoringFrontier, { readonly kind: 'exitDecision' }>,
  'provisionalBatch'
>;
type WorkspaceAuthoringFrontierSeed =
  | Exclude<WorkspaceAuthoringFrontier, { readonly kind: 'exitDecision' }>
  | WorkspaceExitDecisionFrontierSeed;

function authoringFrontier(
  source: WorkspaceBiomeSource,
  marker: WorkspaceMarkerDestinationEmitter,
): WorkspaceAuthoringFrontierSeed | null {
  const { biome, plan } = source;
  if (plan.topology === null) {
    return Object.freeze({
      kind: 'start' as const,
      interactionKey: semanticAddressKey(biome),
      marker: marker.marker(biome),
      owner: biome,
    });
  }
  const completeness = source.completeness;
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
      // The Hub terminal replaces its exact decision envelope, so this
      // impossible legacy-shaped frontier has no workspace presentation.
      return null;
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
  frontier: WorkspaceAuthoringFrontierSeed | null,
  structuralNodes: readonly WorkspaceNode[],
): WorkspaceAuthoringFrontierSeed | null {
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
  bossCompletionArcanaCapability?: {
    readonly inactiveArcanaKeys: readonly string[];
    readonly requiredCount: number;
  },
  postbossKeepsakeReached = false,
  keepsakeEquipResultSupported: (address: KeepsakeEquipResultAddress) => boolean = () => false,
): WorkspaceBiomeSemanticAssembly {
  const { biome, evaluation, layout, plan } = source;
  const anomalyReplacementRoomGameNames =
    layout.progression.kind === 'generated'
      ? layout.progression.anomalyReplacement?.replacementRoomGameNames
      : undefined;
  const occurrenceFacts = createWorkspaceBiomeOccurrenceAssemblyFacts(source);
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
  const roomControls = new Map<string, WorkspaceRoomPickerControl>();
  const rewardControls = new Map<string, WorkspaceRewardControl>();
  const topologyInteractions = assembleWorkspaceTopologyInteractions({ catalog, source });
  const frontier = authoringFrontier(source, markerDestinations);
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
  const occurrenceAssemblies = new Map<string, CachedOccurrenceAssembly>();
  const assembleOccurrence: WorkspaceOccurrenceAssembler = (request) => {
    const cached = occurrenceAssemblies.get(request.occurrence.occurrenceId);
    if (cached !== undefined) {
      requireCompatibleOccurrenceAssemblyRequest(biome, cached.request, request);
      return cached.assembly;
    }
    const evaluatedRoom =
      request.evaluatedRoom ?? source.blockedOccurrenceRoom(request.occurrence.occurrenceId);
    const assembly = assembleWorkspaceOccurrence({
      ...(anomalyReplacementRoomGameNames === undefined ? {} : { anomalyReplacementRoomGameNames }),
      biome,
      catalog,
      encounterPhaseStatus: source.encounterPhaseStatus,
      figLeafSupport: source.figLeafSupport,
      gorgonSupport: source.gorgonSupport,
      ...(evaluatedRoom === undefined ? {} : { evaluatedRoom }),
      ...(request.fieldsBatchFacts === undefined
        ? {}
        : { fieldsBatchFacts: request.fieldsBatchFacts }),
      facts: requireOccurrenceAssemblyFacts(biome, occurrenceFacts, request.occurrence),
      levelResolutionAssessment: source.levelResolutionAssessment,
      derivedAcquisitionEntries: source.derivedAcquisitionEntries,
      markerDestinations,
      ordinaryRewardForfeited: (owner) => source.ordinaryRewardForfeited(owner.address),
      occurrence: request.occurrence,
      runState: source.runState,
      ...(request.isEntry === true ? { isEntry: true } : {}),
      ...(request.roomPicker === undefined ? {} : { roomPicker: request.roomPicker }),
    });
    occurrenceAssemblies.set(request.occurrence.occurrenceId, Object.freeze({ assembly, request }));
    return assembly;
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
          isEntry: true,
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
    const evaluated = source.evaluatedBatch(owner);
    const assembly: WorkspaceDecisionAssembly =
      evaluated === undefined
        ? assembleWorkspaceDecision({
            assembleOccurrence,
            catalog,
            decision: decision as WorkspaceAuthoredBatchDecision,
            kind: 'batch',
            markerDestinations,
            persistence: 'authored',
            source,
          })
        : assembleWorkspaceDecision({
            assembleOccurrence,
            catalog,
            decision: decision as WorkspaceAuthoredBatchDecision,
            evaluated,
            kind: 'batch',
            markerDestinations,
            persistence: 'authored',
            source,
          });
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
      completedExitReady:
        frontier?.kind === 'exitDecision' &&
        frontier.owner.source.kind === 'hubDecision' &&
        frontier.owner.source.decisionKey === descriptor.hubKey,
      ...(nextHubVisitIndex === undefined ? {} : { nextVisitIndex: nextHubVisitIndex }),
      source,
      topology: plan.topology,
    };
    if (hub !== undefined) {
      const evaluated = source.evaluatedHub(owner);
      const assembly =
        evaluated === undefined
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
  }
  for (const decision of source.exitDecisions) {
    if (decision.source.kind !== 'hubDecision') continue;
    projectAuthoredExitDecision(decision);
  }
  if (frontier?.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision') {
    markerDestinations.setHubTab([frontier.marker], 'exit');
  }
  const structuralNodes = Object.freeze([...nodes]);
  const frontierSeed = enrichFrontierPredecessor(frontier, structuralNodes);
  let resolvedFrontier: WorkspaceAuthoringFrontier | null;
  if (frontierSeed?.kind === 'exitDecision') {
    const progression = normalDecisionProgressionForLayout(layout);
    if (progression === undefined || frontierSeed.owner.source.kind !== 'occurrence') {
      resolvedFrontier = frontierSeed;
    } else {
      const sourceOccurrence = source.occurrence(frontierSeed.owner.source.occurrenceId);
      if (sourceOccurrence === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(frontierSeed.owner)} has no source occurrence`,
        );
      }
      const sourceRoom = requireWorkspaceRoom(catalog, sourceOccurrence.gameName);
      const provisionalDecision = createInitialExitDecision(
        progression,
        frontierSeed.owner.source,
        sourceRoom.mode.kind === 'authored' ? sourceRoom.mode.templateKey : undefined,
      ) as WorkspaceAuthoredBatchDecision;
      const provisional = assembleWorkspaceDecision({
        assembleOccurrence,
        catalog,
        decision: provisionalDecision,
        kind: 'batch',
        markerDestinations,
        persistence: 'uncommitted',
        source,
      });
      appendUniqueBatchInteractionRequirements(
        batchInteractionRequirements,
        provisional.batchInteractionRequirements,
      );
      appendUniqueRoomControls(roomControls, provisional.roomControls);
      const sourceNodeKey = `occurrence:${semanticAddressKey(
        createOccurrenceAddress(biome, sourceOccurrence.occurrenceId),
      )}`;
      markerDestinations.redirect(workspaceDecisionOwnedMarkers(provisional.batch), sourceNodeKey);
      resolvedFrontier = Object.freeze({
        ...frontierSeed,
        provisionalBatch: provisional.batch,
      });
    }
  } else {
    resolvedFrontier = frontierSeed;
  }
  const occurrenceOutgoing = new Map<OccurrenceId, WorkspaceOccurrenceStageOutgoing>();
  if (plan.topology !== null) {
    for (const occurrence of plan.topology.occurrences) {
      const status = source.outgoingStatus(occurrence.occurrenceId);
      switch (status.kind) {
        case 'authoredDecision':
          // Presentation binds the exact decision node after node titles are finalized.
          occurrenceOutgoing.set(
            occurrence.occurrenceId,
            Object.freeze({
              kind: 'authoredDecision' as const,
              decisionNodeKey: semanticAddressKey(status.owner),
            }),
          );
          break;
        case 'frontier': {
          if (
            resolvedFrontier?.kind !== 'exitDecision' ||
            semanticAddressKey(resolvedFrontier.owner) !== semanticAddressKey(status.owner)
          ) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(status.owner)} engine frontier has no matching workspace frontier`,
            );
          }
          occurrenceOutgoing.set(
            occurrence.occurrenceId,
            Object.freeze({ kind: 'frontier' as const, frontier: resolvedFrontier }),
          );
          break;
        }
        case 'blockedOrUnentered':
          occurrenceOutgoing.set(
            occurrence.occurrenceId,
            Object.freeze({
              kind: 'blockedOrUnentered' as const,
              marker: markerDestinations.marker(status.owner),
              message:
                status.reason === 'unentered'
                  ? 'Enter this room before authoring its outgoing doors.'
                  : 'This room is not the current outgoing authoring frontier.',
            }),
          );
          break;
        case 'topologyOwned':
          occurrenceOutgoing.set(
            occurrence.occurrenceId,
            Object.freeze({
              kind: 'topologyOwned' as const,
              label:
                status.topology === 'hub'
                  ? 'Continuation is owned by the Hub.'
                  : 'Continuation is owned by this room’s local visits.',
              marker: markerDestinations.marker(status.owner),
            }),
          );
          break;
        case 'terminal':
          occurrenceOutgoing.set(
            occurrence.occurrenceId,
            Object.freeze({
              kind: 'terminal' as const,
              label: 'No physical outgoing door before biome completion.',
              marker: markerDestinations.marker(status.owner),
            }),
          );
          break;
      }
    }
  }
  const completion = Object.freeze(
    layout.completion.rooms.map((descriptor) => {
      const address = createCompletionRoomAddress(biome, descriptor.role);
      const judgment =
        descriptor.role !== 'boss' || bossCompletionArcanaCapability === undefined
          ? undefined
          : Object.freeze({
              address: createBossCompletionArcanaAddress(address),
              inactiveArcanaKeys: bossCompletionArcanaCapability.inactiveArcanaKeys,
              marker: markerDestinations.marker(createBossCompletionArcanaAddress(address)),
              requiredCount: bossCompletionArcanaCapability.requiredCount,
              value: plan.bossCompletionArcanaKeys ?? Object.freeze([]),
            });
      const postbossKeepsakeDisposition =
        descriptor.role !== 'postboss' ||
        plan.postbossKeepsakeDisposition === undefined ||
        !postbossKeepsakeReached
          ? undefined
          : plan.postbossKeepsakeDisposition;
      const keepsakeSelectionAddress =
        postbossKeepsakeDisposition === undefined
          ? undefined
          : createPostbossKeepsakeSelectionAddress(address);
      const keepsakeSelectionMarker =
        keepsakeSelectionAddress === undefined
          ? undefined
          : markerDestinations.marker(keepsakeSelectionAddress);
      const replacementEffect =
        keepsakeSelectionAddress !== undefined && postbossKeepsakeDisposition?.kind === 'replace'
          ? catalog.keepsakes.byKey[postbossKeepsakeDisposition.keepsakeKey]?.effect
          : undefined;
      const keepsakeEquipResultAddress =
        keepsakeSelectionAddress !== undefined &&
        (replacementEffect?.kind === 'jeweledPom' ||
          replacementEffect?.kind === 'experimentalHammer')
          ? createKeepsakeEquipResultAddress(keepsakeSelectionAddress, replacementEffect.kind)
          : undefined;
      const keepsakeEquipResultMarker =
        keepsakeEquipResultAddress !== undefined &&
        keepsakeEquipResultSupported(keepsakeEquipResultAddress)
          ? markerDestinations.marker(keepsakeEquipResultAddress)
          : undefined;
      const node: WorkspaceCompletionNode = Object.freeze({
        kind: 'completion' as const,
        key: `completion:${semanticAddressKey(address)}`,
        marker: markerDestinations.marker(address),
        role: descriptor.role,
        gameName: descriptor.roomGameName,
        label: requireWorkspaceRoom(catalog, descriptor.roomGameName).label,
        ...(judgment === undefined ? {} : { judgment }),
        ...(keepsakeSelectionAddress === undefined ||
        keepsakeSelectionMarker === undefined ||
        postbossKeepsakeDisposition === undefined
          ? {}
          : {
              keepsakeSelection: Object.freeze({
                address: keepsakeSelectionAddress,
                ...(keepsakeEquipResultAddress === undefined ||
                keepsakeEquipResultMarker === undefined
                  ? {}
                  : {
                      equipResult: Object.freeze({
                        address: keepsakeEquipResultAddress,
                        marker: keepsakeEquipResultMarker,
                      }),
                    }),
                marker: keepsakeSelectionMarker,
                value: postbossKeepsakeDisposition,
              }),
            }),
      });
      markerDestinations.redirect(
        Object.freeze([
          node.marker,
          ...(judgment === undefined ? [] : [judgment.marker]),
          ...(node.keepsakeSelection === undefined ? [] : [node.keepsakeSelection.marker]),
        ]),
        node.key,
      );
      if (keepsakeEquipResultMarker !== undefined && keepsakeSelectionMarker !== undefined) {
        markerDestinations.redirectTo(keepsakeEquipResultMarker, keepsakeSelectionMarker, node.key);
      }
      return node;
    }),
  );
  appendUniqueWorkspaceNodes(nodes, completion);
  const completedNodes = Object.freeze([...nodes]);
  const echoKeepsakeReplayAddress = createKeepsakeEquipResultAddress(
    createEchoKeepsakeReplayAddress(biome),
    'experimentalHammer',
  );
  const echoKeepsakeReplay = keepsakeEquipResultSupported(echoKeepsakeReplayAddress)
    ? Object.freeze({
        address: echoKeepsakeReplayAddress,
        marker: markerDestinations.marker(echoKeepsakeReplayAddress),
      })
    : undefined;
  if (echoKeepsakeReplay !== undefined && entry !== undefined)
    markerDestinations.redirect([echoKeepsakeReplay.marker], entry.key);
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
  const biomeMarker = markerDestinations.marker(biome, `biome:${biome.routeKey}:${plan.biomeKey}`);
  const runStateLaunchers = new Map<string, WorkspaceRunStateLauncher>();
  const appendRunStateLauncher = (launcher: WorkspaceRunStateLauncher): void => {
    const key = semanticAddressKey(launcher.owner);
    if (runStateLaunchers.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(`${key} has duplicate Run State`);
    }
    runStateLaunchers.set(key, launcher);
  };
  for (const cached of occurrenceAssemblies.values()) {
    for (const launcher of cached.assembly.runStateLaunchers) appendRunStateLauncher(launcher);
  }
  for (const node of completedNodes) {
    if ('runState' in node && node.runState !== undefined) appendRunStateLauncher(node.runState);
  }
  const preliminaryFocusDestinations = markerBuilder.destinations();
  return Object.freeze({
    biome,
    biomeKey: plan.biomeKey,
    batchInteractionRequirements,
    completion,
    completionOutline: completion,
    ...(entry === undefined ? {} : { entry }),
    ...(echoKeepsakeReplay === undefined ? {} : { echoKeepsakeReplay }),
    fields,
    frontier: resolvedFrontier,
    hubInteractionRequirements,
    label: catalog.biomes.byKey[plan.biomeKey]?.label ?? plan.biomeKey,
    marker: biomeMarker,
    nodes: completedNodes,
    occurrenceInteractionRequirements,
    occurrenceOutgoing,
    preliminaryFocusDestinations,
    progressionKind: layout.progression.kind,
    roomControls,
    rewardControls,
    runStateLaunchers,
    source: sourceFor(evaluation),
    startInteractionRequirements,
    status: statusFor(evaluation),
    structuralNodes,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  });
}
