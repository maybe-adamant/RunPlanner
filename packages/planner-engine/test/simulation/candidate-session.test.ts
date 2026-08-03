import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import * as simulationPublic from '@run-planner/engine/simulation';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createShopOfferAddress,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  ProjectSimulationContractError,
  simulateProjectAssembly,
  simulateProject,
  type CandidateEvaluationEvent,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';

import {
  createCompleteFTakeoverProject,
  createFStart,
  createUnresolvedFOpeningBatch,
  fBiome,
  fDecision,
  fStartId,
} from './support/f-takeover-project';
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
  it('binds one immutable project/evaluation pair and preserves batched result order', () => {
    const project = createCompleteFTakeoverProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluation = assembly.evaluation;
    const events: CandidateEvaluationEvent[] = [];
    const session = createPreparedProjectCandidateSession(catalog, assembly, {
      observe: (event) => events.push(event),
    });
    expect(events).toEqual([]);
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
        gameName: 'F_Opening01',
      },
      { kind: 'batchRewardStore', rewardStore: store, storeKey: 'MetaProgress' },
      { kind: 'batchRewardStore', rewardStore: store, storeKey: 'RunProgress' },
    ]);

    expect(session.project).toBe(project);
    expect(session.evaluation).toBe(evaluation);
    expect(events).toEqual([{ kind: 'queryBatch', queryCount: 4 }]);
    expect(results).toMatchObject([
      { kind: 'startRoom', result: { gameName: 'F_Opening02' } },
      { kind: 'startRoom', result: { gameName: 'F_Opening01' } },
      { kind: 'batchRewardStore', result: { selectedStoreKey: 'MetaProgress' } },
      { kind: 'batchRewardStore', result: { selectedStoreKey: 'RunProgress' } },
    ]);
  });

  it('rejects missing, forged, and mixed exact-assembly products', () => {
    const project = createCompleteFTakeoverProject();
    const first = simulateProjectAssembly(catalog, project);
    const second = simulateProjectAssembly(catalog, project);
    const withoutArtifacts = Object.freeze({
      project: first.project,
      evaluation: first.evaluation,
    }) as unknown as ProjectEvaluationAssembly;
    const mixed = Object.freeze({
      project: first.project,
      evaluation: second.evaluation,
    }) as ProjectEvaluationAssembly;
    const forgedPrototype = Object.freeze(
      Object.assign(Object.create(Object.getPrototypeOf(first)), {
        project: first.project,
        evaluation: first.evaluation,
      }),
    ) as ProjectEvaluationAssembly;
    const reflectedAssemblyConstructor = Object.getPrototypeOf(first).constructor;
    const ReflectedAssemblyConstructor = reflectedAssemblyConstructor as unknown as new (
      project: ProjectDocument,
      evaluation: ProjectEvaluation,
      candidateArtifacts: unknown,
    ) => ProjectEvaluationAssembly;

    expect(() => createPreparedProjectCandidateSession(catalog, withoutArtifacts)).toThrow(
      ProjectSimulationContractError,
    );
    expect(() => createPreparedProjectCandidateSession(catalog, mixed)).toThrow(
      /was not produced by this simulator execution/,
    );
    expect(() => createPreparedProjectCandidateSession(catalog, forgedPrototype)).toThrow(
      ProjectSimulationContractError,
    );
    expect('candidateArtifacts' in reflectedAssemblyConstructor).toBe(false);
    expect('isExact' in reflectedAssemblyConstructor).toBe(false);
    expect(
      () => new ReflectedAssemblyConstructor(first.project, first.evaluation, Object.freeze({})),
    ).toThrow(ProjectSimulationContractError);
    expect(createPreparedProjectCandidateSession(catalog, first).evaluation).toBe(first.evaluation);
  });

  it('keeps the public simulation facade data-only and deeply equal', () => {
    const project = createCompleteFTakeoverProject();
    const assembly = simulateProjectAssembly(catalog, project);

    expect(simulateProject(catalog, project)).toEqual(assembly.evaluation);
    expect(Object.keys(assembly)).toEqual(['project', 'evaluation']);
    expect('candidateArtifacts' in assembly).toBe(false);
    expect('candidateArtifacts' in assembly.evaluation).toBe(false);
    expect('candidateArtifactsForProjectEvaluationAssembly' in simulationPublic).toBe(false);
    expect('rewardProducerFrontier' in simulationPublic).toBe(false);
    expect('roomLifecycleCandidateContexts' in simulationPublic).toBe(false);
    expect('RoomLifecycleCandidateArtifacts' in simulationPublic).toBe(false);
    const publicBiome = assembly.evaluation.routes[0]?.biomes[0];
    if (publicBiome === undefined || !('rewards' in publicBiome)) {
      throw new Error('complete F assembly lost its public reward result');
    }
    expect('producerArtifacts' in publicBiome.rewards).toBe(false);
    expect('producerFrontiers' in publicBiome.rewards).toBe(false);
    expect('lifecycleArtifacts' in publicBiome.rewards).toBe(false);
    expect('lifecycleContexts' in publicBiome.rewards).toBe(false);
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
      simulateProjectAssembly(catalog, project),
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
      simulateProjectAssembly(catalog, project),
    ).evaluate([
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(fBiome, occurrence.occurrenceId, offerKey),
        value: offer.offer,
      },
      {
        kind: 'shopPurchaseOrder',
        shop: createOccurrenceAddress(fBiome, occurrence.occurrenceId),
        offerKeys: occurrence.state.shop.purchaseOrder,
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
          producer: createOccurrenceAddress(fBiome, occurrence.occurrenceId),
        },
      },
    ]);
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
        simulateProjectAssembly(catalog, incomplete),
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
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, invalid),
      ).evaluate(query),
    ).toEqual({
      kind: 'unavailable',
      reason: 'upstreamInvalid',
      evidence: { kind: 'upstreamInvalid', upstreamBiomeKey: 'F' },
    });
  });
});
