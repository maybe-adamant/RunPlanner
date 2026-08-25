import { describe, expect, it } from 'vitest';
import {
  assemble,
  applyProjectCommand,
  catalog,
  createGoldenFGHIProject,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  semanticAddressKey,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

describe('occurrence room workbench', () => {
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
