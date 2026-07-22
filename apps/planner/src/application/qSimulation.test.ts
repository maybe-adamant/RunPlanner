import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  simulateProject,
} from '@run-planner/engine';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNOPQProject, qBiome, qOccurrenceIds } from '../testing/surfaceProject';

describe('dormant Q simulation', () => {
  it('replays the scripted Summit sequence through exact stage and lifecycle authorities', () => {
    const evaluation = simulateProject(catalog, createRepresentativeNOPQProject());

    expect(evaluation.status, JSON.stringify(evaluation.findings, null, 2)).toBe('valid');
    expect(evaluation.routes[1]).toMatchObject({
      status: 'valid',
      validatedPrefix: ['N', 'O', 'P', 'Q'],
      horizon: { kind: 'routeEnd' },
    });
    const q = evaluation.routes[1]?.biomes[3];
    if (q?.kind !== 'LinearBiome' || q.completion !== 'complete') {
      throw new Error('Q fixture did not complete');
    }
    expect(
      q.snapshot.batches.map((batch) => batch.targets.map((target) => target.room.gameName)),
    ).toEqual([
      ['Q_Combat10'],
      ['Q_Combat03'],
      ['Q_MiniBoss02', 'Q_MiniBoss05'],
      ['Q_Combat01'],
      ['Q_Combat12'],
      ['Q_MiniBoss03', 'Q_MiniBoss04'],
    ]);
    expect(q.snapshot.batches.every((batch) => batch.rewardStore.kind === 'none')).toBe(true);
    expect(q.snapshot.completionRooms.map((room) => room.gameName)).toEqual(['Q_Boss01']);
    expect(q.history.afterTransition.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
    });
    expect(q.roomGeneration.forcePressure.map((entry) => entry.supportRoomGameNames)).toEqual([
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
      ['Q_PreBoss01'],
    ]);
    expect(q.roomGeneration.forcePressure.map((entry) => entry.biomeDepthCache)).toEqual([
      1, 2, 3, 3, 4, 5, 6, 6, 7,
    ]);

    const tail = q.snapshot.batches[5]?.targets[0]?.room;
    const eye = q.snapshot.batches[5]?.targets[1]?.room;
    expect(tail?.encounterPhases[0]?.countsEncounterDepth).toBe(true);
    expect(eye?.encounterPhases[0]?.countsEncounterDepth).toBe(false);
    expect(tail?.incomingReward?.resolvedStoreKey).toBe('TyphonBossRewards');
    expect(eye?.incomingReward?.resolvedStoreKey).toBe('TyphonBossRewards');
  });

  it('allows repeated room identities on independently generated miniboss peers', () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, qOccurrenceIds.firstMiniboss2),
      gameName: 'Q_MiniBoss02',
    });
    const q = simulateProject(catalog, project).routes[1]?.biomes[3];

    expect(q).toMatchObject({ kind: 'LinearBiome', completion: 'complete', validity: 'valid' });
    if (q?.kind !== 'LinearBiome' || q.completion !== 'complete') {
      throw new Error('Q repeated-peer fixture did not complete');
    }
    expect(q.snapshot.batches[2]?.targets.map((target) => target.room.gameName)).toEqual([
      'Q_MiniBoss02',
      'Q_MiniBoss02',
    ]);
  });

  it('reports counted Typhon reward depletion at the authored reward origins', () => {
    let project = createRepresentativeNOPQProject();
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

    const q = simulateProject(catalog, project).routes[1]?.biomes[3];
    expect(q).toMatchObject({ kind: 'LinearBiome', completion: 'complete', validity: 'invalid' });
    expect(q?.findings.some((finding) => finding.code === 'rewardBagEntryUnavailable')).toBe(true);
    const minibossOrigins = new Set(
      [
        qOccurrenceIds.firstMiniboss1,
        qOccurrenceIds.firstMiniboss2,
        qOccurrenceIds.secondMiniboss1,
        qOccurrenceIds.secondMiniboss2,
      ].map((occurrenceId) =>
        semanticAddressKey(createIncomingRewardAddress(qBiome, occurrenceId)),
      ),
    );
    expect(
      q?.findings
        .filter((finding) => finding.code === 'rewardBagEntryUnavailable')
        .every((finding) => minibossOrigins.has(semanticAddressKey(finding.origin))),
    ).toBe(true);
  });
});
