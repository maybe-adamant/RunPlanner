// @vitest-environment jsdom

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createStartingRewardAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createStaleSurfaceHermesDeliveryPlacement,
  createTwoStaleSurfaceHermesDeliveryPlacements,
} from '@run-planner/test-fixtures/surface';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import {
  renderOccurrenceWorkbench,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import { occurrenceById } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

/** The stale delivery row's delete; the row names its reward, its origin is a hint. */
function deliveryRemoval(entryKey: string): HTMLElement | null {
  const key = roomActionKey({
    kind: 'interactAcquisitionEntry',
    siteKey: 'hermesShrineDelivery',
    entryKey,
  });
  return (
    document
      .querySelector(`li[data-room-action-key="${CSS.escape(key)}"]`)
      ?.querySelector<HTMLElement>('button[aria-label$=" from timeline"]') ?? null
  );
}

function occurrence(project: ProjectDocument, occurrenceId: string) {
  return project.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((room) => room.occurrenceId === occurrenceId)!;
}

it('runs delivery deletion as one exact authored edit and restores it through Undo', async () => {
  const { project, host, source, entryKey } = createStaleSurfaceHermesDeliveryPlacement();
  const view = renderOccurrenceWorkbench(
    project,
    'Surface',
    host.biomeKey,
    occurrenceById(host.occurrenceId),
    undefined,
    { initialTab: 'actions' },
  );
  const projected = workspaceProjection(view.application);
  expect(projected.authoringReadiness(host)).toBe('editable');
  const button = deliveryRemoval(entryKey)!;
  expect(button.getAttribute('aria-label')).toMatch(/^Remove .* from timeline$/);
  expect(button.closest('[inert]')).toBeNull();
  // With no other legal position its reorder handle stays, disabled.
  const moveSlot = within(button.closest('li')!).getByRole('button', { name: /^Reorder / });
  expect(moveSlot.getAttribute('aria-disabled')).toBe('true');
  expect(button.classList.contains('danger-action')).toBe(true);
  expect(
    screen.queryByText('This delivery is no longer available. Remove it from the timeline.'),
  ).toBeNull();
  expect(document.querySelector('.room-action-issues')).toBeNull();
  const prior = view.application.store.getState().projectWorkspace;
  if (prior.kind !== 'openProject') throw new Error('project missing');
  const sourceShrine = occurrence(prior.history.present, source.occurrenceId).hermesShrine;
  await view.user.click(button);
  await waitFor(() => expect(deliveryRemoval(entryKey)).toBeNull());
  const repaired = view.application.store.getState().projectWorkspace;
  if (repaired.kind !== 'openProject') throw new Error('project missing');
  expect(repaired.history.past).toHaveLength(prior.history.past.length + 1);
  expect(
    occurrence(repaired.history.present, host.occurrenceId).acquisitionSites?.hermesShrineDelivery
      ?.pickupEntries?.[entryKey],
  ).toBeUndefined();
  expect(occurrence(repaired.history.present, source.occurrenceId).hermesShrine).toEqual(
    sourceShrine,
  );
  act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
  await waitFor(() => expect(deliveryRemoval(entryKey)).not.toBeNull());
  const restored = view.application.store.getState().projectWorkspace;
  if (restored.kind !== 'openProject') throw new Error('project missing');
  expect(restored.history.present).toBe(prior.history.present);
});

it('renders two named structural repair targets under the actual earlier-blocker readiness lock', () => {
  const { project, host } = createTwoStaleSurfaceHermesDeliveryPlacements();
  const blocked = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Surface'),
    value: null,
  });
  const view = renderOccurrenceWorkbench(
    blocked,
    'Surface',
    host.biomeKey,
    occurrenceById(host.occurrenceId),
    undefined,
    { initialTab: 'actions' },
  );
  const projected = workspaceProjection(view.application);
  expect(projected.authoringReadiness(host)).toBe('locked');
  const repairs = within(screen.getByRole('region', { name: 'Placement repairs' })).getAllByRole(
    'button',
  );
  expect(repairs).toHaveLength(2);
  expect(new Set(repairs.map((button) => button.getAttribute('aria-label'))).size).toBe(2);
  for (const button of repairs) {
    expect(button.classList.contains('danger-action')).toBe(true);
    expect(button.closest('[inert]')?.getAttribute('data-semantic-owner')).toBe(
      semanticAddressKey(host),
    );
  }
  expect(screen.queryByRole('list', { name: 'Room timeline' })).toBeNull();
});
