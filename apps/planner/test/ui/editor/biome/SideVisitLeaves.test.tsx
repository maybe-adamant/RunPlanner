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
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { roomKindIcon } from '@planner/ui/editor/biome/roomIcon';

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
    .filter((name) => name === 'Leave room' || name.startsWith('Returned from'));
}

function pastEndRows(): readonly string[] {
  return within(screen.getByRole('list', { name: 'Room timeline' }))
    .getAllByRole('listitem')
    .filter((row) => row.getAttribute('data-plan-end') === 'pastEnd')
    .map((row) => row.getAttribute('aria-label') ?? '');
}

function mapPoints(): readonly HTMLElement[] {
  return [...roomCard().querySelectorAll<HTMLElement>('.room-map-column [role="img"]')];
}

/** The side room whose door Melinoë stands at on the map, or Entry. */
function whereIsMelinoe(): string {
  const at = mapPoints().flatMap((point) => {
    const name = point.getAttribute('aria-label') ?? '';
    if (point.classList.contains('room-map-entry')) return ['Entry'];
    return name.endsWith(' · Melinoë') ? [name.split(' · ')[0]!] : [];
  });
  expect(at).toHaveLength(1);
  return at[0]!;
}

/** The map's hidden door at Door 1 shows the engine-settled placeholder room and its reward. */
function expectHiddenDoorOnMap(
  application: PlannerApplication,
  room: ReturnType<typeof createOccurrenceAddress>,
  draws: boolean,
) {
  const node = workspaceBiome(application, 'Surface', 'N').nodes.find(
    (candidate) =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === room.occurrenceId,
  );
  const phantom = node?.kind === 'occurrenceWorkbench' ? node.room.phantomExit : undefined;
  expect(phantom?.room.icon).toBeDefined();
  // A main room's placeholder is the no-draw Preboss; a side room's draws a reward.
  expect(phantom?.reward.rewardType !== undefined).toBe(draws);
  const door = mapPoints().find((point) => point.getAttribute('aria-label') === 'Hidden door');
  expect(door?.hasAttribute('data-hidden')).toBe(true);
  const icons = [...door!.querySelectorAll('img')].map((icon) => icon.getAttribute('src'));
  expect(icons).toEqual([
    ...(typeof roomKindIcon(phantom!.room.icon!) === 'string'
      ? [roomKindIcon(phantom!.room.icon!)]
      : []),
    ...(draws ? [rewardIcon(phantom!.reward.rewardType!)] : []),
  ]);
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
      `Returned from ${firstLabel}`,
      'Leave room',
      `Returned from ${secondLabel}`,
      'Leave room',
    ]);
    // The first exit offers the Hub and every open side room; it cannot end the plan.
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
    expect(rowNames()).toEqual(['Leave room', `Returned from ${firstLabel}`, 'Leave room']);
    // The Hub return then picks a further side visit.
    await view.user.click(
      within(await openLeavePicker(view.user, roomCard(), 1)).getByRole('option', {
        name: secondLabel,
      }),
    );
    expect(visitOrder(view.application)).toEqual([first, second]);
  });

  it('ends the plan at an exit after a side visit as that side room, and continues it', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    const [first, second] = visitOrder(view.application);
    const firstLabel = sideLabel(view.application, first!);
    const secondLabel = sideLabel(view.application, second!);
    const planEnd = () => presentProject(view.application).route.planEnd;
    await view.user.click(
      within(await openLeavePicker(view.user, roomCard(), 1)).getByRole('option', {
        name: 'End plan here',
      }),
    );
    expect(planEnd()).toEqual({ biomeKey: 'N', occurrenceId: first });
    expect(visitOrder(view.application)).toEqual([first, second]);
    // The later exit stays as authored, past the end, and every row after the end reads as not
    // walked, the return from the side room the plan ends in among them.
    expect(exitDoor(2).hasAttribute('disabled')).toBe(true);
    expect(pastEndRows()).toEqual([
      `Returned from ${firstLabel}`,
      `Returned from ${secondLabel}`,
      'Leave room',
    ]);
    expect(leaveOptionNames(await openLeavePicker(view.user, roomCard(), 1)).at(-1)).toBe(
      'End plan here (picked)',
    );
    await view.user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: secondLabel }),
    );
    expect(planEnd()).toBeUndefined();
    expect(visitOrder(view.application)).toEqual([first, second]);
    expect(exitDoor(2).hasAttribute('disabled')).toBe(false);
    expect(pastEndRows()).toEqual([]);
  });

  it('names each return Returned with its side room', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    const [first] = visitOrder(view.application);
    const firstLabel = sideLabel(view.application, first!);
    const row = within(roomCard()).getByRole('listitem', { name: `Returned from ${firstLabel}` });
    expect(row.querySelector('.timeline-banner-title')?.textContent).toBe('Returned');
    expect(row.querySelector('.timeline-leave-text')?.textContent).toBe(
      firstLabel.replace(/^Side Room /, 'SR '),
    );
  });

  it('puts Melinoë where the marked row finds her: the entry, then each side door she is back from', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    const [first, second] = visitOrder(view.application);
    const firstLabel = sideLabel(view.application, first!);
    const secondLabel = sideLabel(view.application, second!);
    const rows = () =>
      [...screen.getByRole('list', { name: 'Room timeline' }).children] as HTMLElement[];
    const mark = (row: HTMLElement) => fireEvent.pointerDown(row);
    const named = (name: string) => rows().find((row) => row.getAttribute('aria-label') === name)!;
    const leaves = () => rows().filter((row) => row.getAttribute('aria-label') === 'Leave room');
    // With no row marked she stands at the entry, as the room is left.
    expect(whereIsMelinoe()).toBe('Entry');
    mark(rows()[0]!);
    expect(whereIsMelinoe()).toBe('Entry');
    mark(named(`Returned from ${firstLabel}`));
    expect(whereIsMelinoe()).toBe(firstLabel);
    // She leaves for the next side room from where she came back.
    mark(leaves()[1]!);
    expect(whereIsMelinoe()).toBe(firstLabel);
    mark(named(`Returned from ${secondLabel}`));
    expect(whereIsMelinoe()).toBe(secondLabel);
    // The way back to the Hub is taken at the entry.
    mark(leaves().at(-1)!);
    expect(whereIsMelinoe()).toBe('Entry');
  });

  it('shows the hidden door at the entry with its settled room and reward, and no Hub chip', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    expectHiddenDoorOnMap(view.application, combat05, false);
    expect(mapPoints().some((point) => point.getAttribute('aria-label') === 'Hub')).toBe(false);
    // A side room's way back to its main room is its own hidden door.
    const [first] = visitOrder(view.application);
    const side = createOccurrenceAddress(nBiome, first!);
    await openTimeline(view, side);
    expectHiddenDoorOnMap(view.application, side, true);
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
    // The Hub is left through the entry, where the hidden door stands.
    await view.user.hover(within(list).getByRole('option', { name: 'Hub' }));
    expect(ringed()).toEqual(['Hidden door']);
  });

  it('hangs a side door chip at the map top edge below its point', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await openTimeline(view, combat05);
    const points = [...roomCard().querySelectorAll<HTMLElement>('.room-map-column [data-side]')];
    const top = points.find((point) => parseFloat(point.style.top) < 5);
    expect(top?.getAttribute('aria-label')).toMatch(/^Side Room 07/);
    expect(top?.getAttribute('data-chip-y')).toBe('below');
    const inner = points.filter((point) => parseFloat(point.style.top) > 10);
    expect(inner.length).toBeGreaterThan(0);
    expect(inner.every((point) => !point.hasAttribute('data-chip-y'))).toBe(true);
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
