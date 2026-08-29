import { describe, expect, it } from 'vitest';

import * as fixture from './support/progressive-biome-fixtures';

const {
  applyProjectCommand,
  authorLegalTraitOffers,
  catalog,
  catalogWithImpossibleEncounter,
  candidateArtifactsForProjectEvaluationAssembly,
  composeBiomeHistoryPrefix,
  createCompleteFGProject,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createRouteAddress,
  createTargetAddress,
  createTraitOfferAddress,
  evaluateBiomeRewards,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  createGoldenFGHProject,
  materializeBiomePrefix,
  partialFWithInvalidSiblingAdditionsAndNormalTarget,
  simulateProject,
  simulateProjectAssembly,
  source,
} = fixture;

describe('progressive finding ancestry and chronology', () => {
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
        evidence: expect.objectContaining({ kind: 'chaos' }),
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
});
