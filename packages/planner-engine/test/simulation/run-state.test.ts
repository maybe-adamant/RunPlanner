import { catalog } from '@run-planner/hades2-catalog';
import { simulateProject, type RunStateSnapshot } from '@run-planner/engine/simulation';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createJudgmentArcanaAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomRunStateCheckpointAddress,
  createRouteAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import {
  authorLegalTraitOffers,
  replaceTestRoomActionOrder,
} from '@run-planner/test-fixtures/shared';
import { authorSurfaceWorldShop } from '@run-planner/test-fixtures/surface';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenFStartId,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOProject,
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNProject,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createRewardHistoryState, type RewardKernelFacts } from '../../src/reward-kernel';
import { deriveRouteLoadout } from '../../src/authored-project/loadout';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { evaluateProgressiveBiome } from '../../src/simulation/progressive/biome';
import {
  aggregateDecisionRewardBag,
  createRunState,
  createRunStateDerivationCache,
} from '../../src/simulation/rewards/run-state';
import {
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitOfferEvent,
} from '../../src/simulation/traits';

function decisionSnapshots(snapshots: readonly RunStateSnapshot[]): readonly RunStateSnapshot[] {
  return snapshots.filter((snapshot) => snapshot.owner.kind !== 'roomRunStateCheckpoint');
}

function requirementFacts(ordinaryLootCount: number): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        encounterDepth: 0,
        enteredBiomes: 0,
        upgradableTraitCount: 0,
      },
      records: {
        biomeUseRecord: {},
        lootTypeHistory: ordinaryLootCount === 0 ? {} : { ApolloUpgrade: ordinaryLootCount },
        roomsEntered: {},
        useRecord: {},
      },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 0,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 0,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

describe('decision run-state snapshots', () => {
  it('keeps facts-derived caches local to one exact checkpoint context', () => {
    const history = createRewardHistoryState();
    const branch = Object.freeze({
      ...initializeTestRewardBranches()[0]!,
      history,
    });
    const sharedCache = createRunStateDerivationCache();
    const historyView = (sequence: number) => ({
      sequence,
      ledgers: {
        roomCreations: [],
        roomAppearances: [],
        encounterRecords: [],
        encounterStarts: [],
        encounterCompletions: [],
        enteredRewardStores: [],
        requiredObjectSpawns: [],
        requiredObjectCompletions: [],
        roomRestores: [],
        counters: {
          biomeDepthCache: sequence,
          biomeEncounterDepth: 0,
          routeEncounterDepth: 0,
          roomHistoryOrdinal: sequence,
        },
      },
    });
    const ownerA = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('run-state-cache-source-a'),
      ),
      { kind: 'roomEntered' },
    );
    const ownerB = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('run-state-cache-source-b'),
      ),
      { kind: 'roomEntered' },
    );
    const snapshot = (
      owner: typeof ownerA,
      view: ReturnType<typeof historyView>,
      facts: RewardKernelFacts,
      cached: boolean,
    ) =>
      createRunState({
        catalog,
        owner,
        historyView: view,
        branches: [branch],
        enteredBiomeCount: 1,
        rewardFacts: () => facts,
        ...(cached
          ? {
              derivationCache: sharedCache,
              factsContextToken: Object.freeze({ owner, view }),
            }
          : {}),
      });
    const viewA = historyView(1);
    const viewB = historyView(2);
    const factsA = requirementFacts(0);
    const factsB = requirementFacts(1);
    const uncachedA = snapshot(ownerA, viewA, factsA, false);
    const uncachedB = snapshot(ownerB, viewB, factsB, false);
    const cachedA = snapshot(ownerA, viewA, factsA, true);
    const cachedB = snapshot(ownerB, viewB, factsB, true);

    expect(cachedA).toEqual(uncachedA);
    expect(cachedB).toEqual(uncachedB);
    expect(cachedA?.godPool.acquiredSourceKeys).toEqual([]);
    expect(cachedB?.godPool.acquiredSourceKeys).toContain('ApolloUpgrade');
    expect(cachedA?.bags).not.toEqual(cachedB?.bags);
  });

  it('keeps derived Hex progress distinct when a shared cache sees the same history frontier', () => {
    const base = initializeTestRewardBranches()[0]!;
    const sharedCache = createRunStateDerivationCache();
    const owner = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('run-state-hex-cache'),
      ),
      { kind: 'roomEntered' },
    );
    const historyView = {
      sequence: 1,
      ledgers: {
        roomCreations: [],
        roomAppearances: [],
        encounterRecords: [],
        encounterStarts: [],
        encounterCompletions: [],
        enteredRewardStores: [],
        requiredObjectSpawns: [],
        requiredObjectCompletions: [],
        roomRestores: [],
        counters: {
          biomeDepthCache: 1,
          biomeEncounterDepth: 0,
          routeEncounterDepth: 0,
          roomHistoryOrdinal: 1,
        },
      },
    };
    const token = Object.freeze({ owner, historyView });
    const snapshot = (bankedPathPoints: number) =>
      createRunState({
        catalog,
        owner,
        historyView,
        branches: [
          Object.freeze({
            ...base,
            hexProgress: Object.freeze({ bankedPathPoints, investedPathPoints: 0 }),
          }),
        ],
        enteredBiomeCount: 1,
        rewardFacts: () => requirementFacts(0),
        derivationCache: sharedCache,
        factsContextToken: token,
      });
    expect(snapshot(2)?.hexProgress).toEqual({ bankedPathPoints: 2, investedPathPoints: 0 });
    expect(snapshot(5)?.hexProgress).toEqual({ bankedPathPoints: 5, investedPathPoints: 0 });
  });

  it('publishes distinct ordinary room-entry and pre-exit checkpoints', () => {
    const evaluation = simulateProject(catalog, createCompleteFGProject());
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('F did not evaluate validly');
    }
    const room = biome.snapshot.entryRoom;
    const history = biome.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
    );
    const entryOwner = createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' });
    const exitOwner = createRoomRunStateCheckpointAddress(room.origin, {
      kind: 'beforeRoomExit',
    });
    const entry = biome.rewards.runStateSnapshots.find(
      (snapshot) => semanticAddressKey(snapshot.owner) === semanticAddressKey(entryOwner),
    );
    const exit = biome.rewards.runStateSnapshots.find(
      (snapshot) => semanticAddressKey(snapshot.owner) === semanticAddressKey(exitOwner),
    );
    expect(entry).toMatchObject({
      checkpoint: 'roomEntered',
      historySequence: history?.entry.sequence,
    });
    expect(exit).toMatchObject({
      checkpoint: 'beforeRoomExit',
      historySequence: history?.postCommit.sequence,
    });
    expect(entry?.historySequence).toBeLessThan(exit?.historySequence ?? 0);
  });

  it('publishes Ship pre-start checkpoints from exact phase views without a room-entry owner', () => {
    const evaluation = simulateProject(catalog, loadSurfaceNOProject());
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('O did not evaluate validly');
    }
    const room = biome.snapshot.decisions
      .flatMap((decision) => (decision.kind === 'batch' ? decision.targets : []))
      .map((target) => target.room)
      .find((candidate) => candidate.occurrenceId === oOccurrenceIds.combat04);
    if (room === undefined) throw new Error('O Combat04 is missing');
    const history = biome.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
    );
    const phaseSnapshots = biome.rewards.runStateSnapshots.filter(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.occurrenceId === room.occurrenceId &&
        snapshot.owner.checkpoint.kind === 'beforeEncounterStart',
    );
    expect(phaseSnapshots.map((snapshot) => snapshot.owner)).toEqual(
      room.encounterPhases.map((phase) =>
        createRoomRunStateCheckpointAddress(room.origin, {
          kind: 'beforeEncounterStart',
          phaseKey: phase.slotKey,
        }),
      ),
    );
    expect(phaseSnapshots.map((snapshot) => snapshot.historySequence)).toEqual(
      history?.encounterStarts.map((phase) => phase.before.sequence),
    );
    expect(
      biome.rewards.runStateSnapshots.some(
        (snapshot) =>
          snapshot.owner.kind === 'roomRunStateCheckpoint' &&
          snapshot.owner.occurrenceId === room.occurrenceId &&
          snapshot.owner.checkpoint.kind === 'roomEntered',
      ),
    ).toBe(false);
    const wheel1 = history?.offerPoints?.find((offer) => offer.offerPoint === 'wheel1');
    const combat1 = phaseSnapshots.find(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.checkpoint.kind === 'beforeEncounterStart' &&
        snapshot.owner.checkpoint.phaseKey === 'Combat1',
    );
    expect(combat1?.historySequence).toBeGreaterThanOrEqual(wheel1?.after.sequence ?? 0);
    expect(combat1?.historySequence).toBeLessThan(wheel1?.acquisitionBefore?.sequence ?? Infinity);
  });

  it('publishes snapshots for reached F decisions', () => {
    const evaluation = simulateProject(catalog, createCompleteFGProject());
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (biome?.authoring !== 'complete') throw new Error('F did not evaluate');
    expect(biome.validity).toBe('valid');
    const decisions = decisionSnapshots(biome.rewards.runStateSnapshots);
    expect(decisions).toHaveLength(11);
    const first = decisions[0]!;
    const runProgress = first.bags.find((bag) => bag.storeKey === 'RunProgress')!;
    expect(runProgress.entries.find((entry) => entry.rewardType === 'Boon')).toMatchObject({
      eligibility: 'eligible',
      remaining: { kind: 'exact', count: 3 },
    });
    const hubBag = first.bags.find((bag) => bag.storeKey === 'HubRewards')!;
    const hubDeclaration = catalog.rewards.stores.byKey.HubRewards!;
    expect(
      hubBag.entries.reduce(
        (total, entry) =>
          total + (entry.remaining.kind === 'exact' ? entry.remaining.count : entry.remaining.max),
        0,
      ),
    ).toBe(hubDeclaration.entries.length);
    expect(biome.rewards.branches[0]?.bags.HubRewards).toBeUndefined();
  });

  it('publishes every outer N decision while excluding Hub visits', () => {
    const evaluation = simulateProject(catalog, loadSurfaceNProject());
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('N did not evaluate validly');
    }
    const decisions = decisionSnapshots(biome.rewards.runStateSnapshots);
    expect(decisions).toHaveLength(3);
    expect(decisions.map((snapshot) => snapshot.owner)).toEqual(
      biome.snapshot.decisions.map((decision) => decision.origin),
    );
    const [beforePreHub, beforeHub, beforePreboss] = decisions;
    expect(beforePreHub?.owner.kind).toBe('exitDecision');
    expect(beforeHub?.owner.kind).toBe('hubDecision');
    expect(beforePreboss?.owner.kind).toBe('exitDecision');
    if (beforePreboss?.owner.kind !== 'exitDecision') throw new Error('missing Preboss snapshot');
    expect(beforePreboss.owner.source).toEqual({ kind: 'hubDecision', decisionKey: 'hub' });
    const prebossCreation = biome.history.events.find(
      (event) =>
        event.kind === 'roomCreated' &&
        event.source === 'generatedTarget' &&
        event.gameName === 'N_PreBoss01',
    );
    if (prebossCreation?.kind !== 'roomCreated') throw new Error('missing Preboss generation');
    expect(beforePreboss.historySequence).toBe(prebossCreation.sequence - 1);
    expect(beforePreboss.counters).toMatchObject({
      numSubRoomsSpawned: 6,
      soulPylonsSpawned: 6,
      soulPylonsCompleted: 6,
    });
    expect(beforePreboss.traits.upgradableTraitCount).toBe(5);
  });

  it('publishes the reached N Preboss frontier before its handoff is authored', () => {
    const evaluation = simulateProject(catalog, loadSurfaceNCompleteHubFrontierProject());
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (biome?.authoring !== 'incomplete' || !('rewards' in biome)) {
      throw new Error('N frontier did not remain incomplete');
    }
    const decisions = decisionSnapshots(biome.rewards.runStateSnapshots);
    expect(decisions).toHaveLength(3);
    const beforePreboss = decisions[2];
    expect(beforePreboss?.owner).toMatchObject({
      kind: 'exitDecision',
      source: { kind: 'hubDecision', decisionKey: 'hub' },
    });
    expect(
      biome.rewards.runStateAvailability.filter(
        (availability) => availability.owner.kind !== 'roomRunStateCheckpoint',
      ),
    ).toHaveLength(3);
    expect(biome.rewards.runStateAvailability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ owner: beforePreboss?.owner, availability: 'available' }),
      ]),
    );
  });

  it('keeps N main and side pre-exit checkpoints chronological without restore duplicates', () => {
    const evaluation = simulateProject(catalog, loadSurfaceNProject());
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('N did not evaluate validly');
    }
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    const visit =
      hub?.kind === 'hub'
        ? hub.visits.find((candidate) => candidate.enteredLocalRooms.length > 0)
        : undefined;
    const main = visit?.target.room;
    const side = visit?.enteredLocalRooms[0];
    if (main === undefined || side === undefined)
      throw new Error('N fixture has no entered side room');
    const checkpoints = biome.rewards.runStateSnapshots.filter(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.checkpoint.kind === 'beforeRoomExit',
    );
    const mainSnapshots = checkpoints.filter(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.occurrenceId === main.occurrenceId,
    );
    const sideSnapshots = checkpoints.filter(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.occurrenceId === side.occurrenceId,
    );
    expect(mainSnapshots).toHaveLength(1);
    expect(sideSnapshots).toHaveLength(1);
    expect(mainSnapshots[0]!.historySequence).toBeLessThan(sideSnapshots[0]!.historySequence);
    expect(
      biome.history.ledgers.roomRestores.filter(
        (restore) => semanticAddressKey(restore.origin) === semanticAddressKey(main.origin),
      ).length,
    ).toBeGreaterThan(0);
  });

  it('captures the literal Shop pre-exit checkpoint after final settlement', () => {
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
      gameName: 'O_Shop01',
    });
    project = authorLegalTraitOffers(
      replaceTestRoomActionOrder(
        authorSurfaceWorldShop(project, oBiome, oOccurrenceIds.devotion),
        catalog,
        oBiome,
        oOccurrenceIds.devotion,
        [{ kind: 'interactShopOffer', offerKey: 'Boon' }],
      ),
    );
    const biome = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('O Shop fixture did not evaluate validly');
    }
    const generationOwner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.devotion,
    });
    const exitOwner = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
      { kind: 'beforeRoomExit' },
    );
    const generation = biome.rewards.runStateSnapshots.find(
      (snapshot) => semanticAddressKey(snapshot.owner) === semanticAddressKey(generationOwner),
    );
    const exit = biome.rewards.runStateSnapshots.find(
      (snapshot) => semanticAddressKey(snapshot.owner) === semanticAddressKey(exitOwner),
    );
    expect(generation?.checkpoint).toBe('beforeTargetGeneration');
    expect(exit?.checkpoint).toBe('beforeRoomExit');
    expect(exit?.historySequence).toBeGreaterThan(generation?.historySequence ?? 0);
    const settledShopAcquisitions = biome.rewards.branches.flatMap((branch) =>
      branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          event.settlement?.site.owner.kind === 'occurrence' &&
          event.settlement.site.owner.occurrenceId === oOccurrenceIds.devotion,
      ),
    );
    expect(settledShopAcquisitions.length).toBeGreaterThan(0);
    expect(
      Math.max(...settledShopAcquisitions.map((event) => event.historySequence)),
    ).toBeLessThanOrEqual(exit?.historySequence ?? -1);
    expect(exit?.traits.upgradableTraitCount).toBeGreaterThan(
      generation?.traits.upgradableTraitCount ?? -1,
    );
  });

  it('publishes unavailable outer decisions from an incomplete clamped prefix', () => {
    const biomeAddress = createBiomeAddress('Underworld', 'F');
    const missingLaterDecision = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(biomeAddress, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(9, 1),
      }),
    });
    const project = applyProjectCommand(missingLaterDecision, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biomeAddress, goldenFOccurrenceId(1, 1)),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
    const biome = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (biome?.authoring !== 'incomplete' || !('materializedPrefix' in biome)) {
      throw new Error('expected incomplete F prefix');
    }
    const laterOwner = createExitDecisionAddress(biomeAddress, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(2, 1),
    });
    expect(biome.rewards.runStateAvailability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: laterOwner,
          availability: 'unavailable',
          reason: 'coverageNotReached',
        }),
      ]),
    );
    const retainedRoomOwner = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(biomeAddress, goldenFOccurrenceId(2, 1)),
      { kind: 'roomEntered' },
    );
    expect(biome.rewards.runStateAvailability).toContainEqual({
      owner: retainedRoomOwner,
      availability: 'unavailable',
      reason: 'coverageNotReached',
    });
    const absentOwner = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(biomeAddress, createOccurrenceId('absent-run-state-room')),
      { kind: 'roomEntered' },
    );
    expect(
      biome.rewards.runStateAvailability.some(
        (availability) =>
          semanticAddressKey(availability.owner) === semanticAddressKey(absentOwner),
      ),
    ).toBe(false);
  });

  it('keeps a decision pre-state stable for current edits but recomputes after upstream edits', () => {
    const base = createCompleteFGProject();
    const biomeAddress = createBiomeAddress('Underworld', 'F');
    const currentEdit = applyProjectCommand(base, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biomeAddress, goldenFOccurrenceId(1, 1)),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    const upstreamEdit = applyProjectCommand(base, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biomeAddress, goldenFStartId),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const firstF = (project: typeof base) => {
      const biome = simulateProject(catalog, project)
        .routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((candidate) => candidate.biomeKey === 'F');
      if (biome?.authoring !== 'complete') throw new Error('F did not evaluate');
      return biome.rewards.runStateSnapshots[0];
    };
    expect(firstF(currentEdit)).toEqual(firstF(base));
    expect(firstF(upstreamEdit)).not.toEqual(firstF(base));
  });

  it('stops later snapshots at an invalid upstream reward while keeping the boundary snapshot', () => {
    const biomeAddress = createBiomeAddress('Underworld', 'F');
    const target = goldenFOccurrenceId(1, 1);
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biomeAddress, target),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
    const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
    if (plan === undefined) throw new Error('missing F plan');
    const progressive = evaluateProgressiveBiome(catalog, biomeAddress, plan, {
      enteredBiomeCount: 1,
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: project.routes.find((route) => route.routeKey === 'Underworld')!.loadout,
    });
    const decisions = decisionSnapshots(progressive?.rewards.runStateSnapshots ?? []);
    expect(decisions).toHaveLength(1);
    expect(
      (progressive?.rewards.runStateSnapshots ?? []).flatMap((snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' ? [snapshot.owner.occurrenceId] : [],
      ),
    ).toEqual([goldenFStartId]);
    const owner = decisions[0]?.owner;
    expect(owner?.kind).toBe('exitDecision');
    if (owner?.kind !== 'exitDecision') throw new Error('missing exit decision owner');
    expect(owner.source).toEqual({
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const laterOwner = createExitDecisionAddress(biomeAddress, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(2, 1),
    });
    expect(
      progressive?.rewards.runStateSnapshots.some(
        (snapshot) => semanticAddressKey(snapshot.owner) === semanticAddressKey(laterOwner),
      ),
    ).toBe(false);
  });

  it('publishes complete-invalid snapshots only through progressive coverage', () => {
    const biomeAddress = createBiomeAddress('Underworld', 'F');
    const route = createRouteAddress('Underworld');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: ['ChanneledCast'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biomeAddress, goldenFOccurrenceId(1, 1)),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
    const biome = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (biome?.authoring !== 'complete' || biome.validity !== 'invalid') {
      throw new Error('expected complete-invalid F evaluation');
    }
    expect(biome.coverage).toMatchObject({
      kind: 'prefix',
      blockedAt: createIncomingRewardAddress(biomeAddress, goldenFOccurrenceId(1, 1)),
    });
    expect('snapshot' in biome).toBe(false);
    const decisions = decisionSnapshots(biome.rewards.runStateSnapshots);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.arcanaFear.arcana.active).toContainEqual(
      expect.objectContaining({ key: 'ChanneledCast', origin: 'manual', rarity: 'Epic' }),
    );
    expect(decisions[0]?.arcanaFear.fear).toMatchObject({
      configuredTotal: 3,
      effectiveRanks: { EnemyDamageShrineUpgrade: 2 },
    });
    expect(biome.rewards.runStateAvailability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ availability: 'available' }),
        expect.objectContaining({ availability: 'unavailable', reason: 'coverageNotReached' }),
      ]),
    );
    expect(
      biome.rewards.runStateAvailability.filter(
        (entry) =>
          entry.owner.kind !== 'roomRunStateCheckpoint' && entry.availability === 'available',
      ),
    ).toHaveLength(1);
    const laterOwner = createExitDecisionAddress(biomeAddress, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(2, 1),
    });
    expect(biome.rewards.runStateAvailability).toContainEqual(
      expect.objectContaining({
        owner: laterOwner,
        availability: 'unavailable',
        reason: 'coverageNotReached',
      }),
    );
  });

  it('seeds Arcana/Fear at F, retains it in public branches and G, and snapshots the exact pre-decision state', () => {
    const route = createRouteAddress('Underworld');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: ['ChanneledCast'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 2,
    });
    const active = deriveRouteLoadout(
      catalog,
      project.routes.find((candidate) => candidate.routeKey === 'Underworld')!.loadout,
    ).activeArcanaKeys;
    const fJudgment = catalog.arcanaCards.values
      .filter((card) => !active.includes(card.key))
      .slice(0, 5)
      .map((card) => card.key);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceJudgmentArcana',
      judgment: createJudgmentArcanaAddress(
        createOccurrenceAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-preboss-shop:boss'),
        ),
        'Encounter',
      ),
      arcanaKeys: fJudgment,
    });
    const gJudgment = catalog.arcanaCards.values
      .filter((card) => !active.includes(card.key) && !fJudgment.includes(card.key))
      .slice(0, 5)
      .map((card) => card.key);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceJudgmentArcana',
      judgment: createJudgmentArcanaAddress(
        createOccurrenceAddress(
          createBiomeAddress('Underworld', 'G'),
          createOccurrenceId('golden-g-preboss-shop:boss'),
        ),
        'Encounter',
      ),
      arcanaKeys: gJudgment,
    });
    const evaluation = simulateProject(catalog, project).routes.find(
      (entry) => entry.routeKey === 'Underworld',
    );
    const f = evaluation?.biomes.find((biome) => biome.biomeKey === 'F');
    const g = evaluation?.biomes.find((biome) => biome.biomeKey === 'G');
    if (
      f?.authoring !== 'complete' ||
      g?.authoring !== 'complete' ||
      f.validity !== 'valid' ||
      g.validity !== 'valid'
    )
      throw new Error('expected valid FG route');
    const expected = f.rewards.branches[0]?.arcanaFear;
    const fSnapshot = f.rewards.runStateSnapshots[0];
    const gSnapshot = g.rewards.runStateSnapshots[0];
    expect(expected).toBeDefined();
    // Judgment evolves state after F's Boss completion; F's decision snapshots
    // remain its exact pre-decision state while G sees the completed draw.
    expect(fSnapshot?.arcanaFear.arcana.active).not.toEqual(expected?.arcana.active);
    expect(gSnapshot?.arcanaFear).toEqual(expected);
    expect(expected?.arcana.active).toContainEqual(
      expect.objectContaining({ key: 'ChanneledCast', origin: 'manual', rarity: 'Epic' }),
    );
    expect(expected?.fear).toMatchObject({
      configuredTotal: 3,
      effectiveRanks: { EnemyDamageShrineUpgrade: 2 },
    });
  });

  it('publishes encounter-blocked decision availability through the canonical frontier', () => {
    const project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
      encounterCount: 3,
    });
    const biome = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (biome?.authoring !== 'complete' || biome.validity !== 'invalid') {
      throw new Error('expected complete encounter-blocked O evaluation');
    }
    expect(biome.coverage.kind).toBe('prefix');
    expect(biome.rewards.runStateAvailability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ availability: 'available' }),
        expect.objectContaining({ availability: 'unavailable', reason: 'coverageNotReached' }),
      ]),
    );
  });

  it('consolidates correlated branch bag totals before deriving ranges', () => {
    const store = catalog.rewards.stores.byKey.RunProgress!;
    const firstTwoOnly = (base: number, qualified: number) =>
      Object.freeze([base, qualified, ...store.entries.slice(2).map(() => 0)]);
    const bag = aggregateDecisionRewardBag(
      store,
      [
        { bags: { RunProgress: { remainingEntryCounts: firstTwoOnly(0, 1) } } },
        { bags: { RunProgress: { remainingEntryCounts: firstTwoOnly(1, 0) } } },
      ],
      [requirementFacts(1), requirementFacts(0)],
    );
    expect(bag.remaining).toEqual({ kind: 'exact', count: 1 });
    expect(bag.entries).toContainEqual(
      expect.objectContaining({
        rewardType: 'MaxHealthDrop',
        eligibility: 'eligible',
        remaining: { kind: 'exact', count: 1 },
        conditions: expect.arrayContaining([
          expect.objectContaining({ remaining: { kind: 'range', min: 0, max: 1 } }),
        ]),
      }),
    );
  });

  it('retains offer-time depletion and transitions Hammer eligibility at the declared boundary', () => {
    const f = simulateProject(catalog, createCompleteFGProject())
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    const h = simulateProject(catalog, createGoldenFGHProject())
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H');
    if (f?.authoring !== 'complete' || h?.authoring !== 'complete') {
      throw new Error('expected complete F and H fixtures');
    }
    const runEntries = (
      snapshot: (typeof f.rewards.runStateSnapshots)[number],
      rewardType: string,
    ) =>
      snapshot.bags
        .find((bag) => bag.storeKey === 'RunProgress')!
        .entries.filter((entry) => entry.rewardType === rewardType);
    expect(runEntries(f.rewards.runStateSnapshots[1]!, 'MaxHealthDrop')[0]?.remaining).toEqual({
      kind: 'exact',
      count: 2,
    });
    // F batch 2 offers the unpicked peer's MaxHealthDrop at generation time.
    expect(runEntries(f.rewards.runStateSnapshots[2]!, 'MaxHealthDrop')[0]?.remaining).toEqual({
      kind: 'exact',
      count: 1,
    });
    expect(
      runEntries(f.rewards.runStateSnapshots[0]!, 'WeaponUpgrade').map(
        (entry) => entry.eligibility,
      ),
    ).toEqual(['eligible', 'ineligible']);
    expect(
      runEntries(h.rewards.runStateSnapshots[0]!, 'WeaponUpgrade').map(
        (entry) => entry.eligibility,
      ),
    ).toEqual(['ineligible', 'eligible']);
  });

  it('narrows the God pool at four distinct acquired ordinary sources', () => {
    const history = Object.freeze({
      ...createRewardHistoryState(),
      lootTypeHistory: Object.freeze({
        ApolloUpgrade: 1,
        PoseidonUpgrade: 1,
        HestiaUpgrade: 1,
        ZeusUpgrade: 1,
      }),
    });
    const branch = Object.freeze({
      ...initializeTestRewardBranches()[0]!,
      history,
    });
    const snapshot = createRunState({
      catalog,
      owner: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      historyView: {
        sequence: 0,
        ledgers: {
          roomCreations: [],
          roomAppearances: [],
          encounterRecords: [],
          encounterStarts: [],
          encounterCompletions: [],
          enteredRewardStores: [],
          requiredObjectSpawns: [],
          requiredObjectCompletions: [],
          roomRestores: [],
          counters: {
            biomeDepthCache: 0,
            biomeEncounterDepth: 0,
            routeEncounterDepth: 0,
            roomHistoryOrdinal: 0,
          },
        },
      },
      branches: [branch],
      enteredBiomeCount: 1,
      rewardFacts: () => {
        const facts = requirementFacts(0);
        return {
          kind: 'traitOffer',
          requirements: {
            ...facts.requirements,
            records: { ...facts.requirements.records, lootTypeHistory: history.lootTypeHistory },
          },
        };
      },
    });
    const pool = snapshot?.godPool;
    expect(pool?.acquiredSourceKeys).toEqual(
      expect.arrayContaining(['ApolloUpgrade', 'PoseidonUpgrade', 'HestiaUpgrade', 'ZeusUpgrade']),
    );
    expect(pool).toMatchObject({ capNarrowed: true });
  });

  it('copies Proper Upbringing elements and rarity floor from the chronological trait fold', () => {
    const owner = createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const entries: readonly (readonly [giverKey: string, traitKey: string])[] = [
      ['Hera', 'HeraWeaponBoon'],
      ['Poseidon', 'PoseidonWeaponBoon'],
      ['Hera', 'HeraCastBoon'],
      ['Zeus', 'ZeusWeaponBoon'],
      ['Hera', 'HeraSprintBoon'],
      ['Hestia', 'HestiaWeaponBoon'],
      ['Hera', 'HeraManaBoon'],
      ['Demeter', 'DemeterManaBoon'],
      ['Hera', 'ElementalRarityUpgradeBoon'],
    ];
    const traits = foldTraitHistoryEvents(
      catalog,
      entries.map(([giverKey, traitKey], index) => {
        const giver = catalog.traitGivers.byKey[giverKey]!;
        return {
          kind: 'traitOffer',
          owner,
          acquisitionRole: `trait-${index + 1}`,
          sequence: index + 1,
          giverKey,
          options: Object.freeze([
            { traitKey, rarity: 'Common' },
            { traitKey: giver.traitKeys[0]!, rarity: 'Common' },
            { traitKey: giver.traitKeys[1]!, rarity: 'Common' },
          ]) as TraitOfferEvent['options'],
          selectedOptionKey: 'option1',
          acquisitionPoint: 'run-state-test',
        } satisfies TraitOfferEvent;
      }),
    );
    const branch = Object.freeze({
      ...initializeTestRewardBranches()[0]!,
      history: attachTraitHistory(createRewardHistoryState(), traits),
      traitHistory: traits,
    });
    const snapshot = createRunState({
      catalog,
      owner,
      historyView: {
        sequence: traits.events.length,
        ledgers: {
          roomCreations: [],
          roomAppearances: [],
          encounterRecords: [],
          encounterStarts: [],
          encounterCompletions: [],
          enteredRewardStores: [],
          requiredObjectSpawns: [],
          requiredObjectCompletions: [],
          roomRestores: [],
          counters: {
            biomeDepthCache: 0,
            biomeEncounterDepth: 0,
            routeEncounterDepth: 0,
            roomHistoryOrdinal: 0,
          },
        },
      },
      branches: [branch],
      enteredBiomeCount: 1,
      rewardFacts: () => requirementFacts(0),
    });
    expect(snapshot?.traits.elementCounts).toEqual({
      Aether: 0,
      Earth: 2,
      Air: 2,
      Fire: 2,
      Water: 2,
    });
    expect(snapshot?.traits.properUpbringingActive).toBe(true);
    expect(snapshot?.counters.upgradableTraitCount).toBe(traits.upgradableTraitCount);
  });
});
