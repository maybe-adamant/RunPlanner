// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNOPQProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { findingSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { PurchaseCost } from '@planner/ui/editor/biome/commerce/GoldAmount';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(cleanup);

const f = createBiomeAddress('Underworld', 'F');
const source = createOccurrenceId('golden-f-b2-e1');
const doorTo = createOccurrenceId('golden-f-b3-e1');

async function openTimeline(view: ReturnType<typeof renderWorkspace>) {
  act(() =>
    view.application.store.dispatch(semanticOwnerFocused(createOccurrenceAddress(f, source))),
  );
  const details = screen.getByRole('complementary', { name: 'Details' });
  await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
  return details;
}

function history(view: ReturnType<typeof renderWorkspace>) {
  return view.application.store.getState().projectWorkspace.history!;
}

describe('a room’s doors on its Timeline', () => {
  it('opens its doors by default and collapses them without authoring anything', async () => {
    const view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    const details = await openTimeline(view);
    expect(within(details).getByRole('region', { name: 'Door details' })).toBeTruthy();
    const before = history(view);

    const disclosure = within(details).getByRole('button', { name: 'Door details' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(disclosure.getAttribute('aria-controls')!)).not.toBeNull();
    await view.user.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(within(details).queryByRole('region', { name: 'Door details' })).toBeNull();
    // The closed row still names every door.
    const summary = within(details).getByRole('list', { name: 'Door summary' });
    // Chips name their doors without being tab stops of their own.
    expect(
      within(summary)
        .getAllByRole('listitem')
        .every((chip) => !chip.hasAttribute('tabindex')),
    ).toBe(true);
    expect(history(view)).toBe(before);

    // Navigating to a door's owner opens the doors again.
    act(() =>
      view.application.store.dispatch(semanticOwnerFocused(createIncomingRewardAddress(f, doorTo))),
    );
    expect(within(details).getByRole('region', { name: 'Door details' })).toBeTruthy();
  });

  it('keeps doors with a finding open, with nothing to collapse them', async () => {
    let project: ProjectDocument = loadUnderworldFGCheckpoint();
    const room = project.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === doorTo,
    )!;
    // A door whose reward is cleared carries a finding on its reward.
    project = {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((biome) =>
          biome.biomeKey !== 'F' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((occurrence) =>
                    occurrence.occurrenceId !== room.occurrenceId || !('reward' in occurrence.state)
                      ? occurrence
                      : { ...occurrence, state: { ...occurrence.state, reward: null } },
                  ),
                },
              },
        ),
      },
    };
    const view = renderWorkspace(project, 'Underworld', 'F');
    const finding = view.application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) =>
          semanticAddressKey(candidate.origin) ===
          semanticAddressKey(createIncomingRewardAddress(f, doorTo)),
      );
    if (finding === undefined) throw new Error('missing door reward finding');
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    expect(within(details).getByRole('region', { name: 'Door details' })).toBeTruthy();
    expect(within(details).queryByRole('button', { name: 'Door details' })).toBeNull();
  });

  it('picks the exit on the Leave row as one authored step', async () => {
    const view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    const details = await openTimeline(view);
    const leave = within(details).getByRole('listitem', { name: 'Leave room' });
    const before = history(view).past.length;
    await view.user.click(within(leave).getByRole('button', { name: 'Exit door' }));
    await view.user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Door 2' }),
    );
    expect(history(view).past).toHaveLength(before + 1);
    const decision = history(view)
      .present.route.biomes.find((biome) => biome.biomeKey === 'F')!
      .topology!.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === source,
      );
    expect(decision?.kind === 'exit' ? decision.selection : undefined).toEqual({
      kind: 'normal',
      exitKey: 'exit2',
    });
    // The chosen door's room stays a plain label beside the picker.
    expect(within(leave).getByRole('button', { name: 'Exit door' }).textContent).toBe('Door 2');
  });

  it('shows each press’s door chips as that press leaves them', async () => {
    let project = applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: ['DoorReroll'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(f, source),
      target: { kind: 'door', exitKey: 'exit1', occurrenceId: doorTo },
      reward: { rewardType: 'RoomMoneyDrop' },
      index: project.route.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === source,
      )!.roomActions.order.length,
    });
    const press = project.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === source,
    )!.roomActions.order.find((action) => action.kind === 'reroll');
    if (press?.kind !== 'reroll') throw new Error('Door 1 press is missing');
    const view = renderWorkspace(project, 'Underworld', 'F');
    const details = await openTimeline(view);
    const row = details.querySelector<HTMLElement>(
      `[data-room-action-key="${CSS.escape(
        createRoomActionAddress(f, source, JSON.stringify(['reroll', press.rerollId])).actionKey,
      )}"]`,
    );
    if (row === null) throw new Error('Door 1 press row is missing');
    const [doorOne] = within(within(row).getByRole('list', { name: 'Door summary' })).getAllByRole(
      'listitem',
    );
    // The press row shows Door 1 with the reward its press left: Gold.
    const gold = rewardIcon('RoomMoneyDrop');
    expect([...doorOne!.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toContain(
      gold,
    );
    // The Doors open row keeps Door 1's first draw.
    const firstDraw = within(within(details).getByLabelText('Doors open')).getAllByRole(
      'listitem',
    )[0]!;
    expect(
      [...firstDraw.querySelectorAll('img')].map((img) => img.getAttribute('src')),
    ).not.toContain(gold);
  });
});

describe('a room’s last Timeline row', () => {
  it('shows a lone door plainly, with nothing to pick', async () => {
    const view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(f, createOccurrenceId('golden-f-start'))),
      ),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    const leave = within(details).getByRole('listitem', { name: 'Leave room' });
    expect(within(leave).queryByRole('button', { name: 'Exit door' })).toBeNull();
    expect(within(leave).getByText('Door 1')).toBeTruthy();
    expect(within(leave).getByText('Combat 02')).toBeTruthy();
  });

  it('puts a Ship room’s doors and last row in its last phase only', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'O');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(oBiome, oOccurrenceIds.combat07)),
      ),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Intro Timeline' }));
    expect(within(details).queryByRole('listitem', { name: 'Leave room' })).toBeNull();
    expect(within(details).getByRole('listitem', { name: 'Select wheel' })).toBeTruthy();
    await view.user.click(within(details).getByRole('tab', { name: 'Combat 1 Timeline' }));
    expect(within(details).getByLabelText('Doors open')).toBeTruthy();
    expect(within(details).getByRole('listitem', { name: 'Leave room' })).toBeTruthy();
    expect(within(details).queryByRole('listitem', { name: 'Select wheel' })).toBeNull();
  });
});

describe('a room with no way on planned yet', () => {
  it('has no last row but keeps the plan-end action', async () => {
    const view = renderWorkspace(createCompleteFGProject(), 'Underworld', 'F');
    // An unpicked door's room is not on the route: nothing leads on from it.
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(2, 2))),
      ),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    expect(within(details).queryByRole('listitem', { name: 'Leave room' })).toBeNull();
    expect(within(details).getByRole('button', { name: 'End plan here' })).toBeTruthy();
  });
});

describe('a purchase’s chance to afford', () => {
  it('tells the gold held just before the purchase on hover', () => {
    render(
      <PurchaseCost
        affordability={{ label: '>99%', tone: 'high', balanceBefore: { label: '1413 ±90' } }}
        price={{ label: '650' }}
      />,
    );
    const figure = screen.getByText('>99%').closest<HTMLElement>('.purchase-affordability');
    expect(figure?.dataset.hint).toBe('1413 ±90 gold before this purchase');
    expect(figure?.tabIndex).toBe(0);
  });
});
