import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  hermesShrineDeliveryEntryKey,
  type ProjectDocument,
} from '../../src/authored-project';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  type ExecutionPlan,
} from '../../src/execution-plan';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  dreamSingleQOccurrenceIds,
  dreamSingleQShrineDeliveryProject,
} from '@run-planner/test-fixtures/dream';
import {
  oOccurrenceIds,
  qOccurrenceIds,
  surfaceShrineDeliveriesProject,
  surfaceShrineDeliverySources,
  surfaceShrineRushedUnrankedProject,
} from '@run-planner/test-fixtures/surface';

function compile(project: ProjectDocument): ExecutionPlan {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.status).toBe('valid');
  expect(assembly.evaluation.findings).toEqual([]);
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}

/** Every published delivery pickup in route order with its host and window. */
function deliveryRows(plan: ExecutionPlan) {
  return plan.occurrences.flatMap((occurrence) =>
    occurrence.timeline.transactions.flatMap((transaction) =>
      transaction.kind === 'acquisition' && transaction.hermesShrineSourceKey !== undefined
        ? [
            {
              host: occurrence.id,
              sourceKey: transaction.hermesShrineSourceKey,
              rewardType: transaction.reward.rewardType,
              window: transaction.window,
            },
          ]
        : [],
    ),
  );
}

function shrineOffers(plan: ExecutionPlan, occurrenceId: string) {
  const offers = plan.occurrences.find((occurrence) => occurrence.id === occurrenceId)?.overview
    .hermesShrine?.offers;
  if (offers === undefined) throw new Error(`${occurrenceId} publishes no Shrine`);
  return offers;
}

function pendingDeliveriesAtExit(plan: ExecutionPlan, occurrenceId: string) {
  const retained = plan.occurrences.find((occurrence) => occurrence.id === occurrenceId)
    ?.diagnostics?.beforeRoomExit?.retainedEffects.hermesShrineDeliveries;
  if (retained === undefined) throw new Error(`${occurrenceId} publishes no exit diagnostics`);
  return retained.map(({ sourceKey, remainingUses, dueOccurrenceId }) => ({
    sourceKey,
    remainingUses,
    dueOccurrenceId,
  }));
}

describe('surface-shrine-deliveries execution fixture', () => {
  const { nSideRoom, oShrine, pPostboss } = surfaceShrineDeliverySources;
  const sideLeftKey = hermesShrineDeliveryEntryKey(nSideRoom, 'initial:secondLeft');
  const sideRightKey = hermesShrineDeliveryEntryKey(nSideRoom, 'initial:secondRight');
  const rushedKey = hermesShrineDeliveryEntryKey(oShrine, 'initial:first');
  const refillKey = hermesShrineDeliveryEntryKey(oShrine, 'travelDealRefill');
  const flushKey = hermesShrineDeliveryEntryKey(pPostboss, 'initial:secondRight');
  const plan = compile(surfaceShrineDeliveriesProject());

  it('publishes one pickup per delivery contact at its derived host and phase', () => {
    expect(deliveryRows(plan)).toEqual([
      {
        host: oOccurrenceIds.combat04,
        sourceKey: sideLeftKey,
        rewardType: 'MaxHealthDrop',
        window: { kind: 'encounterEnd', phaseKey: 'Combat1' },
      },
      {
        host: oOccurrenceIds.combat07,
        sourceKey: rushedKey,
        rewardType: 'HealBigDrop',
        window: { kind: 'postOutgoing' },
      },
      {
        host: oOccurrenceIds.combat01,
        sourceKey: sideRightKey,
        rewardType: 'MaxManaDrop',
        window: { kind: 'encounterEnd', phaseKey: 'Intro' },
      },
      {
        host: oOccurrenceIds.combat01,
        sourceKey: refillKey,
        rewardType: 'ArmorBoost',
        window: { kind: 'encounterEnd', phaseKey: 'Combat1' },
      },
      {
        host: qOccurrenceIds.preboss,
        sourceKey: flushKey,
        rewardType: 'MaxManaDrop',
        window: { kind: 'standard', phase: 'afterCombat' },
      },
    ]);
  });

  it('keeps the side-room countdown frozen through Postboss and the O Intro room', () => {
    const frozen = [
      { sourceKey: sideLeftKey, remainingUses: 2, dueOccurrenceId: undefined },
      { sourceKey: sideRightKey, remainingUses: 5, dueOccurrenceId: undefined },
    ];
    expect(pendingDeliveriesAtExit(plan, 'surface-n-preboss:boss')).toEqual(frozen);
    expect(pendingDeliveriesAtExit(plan, 'surface-n-preboss:postboss')).toEqual(frozen);
    expect(pendingDeliveriesAtExit(plan, 'surface-o-intro')).toEqual(frozen);
    expect(pendingDeliveriesAtExit(plan, oOccurrenceIds.combat04)).toEqual([
      { sourceKey: sideRightKey, remainingUses: 3, dueOccurrenceId: undefined },
    ]);
  });

  it('publishes each purchase on its source Shrine with the delivery source key', () => {
    expect(shrineOffers(plan, nSideRoom.occurrenceId)).toEqual([
      expect.objectContaining({ generationKey: 'initial:first', rewardType: 'HealBigDrop' }),
      expect.objectContaining({
        generationKey: 'initial:secondLeft',
        deliverySourceKey: sideLeftKey,
        purchase: { roomDelay: 5, rushed: false },
      }),
      expect.objectContaining({
        generationKey: 'initial:secondRight',
        deliverySourceKey: sideRightKey,
        purchase: { roomDelay: 8, rushed: false },
      }),
    ]);
    expect(shrineOffers(plan, oShrine.occurrenceId)[0]).toEqual(
      expect.objectContaining({
        generationKey: 'initial:first',
        slotIndex: 1,
        deliverySourceKey: rushedKey,
        purchase: { roomDelay: 2, rushed: true },
      }),
    );
    expect(shrineOffers(plan, pPostboss.occurrenceId)[2]).toEqual(
      expect.objectContaining({
        generationKey: 'initial:secondRight',
        deliverySourceKey: flushKey,
        purchase: { roomDelay: 8, rushed: false },
      }),
    );
    expect(shrineOffers(plan, 'surface-n-preboss:postboss').every((offer) => !offer.purchase)).toBe(
      true,
    );
  });

  it('publishes the Travel Deal refill on the Shrine carrier independently of its rushed pickup', () => {
    const shrine = plan.occurrences.find((occurrence) => occurrence.id === oShrine.occurrenceId);
    const refill = shrine?.timeline.transactions.find(
      (transaction) => transaction.kind === 'travelDealRefill',
    );
    expect(refill).toEqual(
      expect.objectContaining({
        kind: 'travelDealRefill',
        window: { kind: 'postOutgoing' },
        refill: {
          carrier: 'hermesShrine',
          source: { generationKey: 'initial:first', slotIndex: 1 },
          replacement: {
            generationKey: 'travelDealRefill',
            slotIndex: 1,
            optionKey: 'ArmorBoost',
            rewardType: 'ArmorBoost',
            deliverySourceKey: refillKey,
            purchase: { roomDelay: 2, rushed: false },
          },
        },
      }),
    );
    const pickup = shrine?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'acquisition' && transaction.hermesShrineSourceKey === rushedKey,
    );
    expect(pickup).toBeDefined();
    // The rushed purchase realizes the refill; collecting its item is unordered.
    expect(
      shrine?.timeline.dependencies.filter(
        (dependency) =>
          dependency.owner === refill?.owner || dependency.afterOwner === refill?.owner,
      ),
    ).toEqual([]);
    expect(shrine?.timeline.obligations).toContainEqual({
      owner: refill?.owner,
      checkpoint: 'roomExit',
    });
    expect(shrine?.timeline.obligations.map((obligation) => obligation.owner)).not.toContain(
      pickup?.owner,
    );
  });

  it('flushes the fourth-biome delivery at Preboss entry and not at the Boss', () => {
    const boss = plan.occurrences.find((occurrence) => occurrence.id === 'surface-q-preboss:boss');
    expect(boss?.timeline.transactions).toEqual([]);
    expect(pendingDeliveriesAtExit(plan, 'surface-p-preboss-shop:postboss')).toEqual([
      { sourceKey: flushKey, remainingUses: 8, dueOccurrenceId: undefined },
    ]);
    expect(pendingDeliveriesAtExit(plan, qOccurrenceIds.preboss)).toEqual([]);
  });
});

describe('surface-shrine-rushed-unranked execution fixture', () => {
  const { nSideRoom, oShrine, pPostboss } = surfaceShrineDeliverySources;
  const rushedKey = hermesShrineDeliveryEntryKey(oShrine, 'initial:first');
  const refillKey = hermesShrineDeliveryEntryKey(oShrine, 'travelDealRefill');
  const plan = compile(surfaceShrineRushedUnrankedProject());

  it('publishes the rushed purchase without its pickup and still realizes its refill', () => {
    expect(shrineOffers(plan, oShrine.occurrenceId)[0]).toEqual(
      expect.objectContaining({
        generationKey: 'initial:first',
        deliverySourceKey: rushedKey,
        purchase: { roomDelay: 2, rushed: true },
      }),
    );
    expect(deliveryRows(plan).map(({ host, sourceKey }) => ({ host, sourceKey }))).toEqual([
      {
        host: oOccurrenceIds.combat04,
        sourceKey: hermesShrineDeliveryEntryKey(nSideRoom, 'initial:secondLeft'),
      },
      {
        host: oOccurrenceIds.combat01,
        sourceKey: hermesShrineDeliveryEntryKey(nSideRoom, 'initial:secondRight'),
      },
      { host: oOccurrenceIds.combat01, sourceKey: refillKey },
      {
        host: qOccurrenceIds.preboss,
        sourceKey: hermesShrineDeliveryEntryKey(pPostboss, 'initial:secondRight'),
      },
    ]);
    const shrine = plan.occurrences.find((occurrence) => occurrence.id === oShrine.occurrenceId);
    const refill = shrine?.timeline.transactions.find(
      (transaction) => transaction.kind === 'travelDealRefill',
    );
    expect(refill).toEqual(
      expect.objectContaining({
        window: { kind: 'postOutgoing' },
        refill: expect.objectContaining({
          carrier: 'hermesShrine',
          source: { generationKey: 'initial:first', slotIndex: 1 },
        }),
      }),
    );
    expect(shrine?.timeline.obligations).toContainEqual({
      owner: refill?.owner,
      checkpoint: 'roomExit',
    });
    // The abandoned item is due in its own room and vanishes with it instead of lingering.
    expect(pendingDeliveriesAtExit(plan, oShrine.occurrenceId)).toContainEqual({
      sourceKey: rushedKey,
      remainingUses: 2,
      dueOccurrenceId: oShrine.occurrenceId,
    });
    expect(
      pendingDeliveriesAtExit(plan, oOccurrenceIds.combat04).map((row) => row.sourceKey),
    ).not.toContain(rushedKey);
  });
});

describe('dream-shrine-pending execution fixture', () => {
  const source = createOccurrenceAddress(
    createBiomeAddress('Dream', 'Q'),
    dreamSingleQOccurrenceIds.shrineSource,
  );
  const plan = compile(dreamSingleQShrineDeliveryProject());

  it('keeps the delay-8 purchase pending past the Boss with no pickup row', () => {
    const sourceKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    expect(shrineOffers(plan, source.occurrenceId)[0]).toEqual(
      expect.objectContaining({
        generationKey: 'initial:first',
        deliverySourceKey: sourceKey,
        purchase: { roomDelay: 8, rushed: false },
      }),
    );
    expect(deliveryRows(plan)).toEqual([]);
    const boss = plan.selectedOccurrenceIds.at(-1);
    expect(boss).toBe('dream-q-preboss:boss');
    expect(pendingDeliveriesAtExit(plan, boss!)).toEqual([
      { sourceKey, remainingUses: 5, dueOccurrenceId: undefined },
    ]);
  });
});
