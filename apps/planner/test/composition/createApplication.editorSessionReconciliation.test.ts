import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createProjectDocument,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected, runStateOpened } from '@planner/state/editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNProject,
  loadSurfaceNOPQProject,
  loadSurfaceNTenOpenInvalidProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { createApplication } from '@planner/composition/createApplication';

const combat10Reward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'));

function invalidTenOpenHubProject() {
  const tenOpen = applyProjectCommand(loadSurfaceNTenOpenInvalidProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat04')),
    value: { rewardType: 'MaxHealthDropBig' },
  });
  return applyProjectCommand(tenOpen, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: combat10Reward,
    value: { rewardType: 'MaxHealthDropBig' },
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

function currentProject(application: ReturnType<typeof createApplication>) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.history.present;
}

function topologyFor(project: ReturnType<typeof loadSurfaceNProject>, biomeKey: string) {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology;
  if (topology === null || topology === undefined)
    throw new Error(`${biomeKey} topology is missing`);
  return topology;
}

function currentTopology(application: ReturnType<typeof createApplication>, biomeKey: string) {
  return topologyFor(currentProject(application), biomeKey);
}

function currentWorkspace(application: ReturnType<typeof createApplication>) {
  const workspace = application.selectStructuredWorkspace(application.store.getState());
  if (workspace === undefined) throw new Error('structured workspace is missing');
  return workspace;
}

describe('application editor-session reconciliation', () => {
  it('publishes an N PreHub-to-Chaos selection with its completed Hub reanchored and undoable', () => {
    const application = createApplication();
    try {
      const chaos = createOccurrenceId('application-n-hub-reanchor-chaos');
      const opening = nOccurrenceIds.opening;
      const selection = createExitSelectionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: opening,
      });
      const withChaos = applyProjectCommand(loadSurfaceNProject(), catalog, {
        kind: 'AddChaos',
        additional: createAdditionalExitAddress(nBiome, opening, 'chaos'),
        occurrenceId: chaos,
      });
      const before = topologyFor(withChaos, 'N');
      const hub = before.decisions.find((decision) => decision.kind === 'hub');
      if (hub?.kind !== 'hub') throw new Error('completed N Hub is missing before selection');
      const fixedRoomLinks = before.fixedRoomLinks;

      application.store.dispatch(authoredProjectReplaced(withChaos));
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'SetExitSelection',
          selection,
          value: { kind: 'additional', additionalExitKey: 'chaos' },
        }),
      );

      const reanchored = currentTopology(application, 'N');
      expect(reanchored.decisions.find((decision) => decision.kind === 'hub')).toEqual({
        ...hub,
        source: { kind: 'occurrence', occurrenceId: chaos },
      });
      expect(reanchored.fixedRoomLinks).toEqual(fixedRoomLinks);
      expect(
        reanchored.occurrences.some(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.preHub,
        ),
      ).toBe(true);
      const workspace = currentWorkspace(application);
      expect(
        workspace.focusByOwner.has(semanticAddressKey(createOccurrenceAddress(nBiome, chaos))),
      ).toBe(true);
      expect(
        workspace.route.biomes
          .find((biome) => biome.biomeKey === 'N')
          ?.nodes.some((node) => node.kind === 'hubDecision'),
      ).toBe(true);

      const reanchoredProject = currentProject(application);
      application.store.dispatch(authoredProjectUndoRequested());
      expect(currentProject(application)).toEqual(withChaos);
      application.store.dispatch(authoredProjectRedoRequested());
      expect(currentProject(application)).toEqual(reanchoredProject);
    } finally {
      application.dispose();
    }
  });

  it('removes P Midshop’s Zagreus contract from the published workspace and clears its stale destinations', () => {
    const application = createApplication();
    try {
      const midshop = pOccurrenceId('P_Combat04', 3, 1);
      const contract = createOccurrenceId('application-p-zagreus-contract');
      const source = { kind: 'occurrence' as const, occurrenceId: midshop };
      const additional = createAdditionalExitAddress(pBiome, midshop, 'zagreusContract');
      let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(pBiome, midshop),
        gameName: 'P_Shop01',
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'AddZagreusContract',
        additional,
        occurrenceId: contract,
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(pBiome, source),
        value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
      });
      application.store.dispatch(authoredProjectReplaced(project));

      const contractAddress = createOccurrenceAddress(pBiome, contract);
      const beforeWorkspace = currentWorkspace(application);
      expect(beforeWorkspace.focusByOwner.has(semanticAddressKey(contractAddress))).toBe(true);
      expect(
        beforeWorkspace.route.biomes
          .find((biome) => biome.biomeKey === 'P')
          ?.nodes.some(
            (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === contract,
          ),
      ).toBe(true);
      application.store.dispatch(
        findingSelected({ key: 'stale-zagreus-contract', origin: contractAddress }),
      );
      application.store.dispatch(
        runStateOpened(
          createRoomRunStateCheckpointAddress(contractAddress, { kind: 'roomEntered' }),
        ),
      );
      expect(application.store.getState().editorSession).toMatchObject({
        focusedSemanticOwner: contractAddress,
        selectedFinding: { key: 'stale-zagreus-contract', origin: contractAddress },
        runStateTarget: createRoomRunStateCheckpointAddress(contractAddress, {
          kind: 'roomEntered',
        }),
      });

      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'RemoveExitDecision',
          decision: createExitDecisionAddress(pBiome, source),
        }),
      );

      const removed = currentTopology(application, 'P');
      expect(
        removed.occurrences.find((occurrence) => occurrence.occurrenceId === midshop)
          ?.additionalExits,
      ).toEqual([]);
      expect(removed.occurrences.some((occurrence) => occurrence.occurrenceId === contract)).toBe(
        false,
      );
      expect(
        removed.decisions.some(
          (decision) =>
            decision.kind === 'exit' &&
            decision.source.kind === 'occurrence' &&
            decision.source.occurrenceId === midshop,
        ),
      ).toBe(false);
      const afterWorkspace = currentWorkspace(application);
      expect(afterWorkspace.focusByOwner.has(semanticAddressKey(contractAddress))).toBe(false);
      expect(
        afterWorkspace.route.biomes
          .find((biome) => biome.biomeKey === 'P')
          ?.nodes.some(
            (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === contract,
          ),
      ).toBe(false);
      expect(application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
      expect(application.store.getState().editorSession.selectedFinding).toBeNull();
      expect(application.store.getState().editorSession.runStateTarget).toBeNull();

      const removedProject = currentProject(application);
      application.store.dispatch(authoredProjectUndoRequested());
      expect(currentProject(application)).toEqual(project);
      expect(
        currentWorkspace(application).focusByOwner.has(semanticAddressKey(contractAddress)),
      ).toBe(true);
      application.store.dispatch(authoredProjectRedoRequested());
      expect(currentProject(application)).toEqual(removedProject);
    } finally {
      application.dispose();
    }
  });

  it('closes a Chaos-authored P Preboss branch when the original Preboss is selected again', () => {
    const application = createApplication();
    try {
      const sourceOccurrenceId = pOccurrenceId('P_Combat12', 8, 1);
      const originalPreboss = createOccurrenceId('surface-p-preboss-shop');
      const chaos = createOccurrenceId('application-p-preboss-chaos');
      const chaosPreboss = createOccurrenceId('application-p-chaos-preboss');
      const chaosPrebossPeer = createOccurrenceId('application-p-chaos-preboss-peer');
      const source = { kind: 'occurrence' as const, occurrenceId: sourceOccurrenceId };
      const selection = createExitSelectionAddress(pBiome, source);
      const withChaos = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
        kind: 'AddChaos',
        additional: createAdditionalExitAddress(pBiome, sourceOccurrenceId, 'chaos'),
        occurrenceId: chaos,
      });
      application.store.dispatch(authoredProjectReplaced(withChaos));
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'SetExitSelection',
          selection,
          value: { kind: 'additional', additionalExitKey: 'chaos' },
        }),
      );
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'CreateTakeoverBatch',
          decision: createExitDecisionAddress(pBiome, {
            kind: 'occurrence',
            occurrenceId: chaos,
          }),
          gameName: 'P_PreBoss01',
          targetOccurrenceIds: { exit1: chaosPreboss, exit2: chaosPrebossPeer },
        }),
      );
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'SetExitSelection',
          selection: createExitSelectionAddress(pBiome, {
            kind: 'occurrence',
            occurrenceId: chaos,
          }),
          value: { kind: 'normal', exitKey: 'exit1' },
        }),
      );

      const authoredThroughChaos = currentTopology(application, 'P');
      expect(
        authoredThroughChaos.fixedRoomLinks.some(
          (link) => link.sourceOccurrenceId === chaosPreboss,
        ),
      ).toBe(true);
      expect(
        currentWorkspace(application).focusByOwner.has(
          semanticAddressKey(createOccurrenceAddress(pBiome, chaosPreboss)),
        ),
      ).toBe(true);

      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'SetExitSelection',
          selection,
          value: { kind: 'normal', exitKey: 'exit1' },
        }),
      );

      const restored = currentTopology(application, 'P');
      expect(
        restored.occurrences.some((occurrence) => occurrence.occurrenceId === originalPreboss),
      ).toBe(true);
      expect(
        restored.fixedRoomLinks.some((link) => link.sourceOccurrenceId === originalPreboss),
      ).toBe(true);
      expect(restored.occurrences.some((occurrence) => occurrence.occurrenceId === chaos)).toBe(
        true,
      );
      expect(
        restored.decisions.some(
          (decision) =>
            decision.kind === 'exit' &&
            decision.source.kind === 'occurrence' &&
            decision.source.occurrenceId === chaos,
        ),
      ).toBe(false);
      expect(
        restored.occurrences.some((occurrence) => occurrence.occurrenceId === chaosPreboss),
      ).toBe(false);
      expect(
        restored.occurrences.some((occurrence) => occurrence.occurrenceId === chaosPrebossPeer),
      ).toBe(false);
      expect(restored.fixedRoomLinks.some((link) => link.sourceOccurrenceId === chaosPreboss)).toBe(
        false,
      );
      expect(
        currentWorkspace(application).focusByOwner.has(
          semanticAddressKey(createOccurrenceAddress(pBiome, chaosPreboss)),
        ),
      ).toBe(false);

      const restoredProject = currentProject(application);
      application.store.dispatch(authoredProjectUndoRequested());
      expect(
        currentProject(application).route.biomes.find((biome) => biome.biomeKey === 'P')?.topology,
      ).toEqual(authoredThroughChaos);
      application.store.dispatch(authoredProjectRedoRequested());
      expect(currentProject(application)).toEqual(restoredProject);
    } finally {
      application.dispose();
    }
  });

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
      const initialWorkspace = application.selectStructuredWorkspace(application.store.getState());
      if (initialWorkspace === undefined) throw new Error('workspace is missing');

      expect(application.store.getState().editorSession).toMatchObject({
        focusedSemanticOwner: combat10Reward,
        selectedFinding: { key: semanticFindingKey(finding), origin: combat10Reward },
      });
      expect(
        initialWorkspace.focusByOwner.get(semanticAddressKey(combat10Reward))?.ownerAddress,
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
      expect(state.editorSession.activeSection).toBe('route');
      expect(state.editorSession.activePanel).toEqual({
        kind: 'biome',
        biomeKey: 'N',
      });
      expect(
        state.projectWorkspace.assembly!.evaluation.findings.some(
          (candidate) =>
            semanticFindingKey(candidate) === semanticFindingKey(finding) &&
            semanticAddressKey(candidate.origin) === semanticAddressKey(finding.origin),
        ),
      ).toBe(false);
      expect(
        application
          .selectStructuredWorkspace(state)!
          .focusByOwner.has(semanticAddressKey(combat10Reward)),
      ).toBe(false);
      const nWorkspace = application
        .selectStructuredWorkspace(state)!
        .route.biomes.find((biome) => biome.biomeKey === 'N');
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
        .selectStructuredWorkspace(application.store.getState())!
        .route.biomes.find((biome) => biome.biomeKey === 'N');
      const hub = n?.nodes.find((node) => node.kind === 'hubDecision');
      if (hub?.kind !== 'hubDecision' || hub.runState === undefined)
        throw new Error('published N Hub Run State launcher is missing');
      application.store.dispatch(runStateOpened(hub.runState.owner));

      application.store.dispatch(
        authoredProjectReplaced(
          createProjectDocument(catalog, {
            routeKey: 'Surface',
            configuredBiomeCount: 1,
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
        .selectStructuredWorkspace(application.store.getState())!
        .route.biomes.find((biome) => biome.biomeKey === 'N');
      const preboss = n?.nodes.find(
        (node) =>
          node.kind === 'occurrenceWorkbench' &&
          node.room.occurrenceId === nOccurrenceId('preboss'),
      );
      if (preboss?.kind !== 'occurrenceWorkbench' || preboss.runState === undefined)
        throw new Error('visible N Preboss Run State launcher is missing');
      const target = preboss.runState.owner;
      application.store.dispatch(runStateOpened(target));
      const equivalent = Object.freeze({ ...project, route: Object.freeze({ ...project.route }) });

      application.store.dispatch(authoredProjectReplaced(equivalent));

      expect(application.store.getState().editorSession.runStateTarget).toBeNull();
    } finally {
      application.dispose();
    }
  });
});
