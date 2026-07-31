import { catalog } from '@run-planner/hades2-catalog';
import {
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '../../../../test/fixtures/underworldProject';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oOccurrenceIds,
} from '../../../../test/fixtures/surfaceProject';
import { assembleWorkspaceOccurrence } from './occurrence-assembly';
import { createWorkspaceFieldsActiveCageCounts } from './fields-cage-counts';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from '../navigation/marker-builder';
import { createWorkspaceProjectSourceIndex } from '../source-index';

function biomeSource(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function assemble(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: OccurrenceId,
) {
  const source = biomeSource(project, routeKey, biomeKey);
  const occurrence = source.occurrence(occurrenceId);
  if (occurrence === undefined) throw new Error(`${occurrenceId} occurrence is missing`);
  const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(source).occurrence(occurrenceId);
  if (facts === undefined) throw new Error(`${occurrenceId} facts are missing`);
  const fieldsActiveCageCount = createWorkspaceFieldsActiveCageCounts(
    catalog,
    source,
  ).countForOccurrence(occurrenceId);
  const markers = createWorkspaceBiomeMarkerDestinationBuilder({
    assessmentFor: (address) =>
      source.evaluation === undefined
        ? 'blocked'
        : source.isAssessed(address) || source.findingsFor(address).length > 0
          ? 'assessed'
          : 'unassessed',
    biome: source.biome,
    findingCountFor: (address) => source.findingsFor(address).length,
    routeKey,
  });
  const assembly = assembleWorkspaceOccurrence({
    biome: source.biome,
    catalog,
    ...(fieldsActiveCageCount === undefined ? {} : { fieldsActiveCageCount }),
    facts,
    markerDestinations: markers.emitter,
    occurrence,
  });
  return { assembly, markers, source };
}

function withFPrebossSelection(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
): ProjectDocument {
  const sourceOccurrenceId = goldenFOccurrenceId(10, 1);
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        semanticAddressKey(
                          createExitDecisionAddress(goldenFBiome, decision.source),
                        ) ===
                          semanticAddressKey(
                            createExitDecisionAddress(goldenFBiome, {
                              kind: 'occurrence',
                              occurrenceId: sourceOccurrenceId,
                            }),
                          )
                          ? { ...decision, selection: { kind: 'normal' as const, exitKey } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

describe('structured workspace occurrence assembly', () => {
  it('returns immutable ordinary and fixed workbenches with their exact marker destinations', () => {
    const project = createGoldenFGHIProject(catalog);
    const fixed = assemble(project, 'Underworld', 'F', goldenFStartId);
    const ordinary = assemble(project, 'Underworld', 'F', goldenFOccurrenceId(1, 1));

    expect(fixed.assembly.node.room.occurrenceId).toBe(goldenFStartId);
    expect(ordinary.assembly.node.room.rewardControls).toHaveLength(1);
    expect(fixed.markers.destinations().get(fixed.assembly.node.marker.focusKey)?.nodeKey).toBe(
      fixed.assembly.node.key,
    );
    expect(
      ordinary.markers.destinations().get(ordinary.assembly.node.marker.focusKey)?.nodeKey,
    ).toBe(ordinary.assembly.node.key);
  });

  it('publishes active Ephyra side details but withholds dormant side details without hiding incoming rewards', () => {
    const project = createRepresentativeNOPQProject();
    const active = assemble(project, 'Surface', 'N', nOccurrenceId('combat05')).assembly;
    const dormant = assemble(project, 'Surface', 'N', nOccurrenceId('combat10')).assembly;

    expect(active.node.room.roomLocal.kind).toBe('ephyra');
    if (active.node.room.roomLocal.kind !== 'ephyra') throw new Error('active Ephyra is missing');
    expect(active.node.room.roomLocal.sideRooms.kind).toBe('published');
    expect(active.occurrenceInteractionRequirements).toHaveLength(1);

    expect(dormant.node.room.roomLocal.kind).toBe('ephyra');
    if (dormant.node.room.roomLocal.kind !== 'ephyra') throw new Error('dormant Ephyra is missing');
    expect(dormant.node.room.rewardControls).toHaveLength(1);
    expect(dormant.node.room.roomLocal.sideRooms.kind).toBe('withheld');
    expect(dormant.occurrenceInteractionRequirements).toHaveLength(0);
  });

  it('retains published dormant Fields and Ship controls with their occurrence-owned requirements', () => {
    const fields = assemble(
      createGoldenFGHIProject(catalog),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat02'),
    ).assembly;
    const ship = assemble(
      createRepresentativeNOPQProject(),
      'Surface',
      'O',
      oOccurrenceIds.combat04,
    ).assembly;

    expect(fields.node.room.roomLocal.kind).toBe('fields');
    if (fields.node.room.roomLocal.kind !== 'fields') throw new Error('Fields surface is missing');
    expect(fields.node.room.roomLocal.cages.some((cage) => cage.active === false)).toBe(true);

    expect(ship.node.room.roomLocal.kind).toBe('ship');
    if (ship.node.room.roomLocal.kind !== 'ship') throw new Error('Ship surface is missing');
    expect(ship.node.room.roomLocal.wheels.some((wheel) => wheel.active === false)).toBe(true);
    expect(ship.occurrenceInteractionRequirements[0]?.kind).toBe('shipCombat');
  });

  it('keeps a selected Shop editable and withholds retained unpicked Shop inventory', () => {
    const shop = createOccurrenceId('golden-f-preboss-shop');
    const selected = assemble(
      withFPrebossSelection(createGoldenFGHIProject(catalog), 'exit1'),
      'Underworld',
      'F',
      shop,
    ).assembly;
    const dormant = assemble(
      withFPrebossSelection(createGoldenFGHIProject(catalog), 'exit2'),
      'Underworld',
      'F',
      shop,
    ).assembly;

    expect(selected.node.room.roomLocal.kind).toBe('shop');
    if (selected.node.room.roomLocal.kind !== 'shop') throw new Error('selected Shop is missing');
    expect(selected.node.room.roomLocal.materialized).toBe(true);
    expect(selected.occurrenceInteractionRequirements[0]?.kind).toBe('shopPurchases');

    expect(dormant.node.room.roomLocal.kind).toBe('shop');
    if (dormant.node.room.roomLocal.kind !== 'shop') throw new Error('dormant Shop is missing');
    expect(dormant.node.room.roomLocal.materialized).toBe(false);
    expect(dormant.occurrenceInteractionRequirements).toHaveLength(0);
  });

  it('does not need evaluation entry to preserve authored room-local controls', () => {
    const { assembly } = assemble(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      nOccurrenceId('combat05'),
    );
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));

    expect(assembly.node.room.entered).toBe(false);
    expect(
      assembly.node.room.rewardControls.some(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(incoming),
      ),
    ).toBe(true);
  });

  it('rejects unknown and missing Ephyra side-room state before dormant details are withheld', () => {
    const source = biomeSource(createRepresentativeNOPQProject(), 'Surface', 'N');
    const occurrence = source.occurrence(nOccurrenceId('combat10'));
    const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(source).occurrence(
      nOccurrenceId('combat10'),
    );
    if (
      occurrence === undefined ||
      occurrence.state.kind !== 'ephyraCombat' ||
      facts === undefined
    ) {
      throw new Error('dormant Ephyra fixture is missing');
    }
    expect(facts.detailsActive).toBe(false);
    const markers = createWorkspaceBiomeMarkerDestinationBuilder({
      assessmentFor: () => 'unassessed',
      biome: source.biome,
      findingCountFor: () => 0,
      routeKey: source.biome.routeKey,
    });
    const { sideDoor1, ...missingSideRoomState } = occurrence.state.sideRooms;
    if (sideDoor1 === undefined) throw new Error('dormant Ephyra fixture has no first side room');
    const unknownSlot = {
      ...occurrence,
      state: {
        ...occurrence.state,
        sideRooms: {
          ...occurrence.state.sideRooms,
          invalidSideDoor: sideDoor1,
        },
      },
    };
    const missingSlot = {
      ...occurrence,
      state: { ...occurrence.state, sideRooms: missingSideRoomState },
    };
    const input = (candidate: typeof occurrence) => ({
      biome: source.biome,
      catalog,
      facts,
      markerDestinations: markers.emitter,
      occurrence: candidate,
    });

    expect(() => assembleWorkspaceOccurrence(input(unknownSlot))).toThrow(/no side-room slot/);
    expect(() => assembleWorkspaceOccurrence(input(missingSlot))).toThrow(/is missing side room/);
  });
});
