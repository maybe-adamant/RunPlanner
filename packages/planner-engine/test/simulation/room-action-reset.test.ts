import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import {
  roomActionResetsForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createUnderworldFWellCheckpoint,
  goldenFBiome,
} from '@run-planner/test-fixtures/underworld';

import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../src/simulation/candidates/evaluated-biome';
import { createAuthoringSession } from '../../src/simulation/authoring/session';

const postboss = createOccurrenceAddress(
  goldenFBiome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);
const fountain = roomActionKey({ kind: 'useFountain' });
const rack = roomActionKey({ kind: 'interactKeepsakeRack' });
const purchase = (generationKey: string) =>
  roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey } as never);

describe('room action resets', () => {
  it('names each Timeline entry’s reset: a row keeps itself, a banner the rows before it', () => {
    const assembly = simulateProjectAssembly(catalog, createUnderworldFWellCheckpoint());
    const room = candidateBiomeRooms(candidateBiome(assembly.evaluation, 'Underworld', 'F')!).find(
      (candidate) => candidate.origin.occurrenceId === postboss.occurrenceId,
    )!;
    const resets = roomActionResetsForProjectEvaluationAssembly(catalog, assembly, postboss)!;
    const labelled = room.roomLifecycleTimeline.entries.map((entry, index) => [
      entry.kind === 'action'
        ? entry.action.key
        : entry.kind === 'boundary'
          ? entry.boundary.kind
          : entry.kind,
      resets[index]?.afterActionKey,
    ]);
    expect(labelled).toEqual([
      ['roomEntered', null],
      [fountain, fountain],
      // Doors open follows the fountain that opens them.
      ['cleanup', fountain],
      [rack, rack],
      [purchase('initial:secondLeft'), purchase('initial:secondLeft')],
      [purchase('initial:secondRight'), purchase('initial:secondRight')],
      // Nothing follows the last purchase.
      [purchase('travelDealRefill'), undefined],
    ]);
    // A banner's reset removes what follows it; the required fountain and the rack stay.
    const doorsOpen = resets[2]!;
    const reset = applyProjectCommand(assembly.project, catalog, doorsOpen);
    expect(
      reset.route.biomes
        .find((plan) => plan.biomeKey === 'F')!
        .topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === postboss.occurrenceId,
        )!
        .roomActions.order.map(roomActionKey),
    ).toEqual([fountain, rack]);
  });

  it('applies a reset as one authoring edit', () => {
    const start = simulateProjectAssembly(catalog, createUnderworldFWellCheckpoint());
    const session = createAuthoringSession(catalog, start);
    const command = roomActionResetsForProjectEvaluationAssembly(catalog, start, postboss)![3]!;
    const outcome = session.apply(command);
    expect(outcome.kind).toBe('applied');
    if (outcome.kind !== 'applied') return;
    expect(outcome.fault).toBeUndefined();
    const after = roomActionResetsForProjectEvaluationAssembly(
      catalog,
      outcome.assembly,
      postboss,
    )!;
    // Only the required fountain and the permanent rack remain: no entry has anything to reset.
    expect(after.every((entry) => entry === undefined)).toBe(true);
  });
});
