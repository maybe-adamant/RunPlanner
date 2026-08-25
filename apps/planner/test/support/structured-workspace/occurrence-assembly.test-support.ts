import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  echoLastRewardPickupEntryKey,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  fieldsBatchFacts,
  simulateProjectAssembly,
  traitOfferCandidateForProjectEvaluationAssembly,
  type GorgonPhaseCandidateSupport,
} from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  createFConversionFrontierProject,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPProject,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import {
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
/* eslint-disable no-restricted-imports */
import { assembleWorkspaceOccurrence } from '@planner/projections/structured-workspace/assembly/occurrence-assembly';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from '@planner/projections/structured-workspace/assembly/occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from '@planner/projections/structured-workspace/navigation/marker-builder';
import { createWorkspaceProjectSourceIndex } from '@planner/projections/structured-workspace/source-index';
/* eslint-enable no-restricted-imports */

function biomeSource(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  gorgonSupport?: (
    phase: import('@run-planner/engine/authored-project').EncounterPhaseAddress,
  ) => GorgonPhaseCandidateSupport | undefined,
) {
  const assembly = simulateProjectAssembly(catalog, project);
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    assembly.evaluation,
    (phase) => encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
    undefined,
    gorgonSupport,
    () => Object.freeze([]),
    (address) => traitOfferCandidateForProjectEvaluationAssembly(assembly, address) !== undefined,
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function fieldsFactsForOccurrence(
  source: ReturnType<typeof biomeSource>,
  occurrenceId: OccurrenceId,
) {
  const decision = source.exitDecisions.find(
    (candidate) =>
      candidate.normal.kind === 'batch' &&
      candidate.normal.targets.some((target) => target.occurrenceId === occurrenceId),
  );
  return decision === undefined
    ? undefined
    : fieldsBatchFacts(catalog, source.layout, source.occurrence, decision);
}

export function assemble(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: OccurrenceId,
  gorgonSupport?: (
    phase: import('@run-planner/engine/authored-project').EncounterPhaseAddress,
  ) => GorgonPhaseCandidateSupport | undefined,
  derivedAcquisitionEntries?: Parameters<
    typeof assembleWorkspaceOccurrence
  >[0]['derivedAcquisitionEntries'],
  evaluatedRoomTransform?: (
    room: NonNullable<Parameters<typeof assembleWorkspaceOccurrence>[0]['evaluatedRoom']>,
  ) => NonNullable<Parameters<typeof assembleWorkspaceOccurrence>[0]['evaluatedRoom']>,
  steadyGrowthOutcomes?: Parameters<typeof assembleWorkspaceOccurrence>[0]['steadyGrowthOutcomes'],
) {
  const source = biomeSource(project, routeKey, biomeKey, gorgonSupport);
  const occurrence = source.occurrence(occurrenceId);
  if (occurrence === undefined) throw new Error(`${occurrenceId} occurrence is missing`);
  const evaluatedRoom = (() => {
    if (source.entryRoom?.occurrenceId === occurrenceId) return source.entryRoom;
    for (const decision of source.exitDecisions) {
      const batch = source.evaluatedBatch(
        createExitDecisionAddress(source.biome, decision.source),
      )?.batch;
      const room = batch?.targets.find((target) => target.room.occurrenceId === occurrenceId)?.room;
      if (room !== undefined) return room;
    }
    return undefined;
  })();
  const projectedEvaluatedRoom =
    evaluatedRoom === undefined || evaluatedRoomTransform === undefined
      ? evaluatedRoom
      : evaluatedRoomTransform(evaluatedRoom);
  const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(source).occurrence(occurrenceId);
  if (facts === undefined) throw new Error(`${occurrenceId} facts are missing`);
  const fieldsFacts = fieldsFactsForOccurrence(source, occurrenceId);
  const markers = createWorkspaceBiomeMarkerDestinationBuilder({
    assessmentFor: (address) =>
      source.evaluation === undefined
        ? 'blocked'
        : source.isAssessed(address) || source.findingsFor(address).length > 0
          ? 'assessed'
          : 'unassessed',
    biome: source.biome,
    findingCountFor: (address) => source.findingsFor(address).length,
    routeKey,
  });
  const assembly = assembleWorkspaceOccurrence({
    biome: source.biome,
    catalog,
    encounterPhaseStatus: source.encounterPhaseStatus,
    ...(gorgonSupport === undefined ? {} : { gorgonSupport }),
    ...(fieldsFacts === undefined ? {} : { fieldsBatchFacts: fieldsFacts }),
    facts,
    levelResolutionAssessment: source.levelResolutionAssessment,
    isActiveTraitOffer: source.isActiveTraitOffer,
    derivedAcquisitionEntries: derivedAcquisitionEntries ?? source.derivedAcquisitionEntries,
    ...(projectedEvaluatedRoom === undefined ? {} : { evaluatedRoom: projectedEvaluatedRoom }),
    ...(steadyGrowthOutcomes === undefined ? {} : { steadyGrowthOutcomes }),
    markerDestinations: markers.emitter,
    ordinaryRewardForfeited: (owner) => source.ordinaryRewardForfeited(owner.address),
    occurrence,
    runState: source.runState,
  });
  return { assembly, markers, source };
}

export function withFPrebossSelection(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
): ProjectDocument {
  const sourceOccurrenceId = goldenFOccurrenceId(10, 1);
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        semanticAddressKey(
                          createExitDecisionAddress(goldenFBiome, decision.source),
                        ) ===
                          semanticAddressKey(
                            createExitDecisionAddress(goldenFBiome, {
                              kind: 'occurrence',
                              occurrenceId: sourceOccurrenceId,
                            }),
                          )
                          ? { ...decision, selection: { kind: 'normal' as const, exitKey } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

export {
  applyProjectCommand,
  catalog,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createCompleteFGProject,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createGorgonPhaseAddress,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createFConversionFrontierProject,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  echoLastRewardPickupEntryKey,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfaceNOPProject,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  roomActionKey,
  semanticAddressKey,
  simulateProjectAssembly,
};

export type { GorgonPhaseCandidateSupport, OccurrenceId, ProjectDocument };
