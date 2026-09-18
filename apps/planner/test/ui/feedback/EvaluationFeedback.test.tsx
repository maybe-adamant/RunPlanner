// @vitest-environment jsdom
import {
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
