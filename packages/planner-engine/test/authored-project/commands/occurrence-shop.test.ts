import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAcquisitionSiteAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createLevelResolutionAddress,
  createShopOfferAddress,
  createProjectHistory,
  createTargetAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { gBiome, gProject, nBiome } from '../support/configured-projects';
import { createGoldenFGHIProject, goldenIBiome } from '@run-planner/test-fixtures';

describe('authored-project Shop occurrence commands', () => {
  it('rejects a level-resolution child on Shop GiftDrop', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const shopOffer = createShopOfferAddress(nBiome, shopId, 'MajorNonBoon');
    const shopProject = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: shopOffer,
      value: { rewardType: 'GiftDrop' },
    });
    expect(() =>
      applyProjectCommand(shopProject, catalog, {
        kind: 'ReplaceLevelResolution',
        levelResolution: createLevelResolutionAddress(shopOffer, 'self'),
        value: { kind: 'random', targetTraitKey: null },
      }),
    ).toThrow('no Pom level-resolution effect at role self');
  });
  it('preserves customized Shop trait children when the parent offer is unchanged', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const offer = createShopOfferAddress(nBiome, shopId, 'Boon');
    const value = {
      rewardType: 'RandomLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    let project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: createTraitOfferAddress(offer, 'source'),
      selectedOptionKey: 'option2',
    });

    expect(applyProjectCommand(project, catalog, { kind: 'ReplaceShopOffer', offer, value })).toBe(
      project,
    );
  });

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
      kind: 'ReplaceAcquisitionOrder',
      site: createAcquisitionSiteAddress(shop, 'roomExit'),
      entryKeys: ['MajorNonBoon'],
    });
    const state = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)?.state;

    expect(state).toMatchObject({
      kind: 'shop',
      shop: {
        offers: {
          MajorNonBoon: { reward: { offer: { rewardType: 'MaxHealthDrop' } } },
        },
      },
    });
    expect(
      project.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)
        ?.acquisitionSites,
    ).toEqual({ roomExit: { order: ['MajorNonBoon'] } });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceAcquisitionOrder',
        site: createAcquisitionSiteAddress(shop, 'roomExit'),
        entryKeys: ['MajorNonBoon'],
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
        kind: 'ReplaceAcquisitionOrder',
        site: createAcquisitionSiteAddress(createOccurrenceAddress(nBiome, shopId), 'roomExit'),
        entryKeys: 'yes' as unknown as readonly string[],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceAcquisitionOrder',
        detail: 'entryKeys must be an array of entry keys',
      }),
    );
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceAcquisitionOrder',
        site: createAcquisitionSiteAddress(createOccurrenceAddress(nBiome, shopId), 'roomExit'),
        entryKeys: ['Unknown'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceAcquisitionOrder',
        detail: 'unknown entry Unknown',
      }),
    );
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceAcquisitionOrder',
        site: createAcquisitionSiteAddress(createOccurrenceAddress(nBiome, shopId), 'roomExit'),
        entryKeys: ['MajorNonBoon', 'MajorNonBoon'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceAcquisitionOrder',
        detail: 'entry MajorNonBoon is duplicated',
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
        kind: 'ReplaceAcquisitionOrder',
        site: createAcquisitionSiteAddress(
          createOccurrenceAddress(gBiome, createOccurrenceId('shop-unselected')),
          'roomExit',
        ),
        entryKeys: ['Boon'],
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceAcquisitionOrder',
        detail: 'does not own a materialized authorable acquisition site',
      }),
    );
  });

  it('toggles the applicable Shop condition as one preserved, undoable edit', () => {
    const project = createGoldenFGHIProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.gameName === 'I_PreBoss02');
    if (occurrence === undefined) throw new Error('missing I shop fixture');
    const shop = createOccurrenceAddress(goldenIBiome, occurrence.occurrenceId);
    const initial = createProjectHistory(project);
    const changed = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceShopDeathDefianceCondition',
      shop,
      value: true,
    });
    expect(changed.past).toHaveLength(1);
    expect(changed.present).not.toBe(initial.present);
    expect(changed.present).toMatchObject({
      routes: expect.arrayContaining([
        expect.objectContaining({
          biomes: expect.arrayContaining([
            expect.objectContaining({
              topology: expect.objectContaining({
                occurrences: expect.arrayContaining([
                  expect.objectContaining({
                    occurrenceId: occurrence.occurrenceId,
                    state: expect.objectContaining({
                      shop: expect.objectContaining({ deathDefianceConditionMet: true }),
                    }),
                  }),
                ]),
              }),
            }),
          ]),
        }),
      ]),
    });
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(changed.present)), catalog),
    ).toEqual(changed.present);
    expect(
      applyProjectHistoryCommand(changed, catalog, {
        kind: 'ReplaceShopDeathDefianceCondition',
        shop,
        value: true,
      }),
    ).toBe(changed);
    const undone = undoProjectHistory(changed);
    expect(undone.present).toBe(initial.present);
    expect(redoProjectHistory(undone).present).toBe(changed.present);
    expect(() =>
      applyProjectHistoryCommand(initial, catalog, {
        kind: 'ReplaceShopDeathDefianceCondition',
        shop: createOccurrenceAddress(nBiome, createOccurrenceId('round-trip-n-preboss')),
        value: true,
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceShopDeathDefianceCondition' }));
  });
});
