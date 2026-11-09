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
  WorkspaceSpawnGroup,
  WorkspaceSpawnedItem,
} from '@planner/projections/structured-workspace';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { galleryCases } from '@planner-test/support/gallery/cases';
import { buildGalleryProject } from '@planner-test/support/gallery/galleryCase';

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

/** Each group as "[source]: items", the room's own rewards with no source. */
const grouped = (groups: readonly WorkspaceSpawnGroup[]) =>
  groups.map(
    (group) =>
      `${group.source === undefined ? '' : `[${group.source.name}]: `}${group.items.map((item) => item.label).join(', ')}`,
  );

const items = (groups: readonly WorkspaceSpawnGroup[]) => groups.flatMap((group) => group.items);

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
    expect(grouped(spawned.groups)).toEqual([
      'Max Health',
      '[Hermes]: Max Health',
      '[Supply Chain]: Pom Slice, Pom Slice',
    ]);
    expect(items(spawned.groups).map(placement)).toEqual([
      'required placed',
      'required placed',
      'optional placed',
      'optional unplaced',
    ]);
    // The reward first, then the delivery, each leading to its own row.
    const reward = room.roomActions!.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward',
    )!;
    expect(items(spawned.groups)[0]).toMatchObject({
      actionKey: reward.key,
      placement: { kind: 'placed', owner: reward.address },
    });
    const drop = items(spawned.groups)[3]!;
    if (drop.placement.kind !== 'unplaced') throw new Error('the second drop is placed');
    expect(drop.placement.intent.command.kind).toBe('PlaceClockedTraitPickup');
    // The engine says its Pom Slice asks for its Pom once placed.
    expect(drop.hint).toBe('Pick up Pom Slice — choose its Pom');
  });

  it('places spawned optional loot from its spawn row, not the Optional actions', () => {
    const room = roomOf(
      loadSurfaceScheduledLifecycleCheckpoint(),
      'P',
      createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    const actions = room.roomActions!;
    const drop = items(notice(actions.timeline.entries, 'encounterEnd:Combat').groups)[3]!;
    expect(drop.placement.kind).toBe('unplaced');
    expect(actions.rows.find((row) => row.key === drop.actionKey)?.rank).toBeNull();
    expect(actions.optionalRows.map((row) => row.key)).not.toContain(drop.actionKey);
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
    const spawned = items(notice(entries, 'roomEntered').groups);
    expect(spawned.map(placement)).toEqual([
      'required placed C2',
      'required placed C1',
      'optional unplaced O1',
      'optional unplaced O2',
    ]);
    // Its optional rewards are placed from their chips alone.
    const optionalKeys = room.roomActions!.optionalRows.map((row) => row.key);
    for (const item of spawned.filter((candidate) => candidate.participation === 'optional')) {
      expect(item.placement.kind).toBe('unplaced');
      expect(optionalKeys).not.toContain(item.actionKey);
    }
  });

  it('lists Quick Buck’s gold under the reward pickup that grants it', () => {
    const room = roomOf(loadSurfaceNQuickBuckCheckpoint(), 'N', nOccurrenceIds.opening);
    const reward = room.roomActions!.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward' && !row.stale,
    )!;
    expect(room.roomActions!.actionSpawns).toEqual([
      expect.objectContaining({ sourceActionKey: reward.key, label: 'Spawned' }),
    ]);
    const spawn = room.roomActions!.actionSpawns![0]!;
    expect(grouped(spawn.groups)).toEqual(['[Quick Buck]: Gold']);
    const gold = items(spawn.groups)[0]!;
    expect(gold.participation).toBe('optional');
    expect(gold.actionKey).toBe(
      roomActionKey(
        room.roomActions!.rows.find((row) => row.sourceFamily?.kind === 'trait')!.reference,
      ),
    );
  });
});

/** A gallery case's project, opened on its room. */
function galleryRoom(id: string, biomeKey: string, occurrenceId: string) {
  const entry = galleryCases.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`No gallery case ${id}`);
  return roomOf(buildGalleryProject(entry), biomeKey, createOccurrenceId(occurrenceId));
}

describe('converted and copied loot', () => {
  it('lists the Artificer’s new reward under the transform', () => {
    const actions = galleryRoom(
      'artificer-transform',
      'F',
      'e9c1775e-a04b-4ed2-b749-7ef344614cbe',
    ).roomActions!;
    const transform = actions.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward' && !row.stale,
    )!;
    expect(transform.artificerOutput).toBeDefined();
    const spawn = actions.actionSpawns?.find((entry) => entry.sourceActionKey === transform.key);
    expect(grouped(spawn!.groups)).toEqual(['[Artificer]: Hermes']);
    const replacement = actions.rows.find((row) => row.sourceFamily?.kind === 'artificer')!;
    expect(items(spawn!.groups)[0]).toMatchObject({
      actionKey: replacement.key,
      placement: { kind: 'placed', owner: replacement.address },
    });
  });

  it('marks Sea Star’s copy on the copied pickup’s row, not as a spawn row', () => {
    const actions = galleryRoom('pom-sea-star-nemesis', 'F', 'golden-f-b5-e1').roomActions!;
    const original = actions.rows.find((row) => row.sourceFamily?.kind === 'nemesisEvent')!;
    const copy = actions.rows.find((row) => row.sourceFamily?.kind === 'seaStar')!;
    expect(actions.spawnCopies).toEqual([
      expect.objectContaining({
        sourceActionKey: original.key,
        source: expect.objectContaining({ name: 'Sea Star' }),
        item: expect.objectContaining({
          actionKey: copy.key,
          placement: { kind: 'placed', owner: copy.address },
        }),
      }),
    ]);
    expect(
      (actions.actionSpawns ?? []).flatMap((spawn) =>
        spawn.groups.flatMap((group) => (group.source === undefined ? [] : [group.source.name])),
      ),
    ).toEqual(['Nemesis']);
  });

  it('lists a rushed Shrine item under the purchase that rushes it', () => {
    const actions = galleryRoom(
      'shrine-rush-travel-deal',
      'N',
      'surface-n-preboss:postboss',
    ).roomActions!;
    const rush = actions.rows.find(
      (row) =>
        row.reference.kind === 'purchaseHermesShrineOffer' &&
        row.reference.generationKey === 'initial:first',
    )!;
    const spawn = actions.actionSpawns?.find((entry) => entry.sourceActionKey === rush.key);
    expect(grouped(spawn!.groups)).toEqual(['[Hermes]: Big Heal']);
    expect(items(spawn!.groups).map(placement)).toEqual(['optional placed']);
  });

  it('places a rushed item left behind from its spawn row; the Add area keeps only objects', () => {
    const room = galleryRoom('optional-actions-rush-unplaced', 'O', 'surface-o-combat02');
    const actions = room.roomActions!;
    const pickup = actions.rows.find((row) => row.sourceFamily?.kind === 'hermesShrineDelivery')!;
    expect(pickup.rank).toBeNull();
    const rush = actions.rows.find((row) => row.reference.kind === 'purchaseHermesShrineOffer')!;
    const spawn = actions.actionSpawns!.find((entry) => entry.sourceActionKey === rush.key)!;
    const item = items(spawn.groups)[0]!;
    expect(item.actionKey).toBe(pickup.key);
    if (item.placement.kind !== 'unplaced') throw new Error('the rushed item is placed');
    expect(item.placement.intent.command.kind).toBe('InsertRoomAction');
    // Beside the Shrine and switch objects, only the switch's use remains to add.
    expect(actions.optionalRows.map((row) => row.reference.kind)).toEqual([
      'interactChallengeSwitch',
    ]);
  });

  it('leaves the World Shop’s Travel Deal refill a World Shop purchase', () => {
    const actions = galleryRoom(
      'world-shop-travel-deal',
      'F',
      'golden-f-preboss-shop',
    ).roomActions!;
    const refill = actions.rows.find((row) => row.sourceFamily?.kind === 'shopTravelDealRefill')!;
    expect(refill.addGroup).toMatchObject({ object: 'worldShop' });
    expect(actions.actionSpawns ?? []).toEqual([]);
    expect(actions.optionalRows).toEqual([]);
  });
});
