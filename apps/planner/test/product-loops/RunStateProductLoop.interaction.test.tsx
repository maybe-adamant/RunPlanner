// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNOPQProject,
} from '@run-planner/test-fixtures/surface';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(cleanup);

const nRunStateEvents: ApplicationEvaluationEvent[] = [];
let nRunStateApplication: PlannerApplication;
let nRunStateTitles: readonly string[];
const fRunStateEvents: ApplicationEvaluationEvent[] = [];
let fRunStateApplication: PlannerApplication;
let fRunStateTitles: readonly string[];

beforeAll(function prepareFRunStateApplication() {
  fRunStateApplication = createApplication({
    observeEvaluationWork: (event) => fRunStateEvents.push(event),
  });
  fRunStateApplication.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
  fRunStateTitles = projectedRunStateTitles(fRunStateApplication, 'Underworld', 'F');
  fRunStateEvents.length = 0;
});

beforeAll(function prepareNRunStateApplication() {
  nRunStateApplication = createApplication({
    observeEvaluationWork: (event) => nRunStateEvents.push(event),
  });
  nRunStateApplication.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));
  nRunStateTitles = projectedRunStateTitles(nRunStateApplication, 'Surface', 'N');
  nRunStateEvents.length = 0;
});

afterAll(function disposeRunStateApplications() {
  fRunStateApplication.dispose();
  nRunStateApplication.dispose();
});

function expectNoEvaluationWork(
  events: readonly ApplicationEvaluationEvent[],
  label: string,
): void {
  expect(events, `${label} must read the already-published workspace product`).toHaveLength(0);
}

function projectedRunStateTitles(
  application: PlannerApplication,
  routeKey: string,
  biomeKey: string,
): readonly string[] {
  const workspace = application.selectStructuredWorkspace(application.store.getState());
  return [...workspace.runStateLaunchers.values()]
    .filter(
      (launcher) => launcher.owner.routeKey === routeKey && launcher.owner.biomeKey === biomeKey,
    )
    .map((launcher) => launcher.title);
}

describe('Run State product loop', () => {
  it('opens F at its room-entry and pre-exit lifecycle seams without new evaluation work', async () => {
    const application = fRunStateApplication;
    const events = fRunStateEvents;
    const titles = fRunStateTitles;
    expect(titles).toContain('the first action in Opening 01');
    expect(titles).toContain('exiting Opening 01');
    expect(titles).not.toContain('Decision 1');
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    await view.user.click(screen.getByRole('button', { name: /^OpeningEvaluated/ }));
    await view.user.click(screen.getByRole('tab', { name: 'Room Actions' }));
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    const workbench = actions.closest<HTMLElement>('.biome-occurrence-workbench');
    if (workbench === null) throw new Error('Opening room workbench is missing');
    const launcher = within(workbench).getByRole('button', { name: 'Run State' });
    expect(launcher.closest('.decision-heading')).toBeNull();
    expect(launcher.closest('.biome-rail')).toBeNull();

    events.length = 0;
    await view.user.click(launcher);
    const sheet = screen.getByRole('region', {
      name: 'State before the first action in Opening 01',
    });
    expect(within(sheet).getByRole('heading', { name: 'Gods in pool' })).toBeTruthy();
    expect(within(sheet).getByRole('heading', { name: 'More Info' })).toBeTruthy();
    expect(within(sheet).getByText('Counters')).toBeTruthy();
    expect(within(sheet).getByText('Reward Bags')).toBeTruthy();
    await view.user.click(within(sheet).getByRole('button', { name: 'Close Run State' }));
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expectNoEvaluationWork(events, 'F Run State open/close');

    await view.user.click(screen.getByRole('tab', { name: 'Room Doors' }));
    const exitLauncher = screen.getByRole('button', { name: 'Run State' });
    await view.user.click(exitLauncher);
    expect(screen.getByRole('region', { name: 'State before exiting Opening 01' })).toBeTruthy();
    await view.user.keyboard('{Escape}');
    expectNoEvaluationWork(events, 'F pre-exit Run State open/close');

    await view.user.click(exitLauncher);
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expectNoEvaluationWork(events, 'F Run State route reconciliation');
  });

  it('keeps N Run State on the one outer Hub without placing it on inner visits', async () => {
    const application = nRunStateApplication;
    const events = nRunStateEvents;
    expect(nRunStateTitles).toContain('Hub');
    expect(nRunStateTitles).toContain('Preboss');
    expect(nRunStateTitles).not.toContain('Decision 1');
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(screen.getByRole('button', { name: /Hub.*visits/ }));
    const hub = screen.getByRole('region', { name: 'Ephyra Hub' });
    const launcher = within(hub).getByRole('button', { name: 'Run State' });
    expect(within(hub).getAllByRole('button', { name: 'Run State' })).toHaveLength(1);
    expect(hub.querySelectorAll('.hub-open-room-card [data-run-state-launcher]')).toHaveLength(0);

    events.length = 0;
    await view.user.click(launcher);
    const sheet = screen.getByRole('region', { name: 'State before Hub' });
    expect(within(sheet).getByText(/Major Reward \(RunProgress\)/)).toBeTruthy();
    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expectNoEvaluationWork(events, 'N Hub Run State open/close');

    await view.user.click(screen.getByRole('button', { name: /^PrebossEvaluated/ }));
    const prebossWorkbench = document.querySelector<HTMLElement>('.biome-occurrence-workbench');
    if (prebossWorkbench === null) throw new Error('Preboss room workbench is missing');
    const prebossLauncher = within(prebossWorkbench)
      .getAllByRole('button', { name: 'Run State' })
      .find((button) => button.dataset.runStateLauncher?.includes('roomRunStateCheckpoint'));
    if (prebossLauncher === undefined) throw new Error('Preboss Run State is missing');
    expect(prebossLauncher.closest('.biome-occurrence-workbench')).not.toBeNull();
    expect(prebossLauncher.closest('.biome-rail')).toBeNull();
    events.length = 0;
    await view.user.click(prebossLauncher);
    expect(
      screen.getByRole('region', { name: 'State before the first action in Preboss' }),
    ).toBeTruthy();
    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(prebossLauncher);
    expectNoEvaluationWork(events, 'N Preboss Run State open/close');
  });

  it('retains the visible completed-Hub Preboss handoff as one outer transition', async () => {
    const application = createApplication();
    const project = loadSurfaceNCompleteHubFrontierProject();
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(screen.getByRole('button', { name: /Hub.*visits/ }));
    const handoff = document.querySelector<HTMLElement>(
      '[data-presentation="completedHubHandoff"]',
    );
    if (handoff === null) throw new Error('completed Hub Preboss handoff is missing');
    expect(within(handoff).getByText('Continue to Preboss')).toBeTruthy();
    expect(within(handoff).getByText('All required Hub visits are complete.')).toBeTruthy();
    application.dispose();
  });
});
