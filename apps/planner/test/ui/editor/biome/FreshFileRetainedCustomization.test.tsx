// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import {
  createEncounterPhaseAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createFreshFileFirstSequence,
  freshFileFBiome,
  freshFileIntroId,
  withRetainedFreshFileIntroCustomization,
} from '@run-planner/test-fixtures/fresh-file';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

describe('Fresh File retained encounter customization', () => {
  it('offers only removal of a GeneratedF customization FIntroFight replaced', async () => {
    const project = withRetainedFreshFileIntroCustomization(
      authorLegalTraitOffers(createFreshFileFirstSequence()),
    );
    const phase = createEncounterPhaseAddress(
      freshFileFBiome,
      { kind: 'occurrence', occurrenceId: freshFileIntroId },
      'Encounter',
    );
    const view = renderOccurrenceWorkbench(
      project,
      'FreshFile',
      'F',
      occurrenceById(freshFileIntroId),
    );
    openRoomTab('Room Overview');
    const trigger = screen
      .getAllByRole('button', { name: 'Customize encounter' })
      .find((button) => button.dataset.semanticOwner === semanticAddressKey(phase))!;
    await view.user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Intro combat (FIntroFight)' });
    // The replacing identity's fixed waves stay visible with their controls disabled.
    expect(within(dialog).getByText('This encounter is fixed')).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole('button')
        .filter((button) => !(button as HTMLButtonElement).disabled)
        .map((button) => button.textContent),
    ).toEqual(['Close', 'Help', 'Reset']);
    // Removal-only: the fixed wave count and no budget controls are offered.
    expect((within(dialog).getByRole('radio', { name: '4' }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(within(dialog).queryByText('Budget')).toBeNull();
    expect(
      within(dialog).queryByText('Complete earlier choices to evaluate this encounter.'),
    ).toBeNull();
    const before = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(within(dialog).getByRole('button', { name: 'Reset' }));
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      before + 1,
    );
    const intro = view.application.store
      .getState()
      .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === freshFileIntroId,
      )!;
    expect(intro.encounters.customizationByPhase).toBeUndefined();
  });
});
