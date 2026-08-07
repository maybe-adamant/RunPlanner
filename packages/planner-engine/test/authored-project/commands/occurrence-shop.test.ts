import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { gBiome, gProject, nBiome } from '../support/configured-projects';

describe('authored-project Shop occurrence commands', () => {
  it('replaces an offer and complete purchase order independently and preserves unchanged identity', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const offer = createShopOfferAddress(nBiome, shopId, 'MajorNonBoon');
    const shop = createOccurrenceAddress(nBiome, shopId);
    let project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseOrder',
      shop,
      offerKeys: ['MajorNonBoon'],
    });
    const state = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)?.state;

    expect(state).toMatchObject({
      kind: 'shop',
      shop: {
        purchaseOrder: ['MajorNonBoon'],
        offers: {
          MajorNonBoon: { reward: { offer: { rewardType: 'MaxHealthDrop' } } },
        },
      },
    });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopPurchaseOrder',
        shop,
        offerKeys: ['MajorNonBoon'],
      }),
    ).toBe(project);
  });

  it('requires a declaration-owned offer in materialized Shop inventory', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(nBiome, shopId, 'Unknown'),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceShopOffer',
        detail: 'unknown shop offer Unknown',
      }),
    );
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceShopPurchaseOrder',
        shop: createOccurrenceAddress(nBiome, shopId),
        offerKeys: 'yes' as unknown as readonly string[],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceShopPurchaseOrder',
        detail: 'offerKeys must be an array of Shop offer keys',
      }),
    );
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceShopPurchaseOrder',
        shop: createOccurrenceAddress(nBiome, shopId),
        offerKeys: ['Unknown'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceShopPurchaseOrder',
        detail: 'unknown shop offer Unknown',
      }),
    );
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceShopPurchaseOrder',
        shop: createOccurrenceAddress(nBiome, shopId),
        offerKeys: ['MajorNonBoon', 'MajorNonBoon'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceShopPurchaseOrder',
        detail: 'shop offer MajorNonBoon is duplicated',
      }),
    );

    let project = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: createOccurrenceId('shop-intro'),
    });
    const introDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('shop-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('shop-source'),
      gameName: 'G_Combat02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: createExitDecisionAddress(gBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('shop-source'),
      }),
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('shop-unselected'),
        exit2: createOccurrenceId('shop-free-2'),
        exit3: createOccurrenceId('shop-free-3'),
      },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopPurchaseOrder',
        shop: createOccurrenceAddress(gBiome, createOccurrenceId('shop-unselected')),
        offerKeys: ['Boon'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceShopPurchaseOrder',
        detail: 'G_PreBoss01 has no materialized shop inventory',
      }),
    );
  });
});
