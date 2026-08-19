// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { createProjectDocument } from '@run-planner/engine/authored-project';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  appendCompleteN,
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
} from '@run-planner/test-fixtures';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(cleanup);

const nRunStateEvents: ApplicationEvaluationEvent[] = [];
let nRunStateApplication: PlannerApplication;
let nRunStateTitles: readonly string[];

beforeAll(() => {
  nRunStateApplication = createApplication({
    observeEvaluationWork: (event) => nRunStateEvents.push(event),
  });
  nRunStateApplication.store.dispatch(authoredProjectReplaced(createRepresentativeNOPQProject()));
  nRunStateTitles = projectedRunStateTitles(nRunStateApplication, 'Surface', 'N');
});

afterAll(() => nRunStateApplication.dispose());

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
  const biome = workspace.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.owner.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} workspace is missing`);
  return biome.nodes.flatMap((node) =>
    'runState' in node && node.runState ? [node.runState.title] : [],
  );
}

describe('Run State product loop', () => {
  it('opens F from its outer-decision workbench and closes without new evaluation work', async () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({ observeEvaluationWork: (event) => events.push(event) });
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    expect(projectedRunStateTitles(application, 'Underworld', 'F')).toEqual([
      'Decision 1',
      'Decision 2',
      'Decision 3',
      'Decision 4',
      'Decision 5',
      'Decision 6',
      'Decision 7',
      'Decision 8',
      'Decision 9',
      'Decision 10',
      'Preboss',
    ]);
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    await view.user.click(screen.getByRole('button', { name: /^OpeningEvaluated/ }));
    const launcher = screen.getAllByRole('button', { name: 'Run State' })[0];
    if (launcher === undefined) throw new Error('F Run State launcher is missing');
    expect(launcher.closest('.decision-heading')).not.toBeNull();
    expect(launcher.closest('.biome-rail')).toBeNull();

    events.length = 0;
    await view.user.click(launcher);
    const sheet = screen.getByRole('region', { name: /State before Decision 1/ });
    expect(within(sheet).getByRole('heading', { name: 'Gods in pool' })).toBeTruthy();
    expect(within(sheet).getByRole('heading', { name: 'More Info' })).toBeTruthy();
    expect(within(sheet).getByText('Counters')).toBeTruthy();
    expect(within(sheet).getByText('Reward Bags')).toBeTruthy();
    await view.user.click(within(sheet).getByRole('button', { name: 'Close Run State' }));
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expectNoEvaluationWork(events, 'F Run State open/close');

    await view.user.click(launcher);
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expectNoEvaluationWork(events, 'F Run State route reconciliation');
    application.dispose();
  });

  it('keeps N Run State on the one outer Hub without placing it on inner visits', async () => {
    const application = nRunStateApplication;
    const events = nRunStateEvents;
    expect(nRunStateTitles).toEqual(['Decision 1', 'Hub', 'Preboss']);
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
    const prebossLauncher = screen.getByRole('button', { name: 'Run State' });
    expect(prebossLauncher.closest('.biome-occurrence-workbench')).not.toBeNull();
    expect(prebossLauncher.closest('.biome-rail')).toBeNull();
    events.length = 0;
    await view.user.click(prebossLauncher);
    expect(screen.getByRole('region', { name: 'State before Preboss' })).toBeTruthy();
    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(prebossLauncher);
    expectNoEvaluationWork(events, 'N Preboss Run State open/close');
  });

  it('retains the visible completed-Hub Preboss handoff as one outer transition', async () => {
    const application = createApplication();
    const project = appendCompleteN(
      createProjectDocument(application.catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Run State N handoff',
        projectId: 'run-state-n-handoff',
      }),
      { includePreboss: false },
    );
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
