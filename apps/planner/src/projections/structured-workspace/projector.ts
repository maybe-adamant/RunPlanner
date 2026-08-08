import {
  createTraitOfferAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, TraitRarity } from '@run-planner/engine/catalog-schema';
import {
  assertProjectEvaluationAssembly,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  type EncounterPhaseCandidateSupport,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';

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
  appendUniqueHubTakeoverInteractionRequirements,
  appendUniqueOccurrenceInteractionRequirements,
  appendUniqueStartInteractionRequirements,
  appendUniqueTakeoverInteractionRequirements,
  appendUniqueTopologyRemovalInteractionRequirements,
  type WorkspaceBatchInteractionRequirement,
  type WorkspaceFrontierInteractionRequirement,
  type WorkspaceHubInteractionRequirement,
  type WorkspaceHubTakeoverInteractionRequirement,
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
  WorkspaceTraitOfferControl,
  WorkspaceRoomPickerControl,
  WorkspaceStatus,
} from './contract';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

function projectBiome(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
  encounterCandidateAt: (
    phase: EncounterPhaseAddress,
  ) => EncounterPhaseCandidateSupport | undefined,
): {
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly biome: WorkspaceBiome;
  readonly focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly frontierInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceFrontierInteractionRequirement
  >;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly hubTakeoverInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceHubTakeoverInteractionRequirement
  >;
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
  const semantic = assembleWorkspaceBiomeSemantics(catalog, source, encounterCandidateAt);
  const presentation = presentWorkspaceBiome(catalog, semantic);
  return Object.freeze({
    batchInteractionRequirements: semantic.batchInteractionRequirements,
    biome: presentation.biome,
    focusDestinations: presentation.focusDestinations,
    frontierInteractionRequirements: semantic.frontierInteractionRequirements,
    hubInteractionRequirements: semantic.hubInteractionRequirements,
    hubTakeoverInteractionRequirements: semantic.hubTakeoverInteractionRequirements,
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

function enrichTraitReplacementRarities(
  source: WorkspaceBiomeSource,
  controls: ReadonlyMap<string, WorkspaceRewardControl>,
): ReadonlyMap<string, WorkspaceRewardControl> {
  const replacementByOwner = new Map<
    string,
    {
      branchCount: number;
      replacements: Map<string, Set<TraitRarity>>;
      replacementSeen: Map<string, number>;
    }
  >();
  for (const evaluated of source.evaluation === undefined ? [] : [source.evaluation]) {
    if (!('rewards' in evaluated)) continue;
    for (const branch of evaluated.rewards.branches) {
      for (const trace of branch.traitEvaluations ?? []) {
        const owner = createTraitOfferAddress(
          trace.address as Extract<
            typeof trace.address,
            { kind: 'incomingReward' | 'localReward' | 'rewardWheelOffer' | 'shopOffer' }
          >,
          trace.acquisitionRole,
        );
        const key = semanticAddressKey(owner);
        const ownerEvidence = replacementByOwner.get(key) ?? {
          branchCount: 0,
          replacements: new Map(),
          replacementSeen: new Map(),
        };
        ownerEvidence.branchCount += 1;
        for (const assessment of trace.assessments) {
          const replacement = assessment.replacementTransition;
          if (replacement === undefined) continue;
          const rarities = ownerEvidence.replacements.get(replacement.newTraitKey) ?? new Set();
          rarities.add(replacement.requiredRarity);
          ownerEvidence.replacements.set(replacement.newTraitKey, rarities);
          ownerEvidence.replacementSeen.set(
            replacement.newTraitKey,
            (ownerEvidence.replacementSeen.get(replacement.newTraitKey) ?? 0) + 1,
          );
        }
        replacementByOwner.set(key, ownerEvidence);
      }
    }
  }
  if (replacementByOwner.size === 0) return controls;
  const enriched = new Map<string, WorkspaceRewardControl>();
  for (const [key, control] of controls) {
    if (control.traitOffers === undefined) {
      enriched.set(key, control);
      continue;
    }
    const traitOffers = control.traitOffers.map((trait) => {
      const ownerEvidence = replacementByOwner.get(semanticAddressKey(trait.address));
      const replacementRarities: Record<string, TraitRarity> = {};
      if (ownerEvidence !== undefined) {
        for (const [traitKey, rarities] of ownerEvidence.replacements) {
          const rank = [...rarities][0];
          if (
            rarities.size === 1 &&
            rank !== undefined &&
            ownerEvidence.replacementSeen.get(traitKey) === ownerEvidence.branchCount
          ) {
            replacementRarities[traitKey] = rank;
          }
        }
      }
      return Object.keys(replacementRarities).length === 0
        ? trait
        : Object.freeze({
            ...trait,
            replacementRarities: Object.freeze(replacementRarities),
          });
    });
    enriched.set(key, Object.freeze({ ...control, traitOffers: Object.freeze(traitOffers) }));
  }
  return enriched;
}

export function createStructuredWorkspaceProjection(
  catalog: Catalog,
  services: StructuredWorkspaceContextualServices,
  allocateOccurrenceId: OccurrenceIdFactory,
): StructuredWorkspaceProjectionService {
  const cache = new WeakMap<ProjectEvaluationAssembly, StructuredWorkspaceProjection>();
  return Object.freeze({
    project(assembly: ProjectEvaluationAssembly): StructuredWorkspaceProjection {
      assertProjectEvaluationAssembly(assembly);
      const { evaluation, project } = assembly;
      const existing = cache.get(assembly);
      if (existing !== undefined) return existing;
      const focusByOwner = new Map<string, WorkspaceInspectorDestination>();
      const occurrenceInteractionRequirements = new Map<
        string,
        WorkspaceOccurrenceInteractionRequirement
      >();
      const batchInteractionRequirements = new Map<string, WorkspaceBatchInteractionRequirement>();
      const hubInteractionRequirements = new Map<string, WorkspaceHubInteractionRequirement>();
      const hubTakeoverInteractionRequirements = new Map<
        string,
        WorkspaceHubTakeoverInteractionRequirement
      >();
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
      const traitControls = new Map<string, WorkspaceTraitOfferControl>();
      const sources = createWorkspaceProjectSourceIndex(catalog, project, evaluation);
      const routes = sources.routes.map((routeSource) => {
        const biomes = routeSource.biomes.map((biomeSource) => {
          const projected = projectBiome(catalog, biomeSource, (phase) =>
            encounterPhaseCandidateSupportForProjectEvaluationAssembly(assembly, phase),
          );
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
          appendUniqueHubTakeoverInteractionRequirements(
            hubTakeoverInteractionRequirements,
            projected.hubTakeoverInteractionRequirements.values(),
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
          const enrichedRewardControls = enrichTraitReplacementRarities(
            biomeSource,
            projected.rewardControls,
          );
          appendUniqueRewardControls(rewardControls, enrichedRewardControls.values());
          for (const rewardControl of enrichedRewardControls.values()) {
            for (const traitControl of rewardControl.traitOffers ?? []) {
              const key = semanticAddressKey(traitControl.address);
              if (traitControls.has(key)) {
                throw new Error(`${key} has multiple projected trait controls`);
              }
              traitControls.set(key, traitControl);
            }
          }
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
        allocateOccurrenceId,
        assembly,
        batchInteractionRequirements,
        catalog,
        frontierInteractionRequirements,
        hubInteractionRequirements,
        hubTakeoverInteractionRequirements,
        occurrenceInteractionRequirements,
        rewardControls,
        traitControls,
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
      cache.set(assembly, result);
      return result;
    },
  });
}
