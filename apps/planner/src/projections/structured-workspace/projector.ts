import { semanticAddressKey, type ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectEvaluation } from '@run-planner/engine/simulation';
import { assertProjectEvaluationSource } from '@run-planner/engine/simulation';

import {
  appendUniqueFocusDestinations,
  appendUniqueRewardControls,
  appendUniqueRoomControls,
} from './assembly/assembly-products';
import { assembleWorkspaceBiomeSemantics } from './assembly/biome-semantic-assembly';
import { presentWorkspaceBiome } from './presentation/biome-presentation';
import { registerWorkspaceFindingDestinations } from './navigation/finding-routing';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from './source-index';
import { bindWorkspaceInteractions } from './interactions/interaction-binding';
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
} from './interactions/interaction-requirements';
import type {
  StructuredWorkspaceContextualServices,
  StructuredWorkspaceProjection,
  StructuredWorkspaceProjectionService,
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
  const semantic = assembleWorkspaceBiomeSemantics(catalog, source);
  const presentation = presentWorkspaceBiome(semantic);
  return Object.freeze({
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
      registerWorkspaceFindingDestinations(evaluation.findings, focusByOwner, routes);
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
