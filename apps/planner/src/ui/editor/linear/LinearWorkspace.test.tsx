// @vitest-environment jsdom

import { act, cleanup, screen, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '../../../composition/createApplication';
import type { WorkspaceLinearBiome } from '../../../projections/structuredWorkspace';
import { routePanelSelected, semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { authoredProjectReplaced } from '../../../state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '../../../../test/fixtures/renderPlanner';
import { createRepresentativeNOPQProject } from '../../../../test/fixtures/surfaceProject';
import { createGoldenFGHIProject } from '../../../../test/fixtures/underworldProject';

afterEach(cleanup);

function renderBiome(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  application.store.dispatch(routePanelSelected({ routeKey, biomeKey }));
  return renderPlannerForInteraction({ application });
}

function projectedLinearBiome(
  application: ReturnType<typeof createApplication>,
  biomeKey: string,
): WorkspaceLinearBiome {
  const state = application.store.getState().projectWorkspace;
  const workspace = application.structuredWorkspace.project(
    state.history.present,
    state.evaluation,
  );
  const biome = workspace.routes
    .flatMap((route) => route.biomes)
    .find((candidate) => candidate.biomeKey === biomeKey);
  if (biome?.kind !== 'LinearBiome') {
    throw new Error(`${biomeKey} has no Linear workspace`);
  }
  return biome;
}

describe('Linear structured workspace', () => {
  it('authors blank room slots in physical generation order', async () => {
    const application = createApplication();
    const biome = createBiomeAddress('Underworld', 'F');
    const startId = createOccurrenceId('ordered-workspace-start');
    const parentId = createOccurrenceId('ordered-workspace-parent');
    let project = createProjectDocument(application.catalog, {
      projectId: 'ordered-workspace',
      name: 'Ordered Workspace',
      configuredBiomeCounts: { Underworld: 1 },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, startId),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, startId, 1),
      occurrenceId: parentId,
      gameName: 'F_Combat02',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, startId),
      exitIndex: 1,
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentId),
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, parentId),
      storeKey: 'RunProgress',
    });
    const view = renderBiome(project, 'Underworld', 'F');
    const structure = screen.getByRole('region', { name: 'Erebus structure' });
    await view.user.click(within(structure).getByRole('button', { name: /Decision 2/ }));
    const decision = screen
      .getByRole('heading', { name: 'Doors from Combat 02' })
      .closest('.decision-card');
    if (decision === null) {
      throw new Error('ordered decision workbench is missing');
    }
    const roomPickers = within(decision as HTMLElement).getAllByLabelText('Room');

    expect(roomPickers).toHaveLength(2);
    expect(roomPickers[0]).toHaveProperty('disabled', false);
    expect(roomPickers[1]).toHaveProperty('disabled', true);
    expect(roomPickers[1]?.textContent).toContain('Choose prior exit first');
    expect(roomPickers[1]?.textContent).not.toContain('Topology');
    expect(within(decision as HTMLElement).getByText('Waiting for prior exit')).toBeTruthy();

    await view.user.click(roomPickers[0]!);
    await view.user.click(screen.getByRole('option', { name: /^Combat 03/ }));

    const updatedDecision = screen
      .getByRole('heading', { name: 'Doors from Combat 02' })
      .closest('.decision-card');
    if (updatedDecision === null) {
      throw new Error('updated ordered decision workbench is missing');
    }
    expect(within(updatedDecision as HTMLElement).getAllByLabelText('Room')[1]).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('retains a newly created start when its inspector reveals an attached edit surface', async () => {
    const application = createApplication();
    const project = createProjectDocument(application.catalog, {
      projectId: 'empty-i-workspace',
      name: 'Empty I Workspace',
      configuredBiomeCounts: { Underworld: 4 },
    });
    const view = renderBiome(project, 'Underworld', 'I');
    const structure = screen.getByRole('region', { name: 'Tartarus structure' });
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });

    expect(within(structure).getByRole('button', { name: /Choose starting room/ })).toBeTruthy();
    expect(within(structure).queryByRole('button', { name: /Biome settings/ })).toBeNull();
    expect(within(structure).queryByRole('button', { name: /Hades/ })).toBeNull();
    expect(within(inspector).getByRole('heading', { name: 'Choose an entrance' })).toBeTruthy();
    expect(within(inspector).getByRole('button', { name: 'Entrance' })).toBeTruthy();
    expect(view.container.querySelectorAll('.linear-entry-node')).toHaveLength(1);

    await view.user.click(within(inspector).getByRole('button', { name: 'Entrance' }));
    await view.user.click(screen.getByRole('option', { name: /^Entrance/ }));

    const iPlan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    const startOccurrenceId =
      iPlan?.kind === 'LinearBiome' ? iPlan.topology?.startOccurrenceId : null;
    if (startOccurrenceId === null || startOccurrenceId === undefined) {
      throw new Error('I start occurrence was not created');
    }
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(createBiomeAddress('Underworld', 'I'), startOccurrenceId),
    );
    expect(within(inspector).getByRole('heading', { name: 'Entrance' })).toBeTruthy();
    expect(within(inspector).getByLabelText('Rolled non-goal limit')).toBeTruthy();
    expect(within(inspector).queryByRole('button', { name: 'Add Next Decision' })).toBeNull();
  });

  it('retains a newly created start when its room owns an editable reward', async () => {
    const application = createApplication();
    const project = createProjectDocument(application.catalog, {
      projectId: 'empty-f-workspace',
      name: 'Empty F Workspace',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const view = renderBiome(project, 'Underworld', 'F');
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });

    await view.user.click(within(inspector).getByRole('button', { name: 'Opening' }));
    await view.user.click(screen.getByRole('option', { name: /^Opening 01/ }));

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toMatchObject({
      biomeKey: 'F',
      kind: 'occurrence',
      routeKey: 'Underworld',
    });
    expect(within(inspector).getByRole('heading', { name: 'Opening 01' })).toBeTruthy();
    expect(within(inspector).getByLabelText('Reward')).toBeTruthy();
    expect(within(inspector).queryByRole('button', { name: 'Add Next Decision' })).toBeNull();
  });

  it('advances an ordinary created start to its frontier', async () => {
    const application = createApplication();
    const project = createProjectDocument(application.catalog, {
      projectId: 'empty-g-workspace',
      name: 'Empty G Workspace',
      configuredBiomeCounts: { Underworld: 2 },
    });
    const view = renderBiome(project, 'Underworld', 'G');
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });

    await view.user.click(within(inspector).getByRole('button', { name: 'Entrance' }));
    await view.user.click(screen.getByRole('option', { name: /^Entrance/ }));

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(within(inspector).getByRole('heading', { name: 'Active frontier' })).toBeTruthy();
    expect(within(inspector).getByRole('button', { name: 'Add Next Decision' })).toBeTruthy();
  });

  it('composes every Linear biome through the common rail and variant-owned terminal', () => {
    const underworld = createGoldenFGHIProject(createApplication().catalog);
    const surface = createRepresentativeNOPQProject();
    const cases = [
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'F',
        label: 'Erebus',
        terminal: 'independent',
      },
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'G',
        label: 'Oceanus',
        terminal: 'independent',
      },
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'H',
        label: 'Fields',
        terminal: 'independent',
      },
      {
        project: underworld,
        routeKey: 'Underworld',
        biomeKey: 'I',
        label: 'Tartarus',
        terminal: 'generatedPeer',
      },
      {
        project: surface,
        routeKey: 'Surface',
        biomeKey: 'O',
        label: 'Thessaly',
        terminal: 'independent',
      },
      {
        project: surface,
        routeKey: 'Surface',
        biomeKey: 'P',
        label: 'Olympus',
        terminal: 'independent',
      },
      {
        project: surface,
        routeKey: 'Surface',
        biomeKey: 'Q',
        label: 'Summit',
        terminal: 'independent',
      },
    ] as const;

    for (const testCase of cases) {
      const view = renderBiome(testCase.project, testCase.routeKey, testCase.biomeKey);
      expect(screen.getByRole('region', { name: `${testCase.label} structure` })).toBeTruthy();
      expect(screen.getByRole('complementary', { name: 'Focused inspector' })).toBeTruthy();
      expect(
        view.container.querySelector(
          `.linear-terminal-stop[data-realization="${testCase.terminal}"]`,
        ),
      ).toBeTruthy();
      view.unmount();
    }
  });

  it('keeps unpicked offers out of the spine and edits every exit in one decision workbench', async () => {
    const seed = createApplication();
    const project = createGoldenFGHIProject(seed.catalog);
    const { application, user } = renderBiome(project, 'Underworld', 'F');
    const projection = projectedLinearBiome(application, 'F');
    const decisionIndex = projection.decisions.findIndex((candidate) =>
      candidate.targets.some((target) => !target.picked),
    );
    const decision = projection.decisions[decisionIndex];
    const picked = decision?.targets.find((target) => target.picked);
    const unpicked = decision?.targets.find((target) => !target.picked);
    if (decision === undefined || picked === undefined || unpicked === undefined) {
      throw new Error('golden F has no multi-offer decision');
    }
    const structure = screen.getByRole('region', { name: 'Erebus structure' });
    const decisionButton = within(structure)
      .getAllByRole('button')
      .find((button) => button.getAttribute('data-workspace-node') === decision.marker.focusKey);
    if (decisionButton === undefined) {
      throw new Error('multi-offer F decision has no compact structure row');
    }

    expect(within(structure).getByRole('button', { name: /Start — Assessed/ })).toBeTruthy();
    expect(
      within(structure).getByRole('button', { name: /Terminal decision — Assessed/ }),
    ).toBeTruthy();
    expect(decisionButton.textContent).toContain(`Decision ${decisionIndex + 1} — Assessed`);
    expect(decisionButton.textContent).not.toContain('offers');
    expect(decisionButton.textContent).toContain(picked.room.label);
    expect(
      within(structure)
        .getAllByRole('button')
        .some(
          (button) => button.getAttribute('data-workspace-node') === unpicked.room.marker.focusKey,
        ),
    ).toBe(false);

    await user.click(decisionButton);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      decision.marker.address,
    );
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(
      within(inspector).getByRole('heading', {
        level: 2,
        name: `Decision ${decisionIndex + 1}`,
      }),
    ).toBeTruthy();
    expect(within(inspector).getAllByLabelText('Room')).toHaveLength(decision.targets.length);
    expect(within(inspector).getAllByRole('radio')).toHaveLength(decision.targets.length);

    act(() => {
      application.store.dispatch(semanticOwnerFocused(unpicked.room.marker.address));
    });

    expect(
      within(inspector).getByRole('heading', {
        level: 2,
        name: `Decision ${decisionIndex + 1}`,
      }),
    ).toBeTruthy();
    const exitCards = Array.from(inspector.querySelectorAll('.exit-row'));
    expect(exitCards).toHaveLength(decision.targets.length);
    expect(exitCards.filter((card) => card.getAttribute('data-focused') === 'true')).toHaveLength(
      1,
    );
    expect(
      exitCards.find((card) => card.getAttribute('data-focused') === 'true')?.textContent,
    ).toContain(unpicked.room.label);
  });

  it('keeps the explicit Clockwork outcome attached to Entrance instead of a settings node', () => {
    const seed = createApplication();
    const project = createGoldenFGHIProject(seed.catalog);
    const { application } = renderBiome(project, 'Underworld', 'I');
    const projection = projectedLinearBiome(application, 'I');
    act(() => {
      application.store.dispatch(semanticOwnerFocused(projection.entries[0]!.marker.address));
    });
    const structure = screen.getByRole('region', { name: 'Tartarus structure' });

    expect(within(structure).queryByRole('button', { name: /Biome settings/ })).toBeNull();
    expect((screen.getByLabelText('Rolled non-goal limit') as HTMLSelectElement).value).toBe('3');
  });

  it('keeps an unpicked Story offer inspectable in its decision workbench', () => {
    const seed = createApplication();
    const project = createGoldenFGHIProject(seed.catalog);
    const { application } = renderBiome(project, 'Underworld', 'I');
    const projection = projectedLinearBiome(application, 'I');
    const decisionIndex = projection.decisions.findIndex((decision) =>
      decision.targets.some((target) => target.room.gameName === 'I_Story01'),
    );
    const decision = projection.decisions[decisionIndex];
    const story = decision?.targets.find((target) => target.room.gameName === 'I_Story01');
    if (decision === undefined || story === undefined) {
      throw new Error('golden I has no Story offer');
    }

    expect(story.picked).toBe(false);
    act(() => {
      application.store.dispatch(semanticOwnerFocused(story.room.marker.address));
    });

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(
      within(inspector).getByRole('heading', {
        level: 2,
        name: `Decision ${decisionIndex + 1}`,
      }),
    ).toBeTruthy();
    const storyCard = within(inspector)
      .getByRole('heading', { name: 'Hades' })
      .closest('.exit-row');
    expect(storyCard).not.toBeNull();
    expect(storyCard?.getAttribute('data-focused')).toBe('true');
    expect(within(storyCard as HTMLElement).getByText('Fixed reward: Story')).toBeTruthy();
  });
});
