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

import type {
  WorkspaceHubSlotInteraction,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { createStructuredWorkspaceTestServices } from '../fixtures/structuredWorkspace';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';
import { createGoldenFGHIProject, goldenFBiome, goldenFStartId } from '@run-planner/test-fixtures';

type LoadableInteraction = {
  readonly load: () => unknown | Promise<unknown>;
  readonly owner: { readonly routeKey?: string; readonly biomeKey?: string };
};

const families = [
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
] as const satisfies readonly (keyof WorkspaceInteractionCatalog)[];

type InteractionFamily = (typeof families)[number];

/**
 * Reward controls deliberately resolve each declaration-owned reward leaf in
 * their cooperative domain pass. The other representative families each
 * resolve through one addressed batch.
 */
const expectedColdQueryBatchCounts: Readonly<Record<InteractionFamily, number>> = Object.freeze({
  batchRewardStores: 1,
  fieldsCageOutcomes: 1,
  hubSlots: 1,
  hubVisits: 1,
  rewards: 14,
  rewardWheelOfferCounts: 1,
  rewardWheelPicks: 1,
  rewardWheelStores: 1,
  rooms: 1,
  shipEncounterCounts: 1,
  shopPurchases: 1,
  sideRoomEntryOrders: 1,
  sideRoomGenerations: 1,
});

function firstInteraction(
  family: InteractionFamily,
  workspaces: readonly WorkspaceInteractionCatalog[],
): unknown {
  for (const interactions of workspaces) {
    const candidate = interactions[family].values().next().value as LoadableInteraction | undefined;
    if (candidate !== undefined) {
      return candidate;
    }
  }
  throw new Error(`Candidate family ${family} has no representative interaction`);
}

describe('workspace candidate interaction families', () => {
  it('binds a topology-free authored-choice start lazily from its declaration domain', () => {
    const events: CandidateEvaluationEvent[] = [];
    const services = createStructuredWorkspaceTestServices({
      observeCandidateEvaluation: (event) => events.push(event),
    });
    const biome = createBiomeAddress('Underworld', 'F');
    const project = createProjectDocument(catalog, {
      projectId: 'candidate-interaction-start',
      name: 'Candidate interaction start',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const layout = catalog.biomeLayouts.byKey.F;
    if (layout?.start.kind !== 'authoredChoice') {
      throw new Error('F authored-choice start declaration is missing');
    }
    const interactions = services.structuredWorkspace.project(
      project,
      simulateProject(catalog, project),
    ).interactions;
    const start = interactions.starts.get(semanticAddressKey(biome));
    if (start?.kind !== 'choice') throw new Error('F authored-choice start interaction is missing');

    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);

    const model = start.load();
    const queryBatches = events.filter((event) => event.kind === 'queryBatch');
    expect(queryBatches).toHaveLength(1);
    expect(queryBatches[0]?.queryCount).toBe(layout.start.roomGameNames.length);
    expect(
      model.sections.flatMap((section) => section.items.map((item) => item.value.gameName)).sort(),
    ).toEqual([...layout.start.roomGameNames].sort());

    events.length = 0;
    expect(start.load()).toBe(model);
    expect(events).toEqual([]);
  });

  it('binds frontier takeover candidates lazily from their source decision', () => {
    const events: CandidateEvaluationEvent[] = [];
    const services = createStructuredWorkspaceTestServices({
      observeCandidateEvaluation: (event) => events.push(event),
    });
    const biome = createBiomeAddress('Underworld', 'F');
    const start = createOccurrenceId('candidate-interaction-takeover-start');
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'candidate-interaction-takeover',
        name: 'Candidate interaction takeover',
        configuredBiomeCounts: { Underworld: 1 },
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome,
        occurrenceId: start,
        gameName: 'F_Opening01',
      },
    );
    const owner = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: start });
    const interactions = services.structuredWorkspace.project(
      project,
      simulateProject(catalog, project),
    ).interactions;
    const interaction = interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (interaction?.presentation !== 'candidate') {
      throw new Error('F authored takeover candidate interaction is missing');
    }

    expect(interactions.exitFrontierCapabilities.get(semanticAddressKey(owner))).toEqual({
      structural: 'createBatch',
      takeover: true,
    });

    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);

    const candidates = interaction.load();
    const queryBatches = events.filter((event) => event.kind === 'queryBatch');
    expect(queryBatches).toHaveLength(1);
    expect(queryBatches[0]?.queryCount).toBeGreaterThan(0);
    expect(candidates.map((candidate) => candidate.value.gameName)).toEqual(['F_PreBoss01']);

    events.length = 0;
    expect(interaction.load()).toBe(candidates);
    expect(events).toEqual([]);
  });

  it('does not advertise an existing decision takeover as an active frontier capability', () => {
    const services = createStructuredWorkspaceTestServices();
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('candidate-interaction-existing-takeover-start');
    const owner = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId });
    const started = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'candidate-interaction-existing-takeover',
        name: 'Candidate interaction existing takeover',
        configuredBiomeCounts: { Underworld: 1 },
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome,
        gameName: 'F_Opening01',
        occurrenceId,
      },
    );
    const project = applyProjectCommand(started, catalog, { kind: 'CreateBatch', decision: owner });
    const interactions = services.structuredWorkspace.project(
      project,
      simulateProject(catalog, project),
    ).interactions;
    const takeover = interactions.takeoverBatches.get(semanticAddressKey(owner));

    expect(takeover).toMatchObject({ action: 'replace', owner, presentation: 'candidate' });
    expect(interactions.exitFrontierCapabilities.has(semanticAddressKey(owner))).toBe(false);
    expect(interactions.structural.has(semanticAddressKey(owner))).toBe(false);
  });

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
    const underworld = createGoldenFGHIProject();
    const surface = createRepresentativeNOPQProject();
    const workspaces = [
      services.structuredWorkspace.project(underworld, evaluate(underworld)).interactions,
      services.structuredWorkspace.project(surface, evaluate(surface)).interactions,
    ] as const;

    expect(projectEvaluationCount).toBe(2);
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    for (const family of families) {
      events.length = 0;
      const interaction = firstInteraction(family, workspaces);

      const loadable =
        family === 'hubSlots'
          ? (interaction as WorkspaceHubSlotInteraction).bind(
              createOccurrenceId('candidate-interaction-hub-slot'),
            )
          : (interaction as LoadableInteraction);
      await loadable.load();

      const queryBatches = events.filter((event) => event.kind === 'queryBatch');
      expect(
        queryBatches,
        `${family} did not evaluate its expected domain batch count`,
      ).toHaveLength(expectedColdQueryBatchCounts[family]);
      expect(queryBatches.every((event) => event.queryCount > 0)).toBe(true);
      expect(projectEvaluationCount, `${family} reacquired project evaluation`).toBe(2);

      events.length = 0;
      await loadable.load();
      expect(events).toHaveLength(0);
      expect(projectEvaluationCount, `${family} repeat load reacquired project evaluation`).toBe(2);
    }
  });

  it('keeps source-owned takeover actions as explicit semantic capabilities', () => {
    const events: CandidateEvaluationEvent[] = [];
    const services = createStructuredWorkspaceTestServices({
      observeCandidateEvaluation: (event) => events.push(event),
    });
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

    const fixedWidthOneProject = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat02,
      }),
    });
    const fixedWidthOneInteractions = services.structuredWorkspace.project(
      fixedWidthOneProject,
      simulateProject(catalog, fixedWidthOneProject),
    ).interactions;
    const fixedWidthOneOwner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    const fixedWidthOneTakeover = fixedWidthOneInteractions.takeoverBatches.get(
      semanticAddressKey(fixedWidthOneOwner),
    );
    if (fixedWidthOneTakeover?.presentation !== 'fixedWidthOneTakeover') {
      throw new Error('O fixed width-one takeover capability is missing');
    }
    expect(fixedWidthOneTakeover.action).toBe('create');
    expect('load' in fixedWidthOneTakeover).toBe(false);
    expect(typeof fixedWidthOneTakeover.execute).toBe('function');
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    const fixedWidthOneResult = fixedWidthOneTakeover.execute();
    if (fixedWidthOneResult.kind !== 'command') {
      throw new Error('O fixed width-one takeover is unexpectedly unavailable');
    }
    expect(fixedWidthOneResult.command).toMatchObject({
      kind: 'CreateTakeoverBatch',
      decision: fixedWidthOneOwner,
      gameName: 'O_PreBoss01',
      targetOccurrenceIds: { exit1: expect.any(String) },
    });
    expect(events.filter((event) => event.kind === 'queryBatch')).toHaveLength(1);

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

    const repairProject = createGoldenFGHIProject();
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
    const project = createGoldenFGHIProject();
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
