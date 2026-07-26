import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProject, type CandidateEvaluationEvent } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { WorkspaceInteractionCatalog } from '../../src/projections/structuredWorkspace';
import { createStructuredWorkspaceTestServices } from '../fixtures/structuredWorkspace';
import { createRepresentativeNOPQProject } from '../fixtures/surfaceProject';
import { createGoldenFGHIProject } from '../fixtures/underworldProject';

type InteractionFamily = keyof WorkspaceInteractionCatalog;
type LoadableInteraction = {
  readonly load: () => unknown | Promise<unknown>;
  readonly owner: { readonly routeKey?: string; readonly biomeKey?: string };
};

const families: readonly InteractionFamily[] = [
  'batchRewardStores',
  'fieldsCageOutcomes',
  'hubSlots',
  'hubVisits',
  'rewards',
  'rewardWheelOfferCounts',
  'rewardWheelPicks',
  'rewardWheelStores',
  'rooms',
  'shipEncounterCounts',
  'shopPurchases',
  'sideRoomEntryOrders',
  'sideRoomGenerations',
  'takeoverBatches',
];

function firstInteraction(
  family: InteractionFamily,
  workspaces: readonly WorkspaceInteractionCatalog[],
): LoadableInteraction {
  for (const interactions of workspaces) {
    const candidate = interactions[family].values().next().value as LoadableInteraction | undefined;
    if (candidate !== undefined) {
      return candidate;
    }
  }
  throw new Error(`Candidate family ${family} has no representative interaction`);
}

describe('workspace candidate interaction families', () => {
  it('loads every family from its addressed domain without reacquiring project evaluation', async () => {
    const events: CandidateEvaluationEvent[] = [];
    let projectEvaluationCount = 0;
    const evaluate = (project: ProjectDocument) => {
      projectEvaluationCount += 1;
      return simulateProject(catalog, project);
    };
    const services = createStructuredWorkspaceTestServices({
      observeCandidateEvaluation: (event) => events.push(event),
      yieldToHost: () => Promise.resolve(),
    });
    const underworld = createGoldenFGHIProject(catalog);
    const surface = createRepresentativeNOPQProject();
    const workspaces = [
      services.structuredWorkspace.project(underworld, evaluate(underworld)).interactions,
      services.structuredWorkspace.project(surface, evaluate(surface)).interactions,
    ] as const;

    expect(projectEvaluationCount).toBe(2);
    for (const family of families) {
      events.length = 0;
      const interaction = firstInteraction(family, workspaces);

      await interaction.load();

      const queryBatches = events.filter((event) => event.kind === 'queryBatch');
      expect(queryBatches.length, `${family} did not evaluate its domain`).toBeGreaterThan(0);
      expect(queryBatches.every((event) => event.queryCount > 0)).toBe(true);
      expect(projectEvaluationCount, `${family} reacquired project evaluation`).toBe(2);
    }
  });
});
