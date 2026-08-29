import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  activeRoomActionReferences,
  createAllTogetherSetAddress,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createAdditionalExitAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createEchoPomTargetAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createFountainRarityOutcomeAddress,
  createRoomActionAddress,
  roomActionKey,
  createRouteAddress,
  createRewardWheelOfferAddress,
  createRewardWheelAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  createTraitOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type ProjectDocument,
  type TraitOfferAddress,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  traitOfferCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';
import {
  authorLegalTraitOffers,
  prepareLegalPomTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNOPProject,
  createRepresentativeNOPQShopTraitProject,
  loadSurfaceNOProject,
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNEntryFrontierResolvedProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { underworldCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createCandidateSessionFactory } from '@planner/projections/candidateProjection';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import type {
  WorkspaceFountainRarityControl,
  WorkspaceSteadyGrowthControl,
  WorkspaceTranscendentEmbryoControl,
  WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { createContextualOptionResolver } from '@planner/projections/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewardPicker';
import { createTraitDomainProjection } from '@planner/projections/traitDomainProjection';
/* eslint-disable no-restricted-imports */
import { assembleWorkspaceBiomeSemantics } from '@planner/projections/structured-workspace/assembly/biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex } from '@planner/projections/structured-workspace/source-index';
import { bindWorkspaceInteractions } from '@planner/projections/structured-workspace/interactions/interaction-binding';
/* eslint-enable no-restricted-imports */

const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
export const services = {
  candidateSessions: createCandidateSessionFactory(catalog),
  contextualPicker,
  rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
  traitDomain: createTraitDomainProjection(catalog, contextualPicker),
};

export function createReachableNaturalChaosProject(): ProjectDocument {
  let project = underworldCheckpointArtifacts['natural-chaos-unresolved-trial'].load();
  const openingId = createOccurrenceId('fixture-chaos-opening');
  const source = { kind: 'occurrence' as const, occurrenceId: openingId };
  const targetId = createOccurrenceId('interaction-chaos-target');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, openingId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(goldenFBiome, openingId), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, source, 'exit1'),
    occurrenceId: targetId,
    gameName: 'F_Combat01',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, targetId),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

export function selectedNChaosFrontierProject(persistTerminalDecision = true): ProjectDocument {
  const opening = createOccurrenceId('interaction-binding-n-chaos-opening');
  const preHub = createOccurrenceId('interaction-binding-n-chaos-prehub');
  const chaos = createOccurrenceId('interaction-binding-n-chaos-room');
  let project = createProjectDocument(catalog, {
    configuredBiomeCounts: { Surface: 1 },
    projectId: 'interaction-binding-n-chaos-frontier',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: opening,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, opening),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = authorLegalTraitOffers(project);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(nBiome, { kind: 'occurrence', occurrenceId: opening }),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(nBiome, { kind: 'occurrence', occurrenceId: opening }, 'prehub'),
    occurrenceId: preHub,
    gameName: 'N_PreHub01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, preHub),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'AddNaturalChaos',
    additional: createAdditionalExitAddress(nBiome, opening, 'naturalChaos'),
    occurrenceId: chaos,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(nBiome, { kind: 'occurrence', occurrenceId: opening }),
    value: { kind: 'additional', additionalExitKey: 'naturalChaos' },
  });
  project = authorLegalTraitOffers(project);
  return persistTerminalDecision
    ? applyProjectCommand(project, catalog, {
        kind: 'CreateBatch',
        decision: createExitDecisionAddress(nBiome, { kind: 'occurrence', occurrenceId: chaos }),
      })
    : project;
}

export function enteredShopProject(): {
  readonly project: ProjectDocument;
  readonly shopId: string;
} {
  const biome = createBiomeAddress('Underworld', 'F');
  const start = createOccurrenceId('interaction-binding-shop-start');
  const combat = createOccurrenceId('interaction-binding-shop-combat');
  const shop = createOccurrenceId('interaction-binding-shop');
  let project = createProjectDocument(catalog, {
    projectId: 'interaction-binding-entered-shop',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, start),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: start }),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, {
      kind: 'occurrence',
      occurrenceId: start,
    }),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, { kind: 'occurrence', occurrenceId: start }, 'exit1'),
    occurrenceId: combat,
    gameName: 'F_Combat03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, combat),
    value: { rewardType: 'GiftDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: combat }),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, {
      kind: 'occurrence',
      occurrenceId: combat,
    }),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, { kind: 'occurrence', occurrenceId: combat }, 'exit1'),
    occurrenceId: createOccurrenceId('interaction-binding-shop-sibling'),
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, { kind: 'occurrence', occurrenceId: combat }, 'exit2'),
    occurrenceId: shop,
    gameName: 'F_Shop01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: combat,
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  for (const [offerKey, value] of [
    [
      'Boon',
      {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
      },
    ],
    ['MajorNonBoon', { rewardType: 'RoomRewardHealDrop' }],
    ['Minor', { rewardType: 'MaxManaDrop' }],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, shop, offerKey),
      value,
    });
  }
  return { project: authorLegalTraitOffers(project), shopId: shop };
}

export function bind(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  allocateOccurrenceId = () => createOccurrenceId('interaction-binding-start'),
  candidateSession?: CandidateProjectionSession,
  steadyGrowthControls?: ReadonlyMap<string, WorkspaceSteadyGrowthControl>,
  fountainRarityControls?: ReadonlyMap<string, WorkspaceFountainRarityControl>,
  transcendentEmbryoControls?: ReadonlyMap<string, WorkspaceTranscendentEmbryoControl>,
) {
  const authoredProject = project;
  const projectAssembly = simulateProjectAssembly(catalog, authoredProject);
  const evaluation = projectAssembly.evaluation;
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    authoredProject,
    evaluation,
    (phase) => encounterPhaseSequenceStatusForProjectEvaluationAssembly(projectAssembly, phase),
    (phase) => encounterPhaseFigLeafSupportForProjectEvaluationAssembly(projectAssembly, phase),
    (phase) => encounterPhaseGorgonSupportForProjectEvaluationAssembly(projectAssembly, phase),
    undefined,
    (address) =>
      traitOfferCandidateForProjectEvaluationAssembly(projectAssembly, address) !== undefined,
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  const assembly = assembleWorkspaceBiomeSemantics(catalog, source);
  const traitControls = new Map(
    [...assembly.rewardControls.values()]
      .flatMap((control) => control.traitOffers ?? [])
      .map((control) => [semanticAddressKey(control.address), control] as const),
  );
  const appendEncounterTraits = (
    rooms: readonly {
      readonly encounterPhases: readonly {
        readonly traitOffer?: WorkspaceTraitOfferControl;
        readonly gorgonAthena?: WorkspaceTraitOfferControl;
      }[];
    }[],
  ) => {
    for (const room of rooms) {
      for (const phase of room.encounterPhases) {
        if (phase.traitOffer !== undefined)
          traitControls.set(semanticAddressKey(phase.traitOffer.address), phase.traitOffer);
        if (phase.gorgonAthena !== undefined)
          traitControls.set(semanticAddressKey(phase.gorgonAthena.address), phase.gorgonAthena);
      }
    }
  };
  for (const node of assembly.nodes) {
    if (node.kind === 'occurrenceWorkbench') appendEncounterTraits([node.room]);
    else if (
      node.kind === 'ordinaryBatch' ||
      node.kind === 'takeoverBatch' ||
      node.kind === 'mixedBatch'
    )
      appendEncounterTraits(node.targets.map((target) => target.room));
    else if (node.kind === 'hubDecision') {
      appendEncounterTraits(
        node.slots.flatMap((slot) => (slot.room === undefined ? [] : [slot.room])),
      );
      appendEncounterTraits(
        node.visits.flatMap((visit) => (visit.room === undefined ? [] : [visit.room])),
      );
    }
  }
  const interactionServices =
    candidateSession === undefined
      ? services
      : Object.freeze({
          ...services,
          candidateSessions: Object.freeze({ bind: () => candidateSession }),
        });
  return {
    assembly,
    interactions: bindWorkspaceInteractions({
      allocateOccurrenceId,
      assembly: projectAssembly,
      batchInteractionRequirements: assembly.batchInteractionRequirements,
      catalog,
      hubInteractionRequirements: assembly.hubInteractionRequirements,
      occurrenceInteractionRequirements: assembly.occurrenceInteractionRequirements,
      rewardControls: assembly.rewardControls,
      traitControls,
      roomControls: assembly.roomControls,
      services: interactionServices,
      ...(steadyGrowthControls === undefined ? {} : { steadyGrowthControls }),
      ...(fountainRarityControls === undefined ? {} : { fountainRarityControls }),
      ...(transcendentEmbryoControls === undefined ? {} : { transcendentEmbryoControls }),
      startInteractionRequirements: assembly.startInteractionRequirements,
      takeoverInteractionRequirements: assembly.takeoverInteractionRequirements,
      topologyRemovalInteractionRequirements: assembly.topologyRemovalInteractionRequirements,
    }),
  };
}

export function reachedEchoProject(): ProjectDocument {
  const bridgeId = createOccurrenceId('golden-h-bridge01');
  let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-h-combat09'),
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Echo',
      options: [
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
        { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
      ],
      selectedOptionKey: 'option1',
    },
  });
  return project;
}

export {
  catalog,
  applyProjectCommand,
  activeRoomActionReferences,
  createAllTogetherSetAddress,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createAdditionalExitAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createEchoPomTargetAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createRewardWheelOfferAddress,
  createRewardWheelAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  createTraitOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
  authorLegalTraitOffers,
  prepareLegalPomTraitOffers,
  replaceTestShopOfferActions,
  createGoldenFGHIProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  createFountainRarityOutcomeAddress,
  createRoomActionAddress,
  roomActionKey,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  loadSurfaceNOPQProject,
  loadSurfaceNOPProject,
  createRepresentativeNOPQShopTraitProject,
  loadSurfaceNOProject,
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNEntryFrontierResolvedProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  qBiome,
  qOccurrenceIds,
  createCandidateSessionFactory,
  createContextualOptionResolver,
  createContextualPickerProjection,
  createRewardPickerProjection,
  createTraitDomainProjection,
  assembleWorkspaceBiomeSemantics,
  createWorkspaceProjectSourceIndex,
  bindWorkspaceInteractions,
};

export type { WorkspaceTranscendentEmbryoControl };
export type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  ProjectDocument,
  TraitOfferAddress,
  TraitOptionKey,
  CandidateProjectionSession,
  CandidateEvaluationEvent,
  WorkspaceFountainRarityControl,
  WorkspaceSteadyGrowthControl,
};
