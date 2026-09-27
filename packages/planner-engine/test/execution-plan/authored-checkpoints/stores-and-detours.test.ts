import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createShopOfferAddress,
  createTraitOfferAddress,
  hermesShrineDeliveryEntryKey,
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
import { goldenFBiome, goldenGBiome } from '@run-planner/test-fixtures/underworld';
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
  expect(
    compileEligibleProject(saved).occurrences.find((room) => room.id === 'surface-q-preboss')
      ?.timeline.transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'transformation',
      transformation: {
        kind: 'anvilOfFates',
        removedTraitKey: 'StaffDoubleAttackTrait',
        addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'],
      },
    }),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceAnvilResult',
    offer,
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
