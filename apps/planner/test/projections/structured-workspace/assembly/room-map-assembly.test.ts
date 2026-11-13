import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createAdditionalExitAddress,
  createBiomeAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  chaosGatePositionForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

import { assembleRoomMap } from '@planner/projections/structured-workspace/assembly/room-map-assembly';

const host = createOccurrenceId('golden-f-b2-e1');
const gate = createAdditionalExitAddress(createBiomeAddress('Underworld', 'F'), host, 'chaos');

describe('room map assembly', () => {
  it('places a Chaos gate on the point stored when it was added', () => {
    const evaluate = (document: Parameters<typeof simulateProjectAssembly>[1]) =>
      simulateProjectAssembly(catalog, document);
    const project = settleProjectEdit({
      catalog,
      before: evaluate(createGoldenFGHIProject()),
      command: {
        kind: 'AddChaos',
        additional: gate,
        occurrenceId: createOccurrenceId('map-chaos'),
      },
      evaluate,
    }).assembly.project;
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === host);
    if (occurrence === undefined) throw new Error('expected the golden F host');
    const room = catalog.rooms.byKey[occurrence.gameName]!;
    const position = chaosGatePositionForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, project),
      gate,
    );
    expect(position?.spawnPointIndex).toBeDefined();
    const at = room.mapPoints!.secretPoints[position!.spawnPointIndex! - 1]!;

    const map = assembleRoomMap(catalog, room, position?.spawnPointIndex);

    expect(map?.chaosGate).toEqual({ id: at.id, x: at.x, y: at.y });
    expect(map?.chaosPoints).toHaveLength(room.mapPoints!.secretPoints.length);
  });
});
