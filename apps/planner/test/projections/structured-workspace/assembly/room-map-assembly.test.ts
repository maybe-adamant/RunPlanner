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

const noStock = { shopOfferKeys: [], contractPedestal: false };
const noExits = { chaosGateSpawnPointIndex: undefined, contractExit: false };
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

    const map = assembleRoomMap(
      catalog,
      room,
      { chaosGateSpawnPointIndex: position?.spawnPointIndex, contractExit: false },
      noStock,
    );

    expect(map?.chaosGate).toEqual({ id: at.id, x: at.x, y: at.y });
    expect(map?.chaosPoints).toHaveLength(room.mapPoints!.secretPoints.length);
  });

  it('stands each stocked World Shop item on its LootPoint by compact position', () => {
    const room = catalog.rooms.byKey.F_Shop01!;
    const loot = room.mapPoints!.shopPoints!;
    // An empty first slot shifts the second item onto the first point.
    const map = assembleRoomMap(catalog, room, noExits, {
      shopOfferKeys: ['Slot2', 'Slot3'],
      contractPedestal: false,
    });

    expect(map?.shopItems).toEqual([
      { id: loot[0]!.id, x: loot[0]!.x, y: loot[0]!.y, offerKey: 'Slot2' },
      { id: loot[1]!.id, x: loot[1]!.x, y: loot[1]!.y, offerKey: 'Slot3' },
    ]);
    expect(map?.contractPedestal).toBeUndefined();
  });

  it('places the Contract pedestal only where the room holds it', () => {
    const room = catalog.rooms.byKey.F_PreBoss01!;
    const pedestal = room.mapPoints!.contractPedestalPoint!;
    expect(
      assembleRoomMap(catalog, room, noExits, { shopOfferKeys: [], contractPedestal: true })
        ?.contractPedestal,
    ).toEqual(pedestal);
    expect(assembleRoomMap(catalog, room, noExits, noStock)?.contractPedestal).toBeUndefined();
  });

  it('places the Contract door only where the room authors it', () => {
    const room = catalog.rooms.byKey.F_Shop01!;
    expect(
      assembleRoomMap(catalog, room, { ...noExits, contractExit: true }, noStock)?.contractExit,
    ).toEqual(room.mapPoints!.contractExitPoint);
    expect(assembleRoomMap(catalog, room, noExits, noStock)?.contractExit).toBeUndefined();
  });
});
