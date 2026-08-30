import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import {
  createBiomeAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  foldTraitHistoryEvents,
  attachTraitHistory,
  recordReachedLevelResolution,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import {
  factsWithHistory,
  levelResolutionEffectFor,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import { createLevelResolutionCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';
import { applyProjectCommand } from '@run-planner/engine/authored-project';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import {
  loadUnderworldFMidshopPomFrontierProject,
  fMidshopPomShopId,
  goldenFBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';

const owner = { kind: 'project' } as const;
const levelAddress = createLevelResolutionAddress(
  createIncomingRewardAddress(
    createBiomeAddress('Underworld', 'F'),
    createOccurrenceId('pom-test'),
  ),
  'self',
);
const pomTestSiteOwner = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('pom-test'),
);

function settleTestRoomReward(
  branches: Parameters<typeof settleOwnedAcquisitionSite>[1],
  source: Parameters<typeof settleOwnedAcquisitionSite>[2]['source'],
  sequence: number,
  facts: Parameters<typeof settleOwnedAcquisitionSite>[3],
  findings: Parameters<typeof settleOwnedAcquisitionSite>[4],
) {
  return settleOwnedAcquisitionSite(
    catalog,
    branches,
    {
      siteOwner: pomTestSiteOwner,
      pointKey: 'roomRewardPickup',
      entryKey: 'self',
      source,
      historySequence: sequence,
    },
    facts,
    findings,
  ).branches;
}

function equippedHistory() {
  const event: TraitOfferEvent = {
    kind: 'traitOffer',
    owner,
    acquisitionRole: 'seed',
    sequence: 1,
    giverKey: 'Apollo',
    options: Object.freeze([
      { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
    ]) as TraitOfferEvent['options'],
    selectedOptionKey: 'option1',
    acquisitionPoint: 'seed',
  };
  return foldTraitHistoryEvents(catalog, [event]);
}

function twoTargetHistory() {
  const first: TraitOfferEvent = {
    kind: 'traitOffer',
    owner,
    acquisitionRole: 'seed1',
    sequence: 1,
    giverKey: 'Apollo',
    options: Object.freeze([
      { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
    ]) as TraitOfferEvent['options'],
    selectedOptionKey: 'option1',
    acquisitionPoint: 'seed',
  };
  const second: TraitOfferEvent = {
    ...first,
    acquisitionRole: 'seed2',
    sequence: 2,
    giverKey: 'Hestia',
    options: Object.freeze([
      { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
      { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
      { traitKey: 'HestiaCastBoon', rarity: 'Common' },
    ]) as TraitOfferEvent['options'],
    selectedOptionKey: 'option2',
  };
  return foldTraitHistoryEvents(catalog, [first, second]);
}

function rewardFacts(): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 1,
        biomeEncounterDepth: 1,
        encounterDepth: 1,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: {
        biomeUseRecord: {},
        lootTypeHistory: {},
        roomsEntered: {},
        useRecord: {},
      },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 1,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 1,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
  };
}

describe('Pom level resolutions', () => {
  it("keeps Nectar's random +1 on the exact RoomReward binding only", () => {
    expect(
      levelResolutionEffectFor(
        catalog.rewards,
        { rewardType: 'GiftDrop' },
        { kind: 'producerLifecycle', key: 'RoomReward' },
        'self',
      ),
    ).toEqual({ kind: 'randomTargetIfAvailable', levelCount: 1 });
    expect(
      levelResolutionEffectFor(
        catalog.rewards,
        { rewardType: 'GiftDrop' },
        { kind: 'shopProfile', key: 'I_WorldShop' },
        'self',
      ),
    ).toBeUndefined();
    expect(
      levelResolutionEffectFor(
        catalog.rewards,
        { rewardType: 'StoreRewardRandomStack' },
        { kind: 'shopProfile', key: 'WorldShop' },
        'self',
      ),
    ).toEqual({ kind: 'randomTarget', levelCount: 1 });

    const noTargetFindings = new Map();
    const empty = settleTestRoomReward(
      initializeTestRewardBranches(),
      {
        origin: levelAddress.owner,
        offer: { rewardType: 'GiftDrop' },
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        levelResolutionsByAcquisitionRole: { self: { kind: 'random', targetTraitKey: null } },
      },
      1,
      (history) => factsWithHistory(rewardFacts(), history, new Set()),
      noTargetFindings,
    );
    expect(empty[0]?.history.consumableRecord.GiftDrop).toBe(1);
    expect(empty[0]?.traitHistory?.events).toEqual([]);
    expect([...noTargetFindings.values()]).toEqual([]);

    const withTarget = settleTestRoomReward(
      [
        Object.freeze({
          ...initializeTestRewardBranches()[0]!,
          traitHistory: equippedHistory(),
        }),
      ],
      {
        origin: levelAddress.owner,
        offer: { rewardType: 'GiftDrop' },
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        levelResolutionsByAcquisitionRole: {
          self: { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
        },
      },
      1,
      (history) => factsWithHistory(rewardFacts(), history, new Set()),
      new Map(),
    );
    expect(withTarget[0]?.history.consumableRecord.GiftDrop).toBe(1);
    expect(withTarget[0]?.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(2);
  });

  it('requires exact visible cardinality, membership, and eligible equipped targets', () => {
    const before = equippedHistory();
    const invalid = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon'],
        selectedTraitKey: null,
      },
      1,
      before,
      2,
      'Pom',
    );
    expect(invalid.event).toBeUndefined();
    const valid = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
      },
      3,
      before,
      2,
      'Pom',
    );
    expect(valid.history.equippedTraits.ApolloWeaponBoon?.level).toBe(4);

    const unavailableOffer = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon', 'HermesWeaponBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
      },
      1,
      before,
      2,
      'Pom',
    );
    expect(unavailableOffer.event).toBeUndefined();

    const wrongKind = recordReachedLevelResolution(
      catalog,
      levelAddress,
      { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
      1,
      before,
      2,
      'Pom',
      'choice',
    );
    expect(wrongKind.event).toBeUndefined();
  });

  it('records a random Pom as one exact target without a fabricated choice surface', () => {
    const before = equippedHistory();
    const valid = recordReachedLevelResolution(
      catalog,
      levelAddress,
      {
        kind: 'random',
        targetTraitKey: 'ApolloWeaponBoon',
      },
      1,
      before,
      2,
      'RandomPom',
    );
    expect(valid.event?.targetTraitKey).toBe('ApolloWeaponBoon');
    expect(valid.history.equippedTraits.ApolloWeaponBoon?.level).toBe(2);
  });

  it('retains a target that became stale upstream without recording a level mutation', () => {
    const authored = Object.freeze({
      kind: 'choice' as const,
      offeredTraitKeys: Object.freeze(['ApolloWeaponBoon']),
      selectedTraitKey: 'ApolloWeaponBoon',
    });
    const validBefore = equippedHistory();
    expect(
      recordReachedLevelResolution(catalog, levelAddress, authored, 1, validBefore, 2, 'Pom').event,
    ).toEqual(expect.objectContaining({ targetTraitKey: 'ApolloWeaponBoon' }));

    const staleBefore = foldTraitHistoryEvents(catalog, [
      ...validBefore.events,
      {
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: 'replacement',
        sequence: 2,
        giverKey: 'Zeus',
        options: Object.freeze([
          { traitKey: 'ZeusWeaponBoon', rarity: 'Rare' as const },
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' as const },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' as const },
        ]),
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'replacement',
        replacementTransition: {
          slot: 'Melee',
          replacedTraitKey: 'ApolloWeaponBoon',
          oldRarity: 'Common' as const,
          newTraitKey: 'ZeusWeaponBoon',
          requiredRarity: 'Rare' as const,
        },
      },
    ]);
    const stale = recordReachedLevelResolution(
      catalog,
      levelAddress,
      authored,
      1,
      staleBefore,
      3,
      'Pom',
    );
    expect(stale.event).toBeUndefined();
    expect(stale.history).toBe(staleBefore);
    expect(authored.selectedTraitKey).toBe('ApolloWeaponBoon');
  });

  it('applies declaration-owned +2 and +3 visible Pom effects exactly', () => {
    const before = equippedHistory();
    const value = {
      kind: 'choice' as const,
      offeredTraitKeys: ['ApolloWeaponBoon'],
      selectedTraitKey: 'ApolloWeaponBoon',
    };
    const big = recordReachedLevelResolution(
      catalog,
      levelAddress,
      value,
      2,
      before,
      2,
      'PomBig',
      'choice',
    );
    expect(big.history.equippedTraits.ApolloWeaponBoon?.level).toBe(3);
    const triple = recordReachedLevelResolution(
      catalog,
      levelAddress,
      value,
      3,
      big.history,
      3,
      'PomTriple',
      'choice',
    );
    expect(triple.history.equippedTraits.ApolloWeaponBoon?.level).toBe(6);
  });

  it('keeps divergent Pom branch domains and choice counts correlated', () => {
    const artifacts = createLevelResolutionCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(levelAddress),
          [
            {
              address: levelAddress,
              before: equippedHistory(),
              levelCount: 1,
              effectKind: 'choice' as const,
            },
            {
              address: levelAddress,
              before: twoTargetHistory(),
              levelCount: 1,
              effectKind: 'choice' as const,
            },
          ],
        ],
      ]),
    );
    const capability = artifacts.at(levelAddress);
    expect(capability?.branches).toEqual([
      {
        effectKind: 'choice',
        levelCount: 1,
        requiredOfferCount: 1,
        eligibleTargetTraitKeys: ['ApolloWeaponBoon'],
      },
      {
        effectKind: 'choice',
        levelCount: 1,
        requiredOfferCount: 2,
        eligibleTargetTraitKeys: ['ApolloWeaponBoon', 'HestiaSpecialBoon'],
      },
    ]);
    const value = {
      kind: 'choice' as const,
      offeredTraitKeys: ['ApolloWeaponBoon'],
      selectedTraitKey: 'ApolloWeaponBoon',
    };
    expect(capability?.evaluate(value)).toEqual([
      { branchIndex: 0, supported: true, findings: [] },
      { branchIndex: 1, supported: false, findings: ['wrongOfferCount'] },
    ]);
    expect(
      capability?.evaluate({
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon', 'ApolloWeaponBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
      }),
    ).toEqual([
      {
        branchIndex: 0,
        supported: false,
        findings: ['wrongOfferCount', 'duplicateTargets'],
      },
      { branchIndex: 1, supported: false, findings: ['duplicateTargets'] },
    ]);
  });

  it('retains the first blocking reached Pom assessment and exact capability', () => {
    const wheelOwner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat02,
      'wheel1',
      'offer1',
    );
    const address = createLevelResolutionAddress(wheelOwner, 'self');
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: wheelOwner,
      value: { rewardType: 'StackUpgrade' },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const o = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    if (o === undefined || !('rewards' in o)) throw new Error('missing evaluated O reward product');
    expect(o.rewards.selectedLevelResolutions).toContainEqual(
      expect.objectContaining({ address, branches: expect.any(Array) }),
    );
    expect(levelResolutionCandidateForProjectEvaluationAssembly(assembly, address)).toBeDefined();
  });

  it('publishes a purchased Midshop Pom at the unresolved outgoing frontier', () => {
    const project = replaceTestShopOfferActions(
      loadUnderworldFMidshopPomFrontierProject(),
      catalog,
      createOccurrenceAddress(goldenFBiome, fMidshopPomShopId),
      ['Minor'],
    );
    const address = createLevelResolutionAddress(
      createShopOfferAddress(goldenFBiome, fMidshopPomShopId, 'Minor'),
      'self',
    );
    const assembly = simulateProjectAssembly(catalog, project);
    const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
    if (f === undefined || !('rewards' in f) || !('materializedPrefix' in f)) {
      throw new Error('missing progressive F rewards');
    }

    expect(f.materializedPrefix.frontier).toMatchObject({
      kind: 'exitDecision',
      parent: { origin: createOccurrenceAddress(goldenFBiome, fMidshopPomShopId) },
    });
    expect(f.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'missingPomTarget', origin: address }),
    );
    expect(f.rewards.selectedLevelResolutions).toContainEqual(
      expect.objectContaining({ address, reached: true }),
    );
    const capability = levelResolutionCandidateForProjectEvaluationAssembly(assembly, address);
    expect(capability).toBeDefined();
    expect(
      f.rewards.branches
        .flatMap((branch) => branch.events)
        .some((event) => event.kind === 'concreteAcquisition'),
    ).toBe(true);

    const targetTraitKey = capability?.branches[0]?.eligibleTargetTraitKeys[0];
    if (targetTraitKey === undefined) throw new Error('frontier Pom has no eligible target');
    const repaired = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: address,
      value: { kind: 'random', targetTraitKey },
    });
    const repairedAssembly = simulateProjectAssembly(catalog, repaired);
    const repairedF = repairedAssembly.evaluation.route.biomes.find(
      (biome) => biome.biomeKey === 'F',
    );
    if (repairedF === undefined || !('rewards' in repairedF)) {
      throw new Error('missing repaired progressive F rewards');
    }
    expect(
      repairedF.rewards.findings.some(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(address),
      ),
    ).toBe(false);
    expect(repairedF.rewards.selectedLevelResolutions).toContainEqual(
      expect.objectContaining({ address, value: { kind: 'random', targetTraitKey } }),
    );
    expect(
      levelResolutionCandidateForProjectEvaluationAssembly(repairedAssembly, address),
    ).toBeDefined();
  });

  it('keeps the selected Midshop room-exit settlement product identical before and after its outgoing continuation', () => {
    const shop = createOccurrenceAddress(goldenFBiome, fMidshopPomShopId);
    const site = createAcquisitionSiteAddress(shop, 'roomExit');
    const level = createLevelResolutionAddress(
      createShopOfferAddress(goldenFBiome, fMidshopPomShopId, 'Minor'),
      'self',
    );
    const frontier = replaceTestShopOfferActions(
      loadUnderworldFMidshopPomFrontierProject(),
      catalog,
      shop,
      ['Minor'],
    );
    const decision = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: fMidshopPomShopId,
    });
    let continued = applyProjectCommand(frontier, catalog, { kind: 'CreateBatch', decision });
    continued = applyProjectCommand(continued, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, decision.source),
      storeKey: 'RunProgress',
    });
    continued = applyProjectCommand(continued, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, decision.source, 'exit1'),
      occurrenceId: createOccurrenceId('midshop-pom-continuation'),
      gameName: 'F_Story01',
    });
    continued = applyProjectCommand(continued, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, decision.source, 'exit2'),
      occurrenceId: createOccurrenceId('midshop-pom-alternate'),
      gameName: 'F_Story01',
    });
    continued = applyProjectCommand(continued, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, decision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });

    const frontierAssembly = simulateProjectAssembly(catalog, frontier);
    const continuedAssembly = simulateProjectAssembly(catalog, continued);
    const rewardProduct = (assembly: ReturnType<typeof simulateProjectAssembly>) => {
      const evaluated = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
      if (evaluated === undefined || !('rewards' in evaluated)) {
        throw new Error('Midshop fixture did not publish F rewards');
      }
      return evaluated.rewards;
    };
    expect(
      rewardProduct(continuedAssembly).findings.some(
        (finding) =>
          finding.code === 'continuationMissing' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(decision),
      ),
    ).toBe(false);
    const entry = createAcquisitionEntryAddress(site, 'Minor');
    const settled = (assembly: ReturnType<typeof simulateProjectAssembly>) =>
      rewardProduct(assembly).branches.flatMap((branch) =>
        branch.events.filter(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.settlement?.site ?? event.origin) === semanticAddressKey(site),
        ),
      );
    const siteFindings = (assembly: ReturnType<typeof simulateProjectAssembly>) =>
      rewardProduct(assembly).findings.filter((finding) =>
        [semanticAddressKey(site), semanticAddressKey(entry), semanticAddressKey(level)].includes(
          semanticAddressKey(finding.origin),
        ),
      );

    expect(settled(frontierAssembly)).toEqual(settled(continuedAssembly));
    expect(siteFindings(frontierAssembly)).toEqual(siteFindings(continuedAssembly));
    expect(
      rewardProduct(frontierAssembly).selectedLevelResolutions.filter(
        (item) => semanticAddressKey(item.address) === semanticAddressKey(level),
      ),
    ).toEqual(
      rewardProduct(continuedAssembly).selectedLevelResolutions.filter(
        (item) => semanticAddressKey(item.address) === semanticAddressKey(level),
      ),
    );
    const capabilityState = (assembly: ReturnType<typeof simulateProjectAssembly>) =>
      levelResolutionCandidateForProjectEvaluationAssembly(assembly, level)?.branches.map(
        (branch) =>
          Object.freeze({
            eligibleTargetTraitKeys: branch.eligibleTargetTraitKeys,
            emptyTargetAllowed: branch.emptyTargetAllowed,
            levelCount: branch.levelCount,
          }),
      );
    expect(capabilityState(frontierAssembly)).toEqual(capabilityState(continuedAssembly));
    expect(
      rewardProduct(frontierAssembly).branches.map((branch) => branch.history.lootTypeHistory),
    ).toEqual(
      rewardProduct(continuedAssembly).branches.map((branch) => branch.history.lootTypeHistory),
    );
    expect(rewardProduct(frontierAssembly).branches.map((branch) => branch.traitHistory)).toEqual(
      rewardProduct(continuedAssembly).branches.map((branch) => branch.traitHistory),
    );
  });

  it('retains exact Pom assessments and capabilities for downstream findings after an upstream edit', () => {
    const shop = createOccurrenceAddress(goldenFBiome, fMidshopPomShopId);
    const address = createLevelResolutionAddress(
      createShopOfferAddress(goldenFBiome, fMidshopPomShopId, 'Minor'),
      'self',
    );
    let project = replaceTestShopOfferActions(
      loadUnderworldFMidshopPomFrontierProject(),
      catalog,
      shop,
      ['Minor'],
    );
    const prepared = simulateProjectAssembly(catalog, project);
    const targetTraitKey = levelResolutionCandidateForProjectEvaluationAssembly(prepared, address)
      ?.branches[0]?.eligibleTargetTraitKeys[0];
    if (targetTraitKey === undefined) throw new Error('Midshop Pom has no initial target');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: address,
      value: { kind: 'random', targetTraitKey },
    });
    const openingReward = createIncomingRewardAddress(
      goldenFBiome,
      createOccurrenceId('midshop-pom-start'),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: openingReward,
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(openingReward, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
    if (f === undefined || !('rewards' in f)) throw new Error('missing evaluated F reward product');
    const findings = f.rewards.findings.filter(
      (finding) => finding.origin.kind === 'levelResolution',
    );
    expect(findings).not.toHaveLength(0);
    for (const finding of findings) {
      if (finding.origin.kind !== 'levelResolution') continue;
      expect(
        f.rewards.selectedLevelResolutions.some(
          (assessment) =>
            semanticAddressKey(assessment.address) === semanticAddressKey(finding.origin),
        ),
      ).toBe(true);
      expect(
        levelResolutionCandidateForProjectEvaluationAssembly(assembly, finding.origin),
      ).toBeDefined();
    }
  });

  it('retains every divergent Pom surface when identical findings eliminate all carrying branches', () => {
    const oneTarget = equippedHistory();
    const twoTargets = twoTargetHistory();
    const base = initializeTestRewardBranches()[0];
    if (base === undefined) throw new Error('divergent Pom fixture has no initial branch');
    const branches = Object.freeze(
      [oneTarget, twoTargets].map((history) =>
        Object.freeze({
          ...base,
          history: attachTraitHistory(base.history, history),
          traitHistory: history,
        }),
      ),
    );
    const findings = new Map();
    settleTestRoomReward(
      branches,
      {
        origin: levelAddress.owner,
        offer: { rewardType: 'StackUpgrade' },
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        levelResolutionsByAcquisitionRole: {
          self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
        },
      },
      1,
      (history) => factsWithHistory(rewardFacts(), history, new Set()),
      findings,
    );
    const retained = [...findings.values()].find(
      (entry) => entry.finding.code === 'missingPomTarget',
    )?.levelResolutionEvaluations;
    expect(retained).toHaveLength(2);
  });
});
