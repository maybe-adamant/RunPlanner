// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import {
  createHubDecisionAddress,
  createOccurrenceAddress,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '../../src/composition/createApplication';
import { authoredProjectReplaced } from '../../src/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '../../src/state/editorSessionSlice';
import { useAppSelector } from '../../src/state/store';
import { BiomeWorkspace } from '../../src/ui/editor/biome/BiomeWorkspace';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
} from '../../../../test/fixtures/authored-project';
import { createGoldenFGHIProject } from '../../../../test/fixtures/authored-project';

interface WorkspaceRenderCase {
  readonly biomeKey: string;
  readonly focus?: SemanticAddress;
  readonly project: (application: PlannerApplication) => ProjectDocument;
  readonly routeKey: 'Surface' | 'Underworld';
}

const cases: readonly WorkspaceRenderCase[] = [
  ...(['F', 'G', 'H', 'I'] as const).map((biomeKey) => ({
    biomeKey,
    project: () => createGoldenFGHIProject(),
    routeKey: 'Underworld' as const,
  })),
  ...(['O', 'P', 'Q'] as const).map((biomeKey) => ({
    biomeKey,
    project: () => createRepresentativeNOPQProject(),
    routeKey: 'Surface' as const,
  })),
  {
    biomeKey: 'N',
    focus: createHubDecisionAddress(nBiome, 'hub'),
    project: () => createRepresentativeNOPQProject(),
    routeKey: 'Surface' as const,
  },
  {
    biomeKey: 'N',
    focus: createOccurrenceAddress(nBiome, nOccurrenceId('combat02')),
    project: () => createRepresentativeNOPQProject(),
    routeKey: 'Surface' as const,
  },
];

function WorkspaceHarness({
  application,
  biomeKey,
  routeKey,
}: {
  readonly application: PlannerApplication;
  readonly biomeKey: string;
  readonly routeKey: 'Surface' | 'Underworld';
}) {
  const state = useAppSelector((value) => value.projectWorkspace);
  const workspace = application.structuredWorkspace.project(
    state.history.present,
    state.evaluation,
  );
  const biome = workspace.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} workspace biome is missing`);
  return (
    <BiomeWorkspace
      biome={biome}
      focusByOwner={workspace.focusByOwner}
      interactions={workspace.interactions}
    />
  );
}

afterEach(cleanup);

describe('candidate render purity', () => {
  for (const routeCase of cases) {
    it(`renders ${routeCase.routeKey}/${routeCase.biomeKey} without candidate work`, () => {
      const events: ApplicationEvaluationEvent[] = [];
      const application = createApplication({
        observeEvaluationWork: (event) => events.push(event),
      });
      application.store.dispatch(authoredProjectReplaced(routeCase.project(application)));
      if (routeCase.focus !== undefined) {
        application.store.dispatch(semanticOwnerFocused(routeCase.focus));
      }
      events.length = 0;

      render(
        <Provider store={application.store}>
          <WorkspaceHarness
            application={application}
            biomeKey={routeCase.biomeKey}
            routeKey={routeCase.routeKey}
          />
        </Provider>,
      );

      expect(screen.getByRole('region', { name: /structure$/ })).toBeTruthy();
      expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);
      expect(events.filter((event) => event.kind === 'projectEvaluation')).toEqual([]);
      application.dispose();
    });
  }
});
