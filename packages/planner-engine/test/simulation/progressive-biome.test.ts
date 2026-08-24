import { describe, expect, it } from 'vitest';

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

import { bindTestCandidateSession } from './candidateSession';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
} from './support/f-generation-project';
import {
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
} from '../../src/simulation/progressive/biome';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../src/simulation/project';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';

const defaultRouteLoadout = createDefaultRouteLoadout(catalog);
import {
  createFOpeningBatch,
  createUnselectedFTakeoverProject,
  fBiome,
  fCombatId,
  fStartId,
} from './support/f-takeover-project';
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

describe('progressive biome evaluation', () => {
  it.each([
    { rewardType: 'GiftDrop', label: 'Nectar' },
    { rewardType: 'MetaCurrencyDrop', label: 'Bones' },
    { rewardType: 'MetaCardPointsCommonDrop', label: 'Ashes' },
  ] as const)(
    'retains reached $rewardType ($label) Artificer and Time Piece conversion contact at a later incomplete frontier',
    ({ rewardType }) => {
      const fixture = createFConversionFrontierProject(rewardType);
      const assembly = simulateProjectAssembly(catalog, fixture.project);
      const session = createPreparedProjectCandidateSession(catalog, assembly);
      expect(
        session.evaluate({ kind: 'acquisitionConversion', acquisition: fixture.acquisition }),
      ).toMatchObject({
        kind: 'acquisitionConversion',
        result: {
          timePieceSupported: true,
          timePieceConvertible: true,
          artificerSupported: true,
          artificerConvertible: true,
          artificerReplacementOptions: expect.any(Array),
        },
      });
      expect(
        session.evaluate({
          kind: 'acquisitionConversion',
          acquisition: fixture.unreachedAcquisition,
        }),
      ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
    },
  );

  it('retains the reached Nectar conversion checkpoint when its mutually exclusive Pom child blocks', () => {
    const fixture = createFConversionFrontierProject('GiftDrop');
    const project = applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(fixture.acquisition.owner, 'self'),
      value: { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(
      session.evaluate({ kind: 'acquisitionConversion', acquisition: fixture.acquisition }),
    ).toMatchObject({
      kind: 'acquisitionConversion',
      result: { artificerSupported: true, artificerConvertible: true },
    });
  });

  it.each(['Boon', 'HermesUpgrade', 'WeaponUpgrade'] as const)(
    'retains the source Artificer capability while its %s replacement trait offer blocks',
    (replacementRewardType) => {
      const fixture = createFConversionFrontierProject('MetaCurrencyDrop');
      let project = applyProjectCommand(fixture.project, catalog, {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: fixture.acquisition,
        value: { kind: 'artificer' },
      });
      const unresolved = createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'acquisitionConversion', acquisition: fixture.acquisition });
      if (
        unresolved.kind !== 'acquisitionConversion' ||
        unresolved.result.artificerReplacementAddress === undefined
      ) {
        throw new Error('Artificer replacement frontier is missing');
      }
      const replacement = unresolved.result.artificerReplacementOptions?.find(
        (option) => option.offer.rewardType === replacementRewardType,
      );
      if (replacement === undefined)
        throw new Error(`${replacementRewardType} Artificer replacement is missing`);
      project = authorTestArtificerReplacement(project, catalog, fixture.acquisition, replacement);
      const assembly = simulateProjectAssembly(catalog, project);
      const role = Object.keys(replacement.traitOffersByAcquisitionRole)[0];
      if (role === undefined) throw new Error(`${replacementRewardType} has no trait role`);
      const giverKey = traitGiverForAcquisitionRole(catalog, replacement.offer, role);
      if (giverKey === undefined) throw new Error(`${replacementRewardType} has no trait giver`);
      const trait = createTraitOfferAddress(unresolved.result.artificerReplacementAddress, role);
      expect(assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({ code: 'traitOfferMissing', origin: trait }),
      );
      const selected = createPreparedProjectCandidateSession(catalog, assembly);
      expect(
        selected.evaluate({ kind: 'acquisitionConversion', acquisition: fixture.acquisition }),
      ).toMatchObject({
        kind: 'acquisitionConversion',
        result: { artificerSupported: true, artificerReplacementAddress: trait.owner },
      });
      expect(selected.traitOfferStartingDraft(trait, giverKey)).toMatchObject({
        kind: 'traits',
        options: expect.any(Array),
      });
    },
  );

  it('retains an earlier acquisition conversion capability when a later reward region is invalid', () => {
    const fixture = createFInvalidLaterConversionProject();
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, fixture.project),
    );
    expect(
      session.evaluate({
        kind: 'acquisitionConversion',
        acquisition: fixture.acquisition,
      }),
    ).toMatchObject({
      kind: 'acquisitionConversion',
      result: { artificerSupported: true, timePieceSupported: true },
    });
    expect(
      session.evaluate({
        kind: 'acquisitionConversion',
        acquisition: fixture.unreachedAcquisition,
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('rejects a duplicate sibling trait through the candidate authority', () => {
    const project = authorLegalTraitOffers(createGoldenFGHProject());
    const assembly = simulateProjectAssembly(catalog, project);
    const trace = assembly.evaluation.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.selectedTraitOffers : []))
      .find((candidate) =>
        candidate.branches.every((branch) =>
          branch.assessments.every((assessment) => assessment.legal),
        ),
      );
    if (trace === undefined) throw new Error('fixture has no reached legal trait offer');
    if (trace.offer.kind !== 'traits') throw new Error('fixture has no materialized trait offer');
    const owner = trace.address.owner;
    const first = trace.offer.options[0];
    const third = trace.offer.options[2];
    if (first === undefined || third === undefined) {
      throw new Error('fixture needs a complete trait offer');
    }
    const result = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'traitOffer',
      trait: createTraitOfferAddress(owner, trace.acquisitionRole),
      value: Object.freeze({
        kind: 'traits',
        giverKey: trace.offer.giverKey,
        options: Object.freeze([first, first, third] as const),
        selectedOptionKey: 'option1',
      }),
    });

    expect(result).toMatchObject({
      kind: 'traitOffer',
      result: {
        supported: false,
        findings: [
          expect.objectContaining({
            code: 'duplicateOfferedTrait',
            traitKey: first.traitKey,
          }),
        ],
      },
    });
  });

  it('assesses a stale Hammer loadout in an incomplete prefix with the route context', () => {
    const initial = createGoldenFGHProject();
    const route = initial.routes.find((candidate) => candidate.routeKey === 'Underworld');
    if (route === undefined) throw new Error('missing Underworld route');
    const replacementWeapon = catalog.weapons.values.find(
      (weapon) => weapon.key !== route.loadout.weaponKey,
    );
    if (replacementWeapon === undefined) throw new Error('missing replacement weapon');
    let project = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Underworld'),
      weaponKey: replacementWeapon.key,
      aspectKey: replacementWeapon.defaultAspectKey,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(8, 1),
      }),
    });
    const evaluation = simulateProject(catalog, project)
      .routes.find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    expect(evaluation?.authoring).toBe('incomplete');
    expect(evaluation?.findings).toContainEqual(
      expect.objectContaining({
        code: 'wrongHammerLoadout',
        origin: expect.objectContaining({
          kind: 'traitOffer',
          owner: expect.objectContaining({
            kind: 'incomingReward',
            occurrenceId: goldenFOccurrenceId(8, 1),
          }),
        }),
      }),
    );
    const retainedHammerFindings = evaluation?.findings.filter(
      (finding) =>
        finding.code === 'wrongHammerLoadout' &&
        finding.origin.kind === 'traitOffer' &&
        finding.origin.owner.kind === 'incomingReward' &&
        finding.origin.owner.occurrenceId === goldenFOccurrenceId(8, 1),
    );
    expect(retainedHammerFindings).toHaveLength(3);
    expect(new Set(retainedHammerFindings?.map((finding) => finding.evidence.traitKey)).size).toBe(
      3,
    );
    const plan = project.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (plan === undefined) throw new Error('stale Hammer plan is missing');
    const currentRoute = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
    if (currentRoute === undefined) throw new Error('stale Hammer route is missing');
    // @ts-expect-error public materialization requires a route-owned loadout
    expect(() => materializeBiomePrefix(catalog, goldenFBiome, plan, {})).toThrowError(
      'public biome materialization requires a route weapon and aspect loadout',
    );
    const directSnapshot = materializeBiomePrefix(
      catalog,
      goldenFBiome,
      plan,
      currentRoute.loadout,
    );
    if (directSnapshot?.entryRoom === undefined) {
      throw new Error('stale Hammer direct prefix did not materialize');
    }
    const directSnapshotWithEntry = { ...directSnapshot, entryRoom: directSnapshot.entryRoom };
    const directHistory = composeBiomeHistoryPrefix(catalog, directSnapshot);
    if (directHistory === null) throw new Error('stale Hammer direct history did not compose');
    const directRewards = evaluateBiomeRewards(
      catalog,
      directSnapshotWithEntry,
      directHistory,
      1,
      currentRoute.loadout,
    );
    expect(directRewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'wrongHammerLoadout',
        origin: expect.objectContaining({
          kind: 'traitOffer',
          owner: expect.objectContaining({
            kind: 'incomingReward',
            occurrenceId: goldenFOccurrenceId(8, 1),
          }),
        }),
      }),
    );

    const assembly = simulateProjectAssembly(catalog, project);
    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(assembly).biomeAt(goldenFBiome);
    const blockedReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(8, 1));
    const blockedTrait = createTraitOfferAddress(blockedReward, 'self');
    const containingTarget = createTargetAddress(
      goldenFBiome,
      source(goldenFOccurrenceId(7, 1)),
      'exit1',
    );
    const laterTarget = createTargetAddress(
      goldenFBiome,
      source(goldenFOccurrenceId(8, 1)),
      'exit1',
    );
    expect(artifacts?.traitOffers.at(blockedTrait)).toBeDefined();
    expect(artifacts?.rewardProducers.at(blockedReward)).toBeDefined();
    expect(artifacts?.roomTargets.at(containingTarget)).toBeDefined();
    expect(artifacts?.roomTargets.at(laterTarget)).toBeUndefined();
  });

  it('carries exact room-target and reward-producer artifacts through normal, prefix, clamped, and pre-clamp execution', () => {
    const complete = createFGenerationProject();
    const incomplete = createFGenerationProject(undefined, { includeTakeover: false });
    const firstFTarget = fGenerationTargetAddress(fGenerationBaselineBatches, 1, 1);
    const firstFReward = createIncomingRewardAddress(
      fGenerationBiome,
      fGenerationOccurrenceId(1, 1),
    );
    const normalAssembly = simulateProjectAssembly(catalog, complete);
    const prefixAssembly = simulateProjectAssembly(catalog, incomplete);
    const normalResult = createPreparedProjectCandidateSession(catalog, normalAssembly).evaluate({
      kind: 'roomTarget',
      target: firstFTarget,
      gameName: 'F_Combat02',
    });
    const prefixResult = createPreparedProjectCandidateSession(catalog, prefixAssembly).evaluate({
      kind: 'roomTarget',
      target: firstFTarget,
      gameName: 'F_Combat02',
    });
    const normalProducer = candidateArtifactsForProjectEvaluationAssembly(normalAssembly)
      .biomeAt(fGenerationBiome)
      ?.rewardProducers.at(firstFReward);
    const prefixProducer = candidateArtifactsForProjectEvaluationAssembly(prefixAssembly)
      .biomeAt(fGenerationBiome)
      ?.rewardProducers.at(firstFReward);

    const fixture = partialGWithInvalidSecondPhysicalTarget();
    const routeEvaluation = simulateProject(catalog, fixture.project).routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
    const previous = routeEvaluation?.biomes.find((candidate) => candidate.biomeKey === 'F');
    const plan = fixture.project.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (previous?.authoring !== 'complete' || previous.validity !== 'valid' || plan === undefined) {
      throw new Error('progressive artifact fixture has no valid F seed or G plan');
    }
    const seed = { history: previous.history, rewardBranches: previous.rewards.branches };
    const clamped = evaluateProgressiveBiomeAssembly(catalog, goldenGBiome, plan, {
      enteredBiomeCount: 2,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: defaultRouteLoadout,
      seed,
    });
    const beforeClamp = evaluateProgressiveBiomeAssemblyBeforeClamp(catalog, goldenGBiome, plan, {
      enteredBiomeCount: 2,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: defaultRouteLoadout,
      seed,
    });
    const firstGTarget = createTargetAddress(goldenGBiome, source(fixture.source), 'exit1');
    const invalidSecondGTarget = createTargetAddress(goldenGBiome, source(fixture.source), 'exit2');
    const clampedContext = clamped?.candidateArtifacts.roomTargets.at(firstGTarget);
    const beforeClampContext = beforeClamp?.candidateArtifacts.roomTargets.at(firstGTarget);
    const firstGReward = createIncomingRewardAddress(goldenGBiome, fixture.firstTarget);
    const clampedProducer = clamped?.candidateArtifacts.rewardProducers.at(firstGReward);
    const beforeClampProducer = beforeClamp?.candidateArtifacts.rewardProducers.at(firstGReward);

    expect(normalResult).toMatchObject({ kind: 'roomTarget' });
    expect(prefixResult).toMatchObject({ kind: 'roomTarget' });
    expect(normalProducer).toBeDefined();
    expect(prefixProducer).toBeDefined();
    expect(normalProducer).not.toBe(prefixProducer);
    expect(Object.keys(normalProducer ?? {})).toEqual([
      'acquisitionHorizon',
      'evaluateOffer',
      'resolvedStoreKey',
    ]);
    expect(normalProducer?.resolvedStoreKey).toBe('MetaProgress');
    expect(clampedContext).toBeDefined();
    expect(beforeClampContext).toBeDefined();
    expect(beforeClampContext).not.toBe(clampedContext);
    expect(clampedProducer).toBeDefined();
    expect(beforeClampProducer).toBeDefined();
    expect(beforeClampProducer).not.toBe(clampedProducer);
    const clampedFrontierContext = clamped?.candidateArtifacts.roomTargets.at(invalidSecondGTarget);
    const beforeClampInvalidContext =
      beforeClamp?.candidateArtifacts.roomTargets.at(invalidSecondGTarget);
    expect(clampedFrontierContext).toBeDefined();
    expect(beforeClampInvalidContext).toBeDefined();
    expect(beforeClampInvalidContext).not.toBe(clampedFrontierContext);

    const blocked = partialGWithEarlierInvalidReward();
    const blockedRoute = simulateProject(catalog, blocked.project).routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
    const blockedPrevious = blockedRoute?.biomes.find((candidate) => candidate.biomeKey === 'F');
    const blockedPlan = blocked.project.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (
      blockedPrevious?.authoring !== 'complete' ||
      blockedPrevious.validity !== 'valid' ||
      blockedPlan === undefined
    ) {
      throw new Error('blocked reward artifact fixture has no valid F seed or G plan');
    }
    const blockedSeed = {
      history: blockedPrevious.history,
      rewardBranches: blockedPrevious.rewards.branches,
    };
    const blockedClamped = evaluateProgressiveBiomeAssembly(catalog, goldenGBiome, blockedPlan, {
      enteredBiomeCount: 2,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: defaultRouteLoadout,
      seed: blockedSeed,
    });
    const blockedBeforeClamp = evaluateProgressiveBiomeAssemblyBeforeClamp(
      catalog,
      goldenGBiome,
      blockedPlan,
      {
        enteredBiomeCount: 2,
        resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
        loadout: defaultRouteLoadout,
        seed: blockedSeed,
      },
    );
    const blockedOwner = createIncomingRewardAddress(goldenGBiome, blocked.firstTarget);
    const foreignOwner = createIncomingRewardAddress(
      goldenGBiome,
      createOccurrenceId('not-a-reward-producer'),
    );

    const retainedBlockedProducer =
      blockedClamped?.candidateArtifacts.rewardProducers.at(blockedOwner);
    expect(retainedBlockedProducer).toMatchObject({ acquisitionHorizon: 'ownEnteredLifecycle' });
    expect(blockedBeforeClamp?.candidateArtifacts.rewardProducers.at(blockedOwner)).toMatchObject({
      acquisitionHorizon: 'ownEnteredLifecycle',
    });
    expect(blockedBeforeClamp?.candidateArtifacts.rewardProducers.at(foreignOwner)).toBeUndefined();
    expect(
      blockedClamped?.candidateArtifacts.rewardProducers.at(
        createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-invalid-g-combat10'),
        ),
      ),
    ).toBeUndefined();
  });

  it('does not publish broad interaction replay products after an earlier reward block', () => {
    let project = authorLegalTraitOffers(createCompleteFGProject());
    const baseline = simulateProjectAssembly(catalog, project).evaluation;
    const baselineF = baseline.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (baselineF?.authoring !== 'complete') throw new Error('missing complete F baseline');
    const laterTrait = baselineF.rewards.selectedTraitOffers.find(
      (offer) =>
        offer.address.owner.kind === 'incomingReward' &&
        offer.address.owner.occurrenceId !== goldenFStartId &&
        offer.address.owner.occurrenceId !== goldenFOccurrenceId(1, 1),
    );
    if (laterTrait === undefined) throw new Error('fixture has no reached later trait offer');

    const laterOccurrence = goldenFOccurrenceId(9, 1);
    const laterReward = createIncomingRewardAddress(goldenFBiome, laterOccurrence);
    const laterRoomTarget = createTargetAddress(
      goldenFBiome,
      source(goldenFOccurrenceId(8, 1)),
      'exit1',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, laterOccurrence),
      gameName: 'F_Combat03',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: laterReward,
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
    const earlyReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: earlyReward,
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });

    const assembly = simulateProjectAssembly(catalog, project);
    const evaluation = assembly.evaluation.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (
      evaluation?.authoring !== 'complete' ||
      evaluation.validity !== 'invalid' ||
      evaluation.coverage.kind !== 'prefix'
    ) {
      throw new Error('broad replay fixture did not produce a complete-invalid prefix');
    }
    expect(evaluation.coverage.blockedAt).toEqual(earlyReward);
    const laterOccurrenceMarker = String(laterOccurrence);
    expect(
      evaluation.roomGeneration.findings.some((finding) =>
        JSON.stringify(finding.origin).includes(laterOccurrenceMarker),
      ),
    ).toBe(false);
    expect(
      evaluation.rewards.findings.some((finding) =>
        JSON.stringify(finding.origin).includes(laterOccurrenceMarker),
      ),
    ).toBe(false);
    expect(
      evaluation.rewards.selectedTraitOffers.some(
        (offer) => semanticAddressKey(offer.address) === semanticAddressKey(laterTrait.address),
      ),
    ).toBe(false);

    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(assembly).biomeAt(goldenFBiome);
    expect(artifacts?.roomTargets.at(laterRoomTarget)).toBeUndefined();
    expect(artifacts?.rewardProducers.at(laterReward)).toBeUndefined();
    expect(artifacts?.traitOffers.at(laterTrait.address)).toBeUndefined();
  });

  it('carries opaque lifecycle artifacts through normal, prefix, clamped, and pre-clamp execution', () => {
    const surface = loadSurfaceNOPQProject();
    const prefixProject = incompleteAtMissingDecision(surface, oBiome, oOccurrenceIds.combat02);
    const owner = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const normalAssembly = simulateProjectAssembly(catalog, surface);
    const prefixAssembly = simulateProjectAssembly(catalog, prefixProject);
    const normalLifecycle = candidateArtifactsForProjectEvaluationAssembly(normalAssembly)
      .biomeAt(oBiome)
      ?.roomLifecycles.shipAt(owner);
    const prefixLifecycle = candidateArtifactsForProjectEvaluationAssembly(prefixAssembly)
      .biomeAt(oBiome)
      ?.roomLifecycles.shipAt(owner);

    expect(normalLifecycle).toBeDefined();
    expect(prefixLifecycle).toBeDefined();
    expect(normalLifecycle).not.toBe(prefixLifecycle);
    expect(Object.keys(normalLifecycle ?? {})).toEqual(['activeWheelKeys', 'evaluateState']);

    const invalid = applyProjectCommand(surface, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
      storeKey: 'MetaProgress',
    });
    const routeEvaluation = simulateProject(catalog, invalid).routes.find(
      (candidate) => candidate.routeKey === 'Surface',
    );
    const previous = routeEvaluation?.biomes.find((candidate) => candidate.biomeKey === 'N');
    const plan = invalid.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (previous?.authoring !== 'complete' || previous.validity !== 'valid' || plan === undefined) {
      throw new Error('lifecycle artifact fixture has no valid N seed or O plan');
    }
    const seed = { history: previous.history, rewardBranches: previous.rewards.branches };
    const clamped = evaluateProgressiveBiomeAssembly(catalog, oBiome, plan, {
      enteredBiomeCount: 2,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: defaultRouteLoadout,
      seed,
    });
    const beforeClamp = evaluateProgressiveBiomeAssemblyBeforeClamp(catalog, oBiome, plan, {
      enteredBiomeCount: 2,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: defaultRouteLoadout,
      seed,
    });
    const clampedLifecycle = clamped?.candidateArtifacts.roomLifecycles.shipAt(owner);
    const beforeClampLifecycle = beforeClamp?.candidateArtifacts.roomLifecycles.shipAt(owner);

    expect(clamped?.evaluation.blockedAt).toMatchObject({
      kind: 'rewardWheelOffer',
      occurrenceId: oOccurrenceIds.combat04,
      wheelKey: 'wheel1',
    });
    expect(clampedLifecycle).toBeDefined();
    expect(beforeClampLifecycle).toBeDefined();
    expect(beforeClampLifecycle).not.toBe(clampedLifecycle);
  });

  it('requires the Fields outcome before a target can be authored while retaining target eligibility', () => {
    const fixture = incompleteHFieldsProject();
    const evaluation = route(fixture.project, 'Underworld').biomes.find(
      (candidate) => candidate.biomeKey === 'H',
    );
    if (evaluation === undefined) throw new Error('fixture lost H');

    expect(evaluation).toMatchObject({
      authoring: 'incomplete',
      coverage: { kind: 'prefix' },
      frontier: fixture.target,
    });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: fixture.target,
        gameName: 'H_Combat02',
      }),
    ).toMatchObject({ kind: 'roomTarget', result: { pressure: { selectedPossible: true } } });
    expect(() =>
      applyProjectCommand(fixture.project, catalog, {
        kind: 'CreateTarget',
        target: fixture.target,
        occurrenceId: createOccurrenceId('progressive-h-combat02'),
        gameName: 'H_Combat02',
      }),
    ).toThrow('select the Fields cage outcome before authoring targets');
  });

  it('keeps the fixed Clockwork entrance assessable while its required biome field is absent', () => {
    const fixture = incompleteIFieldProject();
    const evaluation = route(fixture.project, 'Underworld').biomes.find(
      (candidate) => candidate.biomeKey === 'I',
    );
    if (evaluation === undefined) throw new Error('fixture lost I');
    const session = bindTestCandidateSession(catalog, fixture.project);

    expect(evaluation).toMatchObject({
      authoring: 'incomplete',
      coverage: { kind: 'none', reason: 'notEvaluated' },
    });
    expect(
      session.evaluate({
        kind: 'startRoom',
        owner: createOccurrenceAddress(goldenIBiome, fixture.start),
        gameName: 'I_Intro',
      }),
    ).toMatchObject({ kind: 'startRoom', result: { selectedPossible: true } });
    expect(
      session.evaluate({
        kind: 'roomTarget',
        target: fixture.target,
        gameName: 'I_Combat01',
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'coverageNotReached',
      evidence: {
        kind: 'coverageNotReached',
        requiredOwner: fixture.target,
        requiredCheckpoint: 'afterTargetGeneration',
        coverage: { kind: 'none', reason: 'notEvaluated' },
      },
    });
  });

  it.each([
    {
      biomeKey: 'F',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createCompleteFGProject(),
        goldenFBiome,
        goldenFOccurrenceId(8, 1),
      ),
    },
    {
      biomeKey: 'G',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createCompleteFGProject(),
        goldenGBiome,
        goldenGOccurrenceId(7, 1),
      ),
    },
    {
      biomeKey: 'H',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createGoldenFGHIProject(),
        goldenHBiome,
        createOccurrenceId('golden-h-combat05'),
      ),
    },
    {
      biomeKey: 'I',
      routeKey: 'Underworld',
      project: incompleteAtMissingDecision(
        createGoldenFGHIProject(),
        goldenIBiome,
        createOccurrenceId('golden-i-combat09'),
      ),
    },
    {
      biomeKey: 'O',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        loadSurfaceNOPQProject(),
        oBiome,
        oOccurrenceIds.combat02,
      ),
    },
    {
      biomeKey: 'P',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        loadSurfaceNOPQProject(),
        pBiome,
        pOccurrenceId('P_Combat12', 8, 1),
      ),
    },
    {
      biomeKey: 'Q',
      routeKey: 'Surface',
      project: incompleteAtMissingDecision(
        loadSurfaceNOPQProject(),
        qBiome,
        qOccurrenceIds.secondMiniboss1,
      ),
    },
  ])(
    'retains a truthful selected-spine prefix for $biomeKey',
    ({ project, routeKey, biomeKey }) => {
      const { route: evaluatedRoute, evaluation } = prefix(project, routeKey, biomeKey);

      expect(evaluatedRoute.processing.active).toEqual({ kind: 'incomplete', biomeKey });
      expect(evaluation.history.events.some((event) => event.kind === 'biomeCompleted')).toBe(
        false,
      );
      expect('snapshot' in evaluation).toBe(false);
      expect(evaluation.materializedPrefix.entryRoom).toBeDefined();
      expect(evaluation.coverage.through).toMatchObject({
        checkpoint: 'beforeTargetGeneration',
      });

      if (biomeKey === 'H') {
        const fields = evaluation.materializedPrefix.decisions.find(
          (decision) => decision.kind === 'batch' && decision.batchState.kind === 'fields',
        );
        expect(fields).toBeDefined();
      }
      if (biomeKey === 'I') {
        const clockwork = evaluation.materializedPrefix.decisions.find(
          (decision) => decision.kind === 'batch' && decision.batchState.kind === 'clockwork',
        );
        expect(clockwork).toBeDefined();
      }
      if (biomeKey === 'O') {
        expect(
          evaluation.materializedPrefix.decisions.some(
            (decision) =>
              decision.kind === 'batch' &&
              decision.targets.some((target) => (target.room.rewardWheels?.length ?? 0) > 0),
          ),
        ).toBe(true);
      }
    },
  );

  it('replays the generated physical prefix before halting at the missing normal exit', () => {
    const fixture = partialGWithOnePhysicalTarget();
    const { evaluation } = prefix(fixture.project, 'Underworld', 'G');
    const frontier = evaluation.materializedPrefix.frontier;
    const topology = fixture.project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    const persisted = topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === fixture.source,
    );

    expect(frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(goldenGBiome, source(fixture.source)),
      selectedExitKey: 'exit1',
    });
    if (frontier?.kind !== 'exitDecision') throw new Error('G lost its exit decision frontier');
    if (persisted?.kind !== 'exit' || persisted.normal.kind !== 'batch') {
      throw new Error('G lost its persisted batch');
    }
    expect(persisted.normal.targets).toEqual([
      { exitKey: 'exit1', occurrenceId: createOccurrenceId('progressive-g-combat02') },
    ]);
    expect(frontier.targets).toMatchObject([
      {
        exit: { exitKey: 'exit1' },
        room: { gameName: 'G_Combat02' },
        picked: true,
      },
    ]);
    expect(evaluation.history.rooms.at(-1)?.targetGenerations).toMatchObject([
      {
        targetOrigin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      },
    ]);
    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: {
        owner: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
        checkpoint: 'afterTargetGeneration',
      },
    });
    const sourceHistory = evaluation.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(goldenGBiome, fixture.source)),
    );
    expect(sourceHistory?.postCommit).toBeUndefined();
    expect(sourceHistory?.exit).toBeUndefined();
    expect(evaluation.rewards.targetHistory).toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      }),
    );
    expect(evaluation.rewards.targetHistory).toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
      }),
    );
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetMissing',
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
      }),
    );
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedParentCreationCount: 1 } },
    });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-g-combat02'),
        ),
        value: { rewardType: 'MetaCurrencyBigDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true, findings: [] } });
  });

  it('keeps an ordinary empty frontier at its outgoing checkpoint', () => {
    const { evaluation } = prefix(createFOpeningBatch(), 'Underworld', 'F');
    const frontier = evaluation.materializedPrefix.frontier;
    const openingHistory = evaluation.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(fBiome, fStartId)),
    );

    expect(frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(fBiome, source(fStartId)),
    });
    if (frontier?.kind !== 'exitDecision') throw new Error('F lost its empty decision frontier');
    expect(frontier.hubContinuation).toBeUndefined();
    expect(openingHistory?.postCommit).toBeUndefined();
    expect(openingHistory?.exit).toBeUndefined();
  });

  it('retains the first physical target when the second selected target is invalid', () => {
    const fixture = partialGWithInvalidSecondPhysicalTarget();
    const { evaluation } = prefix(fixture.project, 'Underworld', 'G');
    const frontier = evaluation.assessmentPrefix?.frontier;

    if (frontier?.kind !== 'exitDecision') {
      throw new Error('invalid G target did not clamp at its source decision');
    }
    expect(frontier.origin).toEqual(
      createExitDecisionAddress(goldenGBiome, source(fixture.source)),
    );
    expect(frontier.targets).toMatchObject([
      {
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
        room: { occurrenceId: fixture.firstTarget, gameName: 'G_Combat02' },
      },
    ]);
    expect(evaluation.history.rooms.at(-1)?.targetGenerations).toContainEqual(
      expect.objectContaining({
        targetOrigin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      }),
    );
    expect(evaluation.materializedPrefix.frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(goldenGBiome, source(fixture.firstTarget)),
    });
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
      }),
    );
  });

  it('blocks a later partial-batch target after an invalid generated first door', () => {
    const fixture = partialGWithOnePhysicalTarget();
    const project = applyProjectCommand(authorLegalTraitOffers(fixture.project), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, fixture.firstTarget),
      gameName: 'G_Combat10',
    });
    const { evaluation } = prefix(project, 'Underworld', 'G');

    expect(evaluation.coverage.blockedAt).toEqual(
      createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
    );
    expect(evaluation.assessmentPrefix?.frontier).toMatchObject({
      kind: 'exitDecision',
      targets: [],
    });
    const authoredFrontier = evaluation.materializedPrefix.frontier;
    if (authoredFrontier?.kind !== 'exitDecision') {
      throw new Error('authored G target was lost after an invalid predecessor');
    }
    expect(authoredFrontier.targets.map((target) => target.room.occurrenceId)).toContain(
      fixture.firstTarget,
    );
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
      }),
    );
    expect(
      bindTestCandidateSession(catalog, project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('records an unselected takeover’s complete physical target set at its nullable frontier', () => {
    const { evaluation } = prefix(createUnselectedFTakeoverProject(), 'Underworld', 'F');
    const frontier = evaluation.materializedPrefix.frontier;

    expect(frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(fBiome, source(fCombatId)),
      selectedExitKey: null,
      targets: [
        { exit: { exitKey: 'exit1' }, room: { gameName: 'F_PreBoss01' }, picked: false },
        { exit: { exitKey: 'exit2' }, room: { gameName: 'F_PreBoss01' }, picked: false },
      ],
    });
    expect(
      evaluation.history.events.filter(
        (event) =>
          event.kind === 'roomCreated' &&
          event.source === 'generatedTarget' &&
          event.parentOrigin.kind === 'occurrence' &&
          event.parentOrigin.occurrenceId === fCombatId,
      ),
    ).toHaveLength(2);
  });

  it('clamps a same-batch reward failure before a later physical target failure', () => {
    const fixture = partialGWithEarlierInvalidReward();
    const { evaluation } = prefix(fixture.project, 'Underworld', 'G');

    expect(evaluation.coverage.blockedAt).toEqual(
      createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
    );
    expect(evaluation.assessmentPrefix?.frontier).toMatchObject({
      kind: 'exitDecision',
      targets: [
        {
          origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit1'),
          room: { occurrenceId: fixture.firstTarget },
        },
        {
          origin: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        },
      ],
    });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(goldenGBiome, fixture.firstTarget),
        value: { rewardType: 'MetaCurrencyBigDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-invalid-g-combat10'),
        ),
        value: { rewardType: 'MetaCurrencyBigDrop' },
      }),
    ).toMatchObject({ kind: 'unavailable' });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'roomTarget' });
  });

  it('replays every physical peer when a later forced room changes the shared batch store', () => {
    const target = goldenFOccurrenceId(5, 2);
    let project = applyProjectCommand(authorLegalTraitOffers(createGoldenFGHIProject()), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, target),
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, target),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(createIncomingRewardAddress(goldenFBiome, target), 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
          { traitKey: 'HestiaManaBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });

    const assembly = simulateProjectAssembly(catalog, project);
    expect(() => simulateProject(catalog, project)).not.toThrow();
    const evaluation = assembly.evaluation.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(assembly).biomeAt(goldenFBiome);
    const firstReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(5, 1));
    const laterReward = createIncomingRewardAddress(goldenFBiome, target);
    expect(artifacts?.rewardProducers.at(firstReward)).toMatchObject({
      acquisitionHorizon: 'ownEnteredLifecycle',
      resolvedStoreKey: 'RunProgress',
    });
    expect(artifacts?.rewardProducers.at(laterReward)).toBeUndefined();
    expect(
      artifacts?.traitOffers.at(createTraitOfferAddress(laterReward, 'source')),
    ).toBeUndefined();
    expect(evaluation).toMatchObject({
      authoring: 'complete',
      validity: 'invalid',
      coverage: { kind: 'prefix' },
    });
    expect(evaluation?.coverage).toMatchObject({
      blockedAt: firstReward,
    });
    expect(evaluation?.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: firstReward,
      }),
    );
  });

  it('orders a target offer before the same room encounter independently of subsystem assembly', () => {
    const target = goldenGOccurrenceId(1, 1);
    const encounter = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: target },
      'Encounter',
    );
    let project = authorLegalTraitOffers(createCompleteFGProject());
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenGBiome, target),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ZeusUpgrade',
          spurnedSource: 'PoseidonUpgrade',
        },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: encounter,
      encounterKey: 'ArtemisCombatG',
    });
    const encounterCatalog = catalogWithImpossibleEncounter('ArtemisCombatG');
    const assembly = simulateProjectAssembly(encounterCatalog, project);
    const evaluation = assembly.evaluation.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (
      evaluation?.authoring !== 'complete' ||
      evaluation.validity !== 'invalid' ||
      evaluation.coverage.kind !== 'prefix'
    ) {
      throw new Error('same-room chronology fixture did not produce an invalid prefix');
    }
    const reward = createIncomingRewardAddress(goldenGBiome, target);

    expect(evaluation.coverage.blockedAt).toEqual(reward);
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardSourceUnavailable', origin: reward }),
    );
    expect(evaluation.findings).not.toContainEqual(expect.objectContaining({ origin: encounter }));
    expect(
      candidateArtifactsForProjectEvaluationAssembly(assembly)
        .biomeAt(goldenGBiome)
        ?.encounters.at(encounter),
    ).toBeUndefined();
  });

  it('orders sibling additional continuations before normal targets deterministically', () => {
    const fixture = partialFWithInvalidSiblingAdditionsAndNormalTarget();
    const evaluate = () => {
      const evaluation = simulateProject(fixture.evaluationCatalog, fixture.project)
        .routes.find((candidate) => candidate.routeKey === 'Underworld')
        ?.biomes.find((candidate) => candidate.biomeKey === 'F');
      if (
        evaluation?.authoring !== 'incomplete' ||
        evaluation.validity !== 'invalid' ||
        evaluation.coverage.kind !== 'prefix'
      ) {
        throw new Error('additional ordering fixture did not produce an invalid prefix');
      }
      return evaluation;
    };
    const first = evaluate();
    const second = evaluate();

    expect(first.coverage).toMatchObject({ kind: 'prefix', blockedAt: fixture.naturalChaos });
    expect(second.coverage).toMatchObject({ kind: 'prefix', blockedAt: fixture.naturalChaos });
    expect(first.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: fixture.naturalChaos,
        evidence: expect.objectContaining({ kind: 'naturalChaos' }),
      }),
    );
    expect(first.findings).not.toContainEqual(
      expect.objectContaining({ origin: fixture.zagreusContract }),
    );
    expect(first.findings).not.toContainEqual(
      expect.objectContaining({
        origin: createTargetAddress(goldenFBiome, source(fixture.shop), 'exit1'),
      }),
    );
  });

  it('clamps an invalid semantic replacement before later generated decisions without deleting it', () => {
    const project = applyProjectCommand(
      createFGenerationProject(undefined, { includeTakeover: false }),
      catalog,
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(fGenerationBiome, fGenerationOccurrenceId(1, 1)),
        gameName: 'F_Combat14',
      },
    );
    const { evaluation } = prefix(project, 'Underworld', 'F');

    expect(evaluation.coverage.blockedAt).toEqual(
      createTargetAddress(
        fGenerationBiome,
        source(createOccurrenceId('possibility-start')),
        'exit1',
      ),
    );
    expect(evaluation.assessmentPrefix?.decisions).toHaveLength(0);
    expect(evaluation.materializedPrefix.decisions).toHaveLength(10);
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable' }),
    );
  });

  it('keeps a missing I topology unevaluated without blocking its already valid F-through-H prefix', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ClearTopology',
      biome: goldenIBiome,
    });
    const evaluatedRoute = route(project, 'Underworld');
    const i = evaluatedRoute.biomes.find((candidate) => candidate.biomeKey === 'I');
    if (i === undefined) throw new Error('fixture lost I');

    expect(evaluatedRoute.processing).toEqual({
      completeValidPrefix: ['F', 'G', 'H'],
      active: { kind: 'incomplete', biomeKey: 'I' },
      blockedSuffix: [],
    });
    expect(i).toMatchObject({ authoring: 'incomplete', coverage: { kind: 'none' } });
    expect('materializedPrefix' in i).toBe(false);
  });

  it('strengthens the same complete routes to canonical products and remains deterministic', () => {
    const underworld = createGoldenFGHIProject();
    const surface = loadSurfaceNOPQProject();
    const firstUnderworld = simulateProject(catalog, underworld);
    const secondUnderworld = simulateProject(catalog, underworld);
    const surfaceResult = simulateProject(catalog, surface);

    expect(secondUnderworld).toEqual(firstUnderworld);
    for (const { result, routeKey } of [
      { result: firstUnderworld, routeKey: 'Underworld' },
      { result: surfaceResult, routeKey: 'Surface' },
    ] as const) {
      const evaluatedRoute = result.routes.find((candidate) => candidate.routeKey === routeKey);
      if (evaluatedRoute === undefined) throw new Error(`missing ${routeKey} route`);
      expect(evaluatedRoute.processing.active).toBeNull();
      expect(evaluatedRoute.processing.blockedSuffix).toEqual([]);
      expect(evaluatedRoute.biomes).toHaveLength(4);
      expect(evaluatedRoute.biomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            authoring: 'complete',
            validity: 'valid',
            coverage: { kind: 'complete' },
          }),
        ]),
      );
    }
    expect(Object.isFrozen(firstUnderworld)).toBe(true);
    expect(Object.isFrozen(firstUnderworld.routes)).toBe(true);
  });

  it('keeps every active occurrence in the representative F-through-Q fixtures closed over required actions', () => {
    const missing: string[] = [];
    for (const project of [createGoldenFGHIProject(), loadSurfaceNOPQProject()]) {
      for (const route of project.routes) {
        for (const plan of route.biomes) {
          if (plan.topology === null) continue;
          const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
          for (const occurrenceId of structurallyActiveOccurrenceIds(plan.topology)) {
            const resolved = roomActionDomainForOccurrence(project, catalog, biome, occurrenceId);
            if (resolved === undefined)
              throw new Error(`missing active ${plan.biomeKey} occurrence`);
            const authored = new Set(resolved.occurrence.roomActions.order.map(roomActionKey));
            for (const contribution of resolved.domain.contributions) {
              if (
                contribution.kind === 'action' &&
                contribution.participation === 'required' &&
                !authored.has(roomActionKey(contribution.reference))
              ) {
                missing.push(
                  `${route.routeKey}/${plan.biomeKey}/${occurrenceId}/${roomActionKey(contribution.reference)}`,
                );
              }
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
