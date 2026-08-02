import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPProject,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';
import { evaluateProgressiveBiomeAssembly } from '../../../../src/simulation/progressive/biome';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../../../src/simulation/project';

function completeP() {
  const evaluation = simulateProject(catalog, createRepresentativeNOPProject());
  const route = evaluation.routes.find((candidate) => candidate.routeKey === 'Surface');
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === 'P');
  if (biome?.authoring !== 'complete') throw new Error('P fixture did not complete');
  return { evaluation, route, biome };
}

describe('P core loop', () => {
  it('replays the complete N/O/P prefix through ordinary batches and takeover completion', () => {
    const { evaluation, route, biome: p } = completeP();

    expect(evaluation.status, JSON.stringify(evaluation.findings, null, 2)).toBe('valid');
    expect(route).toMatchObject({
      status: 'valid',
      processing: {
        completeValidPrefix: ['N', 'O', 'P'],
        active: null,
        blockedSuffix: [],
      },
    });
    const batches = p.snapshot.decisions.filter((decision) => decision.kind === 'batch');
    expect(batches).toHaveLength(9);
    expect(batches.at(-1)).toMatchObject({
      source: { kind: 'occurrence' },
      selectedExitKey: 'exit1',
      targets: [
        { room: { gameName: 'P_PreBoss01', entryState: { kind: 'shop' } } },
        { room: { gameName: 'P_PreBoss01' } },
      ],
    });
    expect(p.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'P_Boss01',
      'P_PostBoss01',
    ]);
    expect(p.history.afterTransition.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
    });

    const preboss = batches.at(-1);
    if (preboss?.kind !== 'batch') throw new Error('P takeover batch is missing');
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, createRepresentativeNOPProject()),
      ).evaluate({
        kind: 'takeoverPrebossBatch',
        source: preboss.origin,
        gameName: 'P_PreBoss01',
      }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: {
        support: 'required',
        selectedPossible: true,
        requiredExitKeys: ['exit1', 'exit2'],
      },
    });

    const roomHistory = (gameName: string) => {
      const room = batches
        .flatMap((batch) => batch.targets)
        .find((target) => target.room.gameName === gameName)?.room;
      const history = p.history.rooms.find(
        (candidate) =>
          room !== undefined &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
      );
      if (history === undefined) throw new Error(`P fixture has no history for ${gameName}`);
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
  });

  it('retains an incompatible outdoor choice at its occurrence owner and evaluates candidate support', () => {
    const firstTarget = pOccurrenceId('P_Combat03', 1, 1);
    const project = applyProjectCommand(createRepresentativeNOPProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, firstTarget),
      gameName: 'P_Combat02',
    });
    const evaluation = simulateProject(catalog, project);
    const p = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P');
    if (p?.authoring !== 'complete') throw new Error('P fixture did not complete');

    expect(p.validity).toBe('invalid');
    expect(p.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: createTargetAddress(
          pBiome,
          { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
          'exit1',
        ),
        evidence: expect.objectContaining({
          selectedGameName: 'P_Combat02',
          exclusionReasons: expect.arrayContaining(['exitIncompatible']),
        }),
      }),
    );
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(
      candidates.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(
          pBiome,
          { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
          'exit1',
        ),
        gameName: 'P_Combat02',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          selectedGameName: 'P_Combat02',
          selectedPossible: false,
          selectedExclusionReasons: expect.arrayContaining(['exitIncompatible']),
        },
      },
    });
    expect(
      candidates.evaluate({
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(
          pBiome,
          createExitDecisionAddress(pBiome, {
            kind: 'occurrence',
            occurrenceId: pOccurrenceId('P_Combat07', 4, 1),
          }).source,
        ),
        storeKey: 'RunProgress',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('uses the complete-invalid sole-owner lifecycle artifact when the prefix cannot reach the Shop', () => {
    const purchase = createShopPurchaseAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
    let project = createRepresentativeNOPProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon'),
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase,
      purchased: true,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluation = assembly.evaluation;
    const surface = evaluation.routes.find((route) => route.routeKey === 'Surface');
    const p = surface?.biomes.find((biome) => biome.biomeKey === 'P');

    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'shopPurchaseUnavailable', origin: purchase }),
    );
    expect(p).toMatchObject({ authoring: 'complete', validity: 'invalid' });
    const previous = surface?.biomes.find((biome) => biome.biomeKey === 'O');
    const plan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P');
    const progressive =
      previous?.authoring === 'complete' && plan !== undefined
        ? evaluateProgressiveBiomeAssembly(catalog, pBiome, plan, 3, {
            history: previous.history,
            rewardBranches: previous.rewards.branches,
          })
        : null;
    const shopOwner = createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop);
    expect(progressive).not.toBeNull();
    expect(progressive?.evaluation.blockedAt).toBeUndefined();
    expect(progressive?.candidateArtifacts.roomLifecycles.shopAt(shopOwner)).toBeUndefined();
    expect(
      candidateArtifactsForProjectEvaluationAssembly(assembly)
        .biomeAt(pBiome)
        ?.roomLifecycles.shopAt(shopOwner),
    ).toBeDefined();
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'shopPurchase',
        purchase,
        purchased: false,
      }),
    ).toEqual({ kind: 'shopPurchase', result: { supported: true, findings: [] } });
  });
});
