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
  createProjectDocument,
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
  appendCompleteN,
  appendNEntry,
  createRepresentativeNProject,
  createRepresentativeNOPQProject,
  nBiome,
  nOpenSlotKeys,
  nOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  renderHubDecisionWorkbench,
  renderStaticHubDecisionWorkbench,
  workspaceBiome,
} from '@planner-test/support/biome-workbench';

const browserPropertyRestorers: (() => void)[] = [];
let representativeHubProject: ProjectDocument;
let invalidTenDoorHubProject: ProjectDocument;

beforeAll(() => {
  representativeHubProject = createRepresentativeNOPQProject();
  invalidTenDoorHubProject = applyProjectCommand(
    createRepresentativeNProject({
      openSlotKeys: [...nOpenSlotKeys, 'combat04'],
    }),
    catalog,
    {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat04')),
      value: { rewardType: 'MaxHealthDropBig' },
    },
  );
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

function hubRoster(): HTMLElement {
  return screen.getByRole('group', { name: 'Ranked open Ephyra rooms' });
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
  it('renders one ranked open-room board without the superseded visit timeline', () => {
    renderStaticHubDecisionWorkbench(representativeHubProject);

    expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hub traversal' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ranked Ephyra rooms' })).toBeNull();
    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26);
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
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(17);
    expect(closedDisclosure?.open).toBe(false);
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
    for (const option of document.querySelectorAll<HTMLElement>('.hub-closed-room-option')) {
      expect(option.querySelector('.hub-main-reward')).toBeNull();
      expect(option.querySelector('.semantic-focus-link')).toBeNull();
      expect(option.textContent).not.toContain('This room is closed.');
    }
  });

  it('keeps unplanned visit owners in one compact next-visit target', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-partial-ranked-board',
        name: 'Hub partial ranked board',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: ['combat05', 'miniBoss01'] },
    );
    renderStaticHubDecisionWorkbench(project);
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
    let project = appendNEntry(
      createProjectDocument(catalog, {
        projectId: 'hub-workbench-membership',
        name: 'Hub workbench membership',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
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
    const disclosure = document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure');
    const summary = disclosure?.querySelector<HTMLElement>('summary');
    if (summary === null || summary === undefined) {
      throw new Error('An empty authored Hub must render its closed-room disclosure.');
    }
    await view.user.click(summary);
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
    expect(document.activeElement).toBe(screen.getByLabelText('Combat 02 open'));
  });

  it('scopes a provisional opening identity to activation, cancellation, and projection replacement', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-opening-attempt-lifecycle',
        name: 'Hub opening attempt lifecycle',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
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
          kind: 'RenameProject',
          name: 'Hub opening attempt replacement',
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-keyboard-open-continuity',
        name: 'Hub keyboard open continuity',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const disclosure = document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure');
    const summary = disclosure?.querySelector<HTMLElement>('summary');
    if (
      disclosure === null ||
      disclosure === undefined ||
      summary === null ||
      summary === undefined
    ) {
      throw new Error('The authored Hub must render its closed-room disclosure.');
    }
    await view.user.click(summary);
    expect(disclosure.open).toBe(true);

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
    expect(document.activeElement).toBe(summary);
    expect(document.activeElement).not.toBe(
      within(openedCard).getByRole('checkbox', { name: 'Combat 04 open' }),
    );
    expect(disclosure.open).toBe(true);
  });

  it('opens, edits, and closes an unvisited room through its compact card', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-compact-unvisited-room',
        name: 'Hub compact unvisited room',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const closedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    const open = within(closedCard).getByRole('checkbox', { name: 'Combat 04 open' });
    expect(closedCard.querySelector('[data-assessment]')).toBeNull();

    await view.user.pointer({ keys: '[MouseLeft]', target: open });
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    expect(within(openedCard).queryByText(/Closing this slot removes/)).toBeNull();
    expect(document.activeElement).not.toBe(
      within(openedCard).getByRole('checkbox', { name: 'Combat 04 open' }),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(screen.getByText('10 open · 9–10 required')).toBeTruthy();
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(16);
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
    expect(document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure')?.open).toBe(
      false,
    );
    expect(
      screen
        .getByRole('group', { name: 'Ranked open Ephyra rooms' })
        .contains(document.activeElement),
    ).toBe(true);
    expect(screen.getByText('9 open · 9–10 required')).toBeTruthy();
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(17);
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-room-detail-boundary',
        name: 'Hub room detail boundary',
        configuredBiomeCounts: { Surface: 1 },
      }),
      {
        openSlotKeys: [
          'combat11',
          'combat10',
          'combat09',
          'combat07',
          'combat05',
          'combat03',
          'combat02',
          'combat01',
          'miniBoss01',
        ],
        visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat07', 'combat09'],
      },
    );
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-medea-trait-offer',
        name: 'Hub Medea trait offer',
        configuredBiomeCounts: { Surface: 1 },
      }),
      {
        openSlotKeys: [
          'combat11',
          'combat10',
          'combat09',
          'combat05',
          'story',
          'combat02',
          'combat01',
          'miniBoss01',
          'combat23',
        ],
        visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
      },
    );
    renderHubDecisionWorkbench(project);
    const story = screen.getByRole('article', { name: 'Medea Hub room' });

    expect(within(story).queryByRole('button', { name: /^Edit Trait:/ })).toBeNull();
    expect(within(story).getByRole('button', { name: 'Open details for Medea' })).toBeTruthy();
  });

  it('reveals the closed-room disclosure for exact closed-slot focus without authoring history', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-closed-focus-reveal',
        name: 'Hub closed focus reveal',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const disclosure = document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure');
    if (disclosure === null) throw new Error('closed Hub rooms disclosure is missing');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    expect(disclosure.open).toBe(false);
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubSlotAddress(nBiome, 'hub', 'combat04')),
      ),
    );
    await waitFor(() => expect(disclosure.open).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );

    await view.user.click(within(disclosure).getByText('Closed rooms (17)'));
    expect(disclosure.open).toBe(false);
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({ kind: 'RenameProject', name: 'Hub native disclosure' }),
      ),
    );
    await waitFor(() =>
      expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
        historyBefore + 1,
      ),
    );
    expect(disclosure.open).toBe(false);
  });

  it('keeps the board-owned reward as the exact reward focus destination', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-visit-reward-context',
        name: 'Hub visit reward context',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
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
    renderStaticHubDecisionWorkbench(createRepresentativeNOPQProject());

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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-visit-commands',
        name: 'Hub visit commands',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: ['combat05', 'miniBoss01'] },
    );
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-visit-membership-controls',
        name: 'Hub visit membership controls',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: ['combat05', 'miniBoss01'] },
    );
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-transient-tail-order',
        name: 'Hub transient tail order',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const view = renderHubDecisionWorkbench(project);
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-cross-cutoff-order',
        name: 'Hub cross cutoff order',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const view = renderHubDecisionWorkbench(project);
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-pointer-semantic-reorder',
        name: 'Hub pointer semantic reorder',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const view = renderHubDecisionWorkbench(project);
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-pointer-transient-tail',
        name: 'Hub pointer transient tail',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const view = renderHubDecisionWorkbench(project);
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-pointer-next-visit',
        name: 'Hub pointer next visit',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: ['combat05', 'miniBoss01'] },
    );
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-pointer-cancel',
        name: 'Hub pointer cancel',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-pointer-primary-ownership',
        name: 'Hub pointer primary ownership',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
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

    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-pointer-document-scroll',
        name: 'Hub pointer document scroll',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
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
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-completed-handoff',
        name: 'Hub completed handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const view = renderHubDecisionWorkbench(project);
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
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
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

    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26);
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
    expect(
      document.querySelector(".hub-closed-room-option [data-assessment='unassessed']"),
    ).not.toBeNull();
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
    const entered = renderStaticHubDecisionWorkbench(createRepresentativeNOPQProject());
    const enteredCard = within(entered.container).getByRole('article', {
      name: 'Combat 05 Hub room',
    });
    expect(enteredCard.dataset.visitPosition).toBe('1');
    expect(within(enteredCard).queryByText('Visit 1')).toBeNull();
    expect(within(enteredCard).getByText('Entered')).toBeTruthy();
    cleanup();

    const view = renderHubDecisionWorkbench(
      withRetainedHubBehindMissingLink(createRepresentativeNOPQProject()),
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
