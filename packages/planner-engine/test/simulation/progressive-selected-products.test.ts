import { describe, expect, it } from 'vitest';

import * as fixture from './support/progressive-biome-fixtures';

const {
  EMPTY_RESOURCE_PLACEMENTS,
  applyProjectCommand,
  authorLegalTraitOffers,
  authorTestArtificerReplacement,
  bindTestCandidateSession,
  catalog,
  candidateArtifactsForProjectEvaluationAssembly,
  createCompleteFGProject,
  createFConversionFrontierProject,
  createFGenerationProject,
  createFInvalidLaterConversionProject,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPreparedProjectCandidateSession,
  createRewardWheelAddress,
  createTargetAddress,
  createTraitOfferAddress,
  defaultRouteLoadout,
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenIBiome,
  createGoldenFGHProject,
  incompleteAtMissingDecision,
  incompleteHFieldsProject,
  incompleteIFieldProject,
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  partialGWithEarlierInvalidReward,
  partialGWithInvalidSecondPhysicalTarget,
  route,
  semanticAddressKey,
  simulateProject,
  simulateProjectAssembly,
  source,
  traitGiverForAcquisitionRole,
} = fixture;

describe('progressive selected and blocked products', () => {
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
    expect(Object.keys(normalLifecycle ?? {})).toEqual([
      'activeWheelKeys',
      'supportedStoreKeysAtGeneration',
      'evaluateState',
      'evaluateStateThroughWheelPick',
    ]);

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
});
