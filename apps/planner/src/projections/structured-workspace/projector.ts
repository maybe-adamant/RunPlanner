import {
  createBossCompletionArcanaAddress,
  createCompletionRoomAddress,
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type KeepsakeEquipResultAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  assertProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  keepsakeEquipResultCandidateForProjectEvaluationAssembly,
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
  WorkspaceLevelResolutionControl,
  WorkspaceCompletionNode,
  WorkspaceRoomPickerControl,
  WorkspaceStatus,
} from './contract';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

function appendEncounterTraitControls(
  controls: Map<string, WorkspaceTraitOfferControl>,
  rooms: readonly {
    readonly encounterPhases: readonly {
      readonly traitOffer?: WorkspaceTraitOfferControl;
      readonly gorgonAthena?: WorkspaceTraitOfferControl;
    }[];
  }[],
): void {
  for (const room of rooms) {
    for (const phase of room.encounterPhases) {
      const traitControl = phase.traitOffer;
      for (const control of [traitControl, phase.gorgonAthena]) {
        if (control === undefined) continue;
        const key = semanticAddressKey(control.address);
        if (controls.has(key)) continue;
        controls.set(key, control);
      }
    }
  }
}

function projectBiome(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
  bossCompletionArcanaCapability?: {
    readonly inactiveArcanaKeys: readonly string[];
    readonly requiredCount: number;
  },
  postbossKeepsakeReached = false,
  keepsakeEquipResultSupported: (address: KeepsakeEquipResultAddress) => boolean = () => false,
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
  const semantic = assembleWorkspaceBiomeSemantics(
    catalog,
    source,
    bossCompletionArcanaCapability,
    postbossKeepsakeReached,
    keepsakeEquipResultSupported,
  );
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
      const levelResolutionControls = new Map<string, WorkspaceLevelResolutionControl>();
      const bossCompletionArcanaControls = new Map<
        string,
        NonNullable<WorkspaceCompletionNode['judgment']>
      >();
      const keepsakeSelectionControls = new Map<
        string,
        {
          readonly address: import('@run-planner/engine/authored-project').KeepsakeSelectionAddress;
          readonly value:
            | { readonly kind: 'retain' }
            | { readonly kind: 'replace'; readonly keepsakeKey: string }
            | string;
        }
      >();
      const keepsakeEquipResultControls = new Map<
        string,
        {
          readonly address: import('@run-planner/engine/authored-project').KeepsakeEquipResultAddress;
          readonly value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults[keyof import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults];
        }
      >();
      const candidates = services.candidateSessions.bind(assembly);
      const sources = createWorkspaceProjectSourceIndex(
        catalog,
        project,
        evaluation,
        (phase) => encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
        (phase) => encounterPhaseFigLeafSupportForProjectEvaluationAssembly(assembly, phase),
        (phase) => {
          try {
            return (
              encounterPhaseGorgonSupportForProjectEvaluationAssembly(assembly, phase)
                ?.supported === true
            );
          } catch (error) {
            if (error instanceof Error && error.name === 'ProjectSimulationContractError') {
              return false;
            }
            throw error;
          }
        },
      );
      const routes = sources.routes.map((routeSource) => {
        const authoredRoute = project.routes.find(
          (route) => route.routeKey === routeSource.routeKey,
        );
        if (authoredRoute === undefined)
          throw new Error(`Missing authored route ${routeSource.routeKey}`);
        const routeStartKeepsake = createRouteStartKeepsakeSelectionAddress(routeSource.routeKey);
        keepsakeSelectionControls.set(
          semanticAddressKey(routeStartKeepsake),
          Object.freeze({
            address: routeStartKeepsake,
            value: authoredRoute.loadout.startingKeepsakeKey,
          }),
        );
        const routeStartEffect =
          catalog.keepsakes.byKey[authoredRoute.loadout.startingKeepsakeKey]?.effect;
        if (
          routeStartEffect?.kind === 'jeweledPom' ||
          routeStartEffect?.kind === 'experimentalHammer'
        ) {
          const address = createKeepsakeEquipResultAddress(
            routeStartKeepsake,
            routeStartEffect.kind,
          );
          keepsakeEquipResultControls.set(
            semanticAddressKey(address),
            Object.freeze({
              address,
              value: authoredRoute.loadout.keepsakeEquipResults?.[routeStartEffect.kind],
            }),
          );
        }
        const biomes = routeSource.biomes.map((biomeSource, biomeIndex) => {
          const bossCompletionAddress = createBossCompletionArcanaAddress(
            createCompletionRoomAddress(biomeSource.biome, 'boss'),
          );
          const bossCompletion = candidates.bossCompletionArcana(
            bossCompletionAddress,
            biomeSource.plan.bossCompletionArcanaKeys ?? Object.freeze([]),
          );
          const projected = projectBiome(
            catalog,
            biomeSource,
            bossCompletion.kind === 'bossCompletionArcana' ? bossCompletion.result : undefined,
            biomeIndex + 1 < routeSource.biomes.length,
            (address) =>
              keepsakeEquipResultCandidateForProjectEvaluationAssembly(assembly, address) !==
              undefined,
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
          appendUniqueRewardControls(rewardControls, projected.rewardControls.values());
          for (const rewardControl of projected.rewardControls.values()) {
            for (const traitControl of rewardControl.traitOffers ?? []) {
              const key = semanticAddressKey(traitControl.address);
              if (traitControls.has(key)) {
                throw new Error(`${key} has multiple projected trait controls`);
              }
              traitControls.set(key, traitControl);
            }
            for (const control of rewardControl.levelResolutions ?? []) {
              const key = semanticAddressKey(control.address);
              if (levelResolutionControls.has(key)) {
                throw new Error(`${key} has multiple projected Pom controls`);
              }
              levelResolutionControls.set(key, control);
            }
          }
          for (const node of projected.biome.nodes) {
            if (node.kind === 'completion' && node.judgment !== undefined) {
              bossCompletionArcanaControls.set(
                semanticAddressKey(node.judgment.address),
                node.judgment,
              );
            }
            if (node.kind === 'completion' && node.keepsakeSelection !== undefined) {
              keepsakeSelectionControls.set(
                semanticAddressKey(node.keepsakeSelection.address),
                Object.freeze({
                  address: node.keepsakeSelection.address,
                  value: node.keepsakeSelection.value,
                }),
              );
              const equipResult = node.keepsakeSelection.equipResult;
              if (equipResult !== undefined) {
                keepsakeEquipResultControls.set(
                  semanticAddressKey(equipResult.address),
                  Object.freeze({
                    address: equipResult.address,
                    value: biomeSource.plan.keepsakeEquipResults?.[equipResult.address.resultKind],
                  }),
                );
              }
            }
            if (node.kind === 'occurrenceWorkbench') {
              appendEncounterTraitControls(traitControls, [node.room]);
            } else if (
              node.kind === 'ordinaryBatch' ||
              node.kind === 'takeoverBatch' ||
              node.kind === 'mixedBatch'
            ) {
              appendEncounterTraitControls(
                traitControls,
                node.targets.map((target) => target.room),
              );
            } else if (node.kind === 'hubDecision') {
              appendEncounterTraitControls(
                traitControls,
                node.slots.flatMap((slot) => (slot.room === undefined ? [] : [slot.room])),
              );
              appendEncounterTraitControls(
                traitControls,
                node.visits.flatMap((visit) => (visit.room === undefined ? [] : [visit.room])),
              );
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
        const routeDestination = (ownerAddress: typeof routeAddress | typeof routeStartKeepsake) =>
          Object.freeze<WorkspaceInspectorDestination>({
            focusAddress: routeAddress,
            focusKey: routeMarker.focusKey,
            nodeKey: `route:${routeSource.routeKey}`,
            ownerAddress,
            region: 'routeRail',
            routeKey: routeSource.routeKey,
          });
        const routeStartResults = [
          createKeepsakeEquipResultAddress(routeStartKeepsake, 'jeweledPom'),
          createKeepsakeEquipResultAddress(routeStartKeepsake, 'experimentalHammer'),
        ] as const;
        appendUniqueFocusDestinations(focusByOwner, [
          [routeMarker.focusKey, routeDestination(routeAddress)],
          [semanticAddressKey(routeStartKeepsake), routeDestination(routeStartKeepsake)],
          ...routeStartResults.flatMap((routeStartResult) =>
            keepsakeEquipResultControls.has(semanticAddressKey(routeStartResult))
              ? ([
                  [
                    semanticAddressKey(routeStartResult),
                    Object.freeze<WorkspaceInspectorDestination>({
                      ...routeDestination(routeAddress),
                      ownerAddress: routeStartResult,
                    }),
                  ],
                ] as const)
              : [],
          ),
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
        levelResolutionControls,
        bossCompletionArcanaControls,
        keepsakeSelectionControls,
        keepsakeEquipResultControls,
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
