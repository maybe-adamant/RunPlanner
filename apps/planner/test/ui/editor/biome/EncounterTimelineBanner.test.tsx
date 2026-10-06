// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
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
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

function banner(label: string): HTMLElement {
  return within(screen.getByRole('region', { name: 'Room Timeline' })).getByLabelText(label);
}

function bannerIdentities(label: string): string[] {
  return within(screen.getByRole('region', { name: 'Room Timeline' }))
    .getAllByLabelText(label)
    .map((row) => row.querySelector('.timeline-banner-identity')?.textContent ?? '');
}

function editorsOf(row: HTMLElement): HTMLElement {
  return row.querySelector<HTMLElement>(':scope > [data-timeline-cell="editors"]')!;
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
    const start = banner('Start encounter');
    expect(bannerIdentities('Start encounter')).toEqual([encounter]);
    expect(editorsOf(start).childElementCount).toBe(0);
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
    expect(bannerIdentities('Start encounter')).toEqual([expect.stringMatching(/^Intro · /)]);
    openRoomTab('Combat 1 Timeline');
    expect(bannerIdentities('Start encounter')).toEqual([expect.stringMatching(/^Combat 1 · /)]);
  });

  it('names the P opening and follow-up phases on their start banners', () => {
    renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(pOccurrenceId('P_Combat12', 8, 1)),
    );
    openRoomTab('Room Timeline');
    expect(bannerIdentities('Start encounter')).toEqual([
      expect.stringMatching(/^Opening encounter · /),
      expect.stringMatching(/^Follow-up encounter · /),
    ]);
  });

  it('folds the selected Nemesis family into the banner', () => {
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
    const identities = [...timeline.querySelectorAll('.timeline-banner-identity')].map(
      (identity) => identity.textContent,
    );
    expect(identities).toEqual(['Nemesis event · Gold trade']);
  });

  it('hosts a phase event in its start banner row and routes its finding to that control', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceIds.preHub));
    openRoomTab('Room Timeline');
    const skip = screen.getByRole('checkbox', { name: 'Skip with Fig Leaf' });
    expect(skip.closest('li')).toBe(banner('Start encounter'));
    expect(editorsOf(banner('Start encounter')).contains(skip)).toBe(true);
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
    expect(screen.queryByRole('checkbox', { name: 'Skip with Fig Leaf' })).toBeNull();
    cleanup();
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceIds.preHub));
    openRoomTab('Room Timeline');
    expect(
      (screen.getByRole('checkbox', { name: 'Skip with Fig Leaf' }) as HTMLInputElement).checked,
    ).toBe(true);
  });
});
