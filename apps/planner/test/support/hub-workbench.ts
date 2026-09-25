import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

import type { PlannerApplication } from '@planner/composition/createApplication';
import {
  loadSurfaceNPartialHubProject,
  loadSurfaceNTenOpenInvalidProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';

export let invalidTenDoorHubProject: ProjectDocument;

beforeAll(() => {
  invalidTenDoorHubProject = applyProjectCommand(loadSurfaceNTenOpenInvalidProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat04')),
    value: { rewardType: 'MaxHealthDropBig' },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

export function nHubState(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('Hub test project is not open');
  const plan = workspace.history.present.route.biomes.find((biome) => biome.biomeKey === 'N');
  const topology = plan?.topology;
  if (topology === undefined || topology === null) {
    throw new Error('N Hub test project has no authored topology');
  }
  const decision = topology.decisions.find((candidate) => candidate.kind === 'hub');
  if (decision?.kind !== 'hub') throw new Error('N Hub test project has no Hub decision');
  return { decision, topology };
}

export function nHubOccurrence(application: PlannerApplication, hubSlotKey: string) {
  const { decision, topology } = nHubState(application);
  const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  if (target === undefined) throw new Error(`N Hub slot ${hubSlotKey} is not open`);
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === target.occurrenceId,
  );
  if (occurrence === undefined) throw new Error(`N Hub slot ${hubSlotKey} has no occurrence`);
  return occurrence;
}

export function twoVisitHubProject(): ProjectDocument {
  return applyProjectCommand(loadSurfaceNPartialHubProject(), catalog, {
    kind: 'ReplaceHubActionOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    actions: hubVisitActions(['combat05', 'miniBoss01']),
  });
}

export function selectHubTab(name: 'Hub Overview' | 'Hub Timeline' | 'Hub Exit'): void {
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab);
}

export function withRetainedHubBehindMissingLink(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(
        project.route.biomes.map((biome) => {
          if (biome.biomeKey !== 'N' || biome.topology === null) return biome;
          const startOccurrenceId = biome.topology.startOccurrenceId;
          return Object.freeze({
            ...biome,
            topology: Object.freeze({
              ...biome.topology,
              decisions: Object.freeze(
                biome.topology.decisions.filter(
                  (decision) =>
                    !(
                      decision.kind === 'exit' &&
                      decision.source.kind === 'occurrence' &&
                      decision.source.occurrenceId === startOccurrenceId
                    ),
                ),
              ),
            }),
          });
        }),
      ),
    }),
  });
}
