// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNProject, nOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

function banner(label: string): HTMLElement {
  return within(screen.getByRole('region', { name: 'Room Timeline' })).getByLabelText(label);
}

describe('Encounter Timeline banner', () => {
  it('navigates from its encounter name to the phase owner', () => {
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

  it('hosts a phase event in its start banner row and routes its finding to that control', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    renderOccurrenceWorkbench(project, 'Surface', 'N', occurrenceById(nOccurrenceIds.preHub));
    openRoomTab('Room Timeline');
    const skip = screen.getByRole('button', { name: 'Fig Leaf skip' });
    expect(skip.closest('li')).toBe(banner('Encounter'));
    expect(skip.hasAttribute('data-semantic-owner')).toBe(true);
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
    expect(within(start).getByRole('button', { name: 'No Death Defiance' })).toBeTruthy();
    expect(within(start).queryByRole('combobox', { name: 'Outcome' })).toBeNull();
    // The kill race is settled when the encounter ends.
    const end = within(banner('Encounter ended')).getByRole('group', { name: / end$/ });
    // Its one outcome control is the end banner's only control.
    expect(within(end).getByRole('combobox', { name: 'Outcome' })).toBeTruthy();
    expect(end.querySelectorAll('button, input, select')).toHaveLength(1);
  });
});
