import { catalog } from '@run-planner/hades2-catalog';
import {
  createOccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import { encounterPhaseAuthoringDomainForRoom } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';

function occurrence(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: string,
): RoomOccurrence {
  const result = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (result === undefined) throw new Error(`${routeKey}/${biomeKey}/${occurrenceId} is missing`);
  return result;
}

function roomFor(value: RoomOccurrence) {
  const room = catalog.rooms.byKey[value.gameName];
  if (room === undefined) throw new Error(`${value.gameName} declaration is missing`);
  return room;
}

describe('encounter phase authored domains', () => {
  it('uses the authored Ship encounter count to withhold Combat2', () => {
    const value = occurrence(loadSurfaceNOPQProject(), 'Surface', 'O', oOccurrenceIds.combat04);
    const phases = encounterPhaseAuthoringDomainForRoom(
      catalog,
      oBiome,
      roomFor(value),
      { kind: 'occurrence', occurrenceId: value.occurrenceId },
      value.encounters,
      { shipEncounterCount: 2 },
    );

    expect(phases.map((phase) => phase.slotKey)).toEqual(['Intro', 'Combat1']);
  });

  it('uses authored Fields decision facts to withhold inactive cages', () => {
    const value = occurrence(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat02'),
    );
    const phases = encounterPhaseAuthoringDomainForRoom(
      catalog,
      goldenHBiome,
      roomFor(value),
      { kind: 'occurrence', occurrenceId: value.occurrenceId },
      value.encounters,
      { fieldsCageRewardCount: 2 },
    );

    expect(phases.map((phase) => phase.slotKey)).toEqual(['Passive', 'Cage01', 'Cage02']);
  });
});
