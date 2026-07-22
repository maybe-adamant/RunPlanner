import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createOccurrenceAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { evaluateProjectCandidate, simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPProject,
  pBiome,
  pOccurrenceId,
} from '../../../../../../apps/planner/test/fixtures/surfaceProject';

describe('P core loop', () => {
  it('replays a complete N/O/P prefix through the shared linear authorities', () => {
    const project = createRepresentativeNOPProject();
    const evaluation = simulateProject(catalog, project);

    expect(evaluation.status, JSON.stringify(evaluation.findings, null, 2)).toBe('valid');
    expect(evaluation.routes[1]).toMatchObject({
      status: 'valid',
      validatedPrefix: ['N', 'O', 'P'],
      horizon: { kind: 'routeEnd' },
      biomes: [
        { biomeKey: 'N', completion: 'complete', validity: 'valid' },
        { biomeKey: 'O', completion: 'complete', validity: 'valid' },
        { biomeKey: 'P', completion: 'complete', validity: 'valid' },
      ],
    });
    const p = evaluation.routes[1]?.biomes[2];
    expect(p?.kind).toBe('LinearBiome');
    if (p?.kind !== 'LinearBiome' || p.completion !== 'complete') {
      throw new Error('P fixture did not complete');
    }
    expect(p.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'P_Boss01',
      'P_PostBoss01',
    ]);
    expect(p.history.afterTransition.ledgers.counters.biomeDepthCache).toBe(0);
    expect(p.history.afterTransition.ledgers.counters.biomeEncounterDepth).toBe(0);

    const roomHistory = (gameName: string) => {
      const room = p.snapshot.batches
        .flatMap((batch) => batch.targets)
        .find((target) => target.room.gameName === gameName)?.room;
      const history = p.history.rooms.find(
        (candidate) =>
          room !== undefined &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
      );
      if (history === undefined) {
        throw new Error(`P fixture has no history for ${gameName}`);
      }
      return history;
    };
    const talos = roomHistory('P_MiniBoss01');
    const combat = roomHistory('P_Combat07');
    expect(talos.postCommit.ledgers.counters.biomeEncounterDepth).toBe(
      talos.entry.ledgers.counters.biomeEncounterDepth,
    );
    expect(combat.postCommit.ledgers.counters.biomeEncounterDepth).toBe(
      combat.entry.ledgers.counters.biomeEncounterDepth + 1,
    );

    expect(
      simulateProject(catalog, project, {
        simulatableBiomeKeys: ['F', 'G', 'H', 'I', 'N', 'O'],
      }).routes[1],
    ).toMatchObject({
      status: 'blocked',
      validatedPrefix: ['N', 'O'],
      horizon: { kind: 'simulatorBoundary', biomeKey: 'P' },
    });
  });

  it('rejects an indoor target on the intro outdoor exit', () => {
    const project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const p = simulateProject(catalog, project).routes[1]?.biomes[2];

    expect(p).toMatchObject({ kind: 'LinearBiome', completion: 'complete', validity: 'invalid' });
    expect(p?.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        evidence: expect.objectContaining({
          selectedGameName: 'P_Combat02',
          exclusionReasons: expect.arrayContaining(['exitIncompatible']),
        }),
      }),
    );
    expect(
      evaluateProjectCandidate(catalog, project, {
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(pBiome, pOccurrenceId('P_Combat07', 4, 1)),
        storeKey: 'RunProgress',
      }),
    ).toMatchObject({ context: 'unavailable', reason: 'upstreamInvalid' });
  });
});
