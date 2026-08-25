import { describe, expect, it } from 'vitest';

import * as fixture from './support/progressive-biome-fixtures';

const {
  applyProjectCommand,
  authorLegalTraitOffers,
  bindTestCandidateSession,
  catalog,
  candidateArtifactsForProjectEvaluationAssembly,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  createTraitOfferAddress,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  createGoldenFGHIProject,
  partialGWithEarlierInvalidReward,
  prefix,
  simulateProject,
  simulateProjectAssembly,
  source,
} = fixture;

describe('progressive clamp products', () => {
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
});
