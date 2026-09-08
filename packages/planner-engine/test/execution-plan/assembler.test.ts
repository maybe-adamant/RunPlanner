import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  authorTestArtificerReplacement,
  createCompleteFGAnomalyProject,
  createCompleteFGIxionChaosProject,
  createCompleteFGProject,
  createGoldenFGHProject,
  createUnderworldFPoolCheckpoint,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenGOccurrenceId,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  authorLegalTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNOProject,
  loadSurfaceNOPQProject,
  nBiome,
  oBiome,
  oOccurrenceIds,
  qBiome,
} from '@run-planner/test-fixtures/surface';
import {
  applyProjectCommand,
  acquisitionSiteFromStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createRouteAddress,
  createFountainRarityOutcomeAddress,
  createKeepsakeEquipResultAddress,
  createLevelResolutionAddress,
  createNemesisRandomEventAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
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
import { orderedExecutionRooms } from '../../src/execution-plan/assembly/route';
import { executionTimelineTransactions } from '../../src/execution-plan/assembly/timeline-transactions';
import { traitOffer as decodeExecutionTraitOffer } from '../../src/execution-plan/codec/rewards';
import { overview as decodeExecutionOverview } from '../../src/execution-plan/codec/overview';
import { transaction as decodeExecutionTransaction } from '../../src/execution-plan/codec/timeline';
import type { ExecutionTimelineTransaction } from '../../src/execution-plan/model';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  mergePlannerTimelineFacts,
  type PlannerTimelineFacts,
} from '../../src/simulation/timeline-facts';
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

function withFigLeaf(project: ReturnType<typeof createCompleteFGProject>) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'SkipEncounterKeepsake',
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

function nemesisFreeItemProject() {
  const occurrenceId = goldenFOccurrenceId(5, 1);
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  let project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
    kind: 'SelectEncounter',
    phase,
    encounterKey: 'NemesisRandomEvent',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceNemesisRandomEventOutcome',
    event: createNemesisRandomEventAddress(phase),
    value: { kind: 'freeItem' },
    reward: { rewardType: 'EmptyMaxHealthDrop' },
  });
  return fOnlyProject(authorLegalTraitOffers(project));
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

describe('engine-owned F/G execution semantic product', () => {
  it('publishes the complete N Hub board and generated unvisited local slots without restores', () => {
    const source = loadSurfaceNOProject();
    const project = Object.freeze({
      ...source,
      route: Object.freeze({
        ...source.route,
        biomes: Object.freeze(source.route.biomes.slice(0, 1)),
      }),
    });
    const product = assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, authorLegalTraitOffers(project)),
    });
    const preHub = product.occurrences.find((entry) => entry.id === 'surface-n-prehub');
    expect(preHub?.overview.hub?.room.gameName).toBe('N_Hub');
    expect(preHub?.overview.hub?.slots.length).toBeGreaterThan(8);
    expect(
      preHub?.overview.hub?.slots.some(
        (slot) => !product.selectedOccurrenceIds.includes(slot.room.id),
      ),
    ).toBe(true);
    const main = product.occurrences.find((entry) =>
      entry.overview.localSlots?.some(
        (slot) =>
          slot.generation === 'generated' &&
          !product.selectedOccurrenceIds.includes(slot.room?.id ?? ''),
      ),
    );
    expect(main?.overview.localSlots).toBeDefined();
    expect(
      product.occurrences.some(
        (entry) =>
          !product.selectedOccurrenceIds.includes(entry.id) &&
          entry.overview.localSlots === undefined &&
          preHub?.overview.hub?.slots.some((slot) => slot.room.id === entry.id),
      ),
    ).toBe(true);
    const notGenerated = product.occurrences.flatMap((entry) =>
      (entry.overview.localSlots ?? []).filter((slot) => slot.generation === 'notGenerated'),
    );
    expect(notGenerated.length).toBeGreaterThan(0);
    expect(notGenerated.every((slot) => slot.room === undefined && slot.reward === undefined)).toBe(
      true,
    );
    expect(product.selectedOccurrenceIds).not.toContain('N_Hub');
    expect(product.occurrences.some((entry) => entry.gameName === 'N_Hub')).toBe(false);
    expect(() => encodeExecutionPlan(compileExecutionPlan({ product }))).not.toThrow();
  });
  it('publishes O ShipCombat wheel cohorts and their picked choices as one DAG', () => {
    const product = productFor(loadSurfaceNOProject());
    const shipRooms = product.occurrences.filter(
      (occurrence) => occurrence.overview.rewardWheels !== undefined,
    );
    expect(shipRooms.length).toBeGreaterThan(0);
    for (const room of shipRooms) {
      const wheels = room.overview.rewardWheels!;
      expect(wheels.length).toBeGreaterThan(0);
      for (const wheel of wheels) {
        expect(wheel.offerCount).toBe(wheel.offers.length);
        expect(new Set(wheel.offers.map((offer) => offer.offerKey)).size).toBe(wheel.offers.length);
        expect(wheel.offers.map((offer) => offer.offerKey)).toContain(wheel.pickedOfferKey);
        const choice = room.timeline.transactions.find(
          (transaction) =>
            transaction.kind === 'chooseRewardWheel' && transaction.wheelKey === wheel.wheelKey,
        );
        expect(choice).toMatchObject({
          kind: 'chooseRewardWheel',
          wheelKey: wheel.wheelKey,
          pickedOfferKey: wheel.pickedOfferKey,
          window: { kind: 'shipPreCombat', wheelKey: wheel.wheelKey },
        });
        const pickup = room.timeline.transactions.find(
          (transaction) =>
            transaction.kind === 'acquisition' &&
            transaction.sourceOwner.includes('rewardWheelOffer') &&
            transaction.sourceOwner.includes(wheel.wheelKey),
        );
        expect(pickup).toBeDefined();
        if (pickup?.kind !== 'acquisition' || choice?.kind !== 'chooseRewardWheel')
          throw new Error('wheel transaction missing');
        expect(room.timeline.dependencies).toContainEqual({
          owner: pickup.owner,
          afterOwner: choice.owner,
        });
        expect(pickup.reward).toEqual(
          wheel.offers.find((offer) => offer.offerKey === wheel.pickedOfferKey)?.reward,
        );
        expect(
          decodeExecutionOverview(JSON.parse(JSON.stringify(room.overview)), 'O overview'),
        ).toEqual(room.overview);
        expect(
          decodeExecutionTransaction(JSON.parse(JSON.stringify(choice)), 'O wheel choice'),
        ).toEqual(choice);
        expect(
          decodeExecutionTransaction(JSON.parse(JSON.stringify(pickup)), 'O wheel pickup'),
        ).toEqual(pickup);
      }
    }
  });
  it('publishes both ShipCombat phase counts and wheel cohort widths', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel1', 'offer2'),
      value: { rewardType: 'MetaCardPointsCommonBigDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2'),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    const room = productFor(project).occurrences.find(
      (candidate) => candidate.id === occurrence.occurrenceId,
    );
    expect(room?.overview.encounterPhases.map((phase) => phase.slotKey)).toEqual([
      'Intro',
      'Combat1',
      'Combat2',
    ]);
    expect(room?.overview.rewardWheels?.map((entry) => entry.offerCount)).toEqual([2, 1]);
    const wheelChoices = room?.timeline.transactions.filter(
      (transaction) => transaction.kind === 'chooseRewardWheel',
    );
    const wheelPickups = room?.timeline.transactions.filter(
      (transaction) =>
        transaction.kind === 'acquisition' && transaction.window.kind === 'shipPostCombat',
    );
    expect(wheelChoices?.map((transaction) => transaction.wheelKey)).toEqual(['wheel1', 'wheel2']);
    expect(
      wheelPickups?.flatMap((transaction) =>
        transaction.window.kind === 'shipPostCombat' ? [transaction.window.wheelKey] : [],
      ),
    ).toEqual(['wheel1', 'wheel2']);

    const baseline = productFor(loadSurfaceNOProject()).occurrences.find(
      (candidate) => candidate.id === occurrence.occurrenceId,
    );
    expect(baseline?.overview.encounterPhases.map((phase) => phase.slotKey)).toEqual([
      'Intro',
      'Combat1',
    ]);
    expect(baseline?.overview.rewardWheels?.map((entry) => entry.offerCount)).toEqual([1]);
  });
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

  it('publishes exact Fig Leaf results only for supported encounter phases', () => {
    const positivePhase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
      'Encounter',
    );
    const positiveProject = applyProjectCommand(withFigLeaf(createCompleteFGProject()), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: positivePhase,
      value: true,
    });
    const positive = productFor(positiveProject).occurrences.find(
      (occurrence) => occurrence.id === goldenFOccurrenceId(1, 1),
    );
    expect(positive?.overview.encounterPhases).toContainEqual(
      expect.objectContaining({
        encounterKey: 'GeneratedF',
        kind: 'combat',
        figLeafSkip: true,
      }),
    );

    const negativeProject = withFigLeaf(createCompleteFGProject());
    const negative = productFor(negativeProject).occurrences.find(
      (occurrence) => occurrence.id === goldenFOccurrenceId(2, 1),
    );
    expect(negative?.overview.encounterPhases).toContainEqual(
      expect.objectContaining({ slotKey: 'Encounter', figLeafSkip: false }),
    );

    const absent = productFor(createCompleteFGProject()).occurrences.find(
      (occurrence) => occurrence.id === goldenFOccurrenceId(2, 1),
    );
    expect(absent?.overview.encounterPhases[0]).not.toHaveProperty('figLeafSkip');

    const blockedProject = withFigLeaf(createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }));
    const blocked = productFor(blockedProject).occurrences.find(
      (occurrence) => occurrence.id === goldenGOccurrenceId(6, 1),
    );
    expect(blocked?.overview.encounterPhases[0]).not.toHaveProperty('figLeafSkip');
  });

  it('publishes the exact native item created by a Nemesis free-item event', () => {
    const occurrence = productFor(nemesisFreeItemProject()).occurrences.find(
      (candidate) => candidate.id === goldenFOccurrenceId(5, 1),
    );
    const interaction = occurrence?.timeline.transactions.find(
      (transaction) =>
        transaction.kind === 'encounterInteraction' &&
        transaction.resolution?.kind === 'nemesisRandomEvent',
    );
    expect(interaction).toMatchObject({
      kind: 'encounterInteraction',
      resolution: {
        kind: 'nemesisRandomEvent',
        outcome: { kind: 'freeItem', itemGameName: 'EmptyMaxHealthDrop' },
      },
    });
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

  it('publishes the selected Circe resolution from a real complete-valid O occurrence', () => {
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Surface'),
      arcanaKeys: [],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          oBiome,
          { kind: 'occurrence', occurrenceId: oOccurrenceIds.story },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Circe',
        options: [
          {
            traitKey: 'RandomArcanaTrait',
            circeResolution: { kind: 'activateArcana', arcanaKeys: ['ChanneledCast'] },
          },
          { traitKey: 'CirceShrinkTrait' },
          { traitKey: 'CirceEnlargeTrait' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const biome = assembly.evaluation.route.biomes.find(
      (candidate): candidate is CompleteValidBiomeProjectEvaluation =>
        candidate.biomeKey === 'O' &&
        candidate.authoring === 'complete' &&
        candidate.validity === 'valid',
    );
    if (biome === undefined)
      throw new Error(
        `Circe execution fixture lacks complete-valid O: ${JSON.stringify(assembly.evaluation.findings)}`,
      );
    const room = orderedExecutionRooms([biome]).find(
      (candidate) => candidate.occurrenceId === oOccurrenceIds.story,
    );
    if (room === undefined) throw new Error('Circe story occurrence is missing');
    const transactions = executionTimelineTransactions(
      room,
      biome,
      mergePlannerTimelineFacts(
        room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
        biome.rewards.timelineFacts,
      ),
    );
    const transaction = transactions.find(
      (candidate) =>
        candidate.kind === 'encounterInteraction' && candidate.phaseKey === 'Encounter',
    );
    if (
      transaction?.kind !== 'encounterInteraction' ||
      transaction.resolution?.kind !== 'traitOffer'
    )
      throw new Error('Circe encounter offer is missing');
    const executionOffer = transaction.resolution.offer;
    expect(executionOffer).toMatchObject({
      giver: 'Circe',
      selected: 'option1',
    });
    if (executionOffer.kind !== 'traits')
      throw new Error('Circe encounter did not publish a trait offer');
    expect(executionOffer.options[0]).toEqual({
      key: 'RandomArcanaTrait',
      circeResolution: { kind: 'activateArcana', arcanaKeys: ['ChanneledCast'] },
    });
    expect(executionOffer.options[1]).not.toHaveProperty('circeResolution');
    expect(executionOffer.options[2]).not.toHaveProperty('circeResolution');
    expect(() => decodeExecutionTraitOffer(executionOffer, 'Circe offer')).not.toThrow();
  });

  it('publishes Latest Model exact Hammer target from a complete-valid Icarus occurrence', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat03'],
    });
    project = authorLegalTraitOffers(project);
    const phase = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat01 },
      'Combat1',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'IcarusCombatO',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(phase, 'selection'),
      value: {
        kind: 'traits',
        giverKey: 'Icarus',
        options: [
          { traitKey: 'UpgradeHammerBoon', targetTraitKey: 'StaffDoubleAttackTrait' },
          { traitKey: 'OmegaExplodeBoon' },
          { traitKey: 'CastHazardBoon' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const biome = assembly.evaluation.route.biomes.find(
      (candidate): candidate is CompleteValidBiomeProjectEvaluation =>
        candidate.biomeKey === 'O' &&
        candidate.authoring === 'complete' &&
        candidate.validity === 'valid',
    );
    if (biome === undefined)
      throw new Error(
        `Icarus execution fixture lacks complete-valid O: ${JSON.stringify(assembly.evaluation.findings)}`,
      );
    const room = orderedExecutionRooms([biome]).find(
      (candidate) => candidate.occurrenceId === oOccurrenceIds.combat01,
    );
    if (room === undefined) throw new Error('Icarus occurrence is missing');
    const encounterRoom = Object.freeze({
      ...room,
      roomLifecycleTimeline: Object.freeze({
        ...room.roomLifecycleTimeline,
        entries: Object.freeze(
          room.roomLifecycleTimeline.entries.filter(
            (entry) =>
              entry.kind !== 'action' ||
              (entry.action.reference.kind === 'interactEncounter' &&
                entry.action.reference.phaseKey === 'Combat1'),
          ),
        ),
      }),
      roomActionRoster: Object.freeze({
        ...room.roomActionRoster,
        rows: Object.freeze(
          room.roomActionRoster.rows
            .filter(
              (row) =>
                row.reference.kind === 'interactEncounter' && row.reference.phaseKey === 'Combat1',
            )
            .map((row) =>
              Object.freeze({
                ...row,
                window: Object.freeze({ kind: 'standard' as const, phase: 'afterCombat' as const }),
              }),
            ),
        ),
      }),
    });
    const transaction = executionTimelineTransactions(
      encounterRoom,
      biome,
      mergePlannerTimelineFacts(
        room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
        biome.rewards.timelineFacts,
      ),
    ).find(
      (candidate) => candidate.kind === 'encounterInteraction' && candidate.phaseKey === 'Combat1',
    );
    if (
      transaction?.kind !== 'encounterInteraction' ||
      transaction.resolution?.kind !== 'traitOffer' ||
      transaction.resolution.offer.kind !== 'traits'
    )
      throw new Error('Icarus encounter offer is missing');
    const executionOffer = transaction.resolution.offer;
    expect(executionOffer.options[0]).toMatchObject({
      key: 'UpgradeHammerBoon',
      icarusHammerTarget: 'StaffDoubleAttackTrait',
    });
    expect(executionOffer.options[1]).not.toHaveProperty('icarusHammerTarget');
    expect(() => decodeExecutionTraitOffer(executionOffer, 'Icarus offer')).not.toThrow();
  });

  it('publishes Echo Boon Boon Boon as one exact mixed-provider nested menu', () => {
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = authorLegalTraitOffers(createGoldenFGHProject());
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenHBiome,
          { kind: 'occurrence', occurrenceId: bridgeId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          {
            traitKey: 'EchoLastRunBoon',
            echoLastRunBoon: {
              options: [
                {
                  giverKey: 'Aphrodite',
                  traitKey: 'HighHealthOffenseBoon',
                  rarity: 'Common',
                },
                { giverKey: 'Artemis', traitKey: 'SupportingFireBoon', rarity: 'Rare' },
                { giverKey: 'Hermes', traitKey: 'DodgeChanceBoon', rarity: 'Epic' },
              ],
              selectedOptionKey: 'option2',
            },
          },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const forcedTargetId = createOccurrenceId('golden-h-combat05');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenHBiome, forcedTargetId),
      gameName: 'H_MiniBoss02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenHBiome, forcedTargetId),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = authorLegalTraitOffers(project);
    const biome = simulateProjectAssembly(catalog, project).evaluation.route.biomes.find(
      (candidate) => candidate.biomeKey === 'H',
    );
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
      throw new Error(
        `Echo projection requires a complete-valid H biome: ${JSON.stringify(biome?.findings)}`,
      );
    const bridge = orderedExecutionRooms([biome]).find((room) => room.gameName === 'H_Bridge01');
    if (bridge === undefined) throw new Error('Echo projection requires H_Bridge01');
    const transactions = executionTimelineTransactions(
      bridge,
      biome,
      mergePlannerTimelineFacts(
        bridge.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
        biome.rewards.timelineFacts,
      ),
    );
    const transaction = transactions.find((candidate) => {
      if (candidate.kind !== 'encounterInteraction') return false;
      const resolution = candidate.resolution;
      return (
        resolution?.kind === 'traitOffer' &&
        resolution.offer.kind === 'traits' &&
        resolution.offer.giver === 'Echo'
      );
    });
    if (
      transaction?.kind !== 'encounterInteraction' ||
      transaction.resolution?.kind !== 'traitOffer' ||
      transaction.resolution.offer.kind !== 'traits'
    )
      throw new Error('Echo encounter offer is missing');
    const executionOffer = transaction.resolution.offer;
    expect(executionOffer.options[0]?.echoLastRunBoon).toEqual({
      options: [
        {
          giver: 'Aphrodite',
          key: 'HighHealthOffenseBoon',
          rarity: 'Common',
          lootHistorySource: 'AphroditeUpgrade',
        },
        { giver: 'Artemis', key: 'SupportingFireBoon', rarity: 'Rare' },
        {
          giver: 'Hermes',
          key: 'DodgeChanceBoon',
          rarity: 'Epic',
          lootHistorySource: 'HermesUpgrade',
        },
      ],
      selected: 'option2',
    });
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

  it('publishes an unpurchased Anvil only as visible Shop inventory', () => {
    const shopId = createOccurrenceId('surface-q-preboss');
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(qBiome, shopId, 'PremiumProgress'),
      value: { rewardType: 'ChaosWeaponUpgrade' },
    });
    project = authorLegalTraitOffers(project);
    const assembly = simulateProjectAssembly(catalog, project);
    const biome = assembly.evaluation.route.biomes.find(
      (candidate): candidate is CompleteValidBiomeProjectEvaluation =>
        candidate.biomeKey === 'Q' &&
        candidate.authoring === 'complete' &&
        candidate.validity === 'valid',
    );
    if (biome === undefined)
      throw new Error(
        `Anvil execution fixture lacks complete-valid Q: ${JSON.stringify(assembly.evaluation.findings)}`,
      );
    const room = orderedExecutionRooms([biome]).find(
      (candidate) => candidate.occurrenceId === shopId,
    );
    if (room === undefined) throw new Error('Q World Shop occurrence is missing');
    expect(assembleExecutionOverview(room, biome, undefined).shop?.offers).toContainEqual({
      offerKey: 'PremiumProgress',
      optionKey: 'ChaosWeaponUpgrade',
      rewardType: 'ChaosWeaponUpgrade',
    });
    expect(
      executionTimelineTransactions(
        room,
        biome,
        mergePlannerTimelineFacts(
          room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
          biome.rewards.timelineFacts,
        ),
      ),
    ).not.toContainEqual(expect.objectContaining({ kind: 'shopPurchase' }));
  });

  it('publishes complete Shrine inventory, Travel Deal, and exact delivery identities', () => {
    const shrineAddress = createOccurrenceAddress(
      nBiome,
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    let project = loadSurfaceNOProject();
    const travelDealSource = createIncomingRewardAddress(
      nBiome,
      createOccurrenceId('surface-n-combat09'),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, createOccurrenceId('surface-n-combat05')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'AresUpgrade' },
      },
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
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: shrineAddress,
      value: { rewardType: 'ArmorBoost' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: shrineAddress,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: true },
    });
    project = authorLegalTraitOffers(project);

    const assembly = simulateProjectAssembly(catalog, project);
    const nEvaluation = assembly.evaluation.route.biomes.find(
      (candidate): candidate is CompleteValidBiomeProjectEvaluation =>
        candidate.biomeKey === 'N' &&
        candidate.authoring === 'complete' &&
        candidate.validity === 'valid',
    );
    if (nEvaluation === undefined)
      throw new Error(
        `Shrine execution fixture is incomplete: ${JSON.stringify(assembly.evaluation.findings)}`,
      );
    const shrineRoom = orderedExecutionRooms([nEvaluation]).find(
      (room) => room.occurrenceId === shrineAddress.occurrenceId,
    );
    if (shrineRoom === undefined) throw new Error('Shrine execution fixture lacks N Postboss');
    const overview = assembleExecutionOverview(shrineRoom, nEvaluation, undefined);
    expect(overview.hermesShrine?.offers).toEqual([
      expect.objectContaining({
        generationKey: 'initial:first',
        slotIndex: 1,
        purchase: { roomDelay: 2, rushed: true },
        deliverySourceKey: expect.stringContaining('initial%3Afirst'),
      }),
      expect.objectContaining({
        generationKey: 'initial:secondLeft',
        slotIndex: 2,
      }),
      expect.objectContaining({ generationKey: 'initial:secondRight', slotIndex: 3 }),
    ]);
    expect(overview.hermesShrine?.offers[2]).not.toHaveProperty('purchase');
    expect(overview.hermesShrine?.travelDealRefill).toMatchObject({
      sourceGenerationKey: 'initial:first',
      slotIndex: 1,
      optionKey: 'ArmorBoost',
      rewardType: 'ArmorBoost',
    });
    expect(overview.hermesShrine?.travelDealRefill).not.toHaveProperty('purchase');

    const timeline = executionTimelineTransactions(
      shrineRoom,
      nEvaluation,
      mergePlannerTimelineFacts(
        shrineRoom.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
        nEvaluation.rewards.timelineFacts,
      ),
    );
    const rushedDelivery = timeline.find(
      (transaction) =>
        transaction.kind === 'acquisition' &&
        transaction.hermesShrineSourceKey?.includes('initial%3Afirst'),
    );
    expect(rushedDelivery).toBeDefined();
    expect(decodeExecutionOverview(JSON.parse(JSON.stringify(overview)), 'overview')).toEqual(
      overview,
    );
    if (rushedDelivery === undefined) throw new Error('Shrine delivery transaction is missing');
    expect(
      decodeExecutionTransaction(JSON.parse(JSON.stringify(rushedDelivery)), 'transaction'),
    ).toEqual(rushedDelivery);
  });

  it('requires and publishes the exact result for a purchased Anvil', () => {
    const shopId = createOccurrenceId('surface-q-preboss');
    const shop = createOccurrenceAddress(qBiome, shopId);
    const offer = createShopOfferAddress(qBiome, shopId, 'PremiumProgress');
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
    project = replaceTestShopOfferActions(project, catalog, shop, ['PremiumProgress']);
    project = authorLegalTraitOffers(project);
    const assembly = simulateProjectAssembly(catalog, project);
    const biome = assembly.evaluation.route.biomes.find(
      (candidate): candidate is CompleteValidBiomeProjectEvaluation =>
        candidate.biomeKey === 'Q' &&
        candidate.authoring === 'complete' &&
        candidate.validity === 'valid',
    );
    if (biome === undefined)
      throw new Error(
        `purchased Anvil fixture lacks complete-valid Q: ${JSON.stringify(assembly.evaluation.findings)}`,
      );
    const room = orderedExecutionRooms([biome]).find(
      (candidate) => candidate.occurrenceId === shopId,
    );
    if (room === undefined) throw new Error('Q World Shop occurrence is missing');
    expect(
      executionTimelineTransactions(
        room,
        biome,
        mergePlannerTimelineFacts(
          room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
          biome.rewards.timelineFacts,
        ),
      ),
    ).toContainEqual(
      expect.objectContaining({
        kind: 'shopPurchase',
        offerKey: 'PremiumProgress',
        anvilResult: {
          kind: 'anvilOfFates',
          removedTraitKey: 'StaffDoubleAttackTrait',
          addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'],
        },
      }),
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

  it('publishes declaration-owned Postboss rack and fountain presence without interactions', () => {
    const product = productFor(createCompleteFGProject());
    const postboss = product.occurrences.find(
      (occurrence) => occurrence.gameName === 'F_PostBoss01',
    );
    expect(postboss?.overview.keepsakeRack).toEqual({});
    expect(postboss?.overview.fountain).toEqual({});
  });

  it('marks selected canonical Postboss occurrences as recovery boundaries', () => {
    const underworld = productFor(loadUnderworldFGHICheckpoint());
    const surface = productFor(loadSurfaceNOPQProject());
    for (const product of [underworld, surface]) {
      const selected = new Set(product.selectedOccurrenceIds);
      const marked = product.occurrences.filter(
        (occurrence) => occurrence.resumeBoundary !== undefined,
      );
      expect(marked.length).toBeGreaterThan(0);
      expect(marked.every((occurrence) => selected.has(occurrence.id))).toBe(true);
      expect(marked.every((occurrence) => occurrence.resumeBoundary === 'postbossEntry')).toBe(
        true,
      );
      expect(marked.every((occurrence) => occurrence.diagnostics?.roomEntered !== undefined)).toBe(
        true,
      );
      expect(
        product.occurrences
          .filter((occurrence) => selected.has(occurrence.id))
          .filter((occurrence) => occurrence.gameName.endsWith('_PostBoss01')).length,
      ).toBe(marked.length);
      expect(
        product.occurrences
          .filter((occurrence) => selected.has(occurrence.id))
          .filter((occurrence) => !occurrence.gameName.endsWith('_PostBoss01'))
          .every((occurrence) => occurrence.resumeBoundary === undefined),
      ).toBe(true);
    }
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
    expect(
      pool.occurrences.flatMap((occurrence) =>
        occurrence.timeline.transactions.map((transaction) => transaction.kind),
      ),
    ).not.toContain('poolSale');
    const poolOccurrence = pool.occurrences.find(
      (occurrence) => occurrence.overview.purgingPool?.interacted === true,
    );
    expect(poolOccurrence?.roomExitConformance?.facts).toContainEqual({
      kind: 'traitInventory',
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
