// @vitest-environment jsdom
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import type { AssessmentIssue, SemanticFinding } from '@run-planner/engine/simulation';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { expect, it } from 'vitest';

import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';
import type { WorkspaceInspectorDestination } from '@planner/projections/structured-workspace';
import { ProjectFindings } from '@planner/ui/feedback/EvaluationFeedback';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { findingDestinationLabel } from '@planner/projections/evaluationProjection';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

it.each([
  ['Decision 1', 'Fields · Entrance'],
  ['Decision 3', 'Fields · Decision 2'],
])('labels the unfinished %s from its existing predecessor', (removedLabel, expected) => {
  const application = createOpenTestApplication();
  const project = createGoldenFGHIProject();
  application.store.dispatch(authoredProjectReplaced(project));
  const before = application.selectStructuredWorkspace(application.store.getState())!;
  const entry = before.route.biomes
    .find((biome) => biome.biomeKey === 'H')
    ?.rail.find((entry) => entry.kind === 'node' && entry.label === removedLabel);
  if (
    entry?.kind !== 'node' ||
    (entry.node.kind !== 'ordinaryBatch' && entry.node.kind !== 'mixedBatch')
  )
    throw new Error('Fields decision fixture is missing');
  application.store.dispatch(
    authoredProjectReplaced(
      applyProjectCommand(project, catalog, {
        kind: 'RemoveExitDecision',
        decision: entry.node.owner,
      }),
    ),
  );
  const workspace = application.selectStructuredWorkspace(application.store.getState())!;
  const frontier = workspace.route.biomes.find((biome) => biome.biomeKey === 'H')?.frontier;
  if (frontier?.kind !== 'exitDecision') throw new Error('Expected an outgoing decision frontier');
  const target = workspace.focusByOwner.get(semanticAddressKey(frontier.owner));
  expect(target).toBeDefined();
  expect(findingDestinationLabel(catalog, frontier.owner, target, workspace.route)).toBe(expected);
});

const biome = createBiomeAddress('Underworld', 'F');
const trait = createTraitOfferAddress(
  createEncounterPhaseAddress(
    biome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId('assessment-issue-trait') },
    'Encounter',
  ),
  'selection',
);
const firstReason: SemanticFinding = {
  code: 'traitOfferMissing',
  evidence: {},
  origin: trait,
  phase: 'rewardGeneration',
  severity: 'error',
};
const secondReason: SemanticFinding = {
  code: 'traitOfferGenerationUnavailable',
  evidence: {},
  origin: trait,
  phase: 'rewardGeneration',
  severity: 'error',
};
const issue: AssessmentIssue = {
  kind: 'incomplete',
  owner: trait,
  regionKey: 'stable-trait-region',
  reasons: [firstReason, secondReason],
};
const destination: WorkspaceInspectorDestination = {
  biomeKey: 'F',
  focusAddress: trait,
  focusKey: semanticAddressKey(trait),
  nodeKey: 'timeline-trait-launcher',
  ownerAddress: trait,
  region: 'structure',
  routeKey: 'Underworld',
  traitDialogTarget: trait,
};

it('uses actual rail destinations for decision, room, and Hub visit locations', () => {
  const application = createOpenTestApplication();
  application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));
  const workspace = application.selectStructuredWorkspace(application.store.getState())!;
  const labels: string[] = [];
  for (const biome of workspace.route.biomes) {
    for (const entry of biome.rail) {
      if (entry.kind === 'frontier') continue;
      const stops =
        entry.kind === 'hubGroup'
          ? [
              { marker: entry.marker, label: 'Hub' },
              ...entry.visits.flatMap((visit) => [visit, ...visit.sideVisits]),
            ]
          : [entry];
      for (const stop of stops) {
        const target = [...workspace.focusByOwner.values()].find(
          (candidate) => candidate.selectedRailKey === stop.marker.focusKey,
        );
        expect(target).toBeDefined();
        if (target === undefined) continue;
        const label = findingDestinationLabel(
          catalog,
          target.focusAddress,
          target,
          workspace.route,
        );
        expect(label).toBe(`${biome.label} · ${stop.label}`);
        labels.push(stop.label);
      }
    }
  }
  expect(labels).toContain('Decision 1');
  expect(labels).toContain('Hub');
});

it('omits the repair banner without an engine-selected issue', () => {
  const application = createOpenTestApplication();
  const { container } = render(
    <Provider store={application.store}>
      <ProjectFindings catalog={catalog} focusByOwner={new Map()} issue={undefined} />
    </Provider>,
  );

  expect(container.childElementCount).toBe(0);
});

it('shows one grouped issue and selects its Timeline launcher without opening its trait dialog', () => {
  const application = createOpenTestApplication();
  render(
    <Provider store={application.store}>
      <ProjectFindings
        catalog={catalog}
        focusByOwner={new Map([[semanticAddressKey(trait), destination]])}
        issue={issue}
      />
    </Provider>,
  );

  const repair = screen.getByRole('button', { name: /choose a trait offer/i });
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(repair.textContent).not.toContain('cannot be generated');
  expect(repair.querySelector('.finding-description')).toBeNull();

  fireEvent.click(repair);

  expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
    key: issue.regionKey,
    origin: trait,
  });
  expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(trait);
  expect(application.store.getState().editorSession.traitDialogTarget).toBeNull();
});

it('keeps details that explain how to repair the issue', () => {
  const application = createOpenTestApplication();
  render(
    <Provider store={application.store}>
      <ProjectFindings
        catalog={catalog}
        focusByOwner={new Map([[semanticAddressKey(trait), destination]])}
        issue={{ ...issue, reasons: [{ ...firstReason, code: 'replacementRarityMismatch' }] }}
      />
    </Provider>,
  );

  const repair = screen.getByRole('button', { name: /wrong replacement rarity/i });
  expect(repair.querySelector('.finding-description')?.textContent).toBe(
    'Use the next rarity above the equipped boon.',
  );
});
