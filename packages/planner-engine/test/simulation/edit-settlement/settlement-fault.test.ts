import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  hermesShrineDeliveryEntryKey,
  ProjectCommandContractError,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import * as commands from '../../../src/authored-project/commands/dispatch';
import * as topology from '../../../src/authored-project/commands/topology-reconciliation';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

describe('settlement repeat-repair guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stops at a repeated delivery repair and reports the fault instead of throwing', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
        'hermesShrineDelivery',
      ),
      hermesShrineDeliveryEntryKey(source, 'initial:secondLeft'),
    );
    const apply = commands.applyProjectCommand;
    // The due delivery's placement never takes effect, so its obligation stays due.
    vi.spyOn(commands, 'applyProjectCommand').mockImplementation((document, catalog, command) =>
      command.kind === 'PlaceHermesShrineDelivery' ? document : apply(document, catalog, command),
    );
    const command = {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondRight',
      value: { rewardType: 'MaxManaDrop' },
    } as const;
    const before = evaluate(project);
    const settled = settleProjectEdit({ catalog, before, command, evaluate });
    expect(settled.fault).toEqual({
      key: expect.stringMatching(/^delivery:/),
      owner: entry,
    });
    expect(settled.assembly.project).toEqual(apply(project, catalog, command));
    expect(settled.assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'hermesShrineDeliveryPlacementRequired', origin: entry }),
    );
  });

  it('reports a door batch that cannot settle while the edit’s other repairs still settle', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const command = {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondRight',
      value: { rewardType: 'MaxManaDrop' },
    } as const;
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
    // The due delivery is still placed: only the door pass stopped.
    expect(faulted.assembly.project).toEqual(clean.assembly.project);
  });
});
