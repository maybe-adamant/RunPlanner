import { describe, expect, it } from 'vitest';
import {
  createDefaultRoomState,
  decodeProjectDocument,
  encodeProjectDocument,
  parseProjectDocument,
  ProjectDocumentContractError,
  type RoomOccurrenceRole,
} from '@run-planner/core';

import { catalog } from './index';

function state(gameName: string, role: RoomOccurrenceRole = 'ordinary') {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new Error(`missing room ${gameName}`);
  }
  return createDefaultRoomState(catalog, room, role);
}

function occurrence(occurrenceId: string, gameName: string, role: RoomOccurrenceRole = 'ordinary') {
  return { occurrenceId, gameName, state: state(gameName, role) };
}

function projectWithTopology(topology: unknown): unknown {
  return {
    schemaVersion: 1,
    projectId: 'project-topology',
    name: 'F Topology',
    catalogVersion: catalog.version,
    routes: [
      {
        routeKey: 'Underworld',
        biomes: [{ kind: 'LinearBiome', biomeStepKey: 'Underworld_F', topology }],
      },
      { routeKey: 'Surface', biomes: [] },
    ],
  };
}

function projectWithGTopology(topology: unknown): unknown {
  return {
    schemaVersion: 1,
    projectId: 'project-g-topology',
    name: 'G Topology',
    catalogVersion: catalog.version,
    routes: [
      {
        routeKey: 'Underworld',
        biomes: [
          { kind: 'LinearBiome', biomeStepKey: 'Underworld_F', topology: null },
          { kind: 'LinearBiome', biomeStepKey: 'Underworld_G', topology },
        ],
      },
      { routeKey: 'Surface', biomes: [] },
    ],
  };
}

function repeatedRoomTopology() {
  return {
    startOccurrenceId: 'start',
    occurrences: [
      occurrence('terminal-free', 'F_PreBoss01', 'terminalFreeReward'),
      occurrence('combat-11', 'F_Combat11'),
      occurrence('combat-04-later', 'F_Combat04'),
      occurrence('start', 'F_Opening01'),
      occurrence('terminal-shop', 'F_PreBoss01', 'terminalShop'),
      occurrence('combat-04-first', 'F_Combat04'),
    ],
    continuations: [
      {
        kind: 'terminal',
        parentOccurrenceId: 'combat-11',
        targets: [
          { exitIndex: 2, occurrenceId: 'terminal-free' },
          { exitIndex: 1, occurrenceId: 'terminal-shop' },
        ],
        pickedExitIndex: 1,
      },
      {
        kind: 'batch',
        parentOccurrenceId: 'combat-04-first',
        targets: [
          { exitIndex: 2, occurrenceId: 'combat-11' },
          { exitIndex: 1, occurrenceId: 'combat-04-later' },
        ],
        pickedExitIndex: 2,
      },
      {
        kind: 'batch',
        parentOccurrenceId: 'start',
        targets: [{ exitIndex: 1, occurrenceId: 'combat-04-first' }],
        pickedExitIndex: 1,
      },
    ],
  };
}

describe('F/G linear project topology', () => {
  it('normalizes a picked spine while preserving repeated room occurrences', () => {
    const project = decodeProjectDocument(projectWithTopology(repeatedRoomTopology()), catalog);
    const topology = project.routes[0]?.biomes[0]?.topology;
    if (topology === null || topology === undefined) {
      throw new Error('expected F topology');
    }

    expect(topology.continuations.map((continuation) => continuation.parentOccurrenceId)).toEqual([
      'start',
      'combat-04-first',
      'combat-11',
    ]);
    expect(topology.occurrences.map((room) => room.occurrenceId)).toEqual([
      'start',
      'combat-04-first',
      'combat-04-later',
      'combat-11',
      'terminal-shop',
      'terminal-free',
    ]);
    expect(
      topology.occurrences
        .filter((room) => room.gameName === 'F_Combat04')
        .map((room) => room.occurrenceId),
    ).toEqual(['combat-04-first', 'combat-04-later']);
    expect(topology.occurrences.at(-2)?.state.kind).toBe('shop');
    expect(topology.occurrences.at(-1)?.state.kind).toBe('freeReward');

    const encoded = encodeProjectDocument(project);
    expect(parseProjectDocument(encoded, catalog)).toEqual(project);
    expect(encodeProjectDocument(parseProjectDocument(encoded, catalog))).toBe(encoded);
  });

  it('derives the G shop and two free-reward terminal realizations from exit order', () => {
    const topology = {
      startOccurrenceId: 'g-start',
      occurrences: [
        occurrence('g-free-3', 'G_PreBoss01', 'terminalFreeReward'),
        occurrence('g-start', 'G_Intro'),
        occurrence('g-shop', 'G_PreBoss01', 'terminalShop'),
        occurrence('g-combat', 'G_Combat01'),
        occurrence('g-free-2', 'G_PreBoss01', 'terminalFreeReward'),
      ],
      continuations: [
        {
          kind: 'batch',
          parentOccurrenceId: 'g-start',
          targets: [{ exitIndex: 1, occurrenceId: 'g-combat' }],
          pickedExitIndex: 1,
        },
        {
          kind: 'terminal',
          parentOccurrenceId: 'g-combat',
          targets: [
            { exitIndex: 3, occurrenceId: 'g-free-3' },
            { exitIndex: 1, occurrenceId: 'g-shop' },
            { exitIndex: 2, occurrenceId: 'g-free-2' },
          ],
          pickedExitIndex: 2,
        },
      ],
    };

    const project = decodeProjectDocument(projectWithGTopology(topology), catalog);
    const decoded = project.routes[0]?.biomes[1]?.topology;
    if (decoded === null || decoded === undefined) {
      throw new Error('expected G topology');
    }

    expect(decoded.occurrences.slice(-3).map((room) => room.state.kind)).toEqual([
      'shop',
      'freeReward',
      'freeReward',
    ]);
    expect(decoded.continuations[1]?.targets.map((target) => target.exitIndex)).toEqual([1, 2, 3]);
  });

  it('rejects downstream continuation owned by an unpicked target', () => {
    const topology = repeatedRoomTopology();
    topology.continuations = [
      {
        kind: 'batch',
        parentOccurrenceId: 'start',
        targets: [
          { exitIndex: 1, occurrenceId: 'combat-04-first' },
          { exitIndex: 2, occurrenceId: 'combat-04-later' },
        ],
        pickedExitIndex: 1,
      },
      {
        kind: 'batch',
        parentOccurrenceId: 'combat-04-later',
        targets: [{ exitIndex: 1, occurrenceId: 'combat-11' }],
        pickedExitIndex: 1,
      },
    ];

    expect(() => decodeProjectDocument(projectWithTopology(topology), catalog)).toThrowError(
      new ProjectDocumentContractError(
        '$.routes[0].biomes[0].topology.continuations[1].parentOccurrenceId',
        'combat-04-later is not on the picked spine',
      ),
    );
  });

  it('rejects a preboss leaf whose state disagrees with its derived exit role', () => {
    const topology = repeatedRoomTopology();
    const freeOccurrence = topology.occurrences.find(
      (room) => room.occurrenceId === 'terminal-free',
    );
    if (freeOccurrence === undefined) {
      throw new Error('missing free terminal occurrence');
    }
    freeOccurrence.state = state('F_PreBoss01', 'terminalShop');

    expect(() => decodeProjectDocument(projectWithTopology(topology), catalog)).toThrowError(
      new ProjectDocumentContractError(
        '$.routes[0].biomes[0].topology.occurrences[0].state.kind',
        'expected freeReward, received shop',
      ),
    );
  });

  it('rejects terminal exit indexes beyond the biome preboss policy', () => {
    const topology = repeatedRoomTopology();
    const terminal = topology.continuations[0];
    const freeTarget = terminal?.targets[0];
    if (freeTarget === undefined) {
      throw new Error('missing free terminal target');
    }
    freeTarget.exitIndex = 3;

    expect(() => decodeProjectDocument(projectWithTopology(topology), catalog)).toThrowError(
      new ProjectDocumentContractError(
        '$.routes[0].biomes[0].topology.continuations[0].targets[0].exitIndex',
        'exceeds structural exit capacity 2',
      ),
    );
  });

  it('rejects unreferenced occurrence state instead of retaining dormant leaves', () => {
    const topology = repeatedRoomTopology();
    topology.occurrences.push(occurrence('dormant', 'F_Combat20'));

    expect(() => decodeProjectDocument(projectWithTopology(topology), catalog)).toThrowError(
      new ProjectDocumentContractError(
        '$.routes[0].biomes[0].topology.occurrences[6]',
        'occurrence dormant is not referenced by topology',
      ),
    );
  });
});
