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
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { findingSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { PurchaseCost } from '@planner/ui/editor/biome/commerce/GoldAmount';
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
    expect(within(details).getByRole('region', { name: 'Doors' })).toBeTruthy();
    const before = history(view);

    await view.user.click(within(details).getByRole('button', { name: 'Hide doors' }));
    expect(within(details).queryByRole('region', { name: 'Doors' })).toBeNull();
    // The closed row still names every door.
    expect(within(details).getByRole('list', { name: 'Doors' })).toBeTruthy();
    expect(history(view)).toBe(before);

    // Navigating to a door's owner opens the doors again.
    act(() =>
      view.application.store.dispatch(semanticOwnerFocused(createIncomingRewardAddress(f, doorTo))),
    );
    expect(within(details).getByRole('region', { name: 'Doors' })).toBeTruthy();
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
    expect(within(details).getByRole('region', { name: 'Doors' })).toBeTruthy();
    expect(within(details).queryByRole('button', { name: 'Hide doors' })).toBeNull();
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
    const [doorOne] = within(within(row).getByRole('list', { name: 'Doors' })).getAllByRole(
      'listitem',
    );
    expect(doorOne!.querySelectorAll('img').length).toBeGreaterThan(1);
    // The Doors open row keeps every door's first draw.
    const firstDraw = within(within(details).getByLabelText('Doors open')).getAllByRole(
      'listitem',
    )[0]!;
    expect(firstDraw.innerHTML).not.toBe(doorOne!.innerHTML);
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
