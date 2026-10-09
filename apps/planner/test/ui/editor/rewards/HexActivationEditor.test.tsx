// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalog } from '@run-planner/hades2-catalog';
import { afterEach, describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';

import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type AcquisitionRoleAddress,
  type AuthoredRoomState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadSurfaceSeleneHexPathCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

import { createApplication } from '@planner/composition/createApplication';
import { hexActivationDialogOpened } from '@planner/state/editorSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import { HexActivationLauncher } from '@planner/ui/editor/rewards/HexActivationEditor';

/** A room's reward, where its state carries one. */
function roomReward(state: AuthoredRoomState | undefined) {
  return state !== undefined && 'reward' in state ? state.reward : null;
}

/** The Selene route's Path of Stars Talent Drop, its second Path screen. */
function talentDrop(project: ProjectDocument): AcquisitionRoleAddress {
  const biome = project.route.biomes.find((candidate) => candidate.biomeKey === 'P')!;
  const occurrence = biome.topology!.occurrences.find(
    (candidate) => roomReward(candidate.state)?.hexActivationsByAcquisitionRole !== undefined,
  )!;
  return createAcquisitionRoleAddress(
    createIncomingRewardAddress(createBiomeAddress('Surface', 'P'), occurrence.occurrenceId),
    'self',
  );
}

function renderScreen(
  edit?: (project: ProjectDocument, owner: AcquisitionRoleAddress) => ProjectDocument,
) {
  const application = createApplication();
  const loaded = loadSurfaceSeleneHexPathCheckpoint();
  const owner = talentDrop(loaded);
  application.store.dispatch(
    authoredProjectReplaced(edit === undefined ? loaded : edit(loaded, owner)),
  );
  const history = () => application.store.getState().projectWorkspace.history!;
  const selection = () =>
    history()
      .present.route.biomes.find((biome) => biome.biomeKey === 'P')!
      .topology!.occurrences.flatMap(
        (occurrence) =>
          roomReward(occurrence.state)?.hexActivationsByAcquisitionRole?.self?.selectedNodeKeys ??
          [],
      );
  const Screen = () => {
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const interaction = workspace.interactions.acquisitionConversions.get(
      semanticAddressKey(owner),
    )?.hexActivation;
    if (interaction === undefined) throw new Error('Path screen is not bound');
    return (
      <FindingTargetScope findings={workspace.findingsByRepairTarget}>
        <HexActivationLauncher interaction={interaction} owner={owner} />
      </FindingTargetScope>
    );
  };
  const view = render(
    <Provider store={application.store}>
      <Screen />
    </Provider>,
  );
  const rerender = () =>
    view.rerender(
      <Provider store={application.store}>
        <Screen />
      </Provider>,
    );
  return { application, history, owner, rerender, selection, user: userEvent.setup() };
}

const launcher = () => screen.getByRole('button', { name: 'Edit Path of Stars' });
const dialog = () => screen.getByRole('dialog', { name: 'Choose Path of Stars nodes' });
const board = () => within(dialog()).getByRole('group', { name: /Hex tree$/ });
const points = () => within(dialog()).getByText(/ of 3 points$/);
const selectedButtons = () =>
  within(board())
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true');

afterEach(cleanup);

describe('Path of Stars screen editor', () => {
  it('edits the spent screen as a draft: removal reopens additions, Cancel discards, Save commits once', async () => {
    const { application, history, owner, rerender, selection, user } = renderScreen();
    const saved = selection();
    const before = history().past.length;

    await user.click(launcher());
    expect(application.store.getState().editorSession.hexActivationDialogTarget).toEqual(owner);
    expect(points().textContent).toBe('3 of 3 points');
    // A spent screen offers only its own nodes, which stay removable.
    expect(within(board()).getAllByRole('button')).toEqual(selectedButtons());
    expect(selectedButtons()).toHaveLength(3);

    await user.click(selectedButtons()[0]!);
    expect(points().textContent).toBe('2 of 3 points');
    const addable = within(board())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'false');
    expect(addable.length).toBeGreaterThan(0);
    expect(
      within(dialog()).getByRole('status', { name: 'Path of Stars feedback' }).textContent,
    ).toContain('Choose 3 Path of Stars nodes');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(history().past).toHaveLength(before);

    rerender();
    await user.click(launcher());
    expect(points().textContent).toBe('3 of 3 points');
    const removed = selectedButtons()[2]!.getAttribute('aria-label');
    await user.click(selectedButtons()[2]!);
    const added = within(board())
      .getAllByRole('button')
      .find(
        (button) =>
          button.getAttribute('aria-pressed') === 'false' &&
          button.getAttribute('aria-label') !== removed,
      )!;
    await user.click(added);
    expect(points().textContent).toBe('3 of 3 points');
    await user.click(within(dialog()).getByRole('button', { name: 'Save Path of Stars nodes' }));
    expect(history().past).toHaveLength(before + 1);
    expect(selection()).not.toEqual(saved);
    expect(selection()).toHaveLength(3);
    expect(application.store.getState().editorSession.hexActivationDialogTarget ?? null).toBeNull();
    application.dispose();
  });

  it('marks a saved conflict on the launcher and on the nodes it names', async () => {
    const { application, owner } = renderScreen((project, owner) => {
      const tree = project.route.loadout.aspectHexTree!;
      const nodes =
        catalog.hexes.byKey['SpellMoonBeamTrait']!.layouts.byKey[tree.layoutKey]!.nodes.values;
      // A deep Rare node, which no invested node reaches.
      const deep = nodes.filter((node) => node.kind === 'keystone').at(-1)!;
      return applyProjectCommand(project, catalog, {
        kind: 'ReplaceHexActivation',
        acquisition: owner,
        value: { selectedNodeKeys: [deep.key] },
      });
    });
    expect(launcher().dataset.hasFindings).toBe('true');
    expect(launcher().getAttribute('aria-description')).toContain('Path of Stars');

    // The session target opens the dialog, as the launcher does.
    act(() => application.store.dispatch(hexActivationDialogOpened(owner)));
    const marked = within(board())
      .getAllByRole('button')
      .filter((button) => button.dataset.hasFindings === 'true');
    expect(marked.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true']);
    application.dispose();
  });

  it('opens an unpicked reached screen empty and marks its launcher with the required choice', async () => {
    const { application, history, user } = renderScreen((project) => {
      const raw = JSON.parse(encodeProjectDocument(project)) as {
        route: { biomes: { biomeKey: string; topology: { occurrences: unknown[] } }[] };
      };
      const p = raw.route.biomes.find((biome) => biome.biomeKey === 'P')!;
      for (const occurrence of p.topology.occurrences as {
        state?: { reward?: Record<string, unknown> | null };
      }[])
        delete occurrence.state?.reward?.hexActivationsByAcquisitionRole;
      return decodeProjectDocument(raw, catalog);
    });
    expect(launcher().dataset.hasFindings).toBe('true');
    expect(launcher().getAttribute('aria-description')).toContain('Choose 3 Path of Stars nodes');
    await user.click(launcher());
    expect(points().textContent).toBe('0 of 3 points');
    expect(selectedButtons()).toEqual([]);
    // Saving the empty draft authors the screen, which had no saved selection.
    const before = history().past.length;
    await user.click(within(dialog()).getByRole('button', { name: 'Save Path of Stars nodes' }));
    expect(history().past).toHaveLength(before + 1);
    application.dispose();
  });

  it('removes saved nodes that conflict: an invested node from the board, the rest by clearing', async () => {
    const { application, history, selection, user } = renderScreen((project, owner) =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceHexActivation',
        acquisition: owner,
        value: { selectedNodeKeys: ['1:2', '2:4', '9:9'] },
      }),
    );
    const before = history().past.length;
    await user.click(launcher());
    // 1:2 was invested on the N screen; it stays a pressed, marked, removable node.
    const marked = selectedButtons().filter((button) => button.dataset.hasFindings === 'true');
    expect(marked).toHaveLength(1);
    await user.click(marked[0]!);
    expect(points().textContent).toBe('2 of 3 points');
    await user.click(within(dialog()).getByRole('button', { name: 'Clear selection' }));
    expect(points().textContent).toBe('0 of 3 points');
    expect(within(dialog()).getByRole('button', { name: 'Clear selection' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(within(dialog()).getByRole('button', { name: 'Save Path of Stars nodes' }));
    expect(history().past).toHaveLength(before + 1);
    expect(selection()).toEqual([]);
    application.dispose();
  });
});
