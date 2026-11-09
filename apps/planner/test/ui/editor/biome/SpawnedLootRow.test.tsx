// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';
import {
  loadSurfaceScheduledLifecycleCheckpoint,
  loadSurfaceShrineTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadNemesisPomSeaStarCheckpoint,
  loadUnderworldFGHCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { pickupSourceBadgeIcon } from '@planner/ui/artwork/sourceBadgeArtwork';
import { renderOccurrenceWorkbench, workspaceBiome } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

const combat03 = 'surface-p-1-1-p_combat03';

function render() {
  const view = renderOccurrenceWorkbench(
    loadSurfaceScheduledLifecycleCheckpoint(),
    'Surface',
    'P',
    occurrenceById(combat03),
  );
  openRoomTab('Room Timeline');
  return view;
}

function spawnedItems(): HTMLButtonElement[] {
  return within(screen.getByRole('listitem', { name: 'Spawned' })).getAllByRole('button');
}

function roomActions(view: ReturnType<typeof render>) {
  const node = workspaceBiome(view.application, 'Surface', 'P').nodes.find(
    (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === combat03,
  );
  return node!.room.roomActions!;
}

describe('spawn notice items', () => {
  it('focuses the Timeline row of a placed item', async () => {
    const view = render();
    const reward = roomActions(view).rows.find(
      (row) => row.reference.kind === 'interactIncomingReward' && !row.stale,
    )!;
    await view.user.click(spawnedItems()[0]!);
    expect(document.activeElement?.getAttribute('data-room-action-key')).toBe(reward.key);
  });

  it('places an unplaced optional item in one edit', async () => {
    const view = render();
    const unplaced = () =>
      roomActions(view).rows.filter(
        (row) => row.rank === null && row.sourceFamily?.kind === 'trait' && !row.stale,
      );
    expect(unplaced()).toHaveLength(1);
    const drop = spawnedItems().at(-1)!;
    expect(drop.hasAttribute('data-spawn-placed')).toBe(false);
    await view.user.click(drop);
    await waitFor(() => expect(unplaced()).toHaveLength(0));
    expect(spawnedItems().at(-1)!.hasAttribute('data-spawn-placed')).toBe(true);
    expect(
      drop.closest('[data-spawned-loot]')?.querySelector('[aria-live="polite"]')?.textContent,
    ).toMatch(/added to the timeline\.$/);
  });

  it('opens a placed Pom Slice’s Pom choice at once', async () => {
    const view = render();
    expect(
      within(screen.getByRole('listitem', { name: 'Spawned' })).getByRole('group', {
        name: 'Supply Chain',
      }),
    ).toBeTruthy();
    await view.user.click(spawnedItems().at(-1)!);
    await waitFor(() =>
      expect(view.application.store.getState().editorSession.levelResolutionDialogTarget).toEqual(
        expect.objectContaining({ kind: 'levelResolution' }),
      ),
    );
  });

  it('leaves spawned pickups out of the Optional actions', () => {
    render();
    const optional = screen.getByRole('region', { name: 'Optional actions' });
    expect(within(optional).queryByRole('button', { name: /Supply Chain/ })).toBeNull();
    expect(within(optional).getByText('Nothing optional to add here')).toBeTruthy();
  });
});

describe('converted and copied loot', () => {
  it('focuses a Sea Star copy’s collect from its chip on the copied pickup’s row', async () => {
    const view = renderOccurrenceWorkbench(
      loadNemesisPomSeaStarCheckpoint(),
      'Underworld',
      'F',
      occurrenceById('golden-f-b5-e1'),
    );
    openRoomTab('Room Timeline');
    const node = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' &&
        candidate.room.occurrenceId === 'golden-f-b5-e1',
    )!;
    const actions = node.room.roomActions!;
    const original = actions.rows.find((row) => row.sourceFamily?.kind === 'nemesisEvent')!;
    const copy = actions.rows.find((row) => row.sourceFamily?.kind === 'seaStar')!;
    const originalRow = document.querySelector<HTMLElement>(
      `[data-room-action-key="${CSS.escape(original.key)}"]`,
    )!;
    await view.user.click(within(originalRow).getByRole('button', { name: 'Sea Star copy' }));
    expect(document.activeElement?.getAttribute('data-room-action-key')).toBe(copy.key);
  });

  it('places a rushed Shrine item left behind from the spawn row under its purchase', async () => {
    const postboss = 'surface-n-preboss:postboss';
    const checkpoint = loadSurfaceShrineTravelDealCheckpoint();
    const pickup = checkpoint.route.biomes
      .find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === postboss)!
      .roomActions.order.find(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === 'hermesShrineDelivery',
      )!;
    const project = applyProjectCommand(checkpoint, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(
        createBiomeAddress('Surface', 'N'),
        createOccurrenceId(postboss),
        roomActionKey(pickup),
      ),
    });
    const view = renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(postboss));
    openRoomTab('Room Timeline');
    const optional = screen.getByRole('region', { name: 'Optional actions' });
    expect(within(optional).queryByRole('button', { name: /Big Heal/ })).toBeNull();
    const chip = within(screen.getByRole('listitem', { name: 'Spawned' })).getByRole('button', {
      name: 'Big Heal',
    });
    expect(chip.hasAttribute('data-spawn-placed')).toBe(false);
    await view.user.click(chip);
    await waitFor(() =>
      expect(
        document.querySelector(`[data-room-action-key="${CSS.escape(roomActionKey(pickup))}"]`),
      ).not.toBeNull(),
    );
  });
});

function actionRow(key: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-room-action-key="${CSS.escape(key)}"]`)!;
}

function sourceBadge(element: Element): string | null | undefined {
  return element.querySelector('.timeline-source-badge')?.getAttribute('src');
}

describe('source badges', () => {
  it('marks Supply Chain drops with their source and leaves the room reward bare', async () => {
    const view = render();
    const drops = () =>
      roomActions(view).rows.filter(
        (row) => row.sourceFamily?.kind === 'trait' && !row.stale && row.rank !== null,
      );
    await view.user.click(spawnedItems().at(-1)!);
    await waitFor(() => expect(drops().length).toBeGreaterThan(0));
    const drop = drops()[0]!;
    const badge = pickupSourceBadgeIcon(drop.sourceFamily);
    expect(badge).toBeDefined();
    expect(sourceBadge(actionRow(drop.key))).toBe(badge);
    const group = within(screen.getByRole('listitem', { name: 'Spawned' })).getByRole('group', {
      name: 'Supply Chain',
    });
    for (const chip of within(group).getAllByRole('button')) expect(sourceBadge(chip)).toBe(badge);
    const reward = roomActions(view).rows.find(
      (row) => row.reference.kind === 'interactIncomingReward' && !row.stale,
    )!;
    expect(sourceBadge(actionRow(reward.key))).toBeUndefined();
    expect(sourceBadge(spawnedItems()[0]!)).toBeUndefined();
  });

  it('marks a Sea Star copy’s collect with Sea Star, not the copy chip', () => {
    const view = renderOccurrenceWorkbench(
      loadNemesisPomSeaStarCheckpoint(),
      'Underworld',
      'F',
      occurrenceById('golden-f-b5-e1'),
    );
    openRoomTab('Room Timeline');
    const node = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' &&
        candidate.room.occurrenceId === 'golden-f-b5-e1',
    )!;
    const actions = node.room.roomActions!;
    const original = actions.rows.find((row) => row.sourceFamily?.kind === 'nemesisEvent')!;
    const copy = actions.rows.find((row) => row.sourceFamily?.kind === 'seaStar')!;
    expect(pickupSourceBadgeIcon({ kind: 'seaStar' })).toBeDefined();
    expect(sourceBadge(actionRow(copy.key))).toBe(pickupSourceBadgeIcon({ kind: 'seaStar' }));
    const copyChip = within(actionRow(original.key)).getByRole('button', {
      name: 'Sea Star copy',
    });
    expect(sourceBadge(copyChip)).toBeUndefined();
  });
});

describe('Hermes Shrine rows', () => {
  const postboss = 'surface-n-preboss:postboss';

  function renderPostboss() {
    const view = renderOccurrenceWorkbench(
      loadSurfaceShrineTravelDealCheckpoint(),
      'Surface',
      'N',
      occurrenceById(postboss),
    );
    openRoomTab('Room Timeline');
    const node = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === postboss,
    )!;
    return node.room.roomActions!.rows;
  }

  it('marks a delivered item with the Shrine', () => {
    const rows = renderPostboss();
    const delivery = rows.find((row) => row.sourceFamily?.kind === 'hermesShrineDelivery')!;
    expect(pickupSourceBadgeIcon(delivery.sourceFamily)).toBeDefined();
    expect(sourceBadge(actionRow(delivery.key))).toBe(
      pickupSourceBadgeIcon({ kind: 'hermesShrineDelivery' }),
    );
  });

  it('leads a purchase with the Shrine carrying its slot or Travel Deal mark, then the item', () => {
    const rows = renderPostboss();
    const rush = rows.find((row) => row.slot !== undefined && !row.stale)!;
    const rushLabel = actionRow(rush.key).querySelector('[data-timeline-cell="label"]')!;
    const store = rushLabel.querySelector('.timeline-row-icon')!;
    expect(store.querySelector('.timeline-slot-badge')?.textContent).toBe(String(rush.slot));
    const item = rushLabel.querySelector('.row-reward-icon')!;
    expect(store.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(item.querySelector('.timeline-slot-badge, .timeline-source-badge')).toBeNull();

    const refill = rows.find((row) => row.travelDeal === true && !row.stale)!;
    const refillLabel = actionRow(refill.key).querySelector('[data-timeline-cell="label"]')!;
    const refillStore = refillLabel.querySelector('.timeline-row-icon')!;
    expect(refillStore.querySelector('.timeline-travel-deal-badge')).not.toBeNull();
    expect(refillStore.querySelector('span.timeline-slot-badge')).toBeNull();
    const refillItem = refillLabel.querySelector('.row-reward-icon')!;
    expect(
      refillItem.querySelector('.timeline-travel-deal-badge, .timeline-source-badge'),
    ).toBeNull();
  });
});

describe('locked loot', () => {
  function renderRoom(
    project: Parameters<typeof renderOccurrenceWorkbench>[0],
    routeKey: string,
    biomeKey: string,
    occurrenceId: string,
  ) {
    const view = renderOccurrenceWorkbench(
      project,
      routeKey,
      biomeKey,
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const node = workspaceBiome(view.application, routeKey, biomeKey).nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
    )!;
    return { view, actions: node.room.roomActions! };
  }
  const spawnRows = (kind: 'moment' | 'unlocks') => [
    ...document.querySelectorAll<HTMLElement>(`[data-spawned-loot="${kind}"]`),
  ];
  const chips = (row: HTMLElement) => within(row).getAllByRole('button');
  const chipLocks = (row: HTMLElement) =>
    chips(row).map((chip) => chip.hasAttribute('data-spawn-locked'));

  it('locks Fields cage rewards on entry and frees each at its cage fight’s end', async () => {
    const { view, actions } = renderRoom(
      loadUnderworldFGHCheckpoint(),
      'Underworld',
      'H',
      'golden-h-combat02',
    );
    const [entry] = spawnRows('moment');
    // Two cages, then two optional rewards that are takeable at once.
    expect(chipLocks(entry!)).toEqual([true, true, false, false]);
    const unlocks = spawnRows('unlocks');
    expect(unlocks.map((row) => chips(row).length)).toEqual([1, 1]);
    for (const row of unlocks) expect(chipLocks(row)).toEqual([false]);
    // Spawned and Unlocks rows share the collect rows' Timeline frame.
    for (const row of [entry!, ...unlocks]) expect(row.classList).toContain('timeline-row-frame');
    const cage = actions.rows.find(
      (row) => row.reference.kind === 'interactLocalReward' && row.reference.slotKey === 'cage2',
    )!;
    await view.user.click(chips(unlocks[0]!)[0]!);
    expect(document.activeElement?.getAttribute('data-room-action-key')).toBe(cage.key);
  });

  it('locks an H miniboss reward at its encounter start until the encounter ends', async () => {
    const { view, actions } = renderRoom(
      loadUnderworldFGHCheckpoint(),
      'Underworld',
      'H',
      'golden-h-miniboss01',
    );
    expect(spawnRows('moment').map(chipLocks)).toEqual([[true]]);
    const [unlock] = spawnRows('unlocks');
    const reward = actions.rows.find(
      (row) => row.reference.kind === 'interactIncomingReward' && !row.stale,
    )!;
    await view.user.click(chips(unlock!)[0]!);
    expect(document.activeElement?.getAttribute('data-room-action-key')).toBe(reward.key);
  });
});
