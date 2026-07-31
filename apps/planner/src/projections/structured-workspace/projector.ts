import {
  createBiomeAddress,
  semanticAddressKey,
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
import { presentWorkspaceBiome } from './biome-presentation';
import { StructuredWorkspaceProjectionContractError } from './contract';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from './source-index';
import { bindWorkspaceInteractions } from './interaction-binding';
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
  WorkspaceInspectorDestination,
  WorkspaceRewardControl,
  WorkspaceRoomPickerControl,
  WorkspaceStatus,
} from './contract';

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
  const presentation = presentWorkspaceBiome(semantic);
  return Object.freeze({
    authoredLeafRequirements,
    batchInteractionRequirements: semantic.batchInteractionRequirements,
    biome: presentation.biome,
    focusDestinations: presentation.focusDestinations,
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
