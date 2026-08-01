import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  CandidateEvaluationContractError,
  type CandidateEvaluationEvent,
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';

import {
  createCompleteFTakeoverProject,
  createFOpeningBatch,
  createFStart,
  createUnresolvedFOpeningBatch,
  fBiome,
  fCombatId,
  fDecision,
  fStartId,
} from '../../support/f-takeover-project';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
  type FGenerationBatchSpec,
} from '../../support/f-generation-project';

const validPrefixBatches: readonly FGenerationBatchSpec[] = Object.freeze([
  { targets: ['F_Combat02'], pickedExitIndex: 1 },
  {
    targets: ['F_Combat03', 'F_Combat03'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'MaxHealthDrop' }, { rewardType: 'MaxManaDrop' }],
  },
  {
    targets: ['F_Combat04', 'F_Combat04'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'RoomMoneyDrop' }, { rewardType: 'WeaponUpgrade' }],
  },
  {
    targets: ['F_Combat05', 'F_Combat11'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'HermesUpgrade' }, { rewardType: 'SpellDrop' }],
  },
  {
    targets: ['F_Combat06', 'F_Combat06'],
    pickedExitIndex: 1,
    storeKey: 'MetaProgress',
    offers: [{ rewardType: 'MetaCurrencyDrop' }, { rewardType: 'MetaCardPointsCommonDrop' }],
  },
]);

function validPrefixProject(): ProjectDocument {
  return createFGenerationProject(validPrefixBatches, { includeTakeover: false });
}

const shopPrefixBatches: readonly FGenerationBatchSpec[] = Object.freeze([
  ...validPrefixBatches.slice(0, 4),
  {
    targets: ['F_Shop01', 'F_Combat11'],
    pickedExitIndex: 1,
    storeKey: 'MetaProgress',
    offers: [undefined, { rewardType: 'MetaCurrencyDrop' }],
  },
  {
    targets: ['F_MiniBoss01', 'F_MiniBoss02'],
    pickedExitIndex: 1,
    offers: [
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    ],
  },
]);

function shopPrefixProject(): ProjectDocument {
  return createFGenerationProject(shopPrefixBatches, { includeTakeover: false });
}

const boonPrefixBatches: readonly FGenerationBatchSpec[] = Object.freeze([
  validPrefixBatches[0]!,
  {
    targets: ['F_Combat03', 'F_Combat03'],
    pickedExitIndex: 1,
    offers: [
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    ],
  },
  {
    targets: ['F_Combat04', 'F_Combat04'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'MaxHealthDrop' }, { rewardType: 'MaxManaDrop' }],
  },
  {
    targets: ['F_Combat05', 'F_Combat11'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'RoomMoneyDrop' }, { rewardType: 'WeaponUpgrade' }],
  },
  {
    targets: ['F_Combat06', 'F_Combat06'],
    pickedExitIndex: 1,
    storeKey: 'MetaProgress',
    offers: [{ rewardType: 'MetaCurrencyDrop' }, { rewardType: 'MetaCardPointsCommonDrop' }],
  },
]);

function boonPrefixProject(): ProjectDocument {
  return createFGenerationProject(boonPrefixBatches, { includeTakeover: false });
}

function candidateSession(project: ProjectDocument) {
  return createPreparedProjectCandidateSession(catalog, simulateProjectAssembly(catalog, project));
}

function roomCandidate(
  project: ProjectDocument,
  batches: readonly FGenerationBatchSpec[],
  batchIndex: number,
  exitIndex: number,
  gameName: string,
) {
  return candidateSession(project).evaluate({
    kind: 'roomTarget',
    target: fGenerationTargetAddress(batches, batchIndex, exitIndex),
    gameName,
  });
}

describe('F candidate support', () => {
  it('keeps a reward-valid selected prefix live at its next ordinary target frontier', () => {
    const project = validPrefixProject();
    const evaluation = simulateProject(catalog, project);
    const target = fGenerationTargetAddress(validPrefixBatches, 6, 1);

    expect(evaluation.status).toBe('incomplete');
    expect(evaluation.findings).toMatchObject([
      { code: 'continuationMissing', origin: createExitDecisionAddress(fBiome, target.source) },
    ]);
    expect(
      candidateSession(project).evaluate([
        { kind: 'roomTarget', target, gameName: 'F_MiniBoss03' },
        { kind: 'roomTarget', target, gameName: 'F_Combat20' },
      ]),
    ).toMatchObject([
      {
        kind: 'roomTarget',
        result: {
          pressure: {
            selectedGameName: 'F_MiniBoss03',
            selectedPossible: true,
            requiredForcedRoomGameNames: expect.arrayContaining(['F_MiniBoss01']),
          },
        },
      },
      {
        kind: 'roomTarget',
        result: {
          pressure: {
            selectedGameName: 'F_Combat20',
            selectedPossible: false,
            selectedExclusionReasons: ['forcedPool'],
          },
        },
      },
    ]);
  });

  it('reports a possible authored target and matches its applied replacement pressure', () => {
    const project = createFGenerationProject();
    const target = fGenerationTargetAddress(fGenerationBaselineBatches, 1, 1);
    const candidate = roomCandidate(project, fGenerationBaselineBatches, 1, 1, 'F_Combat01');
    const selected = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, fGenerationOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    const selectedBiome = simulateProject(catalog, selected).routes[0]?.biomes[0];

    expect(candidate).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: { selectedGameName: 'F_Combat01', selectedPossible: true },
        findings: [],
      },
    });
    if (selectedBiome?.authoring !== 'complete' || !('roomGeneration' in selectedBiome)) {
      throw new Error('F candidate parity fixture did not preserve complete F evaluation');
    }
    const selectedPressure = selectedBiome.roomGeneration.ordinary.forcePressure.find(
      (entry) => semanticAddressKey(entry.targetOrigin) === semanticAddressKey(target),
    );
    if (candidate.kind !== 'roomTarget') throw new Error('expected a room-target candidate');
    expect(candidate.result.pressure).toMatchObject({
      selectedGameName: selectedPressure?.selectedGameName,
      selectedPossible: selectedPressure?.selectedPossible,
      selectedExclusionReasons: selectedPressure?.selectedExclusionReasons,
      requiredForcedRoomGameNames: selectedPressure?.requiredForcedRoomGameNames,
      supportRoomGameNames: selectedPressure?.supportRoomGameNames,
    });
    expect(candidate.result.findings).toEqual(
      selectedBiome.roomGeneration.ordinary.findings.filter(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(target),
      ),
    );
    expect(selectedBiome.roomGeneration.ordinary.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: createTargetAddress(
          fBiome,
          { kind: 'occurrence', occurrenceId: fGenerationOccurrenceId(1, 1) },
          'exit2',
        ),
        evidence: expect.objectContaining({ exclusionReasons: ['physicalExitUnavailable'] }),
      }),
    );
  });

  it('evaluates an entered ordinary Shop while retaining its unpicked peer as a non-owner', () => {
    const project = shopPrefixProject();
    const shopId = fGenerationOccurrenceId(5, 1);
    const shop = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === shopId,
    );
    if (shop?.state.kind !== 'shop' || shop.state.shop === undefined) {
      throw new Error('F Shop prefix did not materialize its declaration-owned inventory');
    }
    const [offerKey, offer] = Object.entries(shop.state.shop.offers)[0] ?? [];
    if (offerKey === undefined || offer === undefined) throw new Error('F Shop has no offer');

    const evaluation = simulateProject(catalog, project);
    expect(evaluation.status).toBe('incomplete');
    expect(evaluation.findings).toMatchObject([{ code: 'continuationMissing' }]);
    const results = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate([
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(fBiome, shopId, offerKey),
        value: offer.offer,
      },
      {
        kind: 'shopPurchase',
        purchase: createShopPurchaseAddress(fBiome, shopId, offerKey),
        purchased: offer.purchased,
      },
    ]);

    expect(results).toEqual([
      { kind: 'shopOffer', result: { supported: true, findings: [] } },
      { kind: 'shopPurchase', result: { supported: true, findings: [] } },
    ]);
  });

  it('preserves same-batch Boon-source peer exclusion at the incoming-reward owner', () => {
    const project = boonPrefixProject();
    const reward = createIncomingRewardAddress(fBiome, fGenerationOccurrenceId(2, 2));
    const result = candidateSession(project).evaluate({
      kind: 'incomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });

    expect(result).toMatchObject({
      kind: 'incomingReward',
      result: {
        supported: false,
        findings: [
          expect.objectContaining({
            code: 'rewardSourceUnavailable',
            origin: reward,
            evidence: expect.objectContaining({ source: 'ZeusUpgrade' }),
          }),
        ],
      },
    });
  });

  it('keeps Devotion source-pair validation typed rather than accepting an unacquired source', () => {
    const project = boonPrefixProject();
    const reward = createIncomingRewardAddress(fBiome, fGenerationOccurrenceId(4, 1));
    const result = candidateSession(project).evaluate({
      kind: 'incomingReward',
      reward,
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'HestiaUpgrade',
        },
      },
    });

    expect(result).toMatchObject({
      kind: 'incomingReward',
      result: {
        supported: false,
        findings: [
          expect.objectContaining({
            code: 'rewardSourceUnavailable',
            origin: reward,
            evidence: expect.objectContaining({
              chosenSource: 'ApolloUpgrade',
              spurnedSource: 'HestiaUpgrade',
            }),
          }),
        ],
      },
    });
  });

  it('evaluates start, store, and the first physical target frontier without authoring a target', () => {
    const project = createFOpeningBatch();
    const before = JSON.stringify(project);
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const target = createTargetAddress(fBiome, fDecision().source, 'exit1');
    const results = session.evaluate([
      {
        kind: 'startRoom',
        owner: createOccurrenceAddress(fBiome, fStartId),
        gameName: 'F_Opening02',
      },
      {
        kind: 'startRoom',
        owner: createOccurrenceAddress(fBiome, fStartId),
        gameName: 'F_Combat01',
      },
      {
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(fBiome, fDecision().source),
        storeKey: 'MetaProgress',
      },
      {
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(fBiome, fDecision().source),
        storeKey: 'RunProgress',
      },
      { kind: 'roomTarget', target, gameName: 'F_Combat02' },
      { kind: 'roomTarget', target, gameName: 'F_MiniBoss01' },
    ]);

    expect(results).toMatchObject([
      {
        kind: 'startRoom',
        result: { selectedPossible: true },
      },
      { kind: 'startRoom', result: { selectedPossible: false } },
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'MetaProgress', selectedPossible: true },
      },
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'RunProgress', selectedPossible: false },
      },
      {
        kind: 'roomTarget',
        result: {
          pressure: { selectedGameName: 'F_Combat02', selectedPossible: true },
          findings: [],
        },
      },
      {
        kind: 'roomTarget',
        result: {
          pressure: {
            selectedGameName: 'F_MiniBoss01',
            selectedPossible: false,
            selectedExclusionReasons: ['forceMinimum', 'eligibilityRequirement'],
            selectedExclusions: expect.arrayContaining([
              expect.objectContaining({
                kind: 'forceMinimum',
                axis: 'biomeDepthCache',
                actual: 0,
                minimum: 4,
              }),
            ]),
          },
        },
      },
    ]);
    expect(JSON.stringify(project)).toBe(before);
  });

  it('evaluates an unresolved F base store from its source prefix and blocks its dependent target', () => {
    const project = createUnresolvedFOpeningBatch(createFStart());
    const rewardStore = createBatchRewardStoreAddress(fBiome, fDecision().source);
    const target = createTargetAddress(fBiome, fDecision().source, 'exit1');

    expect(
      candidateSession(project).evaluate([
        { kind: 'batchRewardStore', rewardStore, storeKey: 'MetaProgress' },
        { kind: 'batchRewardStore', rewardStore, storeKey: 'RunProgress' },
        { kind: 'roomTarget', target, gameName: 'F_Combat02' },
      ]),
    ).toMatchObject([
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'MetaProgress', selectedPossible: true },
      },
      {
        kind: 'batchRewardStore',
        result: { selectedStoreKey: 'RunProgress', selectedPossible: false },
      },
      { kind: 'unavailable', reason: 'authoredPrerequisiteMissing' },
    ]);
  });

  it('keeps takeover Preboss selection source-owned instead of exposing its targets as ordinary rooms', () => {
    const project = createCompleteFTakeoverProject();
    const session = candidateSession(project);

    expect(
      session.evaluate({
        kind: 'takeoverPrebossBatch',
        source: fDecision(fCombatId),
        gameName: 'F_PreBoss01',
      }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: {
        gameName: 'F_PreBoss01',
        requiredExitKeys: ['exit1', 'exit2'],
        requiredTargetCount: 2,
      },
    });
    expect(() =>
      session.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(fBiome, fDecision(fCombatId).source, 'exit1'),
        gameName: 'F_PreBoss01',
      }),
    ).toThrow(/source-owned takeover Preboss batch/);
  });

  it('enforces the F candidate address contract', () => {
    const project = createFOpeningBatch();
    const missingTarget = createTargetAddress(fBiome, fDecision().source, 'exit2');
    const query = { kind: 'roomTarget' as const, target: missingTarget, gameName: 'F_Combat03' };

    expect(() => candidateSession(project).evaluate(query)).toThrow(
      CandidateEvaluationContractError,
    );
  });

  it('batches F candidate queries against one exact authored project/evaluation pair', () => {
    const project = createCompleteFTakeoverProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const events: CandidateEvaluationEvent[] = [];
    const session = createPreparedProjectCandidateSession(catalog, assembly, {
      observe: (event) => events.push(event),
    });

    expect(session.project).toBe(project);
    expect(session.evaluation).toBe(assembly.evaluation);
    session.evaluate([
      {
        kind: 'startRoom',
        owner: createOccurrenceAddress(fBiome, fStartId),
        gameName: 'F_Opening02',
      },
      {
        kind: 'roomTarget',
        target: createTargetAddress(fBiome, fDecision().source, 'exit1'),
        gameName: 'F_Combat02',
      },
    ]);
    expect(events).toEqual([{ kind: 'queryBatch', queryCount: 2 }]);
  });

  it('keeps the covered combat reward available while blocking an invalid Preboss Shop', () => {
    const project = createCompleteFTakeoverProject();
    const combat = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === fCombatId,
    );
    const shop = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'f-takeover-preboss-shop',
    );
    if (combat?.state.kind !== 'counted') throw new Error('F fixture has no counted combat reward');
    if (shop?.state.kind !== 'shop' || shop.state.shop === undefined) {
      throw new Error('F fixture has no selected Preboss Shop');
    }
    const [offerKey, offer] = Object.entries(shop.state.shop.offers)[0] ?? [];
    if (offerKey === undefined || offer === undefined) throw new Error('F Shop has no offer');
    const results = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate([
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(fBiome, combat.occurrenceId),
        value: combat.state.offer,
      },
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(fBiome, shop.occurrenceId, offerKey),
        value: offer.offer,
      },
      {
        kind: 'shopPurchase',
        purchase: createShopPurchaseAddress(fBiome, shop.occurrenceId, offerKey),
        purchased: offer.purchased,
      },
    ]);

    expect(results).toMatchObject([
      { kind: 'incomingReward', result: { supported: true, findings: [] } },
      { kind: 'unavailable', reason: 'producerFrontierUnavailable' },
      { kind: 'unavailable', reason: 'producerFrontierUnavailable' },
    ]);
  });

  it('does not assess a target after the first invalid selected decision', () => {
    const project = createFGenerationProject();
    const evaluation = simulateProject(catalog, project);
    const target = fGenerationTargetAddress(fGenerationBaselineBatches, 3, 1);

    expect(evaluation.status).toBe('invalid');
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'roomTarget',
        target,
        gameName: 'F_Combat04',
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'coverageNotReached',
      evidence: {
        kind: 'coverageNotReached',
        requiredOwner: target,
        requiredCheckpoint: 'afterTargetGeneration',
        coverage: { kind: 'complete' },
      },
    });
  });
});
