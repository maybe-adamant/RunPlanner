import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  CandidateEvaluationContractError,
  createPreparedProjectCandidateSession,
  simulateProject,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';

import {
  createCompleteFTakeoverProject,
  createFStart,
  createUnresolvedFOpeningBatch,
  fBiome,
  fCombatId,
  fDecision,
  fStartId,
} from './support/f-takeover-project';
import { createRepresentativeNProject, nBiome } from '../../../../test/fixtures/authored-project';

const gBiome = createBiomeAddress('Underworld', 'G');
const gStartId = createOccurrenceId('candidate-g-start');

function withGTarget(project: ProjectDocument) {
  let next = applyProjectCommand(project, catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 2,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: gStartId,
  });
  const source = { kind: 'occurrence' as const, occurrenceId: gStartId };
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(gBiome, source),
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(gBiome, source),
    storeKey: 'RunProgress',
  });
  return applyProjectCommand(next, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(gBiome, source, 'exit1'),
    occurrenceId: createOccurrenceId('candidate-g-target'),
    gameName: 'G_Combat01',
  });
}

describe('candidate session', () => {
  it('binds one immutable project/evaluation pair and batches direct start and store domains', () => {
    const project = createCompleteFTakeoverProject();
    const evaluation = simulateProject(catalog, project);
    const events: CandidateEvaluationEvent[] = [];
    const session = createPreparedProjectCandidateSession(catalog, project, evaluation, {
      observe: (event) => events.push(event),
    });
    const store = createBatchRewardStoreAddress(fBiome, fDecision().source);
    const results = session.evaluate([
      {
        kind: 'startRoom',
        owner: createOccurrenceAddress(fBiome, fStartId),
        gameName: 'F_Opening02',
      },
      {
        kind: 'startRoom',
        owner: createOccurrenceAddress(fBiome, fStartId),
        gameName: 'F_Combat01',
      },
      { kind: 'batchRewardStore', rewardStore: store, storeKey: 'MetaProgress' },
      { kind: 'batchRewardStore', rewardStore: store, storeKey: 'RunProgress' },
    ]);

    expect(session.project).toBe(project);
    expect(session.evaluation).toBe(evaluation);
    expect(events).toEqual([{ kind: 'queryBatch', queryCount: 4 }]);
    expect(results).toMatchObject([
      {
        kind: 'startRoom',
        result: {
          supportedGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
          selectedPossible: true,
        },
      },
      { kind: 'startRoom', result: { selectedPossible: false } },
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'MetaProgress', selectedPossible: true },
      },
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'RunProgress', selectedPossible: false },
      },
    ]);
  });

  it('evaluates an authored incoming reward from its captured producer frontier', () => {
    const project = createCompleteFTakeoverProject();
    const occurrence = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === 'f-takeover-combat',
    );
    if (occurrence?.state.kind !== 'counted') {
      throw new Error('F fixture must retain a counted combat reward');
    }
    const result = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    ).evaluate({
      kind: 'incomingReward',
      reward: createIncomingRewardAddress(fBiome, occurrence.occurrenceId),
      value: occurrence.state.offer,
    });

    expect(result).toMatchObject({
      kind: 'incomingReward',
      result: { supported: true, findings: [] },
    });
  });

  it('evaluates an unresolved batch store from the source prefix and blocks its target', () => {
    const project = createUnresolvedFOpeningBatch(createFStart());
    const session = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    );
    const rewardStore = createBatchRewardStoreAddress(fBiome, fDecision().source);
    const target = createTargetAddress(fBiome, fDecision().source, 'exit1');

    const results = session.evaluate([
      { kind: 'batchRewardStore', rewardStore, storeKey: 'RunProgress' },
      { kind: 'batchRewardStore', rewardStore, storeKey: 'MetaProgress' },
      { kind: 'roomTarget', target, gameName: 'F_Combat02' },
    ]);

    expect(results).toMatchObject([
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'RunProgress', selectedPossible: false },
      },
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'MetaProgress', selectedPossible: true },
      },
      {
        kind: 'unavailable',
        reason: 'authoredPrerequisiteMissing',
        evidence: {
          kind: 'authoredPrerequisiteMissing',
          prerequisite: { kind: 'batchRewardStore', owner: rewardStore },
        },
      },
    ]);
  });

  it('evaluates ordinary targets and the takeover Preboss at their distinct semantic owners', () => {
    const project = createCompleteFTakeoverProject();
    const session = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    );
    const results = session.evaluate([
      {
        kind: 'roomTarget',
        target: createTargetAddress(fBiome, fDecision().source, 'exit1'),
        gameName: 'F_Combat02',
      },
      {
        kind: 'takeoverPrebossBatch',
        source: fDecision(fCombatId),
        gameName: 'F_PreBoss01',
      },
    ]);

    expect(results).toMatchObject([
      {
        kind: 'roomTarget',
        result: { pressure: { selectedGameName: 'F_Combat02', selectedPossible: true } },
      },
      {
        kind: 'takeoverPrebossBatch',
        result: {
          gameName: 'F_PreBoss01',
          requiredExitKeys: ['exit1', 'exit2'],
          requiredTargetCount: 2,
          selectedPossible: false,
          pressure: expect.arrayContaining([
            expect.objectContaining({
              selectedGameName: 'F_PreBoss01',
              selectedPossible: false,
              selectedExclusionReasons: ['forceMinimum', 'eligibilityRequirement'],
            }),
          ]),
        },
      },
    ]);
    expect(() =>
      session.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(fBiome, fDecision(fCombatId).source, 'exit1'),
        gameName: 'F_PreBoss01',
      }),
    ).toThrow(/source-owned takeover Preboss batch/);
  });

  it('does not expose a Preboss Shop after its invalid selection boundary', () => {
    const project = createCompleteFTakeoverProject();
    const occurrence = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === 'f-takeover-preboss-shop',
    );
    if (occurrence?.state.kind !== 'shop' || occurrence.state.shop === undefined) {
      throw new Error('F fixture must retain a selected Preboss shop');
    }
    const [offerKey, offer] = Object.entries(occurrence.state.shop.offers)[0] ?? [];
    if (offerKey === undefined || offer === undefined)
      throw new Error('F Preboss shop has no offer');
    const results = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    ).evaluate([
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(fBiome, occurrence.occurrenceId, offerKey),
        value: offer.offer,
      },
      {
        kind: 'shopPurchase',
        purchase: createShopPurchaseAddress(fBiome, occurrence.occurrenceId, offerKey),
        purchased: offer.purchased,
      },
    ]);

    expect(results).toMatchObject([
      {
        kind: 'unavailable',
        reason: 'producerFrontierUnavailable',
        evidence: {
          kind: 'producerFrontierUnavailable',
          producer: createShopOfferAddress(fBiome, occurrence.occurrenceId, offerKey),
        },
      },
      {
        kind: 'unavailable',
        reason: 'producerFrontierUnavailable',
        evidence: {
          kind: 'producerFrontierUnavailable',
          producer: createShopPurchaseAddress(fBiome, occurrence.occurrenceId, offerKey),
        },
      },
    ]);
  });

  it('rejects an address outside the source room physical exit domain', () => {
    const project = createCompleteFTakeoverProject();
    const target = createTargetAddress(fBiome, fDecision().source, 'exit2');
    const session = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    );

    expect(() => session.evaluate({ kind: 'roomTarget', target, gameName: 'F_Combat03' })).toThrow(
      /has no declaration-owned physical exit/,
    );
  });

  it('rejects N’s ordinary exit while retaining its completed-Hub takeover domain', () => {
    const openingId = createOccurrenceId('candidate-n-opening');
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'candidate-n-opening-domain',
        name: 'N opening candidate domain',
        configuredBiomeCounts: { Surface: 1 },
      }),
      catalog,
      { kind: 'CreateStart', biome: nBiome, occurrenceId: openingId },
    );
    const session = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    );

    expect(() =>
      session.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(nBiome, {
          kind: 'occurrence',
          occurrenceId: openingId,
        }),
        gameName: 'N_PreBoss01',
      }),
    ).toThrow(CandidateEvaluationContractError);
    expect(() =>
      session.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(nBiome, {
          kind: 'occurrence',
          occurrenceId: openingId,
        }),
        gameName: 'N_PreBoss01',
      }),
    ).toThrow(/no declaration-owned takeover Preboss candidate domain/);

    const withoutHandoff = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(nBiome, {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        withoutHandoff,
        simulateProject(catalog, withoutHandoff),
      ).evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(nBiome, {
          kind: 'hubDecision',
          decisionKey: 'hub',
        }),
        gameName: 'N_PreBoss01',
      }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: { requiredExitKeys: ['preboss'], selectedPossible: true },
    });
  });

  it('distinguishes an incomplete and invalid upstream biome from local coverage', () => {
    const query = {
      kind: 'roomTarget' as const,
      target: createTargetAddress(gBiome, { kind: 'occurrence', occurrenceId: gStartId }, 'exit1'),
      gameName: 'G_Combat02',
    };
    const incomplete = withGTarget(createUnresolvedFOpeningBatch(createFStart()));
    const invalid = withGTarget(
      applyProjectCommand(createCompleteFTakeoverProject(), catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(fBiome, fDecision().source),
        storeKey: 'RunProgress',
      }),
    );

    expect(
      createPreparedProjectCandidateSession(
        catalog,
        incomplete,
        simulateProject(catalog, incomplete),
      ).evaluate(query),
    ).toEqual({
      kind: 'unavailable',
      reason: 'upstreamIncomplete',
      evidence: { kind: 'upstreamIncomplete', upstreamBiomeKey: 'F' },
    });
    const invalidEvaluation = simulateProject(catalog, invalid);
    expect(invalidEvaluation.routes[0]?.biomes[0]).toMatchObject({
      biomeKey: 'F',
      authoring: 'complete',
      validity: 'invalid',
    });
    expect(
      createPreparedProjectCandidateSession(catalog, invalid, invalidEvaluation).evaluate(query),
    ).toEqual({
      kind: 'unavailable',
      reason: 'upstreamInvalid',
      evidence: { kind: 'upstreamInvalid', upstreamBiomeKey: 'F' },
    });
  });
});
