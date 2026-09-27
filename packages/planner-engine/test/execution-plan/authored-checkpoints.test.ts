import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  createBiomeAddress,
  createFigurineArcanaAddress,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createHubFountainAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectHistory,
  createRouteAddress,
  createShopOfferAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  createOccurrenceAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  hermesShrineDeliveryEntryKey,
  semanticAddressKey,
  undoProjectHistory,
  type ProjectDocument,
} from '../../src/authored-project';
import { assembleExecutionProduct, compileExecutionPlan } from '../../src/execution-plan';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  loadUnderworldArachneCocoonsCheckpoint,
  loadUnderworldAutomaticBossCheckpoint,
  loadUnderworldFigLeafCheckpoint,
  loadUnderworldGorgonAthenaCheckpoint,
  loadUnderworldPersephoneCallingCardCheckpoint,
  loadUnderworldGAnomalyRosterCheckpoint,
  loadUnderworldGeneratedCompositionCheckpoint,
  loadUnderworldIxionChaosCheckpoint,
  loadUnderworldTwistScyllaCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
  loadUnderworldZagreusContractCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceEncounterShowcaseCheckpoint,
  loadSurfaceNPhialIntermediateFountainCheckpoint,
  loadSurfaceOrdinaryHexPathCheckpoint,
  loadSurfaceSeleneHexPathCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
  loadSurfaceAnvilCheckpoint,
  loadSurfaceShrineTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  anomalyRosterPhase,
  arachneCocoonPhases,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { oBiome, oOccurrenceIds, pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';

function plan(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}

function reload(project: ProjectDocument): ProjectDocument {
  return decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
}

it('exports reached Fangs, Menace, and the selected H cage from the saved Underworld checkpoint', () => {
  const saved = loadUnderworldGeneratedCompositionCheckpoint();
  const published = plan(saved);
  expect(
    published.occurrences.find((room) => room.id === 'golden-h-combat05')?.overview.encounterPhases,
  ).toContainEqual(expect.objectContaining({ encounterKey: 'GeneratedH_Treant2' }));
  expect(
    published.occurrences.find((room) => room.id === goldenFOccurrenceId(3, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toMatchObject([
    {
      menace: [{ conversions: [{ count: 2, source: { nativeId: 'Guard' } }] }],
    },
  ]);
  expect(
    published.occurrences
      .find((room) => room.id === 'golden-h-combat05')
      ?.overview.encounterPhases.find((phase) => phase.slotKey === 'Cage01')?.customization,
  ).toMatchObject([{ fangs: { type: { nativeId: 'Treant2' }, perks: ['Blink'] } }]);
  expect(
    published.occurrences.find((room) => room.id === goldenFOccurrenceId(7, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toMatchObject([{ fangs: { type: { nativeId: 'Guard_Elite' }, perks: ['Blink'] } }]);

  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(7, 1) },
      'Encounter',
    ),
    decisionKey: 'generatedComposition',
    value: null,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    plan(reloaded).occurrences.find((room) => room.id === goldenFOccurrenceId(7, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the saved P base roll and Q egg choices, then retains the P edit across reload', () => {
  const saved = loadSurfaceEncounterShowcaseCheckpoint();
  const published = plan(saved);
  expect(
    published.occurrences.find((room) => room.id === pOccurrenceId('P_Combat07', 4, 1))?.overview
      .encounterPhases[0]?.customization,
  ).toMatchObject([{ baseRoll: 412 }]);
  expect(
    published.occurrences.find((room) => room.gameName === 'Q_Boss01')?.overview.encounterPhases[0]
      ?.customization,
  ).toMatchObject([
    { decisionKey: 'firstEggWave', choiceKey: 'eidolons' },
    { decisionKey: 'secondEggWave', choiceKey: 'lurkers' },
  ]);
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat07', 4, 1) },
      'Intro',
    ),
    decisionKey: 'generatedComposition',
    value: null,
  });
  expect(reload(edited.present)).toEqual(edited.present);
  expect(
    plan(reload(edited.present)).occurrences.find(
      (room) => room.id === pOccurrenceId('P_Combat07', 4, 1),
    )?.overview.encounterPhases[0]?.customization,
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('reloads the intermediate Phial reset to its addressed repair finding', () => {
  const saved = loadSurfaceNPhialIntermediateFountainCheckpoint();
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome: createFountainRarityOutcomeAddress(
      createHubFountainAddress(createBiomeAddress('Surface', 'N'), 'hub'),
    ),
    targetTraitKey: null,
  });
  const evaluation = simulateProjectAssembly(catalog, reload(edited.present)).evaluation;
  expect(reload(edited.present)).toEqual(edited.present);
  expect(evaluation.findings).toContainEqual(
    expect.objectContaining({
      code: 'fountainRarityResultMissing',
      origin: createFountainRarityOutcomeAddress(
        createHubFountainAddress(createBiomeAddress('Surface', 'N'), 'hub'),
      ),
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('reloads a cleared reached Steady Growth target to its exact repair owner', () => {
  const saved = loadSurfaceScheduledLifecycleCheckpoint();
  const outcome = createSteadyGrowthOutcomeAddress(
    createOccurrenceAddress(oBiome, oOccurrenceIds.combat01),
    'Combat1',
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome,
    targetTraitKey: null,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({ code: 'steadyGrowthOutcomeMissing', origin: outcome }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the settled Ixion Chaos acquisition and reloads its edited selection', () => {
  const saved = loadUnderworldIxionChaosCheckpoint();
  const chaosTrait = createTraitOfferAddress(
    createIncomingRewardAddress(goldenGBiome, createOccurrenceId('golden-g-intro:chaos')),
    'self',
  );
  expect(plan(saved).occurrences.find((room) => room.id === 'golden-g-intro:chaos')).toMatchObject({
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
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  const chaosTransaction = plan(reloaded).occurrences.find(
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

it('exports the reached G Anomaly roster and native return, then reloads its roster reset', () => {
  const saved = loadUnderworldGAnomalyRosterCheckpoint();
  expect(
    plan(saved).occurrences.find((room) => room.id === anomalyRosterPhase.owner.occurrenceId),
  ).toMatchObject({
    gameName: 'B_Combat01',
    anomaly: { replacedRoomGameName: 'G_Combat03', success: true },
    overview: {
      encounterPhases: [
        {
          slotKey: 'Encounter',
          encounterKey: 'GeneratedAnomalyB',
          kind: 'combat',
          customization: [
            {
              decisionKey: 'infiniteRoster',
              kind: 'infiniteRoster',
              types: [
                { choiceKey: 'SpreadShotUnit_Elite', nativeId: 'SpreadShotUnit_Elite' },
                { choiceKey: 'SpreadShotUnit', nativeId: 'SpreadShotUnit' },
                { choiceKey: 'BloodlessPitcher', nativeId: 'BloodlessPitcher' },
              ],
            },
          ],
        },
      ],
    },
    doors: {
      kind: 'fixed',
      target: { id: 'golden-g-b4-e1', gameName: 'G_Combat10' },
    },
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: anomalyRosterPhase,
    decisionKey: 'infiniteRoster',
    value: null,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    plan(reloaded).occurrences.find((room) => room.id === anomalyRosterPhase.owner.occurrenceId)
      ?.overview.encounterPhases,
  ).toEqual([{ slotKey: 'Encounter', encounterKey: 'GeneratedAnomalyB', kind: 'combat' }]);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the selected F/G Arachne encounters and reloads the F cocoon reset', () => {
  const saved = loadUnderworldArachneCocoonsCheckpoint();
  const published = plan(saved);
  expect(
    published.occurrences.find((room) => room.id === arachneCocoonPhases.F.owner.occurrenceId)
      ?.overview.encounterPhases,
  ).toEqual([
    {
      slotKey: 'Encounter',
      encounterKey: 'ArachneCombatF',
      kind: 'combat',
      customization: [{ decisionKey: 'cocoonCount', kind: 'cocoonCount', count: 11 }],
    },
  ]);
  expect(
    published.occurrences.find((room) => room.id === arachneCocoonPhases.G.owner.occurrenceId)
      ?.overview.encounterPhases,
  ).toEqual([{ slotKey: 'Encounter', encounterKey: 'ArachneCombatG', kind: 'combat' }]);
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: arachneCocoonPhases.F,
    decisionKey: 'cocoonCount',
    value: null,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    plan(reloaded).occurrences.find((room) => room.id === arachneCocoonPhases.F.owner.occurrenceId)
      ?.overview.encounterPhases,
  ).toEqual([{ slotKey: 'Encounter', encounterKey: 'ArachneCombatF', kind: 'combat' }]);
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
    plan(saved).occurrences.find((room) => room.id === 'surface-q-preboss')?.timeline.transactions,
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
  const reloaded = reload(edited.present);
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
    plan(saved).occurrences.find((room) => room.id === 'golden-f-preboss-shop')?.timeline
      .transactions,
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
    plan(saved).occurrences.find((room) => room.id === 'golden-f-preboss-shop')?.timeline
      .transactions,
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
  const reloaded = reload(edited.present);
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
    plan(saved).occurrences.find((room) => room.id === 'surface-o-combat04')?.timeline.transactions,
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
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    plan(reloaded).occurrences.find((room) => room.id === 'surface-o-combat04')?.timeline
      .transactions,
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
  const published = plan(saved);
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
  const reloaded = reload(edited.present);
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

it('exports reached Judgment and Crystal Figurine Boss outcomes, then retains the Figurine edit', () => {
  const saved = loadUnderworldAutomaticBossCheckpoint();
  const boss = createOccurrenceId('golden-f-preboss-shop:boss');
  const figurine = createFigurineArcanaAddress(
    createOccurrenceAddress(goldenFBiome, boss),
    'Encounter',
  );
  const transactions = plan(saved).occurrences.find((room) => room.id === boss)?.timeline
    .transactions;
  expect(transactions).toContainEqual(
    expect.objectContaining({
      kind: 'automatic',
      effect: 'judgment',
      rarity: 'Epic',
      window: { kind: 'bossDefeated', phaseKey: 'Encounter' },
    }),
  );
  expect(transactions).toContainEqual(
    expect.objectContaining({
      kind: 'automatic',
      effect: 'crystalFigurine',
      rarity: 'Epic',
      window: { kind: 'bossDefeated', phaseKey: 'Encounter' },
    }),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceFigurineArcana',
    figurine,
    arcanaKeys: [],
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual({
    code: 'figurineOutcomeMissing',
    evidence: { required: 2, selected: 0 },
    origin: figurine,
    phase: 'rewardGeneration',
    severity: 'error',
  });
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the reached Fig Leaf skip and reloads its addressed second-skip repair', () => {
  const saved = loadUnderworldFigLeafCheckpoint();
  const skipped = createOccurrenceId('golden-f-b2-e1');
  const f = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'F',
  );
  if (f === undefined || !('rewards' in f)) throw new Error('Fig Leaf F evaluation is missing');
  expect(f.rewards.branches[0]?.state.keepsakes.figLeaf).toEqual({
    remainingUses: 2,
    activatedThisBiome: true,
  });
  const later = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-f-b3-e1') },
    'Encounter',
  );
  expect(
    plan(saved)
      .occurrences.find((room) => room.id === skipped)
      ?.overview.encounterPhases.find((phase) => phase.slotKey === 'Encounter'),
  ).toMatchObject({ figLeafSkip: true });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceFigLeafSkip',
    phase: later,
    value: true,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual(
    expect.objectContaining({
      code: 'figLeafSkipUnavailable',
      origin: later,
      evidence: { reason: 'alreadyUsed' },
      phase: 'encounterResolution',
      severity: 'error',
    }),
  );
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the installed ordinary Hex and reached P Path allocation, then reloads its reward repair', () => {
  const saved = loadSurfaceOrdinaryHexPathCheckpoint();
  const occurrenceId = pOccurrenceId('P_Combat07', 4, 1);
  const p = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'P',
  );
  if (p === undefined || !('rewards' in p)) throw new Error('ordinary Hex P evaluation is missing');
  expect(p.rewards.branches[0]?.state.hexProgress).toMatchObject({
    spellTraitKey: 'SpellPotionTrait',
    tree: {
      layoutKey: 'Lung',
      rareTalentKeys: ['DamageBuffTalent', 'ShieldTalent'],
      epicTalentKeys: ['ClearCastTalent'],
    },
    bankedPathPoints: 0,
    investedPathPoints: 3,
    talentDropsClosed: false,
  });
  expect(
    plan(saved)
      .occurrences.find((room) => room.id === occurrenceId)
      ?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'acquisition' && transaction.reward.rewardType === 'TalentDrop',
      ),
  ).toBeDefined();
  const reward = createIncomingRewardAddress(pBiome, occurrenceId);
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType: 'MaxManaDrop' },
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  const editedAssembly = simulateProjectAssembly(catalog, reloaded);
  expect(editedAssembly.evaluation.findings).toEqual([
    {
      code: 'rewardBagEntryUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: reward,
      evidence: { rewardType: 'MaxManaDrop', storeKey: 'RunProgress' },
    },
  ]);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports Aspect of Selene Hex Path grants and reloads its tree edit', () => {
  const saved = loadSurfaceSeleneHexPathCheckpoint();
  const p = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'P',
  );
  if (p === undefined || !('rewards' in p)) throw new Error('Selene Hex P evaluation is missing');
  expect(p.rewards.branches[0]?.state.hexProgress).toMatchObject({
    spellTraitKey: 'SpellMoonBeamTrait',
    tree: {
      layoutKey: 'Lung',
      rareTalentKeys: ['MoonBeamConsecutiveDamageTalent', 'MoonBeamDefenseTalent'],
      epicTalentKeys: ['MoonBeamTargetTalent'],
    },
    bankedPathPoints: 0,
    investedPathPoints: 6,
  });
  expect(plan(saved).startingLoadout).toMatchObject({
    weaponKey: 'WeaponSuit',
    aspectKey: 'SuitHexAspect',
    startingHex: {
      spellTraitKey: 'SpellMoonBeamTrait',
      layoutKey: 'Lung',
    },
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceAspectHexTree',
    route: createRouteAddress('Surface'),
    value: {
      layoutKey: 'Maze',
      rareTalentKeys: [
        'MoonBeamPrimaryTalent',
        'MoonBeamConsecutiveDamageTalent',
        'MoonBeamDefenseTalent',
      ],
      epicTalentKeys: ['MoonBeamTargetTalent', 'MoonBeamExBeamBonusTalent'],
    },
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  const editedAssembly = simulateProjectAssembly(catalog, reloaded);
  expect(editedAssembly.evaluation.findings).toEqual([]);
  const editedP = editedAssembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
  if (editedP === undefined || !('rewards' in editedP))
    throw new Error('edited Selene Hex P evaluation is missing');
  expect(editedP.rewards.branches[0]?.state.hexProgress).toMatchObject({
    tree: { layoutKey: 'Maze' },
    investedPathPoints: 6,
  });
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports Aspect of Persephone and Calling Card’s positive Apollo effects and reloads its exact edit', () => {
  const saved = loadUnderworldPersephoneCallingCardCheckpoint();
  const opening = createTraitOfferAddress(
    createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-start')),
    'source',
  );
  const published = plan(saved);
  expect(published.startingLoadout).toMatchObject({
    weaponKey: 'WeaponLob',
    aspectKey: 'LobImpulseAspect',
  });
  const apollo = published.occurrences
    .find((occurrence) => occurrence.id === 'golden-f-start')
    ?.timeline.transactions.flatMap((transaction) =>
      transaction.kind === 'acquisition' ? transaction.roles : [],
    )
    .map((role) => role.traitOffer)
    .find((offer) => offer?.kind === 'traits' && offer.giver === 'Apollo');
  if (apollo?.kind !== 'traits') throw new Error('Persephone Apollo offer is missing');
  expect(apollo.options[0]).toMatchObject({
    key: 'ApolloWeaponBoon',
    baseRarity: 'Common',
    rarity: 'Rare',
    effectiveLevel: 6,
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceTraitOffer',
    trait: opening,
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common', persephoneLevelBonus: 1 },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common', persephoneLevelBonus: 1 },
        { traitKey: 'ApolloCastBoon', rarity: 'Common', persephoneLevelBonus: 1 },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: ['option1'],
    },
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  const editedApollo = plan(reloaded)
    .occurrences.flatMap((occurrence) => occurrence.timeline.transactions)
    .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
    .map((role) => role.traitOffer)
    .find((offer) => offer?.kind === 'traits' && offer.giver === 'Apollo');
  expect(
    editedApollo?.kind === 'traits' ? editedApollo.options[0]?.effectiveLevel : undefined,
  ).toBe(2);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the reached Epic Gorgon Athena child and reloads its condition edit', () => {
  const saved = loadUnderworldGorgonAthenaCheckpoint();
  const occurrenceId = createOccurrenceId('golden-g-b1-e1');
  const g = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'G',
  );
  if (g === undefined || !('rewards' in g)) throw new Error('Gorgon G evaluation is missing');
  expect(g.rewards.branches[0]?.state.keepsakes.gorgon).toEqual({ status: 'consumed' });
  expect(g.rewards.selectedTraitOffers).toContainEqual(
    expect.objectContaining({ acquisitionRole: 'gorgonAthena', reached: true }),
  );
  const phase = createEncounterPhaseAddress(
    goldenGBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  expect(
    plan(saved)
      .occurrences.find((room) => room.id === occurrenceId)
      ?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'encounterInteraction' &&
          transaction.resolution?.kind === 'traitOffer',
      ),
  ).toMatchObject({
    resolution: {
      offer: {
        giver: 'Athena',
        selected: 'option1',
        options: [
          { key: 'InvulnerabilityDashBoon', rarity: 'Epic' },
          { key: 'RetaliateInvulnerabilityBoon', rarity: 'Epic' },
          { key: 'FocusLastStandBoon', rarity: 'Epic' },
        ],
      },
    },
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceGorgonDeathDefianceCondition',
    phase,
    value: false,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toEqual([]);
  expect(
    plan(reloaded)
      .occurrences.find((room) => room.id === occurrenceId)
      ?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'encounterInteraction' &&
          transaction.resolution?.kind === 'traitOffer',
      ),
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the reached Twist and Scylla choice and retains its performer reset through reload and Undo', () => {
  const saved = loadUnderworldTwistScyllaCheckpoint();
  const scylla = saved.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((room) => room.gameName === 'G_Boss02');
  if (scylla === undefined) throw new Error('saved Twist Scylla checkpoint lost G Boss02');
  const phase = createEncounterPhaseAddress(
    goldenGBiome,
    { kind: 'occurrence', occurrenceId: scylla.occurrenceId },
    'Encounter',
  );
  const published = plan(saved);
  expect(
    published.occurrences.find((room) => room.id === 'golden-f-preboss-shop:postboss')?.timeline
      .transactions,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'transformation',
      transformation: {
        kind: 'stygianWellTwist',
        sourceItemKey: 'RandomStoreItem',
        resultItemKey: 'TemporaryBoonRarityTrait',
      },
    }),
  );
  expect(
    published.occurrences.find((room) => room.id === scylla.occurrenceId)?.overview.encounterPhases,
  ).toContainEqual(
    expect.objectContaining({
      encounterKey: 'BossScylla02',
      customization: [
        expect.objectContaining({ decisionKey: 'featuredPerformer', choiceKey: 'charybdis' }),
      ],
    }),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'featuredPerformer',
    value: null,
  });
  const reloaded = reload(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(
    plan(reloaded).occurrences.find((room) => room.id === scylla.occurrenceId)?.overview
      .encounterPhases,
  ).toEqual([{ slotKey: 'Encounter', encounterKey: 'BossScylla02', kind: 'boss' }]);
  expect(undoProjectHistory(edited).present).toBe(saved);
});
