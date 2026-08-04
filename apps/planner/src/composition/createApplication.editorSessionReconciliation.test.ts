import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubSlotAddress,
  createIncomingRewardAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { semanticFindingKey } from '../projections/evaluationProjection';
import { findingSelected } from '../state/editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '../state/projectWorkspaceSlice';
import {
  createRepresentativeNProject,
  nBiome,
  nOccurrenceId,
  nOpenSlotKeys,
} from '@run-planner/test-fixtures';
import { createApplication } from './createApplication';

const combat10Reward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));

function invalidTenOpenHubProject() {
  const tenOpen = createRepresentativeNProject({
    openSlotKeys: [...nOpenSlotKeys, 'combat04'],
  });
  return applyProjectCommand(tenOpen, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: combat10Reward,
    value: { rewardType: 'WeaponUpgrade' },
  });
}

function combat10RewardFinding(application: ReturnType<typeof createApplication>): SemanticFinding {
  const finding = application.store
    .getState()
    .projectWorkspace.assembly.evaluation.findings.find(
      (candidate) =>
        candidate.code === 'rewardBagEntryUnavailable' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(combat10Reward),
    );
  if (finding === undefined) throw new Error('Combat 10 reward finding is missing');
  return finding;
}

describe('application editor-session reconciliation', () => {
  it('clears selected finding navigation when closing its unvisited Hub room removes the owner', () => {
    const application = createApplication();
    try {
      application.store.dispatch(authoredProjectReplaced(invalidTenOpenHubProject()));
      const finding = combat10RewardFinding(application);
      application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      );
      const navigationRevision =
        application.store.getState().editorSession.semanticNavigationRevision;

      expect(application.store.getState().editorSession).toMatchObject({
        focusedSemanticOwner: combat10Reward,
        selectedFinding: { key: semanticFindingKey(finding), origin: combat10Reward },
      });
      expect(
        application
          .selectStructuredWorkspace(application.store.getState())
          .focusByOwner.get(semanticAddressKey(combat10Reward))?.ownerAddress,
      ).toEqual(combat10Reward);

      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'CloseHubSlot',
          slot: createHubSlotAddress(nBiome, 'hub', 'combat10'),
        }),
      );

      const state = application.store.getState();
      expect(state.editorSession.focusedSemanticOwner).toBeNull();
      expect(state.editorSession.selectedFinding).toBeNull();
      expect(state.editorSession.semanticNavigationRevision).toBe(navigationRevision);
      expect(state.editorSession.activeRouteKey).toBe('Surface');
      expect(state.editorSession.activePanelByRoute.Surface).toEqual({
        kind: 'biome',
        biomeKey: 'N',
      });
      expect(
        state.projectWorkspace.assembly.evaluation.findings.some(
          (candidate) =>
            semanticFindingKey(candidate) === semanticFindingKey(finding) &&
            semanticAddressKey(candidate.origin) === semanticAddressKey(finding.origin),
        ),
      ).toBe(false);
      expect(
        application
          .selectStructuredWorkspace(state)
          .focusByOwner.has(semanticAddressKey(combat10Reward)),
      ).toBe(false);
      const nWorkspace = application
        .selectStructuredWorkspace(state)
        .routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'N');
      if (nWorkspace === undefined)
        throw new Error('Ephyra workspace is missing after closing a slot');
      expect(nWorkspace.nodes.some((node) => node.kind === 'hubDecision')).toBe(true);
      expect(nWorkspace.defaultInspectorDestination).not.toBeNull();
    } finally {
      application.dispose();
    }
  });
});
