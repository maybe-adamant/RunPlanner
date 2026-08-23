// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNNaturalSelectionFrontierCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfaceNQueensRansomCheckpoint,
  loadSurfaceNSteadyGrowthFrontierCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome, nOccurrenceId } from '@run-planner/test-fixtures/surface';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const minibossTrait = createTraitOfferAddress(
  createIncomingRewardAddress(nBiome, nOccurrenceId('miniBoss01')),
  'source',
);
const naturalResult = createNaturalSelectionResultAddress(minibossTrait, 'option1');

function routeFindingIndex(
  application: ReturnType<typeof createApplication>,
  owner: SemanticAddress,
): number {
  const surface = application.store
    .getState()
    .projectWorkspace.assembly.evaluation.routes.find((route) => route.routeKey === 'Surface');
  const index =
    surface?.findings.findIndex(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(owner),
    ) ?? -1;
  if (index < 0) throw new Error(`Surface finding is missing at ${semanticAddressKey(owner)}`);
  return index;
}

function findingButton(index: number): HTMLElement {
  const section = screen.getByRole('heading', { name: 'Findings' }).closest('section');
  if (section === null) throw new Error('Findings panel is missing');
  const button = within(section).getAllByRole('button')[index];
  if (button === undefined) throw new Error(`Findings omitted entry ${index}`);
  return button;
}

describe('run-impacting trait product loops', () => {
  it('loads the manifest-backed generated-pickup workflows through existing Room Action rows', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNQuickBuckCheckpoint()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    const ephyraStructure = screen.getByRole('region', { name: 'Ephyra route structure' });
    const roomButton = (label: string) => {
      const button = Array.from(
        ephyraStructure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
      ).find((candidate) => candidate.textContent?.includes(label));
      if (button === undefined) throw new Error(`Ephyra ${label} room is missing`);
      return button;
    };
    const pickupRow = (entryKey: string) =>
      document.querySelector<HTMLElement>(`[data-room-action-key*="${entryKey}"]`);
    await view.user.click(roomButton('Opening'));
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await waitFor(() => expect(pickupRow('quickBuckGold')).not.toBeNull());

    application.store.dispatch(authoredProjectReplaced(loadSurfaceNBuriedTreasureCheckpoint()));
    await view.user.click(roomButton('Pre-Hub'));
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await waitFor(() =>
      expect(
        ['smallGold', 'tinyGold1', 'tinyGold2', 'minorHeal1', 'minorHeal2', 'bones'].every(
          (entryKey) => pickupRow(entryKey) !== null,
        ),
      ).toBe(true),
    );
    application.dispose();
  });

  it('repairs the manifest-backed Natural Selection result as one offer edit and Undo restores it', async () => {
    const application = createApplication();
    const authored = loadSurfaceNNaturalSelectionFrontierCheckpoint();
    application.store.dispatch(authoredProjectReplaced(authored));
    expect(routeFindingIndex(application, naturalResult)).toBeGreaterThanOrEqual(0);
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(findingButton(routeFindingIndex(application, naturalResult)));
    const dialog = await screen.findByRole('dialog');
    await view.user.click(within(dialog).getByRole('button', { name: 'Choose all targets' }));
    for (let position = 1; position <= 8; position += 1) {
      const choice = await waitFor(() => {
        const possible = screen
          .getAllByRole('option')
          .find((option) => option.getAttribute('data-candidate-state') !== 'impossible');
        if (possible === undefined) throw new Error(`Natural target ${position} is unavailable`);
        return possible;
      });
      await view.user.click(choice);
    }

    await view.user.click(within(dialog).getByRole('button', { name: 'Save trait offer' }));
    await waitFor(() =>
      expect(
        application.store
          .getState()
          .projectWorkspace.assembly.evaluation.findings.some(
            (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(naturalResult),
          ),
      ).toBe(false),
    );
    expect(application.store.getState().projectWorkspace.assembly.evaluation.status).toBe('valid');
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(application.store.getState().projectWorkspace.history.present).toBe(authored),
    );
    expect(routeFindingIndex(application, naturalResult)).toBeGreaterThanOrEqual(0);
    application.dispose();
  });

  it("loads Queen's Ransom as a valid route and renders its engine-derived acquisition preview", async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNQueensRansomCheckpoint()));
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toMatchObject({
      findings: [],
      status: 'valid',
      summary: { eligibleForExecutionPlan: true },
    });
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = document.getElementById(`trait-launcher-${semanticAddressKey(minibossTrait)}`);
    if (launcher === null) throw new Error("Queen's Ransom trait launcher is missing");
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    const preview = within(dialog).getByRole('group', { name: 'Ransom preview' });
    expect(preview.textContent).toContain('Removes 2 opposing traits and grants +8 levels');
    expect(within(preview).getByText(/Removed:/).textContent).toContain('Heaven Strike');
    expect(within(preview).getByText(/Removed:/).textContent).toContain('Storm Ring');
    await view.user.click(within(dialog).getByRole('button', { name: 'Close trait offer' }));
    expect(application.store.getState().projectWorkspace.assembly.evaluation.status).toBe('valid');
    application.dispose();
  });

  it('repairs the manifest-backed N side-room Steady Growth threshold and Undo restores it', async () => {
    const application = createApplication();
    const authored = loadSurfaceNSteadyGrowthFrontierCheckpoint();
    application.store.dispatch(authoredProjectReplaced(authored));
    const finding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (candidate) => candidate.code === 'steadyGrowthOutcomeMissing',
      );
    if (
      finding?.origin.kind !== 'steadyGrowthOutcome' ||
      finding.origin.owner.kind !== 'occurrence'
    ) {
      throw new Error('Steady Growth threshold finding is missing');
    }
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;
    const findingIndex = routeFindingIndex(application, finding.origin);
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(findingButton(findingIndex));
    const picker = await screen.findByLabelText('Steady Growth target');
    await waitFor(() => expect(picker.getAttribute('aria-expanded')).toBe('true'));
    const choice = screen
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-disabled') !== 'true');
    if (choice === undefined) throw new Error('Steady Growth has no eligible target');
    await view.user.click(choice);

    await waitFor(() =>
      expect(
        application.store
          .getState()
          .projectWorkspace.assembly.evaluation.findings.some(
            (candidate) =>
              semanticAddressKey(candidate.origin) === semanticAddressKey(finding.origin),
          ),
      ).toBe(false),
    );
    expect(application.store.getState().projectWorkspace.assembly.evaluation.status).toBe('valid');
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    const occurrenceId = finding.origin.owner.occurrenceId;
    const occurrence = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    expect(occurrence?.encounters.steadyGrowthTargetByPhase?.Encounter).toBeDefined();

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(application.store.getState().projectWorkspace.history.present).toBe(authored),
    );
    expect(routeFindingIndex(application, finding.origin)).toBeGreaterThanOrEqual(0);
    application.dispose();
  });
});
