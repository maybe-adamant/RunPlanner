// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createOccurrenceId,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLauncherPresentation } from '@planner/projections/structured-workspace';
import { LauncherButton } from '@planner/ui/editor/rewards/LauncherButton';
import { loadUnderworldFigLeafCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import { hintOf } from '@planner-test/support/hints';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function timeline(): HTMLElement {
  return within(screen.getByRole('region', { name: 'Room Timeline' })).getByRole('list', {
    name: 'Room timeline',
  });
}

function cell(row: Element, name: 'label' | 'editors' | 'money' | 'actions'): HTMLElement {
  return row.querySelector<HTMLElement>(`:scope > [data-timeline-cell="${name}"]`)!;
}

/** The F room whose fixed reward pickup is plain gold. */
function renderGoldRoom() {
  return renderOccurrenceWorkbench(
    createGoldenFGHIProject(),
    'Underworld',
    'F',
    occurrenceById(createOccurrenceId('golden-f-b10-e1')),
  );
}

const goldPickupKey = roomActionKey({
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'self',
});

describe('Room Timeline row anatomy', () => {
  it('names a row’s reward by its icon, whose accessible name is the reward', () => {
    renderGoldRoom();
    openRoomTab('Room Timeline');
    const row = timeline().querySelector<HTMLElement>(
      `[data-room-action-key="${CSS.escape(goldPickupKey)}"]`,
    )!;
    expect(within(cell(row, 'label')).getByText('Collect')).toBeTruthy();
    const reward = within(cell(row, 'label')).getByRole('img', { name: 'Gold' });
    expect(reward.classList.contains('row-reward-icon')).toBe(true);
    expect(hintOf(reward)).toBe('Gold');
    expect(row.querySelector('.row-reward-boosted')).toBeNull();
  });

  it('marks a Boosted boon on its reward icon', async () => {
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'I',
      occurrenceById(createOccurrenceId('golden-i-preboss')),
    );
    await view.user.click(screen.getByRole('button', { name: 'Offer 1 Item' }));
    const boosted = within(await screen.findByRole('listbox')).getByRole('group', {
      name: 'Boosted Boon',
    });
    await view.user.click(within(boosted).getAllByRole('option')[0]!);
    openRoomTab('Room Timeline');
    await view.user.click(screen.getByRole('button', { name: 'World Shop' }));
    const option = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find((candidate) => /^Buy Boosted /.test(candidate.textContent ?? ''));
    if (option === undefined) throw new Error('The World Shop offers no boon to buy');
    await view.user.click(option);
    const row = [...timeline().querySelectorAll<HTMLElement>('li[data-room-action-key]')].find(
      (candidate) => candidate.querySelector('.row-reward-boosted') !== null,
    );
    if (row === undefined) throw new Error('No row marks a Boosted boon');
    const icon = row.querySelector<HTMLElement>('.row-reward-icon')!;
    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.getAttribute('aria-label')).toMatch(/^Boosted .+ boon$/);
    expect(icon.querySelector('.row-reward-boosted')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps a quieter disabled handle on a row with no legal move', () => {
    renderGoldRoom();
    openRoomTab('Room Timeline');
    const row = timeline().querySelector<HTMLElement>(
      `[data-room-action-key="${CSS.escape(goldPickupKey)}"]`,
    )!;
    const handle = within(row).getByRole('button', { name: /^Reorder Collect / });
    expect(handle.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(handle, { detail: 0 });
    expect(handle.getAttribute('aria-pressed')).toBeNull();
  });
});

describe('Encounter banners', () => {
  const skipped = createOccurrenceId('golden-f-b2-e1');

  it('shows each start event as an icon toggle named by its meaning', () => {
    const view = renderOccurrenceWorkbench(
      loadUnderworldFigLeafCheckpoint(),
      'Underworld',
      'F',
      occurrenceById(skipped),
    );
    openRoomTab('Room Timeline');
    const skip = () =>
      within(within(timeline()).getByLabelText('Encounter')).getByRole('button', {
        name: 'Fig Leaf skip',
      });
    const authored = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((room) => room.occurrenceId === skipped)?.encounters
        .figLeafSkipByPhase?.Encounter;
    // The icon alone does not say what it means: its name is its hint on hover and focus.
    expect(skip().textContent).toBe('');
    expect(skip().getAttribute('aria-pressed')).toBe('true');
    skip().focus();
    expect(document.activeElement).toBe(skip());
    expect(hintOf(skip())).toBe('Fig Leaf skip');
    fireEvent.click(skip());
    expect(skip().getAttribute('aria-pressed')).toBe('false');
    expect(authored()).not.toBe(true);
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(skip().getAttribute('aria-pressed')).toBe('true');
    expect(authored()).toBe(true);
  });

  it('keeps a retained Death Defiance condition on a skipped start, clearable and marked', () => {
    const project = applyProjectCommand(loadUnderworldFigLeafCheckpoint(), catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: skipped },
        'Encounter',
      ),
      value: true,
    });
    renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(skipped));
    openRoomTab('Room Timeline');
    const events = within(within(timeline()).getByLabelText('Encounter')).getByRole('group', {
      name: 'Encounter start',
    });
    const condition = within(events).getByRole('button', {
      name: 'No Death Defiance',
    }) as HTMLButtonElement;
    expect(condition.getAttribute('aria-pressed')).toBe('true');
    // Its own finding keeps it clearable and quietly marks it as having no effect.
    expect(condition.disabled).toBe(false);
    expect(condition.dataset.hasFindings).toBe('true');
    expect(condition.closest('[data-inapplicable]')).not.toBeNull();
  });
});

describe('Trait-family chips', () => {
  const launcher: WorkspaceLauncherPresentation = {
    label: 'Edit Trait · Divine Dash of an Unusually Long Name',
    value: 'Divine Dash of an Unusually Long Name',
  };

  function renderChip() {
    render(
      <LauncherButton
        contextReached
        launcher={launcher}
        onClick={() => undefined}
        target={{
          id: 'chip',
          'data-semantic-owner': 'chip',
          'data-has-findings': false,
          'aria-description': undefined,
        }}
      />,
    );
    return screen.getByRole('button', { name: launcher.label });
  }

  it('shows only its value and keeps the full label as its accessible name', () => {
    const chip = renderChip();
    expect(chip.textContent).toBe(launcher.value);
  });

  it('shows the full value on hover only while it is cut off', () => {
    const text = renderChip().querySelector<HTMLElement>('.dialog-launcher-text')!;
    vi.spyOn(text, 'clientWidth', 'get').mockReturnValue(120);
    const width = vi.spyOn(text, 'scrollWidth', 'get').mockReturnValue(120);
    fireEvent.mouseEnter(text);
    expect(text.title).toBe('');
    width.mockReturnValue(300);
    fireEvent.mouseEnter(text);
    expect(text.title).toBe(launcher.value);
  });
});
