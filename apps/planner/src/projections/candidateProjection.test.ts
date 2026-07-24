import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import { simulateProject, type CandidateEvaluationEvent } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject, targetOccurrenceId } from '../../test/fixtures/underworldProject';
import {
  createCandidateSessionFactory,
  presentCandidateLabel,
  type CandidateSessionFactoryOptions,
} from './candidateProjection';
import { selectRoomsForCategory } from './roomSelectorProjection';

const biome = createBiomeAddress('Underworld', 'F');
function project() {
  return createProjectDocument(catalog, {
    projectId: 'candidate-projection',
    name: 'Candidate projection',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function candidatesFor(
  document: ReturnType<typeof project>,
  options: CandidateSessionFactoryOptions = {},
) {
  return createCandidateSessionFactory(catalog, options).bind(
    document,
    simulateProject(catalog, document),
  );
}

describe('candidate application projection', () => {
  it('aggregates complete reward witnesses while retaining an invalid selected source', async () => {
    let document = createGoldenFGHIProject(catalog);
    const first = targetOccurrenceId('F', 2, 1);
    const second = targetOccurrenceId('F', 2, 2);
    const zeus = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
    };
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, first),
      value: zeus,
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, second),
      value: zeus,
    });

    const domain = await candidatesFor(document).rewardDomain(
      { kind: 'incomingReward', address: createIncomingRewardAddress(biome, second) },
      ['Boon'],
      zeus,
    );
    const boon = domain.types[0];
    const zeusSource =
      domain.payload.kind === 'oneOf'
        ? domain.payload.sources.find((candidate) => candidate.key === 'ZeusUpgrade')
        : undefined;

    expect(boon?.evaluation).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(boon?.supportingOffer).not.toEqual(zeus);
    expect(zeusSource?.evaluation).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: {
        exclusions: [
          {
            kind: 'sibling',
            priorOffers: [{ origin: { kind: 'target', exitIndex: 1 }, offer: zeus }],
          },
          { kind: 'boonSource', source: 'ZeusUpgrade' },
        ],
      },
    });
  });

  it('yields before and between relational reward assessments', async () => {
    let yieldCount = 0;
    const document = createGoldenFGHIProject(catalog);
    const service = candidatesFor(document, {
      yieldToHost: async () => {
        yieldCount += 1;
      },
    });
    const occurrenceId = targetOccurrenceId('F', 2, 1);
    const selected = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
    };

    await service.rewardDomain(
      {
        kind: 'incomingReward',
        address: createIncomingRewardAddress(biome, occurrenceId),
      },
      ['Boon'],
      selected,
    );

    expect(yieldCount).toBeGreaterThan(1);
  });

  it('reuses one producer frontier across the dense Devotion domain', async () => {
    const events: CandidateEvaluationEvent[] = [];
    const document = createGoldenFGHIProject(catalog);
    const service = candidatesFor(document, {
      observeCandidateEvaluation: (event) => events.push(event),
      yieldToHost: () => Promise.resolve(),
    });
    const occurrenceId = targetOccurrenceId('F', 2, 1);
    const selected = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'ZeusUpgrade',
        spurnedSource: 'HeraUpgrade',
      },
    };

    await service.rewardDomain(
      {
        kind: 'incomingReward',
        address: createIncomingRewardAddress(biome, occurrenceId),
      },
      ['Devotion'],
      selected,
    );

    expect(events.filter((event) => event.kind === 'queryBatch')).toHaveLength(72);
  });

  it('caches stable option structures by immutable project and semantic owner', () => {
    const document = project();
    const evaluation = simulateProject(catalog, document);
    const factory = createCandidateSessionFactory(catalog);
    const service = factory.bind(document, evaluation);
    const layout = catalog.biomeLayouts.byKey.F;
    if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
      throw new Error('F authored start domain is missing');
    }
    const rooms = layout.start.roomGameNames.map((gameName) => catalog.rooms.byKey[gameName]!);

    const first = service.startRooms(biome, rooms);
    const second = service.startRooms(biome, rooms);

    expect(second).toBe(first);
    expect(factory.bind(document, evaluation)).toBe(service);
    expect(first.map((option) => option.value.gameName)).toEqual(layout.start.roomGameNames);
    expect(first.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
  });

  it('binds projection work to the exact published project evaluation', () => {
    const factory = createCandidateSessionFactory(catalog);
    const document = project();
    const evaluation = simulateProject(catalog, document);
    const layout = catalog.biomeLayouts.byKey.F;
    if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
      throw new Error('F authored start domain is missing');
    }
    const rooms = layout.start.roomGameNames.map((gameName) => catalog.rooms.byKey[gameName]!);

    const first = factory.bind(document, evaluation);
    const second = factory.bind(document, evaluation);
    const options = first.startRooms(biome, rooms);

    expect(second).toBe(first);
    expect(first.project).toBe(document);
    expect(first.evaluation).toBe(evaluation);
    expect(options.map((option) => option.value.gameName)).toEqual(layout.start.roomGameNames);
  });

  it('evaluates the addressed target in an incomplete but covered biome prefix', () => {
    const events: CandidateEvaluationEvent[] = [];
    const startId = createOccurrenceId('candidate-projection-start');
    let document = applyProjectCommand(project(), catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, startId),
      storeKey: 'MetaProgress',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, startId, 1),
      occurrenceId: createOccurrenceId('candidate-projection-target'),
      gameName: 'F_Combat02',
    });
    const rooms = selectRoomsForCategory(catalog, 'F', 'Combat');
    const options = candidatesFor(document, {
      observeCandidateEvaluation: (event) => events.push(event),
    }).roomTargets(createTargetAddress(biome, startId, 1), rooms);

    expect(options).toHaveLength(22);
    expect(options.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
    expect(
      options.some(
        (option) =>
          option.evaluation.context === 'evaluated' && option.evaluation.support === 'possible',
      ),
    ).toBe(true);
    expect(events).toEqual([{ kind: 'queryBatch', queryCount: 22 }]);
  });

  it('evaluates the first blank physical exit before its target is authored', () => {
    const startId = createOccurrenceId('candidate-blank-start');
    let document = applyProjectCommand(project(), catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, startId),
      storeKey: 'MetaProgress',
    });
    const options = candidatesFor(document).roomTargets(
      createTargetAddress(biome, startId, 1),
      selectRoomsForCategory(catalog, 'F', 'Combat'),
    );

    expect(options).toHaveLength(22);
    expect(options.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
    expect(
      options.some(
        (option) =>
          option.evaluation.context === 'evaluated' && option.evaluation.support === 'possible',
      ),
    ).toBe(true);
  });

  it('advances blank-slot candidates in physical exit order', () => {
    const startId = createOccurrenceId('candidate-ordered-start');
    const parentId = createOccurrenceId('candidate-ordered-parent');
    let document = applyProjectCommand(project(), catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, startId),
      storeKey: 'MetaProgress',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, startId, 1),
      occurrenceId: parentId,
      gameName: 'F_Combat02',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, startId),
      exitIndex: 1,
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentId),
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, parentId),
      storeKey: 'RunProgress',
    });
    const rooms = selectRoomsForCategory(catalog, 'F', 'Combat');
    const beforeFirst = candidatesFor(document);
    const firstOptions = beforeFirst.roomTargets(createTargetAddress(biome, parentId, 1), rooms);
    const firstCombat03 = firstOptions.find((option) => option.value.gameName === 'F_Combat03');

    expect(firstOptions.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
    expect(firstCombat03?.evaluation).toMatchObject({
      context: 'evaluated',
      evidence: { candidateCreationCount: 0 },
    });
    expect(
      beforeFirst
        .roomTargets(createTargetAddress(biome, parentId, 2), rooms)
        .every(
          (option) =>
            option.evaluation.context === 'unavailable' &&
            option.evaluation.reason === 'coverageNotReached',
        ),
    ).toBe(true);

    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, parentId, 1),
      occurrenceId: createOccurrenceId('candidate-ordered-first'),
      gameName: 'F_Combat03',
    });
    const secondOptions = candidatesFor(document).roomTargets(
      createTargetAddress(biome, parentId, 2),
      rooms,
    );
    const secondCombat03 = secondOptions.find((option) => option.value.gameName === 'F_Combat03');

    expect(secondOptions.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
    expect(secondCombat03?.evaluation).toMatchObject({
      context: 'evaluated',
      evidence: { candidateCreationCount: 1 },
    });
    const firstEvaluation = firstCombat03?.evaluation;
    const secondEvaluation = secondCombat03?.evaluation;
    if (
      firstEvaluation?.context !== 'evaluated' ||
      secondEvaluation?.context !== 'evaluated' ||
      !('candidateCreationCount' in firstEvaluation.evidence) ||
      !('candidateCreationCount' in secondEvaluation.evidence)
    ) {
      throw new Error('ordered target candidates were not evaluated');
    }
    expect(secondEvaluation.evidence.beforeSequence).toBeGreaterThan(
      firstEvaluation.evidence.beforeSequence,
    );
  });

  it('uses one common label decoration for context-impossible authored values', () => {
    const document = project();
    const room = catalog.rooms.byKey.F_Combat01!;
    const option = candidatesFor(document).startRooms(biome, [room])[0];

    expect(option?.evaluation).toMatchObject({ context: 'evaluated', support: 'impossible' });
    expect(presentCandidateLabel(room.label, option)).toBe('Combat 01 — unavailable');
  });

  it('projects the catalog-authored G start without a biome-specific application rule', () => {
    const document = createProjectDocument(catalog, {
      projectId: 'g-candidate-projection',
      name: 'G Candidate Projection',
      configuredBiomeCounts: { Underworld: 2 },
    });
    const layout = catalog.biomeLayouts.byKey.G;
    if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
      throw new Error('G authored start domain is missing');
    }
    const rooms = layout.start.roomGameNames.map((gameName) => catalog.rooms.byKey[gameName]!);

    const options = candidatesFor(document).startRooms(
      createBiomeAddress('Underworld', 'G'),
      rooms,
    );

    expect(options.map((option) => option.value.gameName)).toEqual(['G_Intro']);
    expect(options[0]?.evaluation).toMatchObject({ context: 'evaluated', support: 'forced' });
  });

  it('resolves the exact batch store while retaining a now-invalid authored reward', async () => {
    const factory = createCandidateSessionFactory(catalog, {
      yieldToHost: () => Promise.resolve(),
    });
    const startId = createOccurrenceId('reward-domain-start');
    const targetId = createOccurrenceId('reward-domain-target');
    let document = applyProjectCommand(project(), catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, startId),
      storeKey: 'RunProgress',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, startId, 1),
      occurrenceId: targetId,
      gameName: 'F_Combat02',
    });
    const binding = catalog.rooms.byKey.F_Combat02?.incomingReward;
    const occurrence = document.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === targetId,
    );
    if (binding?.kind !== 'countedChoice' || occurrence?.state.kind !== 'counted') {
      throw new Error('F_Combat02 counted reward fixture is missing');
    }
    const owner = {
      kind: 'incomingReward' as const,
      address: createIncomingRewardAddress(biome, targetId),
    };
    const runSession = factory.bind(document, simulateProject(catalog, document));
    const runDomain = runSession.countedRewardTypes(
      owner,
      binding,
      occurrence.state.offer.rewardType,
    );

    expect(runDomain).toContain('MaxHealthDrop');
    expect(runDomain).not.toContain('MetaCurrencyDrop');
    expect(runSession.countedRewardTypes(owner, binding, 'Boon')).toBe(runDomain);

    const metaDocument = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, startId),
      storeKey: 'MetaProgress',
    });
    const retainedOccurrence = metaDocument.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === targetId,
    );
    if (retainedOccurrence?.state.kind !== 'counted') {
      throw new Error('F_Combat02 retained reward fixture is missing');
    }
    const metaSession = factory.bind(metaDocument, simulateProject(catalog, metaDocument));
    const metaDomain = metaSession.countedRewardTypes(
      owner,
      binding,
      retainedOccurrence.state.offer.rewardType,
    );

    expect(retainedOccurrence.state.offer).toEqual(occurrence.state.offer);
    expect(metaDomain).toContain('MetaCurrencyDrop');
    expect(metaDomain).not.toContain('MaxHealthDrop');
    expect(metaDomain.at(-1)).toBe('Boon');
    const retainedDomain = await metaSession.rewardDomain(
      owner,
      [retainedOccurrence.state.offer.rewardType],
      retainedOccurrence.state.offer,
    );
    expect(retainedDomain.types[0]?.offerEvaluation).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
    });
  });
});
