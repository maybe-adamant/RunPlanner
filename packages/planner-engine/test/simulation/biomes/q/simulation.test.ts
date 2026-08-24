import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNOPQProject, qBiome, qOccurrenceIds } from '@run-planner/test-fixtures/surface';

function completeQ(project = loadSurfaceNOPQProject()) {
  const evaluation = simulateProject(catalog, project);
  const route = evaluation.routes.find((candidate) => candidate.routeKey === 'Surface');
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === 'Q');
  if (biome?.authoring !== 'complete') throw new Error('Q fixture did not complete');
  return { project, evaluation, route, biome };
}

describe('Q simulation', () => {
  it('replays the scripted Summit stages and width-one takeover through the common evaluator', () => {
    const { evaluation, route, biome: q } = completeQ();
    if (q.validity !== 'valid') throw new Error('Q fixture must be valid');

    expect(evaluation.status, JSON.stringify(evaluation.findings, null, 2)).toBe('valid');
    expect(route).toMatchObject({
      status: 'valid',
      processing: { completeValidPrefix: ['N', 'O', 'P', 'Q'], active: null, blockedSuffix: [] },
    });
    const batches = q.snapshot.decisions.filter((decision) => decision.kind === 'batch');
    expect(batches.map((batch) => batch.targets.map((target) => target.room.gameName))).toEqual([
      ['Q_Combat10'],
      ['Q_Combat03'],
      ['Q_MiniBoss02', 'Q_MiniBoss05'],
      ['Q_Combat01'],
      ['Q_Combat12'],
      ['Q_MiniBoss03', 'Q_MiniBoss04'],
      ['Q_PreBoss01'],
    ]);
    expect(batches.map((batch) => batch.rewardStore.kind)).toEqual([
      'none',
      'none',
      'none',
      'none',
      'none',
      'none',
      'none',
    ]);
    expect(q.snapshot.automaticRooms.map((room) => room.gameName)).toEqual(['Q_Boss01']);
    expect(q.history.afterTransition.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
    });
    expect(
      q.roomGeneration.ordinary.forcePressure.map((entry) => entry.supportRoomGameNames),
    ).toEqual([
      ['Q_Combat10', 'Q_Combat11'],
      ['Q_Combat03', 'Q_Combat05', 'Q_Combat15'],
      ['Q_MiniBoss02', 'Q_MiniBoss05'],
      ['Q_MiniBoss02', 'Q_MiniBoss05'],
      [
        'Q_Combat01',
        'Q_Combat02',
        'Q_Combat04',
        'Q_Combat06',
        'Q_Combat07',
        'Q_Combat08',
        'Q_Combat09',
        'Q_Combat16',
      ],
      ['Q_Combat12', 'Q_Combat13', 'Q_Combat14'],
      ['Q_MiniBoss03', 'Q_MiniBoss04'],
      ['Q_MiniBoss03', 'Q_MiniBoss04'],
    ]);
    const tail = batches[5]?.targets[0]?.room;
    const eye = batches[5]?.targets[1]?.room;
    expect(tail?.encounterPhases[0]?.countsEncounterDepth).toBe(true);
    expect(eye?.encounterPhases[0]?.countsEncounterDepth).toBe(false);
    expect(tail?.incomingReward?.resolvedStoreKey).toBe('TyphonBossRewards');
    expect(eye?.incomingReward?.resolvedStoreKey).toBe('TyphonBossRewards');
  });

  it('evaluates the foyer target immediately under the fixed no-store policy', () => {
    const { project } = completeQ();
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(
          qBiome,
          { kind: 'occurrence', occurrenceId: qOccurrenceIds.intro },
          'exit1',
        ),
        gameName: 'Q_Combat10',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedPossible: true } },
    });
  });

  it('keeps the staged terminal takeover assessable from its empty envelope', () => {
    const decision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });

    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'takeoverPrebossBatch', source: decision, gameName: 'Q_PreBoss01' }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: { support: 'required', selectedPossible: true, requiredExitKeys: ['exit1'] },
    });
  });

  it('allows repeated room identities on independently generated Miniboss peers', () => {
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, qOccurrenceIds.firstMiniboss2),
      gameName: 'Q_MiniBoss02',
    });
    const { biome: q } = completeQ(project);
    if (q.validity !== 'valid') throw new Error('Q repeated-room fixture must be valid');
    const thirdBatch = q.snapshot.decisions.filter((decision) => decision.kind === 'batch')[2];

    expect(q.validity).toBe('valid');
    expect(
      thirdBatch?.kind === 'batch' && thirdBatch.targets.map((target) => target.room.gameName),
    ).toEqual(['Q_MiniBoss02', 'Q_MiniBoss02']);
  });

  it('keeps counted Typhon depletion findings at the authored incoming-reward owners', () => {
    let project = loadSurfaceNOPQProject();
    for (const occurrenceId of [
      qOccurrenceIds.firstMiniboss1,
      qOccurrenceIds.firstMiniboss2,
      qOccurrenceIds.secondMiniboss1,
      qOccurrenceIds.secondMiniboss2,
    ]) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(qBiome, occurrenceId),
        value: { rewardType: 'WeaponUpgrade' },
      });
    }
    const { biome: q } = completeQ(project);
    const owners = new Set(
      [
        qOccurrenceIds.firstMiniboss1,
        qOccurrenceIds.firstMiniboss2,
        qOccurrenceIds.secondMiniboss1,
        qOccurrenceIds.secondMiniboss2,
      ].map((occurrenceId) =>
        semanticAddressKey(createIncomingRewardAddress(qBiome, occurrenceId)),
      ),
    );

    expect(q.validity).toBe('invalid');
    expect(q.findings.some((finding) => finding.code === 'rewardBagEntryUnavailable')).toBe(true);
    expect(
      q.findings
        .filter((finding) => finding.code === 'rewardBagEntryUnavailable')
        .every((finding) => owners.has(semanticAddressKey(finding.origin))),
    ).toBe(true);
  });
});
