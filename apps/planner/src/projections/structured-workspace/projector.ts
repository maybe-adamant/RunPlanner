import {
  createBiomeAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectEvaluation, SemanticFinding } from '@run-planner/engine/simulation';
import { assertProjectEvaluationSource } from '@run-planner/engine/simulation';

import { authoredWorkspaceLeafRequirements } from './audit/authored-leaf-expectations';
import { assertWorkspaceAuthoredRequirementClosure } from './audit/authored-requirement-closure';
import {
  assertWorkspaceInteractionClosure,
  assertWorkspaceRequirementInteractionClosure,
} from './audit/interaction-closure';
import {
  assertAuthoredWorkspaceLeafProjectionClosure,
  assertWorkspaceProjectionClosure,
  isFineGrainedFindingOwner,
} from './audit/semantic-closure';
import {
  appendUniqueFocusDestinations,
  appendUniqueRewardControls,
  appendUniqueRoomControls,
} from './assembly-products';
import { assembleWorkspaceBiomeSemantics } from './biome-semantic-assembly';
import { StructuredWorkspaceProjectionContractError } from './contract';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from './source-index';
import { workspaceDecisionOwnedMarkers } from './decision-assembly';
import { bindWorkspaceInteractions } from './interaction-binding';
import {
  assertWorkspaceDefaultInspectorDestinationClosure,
  defaultInspectorDestination,
} from './inspector-defaults';
import { bindWorkspaceInspectorDestinations } from './inspector-destinations';
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
import type {
  StructuredWorkspaceContextualServices,
  StructuredWorkspaceProjection,
  StructuredWorkspaceProjectionService,
  WorkspaceAuthoredLeafRequirement,
  WorkspaceBiome,
  WorkspaceHubDecisionNode,
  WorkspaceHubRailEntry,
  WorkspaceHubVisitRailEntry,
  WorkspaceInspectorDestination,
  WorkspaceMarker,
  WorkspaceMixedBatchNode,
  WorkspaceNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceRailEntry,
  WorkspaceRewardControl,
  WorkspaceRoomPickerControl,
  WorkspaceStatus,
  WorkspaceTakeoverBatchNode,
} from './contract';

function railMarkerForNode(node: WorkspaceNode): WorkspaceMarker {
  return node.kind === 'occurrenceWorkbench' ? (node.railMarker ?? node.marker) : node.marker;
}

function pickedTargetSummary(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): string | undefined {
  const picked = node.targets.find((target) => target.selected);
  if (picked === undefined) return undefined;
  return picked.room.rewardSummary === undefined
    ? picked.room.label
    : `${picked.room.label} · ${picked.room.rewardSummary}`;
}

function decisionRailMarker(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): WorkspaceMarker {
  const markers = new Map<string, WorkspaceMarker>();
  for (const value of workspaceDecisionOwnedMarkers(node)) markers.set(value.focusKey, value);
  const findingCount = [...markers.values()].reduce(
    (total, marker) => total + marker.findingCount,
    0,
  );
  return findingCount === node.marker.findingCount
    ? node.marker
    : Object.freeze({ ...node.marker, findingCount });
}

function nodeRailPresentation(
  node: WorkspaceNode,
  decisionIndex: number | undefined,
  isEntry = false,
): { readonly label: string; readonly summary?: string } {
  switch (node.kind) {
    case 'occurrenceWorkbench': {
      const entryLabel = isEntry && node.room.kind === 'Opening' ? 'Opening' : node.room.label;
      const rewardSummary =
        entryLabel === node.room.label
          ? node.room.rewardSummary
          : node.room.rewardSummary === undefined
            ? node.room.label
            : `${node.room.label} · ${node.room.rewardSummary}`;
      return {
        label: entryLabel,
        ...(rewardSummary === undefined ? {} : { summary: rewardSummary }),
      };
    }
    case 'linkedExit':
      return {
        label: node.target.room.label,
        ...(node.target.room.rewardSummary === undefined
          ? {}
          : { summary: node.target.room.rewardSummary }),
      };
    case 'ordinaryBatch':
    case 'mixedBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: `Decision ${decisionIndex ?? 1}`,
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'takeoverBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: 'Preboss',
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'completion':
      return { label: node.label };
    case 'hubDecision':
      return { label: 'Hub' };
  }
}

/**
 * The rail needs the visit's room-local workbench identity, while the Hub
 * board retains its distinct visit-order owner.  Publishing both avoids
 * making React join visits to occurrences or infer which Hub rooms are shown.
 */
function projectHubRailEntry(
  node: WorkspaceHubDecisionNode,
  structuralNodes: readonly WorkspaceNode[],
): WorkspaceHubRailEntry {
  const workbenchesByOccurrenceId = new Map(
    structuralNodes
      .filter(
        (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
          candidate.kind === 'occurrenceWorkbench',
      )
      .map((workbench) => [workbench.room.occurrenceId, workbench] as const),
  );
  const visits: WorkspaceHubVisitRailEntry[] = [];
  for (const visit of node.visits) {
    if (visit.authoring !== 'authored') continue;
    if (visit.room === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} has no authored room workbench`,
      );
    }
    const workbench = workbenchesByOccurrenceId.get(visit.room.occurrenceId);
    if (workbench === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} room ${visit.room.occurrenceId} is not projected`,
      );
    }
    if (workbench.inspectorPresentation !== 'hubRoomLocal') {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} must use a room-local workbench presentation`,
      );
    }
    visits.push(
      Object.freeze({
        key: `${node.key}:visit:${visit.visitIndex}`,
        label: `Visit ${visit.visitIndex} · ${visit.room.label}`,
        marker: workbench.room.marker,
        node: workbench,
        visitIndex: visit.visitIndex,
        visitMarker: visit.marker,
      }),
    );
  }
  return Object.freeze({
    kind: 'hubGroup' as const,
    key: node.key,
    marker: node.marker,
    node,
    visits: Object.freeze(visits),
  });
}

/**
 * A fixed N transition remains an inspectable node, but once its target room
 * exists the room is the player-facing rail stage.  The source-owned command
 * and finding destination remain in `WorkspaceBiome.nodes`.
 */
function isHubRailScaffoldWithRenderedTarget(
  node: WorkspaceNode,
  renderedOccurrenceIds: ReadonlySet<OccurrenceId>,
): boolean {
  if (node.kind === 'linkedExit') {
    return renderedOccurrenceIds.has(node.target.room.occurrenceId);
  }
  if (
    node.kind !== 'ordinaryBatch' &&
    node.kind !== 'mixedBatch' &&
    node.kind !== 'takeoverBatch'
  ) {
    return false;
  }
  return (
    node.owner.source.kind === 'hubDecision' &&
    node.targets.some((target) => renderedOccurrenceIds.has(target.room.occurrenceId))
  );
}

function projectBiome(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
): {
  readonly authoredLeafRequirements: readonly WorkspaceAuthoredLeafRequirement[];
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly biome: WorkspaceBiome;
  readonly focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly frontierInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceFrontierInteractionRequirement
  >;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly startInteractionRequirements: ReadonlyMap<string, WorkspaceStartInteractionRequirement>;
  readonly takeoverInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTakeoverInteractionRequirement
  >;
  readonly topologyRemovalInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTopologyRemovalInteractionRequirement
  >;
} {
  const { biome: biomeAddress, layout, plan } = source;
  const semantic = assembleWorkspaceBiomeSemantics(catalog, source);
  const authoredLeafRequirements = authoredWorkspaceLeafRequirements(catalog, biomeAddress, plan);
  assertWorkspaceAuthoredRequirementClosure({
    authoredLeafRequirements,
    batchInteractionRequirements: semantic.batchInteractionRequirements,
    biome: biomeAddress,
    catalog,
    frontierInteractionRequirements: semantic.frontierInteractionRequirements,
    hubInteractionRequirements: semantic.hubInteractionRequirements,
    layout,
    occurrenceFacts: semantic.occurrenceFacts,
    plan,
    startInteractionRequirements: semantic.startInteractionRequirements,
    takeoverInteractionRequirements: semantic.takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements: semantic.topologyRemovalInteractionRequirements,
  });
  assertAuthoredWorkspaceLeafProjectionClosure(
    authoredLeafRequirements,
    semantic.preliminaryFocusDestinations,
    semantic.nodes,
  );
  assertWorkspaceProjectionClosure(
    biomeAddress,
    source.findings,
    semantic.preliminaryFocusDestinations,
    plan,
    semantic.nodes,
  );
  const { entry, frontier, structuralNodes } = semantic;
  const renderedOccurrenceIds = new Set(
    structuralNodes
      .filter(
        (node): node is WorkspaceOccurrenceWorkbenchNode => node.kind === 'occurrenceWorkbench',
      )
      .map((node) => node.room.occurrenceId),
  );
  const railNodes = structuralNodes
    .filter((node) => {
      if (node.kind !== 'occurrenceWorkbench') return true;
      if (node.railVisibility === 'inspectorOnly') return false;
      // Ordinary room offers belong inside their owning decision workbench.
      // N's fixed Opening, PreHub, and Preboss occurrences remain structural
      // stages, while an ordinary biome keeps only its authored entry.
      return layout.progression.kind === 'hub' || node.key === entry?.key;
    })
    .filter(
      (node) =>
        layout.progression.kind !== 'hub' ||
        !isHubRailScaffoldWithRenderedTarget(node, renderedOccurrenceIds),
    );
  // The N board is declaration-owned outline structure until the fixed
  // Opening -> PreHub path has reached it. Keep that read-only preview after
  // the active entry frontier; otherwise it would claim a position in the
  // rail before the action that makes it reachable. Persisted Hub decisions
  // and retained authored structure stay in their topology order.
  const hubOutlines = railNodes.filter(
    (node): node is WorkspaceHubDecisionNode =>
      node.kind === 'hubDecision' && node.authoring === 'outline',
  );
  const reachableRailNodes = railNodes.filter(
    (node) => !(node.kind === 'hubDecision' && node.authoring === 'outline'),
  );
  const railFrontier =
    frontier?.kind === 'start' ||
    (frontier?.kind === 'exitDecision' && frontier.owner.source.kind !== 'hubDecision')
      ? frontier
      : undefined;
  let decisionIndex = 0;
  const railEntryForNode = (node: WorkspaceNode): WorkspaceRailEntry => {
    if (node.kind === 'hubDecision') return projectHubRailEntry(node, structuralNodes);
    if (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') decisionIndex += 1;
    const presentation = nodeRailPresentation(
      node,
      node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' ? decisionIndex : undefined,
      node.key === entry?.key,
    );
    return Object.freeze({
      kind: 'node' as const,
      key: node.key,
      label: presentation.label,
      marker:
        node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
          ? decisionRailMarker(node)
          : railMarkerForNode(node),
      node,
      ...(presentation.summary === undefined ? {} : { summary: presentation.summary }),
    });
  };
  const rail = Object.freeze([
    ...reachableRailNodes.map(railEntryForNode),
    ...(railFrontier === undefined
      ? []
      : [
          Object.freeze({
            kind: 'frontier' as const,
            frontier: railFrontier,
            key: `frontier:${railFrontier.marker.focusKey}`,
            marker: railFrontier.marker,
          }),
        ]),
    ...hubOutlines.map(railEntryForNode),
  ]);
  const inspectorDefaults = Object.freeze({
    ...(entry === undefined ? {} : { entry }),
    frontier,
    nodes: semantic.nodes,
    rail,
  });
  const defaultInspector = defaultInspectorDestination(inspectorDefaults);
  assertWorkspaceDefaultInspectorDestinationClosure(inspectorDefaults, defaultInspector);
  const projected = Object.freeze({
    biomeKey: semantic.biomeKey,
    completion: semantic.completion,
    completionOutline: semantic.completionOutline,
    defaultInspectorDestination: defaultInspector,
    ...(entry === undefined ? {} : { entry }),
    fields: semantic.fields,
    frontier,
    label: semantic.label,
    marker: semantic.marker,
    nodes: semantic.nodes,
    rail,
    source: semantic.source,
    status: semantic.status,
  });
  const presentationFocusDestinations = bindWorkspaceInspectorDestinations({
    biome: projected,
    destinationsByOwner: semantic.preliminaryFocusDestinations,
  });
  return Object.freeze({
    authoredLeafRequirements,
    batchInteractionRequirements: semantic.batchInteractionRequirements,
    biome: projected,
    focusDestinations: presentationFocusDestinations,
    frontierInteractionRequirements: semantic.frontierInteractionRequirements,
    hubInteractionRequirements: semantic.hubInteractionRequirements,
    occurrenceInteractionRequirements: semantic.occurrenceInteractionRequirements,
    roomControls: semantic.roomControls,
    rewardControls: semantic.rewardControls,
    startInteractionRequirements: semantic.startInteractionRequirements,
    takeoverInteractionRequirements: semantic.takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements: semantic.topologyRemovalInteractionRequirements,
  });
}

function routeStatus(route: { readonly status: ProjectEvaluation['status'] }): WorkspaceStatus {
  return route.status;
}

function registerFindingDestinations(
  findings: readonly SemanticFinding[],
  focusByOwner: Map<string, WorkspaceInspectorDestination>,
): void {
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    if (focusByOwner.has(key)) continue;
    if (isFineGrainedFindingOwner(finding.origin)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} finding has no exact workspace destination`,
      );
    }
    if (!('routeKey' in finding.origin) || !('biomeKey' in finding.origin)) continue;
    const biome = createBiomeAddress(finding.origin.routeKey, finding.origin.biomeKey);
    const fallback = focusByOwner.get(semanticAddressKey(biome));
    if (fallback === undefined) continue;
    // A coarse finding uses the biome's inspector fallback, but it is still an
    // explicit owner. Do not inherit a no-focus rail selection from the
    // biome shell (notably its active start frontier).
    focusByOwner.set(
      key,
      Object.freeze({
        ...(fallback.biomeKey === undefined ? {} : { biomeKey: fallback.biomeKey }),
        focusAddress: fallback.focusAddress,
        focusKey: fallback.focusKey,
        ...(fallback.inspectorSubject === undefined
          ? {}
          : { inspectorSubject: fallback.inspectorSubject }),
        nodeKey: fallback.nodeKey,
        ownerAddress: finding.origin,
        region: fallback.region,
        ...(fallback.routeKey === undefined ? {} : { routeKey: fallback.routeKey }),
      }),
    );
  }
}

export function createStructuredWorkspaceProjection(
  catalog: Catalog,
  services: StructuredWorkspaceContextualServices,
): StructuredWorkspaceProjectionService {
  const cache = new WeakMap<
    ProjectDocument,
    WeakMap<ProjectEvaluation, StructuredWorkspaceProjection>
  >();
  return Object.freeze({
    project(
      project: ProjectDocument,
      evaluation: ProjectEvaluation,
    ): StructuredWorkspaceProjection {
      assertProjectEvaluationSource(project, evaluation);
      const existing = cache.get(project)?.get(evaluation);
      if (existing !== undefined) return existing;
      const focusByOwner = new Map<string, WorkspaceInspectorDestination>();
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
      const authoredLeafRequirements: WorkspaceAuthoredLeafRequirement[] = [];
      const sources = createWorkspaceProjectSourceIndex(catalog, project, evaluation);
      const routes = sources.routes.map((routeSource) => {
        const biomes = routeSource.biomes.map((biomeSource) => {
          const projected = projectBiome(catalog, biomeSource);
          appendUniqueFocusDestinations(focusByOwner, projected.focusDestinations.entries());
          appendUniqueOccurrenceInteractionRequirements(
            occurrenceInteractionRequirements,
            projected.occurrenceInteractionRequirements.values(),
          );
          appendUniqueBatchInteractionRequirements(
            batchInteractionRequirements,
            projected.batchInteractionRequirements.values(),
          );
          appendUniqueHubInteractionRequirements(
            hubInteractionRequirements,
            projected.hubInteractionRequirements.values(),
          );
          appendUniqueTopologyRemovalInteractionRequirements(
            topologyRemovalInteractionRequirements,
            projected.topologyRemovalInteractionRequirements.values(),
          );
          appendUniqueStartInteractionRequirements(
            startInteractionRequirements,
            projected.startInteractionRequirements.values(),
          );
          appendUniqueTakeoverInteractionRequirements(
            takeoverInteractionRequirements,
            projected.takeoverInteractionRequirements.values(),
          );
          appendUniqueFrontierInteractionRequirements(
            frontierInteractionRequirements,
            projected.frontierInteractionRequirements.values(),
          );
          appendUniqueRoomControls(roomControls, projected.roomControls.values());
          appendUniqueRewardControls(rewardControls, projected.rewardControls.values());
          authoredLeafRequirements.push(...projected.authoredLeafRequirements);
          return projected.biome;
        });
        const routeAddress = { kind: 'route' as const, routeKey: routeSource.routeKey };
        const routeMarker = Object.freeze({
          address: routeAddress,
          assessment:
            routeSource.evaluation === undefined ? ('blocked' as const) : ('assessed' as const),
          findingCount: routeSource.evaluation?.findings.length ?? 0,
          focusKey: semanticAddressKey(routeAddress),
        });
        appendUniqueFocusDestinations(focusByOwner, [
          [
            routeMarker.focusKey,
            Object.freeze<WorkspaceInspectorDestination>({
              focusAddress: routeAddress,
              focusKey: routeMarker.focusKey,
              nodeKey: `route:${routeSource.routeKey}`,
              ownerAddress: routeAddress,
              region: 'routeRail',
              routeKey: routeSource.routeKey,
            }),
          ],
        ]);
        return Object.freeze({
          biomes: Object.freeze(biomes),
          label: catalog.routes.byKey[routeSource.routeKey]?.label ?? routeSource.routeKey,
          marker: routeMarker,
          rail: Object.freeze(
            biomes.map((biome) =>
              Object.freeze({
                biomeKey: biome.biomeKey,
                label: biome.label,
                marker: biome.marker,
                source: biome.source,
                status: biome.status,
              }),
            ),
          ),
          routeKey: routeSource.routeKey,
          status:
            routeSource.evaluation === undefined ? 'blocked' : routeStatus(routeSource.evaluation),
        });
      });
      registerFindingDestinations(evaluation.findings, focusByOwner);
      const interactions = bindWorkspaceInteractions({
        batchInteractionRequirements,
        catalog,
        evaluation,
        frontierInteractionRequirements,
        hubInteractionRequirements,
        occurrenceInteractionRequirements,
        project,
        rewardControls,
        roomControls,
        services,
        startInteractionRequirements,
        takeoverInteractionRequirements,
        topologyRemovalInteractionRequirements,
      });
      assertWorkspaceRequirementInteractionClosure({
        batchInteractionRequirements: batchInteractionRequirements.values(),
        catalog,
        frontierInteractionRequirements: frontierInteractionRequirements.values(),
        hubInteractionRequirements: hubInteractionRequirements.values(),
        interactions,
        occurrenceInteractionRequirements: occurrenceInteractionRequirements.values(),
        startInteractionRequirements: startInteractionRequirements.values(),
        takeoverInteractionRequirements: takeoverInteractionRequirements.values(),
        topologyRemovalInteractionRequirements: topologyRemovalInteractionRequirements.values(),
      });
      assertWorkspaceInteractionClosure(
        routes,
        roomControls,
        rewardControls,
        interactions,
        Object.freeze([...authoredLeafRequirements]),
      );
      const projectAddress = { kind: 'project' as const };
      const result = Object.freeze({
        focusByOwner,
        interactions,
        marker: Object.freeze({
          address: projectAddress,
          assessment: 'assessed' as const,
          findingCount: evaluation.findings.length,
          focusKey: semanticAddressKey(projectAddress),
        }),
        routes: Object.freeze(routes),
        status: evaluation.status,
      });
      let byEvaluation = cache.get(project);
      if (byEvaluation === undefined) {
        byEvaluation = new WeakMap();
        cache.set(project, byEvaluation);
      }
      byEvaluation.set(evaluation, result);
      return result;
    },
  });
}
