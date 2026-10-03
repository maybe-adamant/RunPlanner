// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, expect, it } from 'vitest';
import { createOccurrenceAddress } from '@run-planner/engine/authored-project';
import { goldenFBiome, goldenFOccurrenceId } from '@run-planner/test-fixtures/underworld';
import { createApplication } from '@planner/composition/createApplication';
import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { RewardSurfaceEditor } from '@planner/ui/editor/biome/DoorRewardEditor';

afterEach(cleanup);

it('keeps a hidden reward distinct from no reward and preserves its focus destination', () => {
  const application = createApplication();
  const owner = createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
  const surface = (visibility: 'hidden' | 'visible') => (
    <Provider store={application.store}>
      <RewardSurfaceEditor
        ariaLabel="Door rewards"
        focusOwner={owner}
        idPrefix="test-door"
        interactions={{} as WorkspaceInteractionCatalog}
        rewards={[]}
        visibility={visibility}
      />
    </Provider>
  );
  const view = render(surface('visible'));
  expect(screen.getByText('No reward')).toBeTruthy();
  view.rerender(surface('hidden'));
  const note = screen.getByText('Reward hidden on this door.');
  expect(note.classList.contains('door-information-note')).toBe(true);
  expect(screen.queryByText('No reward')).toBeNull();
  act(() => application.store.dispatch(semanticOwnerFocused(owner)));
  expect(document.activeElement).toBe(note);
  application.dispose();
});
