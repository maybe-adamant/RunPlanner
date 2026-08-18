import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createLevelResolutionAddress,
  createShopOfferAddress,
  createProjectHistory,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';
import {
  createGoldenFGHIProject,
  goldenIBiome,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures';

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
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(offer, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
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
    project = replaceTestShopOfferActions(project, catalog, shop, ['MajorNonBoon']);
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
        ?.roomActions.order,
    ).toContainEqual({ kind: 'interactShopOffer', offerKey: 'MajorNonBoon' });
    expect(replaceTestShopOfferActions(project, catalog, shop, ['MajorNonBoon'])).toBe(project);
  });

  it('replaces the structural Infernal Contract reward across its declared type domain', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(nBiome, shopId), 'roomExit'),
      'infernalContractReward',
    );
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: { rewardType: 'StackUpgrade' },
    });
    const occurrence = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    expect(
      occurrence?.acquisitionSites?.roomExit?.pickupEntries?.infernalContractReward?.offer,
    ).toEqual({ rewardType: 'StackUpgrade' });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('requires a declaration-owned offer in materialized Shop inventory', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    for (const reservedKey of [
      'infernalContractReward',
      'travelDealRefill',
      'echoDoubleShopReward',
    ] as const) {
      expect(() =>
        applyProjectCommand(createCompleteNProject(), catalog, {
          kind: 'ReplaceShopOffer',
          offer: createShopOfferAddress(nBiome, shopId, reservedKey),
          value: { rewardType: 'MaxHealthDrop' },
        }),
      ).toThrowError(
        expect.objectContaining({
          commandKind: 'ReplaceShopOffer',
          detail: `${reservedKey} is reserved for a supplemental Shop entry`,
        }),
      );
    }
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
