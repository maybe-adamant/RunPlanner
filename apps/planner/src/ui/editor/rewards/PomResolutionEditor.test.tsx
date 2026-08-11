// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  semanticAddressKey,
  type AuthoredLevelResolution,
} from '@run-planner/engine/authored-project';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type {
  LevelResolutionCandidateGroup,
  LevelResolutionCandidateProjection,
} from '@planner/projections/candidateProjection';
import type { WorkspaceLevelResolutionInteraction } from '@planner/projections/structured-workspace';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures';

import {
  PomResolutionDialog,
  PomResolutionEditor,
  PomResolutionLauncher,
} from './PomResolutionEditor';

afterEach(cleanup);

describe('Pom resolution editor', () => {
  it('publishes an incomplete declaration-owned Pom control and opens its exact session target', async () => {
    const application = createApplication();
    const project = createGoldenFGHIProject();
    application.store.dispatch(authoredProjectReplaced(project));
    const initialWorkspace = application.selectStructuredWorkspace(application.store.getState());
    let authoredProject = project;
    let workspace = initialWorkspace;
    let control = [...workspace.interactions.levelResolutions.values()][0];
    for (const reward of initialWorkspace.interactions.rewards.values()) {
      if (control !== undefined) break;
      const withPom = applyProjectCommand(
        project,
        application.catalog,
        reward.intentFor({ rewardType: 'StackUpgrade' }).command,
      );
      authoredProject = withPom;
      application.store.dispatch(authoredProjectReplaced(withPom));
      workspace = application.selectStructuredWorkspace(application.store.getState());
      control = [...workspace.interactions.levelResolutions.values()][0];
    }
    if (control === undefined) throw new Error('Pom control is not projected');
    const incompleteProject = applyProjectCommand(
      authoredProject,
      application.catalog,
      control.intentFor({
        kind: 'choice',
        offeredTraitKeys: [],
        selectedTraitKey: null,
      }).command,
    );
    application.store.dispatch(authoredProjectReplaced(incompleteProject));
    workspace = application.selectStructuredWorkspace(application.store.getState());
    control = workspace.interactions.levelResolutions.get(control.key);
    if (control === undefined) throw new Error('incomplete Pom control is not projected');

    expect(control.value).toEqual({
      kind: 'choice',
      offeredTraitKeys: [],
      selectedTraitKey: null,
    });
    expect(workspace.focusByOwner.get(control.key)?.ownerAddress).toEqual(control.owner);

    const projectedControl = (() => {
      for (const route of workspace.routes)
        for (const biome of route.biomes)
          for (const node of biome.nodes) {
            const rooms =
              node.kind === 'occurrenceWorkbench'
                ? [node.room]
                : node.kind === 'ordinaryBatch' ||
                    node.kind === 'mixedBatch' ||
                    node.kind === 'takeoverBatch'
                  ? node.targets.map((target) => target.room)
                  : [];
            for (const room of rooms)
              for (const rewardControl of room.rewardControls)
                for (const resolution of rewardControl.levelResolutions ?? [])
                  if (resolution.address === control.owner) return resolution;
          }
      throw new Error('Pom control has no containing reward surface');
    })();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <PomResolutionLauncher control={projectedControl} interactions={workspace.interactions} />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: /Edit Pom: Choose target \+1/i }));
    expect(application.store.getState().editorSession.levelResolutionDialogTarget).toEqual(
      control.owner,
    );
    render(
      <Provider store={application.store}>
        <PomResolutionDialog interactions={workspace.interactions} target={control.owner} />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Close Pom' }));
    expect(application.store.getState().editorSession.levelResolutionDialogTarget).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Edit Pom: Choose target \+1/i }),
    );
    application.dispose();
  });

  it('saves and restores a reached room Pom through the application history', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = [...workspace.interactions.levelResolutions.values()].find(
      (candidate) => candidate.value.kind === 'choice',
    );
    if (interaction?.value.kind !== 'choice') throw new Error('reached room Pom is missing');
    const before = interaction.value;
    const replacementIndex = before.selectedTraitKey === before.offeredTraitKeys[0] ? 1 : 0;
    render(
      <Provider store={application.store}>
        <PomResolutionDialog interactions={workspace.interactions} target={interaction.owner} />
      </Provider>,
    );
    const user = userEvent.setup();
    const radios = await screen.findAllByLabelText('Selected');
    const replacement = radios[replacementIndex];
    if (replacement === undefined) throw new Error('alternate room Pom target is missing');
    await user.click(replacement);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    const changed = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.levelResolutions.get(interaction.key)?.value;
    expect(changed).not.toEqual(before);
    application.store.dispatch(authoredProjectUndoRequested());
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
        .interactions.levelResolutions.get(interaction.key)?.value,
    ).toEqual(before);
    application.store.dispatch(authoredProjectRedoRequested());
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
        .interactions.levelResolutions.get(interaction.key)?.value,
    ).toEqual(changed);
    application.dispose();
  });

  const address = createLevelResolutionAddress(
    createIncomingRewardAddress(goldenFBiome, createOccurrenceId('pom-editor-test')),
    'selected',
  );
  const group = (
    key: string,
    effectKind: 'choice' | 'random',
    targets: readonly string[],
    supported: boolean,
    findings: readonly string[] = [],
    requiredOfferCount?: number,
  ): LevelResolutionCandidateGroup =>
    Object.freeze({
      branchIndices: Object.freeze([Number(key.replace(/\D/g, '')) || 0]),
      evaluations: Object.freeze([
        Object.freeze({ branchIndex: 0, findings: Object.freeze(findings), supported }),
      ]),
      key,
      surface: Object.freeze({
        effectKind,
        eligibleTargetTraitKeys: Object.freeze([...targets]),
        levelCount: 1,
        ...(requiredOfferCount === undefined ? {} : { requiredOfferCount }),
      }),
    });

  function interaction(input: {
    readonly value: AuthoredLevelResolution;
    readonly load: (
      value: AuthoredLevelResolution,
    ) => LevelResolutionCandidateProjection | undefined;
  }): WorkspaceLevelResolutionInteraction {
    return Object.freeze({
      acquisitionRoleLabel: 'Selected',
      intentFor: () => {
        throw new Error('editor boundary test does not dispatch intents');
      },
      key: semanticAddressKey(address),
      levelCount: 1,
      load: (value = input.value) => input.load(value),
      owner: address,
      traitLabel: (traitKey: string) => `Trait ${traitKey}`,
      value: input.value,
    });
  }

  it('authors a complete visible Pom offer while preventing duplicate targets', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction = interaction({
      value: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      load: (value) => {
        const valid =
          value.kind === 'choice' &&
          value.offeredTraitKeys.length === 2 &&
          new Set(value.offeredTraitKeys).size === 2 &&
          value.selectedTraitKey !== null &&
          value.offeredTraitKeys.includes(value.selectedTraitKey);
        return Object.freeze({
          groups: Object.freeze([
            group('branch-0', 'choice', ['A', 'B', 'C'], valid, valid ? [] : ['missingTarget'], 2),
          ]),
        });
      },
    });

    render(<PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />);
    await user.click(screen.getByRole('button', { name: 'Pom target 1' }));
    await user.click(screen.getByText('Trait A'));
    await user.click(screen.getByRole('button', { name: 'Pom target 2' }));
    expect(screen.getByRole('option', { name: 'Trait A' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    await user.click(screen.getByRole('option', { name: 'Trait B' }));
    await user.click(screen.getAllByLabelText('Selected')[0]!);

    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    expect(onCommit).toHaveBeenCalledWith({
      kind: 'choice',
      offeredTraitKeys: ['A', 'B'],
      selectedTraitKey: 'A',
    });
  });

  it('switches correlated route-state surfaces without unioning their target domains', async () => {
    const user = userEvent.setup();
    const editorInteraction = interaction({
      value: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      load: () =>
        Object.freeze({
          groups: Object.freeze([
            group('branch-1', 'choice', ['A'], false, ['missingTarget'], 1),
            group('branch-2', 'choice', ['B'], false, ['missingTarget'], 1),
          ]),
        }),
    });

    render(<PomResolutionEditor interaction={editorInteraction} onCommit={vi.fn()} />);
    await screen.findByLabelText('Route state');
    await user.selectOptions(screen.getByLabelText('Route state'), 'branch-2');
    await user.click(screen.getByRole('button', { name: 'Pom target 1' }));
    expect(screen.getByText('Trait B')).not.toBeNull();
    expect(screen.queryByText('Trait A')).toBeNull();
  });

  it('pins a stale random target until the author selects an eligible replacement', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction = interaction({
      value: { kind: 'random', targetTraitKey: 'Stale' },
      load: (value) => {
        const supported = value.kind === 'random' && value.targetTraitKey === 'A';
        return Object.freeze({
          groups: Object.freeze([
            group('branch-0', 'random', ['A'], supported, supported ? [] : ['targetUnavailable']),
          ]),
        });
      },
    });

    render(<PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />);
    expect(
      await screen.findAllByText('This trait cannot receive the Pom at this point in the route.'),
    ).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Recorded random Pom target' }));
    expect(screen.getByRole('option', { name: /Trait Stale/ })).not.toBeNull();
    await user.click(screen.getByRole('option', { name: 'Trait A' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    expect(onCommit).toHaveBeenCalledWith({ kind: 'random', targetTraitKey: 'A' });
  });
});
