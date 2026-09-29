import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createTargetAddress,
  semanticAddressKey,
  createBiomeAddress,
  createProjectDocument,
  decodeProjectDocument,
  encodeProjectDocument,
  resolveRoutePosition,
  routeHasKeepsakeRack,
  routePurgingPool,
  routeRoomShop,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  evaluateRequirement,
  type RequirementEvaluationContext,
  type RequirementExpression,
} from '@run-planner/engine/requirements';
import {
  assessShopInventory,
  consumeCountedOffer,
  countedStoreExhausted,
  createRewardBagState,
  createRewardHistoryState,
  creditResourceGains,
  factsWithHistory,
  supportedPayloads,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import {
  assessStygianWellPlacement,
  createArcanaFearState,
  simulateProject,
  type RunStateSnapshot,
} from '@run-planner/engine/simulation';
import { loadUnderworldGeneratedCompositionCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { customizationValueRouteExcluded } from '../../src/authored-project/room-state/encounter-customization';
import { createDefaultRoomEncounterState } from '../../src/authored-project/room-state/encounter-envelope';
import { defaultOccurrence } from '../../src/authored-project/topology/construction';
import { createOccurrenceId } from '../../src/authored-project/addresses';
import { encounterPhaseAuthoringDomainForRoom } from '../../src/simulation/encounters/authoring-domain';
import { createRouteStartHistoryView } from '../../src/simulation/history/fold';
import { createInitialSimulationState } from '../../src/simulation/state/construction';
import { boonReplacementChance } from '../../src/simulation/traits/offer-domain';

const notFreshFile = JSON.stringify({
  kind: 'not',
  requirement: { kind: 'routeKeyEquals', routeKey: 'FreshFile' },
});

function context(
  routeKey: string,
  overrides: Partial<RequirementEvaluationContext> = {},
): RequirementEvaluationContext {
  return {
    routeKey,
    counters: {
      biomeDepthCache: 5,
      biomeEncounterDepth: 2,
      encounterDepth: 7,
      enteredBiomes: 1,
      upgradableTraitCount: 1,
    },
    records: {
      biomeUseRecord: {},
      lootTypeHistory: {},
      roomsEntered: {},
      useRecord: {},
      resourceGains: {},
    },
    currentRoomShopOptionNames: new Set(),
    currentRoomRewardType: 'MaxHealthDrop',
    currentRoomStructuralTags: [],
    rewardLookups: { hubRewardLookup: new Set() },
    offeredRewardTypes: new Set(),
    runDepthCache: 12,
    lastEventRunDepthCaches: {},
    recentEncounterEnvelopeSlots: [],
    encounterHistory: {
      routeEncounterKeyCounts: {},
      biomeEncounterKeyCounts: {},
      previousRoomEncounterKeys: [],
    },
    offeredExitCount: 2,
    currentBatchRoomGameNames: ['F_Combat01'],
    clockwork: { remainingGoals: 2, maxNonGoalRewards: 4, nonGoalRewardsAcquired: 0 },
    flags: { allSpellInvested: false, pendingSpellDrop: false },
    ...overrides,
  };
}

/** The same expression with the Fresh File route term removed wherever it appears. */
function withoutFreshTerm(requirement: RequirementExpression): RequirementExpression {
  if (requirement.kind === 'all' || requirement.kind === 'any')
    return {
      ...requirement,
      requirements: requirement.requirements
        .filter((child) => JSON.stringify(child) !== notFreshFile)
        .map(withoutFreshTerm),
    };
  if (requirement.kind === 'not')
    return { ...requirement, requirement: withoutFreshTerm(requirement.requirement) };
  return requirement;
}

/** False on Fresh File; on a mature route the route term is constant true. */
function expectFreshOnlyExclusion(requirement: RequirementExpression | undefined): void {
  expect(requirement).toBeDefined();
  expect(JSON.stringify(requirement)).toContain(notFreshFile);
  expect(evaluateRequirement(requirement!, context('FreshFile'))).toBe(false);
  for (const routeKey of ['Underworld', 'Surface']) {
    const mature = context(routeKey);
    expect(evaluateRequirement(requirement!, mature)).toBe(
      evaluateRequirement(withoutFreshTerm(requirement!), mature),
    );
  }
}

function rewardFacts(
  routeKey: string,
  history: RewardHistoryState,
  enteredBiomes = 1,
): RewardKernelFacts {
  const base = context(routeKey, {
    counters: { ...context(routeKey).counters, enteredBiomes },
  });
  return factsWithHistory({ requirements: base }, history, new Set());
}

function routeStartState(project: ProjectDocument) {
  const { route } = project;
  return createInitialSimulationState(
    catalog,
    route.loadout,
    route.loadout.startingKeepsakeKey,
    createArcanaFearState(catalog, route.loadout),
    {
      routePosition: resolveRoutePosition(catalog, route, route.itineraryBiomeKeys[0]!),
      historyView: createRouteStartHistoryView(),
    },
  );
}

describe('Fresh File blanket exclusions', () => {
  it('makes the unreachable story, Reprieve and miniboss rooms ineligible', () => {
    for (const gameName of [
      'F_Story01',
      'G_Story01',
      'I_Story01',
      'F_Reprieve01',
      'G_Reprieve01',
      'I_Reprieve01',
      'I_Combat24',
      'F_MiniBoss02',
      'F_MiniBoss03',
      'G_MiniBoss02',
    ])
      expectFreshOnlyExclusion(catalog.rooms.byKey[gameName]?.eligibility);
  });

  it('closes spawned Chaos gates and the Zagreus contract door at their source requirement', () => {
    for (const room of catalog.rooms.values) {
      for (const exit of room.additionalExits) {
        if (room.roomSetKey !== 'F' && room.roomSetKey !== 'G') continue;
        if (exit.kind === 'chaos' && !exit.canSpawn) continue;
        expectFreshOnlyExclusion(exit.requirement);
      }
    }
    expect(catalog.rooms.byKey.F_Shop01?.additionalExits.map((exit) => exit.kind)).toContain(
      'zagreusContract',
    );
    const anomaly = catalog.biomeLayouts.byKey.G?.progression;
    expect(
      anomaly?.kind === 'generated' && anomaly.anomalyReplacement?.source.excludedRouteKeys,
    ).toContain('FreshFile');
  });

  it('removes Wells, Pools, racks and resource points on Fresh File only', () => {
    const postboss = catalog.rooms.byKey.F_PostBoss01!;
    const combat = catalog.rooms.byKey.F_Combat01!;
    for (const gameName of ['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01']) {
      const room = catalog.rooms.byKey[gameName]!;
      expect(routeRoomShop(room, 'FreshFile')).toBeUndefined();
      expect(routePurgingPool(room, 'FreshFile')).toBeUndefined();
      expect(routeHasKeepsakeRack(room, 'FreshFile')).toBe(false);
      expect(routeRoomShop(room, 'Underworld')).toMatchObject({ forced: true });
      expect(routePurgingPool(room, 'Underworld')).toBeDefined();
      expect(routeHasKeepsakeRack(room, 'Underworld')).toBe(true);
    }
    expect(assessStygianWellPlacement(postboss, 'FreshFile', [], 0)).toMatchObject({
      forced: false,
      eligible: false,
    });
    expect(assessStygianWellPlacement(combat, 'FreshFile', [], 3).eligible).toBe(false);
    expect(assessStygianWellPlacement(combat, 'Underworld', [], 3).eligible).toBe(true);

    const occurrence = (routeKey: string) =>
      defaultOccurrence(
        catalog,
        postboss,
        routeKey,
        createOccurrenceId('postboss'),
        'ordinary',
        true,
        undefined,
        createProjectDocument(catalog, { projectId: 'defaults', routeKey }).route.loadout,
      );
    expect(occurrence('FreshFile')).not.toHaveProperty('stygianWell');
    expect(occurrence('FreshFile')).not.toHaveProperty('purgingPool');
    expect(occurrence('Underworld')).toHaveProperty('stygianWell');
    expect(occurrence('Underworld')).toHaveProperty('purgingPool');
    for (const room of catalog.rooms.values.filter((candidate) =>
      ['F', 'G', 'H', 'I'].includes(candidate.roomSetKey),
    ))
      expect(room.resourcePointSupport.excludedRouteKeys).toContain('FreshFile');
  });

  it('keeps unreachable NPC encounters out of Fresh File preparation', () => {
    for (const encounterKey of [
      'ArtemisCombatF',
      'ArtemisCombatG',
      'ArachneCombatF',
      'ArachneCombatG',
      'NemesisCombatF',
      'NemesisCombatG',
      'NemesisCombatH',
      'NemesisCombatI',
      'NemesisRandomEvent',
    ])
      expectFreshOnlyExclusion(catalog.encounterDefinitions.byKey[encounterKey]?.requirements);
  });

  it('offers only the first-fight boss choices and retains an excluded one as unsupported', () => {
    const choicesOn = (gameName: string, routeKey: string) => {
      const room = catalog.rooms.byKey[gameName]!;
      const occurrenceId = createOccurrenceId(`${gameName}:boss`);
      const [domain] = encounterPhaseAuthoringDomainForRoom(
        catalog,
        createBiomeAddress(routeKey, room.roomSetKey),
        room,
        { kind: 'occurrence', occurrenceId },
        createDefaultRoomEncounterState(catalog, room, 'encounters'),
        { includeFixedPhases: true },
      );
      const decision = domain?.customization?.[0];
      return decision?.selection.kind === 'single'
        ? decision.selection.choices.map((choice) => choice.key)
        : [];
    };
    expect(choicesOn('F_Boss01', 'FreshFile')).toEqual(['largeMeteors']);
    expect(choicesOn('F_Boss01', 'Underworld')).toHaveLength(6);
    expect(choicesOn('G_Boss01', 'FreshFile')).toEqual(['jetty']);
    expect(choicesOn('G_Boss01', 'Underworld')).toEqual(['scylla', 'roxy', 'jetty']);

    const hecate = catalog.encounterDefinitions.byKey.BossHecate01!.customization![0]!;
    const rings = { kind: 'single', choiceKey: 'rings' } as const;
    expect(customizationValueRouteExcluded(hecate, rings, 'FreshFile')).toBe(true);
    expect(customizationValueRouteExcluded(hecate, rings, 'Underworld')).toBe(false);
  });

  it('fills the mature MetaProgress bag with its thirteen entries and a fresh one with all nineteen', () => {
    const store = catalog.rewards.stores.byKey.MetaProgress!;
    const total = (routeKey: string) =>
      createRewardBagState(store, routeKey).remainingEntryCounts.reduce((sum, n) => sum + n, 0);
    expect(total('Underworld')).toBe(13);
    expect(total('Surface')).toBe(13);
    expect(total('FreshFile')).toBe(19);

    const mature = createRewardHistoryState(catalog.rewards, 'mature');
    const exhausted = { remainingEntryCounts: store.entries.map(() => 0) };
    const [refilled] = consumeCountedOffer(
      catalog.rewards,
      store,
      exhausted,
      { rewardType: 'MetaCurrencyBigDrop' },
      rewardFacts('Underworld', mature, 2),
    );
    expect(refilled?.remainingEntryCounts.reduce((sum, n) => sum + n, 0)).toBe(12);
    const offers = (rewardType: string, enteredBiomes: number) =>
      consumeCountedOffer(
        catalog.rewards,
        store,
        createRewardBagState(store, 'Underworld'),
        { rewardType },
        rewardFacts('Underworld', mature, enteredBiomes),
      ).length > 0;
    expect(offers('GiftDrop', 1)).toBe(true);
    expect(offers('MetaCurrencyDrop', 1)).toBe(true);
    expect(offers('MetaCurrencyDrop', 2)).toBe(false);
    expect(offers('MetaCurrencyBigDrop', 2)).toBe(true);
    expect(offers('MetaCardPointsCommonBigDrop', 2)).toBe(true);
  });

  it('crosses the fresh MetaProgress tiers through accumulated resource gains', () => {
    const store = catalog.rewards.stores.byKey.MetaProgress!;
    const bag = createRewardBagState(store, 'FreshFile');
    const offers = (history: RewardHistoryState, rewardType: string, enteredBiomes: number) =>
      consumeCountedOffer(
        catalog.rewards,
        store,
        bag,
        { rewardType },
        rewardFacts('FreshFile', history, enteredBiomes),
      ).length > 0;
    const closed = createRewardHistoryState(catalog.rewards, 'closed');
    expect(offers(closed, 'GiftDrop', 1)).toBe(false);
    expect(offers(closed, 'MetaCardPointsCommonDrop', 1)).toBe(true);
    expect(offers(closed, 'MetaCurrencyDrop', 1)).toBe(false);
    const afterAshes = creditResourceGains(closed, { MetaCardPointsCommon: 5 });
    expect(offers(afterAshes, 'MetaCurrencyDrop', 1)).toBe(true);
    expect(offers(afterAshes, 'MetaCurrencyDrop', 2)).toBe(true);
    expect(offers(afterAshes, 'MetaCardPointsCommonDrop', 2)).toBe(true);
    expect(offers(afterAshes, 'MetaCurrencyBigDrop', 2)).toBe(false);
    const highTier = creditResourceGains(afterAshes, {
      MetaCardPointsCommon: 95,
      MetaCurrency: 500,
    });
    expect(offers(highTier, 'MetaCurrencyBigDrop', 2)).toBe(true);
    expect(offers(highTier, 'MetaCardPointsCommonBigDrop', 2)).toBe(true);
    expect(offers(highTier, 'MetaCurrencyDrop', 2)).toBe(false);
    expect(offers(highTier, 'MetaCardPointsCommonDrop', 2)).toBe(false);
  });

  it('closes hammers, Hermes, Selene and Devotion in every room store', () => {
    const closed = createRewardHistoryState(catalog.rewards, 'closed');
    for (const store of catalog.rewards.stores.values)
      for (const entry of store.entries) {
        if (!['WeaponUpgrade', 'HermesUpgrade', 'SpellDrop', 'Devotion'].includes(entry.rewardType))
          continue;
        expect(
          evaluateRequirement(entry.requirement!, rewardFacts('FreshFile', closed).requirements),
        ).toBe(false);
        expect(JSON.stringify(entry.requirement)).toContain(notFreshFile);
      }
  });

  it('assesses the Tartarus resource slot as validly empty on Fresh File', () => {
    const profile = catalog.rewards.shops.byKey.I_WorldShop!;
    const slots = (routeKey: string) =>
      assessShopInventory(
        catalog.rewards,
        profile,
        profile.slots.values.map(() => null),
        rewardFacts(routeKey, createRewardHistoryState(catalog.rewards, 'closed'), 4),
      ).slots;
    expect(slots('FreshFile')[4]).toBe('validEmpty');
    expect(slots('Underworld')[4]).toBe('incomplete');
    const survival = profile.groups.byKey.Survival!.options;
    for (const key of ['ArmorBoost', 'ArmorBigBoost', 'LastStandDrop'])
      expect(JSON.stringify(survival.byKey[key]?.requirement)).toContain(notFreshFile);
    const world = catalog.rewards.shops.byKey.WorldShop!.groups;
    for (const [groupKey, optionKey] of [
      ['Boon', 'BlindBoxLoot'],
      ['Boon', 'ShopHermesUpgrade'],
      ['MajorNonBoon', 'WeaponUpgradeDropEarly'],
      ['MajorNonBoon', 'WeaponUpgradeDropLate'],
      ['MajorNonBoon', 'ArmorBoost'],
      ['MajorNonBoon', 'GiftDrop'],
      ['Minor', 'SpellDrop'],
    ] as const)
      expect(
        JSON.stringify(world.byKey[groupKey]?.options.byKey[optionKey]?.requirement),
      ).toContain(notFreshFile);
  });

  it('offers only Apollo, Poseidon and Demeter to a fresh profile', () => {
    const boon = catalog.rewards.rewardTypes.byKey.Boon!;
    const sources = (routeKey: string, history: RewardHistoryState) =>
      supportedPayloads(catalog.rewards, boon, rewardFacts(routeKey, history)).flatMap((payload) =>
        payload.kind === 'BoonSource' ? [payload.source] : [],
      );
    expect(
      sources('FreshFile', createRewardHistoryState(catalog.rewards, 'closed')).sort(),
    ).toEqual(['ApolloUpgrade', 'DemeterUpgrade', 'PoseidonUpgrade']);
    expect(sources('Underworld', createRewardHistoryState(catalog.rewards, 'mature'))).toEqual(
      expect.arrayContaining(['ZeusUpgrade', 'HeraUpgrade', 'AresUpgrade', 'HephaestusUpgrade']),
    );
  });

  it('never rolls the random boon exchange on Fresh File', () => {
    const fresh = createProjectDocument(catalog, {
      projectId: 'fresh',
      routeKey: 'FreshFile',
      configuredBiomeCount: 1,
    });
    const mature = createProjectDocument(catalog, { projectId: 'mature', routeKey: 'Underworld' });
    expect(boonReplacementChance(catalog, routeStartState(fresh))).toBe(0);
    expect(boonReplacementChance(catalog, routeStartState(mature))).toBe(0.1);
  });

  it('keeps every excluded god, store entry and tier out of a simulated fresh prefix', () => {
    // The mature F prefix re-homed onto the fresh profile, with its content made fresh-legal.
    const mature = JSON.parse(
      encodeProjectDocument(loadUnderworldGeneratedCompositionCheckpoint())
        .replaceAll('"MetaCurrencyDrop"', '"MetaCardPointsCommonDrop"')
        .replaceAll('"Zeus', '"Poseidon')
        .replaceAll('"Hera', '"Demeter'),
    );
    const [f] = mature.route.biomes;
    for (const occurrence of f.topology.occurrences) delete occurrence.startingRewardAcquisition;
    const freshDefaults = createProjectDocument(catalog, {
      projectId: 'fresh',
      routeKey: 'FreshFile',
      configuredBiomeCount: 1,
    });
    const project = decodeProjectDocument(
      {
        ...mature,
        route: {
          ...mature.route,
          routeKey: 'FreshFile',
          loadout: freshDefaults.route.loadout,
          resourcePlacements: freshDefaults.route.resourcePlacements,
          biomes: [f],
        },
      },
      catalog,
    );
    const biome = simulateProject(catalog, project).route.biomes[0]!;
    const snapshots: readonly RunStateSnapshot[] =
      'rewards' in biome ? (biome.rewards?.runStateSnapshots ?? []) : [];
    expect(snapshots.length).toBeGreaterThan(0);
    const excludedGods = ['ZeusUpgrade', 'HeraUpgrade', 'AresUpgrade', 'HephaestusUpgrade'];
    let crossed = false;
    for (const snapshot of snapshots) {
      expect(snapshot.godPool.effectiveSourceKeys).not.toEqual(
        expect.arrayContaining([expect.stringMatching(excludedGods.join('|'))]),
      );
      const meta = snapshot.bags.find((bag) => bag.storeKey === 'MetaProgress')!;
      const eligible = meta.entries.filter((entry) => entry.eligibility === 'eligible');
      const eligibleTypes = eligible.map((entry) => entry.rewardType);
      expect(eligibleTypes).not.toContain('GiftDrop');
      const ashes = snapshot.resourceGains.MetaCardPointsCommon ?? 0;
      if (snapshot.counters.enteredBiomes <= 1) {
        expect(eligibleTypes.includes('MetaCurrencyDrop')).toBe(ashes >= 5);
        if (ashes >= 5) crossed = true;
      }
      const run = snapshot.bags.find((bag) => bag.storeKey === 'RunProgress')!;
      for (const rewardType of ['WeaponUpgrade', 'HermesUpgrade', 'SpellDrop', 'Devotion'])
        expect(
          run.entries.filter(
            (entry) => entry.rewardType === rewardType && entry.eligibility === 'eligible',
          ),
        ).toEqual([]);
    }
    expect(crossed).toBe(true);
  });
});

describe('exhausted counted-store fallback', () => {
  function freshMetaBatch(secondOffer: string) {
    const biome = createBiomeAddress('FreshFile', 'F');
    let project = createProjectDocument(catalog, {
      projectId: 'fresh-fallback',
      routeKey: 'FreshFile',
      configuredBiomeCount: 1,
    });
    const batch = (
      parent: ReturnType<typeof createOccurrenceId>,
      storeKey: string,
      targets: readonly (readonly [string, string, string])[],
    ) => {
      const decision = createExitDecisionAddress(biome, {
        kind: 'occurrence',
        occurrenceId: parent,
      });
      project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(biome, decision.source),
        storeKey,
      });
      targets.forEach(([id, gameName, rewardType], index) => {
        project = applyProjectCommand(project, catalog, {
          kind: 'CreateTarget',
          target: createTargetAddress(biome, decision.source, `exit${index + 1}`),
          occurrenceId: createOccurrenceId(id),
          gameName,
        });
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(biome, createOccurrenceId(id)),
          value: { rewardType },
        });
      });
      if (targets.length > 1)
        project = applyProjectCommand(project, catalog, {
          kind: 'SetExitSelection',
          selection: createExitSelectionAddress(biome, decision.source),
          value: { kind: 'normal', exitKey: 'exit1' },
        });
    };
    batch(project.route.biomes[0]!.topology!.startOccurrenceId, 'RunProgress', [
      ['fresh-c1', 'F_Combat02', 'MaxHealthDrop'],
    ]);
    batch(createOccurrenceId('fresh-c1'), 'MetaProgress', [
      ['fresh-m1', 'F_Combat03', 'MetaCardPointsCommonDrop'],
      ['fresh-m2', 'F_Combat04', secondOffer],
    ]);
    return simulateProject(catalog, project);
  }

  it('resolves the second early Fresh MetaProgress door to Heal after two appended copies', () => {
    const evaluation = freshMetaBatch('RoomRewardHealDrop');
    expect(evaluation.findings.map((finding) => finding.code)).toEqual(['continuationMissing']);
    const biome = evaluation.route.biomes[0]!;
    const snapshots: readonly RunStateSnapshot[] =
      'rewards' in biome ? (biome.rewards?.runStateSnapshots ?? []) : [];
    const metaTotal = (ownerKey: string) => {
      const snapshot = snapshots.find((candidate) =>
        semanticAddressKey(candidate.owner).includes(ownerKey),
      );
      const remaining = snapshot?.bags.find((bag) => bag.storeKey === 'MetaProgress')?.remaining;
      return remaining?.kind === 'exact' ? remaining.count : undefined;
    };
    // 19 filled, one Ashes drawn, then two nineteen-entry copies appended.
    expect(metaTotal('"fresh-c1","roomEntered"')).toBe(19);
    expect(metaTotal('"fresh-m1","roomEntered"')).toBe(19 - 1 + 2 * 19);

    const other = freshMetaBatch('MetaCurrencyDrop');
    expect(other.findings.map((finding) => finding.code)).toContain('rewardBagSupportEmpty');
  });

  it('falls back on the third late Fresh MetaProgress peer below the high tier', () => {
    const store = catalog.rewards.stores.byKey.MetaProgress!;
    const history = creditResourceGains(createRewardHistoryState(catalog.rewards, 'closed'), {
      MetaCardPointsCommon: 8,
    });
    const facts = rewardFacts('FreshFile', history, 2);
    const peers = {
      priorOffers: [{ rewardType: 'MetaCurrencyDrop' }, { rewardType: 'MetaCardPointsCommonDrop' }],
    };
    const bag = createRewardBagState(store, 'FreshFile');
    expect(countedStoreExhausted(store, bag, facts, { peers })).toBe(true);
    const offer = (rewardType: string) =>
      consumeCountedOffer(catalog.rewards, store, bag, { rewardType }, facts, { peers });
    expect(offer('MetaCurrencyBigDrop')).toEqual([]);
    expect(offer('RoomRewardHealDrop')).toEqual([
      { remainingEntryCounts: store.entries.map(() => 3) },
    ]);
  });

  it('never reaches the fallback on a mature MetaProgress bag', () => {
    const store = catalog.rewards.stores.byKey.MetaProgress!;
    const mature = createRewardHistoryState(catalog.rewards, 'mature');
    for (const [enteredBiomes, priorOffers] of [
      [1, [{ rewardType: 'GiftDrop' }, { rewardType: 'MetaCurrencyDrop' }]],
      [2, [{ rewardType: 'GiftDrop' }, { rewardType: 'MetaCurrencyBigDrop' }]],
    ] as const) {
      const facts = rewardFacts('Underworld', mature, enteredBiomes);
      const bag = createRewardBagState(store, 'Underworld');
      expect(countedStoreExhausted(store, bag, facts, { peers: { priorOffers } })).toBe(false);
      expect(
        consumeCountedOffer(
          catalog.rewards,
          store,
          bag,
          { rewardType: 'RoomRewardHealDrop' },
          facts,
          {
            peers: { priorOffers },
          },
        ),
      ).toEqual([]);
    }
  });
});
