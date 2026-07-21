import { catalog } from '@run-planner/catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  simulateProject,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { createCandidateProjectionService, presentCandidateLabel } from './candidateProjection';
import { selectRoomsForCategory } from './roomSelectorProjection';

const biome = createBiomeAddress('Underworld', 'F');
const simulationScope = Object.freeze({ simulatableBiomeKeys: Object.freeze(['F', 'G', 'H']) });

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
      return simulateProject(catalog, project, simulationScope);
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

  it('retains stable declaration domains when contextual evaluation is unavailable', () => {
    const service = createCandidateProjectionService(catalog, (project) =>
      simulateProject(catalog, project, simulationScope),
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
    const rooms = selectRoomsForCategory(catalog, 'F', 'Combat');
    const options = service.roomTargets(document, createTargetAddress(biome, startId, 1), rooms);

    expect(options).toHaveLength(22);
    expect(
      options.every(
        (option) =>
          option.evaluation.context === 'unavailable' &&
          option.evaluation.reason === 'biomeIncomplete',
      ),
    ).toBe(true);
  });

  it('uses one common label decoration for context-impossible authored values', () => {
    const service = createCandidateProjectionService(catalog, (project) =>
      simulateProject(catalog, project, simulationScope),
    );
    const document = project();
    const room = catalog.rooms.byKey.F_Combat01!;
    const option = service.startRooms(document, biome, [room])[0];

    expect(option?.evaluation).toMatchObject({ context: 'evaluated', support: 'impossible' });
    expect(presentCandidateLabel(room.label, option)).toBe('Combat 01 — unavailable');
  });

  it('projects the catalog-authored G start without a biome-specific application rule', () => {
    const service = createCandidateProjectionService(catalog, (project) =>
      simulateProject(catalog, project, simulationScope),
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
});
