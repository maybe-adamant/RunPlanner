import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createShopOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  CandidateEvaluationContractError,
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
import { authorLegalTraitOffers, createCompleteFGProject } from '@run-planner/test-fixtures';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationBiome,
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
  return authorLegalTraitOffers(
    createFGenerationProject(validPrefixBatches, { includeTakeover: false }),
  );
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
  return authorLegalTraitOffers(
    createFGenerationProject(shopPrefixBatches, { includeTakeover: false }),
  );
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
  return authorLegalTraitOffers(
    createFGenerationProject(boonPrefixBatches, { includeTakeover: false }),
  );
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
  it('keeps ordinary Door 1 choices possible before the takeover is eligible', () => {
    const project = createFOpeningBatch();
    const target = createTargetAddress(fBiome, fDecision().source, 'exit1');
    const [ordinary, takeover] = candidateSession(project).evaluate([
      { kind: 'roomTarget', target, gameName: 'F_Combat02' },
      { kind: 'takeoverPrebossBatch', source: fDecision(), gameName: 'F_PreBoss01' },
    ]);

    expect(ordinary).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedPossible: true } },
    });
    expect(takeover).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: { support: 'impossible', selectedPossible: false },
    });
  });

  it('shares terminal empty-decision force support between Door 1 and the takeover batch', () => {
    let project = createCompleteFGProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (plan?.topology === null || plan === undefined) throw new Error('F topology is missing');
    const takeoverDecision = plan.topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) =>
            plan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'F_PreBoss01',
        ),
    );
    if (takeoverDecision === undefined || takeoverDecision.kind !== 'exit') {
      throw new Error('F takeover decision is missing');
    }
    const decision = createExitDecisionAddress(fGenerationBiome, takeoverDecision.source);
    const target = createTargetAddress(fGenerationBiome, takeoverDecision.source, 'exit1');
    project = applyProjectCommand(project, catalog, { kind: 'RemoveExitDecision', decision });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fGenerationBiome, target.source),
      storeKey: 'RunProgress',
    });

    const [ordinary, takeoverCandidate] = candidateSession(project).evaluate([
      { kind: 'roomTarget', target, gameName: 'F_Combat20' },
      { kind: 'takeoverPrebossBatch', source: decision, gameName: 'F_PreBoss01' },
    ]);

    expect(ordinary).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          selectedGameName: 'F_Combat20',
          selectedPossible: false,
          requiredForcedRoomGameNames: ['F_PreBoss01'],
          selectedExclusionReasons: expect.arrayContaining(['forcedPool']),
        },
      },
    });
    expect(takeoverCandidate).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: {
        gameName: 'F_PreBoss01',
        support: 'required',
        selectedPossible: true,
        requiredExitKeys: ['exit1', 'exit2'],
      },
    });
  });

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
        value: offer.reward.offer,
      },
      {
        kind: 'shopPurchaseOrder',
        shop: createOccurrenceAddress(fBiome, shopId),
        offerKeys: shop.state.shop.purchaseOrder,
      },
    ]);

    expect(results).toEqual([
      { kind: 'shopOffer', result: { supported: true, findings: [] } },
      { kind: 'shopPurchaseOrder', result: { supported: true, findings: [] } },
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
        result: {
          supportedGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
          selectedPossible: true,
        },
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
      {
        kind: 'unavailable',
        reason: 'authoredPrerequisiteMissing',
        evidence: {
          kind: 'authoredPrerequisiteMissing',
          prerequisite: { kind: 'batchRewardStore', owner: rewardStore },
        },
      },
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
        selectedPossible: false,
        pressure: expect.arrayContaining([
          expect.objectContaining({
            selectedGameName: 'F_PreBoss01',
            selectedPossible: false,
            selectedExclusionReasons: ['forceMinimum', 'eligibilityRequirement'],
          }),
        ]),
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
        value: combat.state.reward.offer,
      },
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(fBiome, shop.occurrenceId, offerKey),
        value: offer.reward.offer,
      },
      {
        kind: 'shopPurchaseOrder',
        shop: createOccurrenceAddress(fBiome, shop.occurrenceId),
        offerKeys: shop.state.shop.purchaseOrder,
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
