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
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createKeepsakeEquipResultAddress,
  createLevelResolutionAddress,
  createNemesisRandomEventAddress,
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
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import { assembleTimelineRelations } from '../../src/execution-plan/assembly/timeline-relations';
import { assembleExecutionOverview } from '../../src/execution-plan/assembly/overview';
import { executionTimelineTransactions } from '../../src/execution-plan/assembly/timeline-transactions';
import type { ExecutionTimelineTransaction } from '../../src/execution-plan/model';
import type { PlannerTimelineFacts } from '../../src/simulation/timeline-facts';
import { bossAutomaticOutcomeProject } from './support/automatic-fixture';

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

function timePieceArtificerChildProject() {
  const source = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
  const occurrence = createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'GoldifyKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
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
  const site = artificerAcquisitionSite(occurrence, source);
  const entry = createAcquisitionEntryAddress(site, artificerReplacementEntryKey(source, 'self'));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionDisposition',
    acquisition: createAcquisitionRoleAddress(entry, 'source'),
    value: { kind: 'timePiece' },
  });
  return fOnlyProject(authorLegalTraitOffers(project));
}

function timePieceCreatedBoonProject() {
  const source = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'GoldifyKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: source,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionDisposition',
    acquisition: createAcquisitionRoleAddress(source, 'source'),
    value: { kind: 'timePiece' },
  });
  return fOnlyProject(authorLegalTraitOffers(project));
}

function narcissusMysteryBoonProject(includePickup = true) {
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
  if (includePickup) {
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
  }
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
    value: { blessingKey: 'ChaosWeaponBlessing', blessingValues: { damageBonus: 0.7 } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoTransformation',
    outcome: createTranscendentEmbryoOutcomeAddress(
      createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(7, 1)),
      'Encounter',
    ),
    value: { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
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

function rackBeforeFountainProject(jeweledPomTraitKey = 'HadesLifestealBoon') {
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
    value: { traitKey: jeweledPomTraitKey },
  });
  return authorLegalTraitOffers(project);
}

function postbossKeepsakeOrderProject(
  keepsakeKey: 'FountainRarityKeepsake' | 'GoldifyKeepsake',
  rackIndex: 0 | 1,
) {
  const occurrenceId = createOccurrenceId('golden-f-preboss-shop:postboss');
  const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(occurrence),
    keepsakeKey,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: createRoomActionAddress(
      goldenFBiome,
      occurrenceId,
      roomActionKey({ kind: 'interactKeepsakeRack' }),
    ),
    toIndex: rackIndex,
  });
  if (keepsakeKey === 'FountainRarityKeepsake' && rackIndex === 0)
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome: createFountainRarityOutcomeAddress(
        createRoomActionAddress(goldenFBiome, occurrenceId, roomActionKey({ kind: 'useFountain' })),
      ),
      targetTraitKey: 'ApolloWeaponBoon',
    });
  return fOnlyProject(authorLegalTraitOffers(project));
}

function directJeweledPomFallbackProject() {
  let project = createCompleteFGProject();
  const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection,
    keepsakeKey: 'HadesAndPersephoneKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceJeweledPomEquipResult',
    result: createKeepsakeEquipResultAddress(selection, 'jeweledPom'),
    value: { traitKey: 'HadesDeathDefianceDamageBoon' },
  });
  return fOnlyProject(authorLegalTraitOffers(project));
}

function nemesisFreeItemFallbackProject() {
  const occurrenceId = goldenFOccurrenceId(5, 1);
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'SelectEncounter',
    phase,
    encounterKey: 'NemesisRandomEvent',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceNemesisRandomEventOutcome',
    event: createNemesisRandomEventAddress(phase),
    value: { kind: 'freeItem' },
    reward: { rewardType: 'LastStandDrop' },
  });
  const selected = project.route.biomes[0]?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (selected === undefined) throw new Error('missing Nemesis occurrence');
  const reference = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: 'nemesisGenerated:Encounter',
    entryKey: 'result',
  };
  const sourceIndex = selected.roomActions.order.findIndex(
    (candidate) => candidate.kind === 'interactEncounter' && candidate.phaseKey === 'Encounter',
  );
  if (sourceIndex < 0) throw new Error('missing Nemesis interaction action');
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(goldenFBiome, occurrenceId, roomActionKey(reference)),
    reference,
    index: sourceIndex + 1,
  });
  return fOnlyProject(authorLegalTraitOffers(project));
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

  it('assembles Overview, normal Doors, planner-owned timeline nodes, and diagnostic-only Run State', () => {
    const product = productFor(createCompleteFGProject());
    const opening = product.occurrences[0]!;
    expect(opening.overview.encounterPhases.length).toBeGreaterThan(0);
    expect(opening.doors.kind).toBe('batch');
    if (opening.doors.kind === 'batch') {
      expect(opening.doors.targets.length).toBeGreaterThan(0);
      expect(opening.doors.targets[0]).not.toHaveProperty('picked');
      expect(opening.doors.targets[0]).not.toHaveProperty('type');
    }
    expect(opening.diagnostics?.roomEntered?.checkpoint).toBe('roomEntered');
    expect(opening.diagnostics?.beforeRoomExit?.checkpoint).toBe('beforeRoomExit');
    expect(opening.diagnostics?.roomEntered).not.toEqual(opening.diagnostics?.beforeRoomExit);
    expect(opening.timeline.transactions.length).toBeGreaterThan(0);
    expect(opening.doors.kind).not.toBe('terminal');
    expect(opening.timeline.transactions.every((transaction) => !('required' in transaction))).toBe(
      true,
    );
    expect(opening.timeline.dependencies).toEqual(expect.any(Array));
  });

  it('publishes Artificer production and Mystery Boon owner relations', () => {
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
    const sourceTransaction = artificer.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find(
        (transaction) => transaction.kind === 'acquisition' && transaction.owner === sourceOwner,
      );
    expect(sourceTransaction).toBeDefined();
    expect(sourceTransaction?.kind === 'acquisition' && sourceTransaction.roles).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'self', disposition: 'artificer' })]),
    );
    if (sourceTransaction?.kind !== 'acquisition')
      throw new Error('Artificer source transaction is missing');
    expect(
      sourceTransaction.roles.find((role) => role.disposition === 'artificer'),
    ).not.toHaveProperty('replacement');
    expect(
      artificer.occurrences.some((occurrence) =>
        occurrence.timeline.dependencies.some(
          (dependency) =>
            dependency.owner === generated.owner && dependency.afterOwner === sourceOwner,
        ),
      ),
    ).toBe(true);
    expect(generated.owner.length).toBeGreaterThan(256);
    expect(() => encodeExecutionPlan(compileExecutionPlan({ product: artificer }))).not.toThrow();

    const timePiece = productFor(timePieceCreatedBoonProject());
    expect(
      timePiece.occurrences
        .flatMap((occurrence) => occurrence.timeline.transactions)
        .some(
          (transaction) =>
            transaction.kind === 'acquisition' &&
            transaction.roles.some((role) => role.gameName === 'ApolloUpgrade'),
        ),
    ).toBe(false);
    expect(
      timePiece.occurrences.some((occurrence) =>
        occurrence.roomExitConformance?.facts.some((fact) => fact.kind === 'keepsakeEffects'),
      ),
    ).toBe(true);
    expect(() => encodeExecutionPlan(compileExecutionPlan({ product: timePiece }))).not.toThrow();

    const timePieceChild = productFor(timePieceArtificerChildProject());
    const timePieceChildTransactions = timePieceChild.occurrences.flatMap(
      (occurrence) => occurrence.timeline.transactions,
    );
    const timePieceChildSource = timePieceChildTransactions.find(
      (transaction) =>
        transaction.kind === 'acquisition' &&
        transaction.roles.some(
          (role) => role.disposition === 'artificer' && role.replacement !== undefined,
        ),
    );
    expect(timePieceChildSource).toBeDefined();
    expect(
      timePieceChildSource?.kind === 'acquisition'
        ? timePieceChildSource.roles.find((role) => role.disposition === 'artificer')?.replacement
        : undefined,
    ).toEqual({
      reward: expect.objectContaining({ rewardType: 'Boon', source: 'ZeusUpgrade' }),
      gameName: 'ZeusUpgrade',
    });
    expect(
      timePieceChildTransactions.some(
        (transaction) =>
          transaction.kind === 'acquisition' &&
          transaction.roles.some((role) => role.producer?.kind === 'artificerReplacement'),
      ),
    ).toBe(false);
    expect(
      timePieceChild.occurrences.some((occurrence) =>
        occurrence.roomExitConformance?.facts.some((fact) => fact.kind === 'keepsakeEffects'),
      ),
    ).toBe(true);
    expect(() =>
      encodeExecutionPlan(compileExecutionPlan({ product: timePieceChild })),
    ).not.toThrow();

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
    expect(mysteryOccurrence?.timeline.transactions).toContain(mysteryTransaction);
  });

  it('publishes an authored optional acquisition as one obligated transaction', () => {
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
    expect(occurrence.timeline.transactions).toContainEqual(
      expect.objectContaining({ owner: mystery.transaction.owner }),
    );
    expect(occurrence.timeline.obligations).toContainEqual(
      expect.objectContaining({ owner: mystery.transaction.owner }),
    );
    expect(
      occurrence.timeline.obligations.filter(
        (obligation) => obligation.owner === mystery.transaction.owner,
      ),
    ).toHaveLength(1);
    expect(occurrence.timeline.obligations).toHaveLength(occurrence.timeline.transactions.length);
  });

  it('keeps an unpicked Mystery Boon atomic to its active Narcissus provider action', () => {
    const product = productFor(narcissusMysteryBoonProject(false));
    const story = product.occurrences.find((occurrence) => occurrence.gameName === 'G_Story01');
    expect(story?.timeline.transactions).toContainEqual(
      expect.objectContaining({ kind: 'encounterInteraction', phaseKey: 'Encounter' }),
    );
    expect(story?.timeline.transactions).not.toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        reward: expect.objectContaining({ rewardType: 'BlindBoxLoot' }),
      }),
    );
  });

  it('publishes required Onion and an authored neutral Well purchase', () => {
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

    let neutralProject = createCompleteFGProject();
    neutralProject = applyProjectCommand(neutralProject, catalog, {
      kind: 'SetStygianWellInteraction',
      occurrence: createOccurrenceAddress(
        goldenFBiome,
        createOccurrenceId('golden-f-preboss-shop:postboss'),
      ),
      interacted: true,
    });
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    for (const [slotKey, itemKey] of [
      ['healing', 'ArmorBoostStore'],
      ['secondLeft', 'TemporaryBoonRarityTrait'],
      ['secondRight', 'LimitedSwapTraitDrop'],
    ] as const) {
      neutralProject = applyProjectCommand(neutralProject, catalog, {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey,
        itemKey,
      });
    }
    neutralProject = applyProjectCommand(neutralProject, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:healing',
      purchased: true,
    });
    const neutral = productFor(authorLegalTraitOffers(neutralProject));
    const neutralPurchase = neutral.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find(
        (transaction) =>
          transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:healing',
      );
    expect(neutralPurchase).toMatchObject({ kind: 'wellPurchase', effect: 'neutral' });
    expect(
      neutral.occurrences
        .flatMap((occurrence) => occurrence.timeline.obligations)
        .filter((obligation) => obligation.owner === neutralPurchase?.owner),
    ).toHaveLength(1);
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

  it('binds a same-Shop Pom mutation dependency to its purchase transaction', () => {
    const shop = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b5-e1'));
    const minor = createShopOfferAddress(goldenGBiome, shop.occurrenceId, 'Minor');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: minor,
      value: { rewardType: 'StoreRewardRandomStack' },
    });
    project = replaceTestShopOfferActions(project, catalog, shop, ['Minor', 'Boon']);
    project = authorLegalTraitOffers(project);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(minor, 'self'),
      value: { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
    });

    const occurrence = productFor(project).occurrences.find(
      (candidate) => candidate.id === shop.occurrenceId,
    );
    const minorPurchase = occurrence?.timeline.transactions.find(
      (transaction) => transaction.kind === 'shopPurchase' && transaction.offerKey === 'Minor',
    );
    const boonPurchase = occurrence?.timeline.transactions.find(
      (transaction) => transaction.kind === 'shopPurchase' && transaction.offerKey === 'Boon',
    );
    expect(minorPurchase).toBeDefined();
    expect(boonPurchase).toBeDefined();
    expect(occurrence?.timeline.dependencies).toContainEqual({
      owner: boonPurchase?.owner,
      afterOwner: minorPurchase?.owner,
    });
  });

  it('publishes a generated Well fallback before purchase and reuses it when purchased', () => {
    const wellId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const well = createOccurrenceAddress(goldenFBiome, wellId);
    const project = applyProjectCommand(createUnderworldFWellCheckpoint(), catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'healing',
      itemKey: 'LastStandShopItem',
    });
    const unpurchased = productFor(authorLegalTraitOffers(project)).occurrences.find(
      (candidate) => candidate.id === wellId,
    );
    const fallback = Object.freeze({
      preferredKey: 'LastStandShopItem',
      fallbackKey: 'ArmorBoostStore',
      availabilityContact: 'storeInventoryGeneration' as const,
    });
    expect(
      unpurchased?.overview.stygianWell?.offers?.find(
        (offer) => offer.generationKey === 'initial:healing',
      )?.runtimeFallbacks,
    ).toEqual([fallback]);
    expect(
      unpurchased?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:healing',
      ),
    ).toBeUndefined();

    const purchasedProject = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:healing',
      purchased: true,
    });
    const purchased = productFor(authorLegalTraitOffers(purchasedProject)).occurrences.find(
      (candidate) => candidate.id === wellId,
    );
    expect(
      purchased?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:healing',
      ),
    ).toMatchObject({
      runtimeFallbacks: [
        {
          ...fallback,
          availabilityContact: 'storePurchase',
        },
      ],
    });
  });

  it('copies a planner-selected Shop fallback into Overview and its retained purchase', () => {
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
    const assembly = simulateProjectAssembly(catalog, authorLegalTraitOffers(project));
    const fallbackAddress = createShopOfferAddress(goldenFBiome, shop.occurrenceId, 'Boon');
    const evaluated = assembly.evaluation.route.biomes.find(
      (biome): biome is CompleteValidBiomeProjectEvaluation =>
        biome.biomeKey === 'F' && biome.authoring === 'complete' && biome.validity === 'valid',
    );
    if (evaluated === undefined) throw new Error('Shop fallback fixture lacks complete F');
    const canonical = [
      evaluated.snapshot.entryRoom,
      ...evaluated.snapshot.decisions.flatMap((decision) =>
        decision.kind === 'batch' ? decision.targets.map((target) => target.room) : [],
      ),
    ].find((room) => room.occurrenceId === shop.occurrenceId);
    if (canonical === undefined) throw new Error('Shop fallback fixture lacks canonical Shop');
    const patchedEvaluation = Object.freeze({
      ...evaluated,
      rewards: Object.freeze({
        ...evaluated.rewards,
        runtimeOfferFallbacks: Object.freeze([
          ...evaluated.rewards.runtimeOfferFallbacks,
          Object.freeze({
            address: fallbackAddress,
            preferredKey: 'RandomLoot',
            fallbackKey: 'ArmorBoost',
            availabilityContact: 'storeInventoryGeneration' as const,
          }),
          Object.freeze({
            address: fallbackAddress,
            preferredKey: 'RandomLoot',
            fallbackKey: 'ArmorBoost',
            availabilityContact: 'storePurchase' as const,
          }),
        ]),
      }),
    });
    const overview = assembleExecutionOverview(canonical, patchedEvaluation, undefined);
    const transactions = executionTimelineTransactions(
      canonical,
      patchedEvaluation,
      patchedEvaluation.rewards.timelineFacts,
    );
    const fallback = overview.shop?.offers.find(
      (offer) => offer.offerKey === 'Boon',
    )?.runtimeFallbacks;
    expect(fallback).toEqual([
      {
        preferredKey: 'RandomLoot',
        fallbackKey: 'ArmorBoost',
        availabilityContact: 'storeInventoryGeneration',
      },
    ]);
    expect(
      transactions.find(
        (transaction) => transaction.kind === 'shopPurchase' && transaction.offerKey === 'Boon',
      ),
    ).toMatchObject({
      runtimeFallbacks: [
        {
          preferredKey: 'RandomLoot',
          fallbackKey: 'ArmorBoost',
          availabilityContact: 'storePurchase',
        },
      ],
    });
  });

  it('publishes declaration-owned Postboss rack and fountain presence without interactions', () => {
    const product = productFor(createCompleteFGProject());
    const postboss = product.occurrences.find(
      (occurrence) => occurrence.gameName === 'F_PostBoss01',
    );
    expect(postboss?.overview.keepsakeRack).toEqual({});
    expect(postboss?.overview.fountain).toEqual({});
  });

  it('publishes direct Jeweled Pom runtime fallback at route start and rack contacts', () => {
    const start = productFor(directJeweledPomFallbackProject());
    expect(start.startingKeepsake.equipResults?.jeweledPom).toMatchObject({
      traitKey: 'HadesDeathDefianceDamageBoon',
      runtimeFallbacks: [
        {
          preferredKey: 'HadesDeathDefianceDamageBoon',
          fallbackKey: 'HadesLifestealBoon',
          availabilityContact: 'traitEligibility',
        },
      ],
    });

    const rack = productFor(rackBeforeFountainProject('HadesDeathDefianceDamageBoon'));
    const postboss = rack.occurrences.find((occurrence) => occurrence.gameName === 'F_PostBoss01');
    expect(
      postboss?.timeline.transactions.find((transaction) => transaction.kind === 'keepsakeChange'),
    ).toMatchObject({
      equipResults: {
        jeweledPom: {
          runtimeFallbacks: [
            {
              preferredKey: 'HadesDeathDefianceDamageBoon',
              fallbackKey: 'HadesLifestealBoon',
              availabilityContact: 'traitEligibility',
            },
          ],
        },
      },
    });
  });

  it('publishes Nemesis free-item fallback on the encounter resolution contact', () => {
    const product = productFor(nemesisFreeItemFallbackProject());
    const interaction = product.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .find(
        (transaction) =>
          transaction.kind === 'encounterInteraction' &&
          transaction.resolution?.kind === 'nemesisRandomEvent',
      );
    expect(interaction).toMatchObject({
      resolution: {
        kind: 'nemesisRandomEvent',
        outcome: {
          kind: 'freeItem',
          runtimeFallbacks: [
            {
              preferredKey: 'LastStandDrop',
              fallbackKey: 'ArmorBoost',
              availabilityContact: 'npcConsumableSelection',
            },
          ],
        },
      },
    });
  });

  it('closes a Postboss Yarn purchase through Well state without a cross-room edge', () => {
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
    const sourceOccurrence = product.occurrences.find((occurrence) =>
      occurrence.timeline.transactions.some((transaction) => transaction.owner === yarn?.owner),
    );
    expect(sourceOccurrence?.roomExitConformance?.facts).toContainEqual({ kind: 'stygianWell' });
    expect(
      product.occurrences.flatMap((occurrence) => occurrence.timeline.dependencies),
    ).not.toContainEqual(expect.objectContaining({ afterOwner: yarn?.owner }));
  });

  it('uses the resolved Fateful Twist effect in the source-room Well conformance', () => {
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
    expect(twist).toBeDefined();
    const twistOccurrence = product.occurrences.find((occurrence) =>
      occurrence.timeline.transactions.some((transaction) => transaction.owner === twist?.owner),
    );
    expect(twistOccurrence?.roomExitConformance?.facts).toContainEqual({ kind: 'stygianWell' });
    expect(
      product.occurrences.flatMap((occurrence) => occurrence.timeline.dependencies),
    ).not.toContainEqual(expect.objectContaining({ afterOwner: twist?.owner }));
  });

  it('publishes reached automatic outcomes while keeping Run State diagnostic-only', () => {
    const product = productFor(automaticOutcomeProject());
    expect(product.startingKeepsake.equipResults?.transcendentEmbryo).toEqual({
      blessingKey: 'ChaosWeaponBlessing',
      blessingValues: { damageBonus: 0.7 },
    });
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
          blessingValues: {},
        }),
      ]),
    );
    expect(product.occurrences.every((occurrence) => !('runState' in occurrence))).toBe(true);
    expect(product.occurrences.some((occurrence) => occurrence.diagnostics !== undefined)).toBe(
      true,
    );
  });

  it('copies exact Boss Arcana outcomes and their semantic order into execution', () => {
    const project = bossAutomaticOutcomeProject();
    const assembly = simulateProjectAssembly(catalog, project);
    if (!assembly.evaluation.route.summary.eligibleForExecutionPlan)
      throw new Error(
        `Boss outcome fixture is invalid: ${JSON.stringify(assembly.evaluation.findings)}`,
      );
    const product = assembleExecutionProduct({ assembly });
    const boss = product.occurrences.find((occurrence) => occurrence.gameName === 'F_Boss01');
    const judgment = boss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'automatic' && transaction.effect === 'judgment',
    );
    const figurine = boss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'automatic' && transaction.effect === 'crystalFigurine',
    );
    expect(judgment).toMatchObject({
      kind: 'automatic',
      rarity: 'Epic',
      window: { kind: 'bossDefeated', phaseKey: 'Encounter' },
    });
    expect(figurine).toMatchObject({
      kind: 'automatic',
      rarity: 'Epic',
      window: { kind: 'bossDefeated', phaseKey: 'Encounter' },
    });
    expect(boss?.timeline.dependencies).toContainEqual({
      owner: figurine?.owner,
      afterOwner: judgment?.owner,
    });
  });

  it('publishes the sparse F/G mutation edges and checkpoints', () => {
    const unrelated = productFor(postbossKeepsakeOrderProject('GoldifyKeepsake', 0));
    const unrelatedPostboss = unrelated.occurrences.find(
      (occurrence) => occurrence.gameName === 'F_PostBoss01',
    );
    const unrelatedRack = unrelatedPostboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'keepsakeChange',
    );
    const unrelatedFountain = unrelatedPostboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'fountainUse',
    );
    expect(unrelatedPostboss?.timeline.dependencies).not.toContainEqual({
      owner: unrelatedFountain?.owner,
      afterOwner: unrelatedRack?.owner,
    });

    const rackBefore = productFor(postbossKeepsakeOrderProject('FountainRarityKeepsake', 0));
    const postboss = rackBefore.occurrences.find(
      (occurrence) => occurrence.gameName === 'F_PostBoss01',
    );
    expect(postboss).toBeDefined();
    const rackTransaction = postboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'keepsakeChange',
    );
    const fountainTransaction = postboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'fountainUse',
    );
    expect(rackTransaction).toBeDefined();
    expect(fountainTransaction).toMatchObject({
      kind: 'fountainUse',
      interactionKey: 'fountain',
    });
    expect(postboss?.timeline.dependencies).toContainEqual({
      owner: fountainTransaction?.owner,
      afterOwner: rackTransaction?.owner,
    });

    const fountainBefore = productFor(postbossKeepsakeOrderProject('FountainRarityKeepsake', 1));
    const reversePostboss = fountainBefore.occurrences.find(
      (occurrence) => occurrence.gameName === 'F_PostBoss01',
    );
    const reverseRack = reversePostboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'keepsakeChange',
    );
    const reverseFountain = reversePostboss?.timeline.transactions.find(
      (transaction) => transaction.kind === 'fountainUse',
    );
    expect(reversePostboss?.timeline.dependencies).toContainEqual({
      owner: reverseRack?.owner,
      afterOwner: reverseFountain?.owner,
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
    // Make the first accepted purchase neutral. Travel Deal still retains it
    // as the opaque source of the later refill and qualifying purchases.
    wellProject = applyProjectCommand(wellProject, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'TemporaryImprovedSecondaryTrait',
    });
    wellProject = applyProjectCommand(wellProject, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondRight',
      itemKey: 'TemporaryImprovedDefenseTrait',
    });
    const refillAction = {
      kind: 'purchaseStygianWellOffer' as const,
      generationKey: 'travelDealRefill' as const,
    };
    const nextWell = {
      kind: 'purchaseStygianWellOffer' as const,
      generationKey: 'initial:secondRight' as const,
    };
    wellProject = applyProjectCommand(wellProject, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, wellId, roomActionKey(refillAction)),
      toIndex: 3,
    });
    wellProject = applyProjectCommand(wellProject, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, wellId, roomActionKey(nextWell)),
      toIndex: 3,
    });
    const wellProduct = productFor(authorLegalTraitOffers(wellProject));
    const wellOccurrence = wellProduct.occurrences.find((occurrence) =>
      occurrence.id.endsWith(':postboss'),
    );
    const refill = wellOccurrence?.timeline.transactions.find(
      (transaction) => transaction.kind === 'wellRefill',
    );
    const refillPurchase = wellOccurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'travelDealRefill',
    );
    const nextWellTransaction = wellOccurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:secondRight',
    );
    const source = wellOccurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:secondLeft',
    );
    const fountain = wellOccurrence?.timeline.transactions.find(
      (transaction) => transaction.kind === 'fountainUse',
    );
    expect(refill).toMatchObject({
      kind: 'wellRefill',
      generationKey: 'travelDealRefill',
      offerKey: 'ExtendedShopTrait',
    });
    expect(refillPurchase).toBeDefined();
    expect(nextWellTransaction).toBeDefined();
    expect(source).toMatchObject({ kind: 'wellPurchase', effect: 'neutral' });
    expect(wellOccurrence?.timeline.dependencies).toContainEqual({
      owner: refill?.owner,
      afterOwner: source?.owner,
    });
    expect(wellOccurrence?.timeline.dependencies).toContainEqual({
      owner: refillPurchase?.owner,
      afterOwner: refill?.owner,
    });
    expect(wellOccurrence?.timeline.dependencies).toContainEqual({
      owner: nextWellTransaction?.owner,
      afterOwner: source?.owner,
    });
    expect(wellOccurrence?.timeline.dependencies).toContainEqual({
      owner: nextWellTransaction?.owner,
      afterOwner: refillPurchase?.owner,
    });
    expect(wellOccurrence?.timeline.dependencies).not.toContainEqual(
      expect.objectContaining({ owner: fountain?.owner }),
    );
    expect(wellOccurrence?.timeline.dependencies).not.toContainEqual(
      expect.objectContaining({ afterOwner: fountain?.owner }),
    );
    expect(wellOccurrence?.timeline.obligations).toContainEqual({
      owner: refill?.owner,
      checkpoint: 'roomExit',
    });
  });

  it('realizes a Travel Deal Well refill and protects its source when the refill is not purchased', () => {
    const wellId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const well = createOccurrenceAddress(goldenFBiome, wellId);
    let project = applyProjectCommand(createUnderworldFWellCheckpoint(), catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'TemporaryImprovedSecondaryTrait',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondRight',
      purchased: false,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'travelDealRefill',
      purchased: false,
    });
    const occurrence = productFor(authorLegalTraitOffers(project)).occurrences.find(
      (candidate) => candidate.id === wellId,
    );
    const refill = occurrence?.timeline.transactions.find(
      (transaction) => transaction.kind === 'wellRefill',
    );
    const refillPurchase = occurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'travelDealRefill',
    );
    const source = occurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:secondLeft',
    );
    const competitor = occurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'wellPurchase' && transaction.generationKey === 'initial:secondRight',
    );
    expect(refill).toMatchObject({
      kind: 'wellRefill',
      generationKey: 'travelDealRefill',
      offerKey: 'ExtendedShopTrait',
    });
    expect(refillPurchase).toBeUndefined();
    expect(source).toMatchObject({ kind: 'wellPurchase', effect: 'neutral' });
    expect(competitor).toBeUndefined();
    expect(occurrence?.timeline.dependencies).toContainEqual({
      owner: refill?.owner,
      afterOwner: source?.owner,
    });
    expect(occurrence?.timeline.dependencies).toEqual([
      { owner: refill?.owner, afterOwner: source?.owner },
    ]);
  });

  it('projects only supplied occurrence-local dependencies without semantic inference', () => {
    const assembly = simulateProjectAssembly(catalog, fOnlyProject());
    const biome = assembly.evaluation.route.biomes[0];
    const room =
      biome?.authoring === 'complete' && biome.validity === 'valid'
        ? biome.snapshot.entryRoom
        : undefined;
    if (room === undefined) throw new Error('fixture lacks an opening room');
    const x = createRoomActionAddress(goldenFBiome, goldenFOccurrenceId(1, 1), 'generic-x');
    const y = createRoomActionAddress(goldenFBiome, goldenFOccurrenceId(1, 1), 'generic-y');
    const z = createRoomActionAddress(goldenFBiome, goldenFOccurrenceId(1, 1), 'generic-z');
    const key = (owner: typeof x) => semanticAddressKey(owner);
    const transaction = (owner: typeof x): ExecutionTimelineTransaction =>
      Object.freeze({
        kind: 'fountainUse',
        owner: key(owner),
        interactionKey: 'fountain',
        window: Object.freeze({ kind: 'standard', phase: 'afterCombat' }),
      });
    const facts: PlannerTimelineFacts = Object.freeze({
      nodes: Object.freeze([
        Object.freeze({ owner: x, included: false }),
        Object.freeze({ owner: y, included: true }),
        Object.freeze({ owner: z, included: false }),
      ]),
      dependencies: Object.freeze([Object.freeze({ owner: y, afterOwner: x })]),
    });
    // Publication supplies only intended transactions and their planner-owned
    // dependency endpoints. The projection itself only copies owners and
    // edges; it does not infer anything from the transaction kind.
    const projected = assembleTimelineRelations(
      [transaction(x), transaction(y), transaction(z)],
      room,
      facts,
    );
    expect(projected.transactions.map((entry) => entry.owner)).toEqual([key(x), key(y), key(z)]);
    expect(projected.dependencies).toEqual([{ owner: key(y), afterOwner: key(x) }]);
    expect(projected.dependencies).not.toContainEqual({ owner: key(y), afterOwner: key(z) });
  });

  it('publishes exactly one obligation for every intended transaction', () => {
    for (const project of [
      fOnlyProject(),
      artificerCreatedBoonProject(),
      timePieceArtificerChildProject(),
      narcissusMysteryBoonProject(),
    ]) {
      const product = productFor(project);
      for (const occurrence of product.occurrences) {
        expect(occurrence.timeline.obligations).toHaveLength(
          occurrence.timeline.transactions.length,
        );
        for (const transaction of occurrence.timeline.transactions)
          expect(
            occurrence.timeline.obligations.filter(
              (obligation) => obligation.owner === transaction.owner,
            ),
          ).toHaveLength(1);
      }
    }
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
