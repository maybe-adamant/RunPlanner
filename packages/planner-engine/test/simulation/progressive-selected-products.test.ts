import { describe, expect, it } from 'vitest';

import * as fixture from './support/progressive-biome-fixtures';
import { requireTraits } from '@run-planner/test-fixtures/shared';
import {
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createLocalRewardAddress,
  createTraitAcquisitionTargetAddress,
} from '@run-planner/engine/authored-project';

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
  goldenHBiome,
  createGoldenFGHIProject,
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
  it('retains the complete H batch when its picked miniboss trait child blocks', () => {
    const completeProject = authorLegalTraitOffers(createGoldenFGHIProject());
    const complete = simulateProject(catalog, completeProject)
      .routes.find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (complete?.authoring !== 'complete' || complete.validity !== 'valid') {
      throw new Error('H fixture did not produce a complete-valid baseline');
    }
    const selected = complete.rewards.selectedTraitOffers.find(
      (offer) =>
        offer.address.owner.kind === 'incomingReward' &&
        offer.address.owner.occurrenceId === 'golden-h-miniboss01',
    );
    if (selected === undefined) throw new Error('H miniboss has no selected trait offer');
    const offer = requireTraits(selected.offer);
    const [first, second, third] = offer.options;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('H miniboss trait offer is incomplete');
    }
    const blockedTrait = selected.address;
    const blockedProject = applyProjectCommand(completeProject, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: blockedTrait,
      value: {
        kind: 'traits',
        giverKey: offer.giverKey,
        options: [{ ...first, rarity: 'Heroic' }, second, third],
        selectedOptionKey: 'option1',
      },
    });
    const blocked = simulateProject(catalog, blockedProject)
      .routes.find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (blocked?.authoring !== 'complete' || blocked.validity !== 'invalid') {
      throw new Error('H miniboss trait block did not produce a complete-invalid prefix');
    }

    const selectedBatch = complete.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.targets.some((target) => target.room.occurrenceId === 'golden-h-miniboss01'),
    );
    if (selectedBatch?.kind !== 'batch') throw new Error('H miniboss batch is missing');
    const baselineBatch = complete.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(selectedBatch.origin),
    );
    const retainedBatch = blocked.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(selectedBatch.origin),
    );
    expect(blocked.coverage.blockedAt).toEqual(blockedTrait);
    expect(baselineBatch?.fields).toMatchObject({
      selectedOutcome: 'max',
      fieldsMaxDoorsRolled: 0,
      maxDoorCageCeiling: 2,
    });
    expect(retainedBatch?.fields).toEqual(baselineBatch?.fields);
    expect(retainedBatch?.targets.map((target) => semanticAddressKey(target.origin))).toEqual(
      baselineBatch?.targets.map((target) => semanticAddressKey(target.origin)),
    );
    expect(retainedBatch?.targets).toHaveLength(2);
    const blockedAssembly = simulateProjectAssembly(catalog, blockedProject);
    const blockedArtifacts =
      candidateArtifactsForProjectEvaluationAssembly(blockedAssembly).biomeAt(goldenHBiome);
    const peerTarget = selectedBatch.targets[1];
    if (peerTarget === undefined) throw new Error('H miniboss batch has no physical peer');
    expect(blockedArtifacts?.roomTargets.at(peerTarget.origin)).toBeDefined();
    const laterBatch = complete.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.origin.source.kind === 'occurrence' &&
        decision.origin.source.occurrenceId === 'golden-h-miniboss01',
    );
    if (laterBatch?.kind !== 'batch') throw new Error('H later batch is missing');
    const laterTarget = laterBatch.targets[0];
    if (laterTarget === undefined) throw new Error('H later batch has no target');
    expect(blockedArtifacts?.roomTargets.at(laterTarget.origin)).toBeUndefined();
    expect(blocked.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({ address: blockedTrait }),
    );
    const sourceHistory = blocked.history.rooms.find(
      (room) =>
        room.origin.kind === 'occurrence' && room.origin.occurrenceId === 'golden-h-combat09',
    );
    expect(sourceHistory).toBeDefined();
    expect(sourceHistory?.targetGenerations).toHaveLength(0);
    expect(
      blocked.history.events.some(
        (event) =>
          event.kind === 'roomCreated' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === 'golden-h-miniboss01',
      ),
    ).toBe(false);
  });

  it('retains the complete normal batch when selected Chaos blocks at its trait child', () => {
    const sourceOccurrenceId = goldenFOccurrenceId(1, 1);
    const chaosOccurrenceId = createOccurrenceId('progressive-selected-chaos');
    const additional = createAdditionalExitAddress(goldenFBiome, sourceOccurrenceId, 'chaos');
    const completeProject = authorLegalTraitOffers(createCompleteFGProject());
    const complete = simulateProject(catalog, completeProject)
      .routes.find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (complete?.authoring !== 'complete' || complete.validity !== 'valid') {
      throw new Error('selected Chaos fixture has no complete-valid F baseline');
    }
    let blockedProject = applyProjectCommand(completeProject, catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaosOccurrenceId,
    });
    blockedProject = applyProjectCommand(blockedProject, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenFBiome, source(goldenFOccurrenceId(2, 1))),
    });
    blockedProject = applyProjectCommand(blockedProject, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, source(sourceOccurrenceId)),
      value: { kind: 'additional', additionalExitKey: 'chaos' },
    });
    const chaosSource = source(chaosOccurrenceId);
    const laterTarget = createTargetAddress(goldenFBiome, chaosSource, 'exit1');
    blockedProject = applyProjectCommand(blockedProject, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(goldenFBiome, chaosSource),
    });
    blockedProject = applyProjectCommand(blockedProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, chaosSource),
      storeKey: 'RunProgress',
    });
    blockedProject = applyProjectCommand(blockedProject, catalog, {
      kind: 'CreateTarget',
      target: laterTarget,
      occurrenceId: createOccurrenceId('progressive-selected-chaos-return'),
      gameName: 'F_Combat02',
    });
    const blockedAssembly = simulateProjectAssembly(catalog, blockedProject);
    const blocked = blockedAssembly.evaluation.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (
      blocked === undefined ||
      blocked.validity !== 'invalid' ||
      blocked.coverage.kind !== 'prefix' ||
      !('roomGeneration' in blocked) ||
      !('rewards' in blocked)
    ) {
      throw new Error('selected Chaos fixture did not block at its unresolved trait child');
    }
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, chaosOccurrenceId),
      'self',
    );
    const containingDecision = complete.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.origin.source.kind === 'occurrence' &&
        decision.origin.source.occurrenceId === sourceOccurrenceId,
    );
    if (containingDecision?.kind !== 'batch') {
      throw new Error('selected Chaos containing decision is missing');
    }
    const baselineAssessment = complete.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(containingDecision.origin),
    );
    const retainedAssessment = blocked.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(containingDecision.origin),
    );
    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(blockedAssembly).biomeAt(goldenFBiome);
    const session = createPreparedProjectCandidateSession(catalog, blockedAssembly);

    expect(blocked.coverage.blockedAt).toEqual(trait);
    expect(retainedAssessment?.targets.map((target) => semanticAddressKey(target.origin))).toEqual(
      baselineAssessment?.targets.map((target) => semanticAddressKey(target.origin)),
    );
    expect(retainedAssessment?.targets).toHaveLength(containingDecision.targets.length);
    expect(session.traitOfferStartingDraft(trait, 'Chaos')).toMatchObject({
      kind: 'traits',
      giverKey: 'Chaos',
    });
    expect(artifacts?.roomTargets.at(laterTarget)).toBeUndefined();
    expect(
      blocked.rewards.branches
        .flatMap((branch) => branch.traitHistory?.events ?? [])
        .some((event) => event.kind === 'traitOffer' && event.giverKey === 'Chaos'),
    ).toBe(false);
  });

  it('retains the complete H batch and target repair capability when Bridal Glow lacks its target', () => {
    const reward = createIncomingRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-miniboss01'),
    );
    const trait = createTraitOfferAddress(reward, 'source');
    const completeOffer = {
      kind: 'traits' as const,
      giverKey: 'Hera',
      options: [
        {
          traitKey: 'BoonDecayBoon',
          rarity: 'Common' as const,
          targetTraitKey: 'ApolloWeaponBoon',
        },
        { traitKey: 'DamageShareRetaliateBoon', rarity: 'Common' as const },
        { traitKey: 'HeraManaBoon', rarity: 'Rare' as const },
      ] as const,
      selectedOptionKey: 'option1' as const,
    };
    let completeProject = applyProjectCommand(
      authorLegalTraitOffers(createGoldenFGHIProject()),
      catalog,
      {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
      },
    );
    completeProject = applyProjectCommand(completeProject, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: completeOffer,
    });
    const complete = simulateProject(catalog, completeProject)
      .routes.find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (complete?.authoring !== 'complete' || complete.validity !== 'valid') {
      throw new Error('targeted trait fixture did not produce a complete-valid baseline');
    }
    const blockedOffer = {
      ...completeOffer,
      options: [
        { traitKey: 'BoonDecayBoon', rarity: 'Common' as const },
        completeOffer.options[1],
        completeOffer.options[2],
      ] as const,
    };
    const blockedProject = applyProjectCommand(completeProject, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: blockedOffer,
    });
    const blockedAssembly = simulateProjectAssembly(catalog, blockedProject);
    const blocked = blockedAssembly.evaluation.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (
      blocked?.authoring !== 'complete' ||
      blocked.validity !== 'invalid' ||
      blocked.coverage.kind !== 'prefix'
    ) {
      throw new Error('targeted trait fixture did not produce a complete-invalid prefix');
    }
    const child = createTraitAcquisitionTargetAddress(trait, 'option1');
    const containingBatch = complete.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.targets.some((target) => target.room.occurrenceId === 'golden-h-miniboss01'),
    );
    if (containingBatch?.kind !== 'batch') throw new Error('targeted trait batch is missing');
    const baselineAssessment = complete.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(containingBatch.origin),
    );
    const retainedAssessment = blocked.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(containingBatch.origin),
    );
    const laterBatch = complete.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.origin.source.kind === 'occurrence' &&
        decision.origin.source.occurrenceId === 'golden-h-miniboss01',
    );
    if (laterBatch?.kind !== 'batch' || laterBatch.targets[0] === undefined) {
      throw new Error('targeted trait later target is missing');
    }
    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(blockedAssembly).biomeAt(goldenHBiome);
    const session = createPreparedProjectCandidateSession(catalog, blockedAssembly);

    expect(blocked.coverage.blockedAt).toEqual(child);
    expect(retainedAssessment).toEqual(baselineAssessment);
    expect(artifacts?.traitOffers.at(trait)).toBeDefined();
    expect(
      session.evaluate({
        kind: 'traitAcquisitionTargetDomain',
        trait,
        value: blockedOffer,
        optionKey: 'option1',
      }),
    ).toMatchObject({
      kind: 'traitAcquisitionTargetDomain',
      result: {
        sourceTraitKey: 'BoonDecayBoon',
        candidates: expect.arrayContaining([
          expect.objectContaining({
            result: expect.objectContaining({
              traitKey: 'ApolloWeaponBoon',
              supported: true,
            }),
          }),
        ]),
      },
    });
    expect(artifacts?.roomTargets.at(laterBatch.targets[0].origin)).toBeUndefined();
    const traitEvents = blocked.rewards.branches
      .flatMap((branch) => branch.traitHistory?.events ?? [])
      .filter(
        (event) =>
          event.kind === 'traitOffer' &&
          event.options.some((option) => option.traitKey === 'BoonDecayBoon'),
      );
    const traitEvent = traitEvents[0];
    if (traitEvent?.kind !== 'traitOffer') {
      throw new Error('blocked Bridal Glow offer event is missing');
    }
    expect(traitEvents).toHaveLength(1);
    expect(traitEvent.targetedAcquisitionTransition).toBeUndefined();
    expect(
      blocked.rewards.branches
        .flatMap((branch) => branch.traitHistory?.events ?? [])
        .some(
          (event) => event.kind === 'levelMutation' && event.sourceTraitKey === 'BoonDecayBoon',
        ),
    ).toBe(false);
  });

  it('retains the complete H batch and level repair capability when a Pom target is unresolved', () => {
    const completeProject = authorLegalTraitOffers(createGoldenFGHIProject());
    const complete = simulateProject(catalog, completeProject)
      .routes.find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (complete?.authoring !== 'complete' || complete.validity !== 'valid') {
      throw new Error('Pom fixture did not produce a complete-valid baseline');
    }
    const reward = createLocalRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-combat05'),
      'cages',
      'cage1',
    );
    const level = createLevelResolutionAddress(reward, 'self');
    const blockedProject = applyProjectCommand(completeProject, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: level,
      value: {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon', 'HeraCastBoon'],
        selectedTraitKey: null,
      },
    });
    const blockedAssembly = simulateProjectAssembly(catalog, blockedProject);
    const blocked = blockedAssembly.evaluation.routes
      .find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (
      blocked?.authoring !== 'complete' ||
      blocked.validity !== 'invalid' ||
      blocked.coverage.kind !== 'prefix'
    ) {
      throw new Error('Pom fixture did not produce a complete-invalid prefix');
    }
    const containingBatch = complete.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.targets.some((target) => target.room.occurrenceId === 'golden-h-combat05'),
    );
    if (containingBatch?.kind !== 'batch') throw new Error('Pom containing batch is missing');
    const baselineAssessment = complete.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(containingBatch.origin),
    );
    const retainedAssessment = blocked.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) => semanticAddressKey(batch.origin) === semanticAddressKey(containingBatch.origin),
    );
    const laterBatch = complete.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.origin.source.kind === 'occurrence' &&
        decision.origin.source.occurrenceId === 'golden-h-combat05',
    );
    if (laterBatch?.kind !== 'batch' || laterBatch.targets[0] === undefined) {
      throw new Error('Pom later target is missing');
    }
    const artifacts =
      candidateArtifactsForProjectEvaluationAssembly(blockedAssembly).biomeAt(goldenHBiome);

    expect(blocked.coverage.blockedAt).toEqual(level);
    expect(retainedAssessment).toEqual(baselineAssessment);
    expect(artifacts?.levelResolutions.at(level)).toBeDefined();
    expect(artifacts?.roomTargets.at(laterBatch.targets[0].origin)).toBeUndefined();
    expect(
      blocked.rewards.branches
        .flatMap((branch) => branch.traitHistory?.events ?? [])
        .some(
          (event) =>
            event.kind === 'levelMutation' &&
            semanticAddressKey(event.owner) === semanticAddressKey(level),
        ),
    ).toBe(false);
  });

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
