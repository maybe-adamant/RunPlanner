// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { loadSurfaceNOPQCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const qBiome = createBiomeAddress('Surface', 'Q');
const qMinibossReward = createIncomingRewardAddress(
  qBiome,
  createOccurrenceId('surface-q-first-miniboss-1'),
);
const qMinibossTrait = createTraitOfferAddress(qMinibossReward, 'source');

function currentFindings(application: ReturnType<typeof createApplication>) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('workspace is not open');
  return workspace.assembly.evaluation.findings;
}

describe('Q Miniboss rarity repair product loop', () => {
  it('repairs the manifest-backed Common witness to Rare in one edit and Undo restores it', async () => {
    const application = createApplication();
    try {
      const stale = applyProjectCommand(loadSurfaceNOPQCheckpoint(), application.catalog, {
        kind: 'ReplaceTraitOffer',
        trait: qMinibossTrait,
        value: {
          kind: 'traits',
          giverKey: 'Ares',
          options: [
            { traitKey: 'RendBloodDropBoon', rarity: 'Common' },
            { traitKey: 'AresStatusDoubleDamageBoon', rarity: 'Rare' },
            { traitKey: 'BloodDropRevengeBoon', rarity: 'Rare' },
          ],
          selectedOptionKey: 'option1',
          rarificationActions: [],
        },
      });
      application.store.dispatch(authoredProjectReplaced(stale));
      const currentWorkspace = application.store.getState().projectWorkspace;
      if (currentWorkspace.kind !== 'openProject') throw new Error('workspace is not open');
      expect(
        currentWorkspace.assembly.evaluation.findings.some(
          (finding) =>
            finding.code === 'rarityRollUnavailable' &&
            semanticAddressKey(finding.origin) === semanticAddressKey(qMinibossTrait),
        ),
      ).toBe(true);

      const view = renderPlannerForInteraction({ application });
      await view.user.click(screen.getByRole('button', { name: 'Surface' }));
      await view.user.click(screen.getByRole('button', { name: 'Traits' }));
      const launcher = document.getElementById(
        `trait-launcher-${semanticAddressKey(qMinibossTrait)}`,
      );
      if (launcher === null) throw new Error('Q Miniboss trait launcher is missing');
      await view.user.click(launcher);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getAllByText(/fresh boon rarity cannot occur/).length).toBeGreaterThan(
        0,
      );
      await view.user.click(within(dialog).getByLabelText('option1 rarity'));
      const rare = screen
        .getAllByText('Rare')
        .find((element) => element.closest('[cmdk-item]') !== null);
      if (rare === undefined) throw new Error('Rare repair is missing');
      await view.user.click(rare);
      await view.user.click(within(dialog).getByRole('button', { name: 'Save trait offer' }));
      await waitFor(() =>
        expect(
          currentFindings(application).some(
            (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(qMinibossTrait),
          ),
        ).toBe(false),
      );
      await view.user.click(screen.getByRole('button', { name: 'Undo' }));
      await waitFor(() =>
        expect(
          currentFindings(application).some(
            (finding) =>
              finding.code === 'rarityRollUnavailable' &&
              semanticAddressKey(finding.origin) === semanticAddressKey(qMinibossTrait),
          ),
        ).toBe(true),
      );
    } finally {
      application.dispose();
    }
  });
});
