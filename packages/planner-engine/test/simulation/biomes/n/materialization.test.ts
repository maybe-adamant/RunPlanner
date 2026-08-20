import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { materializeBiomePrefix, simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  authorLegalTraitOffers,
  authorRequiredTestRoomActions,
} from '@run-planner/test-fixtures/shared';
import {
  appendNEntry,
  createRepresentativeNProject,
  nBiome,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';

function completeN() {
  const project = createRepresentativeNProject();
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
    throw new Error('N fixture did not complete-valid');
  }
  return { project, evaluation, biome };
}

function traitContext(project: ReturnType<typeof createRepresentativeNProject>) {
  const route = project.routes.find((candidate) => candidate.routeKey === 'Surface');
  if (route === undefined) throw new Error('N fixture has no Surface route');
  return route.loadout;
}

describe('canonical N Hub materialization', () => {
  it('keeps an unopened Hub structurally incomplete without inventing a board', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'n-incomplete',
      configuredBiomeCounts: { Surface: 1 },
    });
    const biome = simulateProject(catalog, authorRequiredTestRoomActions(project, catalog))
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');

    expect(biome).toMatchObject({
      authoring: 'incomplete',
      coverage: { kind: 'none', reason: 'notEvaluated' },
      frontier: createBiomeAddress('Surface', 'N'),
    });
  });

  it('marks the exact empty bounded entry for full Opening lifecycle without widening ordinary frontiers', () => {
    let project = createProjectDocument(catalog, {
      projectId: 'n-empty-entry-lifecycle',
      configuredBiomeCounts: { Surface: 1 },
    });
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: nOccurrenceIds.opening,
    });
    const reward = createIncomingRewardAddress(nBiome, nOccurrenceIds.opening);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(reward, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });

    const biome = simulateProject(catalog, authorRequiredTestRoomActions(project, catalog))
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (
      biome?.authoring !== 'incomplete' ||
      !('materializedPrefix' in biome) ||
      !('history' in biome)
    ) {
      throw new Error('N empty entry did not publish a materialized history prefix');
    }
    const openingHistory = biome.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(nBiome, nOccurrenceIds.opening)),
    );

    expect(biome.materializedPrefix.frontier).toMatchObject({
      kind: 'exitDecision',
      origin: openingDecision,
      hubContinuation: { kind: 'boundedEntry', hubKey: 'hub' },
    });
    expect(openingHistory?.postCommit?.ledgers.counters).toMatchObject({
      biomeDepthCache: 1,
      roomHistoryOrdinal: 1,
    });
    expect(openingHistory?.exit?.ledgers.counters).toMatchObject({
      biomeDepthCache: 1,
      roomHistoryOrdinal: 1,
    });
    expect(biome.history.events).toContainEqual(
      expect.objectContaining({
        kind: 'emptyOutgoingGenerationCompleted',
        origin: createOccurrenceAddress(nBiome, nOccurrenceIds.opening),
      }),
    );
  });

  it('separates declaration-owned board order from authored visit order and reuses targets', () => {
    const { project, biome } = completeN();
    const encodedBefore = encodeProjectDocument(project);
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');

    expect(biome.snapshot.entryRoom).toMatchObject({
      occurrenceId: nOccurrenceIds.opening,
      gameName: 'N_Opening01',
      lifecycleProfileKey: 'EphyraOpeningRoom',
      incomingReward: { resolvedStoreKey: 'RunProgress' },
    });
    expect(biome.snapshot.decisions[0]).toMatchObject({
      kind: 'batch',
      selectedExitKey: 'prehub',
      targets: [
        {
          exit: { kind: 'available', exitKey: 'prehub', index: 1 },
          room: { occurrenceId: nOccurrenceIds.preHub, gameName: 'N_PreHub01' },
        },
      ],
    });
    expect(hub.board.targets.map((target) => target.hubSlotKey)).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
      'combat09',
      'combat10',
      'combat11',
      'combat23',
      'miniBoss01',
    ]);
    expect(hub.visits.map((visit) => visit.target.hubSlotKey)).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat23',
      'combat09',
    ]);
    for (const visit of hub.visits) {
      const boardTarget = hub.board.targets.find(
        (target) => target.hubSlotKey === visit.target.hubSlotKey,
      );
      expect(visit.target).toBe(boardTarget);
      expect(visit.target.room.entered).toBe(true);
      expect(visit.hubRestore.room).toEqual({ origin: hub.room.origin, gameName: 'N_Hub' });
    }
    expect(hub.board.targets.find((target) => target.hubSlotKey === 'combat10')?.room.entered).toBe(
      false,
    );
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
    expect(Object.isFrozen(biome.snapshot)).toBe(true);
    expect(Object.isFrozen(hub.board.targets)).toBe(true);
  });

  it('keeps the selected PreHub terminal envelope explicit until its source-bearing Hub takeover', () => {
    const project = authorLegalTraitOffers(
      appendNEntry(
        createProjectDocument(catalog, {
          projectId: 'n-terminal-envelope',
          configuredBiomeCounts: { Surface: 1 },
        }),
      ),
    );
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan === undefined) throw new Error('N terminal-envelope fixture lost its biome plan');
    const prefix = materializeBiomePrefix(catalog, nBiome, plan, traitContext(project));
    if (prefix === null) {
      throw new Error('N terminal envelope did not materialize its selected prefix');
    }

    expect(prefix.decisions).toMatchObject([
      {
        kind: 'batch',
        selectedExitKey: 'prehub',
        targets: [{ room: { occurrenceId: nOccurrenceIds.preHub } }],
      },
    ]);
    expect(prefix.frontier?.origin).toEqual(
      createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.preHub,
      }),
    );
    expect(prefix.frontier).toMatchObject({
      kind: 'exitDecision',
      hubContinuation: { kind: 'terminalTakeover', hubKey: 'hub' },
    });

    const evaluation = simulateProject(catalog, authorRequiredTestRoomActions(project, catalog));
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (biome?.authoring !== 'incomplete' || !('history' in biome)) {
      throw new Error('N terminal envelope did not publish a history prefix');
    }
    const preHubHistory = biome.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(nBiome, nOccurrenceIds.preHub)),
    );
    expect(preHubHistory?.postCommit?.ledgers.counters).toMatchObject({
      biomeDepthCache: 2,
      roomHistoryOrdinal: 2,
    });
    expect(preHubHistory?.exit?.ledgers.counters).toMatchObject({
      biomeDepthCache: 2,
      roomHistoryOrdinal: 2,
    });
  });

  it('materializes the Hub from its persisted predecessor rather than a room-name inference', () => {
    const project = applyProjectCommand(
      appendNEntry(
        createProjectDocument(catalog, {
          projectId: 'n-hub-source',
          configuredBiomeCounts: { Surface: 1 },
        }),
      ),
      catalog,
      {
        kind: 'ReplaceWithHubDecision',
        decision: createExitDecisionAddress(nBiome, {
          kind: 'occurrence',
          occurrenceId: nOccurrenceIds.preHub,
        }),
        hub: createHubDecisionAddress(nBiome, 'hub'),
      },
    );
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    if (plan === undefined) throw new Error('N Hub-source fixture lost its biome plan');
    const prefix = materializeBiomePrefix(catalog, nBiome, plan, traitContext(project));
    if (prefix === null) throw new Error('N Hub-source fixture did not materialize');
    const hub = prefix.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('N Hub-source fixture lost its Hub decision');

    expect(prefix.decisions.map((decision) => decision.kind)).toEqual(['batch', 'hub']);
    expect(hub.source).toMatchObject({
      occurrenceId: nOccurrenceIds.preHub,
      gameName: 'N_PreHub01',
    });
    expect(prefix.frontier).toMatchObject({ kind: 'hubBoard' });
  });

  it('projects complete local slots, entered order, and parent restores', () => {
    const { biome } = completeN();
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const combat05 = hub.visits[0];
    if (combat05 === undefined) throw new Error('fixture lost first Hub visit');

    expect(combat05.localSlots.map((slot) => slot.localVisit.slotKey)).toEqual([
      'sideDoor1',
      'sideDoor2',
      'sideDoor3',
    ]);
    expect(combat05.localSlots.map((slot) => slot.localVisit.availabilityRank)).toEqual([1, 2, 3]);
    expect(combat05.localSlots.every((slot) => slot.localVisit.generation === 'generated')).toBe(
      true,
    );
    expect(combat05.enteredLocalRooms.map((room) => room.localVisit.slotKey)).toEqual([
      'sideDoor2',
      'sideDoor1',
    ]);
    expect(
      combat05.parentRestores.map((restore) => semanticAddressKey(restore.room.origin)),
    ).toEqual([
      semanticAddressKey(combat05.target.room.origin),
      semanticAddressKey(combat05.target.room.origin),
    ]);
  });

  it('materializes the completed-Hub handoff and declaration-derived completion rooms', () => {
    const { biome } = completeN();
    const handoff = biome.snapshot.decisions.at(-1);

    expect(handoff).toMatchObject({
      kind: 'batch',
      source: { kind: 'hubDecision', decisionKey: 'hub' },
      selectedExitKey: 'preboss',
      targets: [
        {
          exit: {
            kind: 'available',
            exitKey: 'preboss',
            index: 1,
            type: 'EphyraExitBossDoor',
            compatibilityPolicyKey: 'Unconstrained',
          },
          room: {
            occurrenceId: nOccurrenceIds.preboss,
            gameName: 'N_PreBoss01',
            entryState: { kind: 'shop' },
          },
        },
      ],
    });
    expect(biome.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'N_Boss01',
      'N_PostBoss01',
    ]);
  });

  it('keeps a completed Hub composable at its Hub-owned handoff frontier', () => {
    const withoutHandoff = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    });
    const biome = simulateProject(catalog, withoutHandoff)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (biome?.authoring !== 'incomplete') throw new Error('N handoff fixture did not remain open');
    if (biome.coverage.kind !== 'prefix') throw new Error('N handoff fixture lost prefix coverage');
    if (!('history' in biome)) throw new Error('N handoff fixture did not compose history');

    expect(biome).toMatchObject({
      coverage: {
        kind: 'prefix',
        through: {
          owner: createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
            kind: 'hubDecision',
            decisionKey: 'hub',
          }),
        },
      },
      frontier: createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    });
    expect(biome.history.events.some((event) => event.kind === 'roomCreated')).toBe(true);
  });
});
