import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createBatchRewardStoreAddress,
  createAcquisitionSiteAddress,
  createAcquisitionEntryAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createLevelResolutionAddress,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createTargetAddress,
  createTraitOfferAddress,
  createProjectHistory,
  createRouteAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  roomActionKey,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  seaStarDuplicateAcquisitionSite,
  seaStarDuplicateSiteKey,
  semanticAddressKey,
  type ProjectDocument,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { selectedPickupProducers } from '@run-planner/engine/authored-project';
import {
  activateTemporaryArcana,
  assessTraitOption,
  createTraitHistoryState,
  blockedOccurrenceRoomForProjectEvaluationAssembly,
  createPreparedProjectCandidateSession,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
  type TraitHistoryEvent,
} from '@run-planner/engine/simulation';
import {
  authorLegalTraitOffers,
  authorTestArtificerReplacement,
  editTestRoomActionOrder,
} from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { createCompleteNProject } from '../authored-project/support/complete-n-project';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits/state';
import { factsWithHistory } from '@run-planner/engine/reward-kernel';
import { settlePickupAcquisitionSite } from '../../src/simulation/rewards/acquisition/site-settlement';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import type { SimulationState } from '../../src/simulation/state/model';
import { replaceSimulationTraitHistory } from '../../src/simulation/state/transitions';
import { initializeTestRewardBranch } from '../support/arcana-fear';
import { baseFacts } from './shop-trait-purchase-support';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { resolveProducedRerollGrant } from '../../src/simulation/state/pending-resource-pickups';
import { foldTraitHistoryEvents } from '../../src/simulation/traits/history/fold';
import {
  arcanaFearWithActive,
  testRewardBranchAtOrdinal,
  traitFrontierState,
} from '../support/simulation-state';
import { withArcana, withGoldenUnderworldJudgments } from '../support/rerolls';
import { reachedFrontier } from '../support/reward-frontier';

function narcissusOccurrence(project: ProjectDocument) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
  if (occurrence === undefined)
    throw new Error('Golden G fixture has no Narcissus story occurrence');
  return occurrence;
}

function replacePickupActions(
  project: ProjectDocument,
  site: ReturnType<typeof createAcquisitionSiteAddress>,
  entryKeys: readonly string[],
): ProjectDocument {
  if (site.owner.kind !== 'occurrence') throw new Error('pickup site is not occurrence-owned');
  const siteKey = site.pointKey === 'roomExit' ? 'roomExit' : acquisitionSiteStorageKey(site);
  return editTestRoomActionOrder(project, catalog, site.owner, (order) => [
    ...order.filter(
      (reference) => reference.kind !== 'interactAcquisitionEntry' || reference.siteKey !== siteKey,
    ),
    ...entryKeys.map((entryKey) => ({
      kind: 'interactAcquisitionEntry' as const,
      siteKey,
      entryKey,
    })),
  ]);
}

/** Takes the Narcissus trait; its drops are authored explicitly by each test, so none are taken. */
function selectNarcissus(project: ProjectDocument, traitKeys: readonly [string, string, string]) {
  return withoutTraitDrops(takeNarcissus(project, traitKeys));
}

function withoutTraitDrops(project: ProjectDocument): ProjectDocument {
  const occurrence = narcissusOccurrence(project);
  return editTestRoomActionOrder(
    project,
    catalog,
    createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
    (order) =>
      order.filter(
        (reference) =>
          reference.kind !== 'interactAcquisitionEntry' ||
          !reference.siteKey.startsWith('traitGenerated:'),
      ),
  );
}

function takeNarcissus(project: ProjectDocument, traitKeys: readonly [string, string, string]) {
  const occurrence = narcissusOccurrence(project);
  return applyProjectCommand(project, catalog, {
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
      options: traitKeys.map((traitKey) => ({ traitKey })) as [
        { traitKey: string },
        { traitKey: string },
        { traitKey: string },
      ],
      selectedOptionKey: 'option1',
    },
  });
}

function evaluatedG(project: ProjectDocument) {
  const g = simulateProject(catalog, project).route?.biomes.find((biome) => biome.biomeKey === 'G');
  if (g === undefined || !('rewards' in g)) throw new Error('G did not publish reward products');
  return g;
}

function narcissusOutgoingBatch(project: ProjectDocument) {
  const occurrence = narcissusOccurrence(project);
  const g = evaluatedG(project);
  const snapshot = 'snapshot' in g ? g.snapshot : g.materializedPrefix;
  const batch = snapshot.decisions.find(
    (decision) =>
      decision.kind === 'batch' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === occurrence.occurrenceId,
  );
  if (batch === undefined) throw new Error('Narcissus has no generated outgoing batch');
  return batch;
}

function pickupEntry(project: ProjectDocument, key: string) {
  const occurrence = narcissusOccurrence(project);
  const siteKey = Object.entries(occurrence.acquisitionSites ?? {}).find(([, site]) =>
    Object.hasOwn(site.pickupEntries ?? {}, key),
  )?.[0];
  if (siteKey === undefined) throw new Error(`Narcissus has no ${key} pickup entry`);
  return createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      siteKey,
    ),
    key,
  );
}

function pickupSite(project: ProjectDocument) {
  const occurrence = narcissusOccurrence(project);
  const siteKey = Object.entries(occurrence.acquisitionSites ?? {}).find(
    ([, site]) => Object.keys(site.pickupEntries ?? {}).length > 0,
  )?.[0];
  if (siteKey === undefined) throw new Error('Narcissus has no generated pickup site');
  return createAcquisitionSiteAddress(
    createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
    siteKey,
  );
}

describe('Narcissus pickup producer', () => {
  it('requires one of the three currently active reroll Arcana for Fates’ Trimmings', () => {
    const history = createTraitHistoryState();
    for (const cardKey of ['ScreenReroll', 'TradeOff', 'DoorReroll']) {
      expect(
        assessTraitOption(
          catalog,
          'NarcissusF',
          traitFrontierState(history, { arcanaFear: arcanaFearWithActive([cardKey]) }),
          {},
        ).legal,
      ).toBe(true);
    }
    expect(assessTraitOption(catalog, 'NarcissusF', traitFrontierState(history), {}).legal).toBe(
      false,
    );
    for (const activeCardKeys of [[], ['MaxHealth']]) {
      expect(
        assessTraitOption(
          catalog,
          'NarcissusF',
          traitFrontierState(history, { arcanaFear: arcanaFearWithActive(activeCardKeys) }),
          {},
        ).findings,
      ).toEqual([expect.objectContaining({ code: 'missingPrerequisite' })]);
    }
  });

  it('adds Fates’ Trimmings’ rerolls to the pool only when its reroll drop is collected', () => {
    const withCard = withGoldenUnderworldJudgments(
      withArcana(createCompleteFGProject(), ['DoorReroll']),
    );
    const taken = takeNarcissus(withCard, ['NarcissusF', 'NarcissusB', 'NarcissusC']);
    const entry = pickupEntry(taken, 'reroll');
    expect(
      narcissusOccurrence(taken).roomActions.order.filter(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === entry.site.pointKey,
      ),
    ).toEqual([
      { kind: 'interactAcquisitionEntry', siteKey: entry.site.pointKey, entryKey: 'reroll' },
    ]);
    const granted = (project: ProjectDocument) => {
      const g = evaluatedG(project);
      expect(g.findings).toEqual([]);
      return [
        ...new Set(
          reachedFrontier(g.rewards).map((branch) => branch.state.arcanaFear.arcana.rerollPool),
        ),
      ].map((pool) => pool.granted - pool.spent);
    };
    const [collected] = granted(taken);
    const [skipped] = granted(withoutTraitDrops(taken));
    expect(collected! - skipped!).toBe(2);
  });

  it('reads the reroll drop’s amount at its producing trait’s acquisition ordinal', () => {
    const history = foldTraitHistoryEvents(catalog, []);
    const at = (acquisitionOrdinal: number) =>
      resolveProducedRerollGrant(
        catalog,
        {
          ...history,
          equippedTraits: {
            NarcissusF: { traitKey: 'NarcissusF', acquisitionOrdinal } as never,
          },
        },
        'RerollDrop',
        'NarcissusPickup',
        'reroll',
      );
    expect([1, 2, 3, 4].map(at)).toEqual([2, 2, 3, 5]);
    expect(resolveProducedRerollGrant(catalog, history, 'RerollDrop', 'RoomReward', 'reroll')).toBe(
      1,
    );
    expect(
      resolveProducedRerollGrant(catalog, history, 'MaxManaDrop', 'NarcissusPickup', 'maxMana'),
    ).toBe(0);
  });

  it('grants a Sea Star duplicate of the reroll drop its rerolls again', () => {
    // RerollDrop inherits BaseConsumable's CanDuplicate; the duplicate re-enables the same object.
    const traitHistory = Object.freeze({
      ...createTraitHistoryState(),
      equippedTraits: Object.freeze({
        NarcissusF: { traitKey: 'NarcissusF', acquisitionOrdinal: 1 } as never,
        DoubleRewardBoon: Object.freeze({
          traitKey: 'DoubleRewardBoon',
          giverKey: 'Poseidon',
          providerKind: 'olympian' as const,
          rarity: 'Common' as const,
          sourceRole: 'selection',
        }),
      }),
    });
    const initial = initializeTestRewardBranch();
    const branch = Object.freeze({
      ...initial,
      state: replaceSimulationTraitHistory(initial.state, traitHistory),
    });
    const occurrence = createOccurrenceAddress(goldenGBiome, createOccurrenceId('reroll-drop'));
    const site = createAcquisitionSiteAddress(occurrence, 'traitGenerated:reroll');
    const entry = createAcquisitionEntryAddress(site, 'reroll');
    const source = createAcquisitionRoleAddress(entry, 'self');
    const drop = () =>
      createUnresolvedAcquisitionRewardState(
        catalog,
        { rewardType: 'RerollDrop' },
        { kind: 'producerLifecycle', key: 'NarcissusPickup' },
        'Underworld',
      );
    const facts = (state: SimulationState) =>
      factsWithHistory(baseFacts(), state.rewardHistory, new Set());
    const granted = (settled: RewardBranchState | undefined) =>
      settled?.state.arcanaFear.arcana.rerollPool.granted;
    const before = branch.state.arcanaFear.arcana.rerollPool.granted;

    const collected = settlePickupAcquisitionSite(catalog, branch, {
      siteOwner: occurrence,
      site,
      entries: Object.freeze({ reroll: drop() }),
      order: Object.freeze(['reroll']),
      producerLifecycleKey: 'NarcissusPickup',
      presentsMaterializedScreen: false,
      historySequence: 1,
      facts,
      authoredSeaStarDuplicateSiteKeys: new Set([seaStarDuplicateSiteKey(source)]),
    }).branch;
    expect(granted(collected)).toBe(before + 2);

    const duplicated = settlePickupAcquisitionSite(catalog, collected, {
      siteOwner: occurrence,
      site: seaStarDuplicateAcquisitionSite(occurrence, source),
      entries: Object.freeze({ [SEA_STAR_DUPLICATE_ENTRY_KEY]: drop() }),
      order: Object.freeze([SEA_STAR_DUPLICATE_ENTRY_KEY]),
      producerLifecycleKey: 'NarcissusPickup',
      producerByEntryKey: Object.freeze({
        [SEA_STAR_DUPLICATE_ENTRY_KEY]: Object.freeze({
          kind: 'seaStarDuplicate' as const,
          sourceOwner: entry,
          sourceRole: 'self',
        }),
      }),
      seaStarDuplicateEntryKeys: new Set([SEA_STAR_DUPLICATE_ENTRY_KEY]),
      presentsMaterializedScreen: false,
      historySequence: 2,
      facts,
    }).branch;
    expect(granted(duplicated)).toBe(before + 4);
  });

  it('shares the reached Arcana state between Narcissus candidates and selected offer findings', () => {
    const loadout = { ...createDefaultRouteLoadout(catalog), manualArcanaKeys: [] };
    const initial = createArcanaFearState(catalog, loadout);
    const owner = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('narcissus-arcana') },
      'Encounter',
    );
    const activation = activateTemporaryArcana(catalog, initial, ['DoorReroll'], {
      owner,
      sequence: 1,
    });
    expect(activation.legal).toBe(true);
    for (const [state, eligible] of [
      [initial, false],
      [activation.state, true],
    ] as const) {
      const branch = testRewardBranchAtOrdinal(2, 'Underworld', catalog, state);
      const unresolved = settleEncounterTraitOffer(
        catalog,
        branch,
        owner,
        null,
        2,
        'encounterCompleted',
        undefined,
        'selection',
        undefined,
        {},
        undefined,
        'Narcissus',
      );
      const context = unresolved.blockedChild?.candidateContext;
      expect(context).toBeDefined();
      expect(assessTraitOption(catalog, 'NarcissusF', context!.state, context!.source).legal).toBe(
        eligible,
      );
      const selected = settleEncounterTraitOffer(
        catalog,
        branch,
        owner,
        {
          kind: 'traits',
          giverKey: 'Narcissus',
          options: [
            { traitKey: 'NarcissusF' },
            { traitKey: 'NarcissusB' },
            { traitKey: 'NarcissusC' },
          ],
          selectedOptionKey: 'option1',
        },
        2,
        'encounterCompleted',
        undefined,
        'selection',
        undefined,
        {},
      );
      expect(
        selected.findingEntries.some((entry) => entry.finding.code === 'missingPrerequisite'),
      ).toBe(!eligible);
      if (eligible)
        expect(selected.branch.state.traitHistory?.equippedTraits.NarcissusF).toBeDefined();
    }
  });

  it('command-reconciles fourth-ordinal Narcissus entries and retracts them with their source', () => {
    const biome = createBiomeAddress('Dream', 'G');
    const storyId = createOccurrenceId('dream-ordinal-narcissus-story');
    let project = createProjectDocument(catalog, {
      projectId: 'dream-ordinal-narcissus',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['F', 'H', 'I', 'G'],
      configuredBiomeCount: 4,
    });
    const startId = project.route.biomes[3]!.topology!.startOccurrenceId;
    const decision = createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, decision.source),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, 'exit1'),
      occurrenceId: storyId,
      gameName: 'G_Story01',
    });
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: storyId },
        'Encounter',
      ),
      'selection',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusA' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusC' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const selectedOccurrence = narcissusOccurrence(project);
    const site = Object.entries(selectedOccurrence.acquisitionSites ?? {}).find(([, value]) =>
      Object.hasOwn(value.pickupEntries ?? {}, 'pom'),
    )?.[0];
    expect(site).toBeDefined();
    expect(selectedOccurrence.acquisitionSites?.[site!]?.pickupEntries).toMatchObject({
      pom: { offer: { rewardType: 'StoreRewardRandomStack' } },
      pom2: { offer: { rewardType: 'StoreRewardRandomStack' } },
      pom3: { offer: { rewardType: 'StoreRewardRandomStack' } },
      pom4: { offer: { rewardType: 'StoreRewardRandomStack' } },
    });
    const pom2 = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(biome, storyId), site!),
      'pom2',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: pom2,
      value: { rewardType: 'StoreRewardRandomStack' },
    });
    expect(narcissusOccurrence(project).acquisitionSites?.[site!]?.pickupEntries?.pom2).toEqual(
      expect.objectContaining({ offer: { rewardType: 'StoreRewardRandomStack' } }),
    );
    const removed = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait,
      selectedOptionKey: 'option2',
    });
    expect(narcissusOccurrence(removed).acquisitionSites?.[site!]).toBeUndefined();
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(removed)), catalog)).toEqual(
      removed,
    );
  });

  it('converts and later picks up an ordered Narcissus Artificer replacement', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusB',
      'NarcissusC',
      'NarcissusG',
    ]);
    const ashes = pickupEntry(project, 'ashes');
    project = authorTestArtificerReplacement(
      project,
      catalog,
      createAcquisitionRoleAddress(ashes, 'self'),
      Object.freeze({
        offer: Object.freeze({ rewardType: 'MaxHealthDrop' }),
        traitOffersByAcquisitionRole: Object.freeze({}),
        dispositionByAcquisitionRole: Object.freeze({
          self: Object.freeze({ kind: 'normal' as const }),
        }),
      }),
    );
    const occurrence = createOccurrenceAddress(
      goldenGBiome,
      narcissusOccurrence(project).occurrenceId,
    );
    const replacementSite = artificerAcquisitionSite(occurrence, ashes);
    const replacementKey = artificerReplacementEntryKey(ashes, 'self');
    expect(evaluatedG(project).findings).toEqual([]);
    project = replacePickupActions(project, ashes.site, ['ashes']);
    expect(evaluatedG(project).findings).toContainEqual(
      expect.objectContaining({
        code: 'artificerConversionUnavailable',
        origin: createAcquisitionRoleAddress(ashes, 'self'),
      }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
    });
    project = replacePickupActions(project, replacementSite, [replacementKey]);
    const branch = evaluatedG(project).rewards.frontier;
    const replacement = createAcquisitionEntryAddress(replacementSite, replacementKey);
    expect(branch?.events).toContainEqual(
      expect.objectContaining({
        kind: 'artificerConversion',
        origin: ashes,
      }),
    );
    expect(branch?.events).toContainEqual(
      expect.objectContaining({ kind: 'concreteAcquisition', origin: replacement }),
    );
    project = replacePickupActions(project, ashes.site, []);
    expect(evaluatedG(project).findings).toEqual([]);
    expect(evaluatedG(project).rewards.frontier?.events).not.toContainEqual(
      expect.objectContaining({ kind: 'concreteAcquisition', origin: replacement }),
    );
  });

  it.each([
    ['NarcissusB', 'ashes', 'MetaCardPointsCommonDrop'],
    ['NarcissusD', 'psyche', 'MemPointsCommonDrop'],
    ['NarcissusD', 'maxMana', 'MaxManaDrop'],
    ['NarcissusE', 'bones', 'MetaCurrencyDrop'],
    ['NarcissusE', 'maxHealth', 'MaxHealthDrop'],
    ['NarcissusH', 'lastStand', 'LastStandDrop'],
  ] as const)(
    'settles %s %s normally or through Time Piece as one exact free pickup',
    (traitKey, entryKey, acquisitionGameName) => {
      let normalProject = selectNarcissus(createGoldenFGHIProject(), [
        traitKey,
        'NarcissusC',
        'NarcissusG',
      ]);
      const entry = pickupEntry(normalProject, entryKey);
      const before = evaluatedG(normalProject).rewards.frontier;
      normalProject = replacePickupActions(normalProject, entry.site, [entryKey]);
      const normal = evaluatedG(normalProject).rewards.frontier;
      expect(normal?.state.rewardHistory.useRecord[acquisitionGameName]).toBe(
        (before?.state.rewardHistory.useRecord[acquisitionGameName] ?? 0) + 1,
      );
      expect(normal?.state.rewardHistory.consumableRecord[acquisitionGameName]).toBe(
        (before?.state.rewardHistory.consumableRecord[acquisitionGameName] ?? 0) + 1,
      );
      expect(normal?.events).toContainEqual(
        expect.objectContaining({
          kind: 'concreteAcquisition',
          acquisition: expect.objectContaining({
            acquisition: expect.objectContaining({ gameName: acquisitionGameName }),
          }),
          settlement: expect.objectContaining({
            entry: expect.objectContaining({ entryKey }),
          }),
        }),
      );

      let convertedProject = applyProjectCommand(normalProject, catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'GoldifyKeepsake',
      });
      convertedProject = applyProjectCommand(convertedProject, catalog, {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: createAcquisitionRoleAddress(entry, 'self'),
        value: { kind: 'timePiece' },
      });
      const converted = evaluatedG(convertedProject).rewards.frontier;
      expect(converted?.state.rewardHistory.useRecord[acquisitionGameName]).toBe(
        before?.state.rewardHistory.useRecord[acquisitionGameName],
      );
      expect(converted?.state.rewardHistory.consumableRecord[acquisitionGameName]).toBe(
        before?.state.rewardHistory.consumableRecord[acquisitionGameName],
      );
      expect(converted?.state.keepsakes.timePiece?.remainingCharges).toBe(3);
      expect(converted?.events).toContainEqual(
        expect.objectContaining({
          kind: 'conversionToGold',
          acquisition: expect.objectContaining({
            acquisition: expect.objectContaining({ gameName: acquisitionGameName }),
          }),
          settlement: expect.objectContaining({ entry: expect.objectContaining({ entryKey }) }),
        }),
      );

      convertedProject = replacePickupActions(convertedProject, entry.site, []);
      expect(
        evaluatedG(convertedProject).rewards.frontier?.state.keepsakes.timePiece?.remainingCharges,
      ).toBe(4);
      convertedProject = applyProjectCommand(convertedProject, catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'ManaOverTimeRefundKeepsake',
      });
      const retained = narcissusOccurrence(convertedProject).acquisitionSites;
      expect(evaluatedG(convertedProject).findings).toEqual([]);
      convertedProject = replacePickupActions(convertedProject, entry.site, [entryKey]);
      expect(narcissusOccurrence(convertedProject).acquisitionSites).toEqual(retained);
      expect(evaluatedG(convertedProject).findings).toContainEqual(
        expect.objectContaining({
          code: 'timePieceConversionUnavailable',
          origin: createAcquisitionRoleAddress(entry, 'self'),
        }),
      );
    },
  );

  it('retains the exact blocked Narcissus roster so a later optional pickup remains authorable', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusD',
      'NarcissusB',
      'NarcissusE',
    ]);
    const occurrence = narcissusOccurrence(project);
    const site = pickupEntry(project, 'psyche').site;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(
        createAcquisitionEntryAddress(site, 'psyche'),
        'self',
      ),
      value: { kind: 'timePiece' },
    });
    project = replacePickupActions(project, site, ['psyche']);

    const assembly = simulateProjectAssembly(catalog, project);
    const blocked = blockedOccurrenceRoomForProjectEvaluationAssembly(
      assembly,
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
    );
    const maxMana = blocked?.roomActionRoster.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' && row.reference.entryKey === 'maxMana',
    );
    expect(maxMana).toMatchObject({
      participation: 'optional',
      window: { kind: 'postOutgoing' },
      rank: null,
      stale: false,
      sourceFamily: { kind: 'trait', traitKey: 'NarcissusD' },
    });
    expect(
      blocked?.roomActionRoster.proposals.some(
        (proposal) =>
          proposal.kind === 'insert' &&
          proposal.reference.kind === 'interactAcquisitionEntry' &&
          proposal.reference.entryKey === 'maxMana' &&
          proposal.structurallyAuthorable,
      ),
    ).toBe(true);

    const laterOccurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find(
        (candidate) =>
          candidate.occurrenceId !== occurrence.occurrenceId && candidate.gameName === 'G_Combat03',
      );
    if (laterOccurrence === undefined) throw new Error('Golden G has no later Combat 03');
    expect(
      blockedOccurrenceRoomForProjectEvaluationAssembly(
        assembly,
        createOccurrenceAddress(goldenGBiome, laterOccurrence.occurrenceId),
      ),
    ).toBeUndefined();
  });

  it('materializes the complete Ashes, Psyche, and Bones producer-owned entry sets', () => {
    const cases = [
      [
        'NarcissusB',
        {
          ashes: { offer: { rewardType: 'MetaCardPointsCommonDrop' } },
        },
      ],
      [
        'NarcissusD',
        {
          psyche: { offer: { rewardType: 'MemPointsCommonDrop' } },
          maxMana: { offer: { rewardType: 'MaxManaDrop' } },
        },
      ],
      [
        'NarcissusE',
        {
          bones: { offer: { rewardType: 'MetaCurrencyDrop' } },
          maxHealth: { offer: { rewardType: 'MaxHealthDrop' } },
        },
      ],
    ] as const;

    for (const [traitKey, pickupEntries] of cases) {
      const project = selectNarcissus(createGoldenFGHIProject(), [
        traitKey,
        'NarcissusC',
        'NarcissusF',
      ]);
      const site = pickupSite(project);
      expect(narcissusOccurrence(project).acquisitionSites?.[site.pointKey]).toMatchObject({
        pickupEntries,
      });
    }
  });

  it('retains absent, normal, and Time Piece converted optional pickup states in the canonical route', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusH',
      'NarcissusB',
      'NarcissusC',
    ]);
    const entry = pickupEntry(project, 'lastStand');
    const site = pickupSite(project);
    const absent = evaluatedG(project);
    expect(narcissusOccurrence(project).roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: site.pointKey,
      entryKey: 'lastStand',
    });
    project = replacePickupActions(project, site, ['lastStand']);
    const normal = evaluatedG(project);
    expect(normal.rewards.frontier?.state.rewardHistory.consumableRecord.LastStandDrop).toBe(1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(entry, 'self'),
      value: { kind: 'timePiece' },
    });
    const converted = evaluatedG(project);
    expect(
      converted.rewards.frontier?.state.rewardHistory.consumableRecord.LastStandDrop,
    ).toBeUndefined();
    expect(converted.rewards.frontier?.events).toContainEqual(
      expect.objectContaining({ kind: 'conversionToGold' }),
    );
    expect(absent.authoring).toBe('complete');
  });

  it('never converts Narcissus’s free Blind Box or its auto-activated hidden source', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const entry = pickupEntry(project, 'mysteryBoon');
    project = replacePickupActions(project, entry.site, ['mysteryBoon']);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    project = authorLegalTraitOffers(project);
    const normalBranch = evaluatedG(project).rewards.frontier;
    expect(normalBranch?.state.rewardHistory.consumableRecord.BlindBoxLoot).toBe(1);
    expect(normalBranch?.state.rewardHistory.lastRewardRecreation?.offer.rewardType).toBe(
      'HestiaUpgrade',
    );
    expect(
      normalBranch?.state.traitHistory?.events.some(
        (event) =>
          event.kind === 'traitOffer' &&
          event.owner.kind === 'acquisitionEntry' &&
          event.owner.entryKey === 'mysteryBoon',
      ),
    ).toBe(true);
    expect(normalBranch?.state.traitHistory?.equippedTraits.NarcissusI).toBeDefined();
    const box = createAcquisitionRoleAddress(entry, 'box');
    const hiddenSource = createAcquisitionRoleAddress(entry, 'hiddenSource');
    const cases = [
      {
        acquisition: box,
        evidence: { goldConversionEligible: false, blocksGoldConversion: false },
      },
      {
        acquisition: hiddenSource,
        evidence: { goldConversionEligible: true, blocksGoldConversion: true },
      },
    ] as const;
    for (const testCase of cases) {
      const retainedInvalid = applyProjectCommand(project, catalog, {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: testCase.acquisition,
        value: { kind: 'timePiece' },
      });

      const g = evaluatedG(retainedInvalid);
      const branch = g.rewards.frontier;
      expect(branch?.state.keepsakes.timePiece?.remainingCharges).toBe(4);
      expect(branch?.events.filter((event) => event.kind === 'conversionToGold')).toEqual([]);
      expect(
        g.rewards.findings.filter((finding) => finding.code === 'timePieceConversionUnavailable'),
      ).toContainEqual(
        expect.objectContaining({
          origin: testCase.acquisition,
          evidence: expect.objectContaining({
            ...testCase.evidence,
            instanceProvenance: 'free',
          }),
        }),
      );

      const candidates = createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, retainedInvalid),
      );
      expect(
        candidates.evaluate({
          kind: 'acquisitionConversion',
          acquisition: testCase.acquisition,
        }),
      ).toMatchObject({
        kind: 'acquisitionConversion',
        result: {
          timePieceSupported: false,
          timePieceConvertible: false,
          artificerSupported: false,
          artificerConvertible: false,
        },
      });
    }
  });

  it('equips the selected Narcissus trait and settles its elemental pickups', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const site = pickupEntry(project, 'elementalBoost1').site;
    expect(occurrence.acquisitionSites?.[site.pointKey]).toMatchObject({
      pickupEntries: {
        elementalBoost1: { offer: { rewardType: 'ElementalBoost' } },
        elementalBoost2: { offer: { rewardType: 'ElementalBoost' } },
      },
    });

    const simulation = simulateProject(catalog, project);
    const g = simulation.route.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    const histories = reachedFrontier(g.rewards).map((branch) => branch.state.traitHistory);
    expect(histories[0]?.events.filter((event) => event.kind === 'elementContribution')).toEqual(
      [],
    );
    expect(histories.every((history) => history?.equippedTraits.NarcissusG !== undefined)).toBe(
      true,
    );
    expect(
      histories.every((history) =>
        history?.events.some(
          (event) =>
            event.kind === 'traitOffer' &&
            event.owner.kind === 'encounterPhase' &&
            event.owner.phaseKey === 'Encounter' &&
            event.giverKey === 'Narcissus',
        ),
      ),
    ).toBe(true);
  });

  it.each([['A'], ['B'], ['C'], ['D'], ['E'], ['G'], ['H']] as const)(
    'records Narcissus%s as an equipped trait',
    (suffix) => {
      const traitKey = `Narcissus${suffix}`;
      const options = ['NarcissusA', 'NarcissusB', 'NarcissusC', 'NarcissusD'].filter(
        (candidate) => candidate !== traitKey,
      );
      while (options.length < 3) options.push('NarcissusD');
      const project = selectNarcissus(createGoldenFGHIProject(), [
        traitKey,
        ...options.slice(0, 2),
      ] as [string, string, string]);
      const histories = reachedFrontier(evaluatedG(project).rewards).map(
        (branch) => branch.state.traitHistory,
      );
      expect(histories).not.toHaveLength(0);
      expect(histories.every((history) => history?.equippedTraits[traitKey] !== undefined)).toBe(
        true,
      );
    },
  );

  it('materializes Precious Metals Gold as a source-faithful Currency pickup', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusC',
      'NarcissusB',
      'NarcissusD',
    ]);
    const site = pickupSite(project);
    expect(narcissusOccurrence(project).acquisitionSites?.[site.pointKey]).toMatchObject({
      pickupEntries: { currency: { offer: { rewardType: 'Currency' } } },
    });

    project = replacePickupActions(project, pickupSite(project), ['currency']);
    const histories = reachedFrontier(evaluatedG(project).rewards).map(
      (branch) => branch.state.rewardHistory,
    );
    expect(histories.length).toBeGreaterThan(0);
    expect(
      histories.every(
        (history) => history.useRecord.Currency === 1 && history.consumableRecord.Currency === 1,
      ),
    ).toBe(true);
  });

  it('reconciles the default Pom pickup when its producing descriptor is selected again', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusA',
      'NarcissusD',
      'NarcissusE',
    ]);
    const site = pickupSite(project);
    expect(narcissusOccurrence(project).acquisitionSites?.[site.pointKey]).toMatchObject({
      pickupEntries: {
        pom: {
          offer: { rewardType: 'StoreRewardRandomStack' },
          levelResolutionsByAcquisitionRole: expect.any(Object),
        },
      },
    });
  });

  it('keeps the preferred Last Stand pickup authorable without a Death Defiance condition', () => {
    const disabled = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusH',
      'NarcissusB',
      'NarcissusC',
    ]);
    const disabledG = simulateProject(catalog, disabled).route?.biomes.find(
      (biome) => biome.biomeKey === 'G',
    );
    expect(disabledG?.authoring).toBe('complete');
    const site = pickupSite(disabled);
    expect(narcissusOccurrence(disabled).acquisitionSites?.[site.pointKey]).toMatchObject({
      pickupEntries: { lastStand: { offer: { rewardType: 'LastStandDrop' } } },
    });
  });

  it('keeps pickup entry detail through an undoable selected-order edit', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const history = createProjectHistory(project);
    const site = pickupEntry(project, 'elementalBoost1').site;
    const reference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: site.pointKey,
      entryKey: 'elementalBoost1',
    };
    const ordered = applyProjectHistoryCommand(history, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(
        goldenGBiome,
        occurrence.occurrenceId,
        roomActionKey(reference),
      ),
      reference,
      index: occurrence.roomActions.order.length,
    });
    expect(ordered.present).toMatchObject({
      route: expect.any(Object),
    });
    expect(undoProjectHistory(ordered).present).toBe(history.present);
    const redone = redoProjectHistory(undoProjectHistory(ordered)).present;
    expect(narcissusOccurrence(redone)).toMatchObject({
      roomActions: { order: expect.arrayContaining([reference]) },
      acquisitionSites: {
        [site.pointKey]: {
          pickupEntries: {
            elementalBoost1: { offer: { rewardType: 'ElementalBoost' } },
            elementalBoost2: { offer: { rewardType: 'ElementalBoost' } },
          },
        },
      },
    });
  });

  it('reconciles obsolete pickup entries and their order when the descriptor changes', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const site = pickupEntry(project, 'elementalBoost2').site;
    project = replacePickupActions(project, site, ['elementalBoost2']);
    const history = createProjectHistory(project);
    const reconciled = applyProjectHistoryCommand(history, catalog, {
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
        options: [
          { traitKey: 'NarcissusA' },
          { traitKey: 'NarcissusD' },
          { traitKey: 'NarcissusE' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    expect(
      narcissusOccurrence(reconciled.present).acquisitionSites?.[
        pickupSite(reconciled.present).pointKey
      ]?.pickupEntries,
    ).toEqual(expect.objectContaining({ pom: expect.any(Object) }));
    expect(narcissusOccurrence(reconciled.present).roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: site.pointKey,
      entryKey: 'elementalBoost2',
    });
    expect(undoProjectHistory(reconciled).present).toBe(history.present);
  });

  it('round-trips source-scoped pickups and rejects an unknown entry', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: {
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      };
    };
    expect(decodeProjectDocument(encoded, catalog)).toEqual(project);
    const story = encoded.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    const sourceSiteKey = pickupSite(project).pointKey;
    const site = (
      story.acquisitionSites as Record<string, { pickupEntries: Record<string, unknown> }>
    )[sourceSiteKey];
    if (site === undefined) throw new Error('encoded Narcissus source site is missing');
    site.pickupEntries.extra = { offer: { rewardType: 'ElementalBoost' } };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/pickupEntries/);

    const forged = JSON.parse(encodeProjectDocument(project)) as typeof encoded;
    const forgedStory = forged.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    (forgedStory.acquisitionSites as Record<string, unknown>)['traitGenerated:forged:option1'] = {
      pickupEntries: {},
    };
    expect(() => decodeProjectDocument(forged, catalog)).toThrow(
      /does not name a selected generated-pickup source/,
    );

    const malformed = JSON.parse(encodeProjectDocument(project)) as typeof encoded;
    const malformedStory = malformed.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    (malformedStory.acquisitionSites as Record<string, unknown>)['traitGenerated:'] = {
      pickupEntries: {},
    };
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow(
      /invalid generated-pickup site key/,
    );
  });

  it('rejects a selected pickup producer whose source-scoped site omits pickupEntries', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: {
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      };
    };
    const story = encoded.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    const sourceSiteKey = pickupSite(project).pointKey;
    const site = (story.acquisitionSites as Record<string, Record<string, unknown>>)[sourceSiteKey];
    if (site === undefined) throw new Error('encoded Narcissus source site is missing');
    delete site.pickupEntries;
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/pickupEntries/);
  });

  it('preserves ordinary Shop schema-34 state and rejects non-derived pickup entries', () => {
    const shop = createCompleteNProject();
    const encoded = JSON.parse(encodeProjectDocument(shop)) as {
      route: {
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      };
    };
    expect(decodeProjectDocument(encoded, catalog)).toEqual(shop);
    const occurrence = encoded.route!.biomes[0]!.topology!.occurrences.find(
      (entry) =>
        (entry.state as { kind?: string } | undefined)?.kind === 'shop' &&
        (entry.acquisitionSites as { roomExit?: unknown } | undefined)?.roomExit !== undefined,
    );
    if (occurrence === undefined) throw new Error('N fixture has no Shop acquisition site');
    const state = occurrence.state as {
      shop: { offers: Record<string, { reward: unknown }> };
    };
    (occurrence.acquisitionSites as { roomExit: Record<string, unknown> }).roomExit.pickupEntries =
      {
        copiedOffer: state.shop.offers.Boon!.reward,
      };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      /supported supplemental Shop entry/,
    );
  });

  it('keeps Narcissus BlindBox source dormant until picked, then records its entry-owned fresh offer', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const pickup = pickupEntry(project, 'mysteryBoon');
    const entry = occurrence.acquisitionSites?.[pickup.site.pointKey]?.pickupEntries?.mysteryBoon;
    expect(entry).toBeNull();
    let simulation = simulateProject(catalog, project);
    let g = simulation.route.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    expect(
      g.rewards.frontier?.state.traitHistory?.events.some(
        (event) => event.kind === 'traitOffer' && event.owner.kind === 'acquisitionEntry',
      ),
    ).toBe(false);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: pickup,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(pickup, 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = replacePickupActions(project, pickup.site, ['mysteryBoon']);
    simulation = simulateProject(catalog, project);
    g = simulation.route.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    expect(g.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({
        address: expect.objectContaining({
          owner: expect.objectContaining({ kind: 'acquisitionEntry', entryKey: 'mysteryBoon' }),
        }),
      }),
    );
  });

  it('derives Buried Treasure from the real Narcissus Story BlindBox source without Bones', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const mysteryBoon = pickupEntry(project, 'mysteryBoon');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: mysteryBoon,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    });
    const hiddenSource = createTraitOfferAddress(mysteryBoon, 'hiddenSource');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: hiddenSource,
      value: {
        kind: 'traits',
        giverKey: 'Poseidon',
        options: [
          { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    const producer = selectedPickupProducers(
      catalog,
      goldenGBiome,
      narcissusOccurrence(project),
      catalog.rooms.byKey[narcissusOccurrence(project).gameName]!,
      3,
    ).find((candidate) => candidate.traitKey === 'RoomRewardBonusBoon');
    expect(producer?.pickups.map((pickup) => pickup.key)).toEqual([
      'smallGold',
      'tinyGold1',
      'tinyGold2',
      'minorHeal1',
      'minorHeal2',
    ]);
    if (producer === undefined) throw new Error('Buried Treasure producer is missing');
    expect(narcissusOccurrence(project).acquisitionSites?.[producer.siteKey]).toMatchObject({
      pickupEntries: {
        smallGold: { offer: { rewardType: 'RoomMoneySmallDrop' } },
        tinyGold1: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
        tinyGold2: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
        minorHeal1: { offer: { rewardType: 'HealDropMinor' } },
        minorHeal2: { offer: { rewardType: 'HealDropMinor' } },
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('keeps the generated outgoing G batch byte-identical across Narcissus pickup edits', () => {
    const baseline = createCompleteFGProject();
    const descriptor = selectNarcissus(baseline, ['NarcissusI', 'NarcissusB', 'NarcissusC']);
    const ordered = replacePickupActions(descriptor, pickupSite(descriptor), ['mysteryBoon']);
    const repaired = applyProjectCommand(ordered, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: pickupEntry(ordered, 'mysteryBoon'),
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });

    expect(narcissusOutgoingBatch(descriptor)).toEqual(narcissusOutgoingBatch(baseline));
    expect(narcissusOutgoingBatch(ordered)).toEqual(narcissusOutgoingBatch(descriptor));
    expect(narcissusOutgoingBatch(repaired)).toEqual(narcissusOutgoingBatch(descriptor));
  });

  it('retains the exact Narcissus pickup frontier when its outgoing decision is absent', () => {
    let completed = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    completed = replacePickupActions(completed, pickupSite(completed), ['mysteryBoon']);
    const entry = pickupEntry(completed, 'mysteryBoon');
    completed = applyProjectCommand(completed, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    completed = applyProjectCommand(completed, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const occurrence = narcissusOccurrence(completed);
    const incomplete = applyProjectCommand(completed, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: occurrence.occurrenceId,
      }),
    });

    const site = pickupSite(completed);
    expect(
      narcissusOccurrence(incomplete).acquisitionSites?.[site.pointKey]?.pickupEntries,
    ).toEqual(occurrence.acquisitionSites?.[site.pointKey]?.pickupEntries);
    const incompleteG = evaluatedG(incomplete);
    expect(incompleteG.authoring).toBe('incomplete');
    const selectedChild = (project: ProjectDocument) =>
      evaluatedG(project).rewards.selectedTraitOffers.filter(
        (offer) =>
          offer.address.owner.kind === 'acquisitionEntry' &&
          offer.address.owner.entryKey === 'mysteryBoon',
      );
    const childFindings = (project: ProjectDocument) =>
      evaluatedG(project).rewards.findings.filter((finding) => {
        const owner =
          finding.origin.kind === 'traitOffer' || finding.origin.kind === 'levelResolution'
            ? finding.origin.owner
            : finding.origin;
        return owner.kind === 'acquisitionEntry' && owner.entryKey === 'mysteryBoon';
      });
    expect(selectedChild(incomplete)).toEqual(selectedChild(completed));
    expect(childFindings(incomplete)).toEqual(childFindings(completed));
    const candidateValue = {
      rewardType: 'BlindBoxLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'HestiaUpgrade' as const },
    };
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, incomplete),
      ).evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: candidateValue,
      }),
    ).toEqual(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, completed),
      ).evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: candidateValue,
      }),
    );
  });

  it('leaves unpicked pickups out of history and folds each picked Narcissus output at its declared boundary', () => {
    const elemental = selectNarcissus(createCompleteFGProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    expect(
      reachedFrontier(evaluatedG(elemental).rewards).every(
        (branch) =>
          !branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.settlement?.entry.entryKey === 'elementalBoost1',
          ),
      ),
    ).toBe(true);
    const pickedElemental = replacePickupActions(elemental, pickupSite(elemental), [
      'elementalBoost2',
      'elementalBoost1',
    ]);
    expect(
      evaluatedG(pickedElemental).rewards.frontier?.state.traitHistory?.events.filter(
        (event) => event.kind === 'elementContribution',
      ),
    ).toEqual([
      expect.objectContaining({ owner: expect.objectContaining({ entryKey: 'elementalBoost2' }) }),
      expect.objectContaining({ owner: expect.objectContaining({ entryKey: 'elementalBoost1' }) }),
    ]);

    let pom = selectNarcissus(createCompleteFGProject(), [
      'NarcissusA',
      'NarcissusD',
      'NarcissusE',
    ]);
    pom = authorLegalTraitOffers(pom);
    pom = replacePickupActions(pom, pickupSite(pom), ['pom']);
    const pomEntry = pickupEntry(pom, 'pom');
    const pomResolution = createLevelResolutionAddress(pomEntry, 'self');
    const pomAssembly = simulateProjectAssembly(catalog, pom);
    const pomTarget = levelResolutionCandidateForProjectEvaluationAssembly(
      pomAssembly,
      pomResolution,
    )?.surface.eligibleTargetTraitKeys[0];
    if (pomTarget === undefined) throw new Error('Narcissus Pom has no eligible target');
    pom = applyProjectCommand(pom, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: pomResolution,
      value: { kind: 'random', targetTraitKey: pomTarget },
    });
    const pomMutation = evaluatedG(pom).rewards.frontier?.state.traitHistory?.events.find(
      (event): event is Extract<TraitHistoryEvent, { readonly kind: 'levelMutation' }> =>
        event.kind === 'levelMutation' &&
        event.owner.kind === 'levelResolution' &&
        event.owner.owner.kind === 'acquisitionEntry' &&
        event.owner.owner.entryKey === 'pom' &&
        event.targetTraitKey === pomTarget,
    );
    if (pomMutation === undefined)
      throw new Error('Narcissus Pom did not mutate its selected target');
    expect(pomMutation.newLevel).toBe(pomMutation.oldLevel + 1);

    let blindBox = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    blindBox = replacePickupActions(blindBox, pickupSite(blindBox), ['mysteryBoon']);
    blindBox = authorLegalTraitOffers(blindBox);
    const blindBoxEntry = pickupEntry(blindBox, 'mysteryBoon');
    blindBox = applyProjectCommand(blindBox, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: blindBoxEntry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    blindBox = authorLegalTraitOffers(blindBox);
    const blindBoxEvaluation = evaluatedG(blindBox);
    expect(
      reachedFrontier(blindBoxEvaluation.rewards)
        .flatMap((branch) => branch.events)
        .find(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) === semanticAddressKey(blindBoxEntry),
        ),
    ).toEqual(
      expect.objectContaining({
        source: expect.objectContaining({
          offer: {
            rewardType: 'BlindBoxLoot',
            payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
          },
          producerLifecycleKey: 'NarcissusPickup',
        }),
      }),
    );
    const blindBoxHistory = blindBoxEvaluation.rewards.frontier?.state.traitHistory;
    const blindBoxOffer = blindBoxHistory?.events.find(
      (event): event is Extract<TraitHistoryEvent, { readonly kind: 'traitOffer' }> =>
        event.kind === 'traitOffer' &&
        event.owner.kind === 'acquisitionEntry' &&
        event.owner.entryKey === 'mysteryBoon',
    );
    if (blindBoxOffer === undefined)
      throw new Error('picked BlindBox did not equip its fresh offer');
    expect(blindBoxOffer.giverKey).toBe('Hestia');
    const selectedBlindBoxTrait =
      blindBoxOffer.options[
        blindBoxOffer.selectedOptionKey === 'option1'
          ? 0
          : blindBoxOffer.selectedOptionKey === 'option2'
            ? 1
            : 2
      ]!.traitKey;
    expect(blindBoxHistory?.equippedTraits[selectedBlindBoxTrait]).toBeDefined();

    let lastStand = selectNarcissus(createCompleteFGProject(), [
      'NarcissusH',
      'NarcissusB',
      'NarcissusC',
    ]);
    lastStand = replacePickupActions(lastStand, pickupSite(lastStand), ['lastStand']);
    expect(evaluatedG(lastStand).rewards.frontier?.events).toContainEqual(
      expect.objectContaining({
        kind: 'concreteAcquisition',
        acquisition: expect.objectContaining({
          acquisition: expect.objectContaining({ gameName: 'LastStandDrop' }),
        }),
        settlement: expect.objectContaining({
          entry: expect.objectContaining({ entryKey: 'lastStand' }),
        }),
      }),
    );
  });

  it('publishes a picked pickup payload frontier at its exact entry history', () => {
    let project = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const entry = pickupEntry(project, 'mysteryBoon');
    project = replacePickupActions(project, entry.site, ['mysteryBoon']);
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const replacement = {
      rewardType: 'BlindBoxLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'HestiaUpgrade' as const },
    };
    expect(
      session.evaluate({ kind: 'acquisitionEntryOffer', entry, value: replacement }),
    ).toMatchObject({
      kind: 'acquisitionEntryOffer',
      result: { supported: true },
    });
    let applied = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: replacement,
    });
    applied = applyProjectCommand(applied, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    expect(
      narcissusOccurrence(applied).acquisitionSites?.[entry.site.pointKey]?.pickupEntries
        ?.mysteryBoon?.traitOffersByAcquisitionRole.hiddenSource?.giverKey,
    ).toBe('Hestia');
    const appliedG = simulateProject(catalog, applied).route?.biomes.find(
      (biome) => biome.biomeKey === 'G',
    );
    if (appliedG?.authoring !== 'complete') throw new Error('applied Narcissus G did not simulate');
    // Completing the exact entry-owned reward and fresh trait offer retains
    // the reachable acquisition product.
    expect(appliedG.rewards.frontier).toBeDefined();
    expect(
      session.evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ kind: 'acquisitionEntryOffer', result: { supported: false } });
  });

  it('resolves Pom targets only while the pickup participates and retains stale targets for repair', () => {
    let project = selectNarcissus(
      selectNarcissus(createCompleteFGProject(), ['NarcissusF', 'NarcissusB', 'NarcissusC']),
      ['NarcissusA', 'NarcissusB', 'NarcissusC'],
    );
    const entry = pickupEntry(project, 'pom');
    const resolution = createLevelResolutionAddress(entry, 'self');
    const optional = simulateProjectAssembly(catalog, project);
    expect(
      optional.evaluation.route.biomes.find((biome) => biome.biomeKey === 'G')?.findings,
    ).toEqual([]);
    expect(
      levelResolutionCandidateForProjectEvaluationAssembly(optional, resolution),
    ).toBeUndefined();

    project = replacePickupActions(project, entry.site, ['pom']);
    const picked = simulateProjectAssembly(catalog, project);
    expect(picked.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'missingPomTarget', origin: resolution }),
    );
    const candidate = levelResolutionCandidateForProjectEvaluationAssembly(picked, resolution);
    const target = candidate?.surface.eligibleTargetTraitKeys[0];
    if (target === undefined) throw new Error('Narcissus Pom has no repair target');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: resolution,
      value: { kind: 'random', targetTraitKey: target },
    });
    expect(evaluatedG(project).findings).toEqual([]);
    const retained = narcissusOccurrence(project).acquisitionSites;
    project = replacePickupActions(project, entry.site, []);
    expect(narcissusOccurrence(project).acquisitionSites).toEqual(retained);
    const removed = simulateProjectAssembly(catalog, project);
    expect(
      removed.evaluation.route.biomes.find((biome) => biome.biomeKey === 'G')?.findings,
    ).toEqual([]);
    expect(
      levelResolutionCandidateForProjectEvaluationAssembly(removed, resolution),
    ).toBeUndefined();

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: resolution,
      value: { kind: 'random', targetTraitKey: 'NarcissusA' },
    });
    expect(evaluatedG(project).findings).toEqual([]);
    project = replacePickupActions(project, entry.site, ['pom']);
    const stale = simulateProjectAssembly(catalog, project);
    expect(stale.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'pomTargetUnavailable', origin: resolution }),
    );
    expect(
      levelResolutionCandidateForProjectEvaluationAssembly(stale, resolution)?.surface
        .eligibleTargetTraitKeys,
    ).toContain(target);
  });

  it('resolves an optional Mystery Boon only while its pickup participates', () => {
    let project = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const entry = pickupEntry(project, 'mysteryBoon');
    expect(occurrence.roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: entry.site.pointKey,
      entryKey: 'mysteryBoon',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'G');
    expect(evaluated?.findings).toEqual([]);
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    expect(
      session.evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      }),
    ).toMatchObject({ kind: 'unavailable' });
    expect(
      evaluated !== undefined &&
        'rewards' in evaluated &&
        reachedFrontier(evaluated.rewards).some((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.settlement?.entry.entryKey === 'mysteryBoon',
          ),
        ),
    ).toBe(false);

    project = replacePickupActions(project, entry.site, ['mysteryBoon']);
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({ code: 'rewardMissing', origin: entry }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({
        code: 'traitOfferMissing',
        origin: createTraitOfferAddress(entry, 'hiddenSource'),
      }),
    );
    const authored = narcissusOccurrence(project).acquisitionSites;
    project = replacePickupActions(project, entry.site, []);
    expect(narcissusOccurrence(project).acquisitionSites).toEqual(authored);
    expect(evaluatedG(project).findings).toEqual([]);
    project = replacePickupActions(project, entry.site, ['mysteryBoon']);
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({
        code: 'traitOfferMissing',
        origin: createTraitOfferAddress(entry, 'hiddenSource'),
      }),
    );
  });
});
