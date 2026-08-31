import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
  semanticAddressKey,
  createDefaultAuthoredHexTree,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  hermesShrineCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import type { RewardHistoryState, RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import {
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
  loadSurfaceNOProject,
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNOPProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
} from '@run-planner/test-fixtures/surface';
import {
  assessHermesShrineInventory,
  assessHermesShrinePlacement,
  assessHermesShrineTravelDealRefill,
  deriveHermesShrineDeliveries,
  hasPendingHermesSpellDrop,
  priorTwoSurfaceShopPresence,
} from '../../src/simulation/hermes-shrine';
import { createHermesShrineCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { prefixAuthoredRooms } from '../../src/simulation/candidates/evaluated-biome';
import { composeBiomeHistoryPrefix } from '../../src/simulation/history';
import { prepareRoomEncounterPhases } from '../../src/simulation/encounters/preparation';
import { materializeBiomePrefix } from '../../src/simulation/materialization';
import { evaluateBiomeRewards } from '../../src/simulation/rewards/biome';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../src/simulation/traits';
import { installHexTree, settlePathScreen } from '../../src/simulation/hex-progress';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';
import { initializeRewardBranches } from '../../src/simulation/rewards/processing';
import { createTestArcanaFearState, initializeTestRewardBranches } from '../support/arcana-fear';

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
      history: attachTraitHistory(
        Object.freeze({
          ...branch.history,
          lootTypeHistory: Object.freeze({ AresUpgrade: 1, HephaestusUpgrade: 1 }),
        }),
        traits,
      ),
      traitHistory: traits,
    }),
  );
}

function rewardFacts(history: RewardHistoryState): RewardKernelFacts {
  return {
    requirements: {
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
      rewardLookups: {},
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
      history: Object.freeze({
        ...branch.history,
        useRecord: Object.freeze({
          ...branch.history.useRecord,
          ...(rewardType === 'TalentDrop' ? { SpellDrop: 1 } : {}),
        }),
      }),
    }),
  );
}

function evaluateShrineOutgoingPrefix(
  project: ReturnType<typeof loadSurfaceNOProject>,
  rewardType: 'HermesUpgrade' | 'SpellDrop' | 'TalentDrop',
) {
  const route = project.route;
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (route === undefined || plan?.topology === null || plan === undefined)
    throw new Error('fixture lost Surface O topology');
  const cutoff = plan.topology.decisions.findIndex(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === oOccurrenceIds.combat07,
  );
  if (cutoff < 0) throw new Error('fixture lost O_Combat07 outgoing decision');
  const prefixPlan = Object.freeze({
    ...plan,
    topology: Object.freeze({
      ...plan.topology,
      decisions: Object.freeze(plan.topology.decisions.slice(0, cutoff + 1)),
    }),
  });
  const snapshot = materializeBiomePrefix(catalog, oBiome, prefixPlan, route.loadout);
  const history = snapshot === null ? undefined : composeBiomeHistoryPrefix(catalog, snapshot);
  if (snapshot?.entryRoom === undefined || history === null || history === undefined)
    throw new Error('fixture lost O_Combat07 outgoing prefix');
  const rewards = evaluateBiomeRewards(
    catalog,
    snapshot as typeof snapshot & { readonly entryRoom: NonNullable<typeof snapshot.entryRoom> },
    history,
    2,
    route.loadout,
    outgoingSeedBranches(rewardType),
  );
  const runState = rewards.runStateSnapshots.find(
    (candidate) =>
      candidate.owner.kind === 'exitDecision' &&
      candidate.owner.source.kind === 'occurrence' &&
      candidate.owner.source.occurrenceId === oOccurrenceIds.combat07,
  );
  if (runState === undefined) throw new Error('fixture lost O_Combat07 outgoing Run State');
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
    const placement = assessHermesShrinePlacement(catalog.rooms.byKey.O_Combat02, [false, false]);
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
    expect(assessHermesShrinePlacement(ordinary, [true]).eligible).toBe(false);
    expect(assessHermesShrinePlacement(ordinary, [true, false]).eligible).toBe(false);
    expect(assessHermesShrinePlacement(ordinary, [false, false]).eligible).toBe(true);
    expect(
      assessHermesShrinePlacement(catalog.rooms.byKey.O_PostBoss01, [true, true]),
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
    expect(withVisibleInventory.rewards.branches.map((branch) => branch.bags)).toEqual(
      baseline.rewards.branches.map((branch) => branch.bags),
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

describe('Hermes Shrine delayed-delivery derivation', () => {
  const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
  const firstHost = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
  const secondHost = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:boss'));

  it('counts only later qualifying end-effects and leaves independent items pending', () => {
    const deliveries = deriveHermesShrineDeliveries(
      [
        {
          sourceKey: 'first',
          sourceSequence: 10,
          sourceOrigin: source,
          rewardType: 'SpellDrop',
          delay: 2,
          rushed: false,
        },
        {
          sourceKey: 'secondLeft',
          sourceSequence: 10,
          sourceOrigin: source,
          rewardType: 'TalentDrop',
          delay: 3,
          rushed: false,
        },
      ],
      [
        // A purchase-room event and omitted skipped/noncombat events cannot
        // consume the newly-created countdown because their sequence is not later.
        { sequence: 10, kind: 'encounterEndEffectsApplied', origin: source },
        {
          sequence: 20,
          kind: 'encounterEndEffectsApplied',
          origin: firstHost,
          encounterPhaseKey: 'Combat1',
        },
        {
          sequence: 30,
          kind: 'encounterEndEffectsApplied',
          origin: secondHost,
          encounterPhaseKey: 'Combat2',
        },
      ],
    );
    expect(deliveries).toMatchObject([
      {
        sourceKey: 'first',
        deliveryKind: 'countdown',
        hostOrigin: secondHost,
        encounterPhaseKey: 'Combat2',
        remainingUses: 0,
      },
      { sourceKey: 'secondLeft', deliveryKind: 'pending', remainingUses: 1 },
    ]);
    // Maturity selects a host; it does not prove that the required pickup
    // settled. The reservation remains live through the due host state.
    expect(hasPendingHermesSpellDrop(deliveries)).toBe(true);
  });

  it('rushes in the source room and final Preboss completion flushes every remaining item', () => {
    const deliveries = deriveHermesShrineDeliveries(
      [
        {
          sourceKey: 'rush',
          sourceSequence: 10,
          sourceOrigin: source,
          rewardType: 'HealBigDrop',
          delay: 8,
          rushed: true,
        },
        {
          sourceKey: 'spell',
          sourceSequence: 10,
          sourceOrigin: source,
          rewardType: 'SpellDrop',
          delay: 8,
          rushed: false,
        },
      ],
      [{ sequence: 20, kind: 'finalPrebossCompletion', origin: secondHost }],
    );
    expect(deliveries).toMatchObject([
      { deliveryKind: 'rush', hostOrigin: source, hostSequence: 10 },
      { deliveryKind: 'finalPrebossCompletion', hostOrigin: secondHost, hostSequence: 20 },
    ]);
    expect(hasPendingHermesSpellDrop(deliveries)).toBe(true);
  });

  it('leaves a tail Postboss purchase pending when the modeled route has no later encounter', () => {
    const tail = createOccurrenceAddress(
      pBiome,
      createOccurrenceId('surface-p-preboss-shop:postboss'),
    );
    expect(
      deriveHermesShrineDeliveries(
        [
          {
            sourceKey: hermesShrineDeliveryEntryKey(tail, 'initial:secondLeft'),
            sourceSequence: 10,
            sourceOrigin: tail,
            rewardType: 'SpellDrop',
            delay: 8,
            rushed: false,
          },
        ],
        [],
      ),
    ).toEqual([
      expect.objectContaining({
        sourceOrigin: tail,
        deliveryKind: 'pending',
        remainingUses: 8,
      }),
    ]);
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
});

describe('Hermes Shrine Travel Deal generation', () => {
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
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: true },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'travelDealRefill',
      purchase: { delay: 2, rushed: false },
    });
    // Countdown chronology is owned by the dedicated Shrine-delivery tests.
    // This Travel Deal witness starts from the exact derived host and proves
    // that the refill settles through delivery, not through purchase.
    const refillHost = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const deliveryPhaseKey = 'Encounter';
    const refillEntry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(refillHost, 'hermesShrineDelivery'),
      hermesShrineDeliveryEntryKey(host, 'travelDealRefill'),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: refillEntry,
      value: { rewardType: 'ArmorBoost' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry: refillEntry,
      encounterPhaseKey: deliveryPhaseKey,
    });
    const route = project.route;
    const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (route === undefined || plan === undefined) throw new Error('fixture lost Surface O');
    const snapshot = materializeBiomePrefix(catalog, oBiome, plan, route.loadout);
    const history = snapshot == null ? undefined : composeBiomeHistoryPrefix(catalog, snapshot);
    if (snapshot == null || snapshot.entryRoom === undefined || history == null)
      throw new Error('fixture lost O history');
    const materializedRefillHost = prefixAuthoredRooms(snapshot).find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(refillHost),
    );
    expect(
      materializedRefillHost?.roomActionRoster.rows.map((row) => row.reference),
    ).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: refillEntry.entryKey,
      encounterPhaseKey: deliveryPhaseKey,
    });
    expect(
      materializedRefillHost?.roomActionRoster.rows.find(
        (row) =>
          row.reference.kind === 'interactAcquisitionEntry' &&
          row.reference.entryKey === refillEntry.entryKey,
      )?.window,
    ).toEqual({ kind: 'encounterEnd', phaseKey: deliveryPhaseKey });
    const completeSnapshot = snapshot as typeof snapshot & {
      readonly entryRoom: NonNullable<typeof snapshot.entryRoom>;
    };
    const result = evaluateBiomeRewards(
      catalog,
      completeSnapshot,
      history,
      2,
      route.loadout,
      branchesWithTravelDeal(),
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      'hermesShrineTravelDealRefillUnavailable',
    );
    expect(result.hermesShrineDeliveries.map((delivery) => delivery.sourceKey)).not.toContain(
      hermesShrineDeliveryEntryKey(host, 'travelDealRefill'),
    );
    expect(result.runtimeOfferFallbacks).toContainEqual({
      address: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(refillHost, 'hermesShrineDelivery'),
        hermesShrineDeliveryEntryKey(host, 'travelDealRefill'),
      ),
      preferredKey: 'ArmorBoost',
      fallbackKey: 'ArmorBigBoost',
    });
    expect(refillEntry.entryKey).toBe(hermesShrineDeliveryEntryKey(host, 'travelDealRefill'));
    expect(refillEntry.entryKey).not.toBe(hermesShrineDeliveryEntryKey(host, 'initial:first'));

    const secondRush = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'initial:secondLeft',
      purchase: { delay: 2, rushed: true },
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
    const secondSnapshot = materializeBiomePrefix(catalog, oBiome, secondPlan, route.loadout);
    const secondHistory =
      secondSnapshot === null ? undefined : composeBiomeHistoryPrefix(catalog, secondSnapshot);
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
      2,
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
      bothRushedResult.hermesShrineDeliveries.map((delivery) => delivery.sourceKey),
    ).not.toContain(hermesShrineDeliveryEntryKey(host, 'initial:first'));
    expect(
      bothRushedResult.hermesShrineDeliveries.map((delivery) => delivery.sourceKey),
    ).not.toContain(hermesShrineDeliveryEntryKey(host, 'initial:secondLeft'));
  });
});

describe('Hermes Shrine Spell reservation lifecycle input', () => {
  it('makes a delayed Spell reservation available to later encounter preparation', () => {
    const project = loadSurfaceNOProject();
    const route = project.route;
    const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (route === undefined || plan === undefined) throw new Error('fixture lost Surface O');
    const snapshot = materializeBiomePrefix(catalog, oBiome, plan, route.loadout);
    if (snapshot?.entryRoom === undefined) throw new Error('fixture lost O entry');
    const host = prefixAuthoredRooms(snapshot).find(
      (room) => room.occurrenceId === oOccurrenceIds.combat04 && room.entered,
    );
    if (host === undefined) throw new Error('fixture lost O_Combat04');
    const envelope = catalog.encounterEnvelopes.byKey[host.encounterEnvelopeKey];
    if (envelope === undefined) throw new Error('catalog lost O_Combat04 envelope');
    const withSpellGuard = {
      ...catalog,
      encounterEnvelopes: {
        ...catalog.encounterEnvelopes,
        byKey: {
          ...catalog.encounterEnvelopes.byKey,
          [envelope.key]: {
            ...envelope,
            slots: envelope.slots.map((slot) =>
              slot.key === 'Combat1'
                ? {
                    ...slot,
                    activationRequirement: {
                      kind: 'flagEquals' as const,
                      flag: 'pendingSpellDrop',
                      value: false,
                    },
                  }
                : slot,
            ),
          },
        },
      },
    } as typeof catalog;

    const history = composeBiomeHistoryPrefix(catalog, snapshot);
    const checkpoint = history?.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(host.origin),
    )?.preparation;
    if (checkpoint === undefined) throw new Error('fixture never prepared O_Combat04');
    expect(prepareRoomEncounterPhases(withSpellGuard, host, checkpoint).valid).toBe(true);
    expect(
      prepareRoomEncounterPhases(withSpellGuard, host, checkpoint, {
        pendingSpellDrop: true,
      }).valid,
    ).toBe(false);
  });
});

describe('Hermes Shrine pickup settlement', () => {
  it('settles the canonical delayed delivery at its exact derived host and phase', () => {
    const assembly = simulateProjectAssembly(
      catalog,
      createSurfaceNOHermesShrineDeliveryCheckpoint(),
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
    expect(closed.hexProgress).toMatchObject({ investedPathPoints: 18, talentDropsClosed: true });

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
        },
      },
      rewardFacts,
      new Map(),
    );
    expect(delivery.branches[0]?.hexProgress).toMatchObject({
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
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: true },
    });
    const evaluation = simulateProject(catalog, project);
    const p = evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
    if (p?.authoring !== 'complete' || p.validity !== 'valid') {
      throw new Error(
        `fixture lost valid tail P biome: ${p?.findings.map((finding) => finding.code).join(',')}`,
      );
    }
    expect(p.rewards.hermesShrineDeliveries.map((delivery) => delivery.sourceKey)).not.toContain(
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
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'initial:secondRight',
      purchase: { delay: 2, rushed: true },
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
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: true },
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
    expect(o?.rewards.runtimeOfferFallbacks).toContainEqual(
      expect.objectContaining({ preferredKey: 'LastStandDrop', fallbackKey: 'ArmorBoost' }),
    );

    // A later host owns its own retained child.  It must not be mistaken for
    // the virtual same-room rush source merely because both use the closed
    // Shrine delivery site key.
    const delayedHost = createOccurrenceAddress(oBiome, oOccurrenceIds.combat01);
    let delayed = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: host,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: false },
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
