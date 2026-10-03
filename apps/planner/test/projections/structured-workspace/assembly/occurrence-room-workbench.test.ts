import { createEncounterPhaseAddress } from '@run-planner/engine/authored-project';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { surfaceShrineTravelDealProject } from '@run-planner/test-fixtures/surface';
import { describe, expect, it } from 'vitest';
import {
  assemble,
  applyProjectCommand,
  catalog,
  createOccurrenceAddress,
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

describe('occurrence room workbench', () => {
  it('keeps required Ship delivery placement and reward focus in its rendered phase', () => {
    let project = surfaceShrineTravelDealProject();
    let result = assemble(project, 'Surface', 'O', oOccurrenceIds.combat04);
    const delivery = result.assembly.node.room.workbench.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactAcquisitionEntry' && row.label.includes('Delivery'),
    );
    if (delivery === undefined) throw new Error('Missing delivery');
    project = applyProjectCommand(project, catalog, {
      kind: 'UnplaceGeneratedDelivery',
      action: delivery.address,
    });
    result = assemble(project, 'Surface', 'O', oOccurrenceIds.combat04);
    const workbench = result.assembly.node.room.workbench;
    if (workbench.kind !== 'ship') throw new Error('Missing Ship');
    const due = workbench.phases
      .find((phase) => phase.key === 'Combat1')
      ?.unplacedRows.find((row) => row.key === delivery.key);
    if (due?.placement === undefined) throw new Error('Missing phase-local delivery placement');
    expect(workbench.repairRows.map((row) => row.key)).not.toContain(due.key);
    expect(result.markers.destinations().get(due.marker.focusKey)?.roomTab).toBe(
      'shipCombat1Actions',
    );
    project = applyProjectCommand(project, catalog, due.placement.command);
    result = assemble(project, 'Surface', 'O', oOccurrenceIds.combat04);
    const placed = result.assembly.node.room.workbench;
    if (placed.kind !== 'ship') throw new Error('Missing Ship');
    const row = placed.phases
      .find((phase) => phase.key === 'Combat1')
      ?.actionRows.find((candidate) => candidate.key === due.key);
    expect(row).toBeDefined();
    expect(result.markers.destinations().get(row!.marker.focusKey)?.roomTab).toBe(
      'shipCombat1Actions',
    );
  });

  it('routes trait and reward children to the phase that renders their action', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
    const project = authorLegalTraitOffers(
      applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
        kind: 'SelectEncounter',
        phase: createEncounterPhaseAddress(oBiome, occurrence, 'Combat1'),
        encounterKey: 'IcarusCombatO',
      }),
    );
    const result = assemble(project, 'Surface', 'O', oOccurrenceIds.combat01);
    const workbench = result.assembly.node.room.workbench;
    if (workbench.kind !== 'ship') throw new Error('Missing Ship');
    let childCount = 0;
    for (const phase of workbench.phases) {
      for (const row of phase.actionRows) {
        const traits = [
          ...(row.traitOffer === undefined ? [] : [row.traitOffer]),
          ...(row.rewardPayload?.control.traitOffers ?? []),
        ];
        for (const trait of traits) {
          for (const marker of [trait.marker, ...trait.children.map((child) => child.marker)]) {
            childCount++;
            expect(result.markers.destinations().get(marker.focusKey)?.roomTab).toBe(
              phase.key === 'Intro' ? 'shipIntroActions' : 'shipCombat1Actions',
            );
          }
        }
      }
    }
    expect(childCount).toBeGreaterThan(0);
  });

  it('routes an inactive wheel to the Overview that can restore its phase', () => {
    const result = assemble(loadSurfaceNOPQProject(), 'Surface', 'O', oOccurrenceIds.combat04);
    const room = result.assembly.node.room;
    if (room.roomLocal.kind !== 'ship' || room.workbench.kind !== 'ship')
      throw new Error('Missing Ship');
    const wheel = room.roomLocal.wheels.find((entry) => !entry.active)!;
    expect(room.workbench.repairRows).toEqual([]);
    for (const marker of [wheel.marker, ...wheel.offers.map((offer) => offer.control.marker)]) {
      expect(result.markers.destinations().get(marker.focusKey)).toMatchObject({
        roomTab: 'overview',
        focusAddress: room.address,
      });
    }
  });

  it('derives a three-phase Ship presentation without exposing outgoing generation', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const ship = assemble(project, 'Surface', 'O', oOccurrenceIds.combat07).assembly.node.room;
    if (ship.roomLocal.kind !== 'ship' || ship.workbench.kind !== 'ship') {
      throw new Error('Three-phase Ship workbench is missing');
    }

    expect(ship.roomLocal.phases).toEqual([
      { key: 'Intro', label: 'Intro' },
      { key: 'Combat1', label: 'Combat 1', rewardWheelKey: 'wheel1' },
      { key: 'Combat2', label: 'Combat 2', rewardWheelKey: 'wheel2' },
    ]);
    expect(ship.workbench.phases.map((phase) => [phase.key, phase.label])).toEqual([
      ['Intro', 'Intro'],
      ['Combat1', 'Combat 1'],
      ['Combat2', 'Combat 2'],
    ]);
    expect(ship.workbench.phases.map((phase) => phase.wheel?.key)).toEqual([
      'wheel1',
      'wheel2',
      undefined,
    ]);
    expect(
      ship.workbench.phases
        .find((phase) => phase.key === 'Combat1')
        ?.checkpoints.map((checkpoint) => checkpoint.key),
    ).not.toContain('outgoingGeneration');
    expect(
      ship.workbench.phases.flatMap((phase) =>
        phase.checkpoints.map((checkpoint) => checkpoint.key),
      ),
    ).not.toContain('outgoingGeneration');
  });

  it.each([
    {
      name: 'before-combat standard',
      window: { kind: 'standard' as const, phase: 'beforeCombat' as const },
    },
    {
      name: 'Fields',
      window: { kind: 'fields' as const, phaseKey: 'Combat1' },
    },
  ])('keeps the engine timeline authoritative for a $name checkpoint window', ({ window }) => {
    const assembled = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      oOccurrenceIds.combat04,
      undefined,
      undefined,
      (evaluatedRoom) => {
        const roster = evaluatedRoom.roomActionRoster;
        if (roster === undefined || roster.checkpoints[0] === undefined) {
          throw new Error('Ship Room Action checkpoint is missing');
        }
        return {
          ...evaluatedRoom,
          roomActionRoster: {
            ...roster,
            checkpoints: [{ ...roster.checkpoints[0], window }, ...roster.checkpoints.slice(1)],
          },
        };
      },
    ).assembly.node.room;
    expect(assembled.workbench.kind).toBe('ship');
  });
});
