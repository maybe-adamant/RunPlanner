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
import { useAppSelector } from '@planner/state/store';
import {
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type {
  LevelResolutionCandidateGroup,
  LevelResolutionCandidateProjection,
} from '@planner/projections/candidates/candidateProjection';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceLevelResolutionInteraction,
} from '@planner/projections/structured-workspace';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';

import {
  PomResolutionDialog,
  PomResolutionEditor,
  PomResolutionLauncher,
} from '@planner/ui/editor/rewards/PomResolutionEditor';

afterEach(cleanup);

describe('Pom resolution editor', () => {
  it('publishes an incomplete declaration-owned Pom control and opens its exact session target', async () => {
    const application = createApplication();
    const project = createGoldenFGHIProject();
    application.store.dispatch(authoredProjectReplaced(project));
    const initialWorkspace = application.selectStructuredWorkspace(application.store.getState())!;
    let authoredProject = project;
    let workspace = initialWorkspace;
    let control: WorkspaceLevelResolutionInteraction | undefined;
    const openingReward = createIncomingRewardAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-start'),
    );
    for (const reward of initialWorkspace.interactions.rewards.values()) {
      if (control !== undefined) break;
      if (reward.owner.kind === 'startingReward') continue;
      if (semanticAddressKey(reward.owner) === semanticAddressKey(openingReward)) continue;
      const withPom = applyProjectCommand(
        project,
        application.catalog,
        reward.intentFor({ rewardType: 'StackUpgrade' }).command,
      );
      authoredProject = withPom;
      application.store.dispatch(authoredProjectReplaced(withPom));
      workspace = application.selectStructuredWorkspace(application.store.getState())!;
      control = [...workspace.interactions.levelResolutions.values()].find(
        (candidate) => candidate.value.kind === 'choice',
      );
    }
    if (control === undefined) throw new Error('Pom control is not projected');
    const incompleteValue: AuthoredLevelResolution = {
      kind: 'choice',
      offeredTraitKeys: [],
      selectedTraitKey: null,
    };
    const incompleteProject = applyProjectCommand(
      authoredProject,
      application.catalog,
      control.intentFor(incompleteValue).command,
    );
    application.store.dispatch(authoredProjectReplaced(incompleteProject));
    workspace = application.selectStructuredWorkspace(application.store.getState())!;
    control = workspace.interactions.levelResolutions.get(control.key);
    if (control === undefined) throw new Error('incomplete Pom control is not projected');

    expect(control.value).toEqual(incompleteValue);
    expect(workspace.focusByOwner.get(control.key)?.ownerAddress).toEqual(control.owner);

    const projectedControl = (() => {
      for (const biome of workspace.route.biomes)
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
    const launcher = screen.getByRole('button', { name: /Edit Pom: Choose target \+1/i });
    expect(launcher.getAttribute('data-trait-status')).toBe('unspecified');
    await user.click(launcher);
    expect(application.store.getState().editorSession.levelResolutionDialogTarget).toEqual(
      control.owner,
    );
    // Mounted while its session target is set, as the application shell does.
    function PomDialogHost() {
      const target = useAppSelector(
        (state) => state.editorSession.levelResolutionDialogTarget ?? null,
      );
      return target === null ? null : (
        <PomResolutionDialog interactions={workspace.interactions} target={target} />
      );
    }
    render(
      <Provider store={application.store}>
        <PomDialogHost />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(application.store.getState().editorSession.levelResolutionDialogTarget).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Edit Pom: Choose target \+1/i }),
    );
    application.dispose();
  });

  it('saves and restores a reached room Pom through the application history', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
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
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.levelResolutions.get(interaction.key)?.value;
    expect(changed).not.toEqual(before);
    application.store.dispatch(authoredProjectUndoRequested());
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
        .interactions.levelResolutions.get(interaction.key)?.value,
    ).toEqual(before);
    application.store.dispatch(authoredProjectRedoRequested());
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
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
    emptyTargetAllowed = false,
    engine: {
      readonly available?: readonly string[];
      readonly start?: AuthoredLevelResolution;
    } = {},
  ): LevelResolutionCandidateGroup =>
    Object.freeze({
      branchIndices: Object.freeze([Number(key.replace(/\D/g, '')) || 0]),
      evaluations: Object.freeze([
        Object.freeze({
          availableTargetTraitKeys: Object.freeze([...(engine.available ?? targets)]),
          branchIndex: 0,
          findings: Object.freeze(findings),
          supported,
        }),
      ]),
      key,
      surface: Object.freeze({
        effectKind,
        eligibleTargetTraitKeys: Object.freeze([...targets]),
        levelCount: 1,
        ...(emptyTargetAllowed ? { emptyTargetAllowed: true } : {}),
        ...(requiredOfferCount === undefined ? {} : { requiredOfferCount }),
        ...(engine.start === undefined ? {} : { startingResolution: engine.start }),
      }),
    });
  const choice = (offeredTraitKeys: readonly string[]): AuthoredLevelResolution =>
    Object.freeze({
      kind: 'choice',
      offeredTraitKeys,
      selectedTraitKey: offeredTraitKeys[0] ?? null,
    });

  function interaction(input: {
    readonly value: AuthoredLevelResolution;
    readonly load: (
      value: AuthoredLevelResolution,
    ) => LevelResolutionCandidateProjection | undefined;
    readonly contextReached?: boolean;
  }): WorkspaceLevelResolutionInteraction {
    return Object.freeze({
      acquisitionRoleLabel: 'Selected',
      contextReached: input.contextReached ?? true,
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

  it('disables an unreached Pom launcher and opens no editor for it or a stale target', () => {
    const application = createApplication();
    const value: AuthoredLevelResolution = {
      kind: 'choice',
      offeredTraitKeys: [],
      selectedTraitKey: null,
    };
    const unreached = interaction({ value, load: () => undefined, contextReached: false });
    const interactions = {
      levelResolutions: new Map([[unreached.key, unreached]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <PomResolutionLauncher
          control={{
            acquisitionRoleLabel: 'Selected',
            address,
            levelCount: 1,
            settledEmptyNoOp: false,
            marker: undefined as never,
            rewardOwner: address.owner,
            status: 'unspecified',
            value,
          }}
          interactions={interactions}
        />
        <PomResolutionDialog interactions={interactions} target={address} />
        <PomResolutionDialog
          interactions={interactions}
          target={createLevelResolutionAddress(
            createIncomingRewardAddress(goldenFBiome, createOccurrenceId('pom-stale')),
            'selected',
          )}
        />
      </Provider>,
    );
    const launcher = screen.getByRole('button', { name: /Edit Pom/ }) as HTMLButtonElement;
    expect(launcher.disabled).toBe(true);
    expect(launcher.title).toBe('Waits on an earlier choice');
    expect(screen.queryByRole('dialog')).toBeNull();
    application.dispose();
  });

  it('seeds the engine starting draft and disables targets another slot holds', async () => {
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
            group(
              'branch-0',
              'choice',
              ['A', 'B', 'C'],
              valid,
              valid ? [] : ['missingTarget'],
              2,
              false,
              { available: valid ? ['C'] : ['A', 'B', 'C'], start: choice(['A', 'B']) },
            ),
          ]),
        });
      },
    });

    render(<PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pom target 1' }).textContent).toContain('Trait A');
    expect(screen.getByRole('button', { name: 'Pom target 2' }).textContent).toContain('Trait B');
    await user.click(screen.getByRole('button', { name: 'Pom target 2' }));
    expect(screen.getByRole('option', { name: 'Trait A' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByRole('option', { name: 'Trait C' }).getAttribute('aria-disabled')).not.toBe(
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Pom target 2' }));
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    expect(onCommit).toHaveBeenCalledWith({
      kind: 'choice',
      offeredTraitKeys: ['A', 'B'],
      selectedTraitKey: 'A',
    });
  });

  it('preserves a retained partial visible Pom instead of replacing it with defaults', async () => {
    const editorInteraction = interaction({
      value: { kind: 'choice', offeredTraitKeys: ['C'], selectedTraitKey: null },
      load: () =>
        Object.freeze({
          groups: Object.freeze([
            group('branch-0', 'choice', ['A', 'B', 'C'], false, ['missingTarget'], 2),
          ]),
        }),
    });

    render(<PomResolutionEditor interaction={editorInteraction} onCommit={vi.fn()} />);
    expect((await screen.findByRole('button', { name: 'Pom target 1' })).textContent).toContain(
      'Trait C',
    );
    expect(screen.getByRole('button', { name: 'Pom target 2' }).textContent).toContain(
      'Choose a trait',
    );
    const routeState = screen.getByRole('button', { name: 'Route state' });
    expect(routeState).toHaveProperty('disabled', true);
    expect(routeState.getAttribute('title')).toBe('One route state applies to this Pom.');
    expect(routeState.textContent).toContain('Route state 1');
  });

  it('switches correlated route-state surfaces without unioning their target domains', async () => {
    const user = userEvent.setup();
    const editorInteraction = interaction({
      value: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      load: () =>
        Object.freeze({
          groups: Object.freeze([
            group('branch-1', 'choice', ['A'], false, ['missingTarget'], 1, false, {
              start: choice(['A']),
            }),
            group('branch-2', 'choice', ['B'], false, ['missingTarget'], 1, false, {
              start: choice(['B']),
            }),
          ]),
        }),
    });

    render(<PomResolutionEditor interaction={editorInteraction} onCommit={vi.fn()} />);
    await screen.findByLabelText('Route state');
    await user.click(screen.getByRole('button', { name: 'Route state' }));
    await user.click(screen.getByRole('option', { name: 'Route state 2' }));
    expect(screen.getByRole('button', { name: 'Pom target 1' }).textContent).toContain('Trait B');
    await user.click(screen.getByRole('button', { name: 'Pom target 1' }));
    expect(screen.getByRole('option', { name: 'Trait B' })).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'Trait A' })).toBeNull();
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
    ).toHaveLength(1);
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

  it('keeps its draft and rebinds evaluation when only the context changes', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const loads = vi.fn();
    // A new interaction object with the same authored value is a changed context.
    const contextInteraction = (context: string) =>
      interaction({
        value: { kind: 'random', targetTraitKey: 'A' },
        load: (value) => {
          loads(context, value);
          return Object.freeze({
            groups: Object.freeze([group('branch-0', 'random', ['A', 'B'], true)]),
          });
        },
      });
    const view = render(
      <PomResolutionEditor interaction={contextInteraction('first')} onCommit={onCommit} />,
    );
    await user.click(screen.getByRole('button', { name: 'Recorded random Pom target' }));
    await user.click(await screen.findByRole('option', { name: 'Trait B' }));
    view.rerender(
      <PomResolutionEditor interaction={contextInteraction('second')} onCommit={onCommit} />,
    );
    await waitFor(() =>
      expect(loads).toHaveBeenLastCalledWith('second', { kind: 'random', targetTraitKey: 'B' }),
    );
    expect(
      screen.getByRole('button', { name: 'Recorded random Pom target' }).textContent,
    ).toContain('Trait B');
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'random', targetTraitKey: 'B' });
  });

  it('presents a supported empty random domain as a no-op without a picker', () => {
    const editorInteraction = interaction({
      value: { kind: 'random', targetTraitKey: null },
      load: () =>
        Object.freeze({
          groups: Object.freeze([group('empty', 'random', [], true, [], undefined, true)]),
        }),
    });
    render(<PomResolutionEditor interaction={editorInteraction} onCommit={vi.fn()} />);
    // The message occupies the picker's control slot rather than collapsing the dialog body.
    const placeholder = screen
      .getByText('No eligible traits; no level is gained.')
      .closest('.control-placeholder');
    expect(placeholder?.classList.contains('field-control-inline')).toBe(true);
    expect(placeholder?.textContent).toContain('Recorded target');
    expect(screen.queryByRole('button', { name: 'Recorded random Pom target' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('lets an unavailable random target be cleared for a supported empty domain', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction = interaction({
      value: { kind: 'random', targetTraitKey: 'Stale' },
      load: (value) =>
        Object.freeze({
          groups: Object.freeze([
            group(
              'empty',
              'random',
              [],
              value.kind === 'random' && value.targetTraitKey === null,
              ['targetUnavailable'],
              undefined,
              true,
            ),
          ]),
        }),
    });
    render(<PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />);
    const placeholder = screen
      .getByText(/No eligible traits; clear the recorded target\./)
      .closest('.control-placeholder');
    expect(placeholder).not.toBeNull();
    const clear = screen.getByRole('button', { name: 'Clear recorded target' });
    expect(placeholder?.contains(clear)).toBe(true);
    await user.click(clear);
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    expect(onCommit).toHaveBeenCalledWith({ kind: 'random', targetTraitKey: null });
  });
});
