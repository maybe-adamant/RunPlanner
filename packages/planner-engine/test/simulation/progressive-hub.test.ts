import {
  applyProjectCommand,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  evaluateProjectCandidate,
  simulateProject,
} from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  createEmptyNProject,
  createRepresentativeNOProject,
  createRepresentativeNProject,
  nBiome,
  nFixedOccurrenceIds,
  nOccurrenceId,
  nOpenSlotKeys,
} from '../../../../apps/planner/test/fixtures/surfaceProject';

function removeVisitsFrom(project: ReturnType<typeof createRepresentativeNProject>, index: number) {
  return applyProjectCommand(project, catalog, {
    kind: 'RemoveHubVisitsFrom',
    visit: createHubVisitAddress(nBiome, index),
  });
}

function incompleteOpenBoard() {
  let project = applyProjectCommand(createEmptyNProject(), catalog, {
    kind: 'CreateHubTopology',
    biome: nBiome,
    fixedOccurrenceIds: nFixedOccurrenceIds,
  });
  for (const hubSlotKey of nOpenSlotKeys.slice(0, 8)) {
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, hubSlotKey),
      occurrenceId: nOccurrenceId(hubSlotKey),
    });
  }
  return project;
}

function incompleteEvaluation(project: ReturnType<typeof createRepresentativeNProject>) {
  const route = simulateProject(catalog, project).routes.find(
    (candidate) => candidate.routeKey === 'Surface',
  );
  const evaluation = route?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (
    evaluation?.kind !== 'HubBiome' ||
    evaluation.authoring !== 'incomplete' ||
    !('materializedPrefix' in evaluation)
  ) {
    throw new Error('N did not produce a progressively evaluated Hub prefix');
  }
  return { route, evaluation };
}

describe('Hub progressive biome evaluation', () => {
  it('covers fixed entry and stops before an incomplete joint Hub board', () => {
    const project = incompleteOpenBoard();
    const { evaluation } = incompleteEvaluation(project);

    expect(evaluation.frontier).toEqual({
      kind: 'hubOpenSet',
      routeKey: 'Surface',
      biomeKey: 'N',
    });
    expect(evaluation.coverage).toEqual({
      kind: 'prefix',
      through: {
        owner: evaluation.materializedPrefix.hubRoom!.origin,
        checkpoint: 'beforeTargetGeneration',
      },
    });
    expect(evaluation.materializedPrefix.entryRooms.map((room) => room.gameName)).toEqual([
      'N_Opening01',
      'N_PreHub01',
    ]);
    expect(evaluation.materializedPrefix.hubBoard).toBeUndefined();
    expect(evaluation.history.ledgers.roomCreations).toHaveLength(3);
    expect(
      evaluation.history.events.some(
        (event) => event.kind === 'roomCreated' && event.source === 'hubTarget',
      ),
    ).toBe(false);
    const ninthSlotKey = nOpenSlotKeys[8]!;
    expect(
      evaluateProjectCandidate(catalog, project, {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, ninthSlotKey),
        open: true,
        occurrenceId: nOccurrenceId(ninthSlotKey),
      }),
    ).toMatchObject({
      context: 'unavailable',
      reason: 'coverageNotReached',
      evidence: {
        kind: 'coverageNotReached',
        requiredOwner: createHubSlotAddress(nBiome, ninthSlotKey),
        requiredCheckpoint: 'afterTargetGeneration',
      },
    });
  });

  it('publishes the complete open board as one semantic generation region', () => {
    const { evaluation } = incompleteEvaluation(
      removeVisitsFrom(createRepresentativeNProject(), 1),
    );

    expect(evaluation.coverage).toEqual({
      kind: 'prefix',
      through: {
        owner: evaluation.materializedPrefix.hubBoard?.origin,
        checkpoint: 'afterTargetGeneration',
      },
    });
    expect(evaluation.materializedPrefix.hubBoard?.targets).toHaveLength(9);
    expect(
      evaluation.materializedPrefix.hubBoard?.targets.every((target) => !target.room.entered),
    ).toBe(true);
    expect(
      evaluation.history.ledgers.roomCreations.filter((event) => event.source === 'hubTarget'),
    ).toHaveLength(9);
    expect(evaluation.rewards.rewardLookups.hubRewardLookup).toHaveLength(6);
  });

  it('extends board coverage through complete visits and parent-local side state', () => {
    const { evaluation } = incompleteEvaluation(
      removeVisitsFrom(createRepresentativeNProject(), 4),
    );

    expect(evaluation.materializedPrefix.visits).toHaveLength(3);
    expect(evaluation.coverage).toEqual({
      kind: 'prefix',
      through: {
        owner: createHubVisitAddress(nBiome, 3),
        checkpoint: 'afterRoomLifecycle',
      },
    });
    expect(evaluation.history.current.ledgers.counters).toMatchObject({
      soulPylonsSpawned: 3,
      soulPylonsCompleted: 3,
      numSubRoomsSpawned: 5,
    });
    expect(evaluation.roomGeneration.sideRoomGenerations.length).toBeGreaterThan(0);
    expect(evaluation.history.events.some((event) => event.kind === 'biomeCompleted')).toBe(false);
  });

  it('clamps an unsupported joint board before every retained visit', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'miniBoss02'),
      occurrenceId: nOccurrenceId('miniBoss02'),
    });
    project = removeVisitsFrom(project, 4);
    const { evaluation } = incompleteEvaluation(project);

    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: {
        owner: evaluation.materializedPrefix.hubBoard?.origin,
        checkpoint: 'afterTargetGeneration',
      },
      blockedAt: createHubSlotAddress(nBiome, 'miniBoss01'),
    });
    expect(evaluation.materializedPrefix.visits).toHaveLength(0);
    expect(evaluation.materializedPrefix.frontierVisit).toBeUndefined();
    expect(
      evaluation.materializedPrefix.hubBoard?.targets.every((target) => !target.room.entered),
    ).toBe(true);
    expect(evaluation.roomGeneration.findings).toContainEqual(
      expect.objectContaining({ code: 'hubOpenSlotUnavailable' }),
    );
    expect(project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0]).toMatchObject({
      topology: { visitOrder: expect.arrayContaining(['combat05', 'miniBoss01', 'combat02']) },
    });
    expect(
      evaluateProjectCandidate(catalog, project, {
        kind: 'hubVisit',
        visit: createHubVisitAddress(nBiome, 1),
        hubSlotKey: 'combat05',
      }),
    ).toMatchObject({
      context: 'unavailable',
      reason: 'coverageNotReached',
      evidence: {
        kind: 'coverageNotReached',
        requiredOwner: createHubVisitAddress(nBiome, 1),
      },
    });
    expect(
      evaluateProjectCandidate(catalog, project, {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'miniBoss02'),
        open: true,
        occurrenceId: nOccurrenceId('miniBoss02'),
      }),
    ).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      findings: [
        {
          code: 'hubOpenSlotUnavailable',
          origin: createHubSlotAddress(nBiome, 'miniBoss02'),
        },
      ],
    });
  });

  it('clamps an unsupported Hub reward at the same atomic board boundary', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = removeVisitsFrom(project, 4);
    const { evaluation } = incompleteEvaluation(project);

    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: {
        owner: evaluation.materializedPrefix.hubBoard?.origin,
        checkpoint: 'afterTargetGeneration',
      },
      blockedAt: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
    });
    expect(evaluation.materializedPrefix.visits).toHaveLength(0);
    expect(evaluation.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable' }),
    );
  });

  it('clamps unsupported side generation inside its visit and withholds later visits', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    project = removeVisitsFrom(project, 4);
    const { evaluation } = incompleteEvaluation(project);

    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: {
        owner: createHubVisitAddress(nBiome, 1),
        checkpoint: 'afterTargetGeneration',
      },
      blockedAt: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
    });
    expect(evaluation.materializedPrefix.visits).toHaveLength(0);
    expect(evaluation.materializedPrefix.frontierVisit).toMatchObject({
      kind: 'sideGeneration',
      visitIndex: 1,
    });
    expect(evaluation.roomGeneration.findings).toContainEqual(
      expect.objectContaining({ code: 'sideRoomGenerationUnavailable' }),
    );
    expect(evaluation.history.current.ledgers.counters).toMatchObject({
      soulPylonsSpawned: 1,
      soulPylonsCompleted: 1,
    });
  });

  it('uses the selected progressive frontier for an incomplete Hub candidate region', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = removeVisitsFrom(project, 4);
    const sideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const query = {
      kind: 'sideRoomGeneration' as const,
      sideRoom,
      generation: 'notGenerated' as const,
    };
    const candidate = evaluateProjectCandidate(catalog, project, query);
    const proposal = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom,
      generation: query.generation,
    });
    const { evaluation } = incompleteEvaluation(proposal);

    expect(evaluation.materializedPrefix.frontierVisit).toMatchObject({
      kind: 'sideGeneration',
      visitIndex: 1,
    });
    expect(candidate).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      findings: evaluation.roomGeneration.findings.filter(
        (finding) => finding.code === 'sideRoomGenerationUnavailable',
      ),
    });
  });

  it('returns progressive candidate results for every open Hub visit alternative', () => {
    const project = createRepresentativeNProject();
    const session = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    );
    const candidates = session.evaluate(
      nOpenSlotKeys.map((hubSlotKey) => ({
        kind: 'hubVisit' as const,
        visit: createHubVisitAddress(nBiome, 1),
        hubSlotKey,
      })),
    );

    expect(candidates).toHaveLength(nOpenSlotKeys.length);
    expect(candidates.every((candidate) => candidate.context === 'evaluated')).toBe(true);
  });

  it('clamps an unsupported joint side reward at the parent generation region', () => {
    let project = createRepresentativeNProject();
    for (const sideSlotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          sideSlotKey,
        ),
        value: { rewardType: 'AirBoost' },
      });
    }
    project = removeVisitsFrom(project, 4);
    const { evaluation } = incompleteEvaluation(project);

    expect(evaluation.coverage).toMatchObject({
      kind: 'prefix',
      through: {
        owner: createHubVisitAddress(nBiome, 1),
        checkpoint: 'afterTargetGeneration',
      },
      blockedAt: createLocalRewardAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor2',
      ),
    });
    expect(evaluation.materializedPrefix.frontierVisit).toMatchObject({
      kind: 'sideGeneration',
      visitIndex: 1,
    });
    expect(evaluation.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable' }),
    );
  });

  it('blocks O while preserving N prefix coverage and retained O authorship', () => {
    const project = removeVisitsFrom(createRepresentativeNOProject(), 4);
    const surface = simulateProject(catalog, project).routes.find(
      (candidate) => candidate.routeKey === 'Surface',
    );

    expect(surface?.configuredBiomeKeys).toEqual(['N', 'O']);
    expect(surface?.biomes).toHaveLength(1);
    expect(surface?.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'incomplete', biomeKey: 'N' },
      blockedSuffix: ['O'],
    });
    expect(project.routes.find((route) => route.routeKey === 'Surface')?.biomes).toHaveLength(2);
  });

  it('strengthens complete N to the existing canonical result', () => {
    const surface = simulateProject(catalog, createRepresentativeNProject()).routes.find(
      (candidate) => candidate.routeKey === 'Surface',
    );
    const evaluation = surface?.biomes[0];

    expect(evaluation).toMatchObject({
      kind: 'HubBiome',
      biomeKey: 'N',
      authoring: 'complete',
      coverage: { kind: 'complete' },
      validity: 'valid',
    });
    expect(evaluation !== undefined && 'materializedPrefix' in evaluation).toBe(false);
  });

  it('is deterministic, deeply frozen, and does not mutate partial authorship', () => {
    const project = removeVisitsFrom(createRepresentativeNProject(), 4);
    const before = JSON.stringify(project);
    const first = simulateProject(catalog, project);
    const second = simulateProject(catalog, project);
    const evaluation = first.routes.find((route) => route.routeKey === 'Surface')?.biomes[0];

    expect(second).toEqual(first);
    expect(JSON.stringify(project)).toBe(before);
    expect(Object.isFrozen(evaluation)).toBe(true);
    if (
      evaluation?.kind !== 'HubBiome' ||
      evaluation.authoring !== 'incomplete' ||
      !('materializedPrefix' in evaluation)
    ) {
      throw new Error('N did not produce a materialized prefix');
    }
    expect(Object.isFrozen(evaluation.materializedPrefix)).toBe(true);
    expect(Object.isFrozen(evaluation.history.events)).toBe(true);
    expect(Object.isFrozen(evaluation.rewards.branches)).toBe(true);
  });
});
