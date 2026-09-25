import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  roomActionKey,
  semanticAddressKey,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { simulateProject } from '../../src/simulation';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';
import {
  advanceChaosClock,
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitHistoryState,
} from '../../src/simulation/traits';
import {
  normalizeAuthoredChaosTraitOffer,
  type AuthoredTraitOffer,
} from '../../src/authored-project/traits/state';
import type { ProjectDocument } from '../../src/authored-project/model';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import type { RewardBranch } from '../../src/simulation/rewards';
import { ordinaryRoutePosition } from '../support/route-position';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  biome as shopBiome,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  echoGoldHistory,
  echoGoldShop,
  initializeTestRewardBranches,
  pomTargetHistory,
  shopBoonReward,
  shopId,
  shopPomReward,
  selectedTraitOfferProducts,
} from './shop-trait-purchase-support';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits/state';
import { createKeepsakeState } from '../../src/simulation/keepsakes/state';
import {
  advanceSteadyGrowthProgress,
  settleSteadyGrowthThreshold,
  traitOfferContextIdentity,
} from '../../src/simulation/traits';
import {
  applyTraitOfferContextTransition,
  spawnPendingTraitOffers,
  traitOfferGenerationState,
} from '../../src/simulation/state/pending-trait-offers';
import {
  mergeEquivalentRewardBranches,
  type RewardBranchState,
} from '../../src/simulation/rewards/branch-primitives';
import { applyEncounterEndEffectsTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import { applyEncounterStartedTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/encounter-started';
import { applyEncounterSettlementTransition } from '../../src/simulation/rewards/biome/encounter-acquisition/encounter-settlement';
import { materializeAuthoredRoom } from '../../src/simulation/materialization/rooms/assemble';
import type { HistoryEvent } from '../../src/simulation/history';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';

const underworldH = createBiomeAddress('Underworld', 'H');
const combat09 = createOccurrenceId('golden-h-combat09');
const hermesCage = createTraitOfferAddress(
  createLocalRewardAddress(underworldH, combat09, 'cages', 'cage1'),
  'self',
);
const minibossBoon = createTraitOfferAddress(
  createIncomingRewardAddress(underworldH, createOccurrenceId('golden-h-miniboss01')),
  'source',
);
const nextRoomBoon = createTraitOfferAddress(
  createLocalRewardAddress(underworldH, createOccurrenceId('golden-h-combat05'), 'cages', 'cage3'),
  'source',
);

/** One real authored Chaos pair whose encounter-counted curse has `remaining` uses left. */
function withMaturingCurse(
  history: TraitHistoryState,
  blessingKey: 'ChaosRarityBlessing' | 'ChaosElementalBlessing',
  remaining: number,
  sequence: number,
): TraitHistoryState {
  const curse = catalog.chaos.curses.byKey.ChaosNoMoneyCurse!;
  const blessing = catalog.chaos.blessings.byKey[blessingKey]!;
  const requirementCount = Math.max(curse.duration.minimum, remaining);
  if (requirementCount > curse.duration.maximum) throw new Error('curse cannot last that long');
  const offer = normalizeAuthoredChaosTraitOffer(catalog, {
    kind: 'chaos',
    giverKey: 'Chaos',
    curseOptions: [
      { curseKey: curse.key, requirementCount },
      { curseKey: curse.key, requirementCount },
      { curseKey: curse.key, requirementCount },
    ],
    selectedOptionKey: 'option1',
    selectedCurseValues: Object.fromEntries(curse.operands.map((o) => [o.key, o.minimum])),
    blessingKey,
    rarity: 'Common',
    blessingValues: Object.fromEntries(
      blessing.operands.map((o) => [o.key, o.byRarity?.Common?.minimum ?? o.minimum]),
    ),
  });
  let next = foldTraitHistoryEvents(catalog, [
    ...history.events,
    Object.freeze({
      kind: 'chaosPair' as const,
      owner: createBiomeAddress('Underworld', 'G'),
      acquisitionRole: 'self',
      sequence,
      acquisitionPoint: 'reward',
      acquisitionIdentity: `seed:${blessingKey}`,
      offer,
    }),
  ]);
  for (let used = remaining; used < requirementCount; used += 1)
    next = advanceChaosClock(catalog, next, sequence, 'encounters');
  return next;
}

function withHistory(branch: RewardBranch, history: TraitHistoryState): RewardBranch {
  return Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      traitHistory: history,
      rewardHistory: attachTraitHistory(branch.state.rewardHistory, history),
    }),
  });
}

interface BiomeFixture {
  readonly pristine: () => ProjectDocument;
  readonly routeKey: 'Underworld' | 'Surface';
  readonly previousKey: string;
  readonly biomeKey: string;
}
const fieldsFixture: BiomeFixture = {
  pristine: createGoldenFGHProject,
  routeKey: 'Underworld',
  previousKey: 'G',
  biomeKey: 'H',
};
const shipFixture: BiomeFixture = {
  pristine: loadSurfaceNOProject,
  routeKey: 'Surface',
  previousKey: 'N',
  biomeKey: 'O',
};

/**
 * Evaluates one fixture biome through the product path from its predecessor's
 * completed branches. The seed only adds run history the route did not acquire.
 */
function evaluateBiome(
  fixture: BiomeFixture,
  project: ProjectDocument,
  seed: (branch: RewardBranch) => RewardBranch = (branch) => branch,
) {
  const route = project.route!;
  const previous = simulateProject(catalog, fixture.pristine()).route?.biomes.find(
    (candidate) => candidate.biomeKey === fixture.previousKey,
  );
  const plan = route.biomes.find((candidate) => candidate.biomeKey === fixture.biomeKey);
  if (previous?.authoring !== 'complete' || previous.validity !== 'valid' || plan === undefined)
    throw new Error('expected a complete-valid seed and an authored biome');
  const progressive = evaluateProgressiveBiomeAssembly(
    catalog,
    createBiomeAddress(fixture.routeKey, fixture.biomeKey),
    plan,
    {
      routePosition: ordinaryRoutePosition(catalog, fixture.routeKey, fixture.biomeKey),
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: route.loadout,
      seed: { history: previous.history, rewardBranches: previous.rewards.branches.map(seed) },
    },
  );
  if (progressive === null) throw new Error('biome did not publish a progressive assembly');
  const rewards = progressive.evaluation.rewards;
  if (rewards === undefined) throw new Error('biome published no reward assessment');
  return Object.freeze({ rewards, artifacts: progressive.candidateArtifacts });
}

function evaluateH(
  project: ProjectDocument,
  seed?: (branch: RewardBranch) => RewardBranch,
): ReturnType<typeof evaluateBiome> {
  return evaluateBiome(fieldsFixture, project, seed);
}

/** The ordinal (1-based) of a phase's end effects; room edits here never move encounters. */
function encounterEndOrdinal(
  occurrenceId: string,
  phaseKey: string,
  fixture: BiomeFixture = fieldsFixture,
): number {
  const biome = simulateProject(catalog, fixture.pristine()).route?.biomes.find(
    (candidate) => candidate.biomeKey === fixture.biomeKey,
  );
  if (biome?.authoring !== 'complete') throw new Error('incomplete fixture');
  const ends = biome.history.events.filter((event) => event.kind === 'encounterEndEffectsApplied');
  const index = ends.findIndex(
    (event) =>
      event.origin.kind === 'occurrence' &&
      event.origin.occurrenceId === occurrenceId &&
      event.kind === 'encounterEndEffectsApplied' &&
      event.phaseKey === phaseKey,
  );
  if (index < 0) throw new Error(`no ${occurrenceId} ${phaseKey} end effects`);
  return index + 1;
}

function lastSequence(branch: RewardBranch): number {
  return Math.max(0, ...branch.state.traitHistory.events.map((event) => event.sequence));
}

/** Seeds a Chaos curse whose blessing matures at one exact encounter end in the biome. */
function curseMaturingAt(
  occurrenceId: string,
  phaseKey: string,
  blessingKey: 'ChaosRarityBlessing' | 'ChaosElementalBlessing' = 'ChaosRarityBlessing',
  fixture: BiomeFixture = fieldsFixture,
) {
  const remaining = encounterEndOrdinal(occurrenceId, phaseKey, fixture);
  return (branch: RewardBranch) =>
    withHistory(
      branch,
      withMaturingCurse(branch.state.traitHistory, blessingKey, remaining, lastSequence(branch)),
    );
}

function maturedBeforeBiome(branch: RewardBranch): RewardBranch {
  return withHistory(
    branch,
    withMaturingCurse(branch.state.traitHistory, 'ChaosRarityBlessing', 0, lastSequence(branch)),
  );
}

/** Rare chance the offer's options were rolled with, per reached branch. */
function rareChance(
  evaluation: ReturnType<typeof evaluateBiome>,
  address: TraitOfferAddress,
): readonly number[] {
  const offer = evaluation.rewards.selectedTraitOffers.find(
    (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(address),
  );
  const capability = evaluation.artifacts.traitOffers.at(address);
  if (offer === undefined || capability === undefined) throw new Error('offer was not reached');
  return capability.evaluateOffer(offer.offer).map((branch) => {
    const rarity = branch.offerGenerationState?.rarity;
    if (rarity?.kind !== 'orderedChecks') throw new Error('offer has no rolled rarity');
    return rarity.values.Rare;
  });
}

/** Moves one Fields cage pickup to an explicit position in the room's action order. */
function moveCagePickup(project: ProjectDocument, slotKey: string, toIndex: number) {
  return applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: createRoomActionAddress(
      underworldH,
      combat09,
      roomActionKey({ kind: 'interactLocalReward', groupKey: 'cages', slotKey }),
    ),
    toIndex,
  });
}

// Room action order in golden-h-combat09 is: Cage02, cage2 pickup (a hammer),
// Cage01, cage1 pickup (a Hermes boon).
const hermesBeforeHammer = () => moveCagePickup(createGoldenFGHProject(), 'cage2', 3);
const hammerAfterBothCages = () => moveCagePickup(createGoldenFGHProject(), 'cage2', 2);

describe('trait offers evaluate against the state their options were built from', () => {
  const baseline = rareChance(evaluateH(createGoldenFGHProject()), hermesCage);
  const matured = rareChance(evaluateH(createGoldenFGHProject(), maturedBeforeBiome), hermesCage);

  it('uses a distinguishable Favor rarity witness', () => {
    expect(matured[0]).toBeGreaterThan(baseline[0]!);
  });

  it('keeps a Fields cage boon at its spawn when a curse matures on the first cage', () => {
    const project = hermesBeforeHammer();
    const evaluation = evaluateH(project, curseMaturingAt(combat09, 'Cage02'));
    expect(rareChance(evaluation, hermesCage)).toEqual(baseline);
    // The acquisition still folds into the current history, after the matured curse.
    const branch = evaluation.rewards.branches[0]!;
    expect(branch.state.traitHistory.maturedChaosBlessings).toHaveLength(1);
    expect(branch.state.traitHistory.equippedTraits.HermesWeaponBoon).toBeDefined();
  });

  it('rebuilds the waiting cage boon when another upgrade screen in the room closes', () => {
    const project = createGoldenFGHProject();
    const evaluation = evaluateH(project, curseMaturingAt(combat09, 'Cage02'));
    expect(rareChance(evaluation, hermesCage)).toEqual(matured);
  });

  it('regenerates an invalidated cage boon at its open, after a later silent maturation', () => {
    const project = steadyGrowthProject(hermesBeforeHammer());
    const ordinal = encounterEndOrdinal(combat09, 'Cage02');
    const favor = curseMaturingAt(combat09, 'Cage01');
    const withoutInterval = evaluateH(project, favor);
    const withInterval = evaluateH(project, (branch) =>
      favor(withSteadyGrowthDueAt(branch, ordinal)),
    );
    expect(rareChance(withoutInterval, hermesCage)).toEqual(baseline);
    expect(rareChance(withInterval, hermesCage)).toEqual(matured);
  });

  it('rebuilds a stale boon at an intervening screen with the same result', () => {
    const project = steadyGrowthProject(hammerAfterBothCages());
    const ordinal = encounterEndOrdinal(combat09, 'Cage02');
    const favor = curseMaturingAt(combat09, 'Cage01');
    const evaluation = evaluateH(project, (branch) =>
      favor(withSteadyGrowthDueAt(branch, ordinal)),
    );
    expect(rareChance(evaluation, hermesCage)).toEqual(matured);
    expect(evaluation.rewards.branches[0]!.state.pendingTraitOffers).toEqual({});
  });

  it('keeps an ordinary room reward at its encounter completion; the next room sees the blessing', () => {
    const project = createGoldenFGHProject();
    const maturing = evaluateH(project, curseMaturingAt('golden-h-miniboss01', 'Encounter'));
    const plain = evaluateH(project);
    // The miniboss reward is built before its encounter's end effects mature the curse.
    expect(rareChance(maturing, minibossBoon)).toEqual(rareChance(plain, minibossBoon));
    expect(rareChance(maturing, nextRoomBoon)[0]).toBeGreaterThan(
      rareChance(plain, nextRoomBoon)[0]!,
    );
  });
});

/**
 * Authors the Steady Growth targets for its intervals: combat09's first cage
 * and, six encounters later, the Boss. Neither target is replaced later in H.
 */
function steadyGrowthProject(project: ProjectDocument): ProjectDocument {
  const withCage = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome: createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(underworldH, combat09),
      'Cage02',
    ),
    targetTraitKey: 'HestiaManaBoon',
  });
  return applyProjectCommand(withCage, catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome: createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(underworldH, createOccurrenceId('golden-h-preboss-shop:boss')),
      'Encounter',
    ),
    targetTraitKey: 'HermesWeaponBoon',
  });
}

/** A Steady Growth boon acquired before the biome, one interval short of `ordinal` ends. */
function withSteadyGrowthDueAt(branch: RewardBranch, ordinal: number): RewardBranch {
  const sequence = lastSequence(branch);
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: 'Demeter',
    options: Object.freeze([
      Object.freeze({ traitKey: 'BoonGrowthBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'DemeterSprintBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'CastNovaBoon', rarity: 'Common' as const }),
    ]),
    selectedOptionKey: 'option1',
  }) as AuthoredTraitOffer;
  const settled = settleEncounterTraitOffer(
    catalog,
    Object.freeze({
      ...branch,
      pendingShopContinuations: Object.freeze({}),
    }),
    createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'G'),
      { kind: 'occurrence', occurrenceId: createOccurrenceId('seed-steady-growth') },
      'Encounter',
    ),
    offer,
    sequence,
    'encounterCompleted',
  );
  const history = settled.branch.state.traitHistory;
  const steady = history.equippedTraits.BoonGrowthBoon;
  if (steady?.acquisitionIdentity === undefined) throw new Error('Steady Growth was not acquired');
  const interval = catalog.traits.byKey.BoonGrowthBoon!.selectedDisposition;
  if (interval.kind !== 'steadyGrowth') throw new Error('BoonGrowthBoon is not Steady Growth');
  const requiredInterval = interval.intervalsByRarity.Common!;
  return withHistory(
    branch,
    foldTraitHistoryEvents(catalog, [
      ...history.events,
      Object.freeze({
        kind: 'steadyGrowthProgress' as const,
        owner: createBiomeAddress('Underworld', 'G'),
        acquisitionRole: 'steadyGrowth' as const,
        sequence,
        acquisitionPoint: 'encounterEndEffectsApplied' as const,
        traitKey: 'BoonGrowthBoon',
        acquisitionIdentity: steady.acquisitionIdentity,
        oldProgress: 0,
        newProgress: requiredInterval - ordinal,
        requiredInterval,
      }),
    ]),
  );
}

describe('retained context-invalid offers', () => {
  // An Air contribution before the biome leaves Hermes' Infusion one Air short
  // until Creation matures on combat09's first cage.
  function seed() {
    const creation = curseMaturingAt(combat09, 'Cage02', 'ChaosElementalBlessing');
    return (branch: RewardBranch) =>
      creation(
        withHistory(
          branch,
          foldTraitHistoryEvents(catalog, [
            ...branch.state.traitHistory.events,
            Object.freeze({
              kind: 'elementContribution' as const,
              owner: createBiomeAddress('Underworld', 'G'),
              acquisitionRole: 'seed',
              sequence: lastSequence(branch),
              acquisitionPoint: 'seed',
              contributions: Object.freeze({ Air: 1 }),
            }),
          ]),
        ),
      );
  }
  const hermesOffer = (traitKey: string): AuthoredTraitOffer =>
    Object.freeze({
      kind: 'traits',
      giverKey: 'Hermes',
      options: Object.freeze([
        Object.freeze({ traitKey: 'HermesWeaponBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HermesSpecialBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey, rarity: 'Common' as const }),
      ]),
      selectedOptionKey: 'option1',
    }) as AuthoredTraitOffer;
  const hermesFindings = (project: ProjectDocument) =>
    evaluateH(project, seed()).rewards.findings.filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(hermesCage),
    );

  it('surfaces a finding for an Infusion the spawn-time state lacks and repairs by command', () => {
    const invalid = applyProjectCommand(hermesBeforeHammer(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: hermesCage,
      value: hermesOffer('ElementalUnifiedBoon'),
    });
    expect(hermesFindings(invalid).map((finding) => finding.code)).toContain('elementThreshold');
    const repaired = applyProjectCommand(invalid, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: hermesCage,
      value: hermesOffer('HermesCastDiscountBoon'),
    });
    expect(hermesFindings(repaired)).toEqual([]);
  });

  it('admits the same Infusion when an earlier screen rebuilds the offer after maturation', () => {
    const rebuilt = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: hermesCage,
      value: hermesOffer('ElementalUnifiedBoon'),
    });
    expect(hermesFindings(rebuilt)).toEqual([]);
  });
});

describe('ship wheel rewards', () => {
  const wheelOffer = createRewardWheelOfferAddress(
    oBiome,
    oOccurrenceIds.combat04,
    'wheel1',
    'offer1',
  );
  const wheelBoon = createTraitOfferAddress(wheelOffer, 'source');

  /** A picked Apollo wheel reward with an engine-supported starting screen. */
  function wheelBoonProject(): ProjectDocument {
    const withBoon = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: wheelOffer,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const outcome = evaluateBiome(shipFixture, withBoon)
      .artifacts.traitOffers.at(wheelBoon)
      ?.traitOfferStartingOutcome('Apollo');
    if (outcome === undefined) throw new Error('Apollo wheel screen has no starting outcome');
    return applyProjectCommand(withBoon, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: wheelBoon,
      value: outcome,
    });
  }

  it('builds a wheel reward after its own combat, not at room entry', () => {
    const project = wheelBoonProject();
    const plain = rareChance(evaluateBiome(shipFixture, project), wheelBoon);
    // The curse matures at the Intro's end effects, after entry and before the wheel spins.
    const maturing = rareChance(
      evaluateBiome(
        shipFixture,
        project,
        curseMaturingAt(oOccurrenceIds.combat04, 'Intro', 'ChaosRarityBlessing', shipFixture),
      ),
      wheelBoon,
    );
    expect(maturing[0]).toBeGreaterThan(plain[0]!);
  });
});

describe('screen completion inside one Shop room', () => {
  const duplicate = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(createOccurrenceAddress(shopBiome, shopId), 'roomExit'),
    ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  );
  const duplicateOffer = createTraitOfferAddress(duplicate, 'source');
  const duplicateTrace = (branch: RewardBranchState | undefined) =>
    branch?.traitEvaluations?.find(
      (trace) =>
        semanticAddressKey(
          createTraitOfferAddress(trace.address as typeof duplicate, trace.acquisitionRole),
        ) === semanticAddressKey(duplicateOffer),
    );
  const seeded = (stygianWell?: { readonly yarnUses: number; readonly hymnUses: number }) =>
    initializeTestRewardBranches().map((branch) => {
      const traits = foldTraitHistoryEvents(catalog, [
        ...echoGoldHistory().events,
        ...pomTargetHistory().events,
      ]);
      return Object.freeze({
        ...branch,
        state: Object.freeze({
          ...branch.state,
          rewardHistory: attachTraitHistory(branch.state.rewardHistory, traits),
          traitHistory: traits,
          ...(stygianWell === undefined
            ? {}
            : { stygianWell: Object.freeze({ ...branch.state.stygianWell, ...stygianWell }) }),
        }),
      });
    });

  it('builds a duplicated god boon from the state its source screen left', () => {
    const result = echoGoldShop(['Boon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      initialBranches: seeded(),
      rewardOverrides: { Boon: shopBoonReward('ZeusUpgrade', 'ZeusSpecialBoon') },
    });
    const trace = duplicateTrace(result.settlement.branches[0]);
    // The boon just bought is held, so the duplicate cannot offer it again.
    expect(trace?.generationState.traitHistory.equippedTraits.ZeusSpecialBoon).toBeDefined();
    expect(
      [...result.findings.values()].some(
        (entry) =>
          semanticAddressKey(entry.finding.origin) === semanticAddressKey(duplicateOffer) &&
          entry.finding.code === 'alreadyEquipped',
      ),
    ).toBe(true);
  });

  it('publishes a placed duplicate candidate from its own entry settlement', () => {
    const result = echoGoldShop(['Boon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      initialBranches: seeded(),
      rewardOverrides: { Boon: shopBoonReward('ZeusUpgrade', 'ZeusSpecialBoon') },
    });
    // The duplicate's frontier comes only from its entry, after the source screen.
    const frontiers = (result.settlement.roleFrontiers ?? []).filter(
      (frontier) => semanticAddressKey(frontier.address.owner) === semanticAddressKey(duplicate),
    );
    expect(frontiers).toHaveLength(1);
    expect(
      frontiers[0]?.branchesBeforeRole[0]?.state.traitHistory.equippedTraits.ZeusSpecialBoon,
    ).toBeDefined();
    const contexts = selectedTraitOfferProducts(result.settlement.branches).candidateContexts;
    expect(contexts.get(semanticAddressKey(duplicateOffer))).toHaveLength(1);
  });

  it('rebuilds a waiting Echo duplicate at a later Pom screen', () => {
    const result = echoGoldShop(['Boon', 'Minor', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      initialBranches: seeded(),
      rewardOverrides: {
        Boon: shopBoonReward('ZeusUpgrade', 'ZeusSpecialBoon'),
        Minor: Object.freeze({
          ...shopPomReward('ApolloWeaponBoon'),
          levelResolutionsByAcquisitionRole: Object.freeze({
            self: Object.freeze({
              kind: 'choice' as const,
              offeredTraitKeys: Object.freeze(['ApolloWeaponBoon', 'ZeusSpecialBoon']),
              selectedTraitKey: 'ApolloWeaponBoon',
            }),
          }),
        }),
      },
    });
    // The Pom screen itself is complete; only the duplicate's stale rows are findings.
    expect(
      [...result.findings.values()].filter((entry) => entry.finding.code.startsWith('pom')),
    ).toEqual([]);
    const trace = duplicateTrace(result.settlement.branches[0]);
    expect(trace?.generationState.traitHistory.equippedTraits.ApolloWeaponBoon?.level).toBe(2);
    expect(trace?.generationState.traitHistory.equippedTraits.ZeusSpecialBoon).toBeDefined();
  });

  it('re-anchors the duplicate once, after the source screen consumes Yarn and Hymn', () => {
    const result = echoGoldShop(['Boon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      initialBranches: seeded({ yarnUses: 1, hymnUses: 1 }),
      rewardOverrides: { Boon: shopBoonReward('HeraUpgrade', 'HeraWeaponBoon') },
    });
    const trace = duplicateTrace(result.settlement.branches[0]);
    expect(trace?.generationState.stygianWell).toMatchObject({ yarnUses: 0, hymnUses: 0 });
    expect(trace?.generationState.traitHistory.equippedTraits.HeraWeaponBoon).toBeDefined();
  });

  it('spends no Hymn on a screen built before Hymn was held', () => {
    const boon = createShopOfferAddress(shopBiome, shopId, 'Boon');
    const reward = shopBoonReward('HeraUpgrade', 'HeraWeaponBoon');
    const initialBranches = seeded().map((branch) => {
      // The Boon spawned at room entry; Hymn arrives afterwards.
      const spawned = spawnPendingTraitOffers(catalog, branch.state, [
        Object.freeze({
          origin: boon,
          offer: reward.offer,
          traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
        }),
      ]);
      return Object.freeze({
        ...branch,
        state: Object.freeze({
          ...spawned,
          stygianWell: Object.freeze({ ...spawned.stygianWell, hymnUses: 1 }),
        }),
      });
    });
    const result = echoGoldShop(['Boon'], {
      initialBranches,
      rewardOverrides: { Boon: reward },
    });
    const branch = result.settlement.branches[0];
    expect(branch?.state.stygianWell.hymnUses).toBe(1);
    // An ordinary replacement: the replaced boon's level without Hymn's bonus.
    expect(branch?.state.traitHistory.equippedTraits.HeraWeaponBoon).toMatchObject({
      rarity: 'Rare',
      level: 1,
    });
  });

  it('publishes no completion from an unauthored source screen', () => {
    const missing = Object.freeze({
      ...shopBoonReward('ZeusUpgrade', 'ZeusSpecialBoon'),
      traitOffersByAcquisitionRole: Object.freeze({ source: null }),
    });
    const result = echoGoldShop(['Boon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      initialBranches: seeded(),
      rewardOverrides: { Boon: missing },
    });
    const blocked = result.settlement.traitChildSettlements?.[0]?.branch;
    const room = Object.values(blocked?.state.pendingTraitOffers ?? {})[0];
    const record = room?.[semanticAddressKey(duplicateOffer)];
    expect(record?.stale).toBe(false);
    // Still the duplicate's creation context: the source boon never settled.
    expect(record?.context.traitHistory.equippedTraits.ZeusSpecialBoon).toBeUndefined();
  });

  it('keeps a waiting offer across a non-screen purchase', () => {
    const randomStack = Object.freeze({
      ...createUnresolvedAcquisitionRewardState(
        catalog,
        { rewardType: 'StoreRewardRandomStack' },
        { kind: 'shopProfile', key: 'WorldShop' },
      ),
      traitOffersByAcquisitionRole: Object.freeze({}),
      levelResolutionsByAcquisitionRole: Object.freeze({
        self: Object.freeze({ kind: 'random' as const, targetTraitKey: 'ApolloWeaponBoon' }),
      }),
    });
    const result = echoGoldShop(
      ['Boon', 'Minor', 'MajorNonBoon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY],
      {
        includeDuplicate: true,
        initialBranches: seeded(),
        rewardOverrides: {
          Boon: shopBoonReward('ZeusUpgrade', 'ZeusSpecialBoon'),
          Minor: randomStack,
        },
      },
    );
    const branch = result.settlement.branches[0];
    const trace = duplicateTrace(branch);
    // The random stack raised the level without rebuilding the loot it did not open.
    expect(branch?.state.traitHistory.equippedTraits.ApolloWeaponBoon?.level).toBe(2);
    expect(trace?.generationState.traitHistory.equippedTraits.ApolloWeaponBoon?.level).toBe(1);
  });
});

describe('invalidation products', () => {
  const room = createOccurrenceAddress(underworldH, createOccurrenceId('freshness-room'));
  const waiting = Object.freeze({
    origin: createLocalRewardAddress(underworldH, room.occurrenceId, 'cages', 'cage1'),
    offer: Object.freeze({ rewardType: 'Boon' }),
    traitOffersByAcquisitionRole: Object.freeze({ self: null }),
  });
  const waitingKey = semanticAddressKey(createTraitOfferAddress(waiting.origin, 'self'));
  const roomKey = semanticAddressKey(room);

  it('marks waiting loot stale on a Steady Growth interval with no promotable trait', () => {
    // A lone Heroic Steady Growth boon reaches its interval with an empty target domain.
    let branch = withSteadyGrowthDueAt(
      withHistory(initializeTestRewardBranches()[0]!, pomTargetHistory()),
      1,
    );
    // Its prerequisite boon is gone, so it is the only rarifiable trait left.
    branch = withHistory(
      branch,
      foldTraitHistoryEvents(catalog, [
        ...branch.state.traitHistory.events,
        Object.freeze({
          kind: 'traitRemoval' as const,
          owner: room,
          acquisitionRole: 'purgingPoolSale',
          sequence: 1,
          acquisitionPoint: 'seed',
          traitKey: 'ApolloWeaponBoon',
          match: 'currentTraitKey' as const,
        }),
      ]),
    );
    for (let promotion = 0; promotion < 3; promotion += 1) {
      const history = branch.state.traitHistory;
      const advanced = advanceSteadyGrowthProgress(catalog, history, room, 1);
      const threshold = advanced.thresholds[0];
      if (threshold === undefined) throw new Error('interval did not fire');
      const settled = settleSteadyGrowthThreshold(
        catalog,
        advanced.history,
        room,
        1,
        threshold,
        'BoonGrowthBoon',
      );
      const steady = settled.history.equippedTraits.BoonGrowthBoon!;
      const interval = catalog.traits.byKey.BoonGrowthBoon!.selectedDisposition;
      if (interval.kind !== 'steadyGrowth') throw new Error('not Steady Growth');
      const required = interval.intervalsByRarity[steady.rarity as 'Common']!;
      branch = withHistory(
        branch,
        foldTraitHistoryEvents(catalog, [
          ...settled.history.events,
          Object.freeze({
            kind: 'steadyGrowthProgress' as const,
            owner: room,
            acquisitionRole: 'steadyGrowth' as const,
            sequence: 1,
            acquisitionPoint: 'encounterEndEffectsApplied' as const,
            traitKey: 'BoonGrowthBoon',
            acquisitionIdentity: steady.acquisitionIdentity!,
            oldProgress: 0,
            newProgress: required - 1,
            requiredInterval: required,
          }),
        ]),
      );
    }
    expect(branch.state.traitHistory.equippedTraits.BoonGrowthBoon?.rarity).toBe('Heroic');
    const spawned = Object.freeze({
      ...branch,
      state: spawnPendingTraitOffers(catalog, branch.state, [waiting]),
    }) as RewardBranchState;
    const transition = applyEncounterEndEffectsTransition(
      catalog,
      Object.freeze({
        kind: 'encounterEndEffectsApplied' as const,
        origin: room,
        phaseKey: 'Encounter',
        execution: 'normal' as const,
        figLeafSkipOwner: false,
        operationIndex: 2,
        sequence: 2,
      }),
      {
        kind: 'authored',
        origin: room,
        occurrenceId: room.occurrenceId,
        gameName: 'RoomOpening01',
        encounters: {},
        encounterPhases: [],
      } as unknown as CanonicalAuthoredRoom,
      [spawned],
    );
    expect(transition.steadyGrowthThresholds[0]?.threshold.eligibleTargetKeys).toEqual([]);
    expect(transition.branches[0]?.state.pendingTraitOffers[roomKey]?.[waitingKey]?.stale).toBe(
      true,
    );
  });

  it('keeps two branches with equal equipment but different spawn contexts distinct', () => {
    const base = initializeTestRewardBranches()[0]! as RewardBranchState;
    const fresh = Object.freeze({
      ...base,
      state: spawnPendingTraitOffers(catalog, base.state, [waiting]),
    }) as RewardBranchState;
    const stale = Object.freeze({
      ...fresh,
      state: applyTraitOfferContextTransition(fresh.state, {
        kind: 'invalidated',
        room: roomKey,
        source: 'steadyGrowthInterval',
      }),
    }) as RewardBranchState;
    const olderContext = Object.freeze({
      ...fresh,
      state: Object.freeze({
        ...spawnPendingTraitOffers(catalog, withHistory(base, pomTargetHistory()).state, [waiting]),
        traitHistory: base.state.traitHistory,
        rewardHistory: base.state.rewardHistory,
      }),
    }) as RewardBranchState;
    expect(mergeEquivalentRewardBranches([fresh, stale, olderContext])).toHaveLength(3);
    expect(mergeEquivalentRewardBranches([fresh, fresh])).toHaveLength(1);
    const identity = (state: RewardBranchState['state']) =>
      JSON.stringify(
        traitOfferContextIdentity({
          state: base.state,
          generationState: traitOfferGenerationState(
            state,
            createTraitOfferAddress(waiting.origin, 'self'),
          ),
          source: {},
        }),
      );
    expect(identity(olderContext.state)).not.toBe(identity(fresh.state));
  });
});

describe('Mystery Box loot', () => {
  it('spawns a box but never its hidden god loot, which exists only once unwrapped', () => {
    const base = initializeTestRewardBranches()[0]! as RewardBranchState;
    const box = createShopOfferAddress(underworldH, combat09, 'Boon');
    const state = spawnPendingTraitOffers(catalog, base.state, [
      Object.freeze({
        origin: box,
        offer: Object.freeze({ rewardType: 'BlindBoxLoot' }),
        traitOffersByAcquisitionRole: Object.freeze({ box: null, hiddenSource: null }),
      }),
    ]);
    const records =
      state.pendingTraitOffers[semanticAddressKey(createOccurrenceAddress(underworldH, combat09))];
    expect(Object.keys(records ?? {})).toEqual([
      semanticAddressKey(createTraitOfferAddress(box, 'box')),
    ]);
  });
});

describe('upgrade screens that settle without a trait event', () => {
  const room = createOccurrenceAddress(underworldH, createOccurrenceId('freshness-screen-room'));
  const screenOwner = createIncomingRewardAddress(underworldH, room.occurrenceId);
  const waiting = Object.freeze({
    origin: createShopOfferAddress(underworldH, room.occurrenceId, 'Boon'),
    offer: Object.freeze({ rewardType: 'Boon' }),
    traitOffersByAcquisitionRole: Object.freeze({ source: null }),
  });
  const waitingRecord = (branch: RewardBranchState) =>
    branch.state.pendingTraitOffers[semanticAddressKey(room)]?.[
      semanticAddressKey(createTraitOfferAddress(waiting.origin, 'source'))
    ];
  /** A loot that spawned before `history` was acquired. */
  function waitingSince(history: TraitHistoryState): RewardBranchState {
    const base = initializeTestRewardBranches()[0]! as RewardBranchState;
    const spawned = spawnPendingTraitOffers(catalog, base.state, [waiting]);
    return withHistory(
      { ...base, state: spawned } as RewardBranchState,
      history,
    ) as RewardBranchState;
  }

  it('rebuilds a waiting boon once when a Fallback Gold screen closes', () => {
    // Every Hermes boon is banned, so the only legal Hermes screen is Gold.
    const exhausted = Object.freeze({
      ...pomTargetHistory(),
      bannedTraitKeys: Object.freeze([...catalog.traitGivers.byKey.Hermes!.traitKeys]),
    });
    const branch = waitingSince(exhausted);
    expect(waitingRecord(branch)?.context.traitHistory).not.toBe(exhausted);
    const settled = settleEncounterTraitOffer(
      catalog,
      branch,
      screenOwner,
      Object.freeze({ kind: 'fallbackGold' as const, giverKey: 'Hermes' }),
      2,
      'encounterCompleted',
      undefined,
      'source',
    );
    expect(settled.findingEntries).toEqual([]);
    expect(settled.screenCompleted).toBe(true);
    expect(waitingRecord(settled.branch)).toMatchObject({ stale: false });
    expect(waitingRecord(settled.branch)?.context.traitHistory).toBe(
      settled.branch.state.traitHistory,
    );
  });

  it('rebuilds once after a Concave Stone residual and the screen’s Ordinary use', () => {
    const ordinaryHistory = ordinaryPair();
    const stone = createKeepsakeState(catalog, 'UnpickedBoonKeepsake');
    const branch = waitingSince(ordinaryHistory);
    const withStone = Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        keepsakes: Object.freeze({
          ...stone,
          stone: Object.freeze({ ...stone.stone!, rank: 'Common' as const }),
        }),
      }),
    }) as RewardBranchState;
    const settled = settleEncounterTraitOffer(
      catalog,
      withStone,
      screenOwner,
      Object.freeze({
        kind: 'traits' as const,
        giverKey: 'Apollo',
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]),
        selectedOptionKey: 'option1' as const,
        concaveStoneResult: Object.freeze({ kind: 'proc' as const, optionKey: 'option2' as const }),
      }) as AuthoredTraitOffer,
      2,
      'encounterCompleted',
      undefined,
      'source',
    );
    expect(settled.screenCompleted).toBe(true);
    const context = waitingRecord(settled.branch)?.context;
    // Rebuilt from the closed screen: residual acquired, Stone and one Ordinary use spent.
    expect(context?.traitHistory).toBe(settled.branch.state.traitHistory);
    expect(context?.traitHistory.equippedTraits.ApolloSpecialBoon).toBeDefined();
    expect(context?.keepsakes.stone).toMatchObject({ status: 'consumed' });
    expect(
      context?.traitHistory.activeChaosCurses.find((curse) => curse.semanticTag === 'Ordinary')
        ?.remaining,
    ).toBe(
      (ordinaryHistory.activeChaosCurses.find((curse) => curse.semanticTag === 'Ordinary')
        ?.remaining ?? 0) - 1,
    );
  });
});

/** An Ordinary curse acquired through its own Chaos screen. */
function ordinaryPair(): TraitHistoryState {
  const curse = catalog.chaos.curses.byKey.ChaosCommonCurse!;
  const blessing = catalog.chaos.blessings.byKey.ChaosWeaponBlessing!;
  const offer = normalizeAuthoredChaosTraitOffer(catalog, {
    kind: 'chaos',
    giverKey: 'Chaos',
    curseOptions: [0, 1, 2].map(() => ({
      curseKey: curse.key,
      requirementCount: curse.duration.maximum,
    })) as never,
    selectedOptionKey: 'option1',
    selectedCurseValues: Object.fromEntries(curse.operands.map((o) => [o.key, o.minimum])),
    blessingKey: blessing.key,
    rarity: 'Common',
    blessingValues: Object.fromEntries(
      blessing.operands.map((o) => [o.key, o.byRarity?.Common?.minimum ?? o.minimum]),
    ),
  });
  return foldTraitHistoryEvents(catalog, [
    Object.freeze({
      kind: 'chaosPair' as const,
      owner: createBiomeAddress('Underworld', 'G'),
      acquisitionRole: 'self',
      sequence: 1,
      acquisitionPoint: 'reward',
      acquisitionIdentity: 'seed:ordinary',
      offer,
    }),
  ]);
}

describe('room rewards created before combat', () => {
  const room = createOccurrenceAddress(underworldH, createOccurrenceId('golden-h-miniboss01'));
  const reward = createIncomingRewardAddress(underworldH, room.occurrenceId);
  const rewardOffer = createTraitOfferAddress(reward, 'source');
  const minibossRoom = {
    kind: 'authored',
    origin: room,
    occurrenceId: room.occurrenceId,
    gameName: 'H_MiniBoss01',
    encounterPhases: [],
    incomingReward: {
      origin: reward,
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
      traitOffersByAcquisitionRole: { source: null },
    },
  } as unknown as CanonicalAuthoredRoom;
  const start = (encounterKey: string) =>
    applyEncounterStartedTransition(
      catalog,
      ordinaryRoutePosition(catalog, 'Underworld', 'H'),
      {},
      Object.freeze({
        kind: 'encounterStarted' as const,
        origin: room,
        phaseKey: 'Encounter',
        encounterEnvelopeKey: 'SingleEncounter',
        encounterKey,
        phaseKind: 'miniboss' as const,
        execution: 'skippedByFigLeaf' as const,
        figLeafSkipOwner: true,
        operationIndex: 1,
        sequence: 1,
      }),
      minibossRoom,
      [
        Object.freeze({
          ...(initializeTestRewardBranches()[0]! as RewardBranchState),
          state: Object.freeze({
            ...initializeTestRewardBranches()[0]!.state,
            keepsakes: createKeepsakeState(catalog, 'SkipEncounterKeepsake'),
          }),
        }) as RewardBranchState,
      ],
    ).branches[0]!;

  it('spawns an H miniboss reward at encounter start, before the Fig Leaf use', () => {
    const branch = start('MiniBossVampire');
    const record =
      branch.state.pendingTraitOffers[semanticAddressKey(room)]?.[semanticAddressKey(rewardOffer)];
    expect(branch.state.keepsakes.figLeaf?.activatedThisBiome).toBe(true);
    expect(record?.context.keepsakes.figLeaf?.activatedThisBiome).toBe(false);
  });

  it('leaves an ordinary encounter reward for its completion', () => {
    expect(start('GeneratedH').state.pendingTraitOffers).toEqual({});
  });

  it('keeps the start-time context through the miniboss encounter completion', () => {
    // The golden route's real miniboss occurrence, materialized as the chronology sees it.
    const project = createGoldenFGHProject();
    const occurrence = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId);
    const declaration = catalog.rooms.byKey.H_MiniBoss01!;
    if (occurrence === undefined) throw new Error('golden H has no miniboss occurrence');
    const routePosition = ordinaryRoutePosition(catalog, 'Underworld', 'H');
    const realRoom = materializeAuthoredRoom({
      catalog,
      biome: underworldH,
      routePosition,
      room: declaration,
      occurrence,
      role: 'ordinary',
      entered: true,
      loadout: project.route!.loadout,
    });
    const phaseKey = realRoom.encounterPhases[0]!.slotKey;
    const event = (kind: 'encounterStarted' | 'encounterCompleted', sequence: number) =>
      Object.freeze({
        kind,
        origin: room,
        phaseKey,
        encounterEnvelopeKey: 'SingleEncounter',
        encounterKey: 'MiniBossVampire',
        phaseKind: 'miniboss' as const,
        execution: 'skippedByFigLeaf' as const,
        figLeafSkipOwner: true,
        operationIndex: sequence,
        sequence,
      });
    const base = initializeTestRewardBranches()[0]! as RewardBranchState;
    const started = applyEncounterStartedTransition(
      catalog,
      routePosition,
      {},
      event('encounterStarted', 1) as Extract<HistoryEvent, { readonly kind: 'encounterStarted' }>,
      realRoom,
      [
        Object.freeze({
          ...base,
          state: Object.freeze({
            ...base.state,
            keepsakes: createKeepsakeState(catalog, 'SkipEncounterKeepsake'),
          }),
        }) as RewardBranchState,
      ],
    ).branches;
    const completed = applyEncounterSettlementTransition({
      catalog,
      snapshot: {} as never,
      routePosition,
      event: event('encounterCompleted', 2) as Extract<
        HistoryEvent,
        { readonly kind: 'encounterCompleted' }
      >,
      room: realRoom,
      view: {} as never,
      branches: started,
      enteredBiomeCount: 3,
      fullRunBiomeCount: 4,
      authoredSeaStarDuplicateSiteKeys: new Set(),
      gorgonEligible: false,
      gorgonCandidate: undefined,
      gorgonPhaseBlocked: false,
      gorgonEvaluationBlocked: false,
    }).branches[0]!;
    const record =
      completed.state.pendingTraitOffers[semanticAddressKey(room)]?.[
        semanticAddressKey(createTraitOfferAddress(realRoom.incomingReward!.origin, 'source'))
      ];
    expect(completed.state.keepsakes.figLeaf?.activatedThisBiome).toBe(true);
    expect(record?.context.keepsakes.figLeaf?.activatedThisBiome).toBe(false);
  });
});
