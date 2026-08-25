import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

import type { PlannerApplication } from '@planner/composition/createApplication';
import {
  loadSurfaceNPartialHubProject,
  loadSurfaceNProject,
  loadSurfaceNTenOpenInvalidProject,
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceIdsBySlot,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';

const browserPropertyRestorers: (() => void)[] = [];

export let representativeHubProject: ProjectDocument;
export let invalidTenDoorHubProject: ProjectDocument;

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

export function replaceBrowserProperty(
  target: object,
  property: PropertyKey,
  value: unknown,
): void {
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

export function nHubState(application: PlannerApplication) {
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

export function nHubOccurrence(application: PlannerApplication, hubSlotKey: string) {
  const { decision, topology } = nHubState(application);
  const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  if (target === undefined) throw new Error(`N Hub slot ${hubSlotKey} is not open`);
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === target.occurrenceId,
  );
  if (occurrence === undefined) throw new Error(`N Hub slot ${hubSlotKey} has no occurrence`);
  return occurrence;
}

export function twoVisitHubProject(): ProjectDocument {
  return applyProjectCommand(loadSurfaceNPartialHubProject(), catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: ['combat05', 'miniBoss01'],
  });
}

export function hubRoomDetailProject(): ProjectDocument {
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

export function selectHubTab(name: 'Hub Overview' | 'Hub Timeline' | 'Hub Exit'): void {
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab);
}

export function hubRoster(): HTMLElement {
  selectHubTab('Hub Timeline');
  return screen.getByRole('group', { name: 'Ranked open Ephyra rooms' });
}

export function hubCard(slotKey: string): HTMLElement {
  const card = hubRoster().querySelector<HTMLElement>(`[data-hub-slot-key="${slotKey}"]`);
  if (card === null) throw new Error(`Hub roster card ${slotKey} is missing`);
  return card;
}

export function hubDragHandle(slotKey: string): HTMLElement {
  const handle = hubCard(slotKey).querySelector<HTMLElement>('[data-hub-roster-drag-handle]');
  if (handle === null) throw new Error(`Hub roster drag handle ${slotKey} is missing`);
  return handle;
}

export function setHubPointerHitTarget(target: HTMLElement): void {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => target,
  });
}

export interface HubPointerHitTarget {
  readonly target: HTMLElement;
  readonly x: number;
  readonly y: number;
}

export function hubNextVisitTarget(): HTMLElement {
  const target = hubRoster().querySelector<HTMLElement>(
    '[data-hub-roster-drop-target="nextVisit"]',
  );
  if (target === null) throw new Error('Hub roster next-visit target is missing');
  return target;
}

export function hubNextVisitPointerHit(): HubPointerHitTarget {
  return Object.freeze({ target: hubNextVisitTarget(), x: 24, y: 24 });
}

export function hubCardPointerHit(
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

export function hubTailSlotKeys(): readonly string[] {
  return Array.from(
    hubRoster().querySelectorAll<HTMLElement>('.hub-ranked-tail [data-hub-slot-key]'),
  )
    .map((card) => card.dataset.hubSlotKey)
    .filter((slotKey): slotKey is string => slotKey !== undefined);
}

export function startHubPointerDrag(
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

export function withRetainedHubBehindMissingLink(project: ProjectDocument): ProjectDocument {
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
