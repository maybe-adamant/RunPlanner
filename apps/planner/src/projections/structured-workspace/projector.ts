import {
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  assertProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  blockedOccurrenceRoomForProjectEvaluationAssembly,
  purgingPoolCandidateForProjectEvaluationAssembly,
  hermesShrineCandidateForProjectEvaluationAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
  traitOfferCandidateForProjectEvaluationAssembly,
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
  WorkspaceRoomPickerControl,
  WorkspaceRunStateLauncher,
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
  keepsakeEquipResultSupported: (
    address: import('@run-planner/engine/authored-project').KeepsakeEquipResultAddress,
  ) => boolean,
  judgmentArcanaCapability: (
    address: import('@run-planner/engine/authored-project').JudgmentArcanaAddress,
  ) =>
    { readonly inactiveArcanaKeys: readonly string[]; readonly requiredCount: number } | undefined,
  figurineArcanaCapability: (
    address: import('@run-planner/engine/authored-project').FigurineArcanaAddress,
  ) =>
    | {
        readonly inactiveArcanaKeys: readonly string[];
        readonly requiredCount: number;
        readonly rarity: import('@run-planner/engine/catalog-schema').TraitRarity;
      }
    | undefined,
  fountainRarityAssessment: import('./assembly/occurrence-action-row-projection').WorkspaceOccurrenceActionsInput['fountainRarityAssessment'] = undefined,
): {
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly biome: WorkspaceBiome;
  readonly focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly runStateLaunchers: ReadonlyMap<string, WorkspaceRunStateLauncher>;
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
    keepsakeEquipResultSupported,
    judgmentArcanaCapability,
    figurineArcanaCapability,
    fountainRarityAssessment,
  );
  const presentation = presentWorkspaceBiome(catalog, semantic);
  const runStateLaunchers = new Map(semantic.runStateLaunchers);
  for (const node of presentation.biome.nodes) {
    if ('runState' in node && node.runState !== undefined) {
      runStateLaunchers.set(semanticAddressKey(node.runState.owner), node.runState);
    }
  }
  return Object.freeze({
    batchInteractionRequirements: semantic.batchInteractionRequirements,
    biome: presentation.biome,
    focusDestinations: presentation.focusDestinations,
    hubInteractionRequirements: semantic.hubInteractionRequirements,
    occurrenceInteractionRequirements: semantic.occurrenceInteractionRequirements,
    roomControls: semantic.roomControls,
    rewardControls: semantic.rewardControls,
    runStateLaunchers,
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
      const runStateLaunchers = new Map<string, WorkspaceRunStateLauncher>();
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
      const traitControls = new Map<string, WorkspaceTraitOfferControl>();
      const levelResolutionControls = new Map<string, WorkspaceLevelResolutionControl>();
      const steadyGrowthControls = new Map<
        string,
        import('./contract').WorkspaceSteadyGrowthControl
      >();
      const transcendentEmbryoControls = new Map<
        string,
        import('./contract').WorkspaceTranscendentEmbryoControl
      >();
      const fountainRarityControls = new Map<
        string,
        import('./contract').WorkspaceFountainRarityControl
      >();
      const judgmentArcanaControls = new Map<
        string,
        NonNullable<import('./contract').WorkspaceRoomSummary['judgment']>
      >();
      const figurineArcanaControls = new Map<
        string,
        NonNullable<import('./contract').WorkspaceRoomSummary['figurine']>
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
            return encounterPhaseGorgonSupportForProjectEvaluationAssembly(assembly, phase);
          } catch (error) {
            if (error instanceof Error && error.name === 'ProjectSimulationContractError') {
              return undefined;
            }
            throw error;
          }
        },
        (site) => {
          try {
            return derivedAcquisitionEntriesForProjectEvaluationAssembly(assembly, site);
          } catch (error) {
            if (error instanceof Error && error.name === 'ProjectSimulationContractError') {
              return Object.freeze([]);
            }
            throw error;
          }
        },
        (address) => {
          try {
            return traitOfferCandidateForProjectEvaluationAssembly(assembly, address) !== undefined;
          } catch (error) {
            if (error instanceof Error && error.name === 'ProjectSimulationContractError') {
              return false;
            }
            throw error;
          }
        },
        (occurrence) => blockedOccurrenceRoomForProjectEvaluationAssembly(assembly, occurrence),
        (occurrence) => {
          try {
            return purgingPoolCandidateForProjectEvaluationAssembly(assembly, occurrence);
          } catch (error) {
            if (error instanceof Error && error.name === 'ProjectSimulationContractError') {
              return undefined;
            }
            throw error;
          }
        },
        (occurrence) => {
          try {
            return hermesShrineCandidateForProjectEvaluationAssembly(assembly, occurrence);
          } catch (error) {
            if (error instanceof Error && error.name === 'ProjectSimulationContractError') {
              return undefined;
            }
            throw error;
          }
        },
        (occurrence) => {
          try {
            return stygianWellCandidateForProjectEvaluationAssembly(assembly, occurrence);
          } catch (error) {
            if (error instanceof Error && error.name === 'ProjectSimulationContractError') {
              return undefined;
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
          routeStartEffect?.kind === 'experimentalHammer' ||
          routeStartEffect?.kind === 'transcendentEmbryo'
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
        const biomes = routeSource.biomes.map((biomeSource) => {
          const projected = projectBiome(
            catalog,
            biomeSource,
            (address) => candidates.keepsakeEquipResult(address).length > 0,
            (address) => {
              const occurrence = biomeSource.occurrence(address.occurrenceId);
              if (occurrence === undefined) return undefined;
              const candidate = candidates.judgmentArcana(
                address,
                occurrence.encounters.judgmentArcanaKeysByPhase?.[address.phaseKey] ??
                  Object.freeze([]),
              );
              return candidate.kind === 'judgmentArcana' ? candidate.result : undefined;
            },
            (address) => {
              const occurrence = biomeSource.occurrence(address.occurrenceId);
              if (occurrence === undefined) return undefined;
              const candidate = candidates.figurineArcana(
                address,
                occurrence.encounters.figurineArcanaKeysByPhase?.[address.phaseKey] ??
                  Object.freeze([]),
              );
              return candidate.kind === 'figurineArcana' ? candidate.result : undefined;
            },
            (address, targetTraitKey) => candidates.fountainRarityOutcome(address, targetTraitKey),
          );
          appendUniqueFocusDestinations(focusByOwner, projected.focusDestinations.entries());
          for (const [key, launcher] of projected.runStateLaunchers) {
            if (runStateLaunchers.has(key)) throw new Error(`${key} has duplicate Run State`);
            runStateLaunchers.set(key, launcher);
          }
          if (projected.biome.echoKeepsakeReplay !== undefined) {
            const result = projected.biome.echoKeepsakeReplay.address;
            keepsakeEquipResultControls.set(
              semanticAddressKey(result),
              Object.freeze({
                address: result,
                value: biomeSource.plan.echoKeepsakeReplayResults?.[result.resultKind],
              }),
            );
          }
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
            if (node.kind === 'occurrenceWorkbench') {
              if (node.room.judgment !== undefined) {
                judgmentArcanaControls.set(
                  semanticAddressKey(node.room.judgment.address),
                  node.room.judgment,
                );
              }
              if (node.room.figurine !== undefined) {
                figurineArcanaControls.set(
                  semanticAddressKey(node.room.figurine.address),
                  node.room.figurine,
                );
              }
              for (const control of node.room.roomActions?.steadyGrowth ?? []) {
                steadyGrowthControls.set(semanticAddressKey(control.address), control);
              }
              for (const control of node.room.roomActions?.transcendentEmbryo ?? []) {
                transcendentEmbryoControls.set(semanticAddressKey(control.address), control);
              }
              for (const row of node.room.roomActions?.rows ?? []) {
                if (row.fountainRarity !== undefined) {
                  fountainRarityControls.set(
                    semanticAddressKey(row.fountainRarity.address),
                    row.fountainRarity,
                  );
                }
              }
            }
            if (node.kind === 'occurrenceWorkbench' && node.room.keepsakeSelection !== undefined) {
              keepsakeSelectionControls.set(
                semanticAddressKey(node.room.keepsakeSelection.address),
                Object.freeze({
                  address: node.room.keepsakeSelection.address,
                  value: node.room.keepsakeSelection.value,
                }),
              );
              const equipResult = node.room.keepsakeSelection.equipResult;
              if (equipResult !== undefined) {
                keepsakeEquipResultControls.set(
                  semanticAddressKey(equipResult.address),
                  Object.freeze({
                    address: equipResult.address,
                    value: biomeSource.occurrence(node.room.occurrenceId)?.keepsakeRack
                      ?.equipResults?.[equipResult.address.resultKind],
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
          createKeepsakeEquipResultAddress(routeStartKeepsake, 'transcendentEmbryo'),
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
          resources: Object.freeze(
            (['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const).map((family) => {
              const placement = routeSource.resourceAuthoring.placements[family];
              const assessment = routeSource.resourceAuthoring.assessmentByFamily[family];
              return Object.freeze({
                family,
                ...(placement === null ? {} : { placement }),
                reasons: assessment?.reasons ?? Object.freeze([]),
                valid: assessment?.legal ?? placement === null,
              });
            }),
          ),
          routeKey: routeSource.routeKey,
          status:
            routeSource.evaluation === undefined ? 'blocked' : routeStatus(routeSource.evaluation),
        });
      });
      const interactions = bindWorkspaceInteractions({
        allocateOccurrenceId,
        assembly,
        batchInteractionRequirements,
        catalog,
        hubInteractionRequirements,
        occurrenceInteractionRequirements,
        rewardControls,
        traitControls,
        levelResolutionControls,
        steadyGrowthControls,
        transcendentEmbryoControls,
        fountainRarityControls,
        judgmentArcanaControls,
        figurineArcanaControls,
        keepsakeSelectionControls,
        keepsakeEquipResultControls,
        roomControls,
        services,
        startInteractionRequirements,
        takeoverInteractionRequirements,
        topologyRemovalInteractionRequirements,
      });
      registerWorkspaceFindingDestinations(evaluation.findings, focusByOwner, routes);
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
        runStateLaunchers,
        routes: Object.freeze(routes),
        status: evaluation.status,
      });
      cache.set(assembly, result);
      return result;
    },
  });
}
