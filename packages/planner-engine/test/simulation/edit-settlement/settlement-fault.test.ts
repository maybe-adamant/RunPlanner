import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createOccurrenceAddress,
  ProjectCommandContractError,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { scheduleTestRequiredRoomActions } from '@run-planner/test-fixtures/shared';
import * as commands from '../../../src/authored-project/commands/dispatch';
import * as topology from '../../../src/authored-project/commands/topology-reconciliation';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);

/** O Combat07 with a third encounter and its placed wheel rows, which a return to two orphans. */
function threeEncounterShip(): ProjectDocument {
  return scheduleTestRequiredRoomActions(
    applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: ship,
      encounterCount: 3,
    }),
    catalog,
    oBiome,
  );
}
const twoEncounters = {
  kind: 'ReplaceShipEncounterCount',
  occurrence: ship,
  encounterCount: 2,
} as const;

describe('settlement repeat-repair guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stops at a repeated stale-row repair and reports the fault instead of throwing', () => {
    const project = threeEncounterShip();
    const apply = commands.applyProjectCommand;
    // The orphaned rows' removal never takes effect, so they stay stale.
    vi.spyOn(commands, 'applyProjectCommand').mockImplementation((document, catalog, command) =>
      command.kind === 'RemoveRoomAction' ? document : apply(document, catalog, command),
    );
    const before = evaluate(project);
    const settled = settleProjectEdit({ catalog, before, command: twoEncounters, evaluate });
    expect(settled.fault).toEqual({
      key: expect.stringMatching(/^stale:/),
      owner: expect.objectContaining({ kind: 'roomAction', occurrenceId: ship.occurrenceId }),
    });
    expect(settled.assembly.project).toEqual(apply(project, catalog, twoEncounters));
  });

  it('reports a door batch that cannot settle while the edit’s other repairs still settle', () => {
    const project = threeEncounterShip();
    // Returning to two encounters orphans the third's wheel rows, which settlement removes.
    const command = twoEncounters;
    const before = evaluate(project);
    const clean = settleProjectEdit({ catalog, before, command, evaluate });
    expect(clean.fault).toBeUndefined();
    expect(clean.assembly.project).not.toEqual(
      commands.applyProjectCommand(project, catalog, command),
    );

    // The source's batch reports drift and its reconciliation disagrees with the topology.
    const decision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat07,
    });
    vi.spyOn(topology, 'exitCapacityDrifts').mockReturnValue([
      { decision, undeclared: [], missing: [] },
    ]);
    vi.spyOn(topology, 'settleExitCapacity').mockImplementation(() => {
      throw new ProjectCommandContractError(command.kind, decision, 'disagreeing topology');
    });
    const faulted = settleProjectEdit({ catalog, before, command, evaluate });
    expect(faulted.fault).toEqual({
      key: `exitCapacity:${semanticAddressKey(decision)}`,
      owner: decision,
    });
    // The orphaned rows are still removed: only the door pass stopped.
    expect(faulted.assembly.project).toEqual(clean.assembly.project);
  });
});
