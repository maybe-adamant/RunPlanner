import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createAcquisitionRoleAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  hermesShrineDeliveryEntryKey,
  roomActionKey,
  semanticAddressKey,
  undoProjectHistory,
} from '../../../src/authored-project';
import { simulateProjectAssembly } from '../../../src/simulation';
import {
  loadUnderworldIxionChaosCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
  loadUnderworldZagreusContractCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceAnvilCheckpoint,
  loadSurfaceShrineTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createEchoGoldIAnvilDuplicateProject,
  echoGoldIDuplicateAnvilResult,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  authorLegalTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import { compileEligibleProject, reloadProject } from '../support/authored-checkpoints';

it('exports the settled Ixion Chaos acquisition and reloads its edited selection', () => {
  const saved = loadUnderworldIxionChaosCheckpoint();
  const chaosTrait = createTraitOfferAddress(
    createIncomingRewardAddress(goldenGBiome, createOccurrenceId('golden-g-intro:chaos')),
    'self',
  );
  expect(
    compileEligibleProject(saved).occurrences.find((room) => room.id === 'golden-g-intro:chaos'),
  ).toMatchObject({
    gameName: 'Chaos_01',
    overview: { incomingReward: { rewardType: 'TrialUpgrade' } },
    timeline: {
      transactions: [
        {
          kind: 'acquisition',
          roles: [
            {
              traitOffer: {
                kind: 'chaos',
                giver: 'Chaos',
                selected: 'option1',
                blessingKey: 'ChaosWeaponBlessing',
              },
            },
          ],
        },
      ],
    },
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceTraitOffer',
    trait: chaosTrait,
    value: {
      kind: 'chaos',
      giverKey: 'Chaos',
      curseOptions: [
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
      ],
      selectedOptionKey: 'option1',
      selectedCurseValues: {},
      blessingKey: 'ChaosWeaponBlessing',
      rarity: 'Common',
      blessingValues: { damageBonus: 0.2 },
    },
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  const chaosTransaction = compileEligibleProject(reloaded).occurrences.find(
    (room) => room.id === 'golden-g-intro:chaos',
  )?.timeline.transactions[0];
  expect(
    chaosTransaction?.kind === 'acquisition' ? chaosTransaction.roles[0]?.traitOffer : undefined,
  ).toMatchObject({
    kind: 'chaos',
    selected: 'option1',
    curseOptions: [
      { curseKey: 'ChaosNoMoneyCurse' },
      { curseKey: 'ChaosNoMoneyCurse' },
      { curseKey: 'ChaosNoMoneyCurse' },
    ],
    blessingKey: 'ChaosWeaponBlessing',
  });
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the purchased Anvil result and retains its reset through reload and Undo', () => {
  const saved = loadSurfaceAnvilCheckpoint();
  const offer = createShopOfferAddress(
    createBiomeAddress('Surface', 'Q'),
    createOccurrenceId('surface-q-preboss'),
    'PremiumProgress',
  );
  const shop = compileEligibleProject(saved).occurrences.find(
    (room) => room.id === 'surface-q-preboss',
  );
  const transformation = shop?.timeline.transactions.find(
    (transaction) =>
      transaction.kind === 'transformation' &&
      transaction.transformation.kind === 'anvilOfFates' &&
      transaction.transformation.removedTraitKey === 'StaffDoubleAttackTrait',
  );
  expect(transformation).toMatchObject({
    kind: 'transformation',
    transformation: {
      kind: 'anvilOfFates',
      removedTraitKey: 'StaffDoubleAttackTrait',
      addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'],
    },
  });
  expect(
    shop?.overview.shop?.offers.find((candidate) => candidate.offerKey === 'PremiumProgress')
      ?.transactionOwner,
  ).toBe(transformation?.owner);
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceAnvilResult',
    acquisition: createAcquisitionRoleAddress(offer, 'self'),
    value: null,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({
      code: 'rewardMissing',
      origin: expect.objectContaining({
        kind: 'acquisitionRole',
        owner: offer,
        acquisitionRole: 'self',
      }),
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the Gold duplicate of an Anvil as its own transformation after the first', () => {
  const shop = compileEligibleProject(
    createEchoGoldIAnvilDuplicateProject(echoGoldIDuplicateAnvilResult),
  ).occurrences.find((room) => room.id === echoGoldIPrebossShopId);
  const transformations = shop?.timeline.transactions.filter(
    (transaction) => transaction.kind === 'transformation',
  );
  expect(transformations).toMatchObject([
    { transformation: { kind: 'anvilOfFates', removedTraitKey: 'StaffDoubleAttackTrait' } },
    { transformation: { ...echoGoldIDuplicateAnvilResult } },
  ]);
  expect(transformations?.[1]?.owner).toContain('echoDoubleShopReward');
});

it('exports a Travel Deal refill Anvil as its own transformation', () => {
  const travelDealSource = createIncomingRewardAddress(nBiome, nOccurrenceId('combat09'));
  const shop = createOccurrenceAddress(qBiome, qOccurrenceIds.preboss);
  const refill = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'travelDealRefill');
  const result = {
    kind: 'anvilOfFates',
    removedTraitKey: 'StaffDoubleAttackTrait',
    addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'],
  } as const;
  // Hermes moves from Combat05 to Combat09, whose Travel Deal reaches the Q Shop.
  let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: travelDealSource,
    value: { rewardType: 'HermesUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(travelDealSource, 'self'),
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: [
        { traitKey: 'RestockBoon', rarity: 'Epic' },
        { traitKey: 'HermesWeaponBoon', rarity: 'Rare' },
        { traitKey: 'SprintShieldBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'PremiumProgress'),
    value: { rewardType: 'MaxHealthDropBig' },
  });
  project = replaceTestShopOfferActions(project, catalog, shop, ['PremiumProgress']);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: refill,
    value: { rewardType: 'ChaosWeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAnvilResult',
    acquisition: createAcquisitionRoleAddress(refill, 'self'),
    value: result,
  });
  const reference = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: 'roomExit' as const,
    entryKey: 'travelDealRefill',
  };
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(qBiome, qOccurrenceIds.preboss, roomActionKey(reference)),
    reference,
    index: 1,
  });
  project = authorLegalTraitOffers(project);
  const transactions = compileEligibleProject(project).occurrences.find(
    (room) => room.id === qOccurrenceIds.preboss,
  )?.timeline.transactions;
  const transformation = transactions?.find((transaction) => transaction.kind === 'transformation');
  expect(transformation).toMatchObject({ transformation: result });
  expect(transformation?.owner).toContain('travelDealRefill');
  expect(transactions).not.toContainEqual(
    expect.objectContaining({ kind: 'acquisition', owner: transformation?.owner }),
  );
});

it('exports the acquired World Shop Travel Deal replacement and retains its edited result', () => {
  const saved = loadUnderworldWorldShopTravelDealCheckpoint();
  const refill = createShopOfferAddress(
    goldenFBiome,
    createOccurrenceId('golden-f-preboss-shop'),
    'travelDealRefill',
  );
  expect(
    compileEligibleProject(saved).occurrences.find((room) => room.id === 'golden-f-preboss-shop')
      ?.timeline.transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'travelDealRefill',
      refill: expect.objectContaining({
        carrier: 'worldShop',
        replacement: expect.objectContaining({ optionKey: 'ArmorBoost' }),
      }),
    }),
  );
  expect(
    compileEligibleProject(saved).occurrences.find((room) => room.id === 'golden-f-preboss-shop')
      ?.timeline.transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'acquisition',
      sourceOwner: semanticAddressKey(refill),
      reward: expect.objectContaining({ rewardType: 'ArmorBoost' }),
    }),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceShopOffer',
    offer: refill,
    value: { rewardType: 'MaxManaDrop' },
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({
      code: 'shopPurchaseUnavailable',
      origin: refill,
      evidence: { kind: 'travelDealRefillUnavailable' },
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the acquired Shrine Travel Deal delivery and retains its removal through reload', () => {
  const saved = loadSurfaceShrineTravelDealCheckpoint();
  const shrine = createOccurrenceAddress(
    createBiomeAddress('Surface', 'N'),
    createOccurrenceId('surface-n-preboss:postboss'),
  );
  const refillSourceKey = hermesShrineDeliveryEntryKey(shrine, 'travelDealRefill');
  expect(
    compileEligibleProject(saved).occurrences.find((room) => room.id === 'surface-o-combat04')
      ?.timeline.transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'acquisition',
      reward: expect.objectContaining({ rewardType: 'ArmorBoost' }),
      hermesShrineSourceKey: refillSourceKey,
    }),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'SetHermesShrinePurchase',
    occurrence: shrine,
    generationKey: 'travelDealRefill',
    purchase: null,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    compileEligibleProject(reloaded).occurrences.find((room) => room.id === 'surface-o-combat04')
      ?.timeline.transactions,
  ).not.toContainEqual(
    expect.objectContaining({
      kind: 'acquisition',
      reward: expect.objectContaining({ rewardType: 'ArmorBoost' }),
      hermesShrineSourceKey: refillSourceKey,
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the selected Zagreus Contract return and acquired Preboss Contract item, then reloads its repair', () => {
  const saved = loadUnderworldZagreusContractCheckpoint();
  const contract = createOccurrenceId('zagreus-contract-showcase');
  const returned = createOccurrenceId('zagreus-contract-return');
  const prebossShop = createOccurrenceId('zagreus-contract-preboss-shop');
  const item = createShopOfferAddress(goldenGBiome, prebossShop, 'infernalContractReward');
  const published = compileEligibleProject(saved);
  expect(published.occurrences.find((room) => room.id === contract)).toMatchObject({
    gameName: 'C_Boss01',
  });
  expect(published.occurrences.find((room) => room.id === returned)).toMatchObject({
    gameName: 'G_MiniBoss03',
  });
  expect(
    published.occurrences.find((room) => room.id === contract)?.timeline.transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'acquisition',
      sourceOwner: semanticAddressKey(createIncomingRewardAddress(goldenGBiome, contract)),
      reward: expect.objectContaining({ rewardType: 'InfernalContractBoon' }),
      roles: expect.arrayContaining([
        expect.objectContaining({ gameName: 'InfernalContractBoon' }),
      ]),
    }),
  );
  expect(
    published.occurrences.find((room) => room.id === prebossShop)?.timeline.transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'acquisition',
      sourceOwner: semanticAddressKey(item),
      reward: expect.objectContaining({ rewardType: 'StackUpgrade' }),
      roles: expect.arrayContaining([
        expect.objectContaining({
          gameName: 'StackUpgrade',
          levelResolution: expect.objectContaining({ selectedTarget: 'ApolloWeaponBoon' }),
        }),
      ]),
    }),
  );
  expect(
    published.occurrences.find((room) => room.id === prebossShop)?.overview.shop?.infernalContract,
  ).toEqual({ sourceOwner: semanticAddressKey(item), rewardType: 'StackUpgrade' });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceShopOffer',
    offer: item,
    value: { rewardType: 'StackUpgradeBig' },
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({
      code: 'missingPomTarget',
      evidence: {
        acquisitionRole: 'self',
        levelCount: 2,
        lifecyclePoint: 'roomExit',
      },
      origin: {
        kind: 'levelResolution',
        routeKey: 'Underworld',
        biomeKey: 'G',
        owner: item,
        acquisitionRole: 'self',
      },
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});
