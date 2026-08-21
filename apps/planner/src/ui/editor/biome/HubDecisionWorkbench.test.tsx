// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNEntryFrontierProject,
  loadSurfaceNPartialHubProject,
  loadSurfaceNProject,
  loadSurfaceNStoryBoardProject,
  loadSurfaceNTenOpenInvalidProject,
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceIdsBySlot,
  nOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  renderHubDecisionWorkbench,
  renderStaticHubDecisionWorkbench,
  workspaceBiome,
} from '@planner-test/support/biome-workbench';

const browserPropertyRestorers: (() => void)[] = [];
let representativeHubProject: ProjectDocument;
let invalidTenDoorHubProject: ProjectDocument;

beforeAll(() => {
  representativeHubProject = loadSurfaceNOPQProject();
  invalidTenDoorHubProject = applyProjectCommand(loadSurfaceNTenOpenInvalidProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat04')),
    value: { rewardType: 'MaxHealthDropBig' },
  });
});

afterEach(() => {
  cleanup();
  while (browserPropertyRestorers.length > 0) browserPropertyRestorers.pop()?.();
  vi.restoreAllMocks();
  delete (document as unknown as { elementFromPoint?: Document['elementFromPoint'] })
    .elementFromPoint;
});

function replaceBrowserProperty(target: object, property: PropertyKey, value: unknown): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value, writable: true });
  browserPropertyRestorers.push(() => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(target, property);
    } else {
      Object.defineProperty(target, property, descriptor);
    }
  });
}

function nHubState(application: PlannerApplication) {
  const plan = application.store
    .getState()
    .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'N');
  const topology = plan?.topology;
  if (topology === undefined || topology === null) {
    throw new Error('N Hub test project has no authored topology');
  }
  const decision = topology.decisions.find((candidate) => candidate.kind === 'hub');
  if (decision?.kind !== 'hub') throw new Error('N Hub test project has no Hub decision');
  return { decision, topology };
}

function nHubOccurrence(application: PlannerApplication, hubSlotKey: string) {
  const { decision, topology } = nHubState(application);
  const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  if (target === undefined) throw new Error(`N Hub slot ${hubSlotKey} is not open`);
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === target.occurrenceId,
  );
  if (occurrence === undefined) throw new Error(`N Hub slot ${hubSlotKey} has no occurrence`);
  return occurrence;
}

function twoVisitHubProject(): ProjectDocument {
  return applyProjectCommand(loadSurfaceNPartialHubProject(), catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: ['combat05', 'miniBoss01'],
  });
}

function hubRoomDetailProject(): ProjectDocument {
  let project = applyProjectCommand(loadSurfaceNProject(), catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat09'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CloseHubSlot',
    slot: createHubSlotAddress(nBiome, 'hub', 'combat23'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'OpenHubSlot',
    slot: createHubSlotAddress(nBiome, 'hub', 'combat07'),
    occurrenceId: nOccurrenceId('combat07'),
    localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot('combat07'),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat07', 'combat09'],
  });
}

function hubRoster(): HTMLElement {
  selectHubTab('Hub Timeline');
  return screen.getByRole('group', { name: 'Ranked open Ephyra rooms' });
}

function selectHubTab(name: 'Hub Overview' | 'Hub Timeline' | 'Hub Exit'): void {
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab);
}

function hubCard(slotKey: string): HTMLElement {
  const card = hubRoster().querySelector<HTMLElement>(`[data-hub-slot-key="${slotKey}"]`);
  if (card === null) throw new Error(`Hub roster card ${slotKey} is missing`);
  return card;
}

function hubDragHandle(slotKey: string): HTMLElement {
  const handle = hubCard(slotKey).querySelector<HTMLElement>('[data-hub-roster-drag-handle]');
  if (handle === null) throw new Error(`Hub roster drag handle ${slotKey} is missing`);
  return handle;
}

function setHubPointerHitTarget(target: HTMLElement): void {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => target,
  });
}

interface HubPointerHitTarget {
  readonly target: HTMLElement;
  readonly x: number;
  readonly y: number;
}

function hubNextVisitTarget(): HTMLElement {
  const target = hubRoster().querySelector<HTMLElement>(
    '[data-hub-roster-drop-target="nextVisit"]',
  );
  if (target === null) throw new Error('Hub roster next-visit target is missing');
  return target;
}

function hubNextVisitPointerHit(): HubPointerHitTarget {
  return Object.freeze({ target: hubNextVisitTarget(), x: 24, y: 24 });
}

function hubCardPointerHit(
  slotKey: string,
  placement: 'beforeSlot' | 'afterSlot',
): HubPointerHitTarget {
  const target = hubCard(slotKey);
  const bounds = {
    bottom: 180,
    height: 120,
    left: 0,
    right: 360,
    toJSON: () => ({}),
    top: 60,
    width: 360,
    x: 0,
    y: 60,
  } as DOMRect;
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(bounds);
  return Object.freeze({
    target,
    x: 24,
    y: placement === 'beforeSlot' ? 90 : 150,
  });
}

function hubTailSlotKeys(): readonly string[] {
  return Array.from(
    hubRoster().querySelectorAll<HTMLElement>('.hub-ranked-tail [data-hub-slot-key]'),
  )
    .map((card) => card.dataset.hubSlotKey)
    .filter((slotKey): slotKey is string => slotKey !== undefined);
}

function startHubPointerDrag(
  sourceSlotKey: string,
  hit: HubPointerHitTarget,
): {
  readonly board: HTMLElement;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
} {
  const board = hubRoster();
  const pointerId = 41;
  setHubPointerHitTarget(hit.target);
  fireEvent.pointerDown(hubDragHandle(sourceSlotKey), {
    button: 0,
    clientX: 12,
    clientY: 12,
    isPrimary: true,
    pointerId,
    pointerType: 'mouse',
  });
  fireEvent.pointerMove(board, {
    clientX: hit.x,
    clientY: hit.y,
    isPrimary: true,
    pointerId,
    pointerType: 'mouse',
  });
  return { board, pointerId, x: hit.x, y: hit.y };
}

function withRetainedHubBehindMissingLink(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== 'Surface'
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((biome) => {
                  if (biome.biomeKey !== 'N' || biome.topology === null) return biome;
                  const startOccurrenceId = biome.topology.startOccurrenceId;
                  return Object.freeze({
                    ...biome,
                    topology: Object.freeze({
                      ...biome.topology,
                      decisions: Object.freeze(
                        biome.topology.decisions.filter(
                          (decision) =>
                            !(
                              decision.kind === 'exit' &&
                              decision.source.kind === 'occurrence' &&
                              decision.source.occurrenceId === startOccurrenceId
                            ),
                        ),
                      ),
                    }),
                  });
                }),
              ),
            }),
      ),
    ),
  });
}

describe('HubDecisionWorkbench', () => {
  it('separates participation, visit/reward editing, and the completed exit into occurrence-style tabs', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());

    const overview = screen.getByRole('tab', { name: 'Hub Overview' });
    const timeline = screen.getByRole('tab', { name: 'Hub Timeline' });
    const exit = screen.getByRole('tab', { name: 'Hub Exit' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Combat 01 open' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Move Combat 01 later' })).toBeNull();
    expect(screen.getAllByLabelText('Reward').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open this room to edit its reward.')).toHaveLength(17);

    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(timeline.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('checkbox', { name: 'Combat 01 open' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Move Combat 01 later' })).toBeTruthy();
    expect(screen.queryByLabelText('Reward')).toBeNull();
    expect(screen.getByLabelText('Combat 01 reward preview').textContent).toContain(
      'Big Max Health',
    );

    fireEvent.keyDown(timeline, { key: 'End' });
    expect(exit.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Continue to Preboss')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Move Combat 01 later' })).toBeNull();
  });

  it('renders one ranked open-room board without the superseded visit timeline', () => {
    renderStaticHubDecisionWorkbench(representativeHubProject);

    selectHubTab('Hub Timeline');

    expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hub visit order' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ranked Ephyra rooms' })).toBeNull();
    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(9);
    expect(document.querySelector('.hub-visit-timeline')).toBeNull();
    expect(document.querySelectorAll('.hub-visit-row')).toHaveLength(0);
    expect(screen.queryByText('Pylon visit order')).toBeNull();
    expect(screen.queryByText('Clear from here')).toBeNull();
    expect(screen.queryByRole('button', { name: /Clear visits from Visit/ })).toBeNull();
    expect(
      screen.getByRole('group', {
        name: 'Visit order controls for Combat 05; Planned visit 1 of 6',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('group', {
        name: /Visit order controls for Combat 01; Remaining room \d+ of \d+; not in visit order/,
      }),
    ).toBeTruthy();
  });

  it('renders every open room exactly once across the authored prefix and declaration tail', () => {
    renderStaticHubDecisionWorkbench(representativeHubProject);
    selectHubTab('Hub Timeline');

    const closedDisclosure = document.querySelector<HTMLDetailsElement>(
      '.hub-closed-room-disclosure',
    );
    const openCards = Array.from(document.querySelectorAll<HTMLElement>('.hub-open-room-card'));
    const prefix = document.querySelector<HTMLElement>('.hub-ranked-visit-prefix');
    const tail = document.querySelector<HTMLElement>('.hub-ranked-tail');

    expect(openCards).toHaveLength(9);
    expect(prefix?.querySelectorAll('.hub-open-room-card')).toHaveLength(6);
    expect(tail?.querySelectorAll('.hub-open-room-card')).toHaveLength(3);
    expect(new Set(openCards.map((card) => card.dataset.hubSlotKey)).size).toBe(openCards.length);
    expect(screen.getByText('Visit order ends here')).toBeTruthy();
    expect(screen.getByText('6 rooms traverse the pylons')).toBeTruthy();
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(0);
    expect(closedDisclosure).toBeNull();
    expect(screen.getByText('9 open · 9–10 required')).toBeTruthy();
    expect(screen.getByText('6 of 6 planned')).toBeTruthy();
    expect(document.querySelector('.hub-slot-grid')).toBeNull();
    expect(screen.queryByText(/^Door \d/)).toBeNull();
    const firstVisit = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const firstRemaining = screen.getByRole('article', { name: 'Combat 01 Hub room' });

    expect(within(firstVisit).queryByText('Visit 1')).toBeNull();
    expect(within(firstVisit).getByText('Entered')).toBeTruthy();
    expect(within(firstRemaining).queryByText('Not in visit order')).toBeNull();

    for (const card of document.querySelectorAll<HTMLElement>('.hub-open-room-card')) {
      const handle = card.querySelector<HTMLElement>('[data-hub-roster-drag-handle]');
      expect(card.querySelector('.hub-roster-primary')).not.toBeNull();
      expect(card.querySelector('.hub-roster-primary + .hub-main-reward')).not.toBeNull();
      expect(handle?.getAttribute('aria-hidden')).toBe('true');
      expect(handle?.hasAttribute('tabindex')).toBe(false);
      expect(card.querySelector('.hub-main-reward')).not.toBeNull();
      expect(card.textContent).not.toContain('Evaluated');
    }
  });

  it('keeps unplanned visit owners in one compact next-visit target', () => {
    const project = twoVisitHubProject();
    renderStaticHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const prefix = document.querySelector<HTMLElement>('.hub-ranked-visit-prefix');
    const tail = document.querySelector<HTMLElement>('.hub-ranked-tail');

    expect(screen.getByText('2 of 6 planned')).toBeTruthy();
    expect(prefix?.querySelectorAll('.hub-open-room-card')).toHaveLength(2);
    expect(prefix?.querySelectorAll('.hub-empty-visit-position')).toHaveLength(0);
    expect(tail?.querySelectorAll('.hub-open-room-card')).toHaveLength(7);
    const nextVisitTarget = hubNextVisitTarget();
    expect(nextVisitTarget.classList).toContain('hub-next-visit-target');
    expect(nextVisitTarget.getAttribute('aria-label')).toBe(
      'Visit 3 is not planned; Visits 4–6 remain unplanned.',
    );
    expect(nextVisitTarget.textContent).toContain('Drop a room here for Visit 3');
    expect(nextVisitTarget.textContent).toContain('Visits 4–6 remain unplanned');
    expect(screen.getByRole('article', { name: 'Combat 05 Hub room' }).dataset.visitPosition).toBe(
      '1',
    );
    expect(
      screen.getByRole('article', { name: 'Satyr Champion Hub room' }).dataset.visitPosition,
    ).toBe('2');

    for (const visitPosition of [3, 4, 5, 6]) {
      const marker = nextVisitTarget.querySelector<HTMLElement>(
        `[data-semantic-owner='${semanticAddressKey(
          createHubVisitAddress(nBiome, 'hub', visitPosition),
        )}']`,
      );
      expect(marker).not.toBeNull();
      expect(marker?.closest('.hub-next-visit-target')).toBe(nextVisitTarget);
    }
  });

  it('keeps keyboard membership selection in its source batch after the Hub is authored', async () => {
    let project = loadSurfaceNEntryFrontierProject();
    project = applyProjectCommand(project, catalog, {
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.preHub,
      }),
      hub: createHubDecisionAddress(nBiome, 'hub'),
      kind: 'ReplaceWithHubDecision',
    });
    const view = renderHubDecisionWorkbench(project);
    await waitFor(() => expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26));
    const firstClosed = screen.getByLabelText('Combat 01 open');
    act(() => firstClosed.focus());
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat01',
        ),
      ).toBe(true),
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Combat 01 open'));
  });

  it('scopes a provisional opening identity to activation, cancellation, and projection replacement', async () => {
    const project = loadSurfaceNProject();
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const allocatedThrough = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        createOccurrenceId(`hub-opening-attempt-${index + 1}`),
      );
    const application = createApplication({
      allocateOccurrenceId: () => {
        const occurrenceId = createOccurrenceId(`hub-opening-attempt-${allocated.length + 1}`);
        allocated.push(occurrenceId);
        return occurrenceId;
      },
    });
    renderHubDecisionWorkbench(project, 'Surface', 'N', application);
    const opening = screen.getByRole('checkbox', { name: 'Combat 04 open' });

    expect(allocated).toEqual([]);
    act(() => opening.focus());
    expect(allocated).toEqual([]);
    fireEvent.pointerDown(opening);
    expect(allocated).toEqual(allocatedThrough(3));
    expect(opening.closest('label')?.dataset.openingAttempt).toBe('active');
    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceFearVowRank',
          route: createRouteAddress('Surface'),
          vowKey: 'EnemyDamageShrineUpgrade',
          rank: 1,
        }),
      ),
    );
    await waitFor(() => expect(opening.closest('label')?.dataset.openingAttempt).toBeUndefined());
    fireEvent.pointerDown(opening);
    expect(allocated).toEqual(allocatedThrough(6));
    fireEvent.blur(opening);
    expect(opening.closest('label')?.dataset.openingAttempt).toBeUndefined();

    fireEvent.pointerDown(opening);
    expect(allocated).toEqual(allocatedThrough(9));
    const historyBeforeOpen = application.store.getState().projectWorkspace.history.past.length;
    fireEvent.click(opening);
    await waitFor(() =>
      expect(nHubOccurrence(application, 'combat04').occurrenceId).toBe(
        createOccurrenceId('hub-opening-attempt-7'),
      ),
    );
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeOpen + 1,
    );
    expect(application.store.getState().editorSession.focusedSemanticOwner).toBeNull();

    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    const restored = await screen.findByRole('checkbox', { name: 'Combat 04 open' });
    expect((restored as HTMLInputElement).checked).toBe(false);
    fireEvent.pointerDown(restored);
    expect(allocated).toEqual(allocatedThrough(12));
    fireEvent.blur(restored);
  });

  it('keeps keyboard opening in the closed-room batch at the maximum', async () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const opening = screen.getByRole('checkbox', { name: 'Combat 04 open' });
    act(() => opening.focus());
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(document.activeElement).toBe(
      within(openedCard).getByRole('checkbox', { name: 'Combat 04 open' }),
    );
  });

  it('opens, edits, and closes an unvisited room through its compact card', async () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const closedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    const open = within(closedCard).getByRole('checkbox', { name: 'Combat 04 open' });
    const overviewSlotOrder = (): readonly string[] =>
      Array.from(
        screen
          .getByRole('group', { name: 'Hub room set' })
          .querySelectorAll<HTMLElement>('[data-hub-slot-key]'),
      ).flatMap((card) => (card.dataset.hubSlotKey === undefined ? [] : [card.dataset.hubSlotKey]));
    const slotOrderBefore = overviewSlotOrder();
    expect(closedCard.querySelector('[data-assessment]')).toBeNull();
    expect(within(closedCard).getByText('Open this room to edit its reward.')).toBeTruthy();

    await view.user.pointer({ keys: '[MouseLeft]', target: open });
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    expect(overviewSlotOrder()).toEqual(slotOrderBefore);
    expect(within(openedCard).getByLabelText('Reward')).toBeTruthy();
    expect(within(openedCard).queryByText('Open this room to edit its reward.')).toBeNull();
    expect(within(openedCard).queryByText(/Closing this slot removes/)).toBeNull();
    expect(document.activeElement).not.toBe(openedCard);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(screen.getByText('10 open · 9–10 required')).toBeTruthy();
    const beforeReward = nHubOccurrence(view.application, 'combat04').state;
    await view.user.click(within(openedCard).getByLabelText('Reward'));
    const rewardTypes = within(
      await screen.findByRole('listbox', {}, { timeout: 5_000 }),
    ).getAllByRole('option');
    const replacementType =
      rewardTypes.find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      ) ??
      rewardTypes.find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') === 'true' &&
          option.textContent?.includes('Boon') === true,
      );
    if (replacementType === undefined) {
      throw new Error('Combat 04 has no editable alternative reward type');
    }
    await view.user.click(replacementType);
    if (replacementType.textContent?.includes('Boon')) {
      const boonSources = within(await screen.findByRole('listbox')).getAllByRole('option');
      const replacementSource = boonSources.find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      );
      if (replacementSource === undefined) {
        throw new Error('Combat 04 has no editable alternative Boon source');
      }
      await view.user.click(replacementSource);
    }
    await waitFor(() =>
      expect(nHubOccurrence(view.application, 'combat04').state).not.toEqual(beforeReward),
    );

    expect(
      within(openedCard).queryByRole('button', { name: 'Open details for Combat 04' }),
    ).toBeNull();

    const close = within(screen.getByRole('article', { name: 'Combat 04 Hub room' })).getByRole(
      'checkbox',
      { name: 'Combat 04 open' },
    );
    act(() => close.focus());
    const historyBeforeClose =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(false),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeClose + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Hub room set' }).contains(document.activeElement),
    ).toBe(true);
    expect(screen.getByText('9 open · 9–10 required')).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Combat 04 Hub room' })).getByText(
        'Open this room to edit its reward.',
      ),
    ).toBeTruthy();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );
  }, 10_000);

  it('loads a ten-door invalid board picker without offering a singleton already on a peer', async () => {
    const view = renderHubDecisionWorkbench(invalidTenDoorHubProject);
    const editedCard = screen.getByRole('article', { name: 'Combat 09 Hub room' });

    await view.user.click(within(editedCard).getByLabelText('Reward'));

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: /Big Max Health/ })).toBeNull();
  });

  it('offers direct Room details for every visited Hub room workbench', async () => {
    const project = hubRoomDetailProject();
    const view = renderHubDecisionWorkbench(project);

    const sideRoomCombat = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const miniboss = screen.getByRole('article', { name: 'Satyr Champion Hub room' });
    const ordinaryCombat = screen.getByRole('article', { name: 'Combat 07 Hub room' });
    const unvisitedCombat = screen.getByRole('article', { name: 'Combat 10 Hub room' });
    const detail = within(sideRoomCombat).getByRole('button', {
      name: 'Open details for Combat 05',
    });
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const ordinarySlot = hub.slots.find((slot) => slot.hubSlotKey === 'combat07');
    if (ordinarySlot?.room === undefined) throw new Error('Combat 07 Hub room is missing');

    expect(detail.closest('.hub-slot-meta')).not.toBeNull();
    expect(sideRoomCombat.querySelector('.hub-main-reward')?.nextElementSibling).not.toBe(detail);
    expect(unvisitedCombat.querySelector('.hub-slot-meta')).not.toBeNull();
    expect(ordinarySlot.visited).toBe(true);
    expect(ordinarySlot.room.encounterPhases).toEqual(
      expect.arrayContaining([expect.objectContaining({ customizable: true })]),
    );
    expect(ordinarySlot.room.workbench).toMatchObject({
      kind: 'standard',
      encounterPhases: expect.arrayContaining([expect.objectContaining({ customizable: true })]),
    });
    expect(
      within(miniboss).getByRole('button', { name: 'Open details for Satyr Champion' }),
    ).toBeTruthy();
    expect(
      within(ordinaryCombat).getByRole('button', { name: 'Open details for Combat 07' }),
    ).toBeTruthy();
    expect(within(unvisitedCombat).queryByRole('button', { name: /Open details/ })).toBeNull();
    await view.user.click(detail);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, nHubOccurrence(view.application, 'combat05').occurrenceId),
    );
  });

  it('keeps a visited Medea encounter trait offer out of the Hub room card', () => {
    const project = loadSurfaceNStoryBoardProject();
    renderHubDecisionWorkbench(project);
    const story = screen.getByRole('article', { name: 'Medea Hub room' });

    expect(within(story).queryByRole('button', { name: /^Edit Trait:/ })).toBeNull();
    expect(within(story).getByRole('button', { name: 'Open details for Medea' })).toBeTruthy();
  });

  it('keeps exact closed-slot focus visible in the complete Overview set without authoring history', () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubSlotAddress(nBiome, 'hub', 'combat04')),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('article', { name: 'Combat 04 Hub room' }).dataset.open).toBe('false');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
  });

  it('keeps the board-owned reward as the exact reward focus destination', () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const combatCard = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const rewardOwner = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));

    expect(document.querySelector('.hub-visit-timeline')).toBeNull();
    expect(combatCard.dataset.focusedMainReward).toBeUndefined();

    act(() => view.application.store.dispatch(semanticOwnerFocused(rewardOwner)));

    expect(combatCard.dataset.focusedMainReward).toBe('true');
    expect(
      combatCard.querySelector('.hub-main-reward')?.getAttribute('data-hub-main-reward-owner'),
    ).toBe(semanticAddressKey(rewardOwner));
    expect(document.activeElement).toBe(within(combatCard).getByRole('button', { name: 'Reward' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps every positional visit marker in its exact ranked prefix card', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNOPQProject());
    selectHubTab('Hub Timeline');

    const prefixCards = Array.from(
      document.querySelectorAll<HTMLElement>('.hub-ranked-visit-prefix .hub-open-room-card'),
    );
    expect(prefixCards).toHaveLength(6);
    for (const [index, card] of prefixCards.entries()) {
      const marker = card.querySelector<HTMLElement>(
        `[data-semantic-owner='${semanticAddressKey(
          createHubVisitAddress(nBiome, 'hub', index + 1),
        )}']`,
      );
      expect(marker).not.toBeNull();
      expect(marker?.closest('.hub-open-room-card')).toBe(card);
    }
  });

  it('uses the keyboard rank fallback to dispatch one full ReplaceHubVisitOrder proposal', async () => {
    const project = twoVisitHubProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const addAsVisitThree = within(hubCard('combat01')).getByRole('button', {
      name: 'Add Combat 01 as visit 3',
    });
    act(() => addAsVisitThree.focus());
    await view.user.keyboard('{Enter}');

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat01',
      ]),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', 'combat01'],
        kind: 'ReplaceHubVisitOrder',
      }),
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(['combat05', 'miniBoss01']),
    );
  });

  it('adds and removes an open room through explicit visited-room controls', async () => {
    const project = twoVisitHubProject();
    const view = renderHubDecisionWorkbench(project);
    const add = within(hubCard('combat01')).getByRole('button', {
      name: 'Add Combat 01 to visited rooms',
    });

    await view.user.click(add);

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat01',
      ]),
    );
    const remove = within(hubCard('combat01')).getByRole('button', {
      name: 'Remove Combat 01 from visited rooms',
    });
    await waitFor(() => expect(document.activeElement).toBe(remove));

    await view.user.click(remove);

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(['combat05', 'miniBoss01']),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(hubCard('combat01')).getByRole('button', {
          name: 'Add Combat 01 to visited rooms',
        }),
      ),
    );
  });

  it('keeps a keyboard tail-only move out of semantic history and command dispatch', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const authoredBefore = [...nHubState(view.application).decision.visitOrder];
    const tailKeys = (): readonly string[] =>
      Array.from(document.querySelectorAll<HTMLElement>('.hub-ranked-tail [data-hub-slot-key]'))
        .map((card) => card.dataset.hubSlotKey)
        .filter((slotKey): slotKey is string => slotKey !== undefined);
    const tailBefore = tailKeys();
    if (tailBefore.length < 2 || tailBefore[0] === undefined || tailBefore[1] === undefined) {
      throw new Error('The complete Hub fixture must expose at least two tail rooms.');
    }

    const moveLater = within(hubCard('combat01')).getByRole('button', {
      name: 'Move Combat 01 later',
    });
    act(() => moveLater.focus());
    await view.user.keyboard('{Enter}');
    await waitFor(() =>
      expect(tailKeys()).toEqual([tailBefore[1], tailBefore[0], ...tailBefore.slice(2)]),
    );
    expect(nHubState(view.application).decision.visitOrder).toEqual(authoredBefore);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);
  });

  it('moves a room across the cutoff with one full order and preserves focus', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const moved = screen.getByRole('button', { name: 'Move Combat 01 into visit 6' });

    await view.user.click(moved);

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat02',
        'combat11',
        'combat23',
        'combat01',
      ]),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat01'],
        kind: 'ReplaceHubVisitOrder',
      }),
    );
    const movedCard = screen.getByRole('article', { name: 'Combat 01 Hub room' });
    expect(movedCard.dataset.visitPosition).toBe('6');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        movedCard.querySelector('[data-hub-rank-action="moveEarlier"]'),
      ),
    );
  });

  it('publishes a complete Hub order when a remaining room drops into the full prefix', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(
      'combat01',
      hubCardPointerHit('combat05', 'beforeSlot'),
    );

    await waitFor(() => expect(hubCard('combat01').dataset.dragging).toBe('true'));
    expect(document.querySelector('.hub-roster-drag-preview')).not.toBeNull();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);

    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat01',
        'combat05',
        'miniBoss01',
        'combat02',
        'combat11',
        'combat23',
      ]),
    );
    expect(hubCard('combat01').dataset.visitPosition).toBe('1');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat01', 'combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23'],
        kind: 'ReplaceHubVisitOrder',
      }),
    );
    expect(board.dataset.dragging).toBeUndefined();
    expect(document.querySelector('.hub-roster-drag-preview')).toBeNull();
  });

  it('keeps a tail-only roster drag out of semantic history and command dispatch', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const authoredBefore = [...nHubState(view.application).decision.visitOrder];
    const tailBefore = hubTailSlotKeys();
    const [sourceSlotKey, targetSlotKey] = tailBefore;
    if (sourceSlotKey === undefined || targetSlotKey === undefined) {
      throw new Error('The complete Hub fixture must expose two tail rooms.');
    }
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(
      sourceSlotKey,
      hubCardPointerHit(targetSlotKey, 'afterSlot'),
    );

    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(hubTailSlotKeys()).toEqual([targetSlotKey, sourceSlotKey, ...tailBefore.slice(2)]),
    );
    expect(nHubState(view.application).decision.visitOrder).toEqual(authoredBefore);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);
  });

  it('appends a tail room through the compact next-visit drop target', async () => {
    const project = twoVisitHubProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const sourceSlotKey = hubTailSlotKeys()[0];
    if (sourceSlotKey === undefined) throw new Error('partial Hub fixture has no remaining room');
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(sourceSlotKey, hubNextVisitPointerHit());

    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        sourceSlotKey,
      ]),
    );
    expect(hubCard(sourceSlotKey).dataset.visitPosition).toBe('3');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', sourceSlotKey],
        kind: 'ReplaceHubVisitOrder',
      }),
    );
  });

  it('cancels a roster drag without changing the authored or transient order', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const authoredBefore = [...nHubState(view.application).decision.visitOrder];
    const tailBefore = hubTailSlotKeys();
    dispatch.mockClear();
    const { board, pointerId } = startHubPointerDrag(
      'combat09',
      hubCardPointerHit('combat11', 'afterSlot'),
    );

    await waitFor(() => expect(hubCard('combat09').dataset.dragging).toBe('true'));
    fireEvent.pointerCancel(board, { isPrimary: true, pointerId, pointerType: 'mouse' });

    await waitFor(() => {
      expect(board.dataset.dragging).toBeUndefined();
      expect(hubCard('combat09').dataset.dragging).toBeUndefined();
      expect(document.querySelector('.hub-roster-drag-preview')).toBeNull();
    });
    expect(nHubState(view.application).decision.visitOrder).toEqual(authoredBefore);
    expect(hubTailSlotKeys()).toEqual(tailBefore);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);
  });

  it('keeps the original pointer source when a non-primary pointer begins during an active drag', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(
      'combat01',
      hubCardPointerHit('combat05', 'beforeSlot'),
    );

    await waitFor(() => expect(hubCard('combat01').dataset.dragging).toBe('true'));
    fireEvent.pointerDown(hubDragHandle('combat03'), {
      button: 0,
      clientX: 16,
      clientY: 16,
      isPrimary: false,
      pointerId: 42,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(board, {
      clientX: x,
      clientY: y,
      isPrimary: false,
      pointerId: 42,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: false,
      pointerId: 42,
      pointerType: 'touch',
    });

    expect(hubCard('combat01').dataset.dragging).toBe('true');
    expect(hubCard('combat03').dataset.dragging).toBeUndefined();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);

    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat01',
        'combat05',
        'miniBoss01',
        'combat02',
        'combat11',
        'combat23',
      ]),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
  });

  it('attempts document-flow edge scrolling while a narrow-layout roster drag remains active', async () => {
    const pageScrollRoot = document.createElement('div');
    replaceBrowserProperty(document, 'scrollingElement', pageScrollRoot);
    replaceBrowserProperty(pageScrollRoot, 'scrollHeight', 1_200);
    replaceBrowserProperty(window, 'innerHeight', 400);
    const windowScrollBy = vi.fn();
    replaceBrowserProperty(window, 'scrollBy', windowScrollBy);
    let scheduledFrame: FrameRequestCallback | undefined;
    replaceBrowserProperty(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      scheduledFrame = callback;
      return 1;
    });
    replaceBrowserProperty(window, 'cancelAnimationFrame', () => undefined);

    const project = loadSurfaceNCompleteHubFrontierProject();
    renderHubDecisionWorkbench(project);
    const board = hubRoster();
    const pointerId = 53;
    setHubPointerHitTarget(hubCardPointerHit('combat05', 'beforeSlot').target);
    fireEvent.pointerDown(hubDragHandle('combat01'), {
      button: 0,
      clientX: 12,
      clientY: 350,
      isPrimary: true,
      pointerId,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: 390,
      isPrimary: true,
      pointerId,
      pointerType: 'touch',
    });

    if (scheduledFrame === undefined) {
      throw new Error('edge drag did not schedule document-flow scrolling');
    }
    act(() => scheduledFrame?.(0));
    expect(windowScrollBy).toHaveBeenCalledWith({ top: 18 });

    fireEvent.pointerCancel(board, { isPrimary: true, pointerId, pointerType: 'touch' });
  });

  it('creates and undoes the completed-Hub handoff through its bound intent', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Exit');
    const handoff = document.querySelector<HTMLElement>(
      '[data-presentation="completedHubHandoff"]',
    );
    if (handoff === null) throw new Error('completed Hub handoff control is missing');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(within(handoff).getByRole('button'));
    const owner = createExitDecisionAddress(nBiome, {
      decisionKey: 'hub',
      kind: 'hubDecision',
    });
    await waitFor(() =>
      expect(
        nHubState(view.application).topology.decisions.some(
          (decision) =>
            decision.kind === 'exit' &&
            decision.source.kind === 'hubDecision' &&
            decision.source.decisionKey === 'hub',
        ),
      ).toBe(true),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
  });

  it('keeps ranked cards and move controls visible at an invalid authored boundary', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat05', 'miniBoss01', 'combat02'],
      kind: 'ReplaceHubVisitOrder',
    });
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');

    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(9);
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const invalidRewardMarker = screen
      .getByRole('article', { name: 'Combat 10 Hub room' })
      .querySelector<HTMLElement>(
        `[data-semantic-owner='${semanticAddressKey(
          createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
        )}']`,
      );
    expect(invalidRewardMarker?.dataset.hasFindings).toBe('true');
    expect(document.querySelectorAll('.hub-ranked-visit-prefix .hub-open-room-card')).toHaveLength(
      3,
    );
    expect(document.querySelectorAll('.hub-empty-visit-position')).toHaveLength(0);
    const nextVisitTarget = hubNextVisitTarget();
    expect(nextVisitTarget.getAttribute('aria-label')).toBe(
      'Visit 4 is not planned; Visits 5–6 remain unplanned.',
    );
    for (const visitPosition of [4, 5, 6]) {
      expect(
        nextVisitTarget.querySelector(
          `[data-semantic-owner='${semanticAddressKey(
            createHubVisitAddress(nBiome, 'hub', visitPosition),
          )}']`,
        ),
      ).not.toBeNull();
    }
    expect(document.querySelectorAll('.hub-ranked-tail .hub-open-room-card')).toHaveLength(6);
    expect(document.querySelector('.hub-visit-timeline')).toBeNull();
    const firstTail = document.querySelector<HTMLElement>('.hub-ranked-tail .hub-open-room-card');
    if (firstTail === null) throw new Error('invalid Hub fixture has no remaining room');
    expect(within(firstTail).getByRole('button', { name: /^Add .+ as visit 4$/ })).toBeTruthy();
  });

  it('uses the rank for authored selection and reserves Entered for evaluated entry', () => {
    const entered = renderStaticHubDecisionWorkbench(loadSurfaceNOPQProject());
    const enteredCard = within(entered.container).getByRole('article', {
      name: 'Combat 05 Hub room',
    });
    expect(enteredCard.dataset.visitPosition).toBe('1');
    expect(within(enteredCard).queryByText('Visit 1')).toBeNull();
    expect(within(enteredCard).getByText('Entered')).toBeTruthy();
    cleanup();

    const view = renderHubDecisionWorkbench(
      withRetainedHubBehindMissingLink(loadSurfaceNOPQProject()),
    );
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const laterVisit = hub.slots.find((slot) => slot.hubSlotKey === 'combat02');
    if (laterVisit?.room === undefined) throw new Error('Combat 02 Hub room is missing');

    expect(laterVisit.visited).toBe(true);
    expect(laterVisit.room.detailsActive).toBe(true);
    expect(laterVisit.room.entered).toBe(false);
    const retainedCard = screen.getByRole('article', { name: 'Combat 02 Hub room' });
    expect(retainedCard.dataset.visitPosition).toBe('3');
    expect(within(retainedCard).queryByText('Visit 3')).toBeNull();
    expect(within(retainedCard).queryByText('Entered')).toBeNull();
    expect(
      within(retainedCard).getByRole('button', {
        name: 'Open details for Combat 02',
      }),
    ).toBeTruthy();
  });
});
