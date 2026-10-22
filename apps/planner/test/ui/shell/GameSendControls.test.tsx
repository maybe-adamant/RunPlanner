// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { GameModuleStatus, GamePlanSlotNumber } from '@planner/persistence/gameModuleHost';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  createFakeGameModuleHost,
  gameModuleStatus,
  planSlot,
  planSlots,
} from '@planner-test/fixtures/gameModuleHost';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { hintOf } from '@planner-test/support/hints';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

function firstBiomeProject() {
  const project = createCompleteFGProject();
  return { ...project, route: { ...project.route, biomes: project.route.biomes.slice(0, 1) } };
}

/** An application with a sendable library plan open. */
async function sendableApplication(game: ReturnType<typeof createFakeGameModuleHost>) {
  const library = createMemoryProjectLibrary();
  const application = createApplication({
    gameModuleHost: game.host,
    projectLibrary: library.adapter,
  });
  const key = await library.file({ ...firstBiomeProject(), name: 'Erebus opener' });
  const opened = await application.projectOperations.openPlan(key);
  if (opened.status !== 'success') throw new Error(opened.message);
  const current = application.projectOperations.inspectCurrentGamePlan();
  if (current.kind !== 'publishable') throw new Error('fixture must be sendable');
  return { application, current, library };
}

/** The game holding the open plan in `slots`, as it is now unless the fingerprint is given. */
function holding(
  current: { readonly projectId: string; readonly planFingerprint: string },
  slots: readonly GamePlanSlotNumber[],
  options: { readonly active?: GamePlanSlotNumber; readonly fingerprint?: string } = {},
): GameModuleStatus {
  return gameModuleStatus({
    inspection: {
      planSlots: planSlots(
        ...slots.map((slot) =>
          planSlot(slot, {
            state: 'present',
            modifiedAtMs: Date.now(),
            routeKey: 'Underworld',
            biomeKeys: ['F'],
            planFingerprint: options.fingerprint ?? current.planFingerprint,
            projectId: current.projectId,
            displayName: 'Erebus opener',
          }),
        ),
      ),
      ...(options.active === undefined
        ? {}
        : { activeSlot: { state: 'present', slot: options.active } }),
    },
  });
}

const sendSplit = () => screen.getByRole('group', { name: 'Send to game' });
const mainButton = () => within(sendSplit()).getAllByRole('button')[0]!;
const openPicker = async (user: ReturnType<typeof renderPlannerForInteraction>['user']) => {
  await user.click(within(sendSplit()).getByRole('button', { name: 'Choose slot' }));
  return screen.findByRole('dialog', { name: 'Slots' });
};

describe('editor send control', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('sends a never-sent plan to the first empty slot, then says it is up to date', async () => {
    const game = createFakeGameModuleHost();
    const { application, current, library } = await sendableApplication(game);
    renderPlannerForInteraction({ application });
    const button = mainButton();
    await waitFor(() => expect(button.textContent).toBe('Send to slot 1'));

    game.host.status.mockResolvedValue(holding(current, [1], { active: 1 }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    await act(async () => {
      fireEvent.click(button);
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(game.published.map((publication) => publication.slotNumber)).toEqual([1]);
    expect(JSON.parse(game.published[0]!.json)).toMatchObject({ displayName: 'Erebus opener' });
    // Sending never saves first.
    expect(library.writes).toHaveLength(0);
    expect(button.textContent).toBe('✓ Sent · Slot 1');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.querySelector('.game-send-status')?.textContent).toBe('Sent to slot 1.');
    await act(() => vi.advanceTimersByTimeAsync(3000));
    vi.useRealTimers();
    // The same control now reads as the slot holding the plan as it is.
    await waitFor(() => expect(mainButton().textContent).toBe('Slot 1 · up to date'));
    expect(mainButton()).toBe(button);
    expect(sendSplit().getAttribute('data-state')).toBe('upToDate');
  });

  it('sends to the plan’s own slot that plays next once it was edited since sending', async () => {
    const game = createFakeGameModuleHost();
    const { application, current } = await sendableApplication(game);
    game.host.status.mockResolvedValue(
      holding(current, [3, 5], { active: 5, fingerprint: 'sent-before' }),
    );
    const { user } = renderPlannerForInteraction({ application });
    await waitFor(() => expect(mainButton().textContent).toBe('Send to slot 5'));
    await user.click(mainButton());
    expect(game.published.map((publication) => publication.slotNumber)).toEqual([5]);
  });

  it('announces a send whose slot was not made active as sent, not failed', async () => {
    const game = createFakeGameModuleHost();
    const { application } = await sendableApplication(game);
    const { user } = renderPlannerForInteraction({ application });
    game.host.publish.mockResolvedValueOnce({
      status: 'published',
      message: 'Published to Slot 1, but it was not made active.',
      blockers: [],
      activationProblem: 'could not replace active slot file.',
    });
    await waitFor(() => expect(mainButton().textContent).toBe('Send to slot 1'));
    await user.click(mainButton());
    await waitFor(() => expect(mainButton().textContent).toBe('✓ Sent · Slot 1'));
    expect(hintOf(mainButton())).toMatch(/; not made active\.$/);
    expect(document.querySelector('.game-send-status')?.textContent).toBe(
      'Sent to slot 1; not made active.',
    );
    const picker = await openPicker(user);
    expect(within(picker).getByRole('alert').textContent).toMatch(
      /^Sent to slot 1 at .+, but it isn’t active: could not replace active slot file\.$/,
    );
  });

  it('reports a failed send on the button and in the slot picker', async () => {
    const game = createFakeGameModuleHost();
    const { application } = await sendableApplication(game);
    const { user } = renderPlannerForInteraction({ application });
    game.host.publish.mockResolvedValueOnce({
      status: 'nativeWrite',
      message: 'could not write plan slot.',
      blockers: [],
      activationProblem: null,
    });
    await waitFor(() => expect(mainButton().textContent).toBe('Send to slot 1'));
    await user.click(mainButton());
    await waitFor(() => expect(mainButton().textContent).toBe('! Not sent'));
    expect(hintOf(mainButton())).toBe('Details are in the slot picker.');
    expect(document.querySelector('.game-send-status')?.textContent).toBe(
      'Not sent: could not write plan slot.',
    );
    const picker = await openPicker(user);
    expect(within(picker).getByRole('alert').textContent).toMatch(
      /^Last send failed at .*: could not write plan slot\.$/,
    );
  });

  it('keeps unsendable states focusable and says why in the slot picker', async () => {
    const notReady = createFakeGameModuleHost(
      gameModuleStatus({
        inspection: { modpackLib: { state: 'missing', found: null } },
        publicationBlockers: [{ code: 'modpackLibMissing', found: null, required: '4.1.0' }],
      }),
    );
    const first = createApplication({ gameModuleHost: notReady.host });
    first.store.dispatch(authoredProjectReplaced(firstBiomeProject()));
    const view = renderPlannerForInteraction({ application: first });
    await waitFor(() => expect(hintOf(mainButton())).toBe('Set up the game on the Game tab.'));
    expect(mainButton().textContent).toBe('Send to game');
    expect(mainButton().getAttribute('aria-disabled')).toBe('true');
    expect((mainButton() as HTMLButtonElement).disabled).toBe(false);
    mainButton().focus();
    expect(document.activeElement).toBe(mainButton());
    fireEvent.click(mainButton());
    expect(notReady.published).toEqual([]);
    const picker = await openPicker(view.user);
    expect(
      within(picker).getByText('Set up or update the game module on the Game tab to send plans.'),
    ).toBeTruthy();
    expect(within(picker).queryByRole('button', { name: /^Send here/ })).toBeNull();
    cleanup();

    const game = createFakeGameModuleHost();
    const unsendable = createApplication({
      gameModuleHost: game.host,
      projectLibrary: createMemoryProjectLibrary().adapter,
    });
    await unsendable.projectOperations.createNew('Underworld');
    const { user } = renderPlannerForInteraction({ application: unsendable });
    await waitFor(() =>
      expect(hintOf(mainButton())).toBe('Resolve this plan’s findings before sending it.'),
    );
    const blocked = await openPicker(user);
    const note = within(blocked).getByRole('note');
    expect(note.textContent).toContain('Resolve this plan’s findings before sending it.');
    await user.click(within(note).getByRole('button', { name: 'Show findings' }));
    expect(screen.queryByRole('dialog', { name: 'Slots' })).toBeNull();
    expect(unsendable.store.getState().editorSession.selectedFinding?.key).toBe(
      unsendable.store.getState().projectWorkspace.assembly?.evaluation.route.issue?.regionKey,
    );
    expect(game.published).toEqual([]);
  });

  it('picks any slot, asks before replacing another plan, and updates an older one', async () => {
    const game = createFakeGameModuleHost();
    const { application, current, library } = await sendableApplication(game);
    const theirs = await library.file({
      ...firstBiomeProject(),
      projectId: 'theirs',
      name: 'Their run',
    });
    expect(theirs).toBeTruthy();
    const status = holding(current, [2, 4], { active: 2 });
    const occupied = gameModuleStatus({
      inspection: {
        activeSlot: { state: 'present', slot: 2 },
        planSlots: status.inspection!.planSlots.map((slot) =>
          slot.slot === 4
            ? { ...slot, planFingerprint: 'before' }
            : slot.slot === 1
              ? { ...slot, state: 'present', routeKey: 'Surface', projectId: 'theirs' }
              : slot.slot === 3
                ? { ...slot, state: 'present', routeKey: 'Surface', projectId: 'outside' }
                : slot,
        ),
      },
    });
    game.host.status.mockResolvedValue(occupied);
    const { application: app, user } = renderPlannerForInteraction({ application });
    await waitFor(() => expect(mainButton().textContent).toBe('Slot 2 · up to date'));

    const picker = await openPicker(user);
    const own = within(picker).getByRole('list', { name: 'This plan in game' });
    expect(within(own).getByText(/plays next/)).toBeTruthy();
    const pick = (slot: number) =>
      within(within(picker).getByRole('list', { name: 'Slots' })).getAllByRole('listitem')[
        slot - 1
      ]!;
    expect(await within(pick(1)).findByText('Their run')).toBeTruthy();
    expect(within(pick(2)).getByText('This plan · current')).toBeTruthy();
    expect(within(pick(2)).getByRole('button', { name: 'Current (slot 2)' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(pick(3)).getByText('Not in library')).toBeTruthy();
    expect(within(pick(4)).getByText('This plan · older')).toBeTruthy();

    await user.click(within(pick(5)).getByRole('button', { name: 'Send here (slot 5)' }));
    expect(game.published.map((publication) => publication.slotNumber)).toEqual([5]);

    await user.click(within(sendSplit()).getByRole('button', { name: 'Choose slot' }));
    const again = await screen.findByRole('dialog', { name: 'Slots' });
    await user.click(within(again).getByRole('button', { name: 'Replace (slot 1)' }));
    const confirm = await screen.findByRole('dialog', { name: 'Replace the plan in slot 1?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(game.published).toHaveLength(1);

    const third = await openPicker(user);
    await user.click(within(third).getByRole('button', { name: 'Update slot 4' }));
    expect(game.published.map((publication) => publication.slotNumber)).toEqual([5, 4]);

    const last = await openPicker(user);
    await user.click(within(last).getByRole('button', { name: 'Open Game' }));
    expect(app.store.getState().librarySession.view).toEqual({ kind: 'home', tab: 'game' });
    expect(screen.getByRole('region', { name: 'Game module' })).toBeTruthy();
  });
});
