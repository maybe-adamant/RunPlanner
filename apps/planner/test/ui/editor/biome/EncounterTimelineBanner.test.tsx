// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createRouteStartKeepsakeSelectionAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';
import { loadNemesisFieldsCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oOccurrenceIds,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import {
  occurrenceById,
  openRoomTab,
  reachedAnomalyProject,
} from '@planner-test/support/occurrence-workbench';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);

function banner(label: string): HTMLElement {
  return within(screen.getByRole('region', { name: 'Room Timeline' })).getByLabelText(label);
}

function bannerIdentities(label: string): string[] {
  return within(screen.getByRole('region', { name: 'Room Timeline' }))
    .getAllByLabelText(label)
    .map((row) => row.querySelector('.timeline-banner-identity')?.textContent ?? '');
}

describe('Encounter Timeline banner', () => {
  it('names a single phase by its encounter and shows no event line without events', () => {
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    openRoomTab('Room Overview');
    const encounter = screen
      .getByRole('button', { name: 'Encounter' })
      .querySelector('span')!.textContent!;
    openRoomTab('Room Timeline');
    const start = banner('Encounter');
    expect(bannerIdentities('Encounter')).toEqual([encounter]);
    expect(start.querySelector('.encounter-event-controls')).toBeNull();
    expect(screen.queryByRole('group', { name: /events$/i })).toBeNull();

    // The banner navigates to the Overview owner; it is never a finding target itself.
    const identity = within(start).getByRole('button', { name: encounter });
    expect(identity.hasAttribute('data-semantic-owner')).toBe(false);
    fireEvent.click(identity);
    const focused = view.application.store.getState().editorSession.focusedSemanticOwner;
    expect(focused === null ? null : semanticAddressKey(focused)).toBe(
      semanticAddressKey(
        createEncounterPhaseAddress(
          goldenFBiome,
          { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
          'Encounter',
        ),
      ),
    );
  });

  it('names each Ship phase in its own Timeline tab', () => {
    renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    openRoomTab('Intro Timeline');
    expect(bannerIdentities('Encounter')).toEqual([expect.stringMatching(/^Intro · /)]);
    openRoomTab('Combat 1 Timeline');
    expect(bannerIdentities('Encounter')).toEqual([expect.stringMatching(/^Combat 1 · /)]);
  });

  it('names the P opening and follow-up phases on their start banners', () => {
    renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(pOccurrenceId('P_Combat12', 8, 1)),
    );
    openRoomTab('Room Timeline');
    expect(bannerIdentities('Encounter')).toEqual([
      expect.stringMatching(/^Pre-combat · /),
      expect.stringMatching(/^Follow-up · /),
    ]);
  });

  it('moves the Nemesis family from the banner to its interaction row', () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectNemesisRandomEventFamily',
      event: createNemesisRandomEventAddress(phase),
      family: 'goldTrade',
    });
    renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const timeline = screen.getByRole('region', { name: 'Room Timeline' });
    // The movable interaction encounter names nothing on its banner; its row carries the family.
    expect(timeline.querySelector('.timeline-banner-identity')).toBeNull();
    expect(banner('Room entered').textContent).toBe('Room entered');
    const row = [...timeline.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (candidate) =>
        candidate.dataset.roomActionKey ===
        roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
    );
    expect(row?.querySelector('.timeline-row-family')?.textContent).toBe('Gold trade');
  });

  it('hosts a phase event in its start banner row and routes its finding to that control', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceIds.preHub));
    openRoomTab('Room Timeline');
    const skip = screen.getByRole('checkbox', { name: 'Fig Leaf skip' });
    expect(skip.closest('li')).toBe(banner('Encounter'));
    // Banner controls take the banner's control line, after its title.
    expect(skip.closest('.timeline-banner-modifiers')).not.toBeNull();
    expect(skip.hasAttribute('data-semantic-owner')).toBe(true);
  });

  it('shows Fig Leaf only where the engine supports a skip or one is authored', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: nOccurrenceIds.preHub },
        'Encounter',
      ),
      value: true,
    });
    // The skip already spent in N leaves later N phases without Fig Leaf support.
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceId('combat05')));
    openRoomTab('Room Timeline');
    expect(screen.queryByRole('checkbox', { name: 'Fig Leaf skip' })).toBeNull();
    cleanup();
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceIds.preHub));
    openRoomTab('Room Timeline');
    expect(
      (screen.getByRole('checkbox', { name: 'Fig Leaf skip' }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('keeps the Fields Passive Nemesis family off the Room entered banner', () => {
    renderOccurrenceWorkbench(loadNemesisFieldsCheckpoint(), 'Underworld', 'H', (biome) =>
      biome.nodes.find(
        (node): node is WorkspaceOccurrenceWorkbenchNode =>
          node.kind === 'occurrenceWorkbench' &&
          node.room.encounterPhases.some(
            (phase) => phase.address.phaseKey === 'Passive' && phase.nemesisEvent !== undefined,
          ),
      ),
    );
    openRoomTab('Room Timeline');
    expect(banner('Room entered').textContent).toBe('Room entered');
    const family = screen
      .getByRole('region', { name: 'Room Timeline' })
      .querySelector<HTMLElement>('[data-room-action-key] .timeline-row-family');
    expect(family?.textContent).toBe('Free item');
    // Combat cage banners keep their identity.
    expect(bannerIdentities('Encounter 1')).toEqual(['Combat']);
  });

  it('splits encounter events between the start and end banners', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisCombatF',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    // What the game settles as the encounter starts sits on its start banner.
    const start = within(banner('Encounter')).getByRole('group', { name: / start$/ });
    expect(within(start).getByRole('checkbox', { name: 'No Death Defiance' })).toBeTruthy();
    expect(within(start).queryByRole('combobox', { name: 'Outcome' })).toBeNull();
    // The kill race is settled when the encounter ends.
    const end = within(banner('Encounter ended')).getByRole('group', { name: / end$/ });
    expect(within(end).getByRole('combobox', { name: 'Outcome' })).toBeTruthy();
    expect(within(end).queryByRole('checkbox')).toBeNull();
  });

  it('hosts the Anomaly capture outcome on its Encounter ended banner', () => {
    const { occurrenceId, project } = reachedAnomalyProject();
    renderOccurrenceWorkbench(project, 'Underworld', 'G', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const cleared = screen.getByRole('checkbox', { name: 'Cleared' });
    expect(cleared.closest('li')).toBe(banner('Encounter ended'));
    expect(within(banner('Encounter')).queryByRole('checkbox', { name: 'Cleared' })).toBeNull();
  });

  it('puts banner controls on their own line and adds none to a banner without events', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceIds.preHub));
    openRoomTab('Room Timeline');
    const label = banner('Encounter').querySelector<HTMLElement>('[data-timeline-cell="label"]')!;
    // The title and the controls are separate parts of the banner, in that order.
    const parts = [...label.children].map((part) => part.className);
    expect(parts).toEqual(['timeline-banner-title', 'timeline-banner-modifiers']);
    expect(
      within(label.querySelector<HTMLElement>('.timeline-banner-modifiers')!).getByRole(
        'checkbox',
        { name: 'Fig Leaf skip' },
      ),
    ).toBeTruthy();
    // A banner with nothing to decide carries no control part with content.
    const ended = banner('Encounter ended');
    expect(ended.querySelector('.timeline-banner-modifiers')?.childElementCount ?? 0).toBe(0);
  });

  it('names the phase role only beside another encounter start banner', () => {
    renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(pOccurrenceId('P_Combat12', 8, 1)),
    );
    openRoomTab('Room Timeline');
    // Two start banners: each names its role, then its encounter.
    const identities = bannerIdentities('Encounter');
    expect(identities).toHaveLength(2);
    expect(identities[0]).toMatch(/^Pre-combat · .+/);
    expect(identities[1]).toMatch(/^Follow-up · .+/);
    cleanup();
    // One start banner: the encounter alone, even an ordinary combat.
    renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    openRoomTab('Room Timeline');
    const [single] = bannerIdentities('Encounter');
    expect(single).not.toContain(' · ');
    expect(single).not.toBe('');
  });

  it('keeps a retained Death Defiance condition on a phase skipped with Fig Leaf', () => {
    const phase = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId: nOccurrenceIds.preHub },
      'Encounter',
    );
    let project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceIds.preHub));
    openRoomTab('Room Timeline');
    const condition = screen.getByRole('checkbox', {
      name: 'No Death Defiance',
    }) as HTMLInputElement;
    // The retained value never hides; it owns its finding, so it stays clearable.
    expect(condition.checked).toBe(true);
    expect(condition.disabled).toBe(false);
    expect(condition.dataset.hasFindings).toBe('true');
    // Its finding stops evaluation before the skip settles, so the engine publishes no
    // skipped phase and the control invents no reason of its own.
    expect(hintOf(condition)).toBeNull();
    expect(condition.closest('li')).toBe(banner('Encounter'));
  });
});
