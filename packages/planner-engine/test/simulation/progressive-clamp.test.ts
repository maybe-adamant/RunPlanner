import { describe, expect, it } from 'vitest';
import {
  createEncounterPhaseAddress,
  createRoomFeatureAddress,
  createRoomRunStateCheckpointAddress,
  createRouteAddress,
  type OccurrenceId,
  type ProjectDocument,
  type RoomRunStateCheckpointAddress,
} from '@run-planner/engine/authored-project';
import type { ResourceFamily } from '@run-planner/engine/catalog-schema';
import { pBiome, surfaceEncounterShowcaseProject } from '@run-planner/test-fixtures/surface';

import * as fixture from './support/progressive-biome-fixtures';

const {
  applyProjectCommand,
  authorLegalTraitOffers,
  bindTestCandidateSession,
  catalog,
  candidateArtifactsForProjectEvaluationAssembly,
  createExitDecisionAddress,
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
  semanticAddressKey,
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
        // The run-scoped ledger keeps both G batches on the Meta bag.
        value: { rewardType: 'MetaCardPointsCommonBigDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('progressive-invalid-g-combat10'),
        ),
        value: { rewardType: 'MetaCardPointsCommonBigDrop' },
      }),
    ).toMatchObject({ kind: 'unavailable' });
    expect(
      bindTestCandidateSession(catalog, fixture.project).evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(goldenGBiome, source(fixture.source), 'exit2'),
        gameName: 'G_Combat02',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
    const retainedBatch = evaluation.roomGeneration.ordinary.ordinaryBatches.find(
      (batch) =>
        semanticAddressKey(batch.origin) ===
        semanticAddressKey(createExitDecisionAddress(goldenGBiome, source(fixture.source))),
    );
    expect(retainedBatch?.targets.map((target) => target.origin.exitKey)).toEqual(['exit1']);
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
    const evaluation = assembly.evaluation.route?.biomes.find(
      (candidate) => candidate.biomeKey === 'F',
    );
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

const pCombat02 = fixture.createOccurrenceId('surface-p-2-1-p_combat02');
const pCombat04 = fixture.createOccurrenceId('surface-p-3-1-p_combat04');
const pCombat07 = fixture.createOccurrenceId('surface-p-4-1-p_combat07');

function placeResource(project: ProjectDocument, family: ResourceFamily): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceResourcePlacement',
    route: createRouteAddress('Surface'),
    family,
    value: { biomeKey: 'P', occurrenceId: pCombat04 },
  });
}

/** An unsupported generated composition stops P_Combat07 at its own preparation. */
function blockPCombat07(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pCombat07 },
      'Intro',
    ),
    decisionKey: 'generatedComposition',
    value: {
      kind: 'generated',
      baseRoll: 9999,
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['SentryBot', 'Dragon'], allocations: { SentryBot: 206 } }],
    },
  });
}

function biomeEvaluation(project: ProjectDocument, biomeKey: string) {
  const evaluation = simulateProject(catalog, project).route?.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (
    evaluation === undefined ||
    !('assessmentPrefix' in evaluation) ||
    evaluation.coverage.kind !== 'prefix'
  )
    throw new Error(`${biomeKey} lost its blocked evaluation`);
  return Object.freeze({ ...evaluation, coverage: evaluation.coverage });
}

function runStateAvailability(
  evaluation: ReturnType<typeof biomeEvaluation>,
  owner: RoomRunStateCheckpointAddress,
) {
  return evaluation.rewards.runStateAvailability.find(
    (entry) => semanticAddressKey(entry.owner) === semanticAddressKey(owner),
  )?.availability;
}

function exited(evaluation: ReturnType<typeof biomeEvaluation>, occurrenceId: OccurrenceId) {
  return evaluation.history.events.some(
    (event) =>
      event.kind === 'roomExited' &&
      event.origin.kind === 'occurrence' &&
      event.origin.occurrenceId === occurrenceId,
  );
}

describe('source room exit before a later block', () => {
  it('settles the source room exit and its resource before a next-room block', () => {
    const p = biomeEvaluation(
      blockPCombat07(placeResource(surfaceEncounterShowcaseProject(), 'Pickaxe')),
      'P',
    );

    expect(p.coverage.blockedAt).toEqual(
      createEncounterPhaseAddress(pBiome, { kind: 'occurrence', occurrenceId: pCombat07 }, 'Intro'),
    );
    expect(exited(p, pCombat04)).toBe(true);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat04), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('available');
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat07), {
          kind: 'roomEntered',
        }),
      ),
    ).toBe('unavailable');
    for (const branch of p.rewards.branches)
      expect(branch.state.traitHistory.events).toContainEqual(
        expect.objectContaining({
          kind: 'elementContribution',
          owner: createOccurrenceAddress(pBiome, pCombat04),
          acquisitionPoint: 'roomExited',
        }),
      );
  });

  it('blocks at the source room exit when its own exit work fails', () => {
    const p = biomeEvaluation(
      blockPCombat07(placeResource(surfaceEncounterShowcaseProject(), 'Fishing')),
      'P',
    );

    expect(p.coverage.blockedAt).toEqual(
      createRoomFeatureAddress(createOccurrenceAddress(pBiome, pCombat04), {
        kind: 'resource',
        family: 'Fishing',
      }),
    );
    // The preceding room P_Combat02 still settles its own exit.
    expect(exited(p, pCombat02)).toBe(true);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat02), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('available');
    expect(exited(p, pCombat04)).toBe(false);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat04), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('unavailable');
  });

  it('keeps an invalid door offer before the source room exit', () => {
    const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(pBiome, pCombat07),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const p = biomeEvaluation(project, 'P');

    expect(p.coverage.blockedAt).toEqual(createIncomingRewardAddress(pBiome, pCombat07));
    expect(p.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(pBiome, pCombat07),
      }),
    );
    // Doors are generated before the source room's purchases, commit and exit.
    expect(exited(p, pCombat04)).toBe(false);
    expect(
      runStateAvailability(
        p,
        createRoomRunStateCheckpointAddress(createOccurrenceAddress(pBiome, pCombat04), {
          kind: 'beforeRoomExit',
        }),
      ),
    ).toBe('unavailable');
    expect(
      bindTestCandidateSession(catalog, project).evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(pBiome, pCombat07),
        value: { rewardType: 'HermesUpgrade' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
  });
});
