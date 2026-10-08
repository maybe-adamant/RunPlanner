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

it('shows an empty surface as a settled No reward and preserves its focus destination', () => {
  const application = createApplication();
  const owner = createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
  render(
    <Provider store={application.store}>
      <RewardSurfaceEditor
        ariaLabel="Door rewards"
        focusOwner={owner}
        idPrefix="test-door"
        interactions={{} as WorkspaceInteractionCatalog}
        rewards={[]}
        visibility="visible"
      />
    </Provider>,
  );
  const row = screen.getByText('No reward').closest<HTMLElement>('.door-fixed-reward');
  expect(row).not.toBeNull();
  expect(row?.classList.contains('control-placeholder')).toBe(false);
  act(() => application.store.dispatch(semanticOwnerFocused(owner)));
  expect(document.activeElement).toBe(row);
  application.dispose();
});
