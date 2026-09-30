import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  type CandidateContextOwner,
} from '@run-planner/engine/simulation';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';

function reached(project: ProjectDocument, owner: CandidateContextOwner): boolean {
  return createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).contextReached(owner);
}

/** Rewrites one saved occurrence, as an unfinished save holds it. */
function rewritten(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  edit: (occurrence: Record<string, unknown>) => void,
): ProjectDocument {
  const raw = JSON.parse(encodeProjectDocument(project));
  edit(
    raw.route.biomes
      .find((biome: { biomeKey: string }) => biome.biomeKey === biomeKey)
      .topology.occurrences.find(
        (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === occurrenceId,
      ),
  );
  return decodeProjectDocument(raw, catalog);
}

const withoutTraitOffers = (occurrence: Record<string, unknown>) => {
  const offers = (occurrence.state as { reward: { traitOffersByAcquisitionRole: object } }).reward
    .traitOffersByAcquisitionRole as Record<string, unknown>;
  for (const role of Object.keys(offers)) offers[role] = null;
};

const o = createBiomeAddress('Surface', 'O');
const ship = (occurrenceId: string): CandidateContextOwner => ({
  kind: 'shipEncounterCount',
  occurrence: createOccurrenceAddress(o, createOccurrenceId(occurrenceId)),
});
const wheel = (occurrenceId: string, wheelKey: string): CandidateContextOwner => ({
  kind: 'rewardWheel',
  wheel: {
    kind: 'rewardWheel',
    routeKey: 'Surface',
    biomeKey: 'O',
    occurrenceId: createOccurrenceId(occurrenceId),
    wheelKey,
  },
});

describe('candidate context reachability from retained products', () => {
  it('answers Ship phase count and reward wheels from the retained lifecycle capability', () => {
    const valid = loadSurfaceNOPQProject();
    expect(reached(valid, ship('surface-o-combat04'))).toBe(true);
    expect(reached(valid, wheel('surface-o-combat04', 'wheel1'))).toBe(true);
    // A two-phase room's second wheel is not active.
    expect(reached(valid, wheel('surface-o-combat04', 'wheel2'))).toBe(false);

    const frontier = rewritten(valid, 'O', 'surface-o-combat04', (occurrence) => {
      (
        occurrence.state as { wheels: { wheel1: { offers: Record<string, unknown> } } }
      ).wheels.wheel1.offers.offer1 = null;
    });
    expect(reached(frontier, wheel('surface-o-combat04', 'wheel1'))).toBe(true);
    expect(reached(frontier, ship('surface-o-combat04'))).toBe(true);

    const stopped = rewritten(valid, 'O', 'surface-o-devotion', withoutTraitOffers);
    expect(reached(stopped, ship('surface-o-combat04'))).toBe(true);
    expect(reached(stopped, ship('surface-o-combat02'))).toBe(false);
    expect(reached(stopped, wheel('surface-o-combat02', 'wheel1'))).toBe(false);
  });

  it('answers side rooms from the retained Hub side-generation support and visit prefix', () => {
    const valid = loadSurfaceNOPQProject();
    const sideRoom = (sourceOccurrenceId: string, slotKey: string): CandidateContextOwner => ({
      kind: 'sideRoomGeneration',
      sideRoom: {
        kind: 'localVisitSlot',
        routeKey: 'Surface',
        biomeKey: 'N',
        sourceOccurrenceId: createOccurrenceId(sourceOccurrenceId),
        groupKey: 'sideRooms',
        slotKey,
      },
    });
    const order = (sourceOccurrenceId: string): CandidateContextOwner => ({
      kind: 'sideRoomEntryOrder',
      group: {
        kind: 'localVisitOrder',
        routeKey: 'Surface',
        biomeKey: 'N',
        sourceOccurrenceId: createOccurrenceId(sourceOccurrenceId),
        groupKey: 'sideRooms',
      },
    });
    expect(reached(valid, sideRoom('surface-n-combat09', 'sideDoor1'))).toBe(true);
    expect(reached(valid, order('surface-n-combat09'))).toBe(true);
    const stopped = rewritten(valid, 'N', 'surface-n-combat11', withoutTraitOffers);
    // The stop is the visit's own incoming offer; its side rooms and later visits follow it.
    expect(reached(stopped, sideRoom('surface-n-combat11', 'sideDoor1'))).toBe(false);
    expect(reached(stopped, sideRoom('surface-n-combat09', 'sideDoor1'))).toBe(false);
    expect(reached(stopped, sideRoom('surface-n-combat05', 'sideDoor1'))).toBe(true);
    expect(reached(stopped, order('surface-n-combat05'))).toBe(true);
  });

  it('answers Hub slots and visit order from the authored Hub and its retained biome', () => {
    const valid = loadSurfaceNOPQProject();
    const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
    const slot = {
      kind: 'hubSlot',
      routeKey: 'Surface',
      biomeKey: 'N',
      hubKey: 'hub',
      hubSlotKey: 'combat11',
    } as const;
    expect(reached(valid, { kind: 'hubActionOrder', hub })).toBe(true);
    expect(reached(valid, { kind: 'hubSlot', slot })).toBe(true);
    const stopped = rewritten(valid, 'N', 'surface-n-combat11', withoutTraitOffers);
    expect(reached(stopped, { kind: 'hubActionOrder', hub })).toBe(true);
    expect(reached(stopped, { kind: 'hubSlot', slot })).toBe(true);
  });

  it('answers Fields points from the room materialized in the retained biome product', () => {
    const spatial = (occurrenceId: string) =>
      createFieldsSpatialAddress(
        createOccurrenceAddress(goldenHBiome, createOccurrenceId(occurrenceId)),
        { kind: 'entry' },
      );
    const point = (occurrenceId: string): CandidateContextOwner => ({
      kind: 'fieldsSpatialPoint',
      spatial: spatial(occurrenceId),
    });
    const valid = createGoldenFGHIProject();
    expect(reached(valid, point('golden-h-combat02'))).toBe(true);
    const frontier = applyProjectCommand(valid, catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: spatial('golden-h-combat09'),
      pointId: null,
    });
    expect(reached(frontier, point('golden-h-combat02'))).toBe(true);
    expect(reached(frontier, point('golden-h-combat09'))).toBe(true);
    const upstreamInvalid = applyProjectCommand(valid, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    expect(reached(upstreamInvalid, point('golden-h-combat02'))).toBe(false);
  });
});
