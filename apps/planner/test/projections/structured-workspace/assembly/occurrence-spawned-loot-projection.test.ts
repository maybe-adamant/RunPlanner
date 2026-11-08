import { describe, expect, it } from 'vitest';
import {
  createOccurrenceId,
  roomActionKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { loadUnderworldFGHCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  nOccurrenceIds,
  oOccurrenceIds,
  surfaceShrineDeliveriesProject,
} from '@run-planner/test-fixtures/surface';
import type {
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceSpawnedItem,
} from '@planner/projections/structured-workspace';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

function roomOf(project: ProjectDocument, biomeKey: string, occurrenceId: OccurrenceId) {
  const node = projectStructuredWorkspaceFixture(project)
    .workspace.route.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
    );
  if (node === undefined) throw new Error(`${occurrenceId} is not projected`);
  return node.room;
}

/** The Timeline's boundaries, spawn notices and action rows, in order. */
function sequence(entries: readonly WorkspaceRoomLifecycleTimelineEntry[]) {
  return entries.flatMap((entry) => {
    switch (entry.kind) {
      case 'boundary':
        return [entry.boundary.key];
      case 'spawned':
        return [`spawned ${entry.key}`];
      case 'action':
        return [`action ${JSON.parse(entry.actionKey)[0]}`];
      case 'automaticEffect':
        return [];
    }
  });
}

const placement = (item: WorkspaceSpawnedItem) =>
  `${item.participation} ${item.placement.kind}${item.place === undefined ? '' : ` ${item.place.badge}`}`;

function notice(entries: readonly WorkspaceRoomLifecycleTimelineEntry[], key: string) {
  const found = entries.find(
    (entry): entry is Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'spawned' }> =>
      entry.kind === 'spawned' && entry.key === key,
  );
  if (found === undefined) throw new Error(`No ${key} notice`);
  return found;
}

describe('spawn notices', () => {
  it('follows an ordinary encounter end with its reward, deliveries and Supply Chain drops', () => {
    const room = roomOf(
      loadSurfaceScheduledLifecycleCheckpoint(),
      'P',
      createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    const entries = room.roomActions!.timeline.entries;
    const end = sequence(entries).indexOf('encounterEnd:Combat');
    expect(sequence(entries).slice(end, end + 3)).toEqual([
      'encounterEnd:Combat',
      'spawned encounterEnd:Combat',
      'action interactIncomingReward',
    ]);
    const spawned = notice(entries, 'encounterEnd:Combat');
    expect(spawned.label).toBe('Spawned');
    expect(spawned.items.map(placement)).toEqual([
      'required placed',
      'required placed',
      'optional placed',
      'optional unplaced',
    ]);
    // The reward first, then the delivery, each leading to its own row.
    const reward = room.roomActions!.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward',
    )!;
    expect(spawned.items[0]).toMatchObject({
      actionKey: reward.key,
      placement: { kind: 'placed', owner: reward.address },
    });
    const drop = spawned.items[3]!;
    if (drop.placement.kind !== 'unplaced') throw new Error('the second drop is placed');
    expect(drop.placement.intent.command.kind).toBe('PlaceClockedTraitPickup');
  });

  it('notifies an O combat phase at its end and again after its wheel reward', () => {
    const room = roomOf(surfaceShrineDeliveriesProject(), 'O', oOccurrenceIds.combat04);
    const entries = room.roomActions!.timeline.entries;
    const end = sequence(entries).indexOf('encounterEnd:Combat1');
    expect(sequence(entries).slice(end, end + 5)).toEqual([
      'encounterEnd:Combat1',
      'spawned encounterEnd:Combat1',
      'action interactWheelReward',
      'spawned afterEncounterReward:Combat1',
      'action interactAcquisitionEntry',
    ]);
    // Both notices sit on the phase's own Timeline.
    if (room.workbench?.kind !== 'ship') throw new Error('expected a Ship workbench');
    const phase = room.workbench.phases.find((candidate) => candidate.key === 'Combat1')!;
    expect(sequence(phase.timeline).filter((entry) => entry.startsWith('spawned'))).toEqual([
      'spawned encounterEnd:Combat1',
      'spawned afterEncounterReward:Combat1',
    ]);
  });

  it('notifies Fields cage and optional rewards on entry, each marked by its slot', () => {
    const room = roomOf(
      loadUnderworldFGHCheckpoint(),
      'H',
      createOccurrenceId('golden-h-combat02'),
    );
    const entries = room.roomActions!.timeline.entries;
    expect(sequence(entries).slice(0, 2)).toEqual(['roomEntered', 'spawned roomEntered']);
    expect(notice(entries, 'roomEntered').items.map(placement)).toEqual([
      'required placed C2',
      'required placed C1',
      'optional unplaced O1',
      'optional unplaced O2',
    ]);
  });

  it('lists Quick Buck’s gold under the reward pickup that grants it', () => {
    const room = roomOf(loadSurfaceNQuickBuckCheckpoint(), 'N', nOccurrenceIds.opening);
    const reward = room.roomActions!.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward' && !row.stale,
    )!;
    expect(room.roomActions!.actionSpawns).toEqual([
      expect.objectContaining({
        sourceActionKey: reward.key,
        label: 'Gold spawned',
        items: [expect.objectContaining({ label: 'Gold', participation: 'optional' })],
      }),
    ]);
    const gold = room.roomActions!.actionSpawns![0]!.items[0]!;
    expect(gold.actionKey).toBe(
      roomActionKey(
        room.roomActions!.rows.find((row) => row.sourceFamily?.kind === 'trait')!.reference,
      ),
    );
  });
});
