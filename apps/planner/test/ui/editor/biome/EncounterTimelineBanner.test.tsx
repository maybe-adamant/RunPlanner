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
    const start = banner('Encounter started');

    // The banner navigates to the Overview owner; it is never a finding target itself.
    const identity = within(start).getByRole('button', { name: `Encounter started: ${encounter}` });
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
    expect(skip.closest('li')).toBe(banner('Encounter started'));
    expect(skip.hasAttribute('data-semantic-owner')).toBe(true);
  });

  it('hosts how the fight ended on its Encounter outcome, not on its start or end', async () => {
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
    // Only a Fig Leaf belongs to the start, so this start hosts no choice.
    const start = banner('Encounter started');
    expect(within(start).queryByRole('button', { name: 'No Death Defiance' })).toBeNull();
    expect(within(start).queryByRole('button', { name: /^Outcome/ })).toBeNull();
    // The Gorgon condition and the kill race are read as the fight ends, on its outcome.
    const outcome = within(banner('Encounter outcome')).getByRole('group', {
      name: / outcome choices$/,
    });
    expect(within(outcome).getByRole('button', { name: 'No Death Defiance' })).toBeTruthy();
    expect(within(outcome).getByRole('button', { name: /^Outcome/ })).toBeTruthy();
    // The end announces what spawns and hosts no choice.
    const ended = screen.queryByLabelText('Encounter ended');
    expect(ended === null || within(ended).queryByRole('group') === null).toBe(true);
  });
});
