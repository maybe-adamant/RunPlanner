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
            findings: [],
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

  it('blocks Save only on a finding the draft introduces, never an inherited one', async () => {
    const application = createApplication();
    const owner = createJudgmentArcanaAddress(
      createOccurrenceAddress(createBiomeAddress('Underworld', 'F'), createOccurrenceId('boss')),
      'Encounter',
    );
    const unavailable = new Set(['ArcanaX', 'ArcanaB']);
    const keys = ['ArcanaA', 'ArcanaB', 'ArcanaC', 'ArcanaX'];
    const control: WorkspaceJudgmentArcanaInteraction = {
      choices: keys.map((value) => ({ value, label: value.replace('Arcana', 'Arcana ') })),
      intentFor: () => ({ command: { kind: 'ReplaceJudgmentArcana' } }) as never,
      key: 'judgment',
      load: (draft: readonly string[] = ['ArcanaX', 'ArcanaA']) =>
        ({
          kind: 'judgmentArcana',
          result: {
            activeArcana: [],
            inactiveArcanaKeys: keys,
            rarity: 'Common',
            selectedPossible: true,
            findings: draft
              .filter((key) => unavailable.has(key))
              .map((key) => ({
                code: 'judgmentOutcomeTargetUnavailable',
                phase: 'rewardGeneration',
                origin: owner,
                evidence: { key, reason: 'unavailable' },
              })),
          },
        }) as unknown as CandidateProjectionEvaluation,
      owner,
      value: ['ArcanaX', 'ArcanaA'],
    };
    render(
      <Provider store={application.store}>
        <ArcanaActivationEditor
          control={control}
          onClose={() => undefined}
          requiredCount={2}
          title="Judgment editor"
        />
      </Provider>,
    );
    const user = userEvent.setup();
    const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    // Swapping the valid card keeps only the inherited finding.
    await user.click(await screen.findByRole('button', { name: /Arcana A/ }));
    await user.click(screen.getByRole('button', { name: /Arcana C/ }));
    await waitFor(() => expect(save().disabled).toBe(false));
    // Drawing another unavailable card introduces a finding.
    await user.click(screen.getByRole('button', { name: /Arcana C/ }));
    await user.click(screen.getByRole('button', { name: /Arcana B/ }));
    await waitFor(() => expect(save().disabled).toBe(true));
    application.dispose();
  });

  function twoCardControl(
    loadDraft: (draft: readonly string[]) => unknown,
  ): WorkspaceJudgmentArcanaInteraction {
    const owner = createJudgmentArcanaAddress(
      createOccurrenceAddress(createBiomeAddress('Underworld', 'F'), createOccurrenceId('boss')),
      'Encounter',
    );
    const evaluation = {
      kind: 'judgmentArcana',
      result: {
        activeArcana: [],
        inactiveArcanaKeys: ['ArcanaA', 'ArcanaB'],
        rarity: 'Common',
        selectedPossible: true,
        findings: [],
      },
    } as unknown as CandidateProjectionEvaluation;
    return {
      choices: [
        { value: 'ArcanaA', label: 'Arcana A' },
        { value: 'ArcanaB', label: 'Arcana B' },
      ],
      intentFor: () => ({ command: { kind: 'ReplaceJudgmentArcana' } }) as never,
      key: 'judgment',
      // The saved draw loads without an argument; an edited draw passes itself.
      load: ((draft?: readonly string[]) =>
        draft === undefined ? evaluation : loadDraft(draft)) as never,
      owner,
      value: ['ArcanaA'],
    };
  }

  function renderEditor(control: WorkspaceJudgmentArcanaInteraction) {
    const application = createApplication();
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
    return application;
  }

  it('saves only a draw that differs from the saved one', async () => {
    const application = renderEditor(
      twoCardControl(() => ({
        kind: 'judgmentArcana',
        result: {
          activeArcana: [],
          inactiveArcanaKeys: ['ArcanaA', 'ArcanaB'],
          rarity: 'Common',
          selectedPossible: true,
          findings: [],
        },
      })),
    );
    const user = userEvent.setup();
    const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    await user.click(await screen.findByRole('button', { name: /Arcana A/ }));
    await user.click(screen.getByRole('button', { name: /Arcana B/ }));
    await waitFor(() => expect(save().disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: /Arcana B/ }));
    await user.click(screen.getByRole('button', { name: /Arcana A/ }));
    await waitFor(() => expect(save().disabled).toBe(true));
    application.dispose();
  });

  it('keeps Save disabled while the edited draw is still being assessed', async () => {
    const application = renderEditor(twoCardControl(() => new Promise(() => undefined)));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Arcana A/ }));
    await user.click(screen.getByRole('button', { name: /Arcana B/ }));
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    application.dispose();
  });
});
