import { ordinaryPositionFor } from '../../support/route-position';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  activeRoomActionReferences,
  createProjectHistory,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  createLevelResolutionAddress,
  createAcquisitionRoleAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNOPQProject, qBiome, qOccurrenceIds } from '@run-planner/test-fixtures/surface';
import {
  createEchoGoldIAnvilDuplicateProject,
  echoGoldIDuplicateAnvilResult,
  echoGoldIPrebossShopId,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';

describe('authored-project Shop occurrence commands', () => {
  it('persists exact ordinary and Boosted Boon identities with the same reward shape', () => {
    const offer = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'MixedProgress1');
    const boon = {
      rewardType: 'RandomLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'HeraUpgrade' },
    };
    const ordinary = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShopOfferOption',
      offer,
      value: { optionKey: 'RandomLoot', offer: boon },
    });
    const ordinaryState = ordinary.route.biomes
      .find((candidate) => candidate.biomeKey === 'Q')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === qOccurrenceIds.preboss,
      )?.state;
    const ordinaryReward =
      ordinaryState?.kind === 'shop'
        ? ordinaryState.shop?.offers.MixedProgress1?.reward
        : undefined;
    const boosted = applyProjectCommand(ordinary, catalog, {
      kind: 'ReplaceShopOfferOption',
      offer,
      value: { optionKey: 'BoostedRandomLoot', offer: boon },
    });
    const state = boosted.route.biomes
      .find((candidate) => candidate.biomeKey === 'Q')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === qOccurrenceIds.preboss,
      )?.state;
    expect(state?.kind === 'shop' ? state.shop?.offers.MixedProgress1 : undefined).toMatchObject({
      optionKey: 'BoostedRandomLoot',
      reward: { offer: boon },
    });
    expect(state?.kind === 'shop' ? state.shop?.offers.MixedProgress1?.reward : undefined).toEqual(
      ordinaryReward,
    );
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(boosted)), catalog)).toEqual(
      boosted,
    );
    expect(() =>
      applyProjectCommand(boosted, catalog, {
        kind: 'ReplaceShopOfferOption',
        offer,
        value: { optionKey: 'StackUpgradeBig', offer: boon },
      }),
    ).toThrow('StackUpgradeBig does not produce RandomLoot');
  });

  it('stores the Anvil result on its reward role and drops it with the reward', () => {
    const offer = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'PremiumProgress');
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'ChaosWeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAnvilResult',
      acquisition: createAcquisitionRoleAddress(offer, 'self'),
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
      state?.kind === 'shop'
        ? state.shop?.offers.PremiumProgress?.reward?.anvilResultsByAcquisitionRole
        : null,
    ).toBe(undefined);
  });

  it('stores the Gold duplicate Anvil result on its own entry role', () => {
    const project = createEchoGoldIAnvilDuplicateProject();
    const shop = createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId);
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(shop, 'roomExit'),
      'echoDoubleShopReward',
    );
    const authored = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAnvilResult',
      acquisition: createAcquisitionRoleAddress(entry, 'self'),
      value: echoGoldIDuplicateAnvilResult,
    });
    const occurrence = (document: typeof project) =>
      document.route.biomes
        .find((biome) => biome.biomeKey === 'I')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === echoGoldIPrebossShopId,
        );
    expect(
      occurrence(authored)?.acquisitionSites?.roomExit?.pickupEntries?.echoDoubleShopReward
        ?.anvilResultsByAcquisitionRole,
    ).toEqual({ self: echoGoldIDuplicateAnvilResult });
    const paidAnvil = (document: typeof project) => {
      const state = occurrence(document)?.state;
      return state?.kind === 'shop' ? state.shop?.offers.PremiumProgress : undefined;
    };
    expect(paidAnvil(authored)).toBeDefined();
    expect(paidAnvil(authored)).toEqual(paidAnvil(project));
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(authored)), catalog)).toEqual(
      authored,
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceAnvilResult',
        acquisition: createAcquisitionRoleAddress(
          createShopOfferAddress(goldenIBiome, echoGoldIPrebossShopId, 'Survival'),
          'self',
        ),
        value: null,
      }),
    ).toThrow('no declared Anvil of Fates pickup effect');
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceAnvilResult',
        acquisition: createAcquisitionRoleAddress(entry, 'self'),
        value: {
          ...echoGoldIDuplicateAnvilResult,
          addedTraitKeys: ['StaffExAoETrait', 'StaffExAoETrait'],
        },
      }),
    ).toThrow('must contain distinct traits');
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
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    const missingChild = JSON.parse(encodeProjectDocument(project));
    delete missingChild.route.biomes
      .find((biome: { biomeKey: string }) => biome.biomeKey === 'N')
      .topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === shopId,
      ).acquisitionSites.roomExit.pickupEntries.Boon;
    expect(() => decodeProjectDocument(missingChild, catalog)).toThrow(
      'purchased acquisition-resolved Shop reward requires an acquisition entry',
    );
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
    expect(
      activeRoomActionReferences(
        catalog,
        nBiome,
        occurrence()!,
        ordinaryPositionFor(catalog, nBiome),
      ).filter(
        (reference) =>
          (reference.kind === 'interactShopOffer' && reference.offerKey === 'Boon') ||
          (reference.kind === 'interactAcquisitionEntry' &&
            reference.siteKey === 'roomExit' &&
            reference.entryKey === 'Boon'),
      ),
    ).toEqual([{ kind: 'interactShopOffer', offerKey: 'Boon' }]);
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

  it('clears a purchased slot with its purchase and acquisition entry as one undoable edit', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const offer = createShopOfferAddress(nBiome, shopId, 'Boon');
    const purchased = applyProjectCommand(
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceShopOffer',
        offer,
        value: { rewardType: 'BlindBoxLoot' },
      }),
      catalog,
      { kind: 'ReplaceShopPurchaseParticipation', offer, purchased: true },
    );
    const history = applyProjectHistoryCommand(createProjectHistory(purchased), catalog, {
      kind: 'ClearShopOffer',
      offer,
    });
    const shop = (document: typeof purchased) =>
      document.route.biomes
        .find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const cleared = shop(history.present)!;
    expect(cleared.state.kind === 'shop' ? cleared.state.shop?.offers.Boon : undefined).toEqual({
      optionKey: null,
      reward: null,
    });
    expect(
      cleared.roomActions.order.some(
        (reference) => reference.kind === 'interactShopOffer' && reference.offerKey === 'Boon',
      ),
    ).toBe(false);
    expect(cleared.acquisitionSites?.roomExit?.pickupEntries?.Boon).toBeUndefined();
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(history.present)), catalog),
    ).toEqual(history.present);
    expect(undoProjectHistory(history).present).toBe(purchased);
    expect(applyProjectCommand(history.present, catalog, { kind: 'ClearShopOffer', offer })).toBe(
      history.present,
    );
    expect(() =>
      applyProjectCommand(purchased, catalog, {
        kind: 'ClearShopOffer',
        offer: createShopOfferAddress(nBiome, shopId, 'travelDealRefill'),
      }),
    ).toThrow(/not a declared Shop slot/);
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

  it.each(['StackUpgrade', 'BlindBoxLoot'] as const)(
    'replaces and round-trips uncollected Contract %s inventory',
    (rewardType) => {
      const shopId = createOccurrenceId('round-trip-n-preboss');
      const project = applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(nBiome, shopId, 'infernalContractReward'),
        value: { rewardType },
      });
      const occurrence = project.route.biomes
        .find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
      expect(
        occurrence?.state.kind === 'shop'
          ? occurrence.state.shop?.offers.infernalContractReward?.reward?.offer
          : undefined,
      ).toEqual({ rewardType });
      expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
        project,
      );
    },
  );

  it('reconciles a Travel Mystery child with its sole purchase participant and item identity', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const offer = createShopOfferAddress(nBiome, shopId, 'travelDealRefill');
    const site = createAcquisitionSiteAddress(createOccurrenceAddress(nBiome, shopId), 'roomExit');
    const entry = createAcquisitionEntryAddress(site, 'travelDealRefill');
    const reference = {
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'travelDealRefill',
    } as const;
    const action = createRoomActionAddress(nBiome, shopId, roomActionKey(reference));
    const room = (project: ReturnType<typeof createCompleteNProject>) =>
      project.route.biomes
        .find((biome) => biome.biomeKey === 'N')!
        .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)!;
    let project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'BlindBoxLoot' },
    });
    expect(
      room(project).acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill,
    ).toBeUndefined();
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action,
      reference,
      index: room(project).roomActions.order.length,
    });
    expect(room(project).acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toBeNull();
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    const missingChild = JSON.parse(encodeProjectDocument(project));
    delete missingChild.route.biomes
      .find((biome: { biomeKey: string }) => biome.biomeKey === 'N')
      .topology.occurrences.find(
        (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === shopId,
      ).acquisitionSites.roomExit.pickupEntries.travelDealRefill;
    expect(() => decodeProjectDocument(missingChild, catalog)).toThrow(
      'purchased acquisition-resolved Shop reward requires an acquisition entry',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    const child = room(project).acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'BlindBoxLoot' },
    });
    expect(room(project).acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toEqual(
      child,
    );
    expect(
      activeRoomActionReferences(
        catalog,
        nBiome,
        room(project),
        ordinaryPositionFor(catalog, nBiome),
      ).filter((value) => roomActionKey(value) === roomActionKey(reference)),
    ).toHaveLength(1);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    const removed = applyProjectCommand(project, catalog, { kind: 'RemoveRoomAction', action });
    expect(
      room(removed).acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill,
    ).toBeUndefined();
    const removedState = room(removed).state;
    expect(
      removedState.kind === 'shop' ? removedState.shop?.travelDealRefill?.reward?.offer : undefined,
    ).toEqual({ rewardType: 'BlindBoxLoot' });
    const raw = JSON.parse(encodeProjectDocument(project));
    raw.route.biomes
      .find((biome: { biomeKey: string }) => biome.biomeKey === 'N')
      .topology.occurrences.find(
        (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === shopId,
      ).roomActions.order = [];
    expect(() => decodeProjectDocument(raw, catalog)).toThrow('requires its Shop purchase action');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'StackUpgrade' },
    });
    expect(
      room(project).acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill,
    ).toBeUndefined();
    const replacedState = room(project).state;
    expect(
      replacedState.kind === 'shop'
        ? replacedState.shop?.travelDealRefill?.reward?.levelResolutionsByAcquisitionRole
        : undefined,
    ).toEqual({ self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null } });
    expect(room(project).roomActions.order).toContainEqual(reference);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('accepts the dynamic Travel inventory owner and rejects other undeclared Shop entries', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const travel = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(nBiome, shopId, 'travelDealRefill'),
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(
      travel.route.biomes
        .find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)?.state,
    ).toMatchObject({
      kind: 'shop',
      shop: { travelDealRefill: { reward: { offer: { rewardType: 'MaxHealthDrop' } } } },
    });
    for (const reservedKey of ['echoDoubleShopReward'] as const) {
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
        offer: createShopOfferAddress(nBiome, shopId, 'infernalContractReward'),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceShopOffer',
        detail: expect.stringContaining('not available'),
      }),
    );
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
