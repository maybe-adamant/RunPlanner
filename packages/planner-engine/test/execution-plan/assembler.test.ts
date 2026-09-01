import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  authorTestArtificerReplacement,
  createCompleteFGAnomalyProject,
  createCompleteFGIxionChaosProject,
  createCompleteFGProject,
  createUnderworldFPoolCheckpoint,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  goldenFStartId,
  goldenGBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  authorLegalTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import {
  applyProjectCommand,
  acquisitionSiteFromStorageKey,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createKeepsakeEquipResultAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  createTranscendentEmbryoOutcomeAddress,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
} from '../../src/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';
import type { CompleteValidBiomeProjectEvaluation } from '../../src/simulation/evaluation-products';
import { assembleExecutionProduct } from '../../src/execution-plan';

function fOnlyProject(project = createCompleteFGProject()) {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.slice(0, 1)),
    }),
  });
}

function productFor(project: ReturnType<typeof createCompleteFGProject>) {
  return assembleExecutionProduct({ assembly: simulateProjectAssembly(catalog, project) });
}

function artificerCreatedBoonProject() {
  const source = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Underworld' },
    arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
  });
  project = authorTestArtificerReplacement(
    project,
    catalog,
    createAcquisitionRoleAddress(source, 'self'),
    Object.freeze({
      offer: Object.freeze({
        rewardType: 'Boon',
        payload: Object.freeze({ kind: 'BoonSource' as const, source: 'ZeusUpgrade' }),
      }),
      traitOffersByAcquisitionRole: Object.freeze({ source: null }),
      dispositionByAcquisitionRole: Object.freeze({
        source: Object.freeze({ kind: 'normal' as const }),
      }),
    }),
  );
  return fOnlyProject(authorLegalTraitOffers(project));
}

function narcissusMysteryBoonProject() {
  let project = createCompleteFGProject();
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((room) => room.gameName === 'G_Story01');
  if (occurrence === undefined) throw new Error('Golden G project lacks Narcissus');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Narcissus',
      options: [{ traitKey: 'NarcissusA' }, { traitKey: 'NarcissusI' }, { traitKey: 'NarcissusC' }],
      selectedOptionKey: 'option2',
    },
  });
  const updated = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((room) => room.occurrenceId === occurrence.occurrenceId);
  const generated = Object.entries(updated?.acquisitionSites ?? {}).find(([, site]) =>
    Object.hasOwn(site.pickupEntries ?? {}, 'mysteryBoon'),
  );
  const generatedSite =
    generated === undefined
      ? undefined
      : acquisitionSiteFromStorageKey(
          createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
          generated[0],
        );
  if (generated === undefined || generatedSite === undefined)
    throw new Error('Narcissus did not create its Mystery Boon');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry: createAcquisitionEntryAddress(generatedSite, 'mysteryBoon'),
    value: {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
    },
  });
  const reference = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: generated[0],
    entryKey: 'mysteryBoon',
  };
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(
      goldenGBiome,
      occurrence.occurrenceId,
      roomActionKey(reference),
    ),
    reference,
    index: updated?.roomActions.order.length ?? 0,
  });
  return authorLegalTraitOffers(project);
}

function onionObligationProject() {
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFearVowRank',
    route: createRouteAddress('Underworld'),
    vowKey: 'BoonSkipShrineUpgrade',
    rank: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  return fOnlyProject(authorLegalTraitOffers(project));
}

function automaticOutcomeProject() {
  let project = createCompleteFGProject();
  const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection,
    keepsakeKey: 'RandomBlessingKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoEquipResult',
    result: createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo'),
    value: { blessingKey: 'ChaosWeaponBlessing' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoTransformation',
    outcome: createTranscendentEmbryoOutcomeAddress(
      createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(7, 1)),
      'Encounter',
    ),
    blessingKey: 'ChaosElementalBlessing',
  });
  const growthReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: growthReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(growthReward, 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'BoonGrowthBoon', rarity: 'Epic' },
        { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' },
        { traitKey: 'PlantHealthBoon', rarity: 'Epic' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const frontier = simulateProjectAssembly(catalog, fOnlyProject(project));
  const missing = frontier.evaluation.findings.find(
    (finding) => finding.code === 'steadyGrowthOutcomeMissing',
  )?.origin;
  if (missing?.kind !== 'steadyGrowthOutcome')
    throw new Error('automatic outcome fixture did not reach Steady Growth');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome: missing,
    targetTraitKey: 'ApolloWeaponBoon',
  });
  return fOnlyProject(project);
}

function rackBeforeFountainProject() {
  const occurrenceId = createOccurrenceId('golden-f-preboss-shop:postboss');
  const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(occurrence),
    keepsakeKey: 'HadesAndPersephoneKeepsake',
  });
  const reference = { kind: 'interactKeepsakeRack' as const };
  project = applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: createRoomActionAddress(goldenFBiome, occurrenceId, roomActionKey(reference)),
    toIndex: 0,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceJeweledPomEquipResult',
    result: createKeepsakeEquipResultAddress(
      createPostbossKeepsakeSelectionAddress(occurrence),
      'jeweledPom',
    ),
    value: { traitKey: 'HadesLifestealBoon' },
  });
  return authorLegalTraitOffers(project);
}

describe('engine-owned F/G execution semantic product', () => {
  it('assembles G Anomaly provenance, authored success, ordinary replacement, and fixed return', () => {
    const product = productFor(createCompleteFGAnomalyProject());
    const anomaly = product.occurrences.find((occurrence) => occurrence.anomaly !== undefined);
    expect(anomaly?.anomaly).toEqual({ replacedRoomGameName: 'G_Combat03', success: true });
    expect(anomaly?.gameName).toBe('B_Combat01');
    expect(anomaly?.doors.kind).toBe('fixed');
    if (anomaly?.doors.kind !== 'fixed') throw new Error('expected fixed Anomaly return');
    expect(anomaly.doors.target.gameName).toBe('G_Combat10');
    expect(anomaly.doors.target.id).not.toBe(anomaly.id);
    expect(product.selectedOccurrenceIds).toContain(anomaly.id);
    expect(product.selectedOccurrenceIds).toContain(anomaly.doors.target.id);
    expect(anomaly.doors).not.toHaveProperty('reward');

    const failed = productFor(createCompleteFGAnomalyProject(false)).occurrences.find(
      (occurrence) => occurrence.anomaly !== undefined,
    );
    expect(failed?.anomaly).toEqual({ replacedRoomGameName: 'G_Combat03', success: false });
  });

  it('assembles lazily and keeps the route cursor separate from complete occurrences', () => {
    const product = productFor(fOnlyProject());
    expect(product).not.toHaveProperty('planFingerprint');
    expect(product.selectedOccurrenceIds[0]).toBe('golden-f-start');
    expect(product.selectedOccurrenceIds.length).toBeGreaterThan(1);
    expect(product.occurrences.length).toBeGreaterThan(product.selectedOccurrenceIds.length);
    expect(product.occurrences[0]).not.toHaveProperty('entered');
    expect(product.occurrences.every((occurrence) => !('trace' in occurrence))).toBe(true);
    expect(product.occurrences.every((occurrence) => !('outgoing' in occurrence))).toBe(true);
  });

  it('assembles Overview, normal Doors, owner streams, and diagnostic-only Run State', () => {
    const product = productFor(createCompleteFGProject());
    const opening = product.occurrences[0]!;
    expect(opening.overview.encounterPhases.length).toBeGreaterThan(0);
    expect(opening.doors.kind).toBe('batch');
    if (opening.doors.kind === 'batch') {
      expect(opening.doors.targets.length).toBeGreaterThan(0);
      expect(opening.doors.targets[0]).not.toHaveProperty('picked');
      expect(opening.doors.targets[0]).not.toHaveProperty('type');
    }
    expect(product.occurrences.some((occurrence) => occurrence.timeline.streams.length > 0)).toBe(
      true,
    );
    expect(opening.diagnostics?.roomEntered?.checkpoint).toBe('roomEntered');
    expect(opening.diagnostics?.beforeRoomExit?.checkpoint).toBe('beforeRoomExit');
    expect(opening.diagnostics?.roomEntered).not.toEqual(opening.diagnostics?.beforeRoomExit);
    expect(opening.timeline.transactions.length).toBeGreaterThan(0);
    expect(opening.doors.kind).not.toBe('terminal');
    expect(opening.timeline.transactions.every((transaction) => !('required' in transaction))).toBe(
      true,
    );
    expect(opening.timeline.transactions.every((transaction) => !('streams' in transaction))).toBe(
      true,
    );
    expect(
      opening.timeline.transactions.every((transaction) => !('dependencies' in transaction)),
    ).toBe(true);
  });

  it('publishes Artificer production and Mystery Boon cross-stream ownership', () => {
    const artificer = productFor(artificerCreatedBoonProject());
    const generated = artificer.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find(
        (transaction) =>
          transaction.kind === 'acquisition' &&
          transaction.roles.some((role) => role.producer?.kind === 'artificerReplacement'),
      );
    expect(generated).toBeDefined();
    if (generated?.kind !== 'acquisition') throw new Error('Artificer transaction is missing');
    const producer = generated.roles.find((role) => role.producer !== undefined)?.producer;
    expect(producer).toMatchObject({ kind: 'artificerReplacement', sourceRole: 'self' });
    expect(generated.owner).not.toBe(producer?.sourceOwner);
    const sourceOwner = artificer.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find(
        (transaction) =>
          transaction.kind === 'acquisition' && transaction.sourceOwner === producer?.sourceOwner,
      )?.owner;
    expect(sourceOwner).toBeDefined();
    expect(
      artificer.occurrences.some((occurrence) =>
        occurrence.timeline.dependencies.some(
          (dependency) =>
            dependency.owner === generated.owner && dependency.afterOwner === sourceOwner,
        ),
      ),
    ).toBe(true);

    const mystery = productFor(narcissusMysteryBoonProject());
    const mysteryTransaction = mystery.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find(
        (transaction) =>
          transaction.kind === 'acquisition' && transaction.reward.rewardType === 'BlindBoxLoot',
      );
    expect(mysteryTransaction).toBeDefined();
    if (mysteryTransaction?.kind !== 'acquisition')
      throw new Error('Mystery Boon transaction is missing');
    expect(mysteryTransaction.roles.map((role) => role.role)).toEqual(
      expect.arrayContaining(['box', 'hiddenSource']),
    );
    const mysteryOccurrence = mystery.occurrences.find((occurrence) =>
      occurrence.timeline.transactions.includes(mysteryTransaction),
    );
    expect(mysteryOccurrence?.timeline.streams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'providerResolution', owners: [mysteryTransaction.owner] }),
        expect.objectContaining({ key: 'traitHistory', owners: [mysteryTransaction.owner] }),
      ]),
    );
  });

  it('obligates an authored optional acquisition once it is published', () => {
    const project = narcissusMysteryBoonProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const product = assembleExecutionProduct({ assembly });
    const mystery = product.occurrences
      .flatMap((occurrence) =>
        occurrence.timeline.transactions.map((transaction) => ({ occurrence, transaction })),
      )
      .find(
        ({ transaction }) =>
          transaction.kind === 'acquisition' && transaction.reward.rewardType === 'BlindBoxLoot',
      );
    expect(mystery).toBeDefined();
    if (mystery === undefined) throw new Error('optional Mystery Boon transaction is missing');
    const occurrence = mystery.occurrence;
    const g = assembly.evaluation.route.biomes.find(
      (biome): biome is CompleteValidBiomeProjectEvaluation =>
        biome.biomeKey === 'G' && biome.authoring === 'complete' && biome.validity === 'valid',
    );
    if (g === undefined) throw new Error('optional acquisition fixture lacks complete G');
    const story = [
      g.snapshot.entryRoom,
      ...g.snapshot.decisions.flatMap((decision) =>
        decision.kind === 'batch'
          ? [
              ...decision.targets.map((target) => target.room),
              ...decision.additional.map((exit) => exit.room),
            ]
          : [],
      ),
    ].find((room) => room.gameName === 'G_Story01');
    const optionalRow = story?.roomActionRoster.rows.find(
      (row) =>
        !row.stale &&
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.entryKey === 'mysteryBoon',
    );
    expect(optionalRow?.participation).toBe('optional');
    expect(optionalRow).toBeDefined();
    if (optionalRow === undefined) throw new Error('optional Mystery Boon row is missing');
    expect(mystery.transaction.owner).toBe(semanticAddressKey(optionalRow.owner));
    expect(occurrence.timeline.obligations).toContainEqual(
      expect.objectContaining({ owner: mystery.transaction.owner }),
    );
  });

  it('publishes required Onion, omits neutral Well guidance, and keeps consequential contacts', () => {
    const onion = productFor(onionObligationProject());
    const opening = onion.occurrences[0]!;
    const consolation = opening.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'acquisition' &&
        transaction.roles.some((role) => role.gameName === 'RoomRewardConsolationPrize'),
    );
    expect(consolation).toBeDefined();
    if (consolation?.kind !== 'acquisition')
      throw new Error('required Onion transaction is missing');
    expect(opening.timeline.obligations).toContainEqual({
      owner: consolation.owner,
      checkpoint: 'outgoingGeneration',
    });

    let neutralProject = createUnderworldFWellCheckpoint();
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    neutralProject = applyProjectCommand(neutralProject, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    neutralProject = applyProjectCommand(neutralProject, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:healing',
      purchased: true,
    });
    const neutral = productFor(neutralProject);
    expect(
      neutral.occurrences
        .flatMap((occurrence) => occurrence.timeline.transactions)
        .filter(
          (transaction) =>
            transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:healing',
        ),
    ).toHaveLength(0);
    expect(
      neutral.occurrences.some(
        (occurrence) => occurrence.overview.stygianWell?.interacted === true,
      ),
    ).toBe(true);
  });

  it('publishes a consequential World Shop purchase as an owner-bearing transaction', () => {
    const shop = createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-preboss-shop'));
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenFBiome, shop.occurrenceId, 'Boon'),
      value: {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createShopOfferAddress(goldenFBiome, shop.occurrenceId, 'Boon'),
        'source',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
          { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
          { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = replaceTestShopOfferActions(project, catalog, shop, ['Boon']);
    project = authorLegalTraitOffers(project);
    const product = productFor(project);
    expect(product.occurrences.flatMap((occurrence) => occurrence.timeline.transactions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'shopPurchase',
          offerKey: 'Boon',
          rewardType: 'RandomLoot',
          sourceOwner: expect.stringContaining('shopOffer'),
          reward: expect.objectContaining({ rewardType: 'RandomLoot' }),
          roles: expect.arrayContaining([
            expect.objectContaining({ traitOffer: expect.anything() }),
          ]),
        }),
      ]),
    );
  });

  it('correlates a Postboss Well Yarn purchase with the next G trait offer', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createCompleteFGIxionChaosProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondRight',
      itemKey: 'TemporaryBoonRarityTrait',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondRight',
      purchased: true,
    });
    const product = productFor(authorLegalTraitOffers(project));
    const yarn = product.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find((transaction) => transaction.kind === 'wellPurchase' && transaction.effect === 'yarn');
    expect(yarn).toBeDefined();
    expect(product.wellRetainedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ producerOwner: yarn?.owner, effect: 'yarn' }),
      ]),
    );
    const correlation = product.wellRetainedEffects.find(
      (entry) => entry.producerOwner === yarn?.owner,
    );
    expect(correlation?.consumerOwner).toBeDefined();
    const consumer = product.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find((transaction) => transaction.owner === correlation?.consumerOwner);
    expect(consumer?.kind).toBe('acquisition');
    if (consumer?.kind === 'acquisition')
      expect(consumer.roles.some((role) => role.traitOffer !== undefined)).toBe(true);
  });

  it('uses the resolved Fateful Twist effect for cross-room Well correlation', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createCompleteFGIxionChaosProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondRight',
      itemKey: 'RandomStoreItem',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondRight',
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTwistResult',
      occurrence: well,
      generationKey: 'initial:secondRight',
      itemKey: 'TemporaryBoonRarityTrait',
    });
    const product = productFor(authorLegalTraitOffers(project));
    const twist = product.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find(
        (transaction) =>
          transaction.kind === 'wellPurchase' &&
          transaction.offerKey === 'RandomStoreItem' &&
          transaction.twistResultKey === 'TemporaryBoonRarityTrait',
      );
    expect(twist).toMatchObject({ kind: 'wellPurchase', effect: 'yarn' });
    expect(product.wellRetainedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ producerOwner: twist?.owner, effect: 'yarn' }),
      ]),
    );
  });

  it('publishes reached automatic outcomes while keeping Run State diagnostic-only', () => {
    const product = productFor(automaticOutcomeProject());
    expect(product.occurrences.flatMap((occurrence) => occurrence.timeline.transactions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'automatic',
          effect: 'steadyGrowth',
          source: 'BoonGrowthBoon',
          target: 'ApolloWeaponBoon',
        }),
        expect.objectContaining({
          kind: 'automatic',
          effect: 'transcendentEmbryo',
          source: 'ChaosWeaponBlessing',
          target: 'ChaosElementalBlessing',
        }),
      ]),
    );
    expect(product.occurrences.every((occurrence) => !('runState' in occurrence))).toBe(true);
    expect(product.occurrences.some((occurrence) => occurrence.diagnostics !== undefined)).toBe(
      true,
    );
  });

  it('publishes the sparse F/G mutation edges and checkpoints', () => {
    const rack = productFor(rackBeforeFountainProject());
    const postboss = rack.occurrences.find((occurrence) => occurrence.gameName === 'F_PostBoss01');
    expect(postboss).toBeDefined();
    const rackTransaction = postboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'keepsakeChange',
    );
    const fountainTransaction = postboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'fountainUse',
    );
    expect(rackTransaction).toBeDefined();
    expect(fountainTransaction).toBeDefined();
    expect(postboss?.timeline.dependencies).toContainEqual({
      owner: fountainTransaction?.owner,
      afterOwner: rackTransaction?.owner,
    });

    const pool = productFor(authorLegalTraitOffers(createUnderworldFPoolCheckpoint()));
    const saleOccurrence = pool.occurrences.find((occurrence) =>
      occurrence.timeline.transactions.some((transaction) => transaction.kind === 'poolSale'),
    );
    const sale = saleOccurrence?.timeline.transactions.find(
      (transaction) => transaction.kind === 'poolSale',
    );
    expect(sale).toBeDefined();
    expect(saleOccurrence?.timeline.obligations).toContainEqual({
      owner: sale?.owner,
      checkpoint: 'roomExit',
    });

    let wellProject = createUnderworldFWellCheckpoint();
    const wellId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const well = createOccurrenceAddress(goldenFBiome, wellId);
    wellProject = applyProjectCommand(wellProject, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondRight',
      itemKey: 'TemporaryImprovedDefenseTrait',
    });
    const refill = {
      kind: 'purchaseStygianWellOffer' as const,
      generationKey: 'travelDealRefill' as const,
    };
    const nextWell = {
      kind: 'purchaseStygianWellOffer' as const,
      generationKey: 'initial:secondRight' as const,
    };
    wellProject = applyProjectCommand(wellProject, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, wellId, roomActionKey(refill)),
      toIndex: 3,
    });
    wellProject = applyProjectCommand(wellProject, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, wellId, roomActionKey(nextWell)),
      toIndex: 3,
    });
    const wellProduct = productFor(wellProject);
    const wellOccurrence = wellProduct.occurrences.find((occurrence) =>
      occurrence.id.endsWith(':postboss'),
    );
    const extended = wellOccurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'travelDealRefill',
    );
    const nextWellTransaction = wellOccurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:secondRight',
    );
    expect(extended).toBeDefined();
    expect(nextWellTransaction).toBeDefined();
    expect(wellOccurrence?.timeline.dependencies).toContainEqual({
      owner: nextWellTransaction?.owner,
      afterOwner: extended?.owner,
    });
    expect(wellOccurrence?.timeline.obligations).toContainEqual({
      owner: extended?.owner,
      checkpoint: 'roomExit',
    });
  });

  it('retains Chaos continuations in Overview, not normal Doors', () => {
    const project = createCompleteFGIxionChaosProject();
    const product = productFor(project);
    expect(
      product.occurrences.some((occurrence) => occurrence.overview.additional !== undefined),
    ).toBe(true);
    for (const occurrence of product.occurrences) {
      expect(occurrence.doors).not.toHaveProperty('additional');
    }
  });
});
