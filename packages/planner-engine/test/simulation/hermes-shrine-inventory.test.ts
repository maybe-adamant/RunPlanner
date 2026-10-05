import { ordinaryPositionFor } from '../support/route-position';
import { describe, expect, it, vi } from 'vitest';
import * as rewardChronology from '../../src/simulation/rewards/biome/chronology';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  assembleRoomActionDomain,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
  createTraitOfferAddress,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
  roomActionKey,
  semanticAddressKey,
  createDefaultAuthoredHexTree,
  resolveRoutePosition,
} from '@run-planner/engine/authored-project';
import {
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  createPreparedProjectCandidateSession,
  assembleRoomActionRoster,
  hermesShrineCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import type { RewardHistoryState, RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import {
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
  createSurfaceOSameRoomHermesDeliveriesCheckpoint,
  loadSurfaceNOProject,
  loadSurfaceNOPProject,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  surfaceShrineTravelDealProject,
} from '@run-planner/test-fixtures/surface';
import { loadSurfaceNOHermesShrineDeliveryCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadDreamMixedHandoffCheckpoint } from '@run-planner/test-fixtures/checkpoints/dream';
import {
  dreamSingleQOccurrenceIds,
  dreamSingleQProject,
  dreamSingleQShrineDeliveryProject,
} from '@run-planner/test-fixtures/dream';
import {
  authorLegalTraitOffers,
  purchaseTestHermesShrineOffer,
  supportedTraitOffer,
  testHermesShrinePurchaseAction,
} from '@run-planner/test-fixtures/shared';
import { loadSurfacePSteadyGrowthShrineFrontierCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  assessHermesShrineInventory,
  assessHermesShrinePlacement,
  assessHermesShrineTravelDealRefill,
  priorTwoSurfaceShopPresence,
} from '../../src/simulation/commerce/hermes-shrine';
import { createHermesShrineCandidateArtifacts } from '../../src/simulation/commerce/hermes-shrine';
import { prefixAuthoredRooms } from '../../src/simulation/candidates/evaluated-biome';
import { composeBiomeHistoryPrefix } from '../../src/simulation/history';
import { foldBiomeHistoryPrefixEvents } from '../../src/simulation/history/fold';
import { materializeBiomePrefix } from '../../src/simulation/materialization';
import { materializeAuthoredRoom } from '../../src/simulation/materialization/rooms/assemble';
import { evaluateBiomeRewards } from '../../src/simulation/rewards/biome';
import { applyRoomEnteredTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/room-entered';
import { reachSimulationHistory } from '../../src/simulation/state/transitions';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../src/simulation/traits';
import { installHexTree, settlePathScreen } from '../../src/simulation/hex-progress';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition/site-settlement';
import {
  createTestArcanaFearState,
  initializeTestRewardBranches,
  initializeTestRewardBranchesForRoute as initializeRewardBranches,
} from '../support/arcana-fear';

function branchesWithTravelDeal() {
  const traits = foldTraitHistoryEvents(catalog, [
    {
      kind: 'traitOffer' as const,
      owner: { kind: 'project' as const },
      acquisitionRole: 'fixtureSeed',
      sequence: 1,
      giverKey: 'Hermes',
      options: Object.freeze([{ traitKey: 'RestockBoon', rarity: 'Epic' as const }]),
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'fixture:N-before-O',
    },
    {
      kind: 'traitOffer' as const,
      owner: { kind: 'project' as const },
      acquisitionRole: 'fixtureAres',
      sequence: 2,
      giverKey: 'Ares',
      options: Object.freeze([{ traitKey: 'AresExCastBoon', rarity: 'Common' as const }]),
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'fixture:N-before-O',
    },
    {
      kind: 'traitOffer' as const,
      owner: { kind: 'project' as const },
      acquisitionRole: 'fixtureHephaestus',
      sequence: 3,
      giverKey: 'Hephaestus',
      options: Object.freeze([{ traitKey: 'AntiArmorBoon', rarity: 'Common' as const }]),
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'fixture:N-before-O',
    },
  ]);
  return initializeTestRewardBranches().map((branch) =>
    Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        rewardHistory: attachTraitHistory(
          Object.freeze({
            ...branch.state.rewardHistory,
            lootTypeHistory: Object.freeze({ AresUpgrade: 1, HephaestusUpgrade: 1 }),
          }),
          traits,
        ),
        traitHistory: traits,
      }),
    }),
  );
}

function rewardFacts(history: RewardHistoryState): RewardKernelFacts {
  return {
    requirements: {
      routeKey: 'Underworld',
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 2,
        encounterDepth: 7,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: {
        biomeUseRecord: history.biomeUseRecord,
        lootTypeHistory: history.lootTypeHistory,
        roomsEntered: {},
        useRecord: history.useRecord,
      },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: { hubRewardLookup: new Set<string>() },
      offeredRewardTypes: new Set<string>(),
      runDepthCache: 8,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 3,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

const complete = (
  overrides: Partial<Record<'first' | 'secondLeft' | 'secondRight', string | null>> = {},
) =>
  ({
    offerBySlot: {
      first:
        overrides.first === undefined
          ? { rewardType: 'HealBigDrop' }
          : overrides.first === null
            ? null
            : { rewardType: overrides.first },
      secondLeft:
        overrides.secondLeft === undefined
          ? { rewardType: 'SpellDrop' }
          : overrides.secondLeft === null
            ? null
            : { rewardType: overrides.secondLeft },
      secondRight:
        overrides.secondRight === undefined
          ? { rewardType: 'TalentDrop' }
          : overrides.secondRight === null
            ? null
            : { rewardType: overrides.secondRight },
    },
  }) as never;

function outgoingSeedBranches(rewardType: 'HermesUpgrade' | 'SpellDrop' | 'TalentDrop') {
  return initializeTestRewardBranches().map((branch) =>
    Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        rewardHistory: Object.freeze({
          ...branch.state.rewardHistory,
          useRecord: Object.freeze({
            ...branch.state.rewardHistory.useRecord,
            ...(rewardType === 'TalentDrop' ? { SpellDrop: 1 } : {}),
          }),
        }),
      }),
    }),
  );
}

function evaluateShrineOutgoingPrefix(
  project: ReturnType<typeof loadSurfaceNOProject>,
  rewardType: 'HermesUpgrade' | 'SpellDrop' | 'TalentDrop',
  outgoingOccurrenceId = oOccurrenceIds.combat07,
) {
  const route = project.route;
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (route === undefined || plan?.topology === null || plan === undefined)
    throw new Error('fixture lost Surface O topology');
  const cutoff = plan.topology.decisions.findIndex(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === outgoingOccurrenceId,
  );
  if (cutoff < 0) throw new Error(`fixture lost ${outgoingOccurrenceId} outgoing decision`);
  const prefixPlan = Object.freeze({
    ...plan,
    topology: Object.freeze({
      ...plan.topology,
      decisions: Object.freeze(plan.topology.decisions.slice(0, cutoff + 1)),
    }),
  });
  const snapshot = materializeBiomePrefix(
    catalog,
    oBiome,
    ordinaryPositionFor(catalog, oBiome),
    prefixPlan,
    route.loadout,
  );
  const history =
    snapshot === null
      ? undefined
      : composeBiomeHistoryPrefix(catalog, snapshot, ordinaryPositionFor(catalog, snapshot));
  if (snapshot?.entryRoom === undefined || history === null || history === undefined)
    throw new Error(`fixture lost ${outgoingOccurrenceId} outgoing prefix`);
  const rewards = evaluateBiomeRewards(
    catalog,
    snapshot as typeof snapshot & { readonly entryRoom: NonNullable<typeof snapshot.entryRoom> },
    history,
    ordinaryPositionFor(
      catalog,
      snapshot as typeof snapshot & { readonly entryRoom: NonNullable<typeof snapshot.entryRoom> },
    ),
    route.loadout,
    outgoingSeedBranches(rewardType),
  );
  const runState = rewards.runStateSnapshots.find(
    (candidate) =>
      candidate.owner.kind === 'exitDecision' &&
      candidate.owner.source.kind === 'occurrence' &&
      candidate.owner.source.occurrenceId === outgoingOccurrenceId,
  );
  if (runState === undefined)
    throw new Error(`fixture lost ${outgoingOccurrenceId} outgoing Run State`);
  return Object.freeze({ snapshot, rewards, runState });
}

function bagCounts(runState: ReturnType<typeof evaluateShrineOutgoingPrefix>['runState']) {
  return runState.bags.map((bag) => ({
    storeKey: bag.storeKey,
    remaining: bag.remaining,
    entries: bag.entries.map((entry) => ({
      rewardType: entry.rewardType,
      remaining: entry.remaining,
      conditions: entry.conditions,
    })),
  }));
}

function outgoingEligibility(
  runState: ReturnType<typeof evaluateShrineOutgoingPrefix>['runState'],
  rewardType: 'HermesUpgrade' | 'SpellDrop' | 'TalentDrop',
) {
  return runState.bags
    .flatMap((bag) => bag.entries)
    .find((entry) => entry.rewardType === rewardType)?.eligibility;
}

describe('Hermes Shrine entry inventory gate', () => {
  it('admits one first-group and two distinct second-group identities', () => {
    expect(assessHermesShrineInventory(catalog, complete())).toEqual([]);
  });

  it('retains missing, wrong-group, and duplicate second-group state as invalid rather than visible', () => {
    expect(assessHermesShrineInventory(catalog, complete({ first: null }))).toEqual([
      { kind: 'missing', slotKey: 'first' },
    ]);
    expect(assessHermesShrineInventory(catalog, complete({ first: 'SpellDrop' }))).toEqual([
      { kind: 'wrongGroup', slotKey: 'first' },
    ]);
    expect(assessHermesShrineInventory(catalog, complete({ secondRight: 'SpellDrop' }))).toEqual([
      { kind: 'duplicateSecondGroup' },
    ]);
  });

  it('publishes an absent ordinary host as an addable presence candidate', () => {
    const owner = createOccurrenceAddress(
      createBiomeAddress('Surface', 'O'),
      createOccurrenceId('ordinary-shrine-host'),
    );
    const placement = assessHermesShrinePlacement(
      catalog.rooms.byKey.O_Combat02,
      [false, false],
      3,
    );
    const candidate = createHermesShrineCandidateArtifacts(
      new Map([[semanticAddressKey(owner), Object.freeze([Object.freeze({ placement })])]]),
    ).at(owner);
    expect(candidate).toMatchObject({ placementEligible: true, required: false, present: false });
  });

  it('keeps a restored occurrence as its own physical spacing position', () => {
    const origin = createOccurrenceAddress(
      createBiomeAddress('Surface', 'O'),
      createOccurrenceId('revisited-host'),
    );
    expect(
      priorTwoSurfaceShopPresence([
        { origin, surfaceShopPresent: true },
        { origin, surfaceShopPresent: false },
        { origin, surfaceShopPresent: true },
        { origin, surfaceShopPresent: false },
      ]),
    ).toEqual([false, true]);
    // The address is deliberately reused by the two visits; position, not
    // occurrence identity or game name, owns the Shrine window.
    expect(origin.occurrenceId).toBe('revisited-host');
  });

  it('uses the prior-two physical window and lets forced Postboss hosts bypass it', () => {
    const ordinary = catalog.rooms.byKey.O_Combat02;
    expect(assessHermesShrinePlacement(ordinary, [true], 3).eligible).toBe(false);
    expect(assessHermesShrinePlacement(ordinary, [true, false], 3).eligible).toBe(false);
    expect(assessHermesShrinePlacement(ordinary, [false, false], 2).eligible).toBe(false);
    expect(assessHermesShrinePlacement(ordinary, [false, false], 3).eligible).toBe(true);
    expect(
      assessHermesShrinePlacement(catalog.rooms.byKey.O_PostBoss01, [true, true], 0),
    ).toMatchObject({
      forced: true,
      eligible: true,
    });
  });

  it('publishes an O ordinary host through the supported project candidate API', () => {
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const absent = simulateProjectAssembly(catalog, loadSurfaceNOProject());
    expect(hermesShrineCandidateForProjectEvaluationAssembly(absent, host)).toMatchObject({
      placementEligible: true,
      required: false,
      present: false,
    });
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'ShopHermesUpgrade'],
      ['secondRight', 'TalentDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    expect(
      hermesShrineCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        host,
      ),
    ).toMatchObject({
      placementEligible: true,
      present: true,
      candidateRewardTypesBySlot: {
        first: expect.arrayContaining(['HealBigDrop']),
      },
    });
  });

  it('uses an unpurchased visible Shrine inventory for room eligibility without consuming a bag', () => {
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const oResult = (project: ReturnType<typeof loadSurfaceNOProject>) => {
      const biome = simulateProject(catalog, project).route?.biomes.find(
        (candidate) => candidate.biomeKey === 'O',
      );
      if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
        throw new Error('fixture lost valid O evaluation');
      }
      return biome;
    };
    const baseline = oResult(loadSurfaceNOProject());
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    const withVisibleInventory = oResult(project);
    expect(withVisibleInventory.rewards.branches.map((branch) => branch.state.bags)).toEqual(
      baseline.rewards.branches.map((branch) => branch.state.bags),
    );
    const hostKey = semanticAddressKey(host);
    expect(
      withVisibleInventory.rewards.branches
        .flatMap((branch) => branch.events)
        .some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.site.owner) === hostKey,
        ),
    ).toBe(false);
  });

  it.each([
    ['ShopHermesUpgrade', 'HermesUpgrade'],
    ['SpellDrop', 'SpellDrop'],
    ['TalentDrop', 'TalentDrop'],
  ] as const)(
    'suppresses outgoing %s only while that complete unpurchased Shrine inventory is visible',
    (visibleRewardType, outgoingRewardType) => {
      const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
      const baseline = evaluateShrineOutgoingPrefix(loadSurfaceNOProject(), outgoingRewardType);
      expect(outgoingEligibility(baseline.runState, outgoingRewardType)).toBe('eligible');
      let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
        kind: 'SetHermesShrinePresence',
        occurrence: host,
        present: true,
      });
      for (const [slotKey, rewardType] of [
        ['first', 'HealBigDrop'],
        ['secondLeft', visibleRewardType],
        ['secondRight', 'MaxManaDrop'],
      ] as const) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceHermesShrineOffer',
          occurrence: host,
          slotKey,
          value: { rewardType },
        });
      }
      const visible = evaluateShrineOutgoingPrefix(project, outgoingRewardType);
      expect(outgoingEligibility(visible.runState, outgoingRewardType)).toBe('ineligible');
      expect(bagCounts(visible.runState)).toEqual(bagCounts(baseline.runState));
      expect(
        visible.rewards.branches
          .flatMap((branch) => branch.events)
          .some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.settlement !== undefined &&
              semanticAddressKey(event.settlement.site.owner) === semanticAddressKey(host),
          ),
      ).toBe(false);
    },
  );

  it.each([
    ['missing', [['secondLeft', 'SpellDrop']] as const, 'SpellDrop'],
    [
      'wrong group',
      [
        ['first', 'ShopHermesUpgrade'],
        ['secondLeft', 'SpellDrop'],
        ['secondRight', 'MaxManaDrop'],
      ] as const,
      'HermesUpgrade',
    ],
    [
      'duplicate',
      [
        ['first', 'HealBigDrop'],
        ['secondLeft', 'SpellDrop'],
        ['secondRight', 'SpellDrop'],
      ] as const,
      'SpellDrop',
    ],
  ] as const)(
    'keeps %s retained-invalid Shrine inventory out of outgoing store names',
    (_label, offers, outgoingRewardType) => {
      const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
      let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
        kind: 'SetHermesShrinePresence',
        occurrence: host,
        present: true,
      });
      for (const [slotKey, rewardType] of offers) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceHermesShrineOffer',
          occurrence: host,
          slotKey,
          value: { rewardType },
        });
      }
      const retained = evaluateShrineOutgoingPrefix(project, outgoingRewardType);
      expect(outgoingEligibility(retained.runState, outgoingRewardType)).toBe('eligible');
    },
  );
});

// Observe the exact reward walk before progressive coverage bounds its public history.
function observeDeliveryStop(
  project: ReturnType<typeof loadSurfaceNOPQProject>,
  kind: 'roomEntered' | 'encounterEndEffectsApplied',
  owner: ReturnType<typeof createOccurrenceAddress>,
) {
  const observer = vi.spyOn(rewardChronology, 'evaluateBiomeRewardChronology');
  try {
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    let observed = 0;
    observer.mock.calls.forEach(([, , history], index) => {
      const result = observer.mock.results[index];
      if (result?.type !== 'return') return;
      const simulation = result.value.simulation;
      if (
        !simulation.findings.some(
          (finding) =>
            finding.code === 'hermesShrineDeliveryPlacementRequired' &&
            finding.origin.kind === 'acquisitionEntry' &&
            semanticAddressKey(finding.origin.site.owner) === semanticAddressKey(owner),
        )
      )
        return;
      const stop = history.events.find(
        (event) =>
          event.kind === kind && semanticAddressKey(event.origin) === semanticAddressKey(owner),
      );
      if (stop === undefined) return;
      expect(simulation.branches.length).toBeGreaterThan(0);
      for (const branch of simulation.branches)
        expect(branch.state.reached.historyView).toBe(history.viewsBySequence[stop.sequence]);
      observed += 1;
    });
    expect(observed).toBeGreaterThan(0);
    return evaluation;
  } finally {
    observer.mockRestore();
  }
}

describe('Hermes Shrine delayed deliveries', () => {
  function dreamPrebossEntry(itineraryBiomeKeys: readonly string[], biomeKey: 'I' | 'Q') {
    const biome = createBiomeAddress('Dream', biomeKey);
    const prebossId = createOccurrenceId(`dream-hermes-${biomeKey.toLowerCase()}-preboss`);
    let project = createProjectDocument(catalog, {
      projectId: `dream-hermes-${itineraryBiomeKeys.join('-').toLowerCase()}`,
      routeKey: 'Dream',
      itineraryBiomeKeys,
      configuredBiomeCount: itineraryBiomeKeys.length,
    });
    const startId = project.route.biomes.find((plan) => plan.biomeKey === biomeKey)!.topology!
      .startOccurrenceId;
    const start = { kind: 'occurrence' as const, occurrenceId: startId };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(biome, start),
    });
    if (biomeKey === 'I') {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, start, 'exit1'),
        occurrenceId: prebossId,
        gameName: 'I_PreBoss01',
      });
    } else {
      const combatId = createOccurrenceId('dream-hermes-q-combat');
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, start, 'exit1'),
        occurrenceId: combatId,
        gameName: 'Q_Combat10',
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTakeoverBatch',
        decision: createExitDecisionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: combatId,
        }),
        gameName: 'Q_PreBoss01',
        targetOccurrenceIds: { exit1: prebossId },
      });
    }
    const plan = project.route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
    const occurrence = plan?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === prebossId,
    );
    if (
      project.route === undefined ||
      plan === undefined ||
      plan.topology === null ||
      occurrence === undefined
    )
      throw new Error('Dream Preboss contact lost its authored occurrence');
    const routePosition = resolveRoutePosition(catalog, project.route, biomeKey);
    const declaration = catalog.rooms.byKey[occurrence.gameName];
    if (declaration === undefined) throw new Error('Dream Preboss declaration is missing');
    const room = materializeAuthoredRoom({
      catalog,
      biome,
      routePosition,
      room: declaration,
      occurrence,
      role: 'prebossShop',
      entered: true,
      lifecycleProfileKey: 'PrebossShopRoom',
      loadout: project.route.loadout,
    });
    // This is a room-entry transition witness, not a complete-route fixture.
    // Fold the exact Dream occurrence's entry contact rather than borrowing
    // history from a different route or requiring unrelated opening authorship.
    const entryEvent = {
      kind: 'roomEntered' as const,
      origin: room.origin,
      sequence: 4,
      operationIndex: 2,
    };
    const history = foldBiomeHistoryPrefixEvents([
      {
        kind: 'biomeStarted',
        origin: biome,
        sequence: 1,
        counters: {
          biomeDepthCache: 0,
          biomeEncounterDepth: 0,
          routeEncounterDepth: 0,
          roomHistoryOrdinal: 0,
        },
      },
      {
        kind: 'roomCreated',
        origin: room.origin,
        sequence: 2,
        gameName: room.gameName,
        encounterEnvelopeKey: room.encounterEnvelopeKey,
        source: 'layoutCompletion',
        picked: true,
      },
      { kind: 'roomPrepared', origin: room.origin, sequence: 3, operationIndex: 0 },
      entryEvent,
    ]);
    const view = history.rooms[0];
    if (view?.entry === undefined) throw new Error('Dream Preboss entry history is missing');
    return {
      room,
      routePosition,
      view,
      entryEvent,
      source: createOccurrenceAddress(biome, startId),
    };
  }

  it.each([
    ['fourth-biome non-Q I', ['Q', 'F', 'N', 'I'] as const, 'I', true],
    ['fourth-biome Q', ['F', 'G', 'H', 'Q'] as const, 'Q', true],
    ['first-biome Q', ['Q', 'I'] as const, 'Q', false],
    ['third and last I', ['N', 'O', 'I'] as const, 'I', false],
  ] as const)(
    '%s flushes pending Shrine deliveries only at the Preboss of the fourth entered biome',
    (_label, itinerary, biomeKey, expectedDelivery) => {
      const { room, routePosition, view, source, entryEvent } = dreamPrebossEntry(
        itinerary,
        biomeKey,
      );
      const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
      const branches = initializeTestRewardBranches().map((branch) =>
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            pendingHermesShrineDeliveries: Object.freeze({
              [entryKey]: Object.freeze({
                entryKey,
                source,
                generationKey: 'initial:first' as const,
                rewardType: 'HealBigDrop',
                rushed: false,
                remainingUses: 8,
              }),
            }),
          }),
        }),
      );
      const transition = applyRoomEnteredTransition(
        catalog,
        entryEvent,
        room,
        view,
        new Set(),
        new Set(),
        branches,
        Object.freeze({
          kind: 'history' as const,
          sequence: entryEvent.sequence,
          boundary: 'at' as const,
        }),
        routePosition,
        { hermesShrine: true, stygianWell: true },
      );
      const delivery = transition.derivedAcquisitionEntryFrontiers.find(
        (frontier) => frontier.kind === 'hermesShrineDelivery',
      );
      expect(delivery === undefined).toBe(!expectedDelivery);
      if (!expectedDelivery || delivery === undefined) {
        expect(transition.hermesShrineDeliveryPlacementRequired).toBe(false);
        expect(transition.findings).not.toContainEqual(
          expect.objectContaining({
            finding: expect.objectContaining({ code: 'hermesShrineDeliveryPlacementRequired' }),
          }),
        );
        expect(transition.branches[0]?.state.pendingHermesShrineDeliveries[entryKey]).toMatchObject(
          {
            remainingUses: 8,
          },
        );
        expect(
          transition.branches[0]?.state.pendingHermesShrineDeliveries[entryKey],
        ).not.toHaveProperty('due');
        return;
      }
      expect(transition.hermesShrineDeliveryPlacementRequired).toBe(true);
      expect(delivery).toMatchObject({
        address: {
          site: { owner: room.origin },
          entryKey,
        },
        fixedReward: { offer: { rewardType: 'HealBigDrop' } },
      });
      expect(transition.branches[0]?.state.pendingHermesShrineDeliveries[entryKey]).toMatchObject({
        remainingUses: 0,
        due: { host: room.origin, cause: 'flush', historySequence: entryEvent.sequence },
      });
    },
  );

  it('keeps a delivery pending past the end of a short itinerary without a finding', () => {
    expect(simulateProjectAssembly(catalog, dreamSingleQProject()).evaluation.status).toBe('valid');
    const q = createBiomeAddress('Dream', 'Q');
    const source = createOccurrenceAddress(q, dreamSingleQOccurrenceIds.shrineSource);
    const assembly = simulateProjectAssembly(catalog, dreamSingleQShrineDeliveryProject());
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    // A delay-8 purchase outlives the single-biome route: the purchase is
    // valid and the game owns the item's arrival after the last planned room.
    expect(assembly.evaluation.status).toBe('valid');
    const biome = assembly.evaluation.route.biomes[0];
    if (biome?.authoring !== 'complete' || !('rewards' in biome))
      throw new Error('Dream Q did not publish rewards');
    // The first-biome Preboss does not flush: the delivery is still counting down.
    expect(biome.rewards.hermesShrineDeliveries).toEqual([
      expect.objectContaining({ entryKey, deliveryKind: 'pending' }),
    ]);
    expect(biome.rewards.findings.map((finding) => finding.code)).not.toContain(
      'hermesShrineDeliveryPlacementRequired',
    );
    expect(assembly.evaluation.findings.map((finding) => finding.code)).not.toContain(
      'rewardSourceUnavailable',
    );
    // The Boss exit leaves the obligation pending in every branch state.
    expect(biome.rewards.branches.length).toBeGreaterThan(0);
    for (const branch of biome.rewards.branches) {
      const pending = branch.state.pendingHermesShrineDeliveries[entryKey];
      expect(pending).toMatchObject({ entryKey });
      expect(pending).not.toHaveProperty('due');
    }
  });

  it('clamps an unresolved fixed Boss delivery after Preboss and before Postboss', () => {
    const evaluation = simulateProjectAssembly(
      catalog,
      createSurfaceNUnresolvedBossHermesDeliveryCheckpoint(),
    ).evaluation.route?.biomes[0];
    if (
      evaluation?.authoring !== 'complete' ||
      evaluation.validity !== 'invalid' ||
      !('assessmentPrefix' in evaluation)
    ) {
      throw new Error('fixture did not stop at the unresolved N Boss delivery');
    }
    expect(evaluation.assessmentPrefix?.decisions.at(-1)).toMatchObject({
      kind: 'batch',
      selectedExitKey: 'preboss',
      targets: [
        expect.objectContaining({ room: expect.objectContaining({ gameName: 'N_PreBoss01' }) }),
      ],
    });
    expect(
      evaluation.assessmentPrefix?.fixedRoomLinks?.map((link) => link.target.gameName),
    ).toEqual(['N_Boss01']);
    expect(
      evaluation.materializedPrefix.fixedRoomLinks?.map((link) => link.target.gameName),
    ).toEqual(['N_Boss01', 'N_PostBoss01']);
  });

  it('preserves a reached automatic outcome while an unresolved Shrine is added and removed', () => {
    const project = loadSurfacePSteadyGrowthShrineFrontierCheckpoint();
    const finding = simulateProjectAssembly(catalog, project).evaluation.findings.find(
      (candidate) =>
        candidate.code === 'steadyGrowthOutcomeMissing' &&
        candidate.origin.kind === 'steadyGrowthOutcome' &&
        candidate.origin.biomeKey === 'P',
    );
    if (finding?.origin.kind !== 'steadyGrowthOutcome')
      throw new Error('checkpoint lost the reached P outcome');
    const host = finding.origin.owner;
    const outcomeKey = semanticAddressKey(finding.origin);
    const assertReachedOutcome = (candidate: typeof project) => {
      const biome = simulateProjectAssembly(catalog, candidate).evaluation.route.biomes.find(
        (item) => item.biomeKey === 'P',
      );
      if (biome === undefined || !('rewards' in biome))
        throw new Error('checkpoint lost its P reward evaluation');
      expect(
        biome.rewards.steadyGrowthOutcomes.map((outcome) => semanticAddressKey(outcome.address)),
      ).toContain(outcomeKey);
      expect(
        biome.rewards.findings.some(
          (finding) =>
            finding.code === 'steadyGrowthOutcomeMissing' &&
            semanticAddressKey(finding.origin) === outcomeKey,
        ),
      ).toBe(true);
    };

    assertReachedOutcome(project);
    const added = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    assertReachedOutcome(added);
    const removed = applyProjectCommand(added, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: false,
    });
    assertReachedOutcome(removed);
  });

  it('interleaves a due P delivery with its producer-owned incoming reward in either order', () => {
    let project = loadSurfacePSteadyGrowthShrineFrontierCheckpoint();
    const occurrenceId = createOccurrenceId('c34604d0-c4e3-4c26-8539-54a82158716f');
    const host = createOccurrenceAddress(pBiome, occurrenceId);
    const finding = simulateProjectAssembly(catalog, project).evaluation.findings.find(
      (candidate) =>
        candidate.code === 'steadyGrowthOutcomeMissing' &&
        candidate.origin.kind === 'steadyGrowthOutcome' &&
        candidate.origin.biomeKey === 'P',
    );
    if (finding?.origin.kind !== 'steadyGrowthOutcome')
      throw new Error('checkpoint lost the reached P outcome');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: finding.origin,
      targetTraitKey: 'HeraCastBoon',
    });
    const awaitingDelivery = observeDeliveryStop(project, 'encounterEndEffectsApplied', host);
    const deliveryFinding = awaitingDelivery.findings.find(
      (finding) =>
        finding.code === 'hermesShrineDeliveryPlacementRequired' &&
        finding.origin.kind === 'acquisitionEntry' &&
        finding.origin.site.owner.kind === 'occurrence' &&
        finding.origin.site.owner.occurrenceId === occurrenceId,
    );
    if (deliveryFinding?.origin.kind !== 'acquisitionEntry') {
      throw new Error('checkpoint lost its due P Shrine delivery');
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry: deliveryFinding.origin,
      encounterPhaseKey: 'Combat',
    });
    let occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    const deliveryIndex = occurrence?.roomActions.order.findIndex(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    );
    const incomingIndex = occurrence?.roomActions.order.findIndex(
      (reference) => reference.kind === 'interactIncomingReward',
    );
    expect(incomingIndex).toBe(0);
    expect(deliveryIndex).toBe(1);
    expect(() => simulateProjectAssembly(catalog, project)).not.toThrow();

    const delivery = occurrence?.roomActions.order[deliveryIndex ?? -1];
    if (delivery === undefined) throw new Error('placed Shrine delivery is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(pBiome, occurrenceId, roomActionKey(delivery)),
      toIndex: 0,
    });
    occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    expect(occurrence?.roomActions.order.map((reference) => reference.kind)).toEqual([
      'interactAcquisitionEntry',
      'interactIncomingReward',
    ]);
    if (occurrence === undefined) throw new Error('delivery host occurrence is missing');
    const domain = assembleRoomActionDomain({
      routePosition: ordinaryPositionFor(catalog, pBiome),
      catalog,
      biome: pBiome,
      occurrence,
    });
    const roster = assembleRoomActionRoster({
      owner: host,
      order: occurrence.roomActions.order,
      contributions: domain.contributions,
      lifecycleStructure: domain.lifecycleStructure,
    });
    expect(
      roster.proposals.find(
        (proposal) =>
          proposal.kind === 'move' &&
          proposal.reference.kind === 'interactIncomingReward' &&
          proposal.toIndex === 0,
      ),
    ).toMatchObject({ structurallyAuthorable: true });
    expect(() => simulateProjectAssembly(catalog, project)).not.toThrow();
  });
});

describe('Hermes Shrine Travel Deal generation', () => {
  it('carries an unpurchased N offer into the later O Shrine candidate inventory', () => {
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat09')),
      value: { rewardType: 'MaxHealthDropBig' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat01')),
      value: { rewardType: 'SpellDrop' },
    });
    const host = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:postboss'));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: host,
      slotKey: 'secondLeft',
      value: { rewardType: 'SpellDrop' },
    });

    const assembly = simulateProjectAssembly(catalog, project);
    const n = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'N');
    if (n === undefined || !('rewards' in n)) throw new Error('fixture lost N rewards');
    expect(n.validity).toBe('valid');
    expect(n.rewards.branches.length).toBeGreaterThan(0);
    expect(
      n.rewards.branches.every(
        (branch) => branch.state.rewardHistory.useRecord.SpellDrop === undefined,
      ),
    ).toBe(true);
    const candidate = hermesShrineCandidateForProjectEvaluationAssembly(assembly, host);
    if (candidate === undefined) throw new Error('fixture lost the later O Shrine candidate');
    expect(candidate.candidateRewardTypesBySlot.secondLeft).toContain('MaxHealthDrop');
    expect(candidate.candidateRewardTypesBySlot.secondLeft).not.toContain('SpellDrop');

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
        'self',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'RestockBoon', rarity: 'Common' },
          { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
          { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: host,
      slotKey: 'secondLeft',
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:secondLeft', {
      delay: 2,
      rushed: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: host,
      value: { rewardType: 'SpellDrop' },
    });
    const invalidRefill = simulateProjectAssembly(catalog, project);
    const o = invalidRefill.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    expect(o?.findings).toContainEqual(
      expect.objectContaining({ code: 'hermesShrineTravelDealRefillUnavailable' }),
    );
    const refillDomain = hermesShrineCandidateForProjectEvaluationAssembly(
      invalidRefill,
      host,
    )?.travelDealRefill;
    expect(refillDomain?.candidateRewardTypes).toContain('BlindBoxLoot');
    expect(refillDomain?.candidateRewardTypes).not.toContain('SpellDrop');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: host,
      value: { rewardType: 'BlindBoxLoot' },
    });
    expect(simulateProject(catalog, project).status).toBe('valid');
  });

  it('applies the carried Dream N board SpellDrop lookup to the Travel Deal refill domain', () => {
    const dreamN = createBiomeAddress('Dream', 'N');
    let project = loadDreamMixedHandoffCheckpoint();
    const nPlan = project.route?.biomes.find((biome) => biome.biomeKey === 'N');
    const nTopology = nPlan?.topology;
    const spellSource = nTopology?.occurrences.find((room) => room.gameName === 'N_Combat09');
    const unvisitedTarget = nTopology?.occurrences.find((room) => room.gameName === 'N_Combat03');
    if (spellSource === undefined || unvisitedTarget === undefined)
      throw new Error('Dream fixture lost its N board reward sources');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(dreamN, spellSource.occurrenceId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(dreamN, unvisitedTarget.occurrenceId),
      value: { rewardType: 'SpellDrop' },
    });
    project = authorLegalTraitOffers(project);

    const assembly = simulateProjectAssembly(catalog, project);
    const n = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'N');
    if (n === undefined || !('rewards' in n)) throw new Error('Dream fixture lost N rewards');
    expect(n.validity).toBe('valid');
    expect(n.rewards.branches.length).toBeGreaterThan(0);
    expect(
      n.rewards.branches.every(
        (branch) => branch.state.rewardHistory.useRecord.SpellDrop === undefined,
      ),
    ).toBe(true);
    expect(n.rewards.branches[0]!.state.rewardLookups.hubRewardLookup).toContain('SpellDrop');
    const history = n.rewards.branches[0]?.state.rewardHistory;
    if (history === undefined) throw new Error('Dream fixture lost its N branch history');
    const requirements = {
      ...rewardFacts(history).requirements,
      offeredRewardTypes: new Set<string>(),
      rewardLookups: Object.freeze(
        Object.fromEntries(
          Object.entries(n.rewards.branches[0]!.state.rewardLookups).map(([key, values]) => [
            key,
            new Set(values),
          ]),
        ),
      ),
    };
    const refill = assessHermesShrineTravelDealRefill(
      catalog,
      complete({ first: 'HealBigDrop', secondLeft: 'TalentDrop', secondRight: 'MaxManaDrop' }),
      'initial:secondLeft',
      [requirements],
    );
    expect(refill?.sourceGenerationKey).toBe('initial:secondLeft');
    expect(refill?.candidateRewardTypes).toContain('MaxHealthDrop');
    expect(refill?.candidateRewardTypes).not.toContain('SpellDrop');
  });

  it('derives one same-group fourth generation and excludes all visible initial identities', () => {
    const shrine = complete({
      first: 'HealBigDrop',
      secondLeft: 'SpellDrop',
      secondRight: 'TalentDrop',
    });
    const first = assessHermesShrineTravelDealRefill(catalog, shrine, 'initial:first', []);
    const second = assessHermesShrineTravelDealRefill(catalog, shrine, 'initial:secondLeft', []);
    expect(first).toMatchObject({ sourceGenerationKey: 'initial:first' });
    expect(first?.candidateRewardTypes).toContain('ArmorBoost');
    expect(first?.candidateRewardTypes).not.toContain('HealBigDrop');
    expect(first?.candidateRewardTypes).not.toContain('SpellDrop');
    expect(second).toMatchObject({ sourceGenerationKey: 'initial:secondLeft' });
    expect(second?.candidateRewardTypes).toContain('MaxHealthDrop');
    expect(second?.candidateRewardTypes).not.toContain('SpellDrop');
    expect(second?.candidateRewardTypes).not.toContain('TalentDrop');
  });

  it('cannot derive a refill from the refill generation itself', () => {
    expect(
      assessHermesShrineTravelDealRefill(catalog, complete(), 'travelDealRefill', []),
    ).toBeUndefined();
  });

  it('uses a pre-equipped N-to-O Travel Deal only at the first rushed initial action', () => {
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: host,
      value: { rewardType: 'ArmorBoost' },
    });
    project = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:first', {
      delay: 2,
      rushed: true,
    });
    project = purchaseTestHermesShrineOffer(project, catalog, host, 'travelDealRefill', {
      delay: 3,
      rushed: true,
    });
    const refillEntry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      hermesShrineDeliveryEntryKey(host, 'travelDealRefill'),
    );
    const route = project.route;
    const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (route === undefined || plan === undefined) throw new Error('fixture lost Surface O');
    const snapshot = materializeBiomePrefix(
      catalog,
      oBiome,
      ordinaryPositionFor(catalog, oBiome),
      plan,
      route.loadout,
    );
    const history =
      snapshot == null
        ? undefined
        : composeBiomeHistoryPrefix(catalog, snapshot, ordinaryPositionFor(catalog, snapshot));
    if (snapshot == null || snapshot.entryRoom === undefined || history == null)
      throw new Error('fixture lost O history');
    const materializedRefillHost = prefixAuthoredRooms(snapshot).find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(host),
    );
    expect(
      materializedRefillHost?.roomActionRoster.rows.map((row) => row.reference),
    ).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: refillEntry.entryKey,
    });
    expect(
      materializedRefillHost?.roomActionRoster.rows.find(
        (row) =>
          row.reference.kind === 'interactAcquisitionEntry' &&
          row.reference.entryKey === refillEntry.entryKey,
      )?.window,
    ).toEqual({ kind: 'postOutgoing' });
    const completeSnapshot = snapshot as typeof snapshot & {
      readonly entryRoom: NonNullable<typeof snapshot.entryRoom>;
    };
    const result = evaluateBiomeRewards(
      catalog,
      completeSnapshot,
      history,
      ordinaryPositionFor(catalog, completeSnapshot),
      route.loadout,
      branchesWithTravelDeal(),
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      'hermesShrineTravelDealRefillUnavailable',
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain('rewardSourceUnavailable');
    expect(
      result.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.entry) === semanticAddressKey(refillEntry),
        ),
      ),
    ).toBe(true);
    expect(result.hermesShrineDeliveries.map((delivery) => delivery.entryKey)).not.toContain(
      hermesShrineDeliveryEntryKey(host, 'travelDealRefill'),
    );
    expect(refillEntry.entryKey).toBe(hermesShrineDeliveryEntryKey(host, 'travelDealRefill'));
    expect(refillEntry.entryKey).not.toBe(hermesShrineDeliveryEntryKey(host, 'initial:first'));

    const unpurchasedRefill = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'travelDealRefill',
      purchase: null,
    });
    const unrushedSource = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:first', {
      delay: 2,
      rushed: false,
    });
    for (const [cleanup, cleaned] of [
      ['unpurchase', unpurchasedRefill],
      ['unrush source', unrushedSource],
    ] as const) {
      const cleanedPlan = cleaned.route?.biomes.find((candidate) => candidate.biomeKey === 'O');
      if (cleanedPlan === undefined) throw new Error('fixture lost cleaned O');
      const cleanedSnapshot = materializeBiomePrefix(
        catalog,
        oBiome,
        ordinaryPositionFor(catalog, oBiome),
        cleanedPlan,
        route.loadout,
      );
      const cleanedHost =
        cleanedSnapshot === null
          ? undefined
          : prefixAuthoredRooms(cleanedSnapshot).find(
              (room) => semanticAddressKey(room.origin) === semanticAddressKey(host),
            );
      expect(
        cleanedHost?.roomActionRoster.rows.map((row) => row.reference),
        cleanup,
      ).not.toContainEqual({
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey: refillEntry.entryKey,
      });
    }

    const secondRush = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:secondLeft', {
      delay: 2,
      rushed: true,
    });
    // The first rush has already established the fourth generation above.
    // Clear its optional later purchase so this assertion isolates the second
    // initial rush rather than a separate delayed refill delivery.
    const bothRushed = applyProjectCommand(secondRush, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'travelDealRefill',
      purchase: null,
    });
    const secondPlan = bothRushed.route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (secondPlan === undefined) throw new Error('fixture lost O after second rush');
    const secondSnapshot = materializeBiomePrefix(
      catalog,
      oBiome,
      ordinaryPositionFor(catalog, oBiome),
      secondPlan,
      route.loadout,
    );
    const secondHistory =
      secondSnapshot === null
        ? undefined
        : composeBiomeHistoryPrefix(
            catalog,
            secondSnapshot,
            ordinaryPositionFor(catalog, secondSnapshot),
          );
    if (
      secondSnapshot?.entryRoom === undefined ||
      secondHistory === null ||
      secondHistory === undefined
    )
      throw new Error('fixture lost second-rush O history');
    const bothRushedResult = evaluateBiomeRewards(
      catalog,
      secondSnapshot as typeof secondSnapshot & {
        readonly entryRoom: NonNullable<typeof secondSnapshot.entryRoom>;
      },
      secondHistory,
      ordinaryPositionFor(
        catalog,
        secondSnapshot as typeof secondSnapshot & {
          readonly entryRoom: NonNullable<typeof secondSnapshot.entryRoom>;
        },
      ),
      route.loadout,
      branchesWithTravelDeal(),
    );
    expect(bothRushedResult.findings.map((finding) => finding.code)).not.toContain(
      'hermesShrineTravelDealRefillUnavailable',
    );
    const bothRushedHost = prefixAuthoredRooms(secondSnapshot).find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(host),
    );
    expect(bothRushedHost?.roomActionRoster.rows.map((row) => row.reference)).toEqual(
      expect.arrayContaining([
        {
          kind: 'interactAcquisitionEntry',
          siteKey: 'hermesShrineDelivery',
          entryKey: hermesShrineDeliveryEntryKey(host, 'initial:first'),
        },
        {
          kind: 'interactAcquisitionEntry',
          siteKey: 'hermesShrineDelivery',
          entryKey: hermesShrineDeliveryEntryKey(host, 'initial:secondLeft'),
        },
      ]),
    );
    expect(
      bothRushedHost?.roomActionRoster.rows
        .filter(
          (row) =>
            row.reference.kind === 'interactAcquisitionEntry' &&
            row.reference.siteKey === 'hermesShrineDelivery',
        )
        .map((row) => row.window),
    ).toEqual([{ kind: 'postOutgoing' }, { kind: 'postOutgoing' }]);
    expect(
      bothRushedResult.hermesShrineDeliveries.map((delivery) => delivery.entryKey),
    ).not.toContain(hermesShrineDeliveryEntryKey(host, 'initial:first'));
    expect(
      bothRushedResult.hermesShrineDeliveries.map((delivery) => delivery.entryKey),
    ).not.toContain(hermesShrineDeliveryEntryKey(host, 'initial:secondLeft'));
  });

  it('realizes the refill at the first rushed purchase whether or not its item is collected', () => {
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: host,
      value: { rewardType: 'ArmorBoost' },
    });
    for (const [generationKey, purchase] of [
      ['initial:first', { delay: 2, rushed: true }],
      ['travelDealRefill', { delay: 3, rushed: true }],
    ] as const)
      project = purchaseTestHermesShrineOffer(project, catalog, host, generationKey, purchase);
    const refillKey = hermesShrineDeliveryEntryKey(host, 'travelDealRefill');
    const removePickup = (
      document: typeof project,
      generationKey: 'initial:first' | 'initial:secondLeft',
    ) => {
      const reference = {
        kind: 'interactAcquisitionEntry' as const,
        siteKey: 'hermesShrineDelivery',
        entryKey: hermesShrineDeliveryEntryKey(host, generationKey),
      };
      return applyProjectCommand(document, catalog, {
        kind: 'RemoveRoomAction',
        action: createRoomActionAddress(oBiome, host.occurrenceId, roomActionKey(reference)),
      });
    };
    const evaluate = (document: typeof project) => {
      const route = document.route;
      const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
      if (route === undefined || plan === undefined) throw new Error('fixture lost Surface O');
      const snapshot = materializeBiomePrefix(
        catalog,
        oBiome,
        ordinaryPositionFor(catalog, oBiome),
        plan,
        route.loadout,
      );
      const history =
        snapshot == null
          ? undefined
          : composeBiomeHistoryPrefix(catalog, snapshot, ordinaryPositionFor(catalog, snapshot));
      if (snapshot == null || snapshot.entryRoom === undefined || history == null)
        throw new Error('fixture lost O history');
      const completeSnapshot = snapshot as typeof snapshot & {
        readonly entryRoom: NonNullable<typeof snapshot.entryRoom>;
      };
      const result = evaluateBiomeRewards(
        catalog,
        completeSnapshot,
        history,
        ordinaryPositionFor(catalog, completeSnapshot),
        route.loadout,
        branchesWithTravelDeal(),
      );
      const refillAcquired = result.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            event.settlement.entry.kind === 'acquisitionEntry' &&
            event.settlement.entry.entryKey === refillKey,
        ),
      );
      const sources = result.hermesShrineAssessments
        .find((entry) => semanticAddressKey(entry.origin) === semanticAddressKey(host))
        ?.assessments.map((assessment) => assessment.travelDealRefill?.sourceGenerationKey);
      return {
        // The N/O base route carries unrelated incomplete owners; only Shrine codes matter here.
        codes: result.findings
          .map((finding) => finding.code)
          .filter(
            (code) =>
              code === 'rewardSourceUnavailable' ||
              code === 'hermesShrineTravelDealRefillMissing' ||
              code === 'hermesShrineTravelDealRefillUnavailable',
          ),
        reasons: result.findings.flatMap((finding) =>
          'reason' in finding.evidence ? [finding.evidence.reason] : [],
        ),
        refillAcquired,
        sources,
      };
    };

    const kept = evaluate(project);
    expect(kept.codes).toEqual([]);
    expect(kept.refillAcquired).toBe(true);
    expect(kept.sources).toEqual(['initial:first']);

    const left = evaluate(removePickup(project, 'initial:first'));
    expect(left.codes).toEqual([]);
    expect(left.reasons).not.toContain('staleHermesShrineDelivery');
    expect(left.refillAcquired).toBe(true);
    expect(left.sources).toEqual(['initial:first']);

    // A second rushed purchase is not the first speed-up and creates no other refill.
    const secondRush = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:secondLeft', {
      delay: 2,
      rushed: true,
    });
    for (const document of [secondRush, removePickup(secondRush, 'initial:first')]) {
      const both = evaluate(document);
      expect(both.codes).toEqual([]);
      expect(both.sources).toEqual(['initial:first']);
    }

    // A delayed first purchase is no speed-up and refills nothing.
    const delayed = evaluate(
      purchaseTestHermesShrineOffer(project, catalog, host, 'initial:first', {
        delay: 2,
        rushed: false,
      }),
    );
    expect(delayed.refillAcquired).toBe(false);
    expect(delayed.sources).toEqual([undefined]);
  });

  describe('in timeline order', () => {
    const shrine = createOccurrenceAddress(
      nBiome,
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const refillPurchase = createRoomActionAddress(
      nBiome,
      shrine.occurrenceId,
      roomActionKey({
        kind: 'purchaseHermesShrineOffer',
        generationKey: 'travelDealRefill',
        rushed: false,
      }),
    );
    const evaluate = (project: ReturnType<typeof surfaceShrineTravelDealProject>) => {
      const evaluation = simulateProject(catalog, project);
      const n = evaluation.route.biomes.find((biome) => biome.biomeKey === 'N');
      if (n === undefined || !('rewards' in n)) throw new Error('N rewards are missing');
      return {
        findings: evaluation.findings,
        sources: n.rewards.hermesShrineAssessments
          .find((entry) => semanticAddressKey(entry.origin) === semanticAddressKey(shrine))
          ?.assessments.map((assessment) => assessment.travelDealRefill?.sourceGenerationKey),
      };
    };
    const withSecondRush = () =>
      purchaseTestHermesShrineOffer(
        surfaceShrineTravelDealProject(),
        catalog,
        shrine,
        'initial:secondLeft',
        { delay: 3, rushed: true },
      );

    it('refills the slot of the first rushed purchase action, not the first slot', () => {
      const project = withSecondRush();
      expect(evaluate(project).sources).toEqual(['initial:first']);

      const moved = applyProjectCommand(project, catalog, {
        kind: 'MoveRoomAction',
        action: testHermesShrinePurchaseAction(shrine, 'initial:secondLeft'),
        toIndex: 1,
      });
      // The stored first-group refill is kept and reported against the new
      // source slot's group, which blocks the room's assessment.
      const reordered = evaluate(moved);
      expect(
        moved.route.biomes[0]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === shrine.occurrenceId,
        )?.hermesShrine?.travelDealRefill?.offer,
      ).toEqual({ rewardType: 'ArmorBoost' });
      expect(reordered.findings).toContainEqual(
        expect.objectContaining({
          code: 'hermesShrineTravelDealRefillUnavailable',
          evidence: { generationKey: 'initial:secondLeft', rewardType: 'ArmorBoost' },
        }),
      );
    });

    it('reports a refill purchase with no rushed purchase to create it', () => {
      const project = applyProjectCommand(surfaceShrineTravelDealProject(), catalog, {
        kind: 'SetHermesShrinePurchaseRush',
        action: testHermesShrinePurchaseAction(shrine, 'initial:first'),
        rushed: false,
      });
      expect(evaluate(project).findings).toContainEqual(
        expect.objectContaining({
          code: 'hermesShrineTravelDealRefillUnavailable',
          origin: refillPurchase,
          evidence: { generationKey: 'travelDealRefill', reason: 'noRushedPurchase' },
        }),
      );
    });

    it('reports a refill purchase whose Travel Deal is lost upstream and clears it on removal', () => {
      const travelDealSource = createTraitOfferAddress(
        createIncomingRewardAddress(nBiome, nOccurrenceId('combat09')),
        'self',
      );
      const project = applyProjectCommand(
        applyProjectCommand(surfaceShrineTravelDealProject(), catalog, {
          kind: 'SetHermesShrinePurchaseRush',
          action: refillPurchase,
          rushed: true,
        }),
        catalog,
        {
          kind: 'ReplaceTraitOffer',
          trait: travelDealSource,
          value: {
            kind: 'traits',
            giverKey: 'Hermes',
            options: [
              { traitKey: 'RestockBoon', rarity: 'Epic' },
              { traitKey: 'HermesWeaponBoon', rarity: 'Rare' },
              { traitKey: 'SprintShieldBoon', rarity: 'Common' },
            ],
            selectedOptionKey: 'option2',
          },
        },
      );
      const lost = evaluate(project);
      expect(lost.findings).toContainEqual(
        expect.objectContaining({
          code: 'hermesShrineTravelDealRefillUnavailable',
          origin: refillPurchase,
          evidence: { generationKey: 'travelDealRefill', reason: 'travelDealInactive' },
        }),
      );
      // The refill purchase is the first stop; its pickup is never reached.
      expect(lost.findings).toHaveLength(1);
      const refillPickup = hermesShrineDeliveryEntryKey(shrine, 'travelDealRefill');

      const removed = applyProjectCommand(project, catalog, {
        kind: 'SetHermesShrinePurchase',
        occurrence: shrine,
        generationKey: 'travelDealRefill',
        purchase: null,
      });
      const room = removed.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shrine.occurrenceId,
      );
      expect(room?.hermesShrine?.travelDealRefill).toEqual({ offer: { rewardType: 'ArmorBoost' } });
      expect(room?.roomActions.order).not.toContainEqual(
        expect.objectContaining({ generationKey: 'travelDealRefill' }),
      );
      expect(room?.roomActions.order).not.toContainEqual(
        expect.objectContaining({ entryKey: refillPickup }),
      );
      expect(
        evaluate(removed).findings.filter(
          (finding) =>
            semanticAddressKey(finding.origin) === semanticAddressKey(refillPurchase) ||
            ('entryKey' in finding.origin && finding.origin.entryKey === refillPickup),
        ),
      ).toEqual([]);
    });
  });
});

describe('Hermes Shrine Spell reservation lifecycle input', () => {
  it('carries a delayed Spell reservation into later room-generation checkpoints', () => {
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'SpellDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: source,
        slotKey,
        value: { rewardType },
      });
    }
    const target = createTargetAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat01 },
      'exit1',
    );
    const unpurchased = evaluateShrineOutgoingPrefix(project, 'SpellDrop', oOccurrenceIds.combat01);
    expect(unpurchased.rewards.targetHistory).toContainEqual(
      expect.objectContaining({
        origin: target,
        states: [expect.objectContaining({ pendingHermesShrineDeliveries: {} })],
      }),
    );
    expect(outgoingEligibility(unpurchased.runState, 'SpellDrop')).toBe('eligible');

    project = purchaseTestHermesShrineOffer(project, catalog, source, 'initial:secondLeft', {
      delay: 8,
      rushed: false,
    });
    const purchased = evaluateShrineOutgoingPrefix(project, 'SpellDrop', oOccurrenceIds.combat01);
    const sourceKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    expect(purchased.runState.pendingHermesShrineDeliveries[sourceKey]).toMatchObject({
      rewardType: 'SpellDrop',
    });
    expect(purchased.rewards.targetHistory).toContainEqual(
      expect.objectContaining({
        origin: target,
        states: [
          expect.objectContaining({
            pendingHermesShrineDeliveries: expect.objectContaining({
              [sourceKey]: expect.objectContaining({ rewardType: 'SpellDrop' }),
            }),
          }),
        ],
      }),
    );
    expect(outgoingEligibility(purchased.runState, 'SpellDrop')).toBe('ineligible');
  });
});

describe('Hermes Shrine pickup settlement', () => {
  it('publishes the exact Preboss entry state when terminal delivery placement stops the walk', () => {
    let project = loadSurfaceNOPQProject();
    const source = createOccurrenceAddress(
      pBiome,
      createOccurrenceId('surface-p-preboss-shop:postboss'),
    );
    project = purchaseTestHermesShrineOffer(project, catalog, source, 'initial:first', {
      delay: 8,
      rushed: false,
    });
    const evaluation = observeDeliveryStop(
      project,
      'roomEntered',
      createOccurrenceAddress(
        createBiomeAddress('Surface', 'Q'),
        createOccurrenceId('surface-q-preboss'),
      ),
    );
    const q = evaluation.route.biomes.find((biome) => biome.biomeKey === 'Q');
    if (q === undefined || !('rewards' in q)) throw new Error('missing Q evaluation');
    const finding = q.findings.find(
      (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
    );
    if (finding?.origin.kind !== 'acquisitionEntry')
      throw new Error('missing terminal delivery placement');
  });

  it('settles the canonical delayed delivery at its exact derived host and phase', () => {
    const assembly = simulateProjectAssembly(
      catalog,
      loadSurfaceNOHermesShrineDeliveryCheckpoint(),
    );
    const o = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    if (o === undefined) throw new Error('fixture lost O evaluation');
    if (!('rewards' in o) || o.authoring !== 'complete' || o.validity !== 'valid')
      throw new Error('fixture did not produce a valid O evaluation');
    expect(o.rewards.findings).not.toContainEqual(
      expect.objectContaining({ code: 'hermesShrineDeliveryPlacementRequired' }),
    );
    const dueHost = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    expect(
      o.rewards.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.site.owner) === semanticAddressKey(dueHost),
        ),
      ),
    ).toBe(true);
  });

  it('settles a committed delayed Talent Drop after closure without reopening the Hex tree', () => {
    const sourceHost = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const deliveryHost = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
    const entryKey = hermesShrineDeliveryEntryKey(sourceHost, 'initial:secondRight');
    const site = createAcquisitionSiteAddress(deliveryHost, 'hermesShrineDelivery');
    let closed = installHexTree(
      catalog,
      initializeRewardBranches(
        undefined,
        createTestArcanaFearState(),
        catalog,
        'ForceZeusBoonKeepsake',
      )[0]!,
      'SpellPolymorphTrait',
      createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait', 'Lung'),
    );
    for (let index = 0; index < 6; index += 1) closed = settlePathScreen(catalog, closed, 3);
    expect(closed.state.hexProgress).toMatchObject({
      investedPathPoints: 18,
      talentDropsClosed: true,
    });

    const delivery = settleOwnedAcquisitionSite(
      catalog,
      [closed],
      {
        siteOwner: deliveryHost,
        pointKey: 'hermesShrineDelivery',
        entryKey,
        historySequence: 9,
        source: {
          origin: createAcquisitionEntryAddress(site, entryKey),
          offer: { rewardType: 'TalentDrop' },
          producerLifecycleKey: 'HermesShrineDelivery',
          instanceProvenance: 'free',
          presentsMaterializedScreen: false,
        },
      },
      (state) => rewardFacts(state.rewardHistory),
    );
    expect(delivery.branches[0]?.state.hexProgress).toMatchObject({
      investedPathPoints: 18,
      bankedPathPoints: 2,
      talentDropsClosed: true,
    });
  });

  it('settles a rushed forced P Postboss Shrine pickup at the configured route tail', () => {
    const host = createOccurrenceAddress(
      pBiome,
      createOccurrenceId('surface-p-preboss-shop:postboss'),
    );
    let project = loadSurfaceNOPProject();
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    project = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:first', {
      delay: 2,
      rushed: true,
    });
    const evaluation = simulateProject(catalog, project);
    const p = evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
    if (p?.authoring !== 'complete' || p.validity !== 'valid') {
      throw new Error(
        `fixture lost valid tail P biome: ${p?.findings.map((finding) => finding.code).join(',')}`,
      );
    }
    expect(p.rewards.hermesShrineDeliveries.map((delivery) => delivery.entryKey)).not.toContain(
      hermesShrineDeliveryEntryKey(host, 'initial:first'),
    );
  });

  it('locates an unresolved rushed Mystery Boon beneath a fixed Postboss purchase action', () => {
    let project = loadSurfaceNOPProject();
    const plan = project.route.biomes.find((biome) => biome.biomeKey === 'N');
    const postboss = plan?.topology?.occurrences.find(
      (occurrence) => occurrence.gameName === 'N_PostBoss01',
    );
    if (postboss === undefined) throw new Error('fixture has no N Postboss occurrence');
    const host = createOccurrenceAddress(createBiomeAddress('Surface', 'N'), postboss.occurrenceId);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: host,
      slotKey: 'secondRight',
      value: { rewardType: 'BlindBoxLoot' },
    });
    project = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:secondRight', {
      delay: 2,
      rushed: true,
    });

    const assembly = simulateProjectAssembly(catalog, project);
    expect(assembly.evaluation.findings.map((finding) => finding.code)).toContain('rewardMissing');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      hermesShrineDeliveryEntryKey(host, 'initial:secondRight'),
    );
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      }),
    ).toMatchObject({ kind: 'acquisitionEntryOffer', result: { supported: true } });
  });

  it('settles a rushed Shrine item through the ordinary free pickup lifecycle', () => {
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'LastStandDrop'],
      ['secondLeft', 'ShopHermesUpgrade'],
      ['secondRight', 'TalentDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    project = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:first', {
      delay: 2,
      rushed: true,
    });
    const site = createAcquisitionSiteAddress(host, 'hermesShrineDelivery');
    const entry = createAcquisitionEntryAddress(
      site,
      hermesShrineDeliveryEntryKey(host, 'initial:first'),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(entry, 'self'),
      value: { kind: 'timePiece' },
    });

    const evaluation = simulateProject(catalog, project);
    const o = evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    if (o?.authoring !== 'complete' || o.validity !== 'valid') {
      throw new Error(
        `fixture lost valid O biome: ${o?.findings.map((finding) => finding.code).join(',')}`,
      );
    }
    expect(
      o?.rewards.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'conversionToGold' &&
            semanticAddressKey(event.origin) === semanticAddressKey(entry) &&
            semanticAddressKey(event.settlement?.entry ?? entry) === semanticAddressKey(entry),
        ),
      ),
    ).toBe(true);

    // A later host owns its own retained child.  It must not be mistaken for
    // the virtual same-room rush source merely because both use the closed
    // Shrine delivery site key.
    const delayedHost = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
    let delayed = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:first', {
      delay: 2,
      rushed: false,
    });
    const delayedEntry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(delayedHost, 'hermesShrineDelivery'),
      hermesShrineDeliveryEntryKey(host, 'initial:first'),
    );
    delayed = applyProjectCommand(delayed, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: delayedEntry,
      value: { rewardType: 'LastStandDrop' },
    });
    delayed = applyProjectCommand(delayed, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(delayedEntry, 'self'),
      value: { kind: 'timePiece' },
    });
    const retained = delayed.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === delayedHost.occurrenceId,
      )?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[delayedEntry.entryKey];
    expect(retained?.dispositionByAcquisitionRole.self).toEqual({ kind: 'timePiece' });
  });

  /** The published rarity table of one delivery's trait child, per reached branch. */
  function deliveredBoonRarityValues(
    project: ReturnType<typeof loadSurfaceNOPQProject>,
    trait: ReturnType<typeof createTraitOfferAddress>,
    giverKey: string,
  ) {
    const value = supportedTraitOffer(project, trait, giverKey);
    if (value === undefined) throw new Error(`${giverKey} delivery has no supported offer`);
    const authored = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value,
    });
    const assembly = simulateProjectAssembly(catalog, authored);
    const biome = assembly.evaluation.route.biomes.find(
      (candidate) => candidate.biomeKey === trait.biomeKey,
    );
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
      throw new Error(
        `delivery host biome is not valid: ${biome?.findings.map((finding) => finding.code).join(',')}`,
      );
    const evaluation = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'traitOffer',
      trait,
      value,
    });
    if (evaluation.kind !== 'traitOffer') throw new Error('delivery child candidate unavailable');
    return evaluation.result.branches.map((branch) => branch.offerGenerationState?.rarity);
  }

  /** O Postboss Shrine countdown purchase placed at the P host it falls due in. */
  function countdownDeliveryIntoP(
    delay: 5 | 6,
    hostOccurrenceId: string,
    encounterPhaseKey: string,
  ) {
    const rewardType = 'ShopHermesUpgrade';
    const source = createOccurrenceAddress(
      oBiome,
      createOccurrenceId('surface-o-preboss:postboss'),
    );
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondLeft',
      value: { rewardType },
    });
    project = purchaseTestHermesShrineOffer(project, catalog, source, 'initial:secondLeft', {
      delay,
      rushed: false,
    });
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(pBiome, createOccurrenceId(hostOccurrenceId)),
        'hermesShrineDelivery',
      ),
      hermesShrineDeliveryEntryKey(source, 'initial:secondLeft'),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      encounterPhaseKey,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: { rewardType },
    });
    return Object.freeze({ project, entry });
  }

  it('builds a countdown delivery with the miniboss host rarity override', () => {
    const override = catalog.rooms.byKey.P_MiniBoss01?.boonRarityOverride;
    if (override === undefined) throw new Error('missing P Miniboss rarity override');
    const { project, entry } = countdownDeliveryIntoP(6, 'surface-p-5-1-p_miniboss01', 'Encounter');
    expect(
      deliveredBoonRarityValues(project, createTraitOfferAddress(entry, 'hermes'), 'Hermes'),
    ).toEqual([
      {
        kind: 'orderedChecks',
        values: { ...catalog.boonRarityBases.hermes, ...override },
        rollOrder: catalog.boonRarityRollOrder,
      },
    ]);
  });

  it('keeps the provider base for a countdown delivery into a room without an override', () => {
    expect(catalog.rooms.byKey.P_Combat07?.boonRarityOverride).toBeUndefined();
    const { project, entry } = countdownDeliveryIntoP(5, 'surface-p-4-1-p_combat07', 'Combat');
    expect(
      deliveredBoonRarityValues(project, createTraitOfferAddress(entry, 'hermes'), 'Hermes'),
    ).toEqual([
      {
        kind: 'orderedChecks',
        values: catalog.boonRarityBases.hermes,
        rollOrder: catalog.boonRarityRollOrder,
      },
    ]);
  });

  it('builds a rushed same-room delivery with the miniboss host rarity override', () => {
    const override = catalog.rooms.byKey.O_MiniBoss02?.boonRarityOverride;
    if (override === undefined) throw new Error('missing O Miniboss rarity override');
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: host,
      gameName: 'O_MiniBoss02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat01,
      }),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.combat01),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'BlindBoxLoot'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    project = purchaseTestHermesShrineOffer(project, catalog, host, 'initial:secondLeft', {
      delay: 2,
      rushed: true,
    });
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      hermesShrineDeliveryEntryKey(host, 'initial:secondLeft'),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = authorLegalTraitOffers(project);
    expect(
      deliveredBoonRarityValues(project, createTraitOfferAddress(entry, 'hiddenSource'), 'Apollo'),
    ).toEqual([
      {
        kind: 'orderedChecks',
        values: { ...catalog.boonRarityBases.olympian, ...override },
        rollOrder: catalog.boonRarityRollOrder,
      },
    ]);
  });
});

describe('Hermes Shrine delivery entry identity', () => {
  it('round-trips the complete source address and keeps cross-biome sources distinct', () => {
    const n = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('same-occurrence-id'),
    );
    const o = createOccurrenceAddress(
      createBiomeAddress('Surface', 'O'),
      createOccurrenceId('same-occurrence-id'),
    );
    const nKey = hermesShrineDeliveryEntryKey(n, 'initial:secondLeft');
    const oKey = hermesShrineDeliveryEntryKey(o, 'initial:secondLeft');
    expect(nKey).not.toBe(oKey);
    expect(parseHermesShrineDeliveryEntryKey(nKey)).toEqual({
      routeKey: 'Surface',
      biomeKey: 'N',
      sourceOccurrenceId: 'same-occurrence-id',
      generationKey: 'initial:secondLeft',
    });
  });

  it.each([
    '',
    'hermesShrineDelivery:',
    'hermesShrineDelivery:%',
    'hermesShrineDelivery:%5B%22Surface%22%2C%22N%22%2C%22id%22%5D',
    'hermesShrineDelivery:%5B%22Surface%22%2C%22N%22%2C%22id%22%2C%22bad%22%5D',
    'hermesShrineDelivery:%5B%22%22%2C%22N%22%2C%22id%22%2C%22first%22%5D',
  ])('rejects malformed delivery key %s', (key) => {
    expect(parseHermesShrineDeliveryEntryKey(key)).toBeUndefined();
  });
});

describe('Hermes Shrine entry inventory requirements', () => {
  /**
   * The Shrine inventory assessment lives inside the room-entry transition and
   * only runs where that transition is the first to reach the host. This builds
   * the exact authored contact — materialized host, folded entry view and the
   * real entry event — rather than reproducing any assessment rule.
   */
  function authoredShrineHostEntry() {
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: host,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'ShopHermesUpgrade'],
      ['secondRight', 'TalentDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: host,
        slotKey,
        value: { rewardType },
      });
    }
    const route = project.route;
    const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (route === undefined || plan === undefined || plan.topology === null)
      throw new Error('fixture lost Surface O topology');
    const routePosition = ordinaryPositionFor(catalog, oBiome);
    const snapshot = materializeBiomePrefix(catalog, oBiome, routePosition, plan, route.loadout);
    const history =
      snapshot === null ? null : composeBiomeHistoryPrefix(catalog, snapshot, routePosition);
    if (snapshot === null || history === null)
      throw new Error('fixture lost the authored O Shrine prefix');
    const room = prefixAuthoredRooms(snapshot).find(
      (candidate) => candidate.origin.occurrenceId === oOccurrenceIds.combat07,
    );
    const hostKey = semanticAddressKey(host);
    const view = history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === hostKey,
    );
    const entryEvent = history.events.find(
      (event) => event.kind === 'roomEntered' && semanticAddressKey(event.origin) === hostKey,
    );
    if (
      room?.hermesShrine === undefined ||
      view === undefined ||
      entryEvent?.kind !== 'roomEntered'
    )
      throw new Error('fixture lost the authored O Shrine entry contact');
    return { room, view, entryEvent, routePosition };
  }

  function enterAuthoredShrineHost(talentDropsClosed: boolean) {
    const { room, view, entryEvent, routePosition } = authoredShrineHostEntry();
    const branches = initializeTestRewardBranches().map((branch) =>
      Object.freeze({
        ...branch,
        state: reachSimulationHistory(
          Object.freeze({
            ...branch.state,
            rewardHistory: Object.freeze({
              ...branch.state.rewardHistory,
              useRecord: Object.freeze({
                ...branch.state.rewardHistory.useRecord,
                SpellDrop: 1,
              }),
            }),
            hexProgress: Object.freeze({
              ...branch.state.hexProgress,
              ...(talentDropsClosed ? { talentDropsClosed: true as const } : {}),
            }),
          }),
          routePosition,
          view.entry,
        ),
      }),
    );
    return applyRoomEnteredTransition(
      catalog,
      entryEvent,
      room,
      view,
      new Set(),
      new Set(),
      branches,
      Object.freeze({
        kind: 'history' as const,
        sequence: entryEvent.sequence,
        boundary: 'at' as const,
      }),
      routePosition,
      { hermesShrine: false, stygianWell: true },
    );
  }

  it('closes Talent Shrine inventory for a branch that invested every Talent', () => {
    const open = enterAuthoredShrineHost(false);
    const closed = enterAuthoredShrineHost(true);
    const inventory = (transition: typeof open) =>
      transition.hermesShrineAssessment?.assessments[0]?.inventory;
    expect(inventory(open)?.candidateRewardTypesBySlot.secondRight).toContain('TalentDrop');
    expect(inventory(closed)?.candidateRewardTypesBySlot.secondRight).not.toContain('TalentDrop');
    expect(inventory(open)?.inventoryIssues).toEqual([]);
    expect(inventory(closed)?.inventoryIssues).toEqual([
      { kind: 'requirement', slotKey: 'secondRight' },
    ]);
    expect(inventory(open)?.complete).toBe(true);
    expect(inventory(closed)?.complete).toBe(false);
    expect(open.findings.map((entry) => entry.finding.code)).not.toContain(
      'hermesShrineInventoryRequirement',
    );
    expect(closed.findings.map((entry) => entry.finding.code)).toContain(
      'hermesShrineInventoryRequirement',
    );
  });
});

it('retains reached placement rejection at the first due phase stop', () => {
  const original = loadSurfaceNOHermesShrineDeliveryCheckpoint();
  const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
  const occurrence = original.route.biomes
    .find((biome) => biome.biomeKey === 'O')
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === host.occurrenceId);
  const reference = occurrence?.roomActions.order.find(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'hermesShrineDelivery',
  );
  if (reference?.kind !== 'interactAcquisitionEntry') throw new Error('fixture delivery missing');
  const entry = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(host, reference.siteKey),
    reference.entryKey,
  );
  const project = applyProjectCommand(original, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry,
    encounterPhaseKey: 'obsoletePhase',
  });
  const assembly = simulateProjectAssembly(catalog, project);
  const evaluation = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
  if (evaluation === undefined || !('rewards' in evaluation))
    throw new Error('delivery evaluation missing');
  expect(evaluation.findings.map((finding) => finding.code)).toContain(
    'hermesShrineDeliveryPlacementRequired',
  );
  expect(evaluation.rewards.generatedPickupPlacements).toContainEqual(
    expect.objectContaining({
      address: entry,
      assessment: expect.objectContaining({ kind: 'invalid', reason: 'dueContactMismatch' }),
    }),
  );
});

it('keeps an earlier proven same-room placement when a later sibling blocks', () => {
  const {
    project: complete,
    introEntry,
    combatEntry,
  } = createSurfaceOSameRoomHermesDeliveriesCheckpoint();
  const project = applyProjectCommand(complete, catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry: combatEntry,
    value: {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
  });
  const assembly = simulateProjectAssembly(catalog, project);
  const evaluation = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
  if (evaluation === undefined || !('rewards' in evaluation))
    throw new Error('delivery evaluation missing');
  expect(evaluation.findings.map((finding) => finding.code)).toEqual(['traitOfferMissing']);
  expect(evaluation.rewards.generatedPickupPlacements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        address: introEntry,
        assessment: { kind: 'valid', source: expect.anything() },
      }),
      expect.objectContaining({
        address: combatEntry,
        assessment: { kind: 'valid', source: expect.anything() },
      }),
    ]),
  );
});

it('publishes active-source wrong-host rejection without a derived candidate capability', () => {
  const original = loadSurfaceNOHermesShrineDeliveryCheckpoint();
  const dueHost = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
  const host = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
  const occurrence = original.route.biomes
    .find((biome) => biome.biomeKey === 'O')
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === dueHost.occurrenceId);
  const reference = occurrence?.roomActions.order.find(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'hermesShrineDelivery',
  );
  if (reference?.kind !== 'interactAcquisitionEntry') throw new Error('fixture delivery missing');
  const entry = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(host, reference.siteKey),
    reference.entryKey,
  );
  const project = applyProjectCommand(original, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry,
    encounterPhaseKey: 'Encounter',
  });
  const assembly = simulateProjectAssembly(catalog, project);
  const evaluation = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
  if (evaluation === undefined || !('rewards' in evaluation))
    throw new Error('delivery evaluation missing');
  expect(evaluation.rewards.generatedPickupPlacements).toContainEqual(
    expect.objectContaining({
      address: entry,
      assessment: expect.objectContaining({ kind: 'invalid', reason: 'dueContactMismatch' }),
    }),
  );
  expect(derivedAcquisitionEntriesForProjectEvaluationAssembly(assembly, entry.site)).toEqual([]);
});
