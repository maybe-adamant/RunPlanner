import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createProjectDocument,
  createHubSlotAddress,
  createIncomingRewardAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { semanticFindingKey } from '../projections/evaluationProjection';
import { findingSelected, runStateOpened } from '../state/editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '../state/projectWorkspaceSlice';
import {
  loadSurfaceNProject,
  loadSurfaceNTenOpenInvalidProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { createApplication } from './createApplication';

const combat10Reward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));

function invalidTenOpenHubProject() {
  const tenOpen = loadSurfaceNTenOpenInvalidProject();
  return applyProjectCommand(tenOpen, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: combat10Reward,
    value: { rewardType: 'WeaponUpgrade' },
  });
}

function combat10RewardFinding(): SemanticFinding {
  // Exact first-blocking evaluation may stop at an earlier trait finding;
  // this witness keeps the reconciliation assertion focused on this owner.
  return Object.freeze({
    code: 'rewardBagEntryUnavailable',
    severity: 'error',
    phase: 'rewardGeneration',
    origin: combat10Reward,
    evidence: Object.freeze({ rewardType: 'WeaponUpgrade' }),
  });
}

describe('application editor-session reconciliation', () => {
  it('clears selected finding navigation when closing its unvisited Hub room removes the owner', () => {
    const application = createApplication();
    try {
      application.store.dispatch(authoredProjectReplaced(invalidTenOpenHubProject()));
      const finding = combat10RewardFinding();
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

  it('clears, rather than rehomes, an open Run State target after a published replacement removes its launcher', () => {
    const application = createApplication();
    try {
      const project = loadSurfaceNProject();
      application.store.dispatch(authoredProjectReplaced(project));
      const n = application
        .selectStructuredWorkspace(application.store.getState())
        .routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'N');
      const hub = n?.nodes.find((node) => node.kind === 'hubDecision');
      if (hub?.kind !== 'hubDecision' || hub.runState === undefined)
        throw new Error('published N Hub Run State launcher is missing');
      application.store.dispatch(runStateOpened(hub.runState.owner));

      application.store.dispatch(
        authoredProjectReplaced(
          createProjectDocument(catalog, {
            configuredBiomeCounts: { Surface: 1 },
            projectId: 'replacement-without-run-state',
          }),
        ),
      );

      expect(application.store.getState().editorSession.runStateTarget).toBeNull();
    } finally {
      application.dispose();
    }
  });

  it('retains the exact completed-Hub handoff target when its visible Preboss launcher survives publication', () => {
    const application = createApplication();
    try {
      const project = loadSurfaceNProject();
      application.store.dispatch(authoredProjectReplaced(project));
      const n = application
        .selectStructuredWorkspace(application.store.getState())
        .routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'N');
      const preboss = n?.nodes.find(
        (node) =>
          node.kind === 'occurrenceWorkbench' &&
          node.room.occurrenceId === nOccurrenceId('preboss'),
      );
      if (preboss?.kind !== 'occurrenceWorkbench' || preboss.runState === undefined)
        throw new Error('visible N Preboss Run State launcher is missing');
      const target = preboss.runState.owner;
      application.store.dispatch(runStateOpened(target));
      const equivalent = Object.freeze({ ...project, routes: Object.freeze([...project.routes]) });

      application.store.dispatch(authoredProjectReplaced(equivalent));

      expect(application.store.getState().editorSession.runStateTarget).toEqual(target);
    } finally {
      application.dispose();
    }
  });
});
