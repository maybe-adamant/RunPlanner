import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

import { assembleRoomMap } from '@planner/projections/structured-workspace/assembly/room-map-assembly';

const host = createOccurrenceId('golden-f-b2-e1');

/** The golden F host with a Chaos gate whose point is left native. */
function chaosHost() {
  const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'AddChaos',
    additional: createAdditionalExitAddress(createBiomeAddress('Underworld', 'F'), host, 'chaos'),
    occurrenceId: createOccurrenceId('map-chaos'),
  });
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'F')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === host);
  if (occurrence === undefined) throw new Error('expected the golden F host');
  return occurrence;
}

describe('room map assembly', () => {
  it('places a Chaos gate at a room’s only SecretPoint without an authored point', () => {
    const occurrence = chaosHost();
    const room = catalog.rooms.byKey[occurrence.gameName]!;
    const [only] = room.mapPoints!.secretPoints;

    const map = assembleRoomMap(catalog, room, occurrence);

    expect(room.mapPoints!.secretPoints).toHaveLength(1);
    expect(map?.chaosGate).toEqual({ id: only!.id, x: only!.x, y: only!.y });
    expect(map?.chaosPoints).toEqual([{ id: only!.id, x: only!.x, y: only!.y }]);
  });

  it('leaves the gate unplaced where several SecretPoints offer no authored choice', () => {
    const room = catalog.rooms.byKey.F_Combat17!;

    const map = assembleRoomMap(catalog, room, chaosHost());

    expect(room.mapPoints!.secretPoints.length).toBeGreaterThan(1);
    expect(map?.chaosGate).toBeUndefined();
    expect(map?.chaosPoints).toHaveLength(room.mapPoints!.secretPoints.length);
  });
});
