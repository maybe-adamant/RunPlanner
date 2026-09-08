import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createLevelResolutionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNOPQProject, qBiome, qOccurrenceIds } from '@run-planner/test-fixtures/surface';

describe('authored-project Shop occurrence commands', () => {
  it('stores the Anvil result only on its World Shop offer and clears it with the offer', () => {
    const offer = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'PremiumProgress');
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'ChaosWeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAnvilResult',
      offer,
      value: {
        kind: 'anvilOfFates',
        removedTraitKey: 'StaffDoubleAttackTrait',
        addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'],
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'MaxHealthDropBig' },
    });
    const state = project.route.biomes
      .find((biome) => biome.biomeKey === 'Q')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === qOccurrenceIds.preboss,
      )?.state;
    expect(
      state?.kind === 'shop' ? state.shop?.offers.PremiumProgress?.anvilResult : undefined,
    ).toBe(undefined);
  });

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

  it('resolves a purchased Mystery Boon at its room-exit acquisition entry', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const offer = createShopOfferAddress(nBiome, shopId, 'Boon');
    const site = createAcquisitionSiteAddress(createOccurrenceAddress(nBiome, shopId), 'roomExit');
    const entry = createAcquisitionEntryAddress(site, 'Boon');
    const selectedMystery = { rewardType: 'BlindBoxLoot' as const };
    let project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: selectedMystery,
    });
    const occurrence = () =>
      project.route.biomes
        .find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);

    const shopState = occurrence()?.state;
    expect(
      shopState?.kind === 'shop' ? shopState.shop?.offers.Boon?.reward?.offer : undefined,
    ).toEqual(selectedMystery);
    expect(occurrence()?.acquisitionSites?.roomExit?.pickupEntries?.Boon).toBeUndefined();

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer,
      purchased: true,
    });
    expect(occurrence()?.acquisitionSites?.roomExit?.pickupEntries?.Boon).toBeNull();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    expect(occurrence()?.acquisitionSites?.roomExit?.pickupEntries?.Boon).toMatchObject({
      offer: { rewardType: 'BlindBoxLoot', payload: { source: 'ApolloUpgrade' } },
      traitOffersByAcquisitionRole: { hiddenSource: null },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer,
      purchased: false,
    });
    expect(occurrence()?.acquisitionSites?.roomExit?.pickupEntries?.Boon).toBeUndefined();
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
    const state = project.route.biomes
      .find((biome) => biome.biomeKey === 'N')
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
      project.route.biomes
        .find((biome) => biome.biomeKey === 'N')
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
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'N')
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
});
