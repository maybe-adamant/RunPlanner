import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject, type CandidateEvaluationEvent } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type { WorkspaceInteractionCatalog } from '../../src/projections/structuredWorkspace';
import { createStructuredWorkspaceTestServices } from '../fixtures/structuredWorkspace';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  oBiome,
  oOccurrenceIds,
} from '../fixtures/surfaceProject';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
} from '../fixtures/underworldProject';

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

  it('keeps source-owned takeover actions as explicit semantic capabilities', () => {
    const services = createStructuredWorkspaceTestServices();
    const fBiome = createBiomeAddress('Underworld', 'F');
    const start = createOccurrenceId('candidate-interaction-f-start');
    const candidateProject = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'candidate-interaction-f',
        name: 'Candidate interaction F',
        configuredBiomeCounts: { Underworld: 1 },
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome: fBiome,
        occurrenceId: start,
        gameName: 'F_Opening01',
      },
    );
    const candidateOwner = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: start,
    });
    const candidateInteractions = services.structuredWorkspace.project(
      candidateProject,
      simulateProject(catalog, candidateProject),
    ).interactions;
    const candidate = candidateInteractions.takeoverBatches.get(semanticAddressKey(candidateOwner));
    if (candidate?.presentation !== 'candidate') {
      throw new Error('F source-owned takeover candidate capability is missing');
    }
    expect(candidate.action).toBe('create');
    expect(typeof candidate.load).toBe('function');
    expect(typeof candidate.commandFor).toBe('function');

    const directProject = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat02,
      }),
    });
    const directInteractions = services.structuredWorkspace.project(
      directProject,
      simulateProject(catalog, directProject),
    ).interactions;
    const direct = directInteractions.takeoverBatches.get(
      semanticAddressKey(
        createExitDecisionAddress(oBiome, {
          kind: 'occurrence',
          occurrenceId: oOccurrenceIds.combat02,
        }),
      ),
    );
    if (direct?.presentation !== 'directTerminal') {
      throw new Error('O direct terminal capability is missing');
    }
    expect(direct.action).toBe('create');
    expect('load' in direct).toBe(false);
    expect(typeof direct.execute).toBe('function');

    const hubHandoffProject = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'candidate-interaction-n-handoff',
        name: 'Candidate interaction N handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const hubHandoffInteractions = services.structuredWorkspace.project(
      hubHandoffProject,
      simulateProject(catalog, hubHandoffProject),
    ).interactions;
    const hubHandoffOwner = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    const hubHandoff = hubHandoffInteractions.takeoverBatches.get(
      semanticAddressKey(hubHandoffOwner),
    );
    if (hubHandoff?.presentation !== 'completedHubHandoff') {
      throw new Error('N completed-Hub handoff capability is missing');
    }
    expect(hubHandoff.action).toBe('create');
    expect('load' in hubHandoff).toBe(false);
    expect(typeof hubHandoff.execute).toBe('function');

    const repairProject = createGoldenFGHIProject(catalog);
    const repairInteractions = services.structuredWorkspace.project(
      repairProject,
      simulateProject(catalog, repairProject),
    ).interactions;
    const repair = [...repairInteractions.takeoverBatches.values()].find(
      (interaction) => interaction.presentation === 'repair',
    );
    if (repair?.presentation !== 'repair') {
      throw new Error('F/G/H/I takeover repair capability is missing');
    }
    expect(repair.action).toBe('reconcile');
    expect('load' in repair).toBe(false);
    expect(typeof repair.execute).toBe('function');
    expect(repair.owner.biomeKey).toBe(goldenFBiome.biomeKey);
  });

  it('does not construct a takeover command for an impossible candidate value', () => {
    const services = createStructuredWorkspaceTestServices();
    const project = createGoldenFGHIProject(catalog);
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const interaction = services.structuredWorkspace
      .project(project, simulateProject(catalog, project))
      .interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (interaction?.presentation !== 'candidate') {
      throw new Error('F opening takeover candidate capability is missing');
    }
    const impossible = interaction
      .load()
      .find(
        (option) =>
          option.evaluation.kind === 'takeoverPrebossBatch' &&
          !option.evaluation.result.selectedPossible,
      );
    if (impossible === undefined) {
      throw new Error('F opening must expose an impossible takeover result for this guard');
    }

    expect(() => interaction.commandFor(impossible.value)).toThrow(/not currently applicable/);
  });
});
