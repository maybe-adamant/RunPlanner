import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

import { exitCapacityDrifts } from '../../../src/authored-project/commands/topology-reconciliation';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });

const o = createBiomeAddress('Surface', 'O');
const p = createBiomeAddress('Surface', 'P');
const q = createBiomeAddress('Surface', 'Q');
const icarusRoom = createOccurrenceAddress(o, createOccurrenceId('surface-o-combat01'));
const dropRoom = createOccurrenceAddress(p, createOccurrenceId('surface-p-1-1-p_combat03'));
const fork = createOccurrenceAddress(q, createOccurrenceId('surface-q-first-fork'));
const lostDoorRoom = createOccurrenceId('surface-q-first-miniboss-2');
const stalePickup = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
} as const;

function occurrence(project: ProjectDocument, room: OccurrenceAddress) {
  return project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId);
}

function order(project: ProjectDocument, room: OccurrenceAddress): readonly string[] {
  return (occurrence(project, room)?.roomActions.order ?? []).map(roomActionKey);
}

/**
 * An older save: Icarus's Supply Chain matures a drop in P, the Icarus room
 * keeps a pickup its Ship room never had, and Q's first fork was swapped to a
 * one-door room while its second door's room stayed planned.
 */
function olderSave(): ProjectDocument {
  const saved = JSON.parse(encodeProjectDocument(loadSurfaceScheduledLifecycleCheckpoint()));
  const icarus = saved.route.biomes
    .find((plan: { biomeKey: string }) => plan.biomeKey === 'O')
    .topology.occurrences.find(
      (candidate: { occurrenceId: string }) => candidate.occurrenceId === icarusRoom.occurrenceId,
    );
  icarus.roomActions.order.push(stalePickup);
  return applyProjectCommand(decodeProjectDocument(saved, catalog), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: fork,
    gameName: 'Q_Combat01',
  });
}

// Icarus offers another boon than Supply Chain.
const supplyChainAway: ProjectCommand = {
  kind: 'ReplaceTraitSelection',
  trait: createTraitOfferAddress(
    createEncounterPhaseAddress(
      o,
      { kind: 'occurrence', occurrenceId: icarusRoom.occurrenceId },
      'Combat1',
    ),
    'selection',
  ),
  selectedOptionKey: 'option2',
};

describe('one edit settling several passes', () => {
  it('settles door capacity, a taken drop and a stale row together, then converges', () => {
    const project = olderSave();
    const drop = order(project, dropRoom).filter((key) => key.includes('clockedTraitGenerated:'));
    expect(drop).toHaveLength(1);
    expect(order(project, icarusRoom)).toContain(roomActionKey(stalePickup));
    expect(exitCapacityDrifts(project, catalog)).toHaveLength(1);
    // The command alone leaves the stale row and the door; settlement owns both.
    const commanded = applyProjectCommand(project, catalog, supplyChainAway);
    expect(order(commanded, icarusRoom)).toContain(roomActionKey(stalePickup));
    expect(exitCapacityDrifts(commanded, catalog)).toHaveLength(1);

    const settled = settle(project, supplyChainAway);
    expect(settled.fault).toBeUndefined();
    const document = settled.assembly.project;
    // The batch keeps only the door its source declares.
    expect(exitCapacityDrifts(document, catalog)).toEqual([]);
    expect(occurrence(document, createOccurrenceAddress(q, lostDoorRoom))).toBeUndefined();
    // The drop went with its trait; the edited room lost its stale row.
    expect(order(document, dropRoom)).toEqual(
      order(project, dropRoom).filter((key) => !drop.includes(key)),
    );
    expect(order(document, icarusRoom)).toEqual(
      order(project, icarusRoom).filter((key) => key !== roomActionKey(stalePickup)),
    );
    // Removals elsewhere are announced; the edited room's stays silent.
    expect(settled.removedStaleActions).toEqual([
      {
        occurrence: dropRoom,
        actions: [expect.objectContaining({ kind: 'interactAcquisitionEntry' })],
      },
      {
        occurrence: fork,
        actions: [],
        doors: [{ exitKey: 'exit2', occurrenceId: lostDoorRoom, gameName: 'Q_MiniBoss05' }],
      },
    ]);
    expect(roomActionKey(settled.removedStaleActions![0]!.actions[0]!)).toBe(drop[0]);

    // Settled, the document has nothing left for another edit to repair.
    const again = settle(document, {
      kind: 'RenameProject',
      project: createProjectAddress(),
      name: 'Renamed',
    });
    expect(again.fault).toBeUndefined();
    expect(again.removedStaleActions).toBeUndefined();
    expect(again.assembly.project.route).toEqual(document.route);
  });
});
