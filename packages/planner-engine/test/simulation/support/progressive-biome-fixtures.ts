import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createDefaultRouteLoadout,
  createRewardWheelAddress,
  createRouteAddress,
  createTargetAddress,
  createTraitOfferAddress,
  roomActionDomainForOccurrence,
  roomActionKey,
  semanticAddressKey,
  structurallyActiveOccurrenceIds,
  traitGiverForAcquisitionRole,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeBiomeHistoryPrefix,
  createPreparedProjectCandidateSession,
  evaluateBiomeRewards,
  materializeBiomePrefix,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import { bindTestCandidateSession } from '../candidateSession';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
} from './f-generation-project';
import {
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
} from '../../../src/simulation/progressive/biome';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../../src/simulation/project';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../src/authored-project/defaults';

const defaultRouteLoadout = createDefaultRouteLoadout(catalog);
import {
  createFOpeningBatch,
  createUnselectedFTakeoverProject,
  fBiome,
  fCombatId,
  fStartId,
} from './f-takeover-project';
import {
  authorLegalTraitOffers,
  authorTestArtificerReplacement,
} from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  createFInvalidLaterConversionProject,
  goldenFBiome,
  goldenFStartId,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures/surface';

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function catalogWithImpossibleEncounter(encounterKey: string) {
  return createCatalog({
    ...declarations,
    encounterDefinitions: declarations.encounterDefinitions.map((definition) =>
      definition.key !== encounterKey
        ? definition
        : {
            ...definition,
            requirements: {
              kind: 'counterRange' as const,
              axis: 'biomeDepthCache' as const,
              range: { min: 999 },
            },
          },
    ),
  });
}

function catalogWithImpossibleNaturalChaosSource(gameName: string) {
  return createCatalog({
    ...declarations,
    rooms: declarations.rooms.map((room) => {
      if (room.gameName !== gameName || room.additionalExits === undefined) return room;
      return {
        ...room,
        additionalExits: room.additionalExits.map((exit) =>
          exit.kind !== 'naturalChaos'
            ? exit
            : {
                ...exit,
                requirement: {
                  kind: 'counterRange' as const,
                  axis: 'biomeDepthCache' as const,
                  range: { min: 999 },
                },
              },
        ),
      };
    }),
  });
}

function appendBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  targets: readonly { readonly occurrenceId: OccurrenceId; readonly gameName: string }[],
  storeKey?: 'RunProgress' | 'MetaProgress',
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, source(sourceOccurrenceId));
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (storeKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, decision.source),
      storeKey,
    });
  }
  for (const [offset, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${offset + 1}`),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return next;
}

function incompleteAtMissingDecision(
  project: ProjectDocument,
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(biome, source(sourceOccurrenceId)),
  });
}

function route(project: ProjectDocument, routeKey: string) {
  const result = simulateProject(catalog, project).routes.find(
    (candidate) => candidate.routeKey === routeKey,
  );
  if (result === undefined) throw new Error(`fixture has no ${routeKey} route`);
  return result;
}

function prefix(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const evaluatedRoute = route(project, routeKey);
  const evaluation = evaluatedRoute.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (
    evaluation === undefined ||
    evaluation.authoring !== 'incomplete' ||
    evaluation.coverage.kind !== 'prefix' ||
    !('materializedPrefix' in evaluation)
  ) {
    throw new Error(`${biomeKey} did not produce a materialized incomplete prefix`);
  }
  return { route: evaluatedRoute, evaluation };
}

function incompleteHFieldsProject() {
  const hStart = createOccurrenceId('progressive-h-start');
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 3,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenHBiome,
    occurrenceId: hStart,
  });
  return {
    project: applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(goldenHBiome, source(hStart)),
    }),
    target: createTargetAddress(goldenHBiome, source(hStart), 'exit1'),
  };
}

function incompleteIFieldProject() {
  const iStart = createOccurrenceId('progressive-i-start');
  const iCombat = createOccurrenceId('progressive-i-combat01');
  let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 4,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenIBiome,
    occurrenceId: iStart,
  });
  return {
    project: appendBatch(project, goldenIBiome, iStart, [
      { occurrenceId: iCombat, gameName: 'I_Combat01' },
    ]),
    start: iStart,
    target: createTargetAddress(goldenIBiome, source(iStart), 'exit1'),
  };
}

function partialGWithOnePhysicalTarget() {
  const gStart = createOccurrenceId('progressive-g-start');
  const first = createOccurrenceId('progressive-g-combat01');
  const second = createOccurrenceId('progressive-g-combat02');
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ClearTopology',
    biome: goldenGBiome,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenGBiome,
    occurrenceId: gStart,
  });
  project = appendBatch(
    project,
    goldenGBiome,
    gStart,
    [{ occurrenceId: first, gameName: 'G_Combat01' }],
    'RunProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, first),
    value: { rewardType: 'MaxManaDrop' },
  });
  project = authorLegalTraitOffers(project);
  project = appendBatch(
    project,
    goldenGBiome,
    first,
    [{ occurrenceId: second, gameName: 'G_Combat02' }],
    'MetaProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, second),
    value: { rewardType: 'MetaCurrencyBigDrop' },
  });
  return {
    project,
    source: first,
    firstTarget: second,
  };
}

function partialGWithInvalidSecondPhysicalTarget() {
  const gStart = createOccurrenceId('progressive-invalid-g-start');
  const first = createOccurrenceId('progressive-invalid-g-combat01');
  const second = createOccurrenceId('progressive-invalid-g-combat02');
  const invalid = createOccurrenceId('progressive-invalid-g-combat10');
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ClearTopology',
    biome: goldenGBiome,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenGBiome,
    occurrenceId: gStart,
  });
  project = appendBatch(
    project,
    goldenGBiome,
    gStart,
    [{ occurrenceId: first, gameName: 'G_Combat01' }],
    'RunProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, first),
    value: { rewardType: 'MaxManaDrop' },
  });
  project = authorLegalTraitOffers(project);
  project = appendBatch(
    project,
    goldenGBiome,
    first,
    [
      { occurrenceId: second, gameName: 'G_Combat02' },
      { occurrenceId: invalid, gameName: 'G_Combat10' },
    ],
    'MetaProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, source(first)),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, second),
    value: { rewardType: 'MetaCurrencyBigDrop' },
  });
  return { project: authorLegalTraitOffers(project), source: first, firstTarget: second };
}

function partialGWithEarlierInvalidReward() {
  const fixture = partialGWithInvalidSecondPhysicalTarget();
  return {
    ...fixture,
    project: applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
      value: { rewardType: 'MetaCurrencyDrop' },
    }),
  };
}

function partialFWithInvalidSiblingAdditionsAndNormalTarget() {
  const batches = [
    {
      targets: ['F_Combat02'],
      pickedExitIndex: 1,
      offers: [{ rewardType: 'GiftDrop' }],
    },
    {
      targets: ['F_Combat03', 'F_Combat03'],
      pickedExitIndex: 1,
      offers: [{ rewardType: 'MaxHealthDrop' }, { rewardType: 'MaxManaDrop' }],
    },
    {
      targets: ['F_Combat04', 'F_Combat04'],
      pickedExitIndex: 1,
      offers: [{ rewardType: 'RoomMoneyDrop' }, { rewardType: 'WeaponUpgrade' }],
    },
    {
      targets: ['F_Combat05', 'F_Combat11'],
      pickedExitIndex: 2,
      offers: [{ rewardType: 'HermesUpgrade' }, { rewardType: 'SpellDrop' }],
    },
    {
      targets: ['F_Shop01', 'F_Combat06'],
      pickedExitIndex: 1,
      storeKey: 'MetaProgress',
      offers: [undefined, { rewardType: 'MetaCurrencyDrop' }],
    },
    {
      targets: ['F_Combat02', 'F_Combat13'],
      pickedExitIndex: 1,
      offers: [{ rewardType: 'MaxHealthDrop' }, { rewardType: 'MaxManaDrop' }],
    },
  ] as const;
  const secondChaos = createOccurrenceId('progressive-additional-second-chaos');
  const secondContract = createOccurrenceId('progressive-additional-second-contract');
  const shop = fGenerationOccurrenceId(5, 1);
  let project = createFGenerationProject(batches, { includeTakeover: false });
  const naturalChaos = createAdditionalExitAddress(fGenerationBiome, shop, 'naturalChaos');
  const zagreusContract = createAdditionalExitAddress(fGenerationBiome, shop, 'zagreusContract');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddNaturalChaos',
    additional: naturalChaos,
    occurrenceId: secondChaos,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional: zagreusContract,
    occurrenceId: secondContract,
  });
  project = authorLegalTraitOffers(project);
  return {
    project,
    evaluationCatalog: catalogWithImpossibleNaturalChaosSource('F_Shop01'),
    shop,
    naturalChaos,
    zagreusContract,
  };
}

export {
  EMPTY_RESOURCE_PLACEMENTS,
  appendBatch,
  applyProjectCommand,
  authorLegalTraitOffers,
  authorTestArtificerReplacement,
  bindTestCandidateSession,
  catalog,
  catalogWithImpossibleEncounter,
  catalogWithImpossibleNaturalChaosSource,
  candidateArtifactsForProjectEvaluationAssembly,
  composeBiomeHistoryPrefix,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createCatalog,
  createCompleteFGProject,
  createDefaultRouteLoadout,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createFConversionFrontierProject,
  createFGenerationProject,
  createFInvalidLaterConversionProject,
  createFOpeningBatch,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPreparedProjectCandidateSession,
  createRewardWheelAddress,
  createRouteAddress,
  createTargetAddress,
  createTraitOfferAddress,
  createUnselectedFTakeoverProject,
  declarations,
  defaultRouteLoadout,
  evaluateBiomeRewards,
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
  fBiome,
  fCombatId,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
  fStartId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
  goldenIBiome,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  incompleteAtMissingDecision,
  incompleteHFieldsProject,
  incompleteIFieldProject,
  loadSurfaceNOPQProject,
  materializeBiomePrefix,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  partialFWithInvalidSiblingAdditionsAndNormalTarget,
  partialGWithEarlierInvalidReward,
  partialGWithInvalidSecondPhysicalTarget,
  partialGWithOnePhysicalTarget,
  prefix,
  qBiome,
  qOccurrenceIds,
  roomActionDomainForOccurrence,
  roomActionKey,
  route,
  semanticAddressKey,
  simulateProject,
  simulateProjectAssembly,
  source,
  structurallyActiveOccurrenceIds,
  traitGiverForAcquisitionRole,
};
