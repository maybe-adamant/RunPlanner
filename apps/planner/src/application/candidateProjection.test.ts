import { catalog } from '@run-planner/catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { createCandidateProjectionService, presentCandidateLabel } from './candidateProjection';
import { selectRoomsForCategory } from './roomSelectorProjection';

const biome = createBiomeAddress('Underworld', 'F');
const simulationScope = Object.freeze({ simulatableBiomeKeys: Object.freeze(['F']) });

function project() {
  return createProjectDocument(catalog, {
    projectId: 'candidate-projection',
    name: 'Candidate projection',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

describe('candidate application projection', () => {
  it('caches stable option structures by immutable project and semantic owner', () => {
    const service = createCandidateProjectionService(catalog, simulationScope);
    const document = project();
    const layout = catalog.biomeLayouts.byKey.F;
    if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
      throw new Error('F authored start domain is missing');
    }
    const rooms = layout.start.roomGameNames.map((gameName) => catalog.rooms.byKey[gameName]!);

    const first = service.startRooms(document, biome, rooms);
    const second = service.startRooms(document, biome, rooms);

    expect(second).toBe(first);
    expect(first.map((option) => option.value.gameName)).toEqual(layout.start.roomGameNames);
    expect(first.every((option) => option.evaluation.context === 'evaluated')).toBe(true);
  });

  it('retains stable declaration domains when contextual evaluation is unavailable', () => {
    const service = createCandidateProjectionService(catalog, simulationScope);
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
    const service = createCandidateProjectionService(catalog, simulationScope);
    const document = project();
    const room = catalog.rooms.byKey.F_Combat01!;
    const option = service.startRooms(document, biome, [room])[0];

    expect(option?.evaluation).toMatchObject({ context: 'evaluated', support: 'impossible' });
    expect(presentCandidateLabel(room.label, option)).toBe('Combat 01 — unavailable');
  });
});
