// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  simulateProject,
  type LinearBiomePlan,
  type LinearBiomeProjectEvaluation,
  type ProjectDocument,
} from '@run-planner/engine';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createPlannerCapabilities } from '../application/capabilities';
import { createCandidateProjectionService } from '../application/candidateProjection';
import { createProjectSimulationScope } from '../application/capabilityConfiguration';
import { createPlannerStore, selectPresentProject, useAppSelector } from '../application/store';
import { LinearBiomeEditor } from './LinearBiomeEditor';

const biome = createBiomeAddress('Surface', 'O');
const introId = createOccurrenceId('editor-o-intro');
const combatId = createOccurrenceId('editor-o-combat');
afterEach(cleanup);

function oPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('O editor fixture has no O plan');
  }
  return plan;
}

function oProject(withTerminal = false): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'o-editor',
    name: 'O Editor',
    configuredBiomeCounts: { Surface: 2 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: introId,
    gameName: 'O_Intro',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, introId),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, introId, 1),
    occurrenceId: combatId,
    gameName: 'O_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, introId),
    exitIndex: 1,
  });
  if (!withTerminal) {
    return project;
  }
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, combatId),
    targetOccurrenceIds: [createOccurrenceId('editor-o-preboss')],
  });
}

function oSixBatchProject(): ProjectDocument {
  let project = oProject();
  let parentOccurrenceId = combatId;
  for (const [index, gameName] of [
    'O_Combat05',
    'O_Combat06',
    'O_Combat07',
    'O_Combat08',
    'O_Combat09',
  ].entries()) {
    const occurrenceId = createOccurrenceId(`editor-o-combat-${index + 2}`);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentOccurrenceId),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, parentOccurrenceId, 1),
      occurrenceId,
      gameName,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parentOccurrenceId),
      exitIndex: 1,
    });
    parentOccurrenceId = occurrenceId;
  }
  return project;
}

function OEditorHarness({
  candidateProjection,
}: {
  readonly candidateProjection: ReturnType<typeof createCandidateProjectionService>;
}) {
  const project = useAppSelector(selectPresentProject);
  const plan = oPlan(project);
  const evaluation: LinearBiomeProjectEvaluation = Object.freeze({
    kind: 'LinearBiome',
    biomeKey: biome.biomeKey,
    origin: biome,
    completion: 'incomplete',
    findings: Object.freeze([]),
  });
  return (
    <LinearBiomeEditor
      candidateProjection={candidateProjection}
      catalog={catalog}
      evaluation={evaluation}
      plan={plan}
      routeKey={biome.routeKey}
    />
  );
}

function renderO(project: ProjectDocument) {
  const active = ['F', 'G', 'H', 'I', 'N', 'O'];
  const capabilities = createPlannerCapabilities(catalog, {
    authorableBiomeKeys: active,
    simulatableBiomeKeys: active,
    editableBiomeKeys: active,
  });
  const simulationScope = createProjectSimulationScope(capabilities);
  const evaluateProject = (current: ProjectDocument) =>
    simulateProject(catalog, current, simulationScope);
  const store = createPlannerStore({
    capabilities,
    catalog,
    evaluateProject,
    initialProject: project,
  });
  const candidateProjection = createCandidateProjectionService(catalog, evaluateProject);
  const user = userEvent.setup();
  const view = render(
    <Provider store={store}>
      <OEditorHarness candidateProjection={candidateProjection} />
    </Provider>,
  );
  return { store, user, ...view };
}

describe('O editor projection', () => {
  it('edits active and dormant ship wheel capacity through semantic commands', async () => {
    const { store, user } = renderO(oProject());

    expect(screen.getByRole('heading', { name: 'Rift of Thessaly' })).toBeTruthy();
    const ship = screen.getByLabelText('Ship combat encounters');
    const wheels = within(ship).getAllByRole('region', { name: /Reward wheel/ });
    expect(wheels).toHaveLength(2);
    expect(wheels[0]?.getAttribute('data-active')).toBe('true');
    expect(wheels[1]?.getAttribute('data-active')).toBe('false');

    await user.selectOptions(within(ship).getByLabelText('Encounters'), '3');
    expect(wheels[1]?.getAttribute('data-active')).toBe('true');

    const firstWheel = wheels[0]!;
    await user.selectOptions(within(firstWheel).getByLabelText('Offers'), '2');
    await user.selectOptions(within(firstWheel).getByLabelText('Picked offer'), '2');
    const offerTwo = within(firstWheel).getByRole('region', { name: 'Offer 2' });
    expect(offerTwo.getAttribute('data-active')).toBe('true');

    const combat = oPlan(
      store.getState().projectWorkspace.history.present,
    ).topology?.occurrences.find((occurrence) => occurrence.occurrenceId === combatId);
    expect(combat?.state).toMatchObject({
      kind: 'shipCombat',
      encounterCount: 3,
      wheels: { wheel1: { offerCount: 2, pickedOfferIndex: 2 } },
    });
    expect(screen.getByRole('button', { name: 'Add Next Decision' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toHaveProperty('disabled', true);
  });

  it('uses the six-batch fixed-count frontier at the direct terminal', () => {
    renderO(oSixBatchProject());

    expect(screen.getByRole('button', { name: 'Add Next Decision' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toHaveProperty('disabled', false);
    expect(
      screen
        .getAllByRole('button', { name: 'Replace With Preboss' })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });

  it('projects the direct preboss transition with its entered WorldShop', () => {
    renderO(oProject(true));

    expect(screen.getByRole('heading', { name: 'Preboss from Combat 04' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss Shop' })).toBeTruthy();
    expect(screen.getByText('Exit 1 entered')).toBeTruthy();
    expect(screen.getByLabelText('Enter terminal exit 1')).toHaveProperty('checked', true);
  });
});
