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
import type { LevelResolutionCandidateProjection } from '@planner/projections/candidates/candidateProjection';
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
import { hintOf } from '@planner-test/support/hints';
import { dialogFinding, renderInHeaderDialog } from '@planner-test/support/editor-dialog';

/** The published cost schedule a fixture screen hands the tabs. */
const nextCost = (fromCount: number): number => fromCount + 1;

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
    const launcher = screen.getByRole('button', { name: 'Edit Pom · Pick target +1' });
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
      screen.getByRole('button', { name: 'Edit Pom · Pick target +1' }),
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
  const candidate = (
    effectKind: 'choice' | 'random',
    targets: readonly string[],
    supported: boolean,
    findings: readonly string[] = [],
    requiredOfferCount?: number,
    emptyTargetAllowed = false,
    engine: {
      readonly available?: readonly string[];
      readonly start?: AuthoredLevelResolution;
      readonly rerolledScreenFindings?: LevelResolutionCandidateProjection['evaluation']['rerolledScreenFindings'];
    } = {},
  ): LevelResolutionCandidateProjection =>
    Object.freeze({
      evaluation: Object.freeze({
        availableTargetTraitKeys: Object.freeze([...(engine.available ?? targets)]),
        findings: Object.freeze(findings),
        rerolledScreenFindings: Object.freeze([...(engine.rerolledScreenFindings ?? [])]),
        supported,
      }),
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
      launcher: { label: 'Edit Pom · Pick target +1', detail: 'Pom: no target chosen' },
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
    expect(hintOf(launcher)).toBe('Waits on an earlier choice.');
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
        return candidate(
          'choice',
          ['A', 'B', 'C'],
          valid,
          valid ? [] : ['missingTarget'],
          2,
          false,
          { available: valid ? ['C'] : ['A', 'B', 'C'], start: choice(['A', 'B']) },
        );
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

  it('keeps each rerolled screen on its own tab and saves the screens with the Pom', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction: WorkspaceLevelResolutionInteraction = {
      ...interaction({
        value: choice(['A', 'B']),
        load: () => candidate('choice', ['A', 'B', 'C'], true, [], 2),
      }),
      screenRerolls: {
        count: 0,
        maxCount: 1,
        lockAtMax: 'poolEmpty',
        nextCost: (from: number) => (from + 1) * 10,
      },
    };
    render(<PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />);
    await user.click(screen.getByRole('button', { name: 'Reroll, costs 10' }));
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Offer', 'Reroll 1']);
    const atMax = screen.getByRole('button', { name: 'Reroll, costs 20' });
    expect((atMax as HTMLButtonElement).disabled).toBe(true);
    expect(hintOf(atMax)).toBe('No rerolls left.');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Offer' }));
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((radio) => radio.disabled && !radio.checked)).toBe(true);
    expect(screen.getByRole('button', { name: 'Pom target 1' }).textContent).toContain('Trait A');
    expect(
      (screen.getByRole('button', { name: 'Pom target 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Pom target 1' }));
    await user.click(screen.getByRole('option', { name: 'Trait C' }));
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    expect(onCommit).toHaveBeenLastCalledWith({
      kind: 'choice',
      offeredTraitKeys: ['A', 'B'],
      selectedTraitKey: 'A',
      rerolledScreens: [{ offeredTraitKeys: ['C', 'B'] }],
    });
    await user.click(screen.getByRole('button', { name: 'Undo last reroll' }));
    await user.click(screen.getByRole('button', { name: 'Save Pom' }));
    expect(onCommit).toHaveBeenLastCalledWith({
      kind: 'choice',
      offeredTraitKeys: ['A', 'B'],
      selectedTraitKey: 'A',
      rerolledScreens: [],
    });
    // A screen rerolled again opens read-only.
    await user.click(screen.getByRole('button', { name: 'Reroll, costs 10' }));
    await user.click(screen.getByRole('tab', { name: 'Offer' }));
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps an earlier screen target in the row it was chosen for', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction: WorkspaceLevelResolutionInteraction = {
      ...interaction({
        value: {
          kind: 'choice',
          offeredTraitKeys: ['A', 'B', 'C'],
          selectedTraitKey: 'A',
          rerolledScreens: [{ offeredTraitKeys: ['A'] }],
        },
        load: () => candidate('choice', ['A', 'B', 'C', 'D'], true, [], 3),
      }),
      screenRerolls: { count: 1, maxCount: 1, lockAtMax: 'poolEmpty', nextCost },
    };
    render(<PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />);
    await user.click(screen.getByRole('tab', { name: 'Offer' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('button', { name: 'Pom target 3' }));
    await user.click(screen.getByRole('option', { name: 'Trait D' }));
    expect(screen.getByRole('button', { name: 'Pom target 3' }).textContent).toContain('Trait D');
    expect(screen.getByRole('button', { name: 'Pom target 2' }).textContent).toContain(
      'Choose a trait',
    );
  });

  it('shows each rerolled screen finding on its own tab and blocks Save', async () => {
    const user = userEvent.setup();
    const evaluatedScreens: unknown[] = [];
    const editorInteraction: WorkspaceLevelResolutionInteraction = {
      ...interaction({
        value: {
          kind: 'choice',
          offeredTraitKeys: ['A', 'B'],
          selectedTraitKey: 'A',
          rerolledScreens: [{ offeredTraitKeys: ['A', 'D'] }],
        },
        load: (value) => {
          evaluatedScreens.push(value.kind === 'choice' ? value.rerolledScreens : undefined);
          return candidate('choice', ['A', 'B', 'C'], false, [], 2, false, {
            rerolledScreenFindings: [
              { code: 'pomTargetUnavailable', screen: 0 },
              { code: 'rollRepeatsAllOffers' },
            ],
          });
        },
      }),
      screenRerolls: { count: 1, maxCount: 2, lockAtMax: 'poolShort', nextCost },
    };
    const view = renderInHeaderDialog(
      <PomResolutionEditor interaction={editorInteraction} onCommit={() => undefined} />,
    );
    const feedback = () => dialogFinding(document.body) ?? '';
    await waitFor(() =>
      expect(feedback()).toContain('One of the previous items is always replaced'),
    );
    expect(evaluatedScreens.at(-1)).toEqual([{ offeredTraitKeys: ['A', 'D'] }]);
    expect(screen.getByRole('tab', { name: 'Offer' }).getAttribute('data-has-findings')).toBe(
      'true',
    );
    expect(feedback()).not.toContain('Pom target unavailable');
    expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.click(screen.getByRole('tab', { name: 'Offer' }));
    expect(feedback()).not.toContain('One of the previous items is always replaced');
    expect(feedback()).toContain('Pom target unavailable');
    view.application.dispose();
  });

  it('names the earlier screen to fix when only it blocks Save', async () => {
    const editorInteraction: WorkspaceLevelResolutionInteraction = {
      ...interaction({
        value: {
          kind: 'choice',
          offeredTraitKeys: ['A', 'B'],
          selectedTraitKey: 'A',
          rerolledScreens: [{ offeredTraitKeys: ['A', 'C'] }, null],
        },
        load: () =>
          candidate('choice', ['A', 'B', 'C'], false, [], 2, false, {
            rerolledScreenFindings: [{ code: 'rerolledScreenMissing', screen: 1 }],
          }),
      }),
      screenRerolls: { count: 2, maxCount: 3, lockAtMax: 'poolShort', nextCost },
    };
    const view = renderInHeaderDialog(
      <PomResolutionEditor interaction={editorInteraction} onCommit={() => undefined} />,
    );
    await waitFor(() => expect(dialogFinding(document.body)).toContain('Reroll 1 needs a fix.'));
    view.application.dispose();
  });

  it('saves only a draft that differs from the saved resolution', async () => {
    const user = userEvent.setup();
    const editorInteraction = interaction({
      value: { kind: 'random', targetTraitKey: 'A' },
      load: () => candidate('random', ['A', 'B'], true),
    });
    const view = renderInHeaderDialog(
      <PomResolutionEditor interaction={editorInteraction} onCommit={vi.fn()} />,
    );
    const save = () => screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement;
    const pick = async (name: string) => {
      await user.click(screen.getByRole('button', { name: 'Recorded random Pom target' }));
      await user.click(await screen.findByRole('option', { name }));
    };
    expect(save().disabled).toBe(true);
    await pick('Trait B');
    await waitFor(() => expect(save().disabled).toBe(false));
    await pick('Trait A');
    await waitFor(() => expect(save().disabled).toBe(true));
    view.application.dispose();
  });

  it('lets an edit save past an inherited earlier-screen finding but not an introduced one', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction: WorkspaceLevelResolutionInteraction = {
      ...interaction({
        value: {
          kind: 'choice',
          offeredTraitKeys: ['A', 'B'],
          selectedTraitKey: 'A',
          rerolledScreens: [{ offeredTraitKeys: ['A', 'D'] }],
        },
        load: (value) =>
          candidate(
            'choice',
            ['A', 'B', 'C'],
            false,
            value.kind === 'choice' && value.offeredTraitKeys.includes('C')
              ? ['duplicateTargets']
              : [],
            2,
            false,
            { rerolledScreenFindings: [{ code: 'pomTargetUnavailable', screen: 0 }] },
          ),
      }),
      screenRerolls: { count: 1, maxCount: 2, lockAtMax: 'poolShort', nextCost },
    };
    const view = renderInHeaderDialog(
      <PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />,
    );
    const save = () => screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement;
    await user.click(screen.getAllByRole('radio', { name: 'Selected' })[1]!);
    await waitFor(() => expect(save().disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Pom target 1' }));
    await user.click(await screen.findByRole('option', { name: 'Trait C' }));
    await waitFor(() => expect(save().disabled).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Pom target 1' }));
    await user.click(await screen.findByRole('option', { name: 'Trait A' }));
    await waitFor(() => expect(save().disabled).toBe(false));
    await user.click(save());
    expect(onCommit).toHaveBeenCalledWith({
      kind: 'choice',
      offeredTraitKeys: ['A', 'B'],
      selectedTraitKey: 'B',
      rerolledScreens: [{ offeredTraitKeys: ['A', 'D'] }],
    });
    view.application.dispose();
  });

  it('preserves a retained partial visible Pom instead of replacing it with defaults', async () => {
    const editorInteraction = interaction({
      value: { kind: 'choice', offeredTraitKeys: ['C'], selectedTraitKey: null },
      load: () => candidate('choice', ['A', 'B', 'C'], false, ['missingTarget'], 2),
    });

    render(<PomResolutionEditor interaction={editorInteraction} onCommit={vi.fn()} />);
    expect((await screen.findByRole('button', { name: 'Pom target 1' })).textContent).toContain(
      'Trait C',
    );
    expect(screen.getByRole('button', { name: 'Pom target 2' }).textContent).toContain(
      'Choose a trait',
    );
  });

  it('pins a stale random target until the author selects an eligible replacement', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction = interaction({
      value: { kind: 'random', targetTraitKey: 'Stale' },
      load: (value) => {
        const supported = value.kind === 'random' && value.targetTraitKey === 'A';
        return candidate('random', ['A'], supported, supported ? [] : ['targetUnavailable']);
      },
    });

    const view = renderInHeaderDialog(
      <PomResolutionEditor interaction={editorInteraction} onCommit={onCommit} />,
    );
    // The header uses the shared Pom finding copy.
    await waitFor(() => expect(dialogFinding(document.body)).toContain('Pom target unavailable'));
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
    view.application.dispose();
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
          return candidate('random', ['A', 'B'], true);
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
      expect(loads).toHaveBeenCalledWith('second', { kind: 'random', targetTraitKey: 'B' }),
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
      load: () => candidate('random', [], true, [], undefined, true),
    });
    render(<PomResolutionEditor interaction={editorInteraction} onCommit={vi.fn()} />);
    // The message occupies the picker's control slot rather than collapsing the dialog body.
    const placeholder = screen
      .getByText('No eligible traits; no level is gained.')
      .closest('.control-placeholder');
    expect(placeholder?.classList.contains('field-control-inline')).toBe(true);
    expect(placeholder?.textContent).toContain('Recorded target');
    expect(screen.queryByRole('button', { name: 'Recorded random Pom target' })).toBeNull();
    // The saved no-op is unchanged, so there is nothing to save.
    expect((screen.getByRole('button', { name: 'Save Pom' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('lets an unavailable random target be cleared for a supported empty domain', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const editorInteraction = interaction({
      value: { kind: 'random', targetTraitKey: 'Stale' },
      load: (value) =>
        candidate(
          'random',
          [],
          value.kind === 'random' && value.targetTraitKey === null,
          ['targetUnavailable'],
          undefined,
          true,
        ),
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
