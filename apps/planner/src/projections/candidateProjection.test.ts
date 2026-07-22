import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createCandidateProjectionService, presentCandidateLabel } from './candidateProjection';
import { selectRoomsForCategory } from './roomSelectorProjection';

const biome = createBiomeAddress('Underworld', 'F');
function project() {
  return createProjectDocument(catalog, {
    projectId: 'candidate-projection',
    name: 'Candidate projection',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

describe('candidate application projection', () => {
  it('caches stable option structures by immutable project and semantic owner', () => {
    let evaluationCount = 0;
    const service = createCandidateProjectionService(catalog, (project) => {
      evaluationCount += 1;
      return simulateProject(catalog, project);
    });
    const document = project();
    const layout = catalog.biomeLayouts.byKey.F;
    if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
      throw new Error('F authored start domain is missing');
    }
    const rooms = layout.start.roomGameNames.map((gameName) => catalog.rooms.byKey[gameName]!);

    const first = service.startRooms(document, biome, rooms);
    const second = service.startRooms(document, biome, rooms);

    expect(second).toBe(first);
    expect(evaluationCount).toBe(1);
    expect(first.map((option) => option.value.gameName)).toEqual(layout.start.roomGameNames);
    expect(first.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
  });

  it('evaluates the addressed target in an incomplete but covered biome prefix', () => {
    const service = createCandidateProjectionService(catalog, (project) =>
      simulateProject(catalog, project),
    );
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
      kind: 'CreateTarget',
      target: createTargetAddress(biome, startId, 1),
      occurrenceId: createOccurrenceId('candidate-projection-target'),
      gameName: 'F_Combat02',
    });
    const rooms = selectRoomsForCategory(catalog, 'F', 'Combat');
    const options = service.roomTargets(document, createTargetAddress(biome, startId, 1), rooms);

    expect(options).toHaveLength(22);
    expect(options.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
    expect(
      options.some(
        (option) =>
          option.evaluation.context === 'evaluated' && option.evaluation.support === 'possible',
      ),
    ).toBe(true);
  });

  it('retains a blank physical-exit domain as unassessed until its target is authored', () => {
    const service = createCandidateProjectionService(catalog, (project) =>
      simulateProject(catalog, project),
    );
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
    const options = service.roomTargets(
      document,
      createTargetAddress(biome, startId, 1),
      selectRoomsForCategory(catalog, 'F', 'Combat'),
    );

    expect(options).toHaveLength(22);
    expect(
      options.every(
        (option) =>
          option.evaluation.context === 'unavailable' &&
          option.evaluation.reason === 'coverageNotReached' &&
          option.evaluation.evidence.kind === 'coverageNotReached' &&
          option.evaluation.evidence.requiredCheckpoint === 'afterTargetGeneration',
      ),
    ).toBe(true);
  });

  it('uses one common label decoration for context-impossible authored values', () => {
    const service = createCandidateProjectionService(catalog, (project) =>
      simulateProject(catalog, project),
    );
    const document = project();
    const room = catalog.rooms.byKey.F_Combat01!;
    const option = service.startRooms(document, biome, [room])[0];

    expect(option?.evaluation).toMatchObject({ context: 'evaluated', support: 'impossible' });
    expect(presentCandidateLabel(room.label, option)).toBe('Combat 01 — unavailable');
  });

  it('projects the catalog-authored G start without a biome-specific application rule', () => {
    const service = createCandidateProjectionService(catalog, (project) =>
      simulateProject(catalog, project),
    );
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

    const options = service.startRooms(document, createBiomeAddress('Underworld', 'G'), rooms);

    expect(options.map((option) => option.value.gameName)).toEqual(['G_Intro']);
    expect(options[0]?.evaluation).toMatchObject({ context: 'evaluated', support: 'forced' });
  });

  it('resolves the exact batch store while retaining a now-invalid authored reward', () => {
    let evaluationCount = 0;
    const service = createCandidateProjectionService(catalog, (project) => {
      evaluationCount += 1;
      return simulateProject(catalog, project);
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
    const runDomain = service.countedRewardTypes(
      document,
      owner,
      binding,
      occurrence.state.offer.rewardType,
    );

    expect(runDomain).toContain('MaxHealthDrop');
    expect(runDomain).not.toContain('MetaCurrencyDrop');
    expect(service.countedRewardTypes(document, owner, binding, 'Boon')).toBe(runDomain);
    expect(evaluationCount).toBe(0);

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
    const metaDomain = service.countedRewardTypes(
      metaDocument,
      owner,
      binding,
      retainedOccurrence.state.offer.rewardType,
    );

    expect(retainedOccurrence.state.offer).toEqual(occurrence.state.offer);
    expect(metaDomain).toContain('MetaCurrencyDrop');
    expect(metaDomain).not.toContain('MaxHealthDrop');
    expect(metaDomain.at(-1)).toBe('Boon');
    expect(evaluationCount).toBe(0);
    const retainedCandidate = service
      .incomingRewards(metaDocument, owner.address, [retainedOccurrence.state.offer])
      .at(0);
    expect(retainedCandidate?.evaluation).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
    });
    expect(evaluationCount).toBe(1);
  });
});
