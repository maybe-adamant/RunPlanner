// @vitest-environment jsdom

import { cleanup, screen } from '@testing-library/react';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '../../src/composition/createApplication';
import { authoredProjectReplaced } from '../../src/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';
import { createRepresentativeNOPQProject } from '../fixtures/surfaceProject';
import { createGoldenFGHIProject } from '../fixtures/underworldProject';

interface RouteRenderCase {
  readonly biomes: readonly string[];
  readonly project: (application: PlannerApplication) => ProjectDocument;
  readonly route: 'Surface' | 'Underworld';
}

const cases: readonly RouteRenderCase[] = [
  {
    biomes: ['Erebus', 'Oceanus', 'Fields', 'Tartarus'],
    project: (application) => createGoldenFGHIProject(application.catalog),
    route: 'Underworld',
  },
  {
    biomes: ['Ephyra', 'Thessaly', 'Olympus', 'Summit'],
    project: () => createRepresentativeNOPQProject(),
    route: 'Surface',
  },
];

afterEach(cleanup);

describe('candidate render purity', () => {
  for (const routeCase of cases) {
    it(`renders every ${routeCase.route} biome without candidate work`, async () => {
      const events: ApplicationEvaluationEvent[] = [];
      const application = createApplication({
        observeEvaluationWork: (event) => events.push(event),
      });
      application.store.dispatch(authoredProjectReplaced(routeCase.project(application)));
      events.length = 0;
      const view = renderPlannerForInteraction({ application });

      await view.user.click(screen.getByRole('button', { name: routeCase.route }));
      for (const biome of routeCase.biomes) {
        await view.user.click(screen.getByRole('button', { name: biome }));
        expect(screen.getByRole('heading', { name: biome })).toBeTruthy();
      }

      expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);
      expect(events.filter((event) => event.kind === 'projectEvaluation')).toEqual([]);
      application.dispose();
    });
  }
});
