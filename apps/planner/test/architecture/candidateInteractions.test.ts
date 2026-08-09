import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import type {
  WorkspaceHubVisitOrderInteraction,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { createStructuredWorkspaceTestServices } from '../fixtures/structuredWorkspace';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';
import { createGoldenFGHIProject, goldenFBiome, goldenFStartId } from '@run-planner/test-fixtures';

type LoadableInteraction = {
  readonly load: () => unknown | Promise<unknown>;
  readonly owner: { readonly routeKey?: string; readonly biomeKey?: string };
};

const families = [
  'batchRewardStores',
  'encounterPhases',
  'fieldsCageOutcomes',
  'hubSlots',
  'hubVisitOrders',
  'rewards',
  'rewardWheelOfferCounts',
  'rewardWheelPicks',
  'rewardWheelStores',
  'rooms',
  'shipCombatPhaseCounts',
  'shopPurchaseOrders',
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
  encounterPhases: 0,
  fieldsCageOutcomes: 1,
  hubSlots: 1,
  hubVisitOrders: 1,
  rewards: 14,
  rewardWheelOfferCounts: 1,
  rewardWheelPicks: 1,
  rewardWheelStores: 1,
  rooms: 1,
  shipCombatPhaseCounts: 1,
  shopPurchaseOrders: 1,
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
      simulateProjectAssembly(catalog, project),
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

  it('binds Door 1 candidates lazily from their target and decision owners', () => {
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
    const directProject = applyProjectCommand(project, catalog, {
      decision: owner,
      kind: 'CreateBatch',
    });
    const target = createTargetAddress(biome, owner.source, 'exit1');
    const interactions = services.structuredWorkspace.project(
      simulateProjectAssembly(catalog, directProject),
    ).interactions;
    const interaction = interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('F Door 1 decision-entry interaction is missing');
    }

    expect(interaction.owner).toEqual(target);
    expect(interaction.decisionOwner).toEqual(owner);
    expect(interactions.takeoverBatches.get(semanticAddressKey(owner))).toBeUndefined();
    expect(interactions.exitFrontierCapabilities.has(semanticAddressKey(owner))).toBe(false);

    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);

    const model = interaction.load();
    const queryBatches = events.filter((event) => event.kind === 'queryBatch');
    expect(queryBatches).toHaveLength(2);
    expect(queryBatches.every((event) => event.queryCount > 0)).toBe(true);
    expect(
      model.sections.flatMap((section) => section.items.map((item) => item.value.gameName)),
    ).toContain('F_PreBoss01');

    events.length = 0;
    expect(interaction.load()).toBe(model);
    expect(events).toEqual([]);
  });

  it('does not publish takeover controls for an existing normal decision', () => {
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
      simulateProjectAssembly(catalog, project),
    ).interactions;
    const takeover = interactions.takeoverBatches.get(semanticAddressKey(owner));

    expect(takeover).toBeUndefined();
    expect(interactions.exitFrontierCapabilities.has(semanticAddressKey(owner))).toBe(false);
    expect(interactions.structural.has(semanticAddressKey(owner))).toBe(false);
  });

  it('loads every family from its addressed domain without reacquiring project evaluation', async () => {
    const events: CandidateEvaluationEvent[] = [];
    let projectEvaluationCount = 0;
    const evaluate = (project: ProjectDocument) => {
      projectEvaluationCount += 1;
      return simulateProjectAssembly(catalog, project);
    };
    const services = createStructuredWorkspaceTestServices({
      observeCandidateEvaluation: (event) => events.push(event),
      yieldToHost: () => Promise.resolve(),
    });
    const underworld = createGoldenFGHIProject();
    const surface = createRepresentativeNOPQProject();
    const workspaces = [
      services.structuredWorkspace.project(evaluate(underworld)).interactions,
      services.structuredWorkspace.project(evaluate(surface)).interactions,
    ] as const;

    expect(projectEvaluationCount).toBe(2);
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    for (const family of families) {
      events.length = 0;
      const interaction = firstInteraction(family, workspaces);

      const loadable =
        family === 'hubSlots'
          ? (() => {
              const hubSlot = [
                ...workspaces[0].hubSlots.values(),
                ...workspaces[1].hubSlots.values(),
              ].find((candidate) => !candidate.selected);
              if (hubSlot === undefined) throw new Error('closed Hub-slot interaction is missing');
              return hubSlot.beginOpeningAttempt();
            })()
          : family === 'hubVisitOrders'
            ? (interaction as WorkspaceHubVisitOrderInteraction).proposalFor(
                (interaction as WorkspaceHubVisitOrderInteraction).selectedHubSlotKeys,
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
  }, 10_000);

  it('loads one Shop row as a bounded, cached exact-order candidate domain', () => {
    const events: CandidateEvaluationEvent[] = [];
    const profile = catalog.rewards.shops.byKey.Q_WorldShop;
    if (profile === undefined) throw new Error('Q Shop profile is missing');
    const offerKeys = profile.slots.values.map((slot) => slot.key);
    const shopOwner = createOccurrenceAddress(qBiome, qOccurrenceIds.preboss);
    const purchaseOwner = createShopPurchaseAddress(qBiome, qOccurrenceIds.preboss, offerKeys[0]!);
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShopPurchaseOrder',
      shop: shopOwner,
      offerKeys,
    });
    const services = createStructuredWorkspaceTestServices({
      observeCandidateEvaluation: (event) => events.push(event),
    });
    const interaction = services.structuredWorkspace
      .project(simulateProjectAssembly(catalog, project))
      .interactions.shopPurchaseOrders.get(semanticAddressKey(purchaseOwner));
    if (interaction === undefined) throw new Error('Q Shop row interaction is missing');

    expect(interaction.owner).toEqual(shopOwner);
    expect(events).toEqual([]);
    interaction.load();
    expect(events.filter((event) => event.kind === 'queryBatch')).toEqual([
      expect.objectContaining({ queryCount: 7 }),
    ]);

    events.length = 0;
    interaction.load();
    expect(events).toEqual([]);
  });

  it('retains only completed-Hub handoff and authored takeover repair as standalone actions', () => {
    const services = createStructuredWorkspaceTestServices();
    const hubHandoffProject = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'candidate-interaction-n-handoff',
        name: 'Candidate interaction N handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const hubHandoffInteractions = services.structuredWorkspace.project(
      simulateProjectAssembly(catalog, hubHandoffProject),
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
    expect(typeof hubHandoff.intent).toBe('function');

    const repairProject = createGoldenFGHIProject();
    const repairInteractions = services.structuredWorkspace.project(
      simulateProjectAssembly(catalog, repairProject),
    ).interactions;
    const repair = [...repairInteractions.takeoverBatches.values()].find(
      (interaction) => interaction.presentation === 'repair',
    );
    if (repair?.presentation !== 'repair') {
      throw new Error('F/G/H/I takeover repair capability is missing');
    }
    expect(repair.action).toBe('reconcile');
    expect('load' in repair).toBe(false);
    expect(typeof repair.intent).toBe('function');
    expect(repair.owner.biomeKey).toBe(goldenFBiome.biomeKey);
  });

  it('does not construct a command for an unavailable direct takeover choice', () => {
    const services = createStructuredWorkspaceTestServices();
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const started = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Candidate interaction unavailable direct entry',
        projectId: 'candidate-interaction-unavailable-direct-entry',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: goldenFStartId,
      },
    );
    const project = applyProjectCommand(started, catalog, { decision: owner, kind: 'CreateBatch' });
    const interaction = services.structuredWorkspace
      .project(simulateProjectAssembly(catalog, project))
      .interactions.rooms.get(
        semanticAddressKey(createTargetAddress(goldenFBiome, owner.source, 'exit1')),
      );
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('F unavailable direct-entry interaction is missing');
    }
    const unavailableTakeover = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'F_PreBoss01');
    if (unavailableTakeover === undefined) {
      throw new Error('F direct entry has no unavailable takeover for this guard');
    }

    expect(unavailableTakeover).toMatchObject({ disabled: true, state: 'impossible' });
    expect(() => interaction.intentFor(unavailableTakeover.value.gameName)).toThrow(
      /not currently authorable/,
    );
  });
});
