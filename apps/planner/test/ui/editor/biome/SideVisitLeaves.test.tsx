// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  leaveOptionNames,
  openLeavePicker,
  renderWorkspace,
  workspaceBiome,
} from '@planner-test/support/biome-workbench';
import { hintOf } from '@planner-test/support/hints';

afterEach(() => cleanup());

const combat05 = createOccurrenceAddress(nBiome, nOccurrenceId('combat05'));

function presentProject(application: PlannerApplication): ProjectDocument {
  return application.store.getState().projectWorkspace.history!.present;
}

function visitOrder(application: PlannerApplication): readonly OccurrenceId[] {
  const decision = presentProject(application)
    .route.biomes.find((biome) => biome.biomeKey === 'N')
    ?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'localVisit' &&
        candidate.sourceOccurrenceId === nOccurrenceId('combat05'),
    );
  if (decision?.kind !== 'localVisit') throw new Error('N Combat 05 has no side visits');
  return decision.visitOrder;
}

function sideLabel(application: PlannerApplication, occurrenceId: OccurrenceId): string {
  const slot = workspaceBiome(application, 'Surface', 'N')
    .nodes.flatMap((candidate) =>
      candidate.kind === 'occurrenceWorkbench' ? (candidate.localVisit?.slots ?? []) : [],
    )
    .find((candidate) => candidate.occurrenceId === occurrenceId);
  if (slot === undefined) throw new Error(`${occurrenceId} has no side slot`);
  return slot.label;
}

function roomCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('.biome-occurrence-workbench');
  if (card === null) throw new Error('no room workbench is open');
  return card;
}

async function openTimeline(
  view: ReturnType<typeof renderWorkspace>,
  room: ReturnType<typeof createOccurrenceAddress>,
) {
  act(() => view.application.store.dispatch(semanticOwnerFocused(room)));
  const tab = screen.getByRole('tab', { name: 'Room Timeline' });
  if (tab.getAttribute('aria-selected') !== 'true') await view.user.click(tab);
}

function rowNames(): readonly string[] {
  return within(screen.getByRole('list', { name: 'Room timeline' }))
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('aria-label') ?? '')
    .filter((name) => name === 'Leave room' || name.startsWith('Back from'));
}

function exitDoor(index: number): HTMLElement {
  const row = within(roomCard()).getAllByRole('listitem', { name: 'Leave room' })[index]!;
  return within(row).getByRole('button', { name: 'Exit door' });
}

describe('main room side visits on its Timeline', () => {
  it('leaves through each side visit and its return, then back to the Hub', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    const [first, second] = visitOrder(view.application);
    const firstLabel = sideLabel(view.application, first!);
    const secondLabel = sideLabel(view.application, second!);
    expect(rowNames()).toEqual([
      'Leave room',
      `Back from ${firstLabel}`,
      'Leave room',
      `Back from ${secondLabel}`,
      'Leave room',
    ]);
    // The first exit offers the Hub and every open side room; only the Hub return ends the plan.
    const firstOptions = leaveOptionNames(await openLeavePicker(view.user, roomCard(), 0));
    expect(firstOptions[0]).toBe('Hub');
    expect(firstOptions).toContain(`${firstLabel} (picked)`);
    expect(firstOptions).toContain(secondLabel);
    expect(firstOptions).not.toContain('End plan here');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    // A later exit offers no room visited before it.
    const secondOptions = leaveOptionNames(await openLeavePicker(view.user, roomCard(), 1));
    expect(secondOptions).toContain(`${secondLabel} (picked)`);
    expect(secondOptions.some((name) => name.startsWith(firstLabel))).toBe(false);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    const lastOptions = leaveOptionNames(await openLeavePicker(view.user, roomCard(), 2));
    expect(lastOptions[0]).toBe('Hub (picked)');
    expect(lastOptions.at(-1)).toBe('End plan here');

    // Picking the Hub at the second exit ends the visits there.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await view.user.click(
      within(await openLeavePicker(view.user, roomCard(), 1)).getByRole('option', { name: 'Hub' }),
    );
    expect(visitOrder(view.application)).toEqual([first]);
    expect(rowNames()).toEqual(['Leave room', `Back from ${firstLabel}`, 'Leave room']);
    // The Hub return then picks a further side visit.
    await view.user.click(
      within(await openLeavePicker(view.user, roomCard(), 1)).getByRole('option', {
        name: secondLabel,
      }),
    );
    expect(visitOrder(view.application)).toEqual([first, second]);
  });

  it('rings the side door or the Hub return of the Leave room option under the highlight', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    const [, second] = visitOrder(view.application);
    const secondLabel = sideLabel(view.application, second!);
    const ringed = () =>
      [...roomCard().querySelectorAll('.room-map-column [data-preview]')].map((point) =>
        point.getAttribute('aria-label'),
      );
    const list = await openLeavePicker(view.user, roomCard(), 0);
    await view.user.hover(within(list).getByRole('option', { name: secondLabel }));
    expect(ringed()).toEqual([`${secondLabel} · Visit 2`]);
    await view.user.hover(within(list).getByRole('option', { name: 'Hub' }));
    expect(ringed()).toEqual(['Door 1']);
  });

  it('keeps a later visit that an earlier change repeats, marked on its own exit', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    const [, second] = visitOrder(view.application);
    const secondLabel = sideLabel(view.application, second!);
    await view.user.click(
      within(await openLeavePicker(view.user, roomCard(), 0)).getByRole('option', {
        name: secondLabel,
      }),
    );
    expect(visitOrder(view.application)).toEqual([second, second]);
    await waitFor(() => expect(exitDoor(1).getAttribute('data-has-findings')).toBe('true'));
    expect(exitDoor(1).getAttribute('aria-description')).toBe(`${secondLabel} is already visited.`);
    expect(exitDoor(0).hasAttribute('data-has-findings')).toBe(false);
    expect(exitDoor(2).hasAttribute('data-has-findings')).toBe(false);
  });

  it('explains an exit the engine refuses from its candidate', async () => {
    let project = loadSurfaceNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', slotKey)),
        value: { rewardType: 'AirBoost' },
      });
    }
    const view = renderWorkspace(project, 'Surface', 'N');
    await openTimeline(view, combat05);
    const before = presentProject(view.application);
    const options = await openLeavePicker(view.user, roomCard(), 0);
    const hub = within(options).getByRole('option', { name: 'Hub' });
    expect(hub.getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(hub)).toContain('Reward unavailable from pool');
    await view.user.click(hub);
    expect(presentProject(view.application)).toBe(before);
  });

  it('leaves a side room back to its main room, or ends the plan there', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const [first] = visitOrder(view.application);
    await openTimeline(view, createOccurrenceAddress(nBiome, first!));
    expect(leaveOptionNames(await openLeavePicker(view.user, roomCard()))).toEqual([
      'Back to Combat 05 (picked)',
      'End plan here',
    ]);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await view.user.click(screen.getByRole('button', { name: 'Open Combat 05' }));
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(combat05);
  });
});

describe('Hub visits on the Hub Timeline', () => {
  it('lets an earlier visit take a later visit’s room, marking the later visit', async () => {
    const view = renderWorkspace(loadSurfaceNProject(), 'Surface', 'N');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubDecisionAddress(nBiome, 'hub')),
      ),
    );
    await view.user.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    const visit2 = () => screen.getByRole('button', { name: 'Visit 2 room' });
    const hubNode = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (candidate) => candidate.kind === 'hubDecision',
    );
    const secondRoom =
      hubNode?.kind === 'hubDecision'
        ? hubNode.slots.find((slot) => slot.hubSlotKey === hubVisitRoom(view.application, 2))?.label
        : undefined;
    if (secondRoom === undefined) throw new Error('the Hub has no second visit');
    await view.user.click(screen.getByRole('button', { name: 'Visit 1 room' }));
    const repeat = within(await screen.findByRole('listbox')).getByRole('option', {
      name: secondRoom,
    });
    expect(repeat.getAttribute('aria-disabled')).not.toBe('true');
    await view.user.click(repeat);
    await waitFor(() => expect(visit2().getAttribute('data-has-findings')).toBe('true'));
    expect(visit2().getAttribute('aria-description')).toContain(`${secondRoom} is already visited`);
    expect(hubVisitRoom(view.application, 1)).toBe(hubVisitRoom(view.application, 2));
  });
});

function hubVisitRoom(application: PlannerApplication, visitIndex: number): string | undefined {
  const hub = presentProject(application)
    .route.biomes.find((biome) => biome.biomeKey === 'N')
    ?.topology?.decisions.find((candidate) => candidate.kind === 'hub');
  if (hub?.kind !== 'hub') return undefined;
  return hub.actions.filter((action) => action.kind === 'roomVisit')[visitIndex - 1]?.hubSlotKey;
}
