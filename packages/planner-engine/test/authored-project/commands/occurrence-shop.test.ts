import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createOccurrenceId,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { gBiome, gProject, nBiome } from '../support/configured-projects';

describe('authored-project Shop occurrence commands', () => {
  it('replaces an offer and purchase independently and preserves unchanged identity', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const offer = createShopOfferAddress(nBiome, shopId, 'MajorNonBoon');
    const purchase = createShopPurchaseAddress(nBiome, shopId, 'MajorNonBoon');
    let project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase,
      purchased: true,
    });
    const state = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)?.state;

    expect(state).toMatchObject({
      kind: 'shop',
      shop: {
        offers: {
          MajorNonBoon: { offer: { rewardType: 'MaxHealthDrop' }, purchased: true },
        },
      },
    });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'SetShopPurchase',
        purchase,
        purchased: true,
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
        kind: 'SetShopPurchase',
        purchase: createShopPurchaseAddress(nBiome, shopId, 'MajorNonBoon'),
        purchased: 'yes' as unknown as boolean,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'SetShopPurchase',
        detail: 'purchased must be a boolean',
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
        kind: 'SetShopPurchase',
        purchase: createShopPurchaseAddress(gBiome, createOccurrenceId('shop-unselected'), 'Boon'),
        purchased: true,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'SetShopPurchase',
        detail: 'G_PreBoss01 has no materialized shop inventory',
      }),
    );
  });
});
