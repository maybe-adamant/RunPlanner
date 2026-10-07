// @vitest-environment jsdom

import {
  createBiomeAddress,
  createJudgmentArcanaAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { CandidateProjectionEvaluation } from '@planner/projections/candidates/candidateProjection';
import type { WorkspaceJudgmentArcanaInteraction } from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { ArcanaActivationEditor } from '@planner/ui/editor/biome/ArcanaActivationEditor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Arcana activation editor', () => {
  it('saves its complete draw through the bound intent, including its declared focus', async () => {
    const application = createApplication();
    const dispatch = vi
      .spyOn(application.store, 'dispatch')
      .mockImplementation((action) => action as never);
    const owner = createJudgmentArcanaAddress(
      createOccurrenceAddress(createBiomeAddress('Underworld', 'F'), createOccurrenceId('boss')),
      'Encounter',
    );
    const command = {
      kind: 'ReplaceJudgmentArcana' as const,
      owner,
      arcanaKeys: ['ArcanaA'],
    };
    const control: WorkspaceJudgmentArcanaInteraction = {
      choices: [{ value: 'ArcanaA', label: 'Arcana A' }],
      intentFor: () => ({ command, focus: { owner, timing: 'after' } }) as never,
      key: 'judgment',
      load: () =>
        ({
          kind: 'judgmentArcana',
          result: {
            activeArcana: [],
            inactiveArcanaKeys: ['ArcanaA'],
            rarity: 'Common',
            selectedPossible: true,
          },
        }) as unknown as CandidateProjectionEvaluation,
      owner,
      value: [],
    };
    render(
      <Provider store={application.store}>
        <ArcanaActivationEditor
          control={control}
          onClose={() => undefined}
          requiredCount={1}
          title="Judgment editor"
        />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Arcana A/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false),
    );
    dispatch.mockClear();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const actions = dispatch.mock.calls.map(([action]) => action);
    expect(actions).toContainEqual(authoredProjectCommandDispatched(command as never));
    expect(actions).toContainEqual(semanticOwnerFocused(owner));
    expect(actions.findIndex((action) => semanticOwnerFocused.match(action))).toBeGreaterThan(
      actions.findIndex((action) => authoredProjectCommandDispatched.match(action)),
    );
    application.dispose();
  });
});
