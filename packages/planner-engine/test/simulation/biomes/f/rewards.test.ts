import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createProjectDocument,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeBiomeHistory,
  evaluateBiomeCompleteness,
  evaluateBiomeRewards,
  materializeBiome,
  simulateProject,
  type CompleteBiomeCompletenessResult,
} from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

const biome = createBiomeAddress('Underworld', 'F');

interface TargetSpec {
  readonly id: OccurrenceId;
  readonly gameName: string;
  readonly offer?: ResolvedRewardOffer;
}

function fPlan(project: ProjectDocument) {
  const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (plan?.biomeKey !== 'F') {
    throw new Error('missing F reward fixture plan');
  }
  return plan;
}

function complete(project: ProjectDocument): CompleteBiomeCompletenessResult {
  const result = evaluateBiomeCompleteness(catalog, biome, fPlan(project));
  if (result.completion !== 'complete') {
    throw new Error(`reward fixture is incomplete: ${result.findings[0]?.code}`);
  }
  return result;
}

function emptyProject(name: string): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: name,
    name,
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function replaceIncoming(
  project: ProjectDocument,
  occurrenceId: OccurrenceId,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId),
    value,
  });
}

function addBatch(
  project: ProjectDocument,
  parentId: OccurrenceId,
  storeKey: 'MetaProgress' | 'RunProgress',
  targets: readonly TargetSpec[],
  pickedExitIndex = 1,
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: parentId,
  });
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, decision.source),
    storeKey,
  });
  for (const [offset, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${offset + 1}`),
      occurrenceId: target.id,
      gameName: target.gameName,
    });
    if (target.offer !== undefined) {
      next = replaceIncoming(next, target.id, target.offer);
    }
  }
  return targets.length > 1
    ? applyProjectCommand(next, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, decision.source),
        value: { kind: 'normal', exitKey: `exit${pickedExitIndex}` },
      })
    : next;
}

function addTakeover(
  project: ProjectDocument,
  parentId: OccurrenceId,
  targetIds: readonly OccurrenceId[],
  pickedExitIndex = 1,
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: parentId,
  });
  const targetOccurrenceIds = Object.fromEntries(
    targetIds.map((occurrenceId, offset) => [`exit${offset + 1}`, occurrenceId]),
  );
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds,
  });
  if (targetIds.length > 1) {
    next = applyProjectCommand(next, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, decision.source),
      value: { kind: 'normal', exitKey: `exit${pickedExitIndex}` },
    });
  }
  return next;
}

function evaluate(project: ProjectDocument) {
  const snapshot = materializeBiome(catalog, biome, complete(project));
  const history = composeBiomeHistory(catalog, snapshot);
  return { snapshot, history, rewards: evaluateBiomeRewards(catalog, snapshot, history, 1) };
}

function firstBranch(result: ReturnType<typeof evaluate>['rewards']) {
  const branch = result.branches[0];
  if (branch === undefined) {
    throw new Error(`reward fixture has no branch: ${JSON.stringify(result.findings)}`);
  }
  return branch;
}

function ratioBoundaryProject(): ProjectDocument {
  const start = createOccurrenceId('ratio-start');
  const meta = createOccurrenceId('ratio-meta');
  const run = createOccurrenceId('ratio-run');
  const runPeer = createOccurrenceId('ratio-run-peer');
  const mixed = createOccurrenceId('ratio-mixed');
  const mixedPeer = createOccurrenceId('ratio-mixed-peer');
  let project = applyProjectCommand(emptyProject('ratio-boundaries'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = addBatch(project, start, 'MetaProgress', [{ id: meta, gameName: 'F_Combat02' }]);
  project = addBatch(project, meta, 'RunProgress', [
    { id: run, gameName: 'F_Combat03' },
    { id: runPeer, gameName: 'F_Combat05', offer: { rewardType: 'MaxHealthDrop' } },
  ]);
  project = addBatch(project, run, 'MetaProgress', [
    { id: mixed, gameName: 'F_Combat04', offer: { rewardType: 'MetaCurrencyDrop' } },
    {
      id: mixedPeer,
      gameName: 'F_Combat06',
      offer: { rewardType: 'MetaCardPointsCommonDrop' },
    },
  ]);
  return addTakeover(project, mixed, [
    createOccurrenceId('ratio-preboss-shop'),
    createOccurrenceId('ratio-preboss-free'),
  ]);
}

function refillProject(): ProjectDocument {
  const start = createOccurrenceId('refill-start');
  const rooms = [
    createOccurrenceId('refill-combat'),
    createOccurrenceId('refill-miniboss-1'),
    createOccurrenceId('refill-miniboss-2'),
    createOccurrenceId('refill-miniboss-3'),
  ];
  const gameNames = ['F_Combat01', 'F_MiniBoss01', 'F_MiniBoss02', 'F_MiniBoss03'];
  const sources = ['PoseidonUpgrade', 'HestiaUpgrade', 'ZeusUpgrade', 'ApolloUpgrade'];
  let project = applyProjectCommand(emptyProject('one-refill'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  let parent = start;
  rooms.forEach((id, index) => {
    project = addBatch(project, parent, 'MetaProgress', [
      {
        id,
        gameName: gameNames[index]!,
        offer: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: sources[index]! },
        },
      },
    ]);
    parent = id;
  });
  return addTakeover(project, parent, [createOccurrenceId('refill-preboss-shop')]);
}

function sameRoomAcquisitionProject(): ProjectDocument {
  const start = createOccurrenceId('same-room-start');
  const meta = createOccurrenceId('same-room-meta');
  const boon = createOccurrenceId('same-room-boon');
  const stack = createOccurrenceId('same-room-stack');
  let project = applyProjectCommand(emptyProject('same-room-acquisition'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = replaceIncoming(project, start, { rewardType: 'WeaponUpgrade' });
  project = addBatch(project, start, 'MetaProgress', [{ id: meta, gameName: 'F_Combat02' }]);
  project = addBatch(project, meta, 'RunProgress', [
    { id: boon, gameName: 'F_Combat03' },
    { id: createOccurrenceId('same-room-peer-1'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, boon, 'RunProgress', [
    { id: stack, gameName: 'F_Combat04', offer: { rewardType: 'StackUpgrade' } },
    { id: createOccurrenceId('same-room-peer-2'), gameName: 'F_Story01' },
  ]);
  project = addTakeover(
    project,
    stack,
    [createOccurrenceId('same-room-preboss-shop'), createOccurrenceId('same-room-preboss-free')],
    2,
  );
  return replaceIncoming(project, createOccurrenceId('same-room-preboss-free'), {
    rewardType: 'MaxManaDrop',
  });
}

function shopTimingProject(): ProjectDocument {
  const start = createOccurrenceId('shop-trace-start');
  const first = createOccurrenceId('shop-trace-first');
  const third = createOccurrenceId('shop-trace-third');
  const shop = createOccurrenceId('shop-trace-shop');
  const fifth = createOccurrenceId('shop-trace-fifth');
  const peer = createOccurrenceId('shop-trace-peer');
  let project = applyProjectCommand(emptyProject('shop-trace'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = addBatch(project, start, 'MetaProgress', [
    {
      id: first,
      gameName: 'F_Combat01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    },
  ]);
  project = addBatch(project, first, 'MetaProgress', [
    {
      id: third,
      gameName: 'F_MiniBoss01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    },
  ]);
  project = addBatch(project, third, 'MetaProgress', [{ id: shop, gameName: 'F_Shop01' }]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, shop, 'Boon'),
    value: {
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseOrder',
    shop: createOccurrenceAddress(biome, shop),
    offerKeys: ['Boon'],
  });
  project = addBatch(project, shop, 'RunProgress', [
    {
      id: fifth,
      gameName: 'F_Combat04',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    },
    { id: peer, gameName: 'F_Story01' },
  ]);
  project = addTakeover(project, fifth, [
    createOccurrenceId('shop-trace-preboss-shop'),
    createOccurrenceId('shop-trace-preboss-free'),
  ]);
  return replaceIncoming(project, createOccurrenceId('shop-trace-preboss-free'), {
    rewardType: 'MaxHealthDrop',
  });
}

function invalidShopOfferProject(): ProjectDocument {
  const start = createOccurrenceId('invalid-shop-start');
  const first = createOccurrenceId('invalid-shop-first');
  const source = createOccurrenceId('invalid-shop-source');
  const peer = createOccurrenceId('invalid-shop-peer');
  let project = applyProjectCommand(emptyProject('invalid-shop-offer'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = replaceIncoming(project, start, { rewardType: 'WeaponUpgrade' });
  project = addBatch(project, start, 'MetaProgress', [{ id: first, gameName: 'F_Combat02' }]);
  project = addBatch(project, first, 'RunProgress', [
    { id: source, gameName: 'F_Combat03' },
    { id: peer, gameName: 'F_Story01' },
  ]);
  return addTakeover(project, source, [
    createOccurrenceId('invalid-shop-preboss'),
    createOccurrenceId('invalid-shop-free'),
  ]);
}

function invalidBlindBoxPurchaseProject(): ProjectDocument {
  const start = createOccurrenceId('blind-start');
  const combat = createOccurrenceId('blind-combat');
  const miniboss1 = createOccurrenceId('blind-miniboss-1');
  const miniboss2 = createOccurrenceId('blind-miniboss-2');
  const shop = createOccurrenceId('blind-shop');
  let project = applyProjectCommand(emptyProject('invalid-blind-box'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = addBatch(project, start, 'MetaProgress', [
    {
      id: combat,
      gameName: 'F_Combat01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    },
  ]);
  project = addBatch(project, combat, 'MetaProgress', [
    {
      id: miniboss1,
      gameName: 'F_MiniBoss01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    },
  ]);
  project = addBatch(project, miniboss1, 'MetaProgress', [
    {
      id: miniboss2,
      gameName: 'F_MiniBoss02',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    },
  ]);
  project = addBatch(project, miniboss2, 'MetaProgress', [{ id: shop, gameName: 'F_Shop01' }]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, shop, 'Boon'),
    value: {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseOrder',
    shop: createOccurrenceAddress(biome, shop),
    offerKeys: ['Boon'],
  });
  project = addTakeover(project, shop, [
    createOccurrenceId('blind-preboss-shop'),
    createOccurrenceId('blind-preboss-free'),
  ]);
  return replaceIncoming(project, createOccurrenceId('blind-preboss-free'), {
    rewardType: 'MaxHealthDrop',
  });
}

function devotionProject(): ProjectDocument {
  const start = createOccurrenceId('devotion-start');
  const meta1 = createOccurrenceId('devotion-meta-1');
  const run1 = createOccurrenceId('devotion-run-1');
  const meta2 = createOccurrenceId('devotion-meta-2');
  const run2 = createOccurrenceId('devotion-run-2');
  const run3 = createOccurrenceId('devotion-run-3');
  const devotion = createOccurrenceId('devotion-room');
  let project = applyProjectCommand(emptyProject('devotion-order'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = addBatch(project, start, 'MetaProgress', [{ id: meta1, gameName: 'F_Combat02' }]);
  project = addBatch(project, meta1, 'RunProgress', [
    {
      id: run1,
      gameName: 'F_Combat03',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    },
    { id: createOccurrenceId('devotion-peer-1'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, run1, 'MetaProgress', [
    { id: meta2, gameName: 'F_Combat04', offer: { rewardType: 'MetaCurrencyDrop' } },
    { id: createOccurrenceId('devotion-peer-2'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, meta2, 'RunProgress', [
    {
      id: run2,
      gameName: 'F_Combat05',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    },
    { id: createOccurrenceId('devotion-peer-3'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, run2, 'RunProgress', [
    { id: run3, gameName: 'F_Combat06', offer: { rewardType: 'MaxHealthDrop' } },
    { id: createOccurrenceId('devotion-peer-4'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, run3, 'RunProgress', [
    {
      id: devotion,
      gameName: 'F_Combat07',
      offer: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'PoseidonUpgrade',
        },
      },
    },
    { id: createOccurrenceId('devotion-peer-5'), gameName: 'F_Story01' },
  ]);
  project = addTakeover(project, devotion, [
    createOccurrenceId('devotion-preboss-shop'),
    createOccurrenceId('devotion-preboss-free'),
  ]);
  return replaceIncoming(project, createOccurrenceId('devotion-preboss-free'), {
    rewardType: 'MaxManaDrop',
  });
}

describe('F reward-history simulation', () => {
  it('treats the opening reward as a biome entry without a current-room predecessor', () => {
    const start = createOccurrenceId('ratio-start');
    const project = replaceIncoming(ratioBoundaryProject(), start, { rewardType: 'SpellDrop' });
    const result = evaluate(project).rewards;

    expect(result.validity).toBe('valid');
    expect(firstBranch(result).events).toContainEqual(
      expect.objectContaining({
        kind: 'rewardOffered',
        origin: createIncomingRewardAddress(biome, start),
        offer: { rewardType: 'SpellDrop' },
      }),
    );
  });

  it('validates forced and possible authored base stores from current-room store history', () => {
    const result = evaluate(ratioBoundaryProject()).rewards;

    expect(result.validity).toBe('valid');
    expect(result.findings).toEqual([]);
    expect(result.storeSupport).toEqual([
      expect.objectContaining({
        authoredStoreKey: 'MetaProgress',
        enteredStoreCount: 1,
        enteredMetaStoreCount: 0,
        supportStoreKeys: ['MetaProgress'],
      }),
      expect.objectContaining({
        authoredStoreKey: 'RunProgress',
        enteredStoreCount: 2,
        enteredMetaStoreCount: 1,
        supportStoreKeys: ['RunProgress'],
      }),
      expect.objectContaining({
        authoredStoreKey: 'MetaProgress',
        enteredStoreCount: 3,
        enteredMetaStoreCount: 1,
        supportStoreKeys: ['RunProgress', 'MetaProgress'],
      }),
    ]);
  });

  it('replays a later forced target store across earlier ordinary peers', () => {
    let project = ratioBoundaryProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('ratio-mixed-peer')),
      gameName: 'F_Combat01',
    });
    const forcedBinding = catalog.rooms.byKey.F_Combat01?.incomingReward;
    if (forcedBinding?.kind !== 'countedChoice') {
      throw new Error('F_Combat01 must retain its counted reward binding');
    }
    const forcedOffer = forcedBinding.defaultOffersByStore.RunProgress;
    if (forcedOffer === undefined) throw new Error('F_Combat01 must default from RunProgress');
    project = replaceIncoming(project, createOccurrenceId('ratio-mixed-peer'), forcedOffer);
    project = replaceIncoming(project, createOccurrenceId('ratio-mixed'), {
      rewardType: 'MaxHealthDrop',
    });

    const result = evaluate(project);
    const batch = result.snapshot.decisions[2];
    if (batch?.kind !== 'batch') throw new Error('ratio fixture lost its third batch');

    expect(result.rewards.validity).toBe('valid');
    expect(batch.rewardStore).toMatchObject({
      baseRewardStoreKey: 'MetaProgress',
      kind: 'authoredBaseStore',
    });
    expect(batch.resolvedSharedRewardStoreKey).toBe('RunProgress');
    expect(batch.targets.map((target) => target.room.incomingReward?.resolvedStoreKey)).toEqual([
      'RunProgress',
      'RunProgress',
    ]);
  });

  it('addresses an impossible authored base store without replacing the authored outcome', () => {
    let project = ratioBoundaryProject();
    const firstStore = createBatchRewardStoreAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('ratio-start'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: firstStore,
      storeKey: 'RunProgress',
    });
    const result = evaluate(project).rewards;

    expect(result.validity).toBe('invalid');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'baseRewardStoreUnavailable',
        origin: firstStore,
        evidence: expect.objectContaining({
          authoredStoreKey: 'RunProgress',
          supportStoreKeys: ['MetaProgress'],
        }),
      }),
    );
  });

  it('consumes unpicked offers but acquires only entered producers', () => {
    const result = evaluate(ratioBoundaryProject()).rewards;
    const branch = firstBranch(result);
    const unpickedOrigin = createIncomingRewardAddress(biome, createOccurrenceId('ratio-run-peer'));

    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'rewardOffered',
        origin: unpickedOrigin,
        offer: { rewardType: 'MaxHealthDrop' },
      }),
    );
    expect(branch.events).not.toContainEqual(
      expect.objectContaining({ kind: 'concreteAcquisition', origin: unpickedOrigin }),
    );
    expect(branch.history.consumableRecord.MaxHealthDrop).toBeUndefined();
  });

  it('reaches the declared one-refill transition through F counted offers', () => {
    const result = evaluate(refillProject()).rewards;
    const runBag = firstBranch(result).bags.RunProgress!;
    const boonIndexes = catalog.rewards.stores.byKey.RunProgress!.entries.flatMap((entry, index) =>
      entry.rewardType === 'Boon' ? [index] : [],
    );

    expect(result.validity).toBe('valid');
    expect(boonIndexes.map((index) => runBag.remainingEntryCounts[index])).toEqual(
      expect.arrayContaining([0, 1]),
    );
    expect(
      runBag.remainingEntryCounts.some(
        (remaining, index) =>
          catalog.rewards.stores.byKey.RunProgress!.entries[index]?.rewardType ===
            'MaxHealthDrop' && remaining === 2,
      ),
    ).toBe(true);
  });

  it('applies an entered standard-room acquisition before its outgoing rewards', () => {
    const result = evaluate(sameRoomAcquisitionProject()).rewards;
    const branch = firstBranch(result);
    const boonOrigin = createIncomingRewardAddress(biome, createOccurrenceId('same-room-boon'));
    const stackOrigin = createIncomingRewardAddress(biome, createOccurrenceId('same-room-stack'));
    const boonAcquisition = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(boonOrigin),
    );
    const stackOffer = branch.events.find(
      (event) =>
        event.kind === 'rewardOffered' &&
        semanticAddressKey(event.origin) === semanticAddressKey(stackOrigin),
    );

    expect(result.validity).toBe('valid');
    expect(boonAcquisition?.historySequence).toBeLessThan(stackOffer!.historySequence);
    expect(branch.history.lootTypeHistory.StackUpgrade).toBe(1);
    expect(branch.history.currentRoomUseRecord).toEqual({});
    expect(branch.history.useRecord.StackUpgrade).toBe(1);
  });

  it('keeps outgoing door sources pre-purchase in the fourth-shop/fifth-door trace', () => {
    const result = evaluate(shopTimingProject()).rewards;
    const branch = firstBranch(result);
    const shopPurchase = createShopPurchaseAddress(
      biome,
      createOccurrenceId('shop-trace-shop'),
      'Boon',
    );
    const fifthOffer = createIncomingRewardAddress(biome, createOccurrenceId('shop-trace-fifth'));
    const purchaseEvent = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(shopPurchase),
    );
    const fifthOfferEvent = branch.events.find(
      (event) =>
        event.kind === 'rewardOffered' &&
        semanticAddressKey(event.origin) === semanticAddressKey(fifthOffer),
    );

    expect(result.validity).toBe('valid');
    expect(fifthOfferEvent?.historySequence).toBeLessThan(purchaseEvent!.historySequence);
    expect(branch.history.lootTypeHistory).toMatchObject({
      ApolloUpgrade: 1,
      PoseidonUpgrade: 1,
      HestiaUpgrade: 1,
      AresUpgrade: 1,
      ZeusUpgrade: 1,
    });
    expect(branch.events.find((event) => event.kind === 'shopPurchasesSupported')).toMatchObject({
      purchaseOrder: ['Boon'],
    });
  });

  it('classifies counted-bag and source-support failures at their incoming reward owners', () => {
    let bagProject = ratioBoundaryProject();
    bagProject = replaceIncoming(bagProject, createOccurrenceId('ratio-mixed'), {
      rewardType: 'GiftDrop',
    });
    const bagResult = evaluate(bagProject).rewards;

    let sourceProject = shopTimingProject();
    sourceProject = replaceIncoming(sourceProject, createOccurrenceId('shop-trace-preboss-free'), {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
    });
    const sourceResult = evaluate(sourceProject).rewards;

    expect(bagResult.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(biome, createOccurrenceId('ratio-mixed')),
      }),
    );
    expect(sourceResult.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardSourceUnavailable',
        origin: createIncomingRewardAddress(biome, createOccurrenceId('shop-trace-preboss-free')),
      }),
    );
  });

  it('addresses unsupported shop inventory and purchased options separately', () => {
    const offerResult = evaluate(invalidShopOfferProject()).rewards;
    let purchaseProject = invalidBlindBoxPurchaseProject();
    purchaseProject = applyProjectCommand(purchaseProject, catalog, {
      kind: 'ReplaceShopPurchaseOrder',
      shop: createOccurrenceAddress(biome, createOccurrenceId('blind-shop')),
      offerKeys: ['Boon', 'MajorNonBoon'],
    });
    const purchaseResult = evaluate(purchaseProject).rewards;
    const offerFindings = offerResult.findings.filter(
      (finding) => finding.code === 'shopOfferUnavailable',
    );
    const purchaseFindings = purchaseResult.findings.filter(
      (finding) => finding.code === 'shopPurchaseUnavailable',
    );

    expect(offerFindings).toEqual([
      expect.objectContaining({
        origin: createShopOfferAddress(
          biome,
          createOccurrenceId('invalid-shop-preboss'),
          'MajorNonBoon',
        ),
      }),
    ]);
    expect(purchaseFindings).toEqual([
      expect.objectContaining({
        origin: createShopPurchaseAddress(biome, createOccurrenceId('blind-shop'), 'Boon'),
      }),
    ]);
  });

  it('emits Devotion chosen and spurned acquisitions at their declared ordered points', () => {
    const result = evaluate(devotionProject()).rewards;
    const branch = firstBranch(result);
    const origin = createIncomingRewardAddress(biome, createOccurrenceId('devotion-room'));
    const acquisitions = branch.events.filter(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(origin),
    );

    expect(result.validity).toBe('valid');
    expect(acquisitions).toEqual([
      expect.objectContaining({
        acquisition: expect.objectContaining({
          role: 'chosenSource',
          lifecyclePoint: 'beforeCombat',
          acquisition: { kind: 'loot', gameName: 'ApolloUpgrade' },
        }),
      }),
      expect.objectContaining({
        acquisition: expect.objectContaining({
          role: 'spurnedSource',
          lifecyclePoint: 'afterCombat',
          acquisition: { kind: 'loot', gameName: 'PoseidonUpgrade' },
        }),
      }),
    ]);
    expect(acquisitions[0]!.historySequence).toBeLessThan(acquisitions[1]!.historySequence);
  });

  it('rejects a canonical snapshot whose room identity is newer than its history', () => {
    const baseline = evaluate(ratioBoundaryProject());
    const project = applyProjectCommand(ratioBoundaryProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('ratio-run-peer')),
      gameName: 'F_Combat06',
    });
    const snapshot = materializeBiome(catalog, biome, complete(project));

    expect(() => evaluateBiomeRewards(catalog, snapshot, baseline.history, 1)).toThrowError(
      /in the snapshot but .* in history/,
    );
  });

  it('keeps an already context-invalid downstream offer authored after room replacement', () => {
    const start = createOccurrenceId('retained-invalid-start');
    const replacedCombat = createOccurrenceId('retained-invalid-replaced-combat');
    const retainedCombat = createOccurrenceId('retained-invalid-retained-combat');
    const reward = createIncomingRewardAddress(biome, retainedCombat);
    let project = applyProjectCommand(emptyProject('retained-invalid-replacement'), catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    project = addBatch(project, start, 'MetaProgress', [
      { id: replacedCombat, gameName: 'F_Combat02', offer: { rewardType: 'MetaCurrencyDrop' } },
    ]);
    project = addBatch(project, replacedCombat, 'RunProgress', [
      { id: retainedCombat, gameName: 'F_Combat03', offer: { rewardType: 'GiftDrop' } },
      { id: createOccurrenceId('retained-invalid-peer'), gameName: 'F_Story01' },
    ]);
    project = addTakeover(project, retainedCombat, [
      createOccurrenceId('retained-invalid-preboss-shop'),
      createOccurrenceId('retained-invalid-preboss-free'),
    ]);

    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: reward }),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, retainedCombat),
      gameName: 'F_Combat06',
    });

    expect(
      fPlan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === retainedCombat,
      ),
    ).toMatchObject({
      gameName: 'F_Combat06',
      state: { kind: 'counted', offer: { rewardType: 'GiftDrop' } },
    });
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: reward,
        evidence: expect.objectContaining({ rewardType: 'GiftDrop', storeKey: 'RunProgress' }),
      }),
    );
  });
});
