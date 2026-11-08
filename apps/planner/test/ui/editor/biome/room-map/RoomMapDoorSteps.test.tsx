// @vitest-environment jsdom

import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createGoldenFGHIProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  requireWorkspaceBiome,
  projectStructuredWorkspaceFixture,
} from '@planner-test/fixtures/structuredWorkspace';
import { renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(() => cleanup());

function focusRoom(
  application: PlannerApplication,
  address: ReturnType<typeof createOccurrenceAddress>,
) {
  act(() => {
    application.store.dispatch(semanticOwnerFocused(address));
  });
}

function timelineRows(): HTMLElement[] {
  return [...screen.getByRole('list', { name: 'Room timeline' }).children] as HTMLElement[];
}

const doorsOpenRow = () => timelineRows().find((row) => row.hasAttribute('data-doors-open'))!;

function mapDoor(doorIndex: number): HTMLElement {
  const map = screen
    .getAllByRole('region')
    .find((region) => region.getAttribute('aria-label')?.endsWith(' map'))!;
  return within(map)
    .getAllByRole('img')
    .find((point) => point.getAttribute('aria-label')?.startsWith(`Door ${doorIndex}`))!;
}

const mapFace = (doorIndex: number) =>
  mapDoor(doorIndex).querySelector('.room-map-door-face')?.innerHTML;

describe('room map door steps', () => {
  it('shows a locked door unlocked from its unlock row on', async () => {
    // G_Combat01: its second door can lock.
    const host = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b1-e1'));
    const locked = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceLockedExit',
      occurrence: host,
      exitKey: 'exit2',
      locked: true,
    });
    const { application, user } = renderWorkspace(locked, 'Underworld', 'G');
    focusRoom(application, host);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await user.click(screen.getByRole('button', { name: 'Doors' }));
    await user.click(await screen.findByRole('option', { name: 'Unlock Door 2' }));

    await user.click(doorsOpenRow());
    expect(mapDoor(2).getAttribute('data-locked')).not.toBeNull();
    expect(mapDoor(2).getAttribute('aria-label')).toMatch(/ · Locked$/);

    const unlockRow = timelineRows().find((row) =>
      row.getAttribute('data-room-action-key')?.includes('exit2'),
    )!;
    await user.click(unlockRow);
    expect(mapDoor(2).getAttribute('data-locked')).toBeNull();
    expect(mapDoor(2).getAttribute('aria-label')).not.toMatch(/Locked/);

    const leaveRow = timelineRows().find((row) => row.classList.contains('timeline-leave-row'))!;
    await user.click(leaveRow);
    expect(mapDoor(2).getAttribute('data-locked')).toBeNull();
  });

  it("shows a rerolled door's new rewards from its reroll row on", async () => {
    const f = createBiomeAddress('Underworld', 'F');
    const sourceId = createOccurrenceId('golden-f-b2-e1');
    const withCard = applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: ['DoorReroll'],
    });
    const projected = projectStructuredWorkspaceFixture(withCard);
    const batch = requireWorkspaceBiome(projected.workspace, 'F').nodes.find(
      (node) =>
        node.kind === 'ordinaryBatch' &&
        node.source.kind === 'occurrence' &&
        node.source.occurrenceId === sourceId,
    );
    if (batch?.kind !== 'ordinaryBatch' || batch.rerolls === undefined)
      throw new Error('the source room has no Rerolls list');
    const interaction = projected.workspace.interactions.roomRerolls.get(
      batch.rerolls.interactionKey,
    )!;
    const door1Key = semanticAddressKey(
      createIncomingRewardAddress(f, createOccurrenceId('golden-f-b3-e1')),
    );
    const resolver = interaction.pendingReward(door1Key);
    const items = resolver
      .model(await resolver.load(), 'type')
      .sections.flatMap((section) => section.items)
      .filter(
        (item) => !item.disabled && (item.value as ResolvedRewardOffer).payload === undefined,
      );
    const rerolled: ProjectDocument = applyProjectCommand(
      withCard,
      catalog,
      interaction.appendIntent(door1Key, items[0]!.value as ResolvedRewardOffer).command,
    );

    const { application, user } = renderWorkspace(rerolled, 'Underworld', 'F');
    focusRoom(application, createOccurrenceAddress(f, sourceId));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    await user.click(doorsOpenRow());
    const firstDraw = mapFace(1);
    const pressRow = timelineRows().find((row) => row.hasAttribute('data-door-press'))!;
    const pressedFace = within(pressRow)
      .getAllByRole('listitem')
      .find((chip) => chip.getAttribute('aria-label')?.startsWith('Door 1'))!.innerHTML;
    expect(pressedFace).not.toBe(firstDraw);

    await user.click(pressRow);
    expect(mapFace(1)).toBe(pressedFace);

    const leaveRow = timelineRows().find((row) => row.classList.contains('timeline-leave-row'))!;
    await user.click(leaveRow);
    expect(mapFace(1)).toBe(pressedFace);
  });
});
