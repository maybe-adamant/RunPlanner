import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  semanticAddressKey,
  roomActionKey,
  echoLastRewardPickupEntryKey,
  traitGeneratedPickupSiteKey,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import {
  recordLootTypeHistorySource,
  supportedPayloads,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import {
  createPreparedProjectCandidateSession,
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { authorLegalTraitOffers, editTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  evaluateEchoLastRunBoonDomain,
  evaluateEchoPomTargetDomain,
  evaluateTraitOfferFocusedOptionCandidate,
} from '../../src/simulation/candidates/trait-offer/query';
import {
  echoLastRunBoonTraitCandidatesForRow,
  evaluateEchoLastRunBoonDraftSupport,
  nextEchoLastRunBoonDraft,
  previousEchoLastRunBoonDraft,
} from '../../src/simulation/candidates/trait-offer/echo-draft';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome/selected-trait-products';
import {
  assessTraitOption,
  attachTraitHistory,
  createTraitHistoryState,
  echoLastRunBoonOutcomes,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  recordAspectStartingTrait,
  settleFountainRarityMutation,
  type TraitHistoryEvent,
} from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { createKeepsakeState } from '../../src/simulation/keepsakes/state';

type JsonRecord = Record<string, unknown>;

const bridgeId = createOccurrenceId('golden-h-bridge01');
const echoOwner = createTraitOfferAddress(
  createEncounterPhaseAddress(
    goldenHBiome,
    { kind: 'occurrence', occurrenceId: bridgeId },
    'Encounter',
  ),
  'selection',
);
const echoRewardProducerOwner = createTraitOfferAddress(
  createEncounterPhaseAddress(
    goldenHBiome,
    { kind: 'occurrence', occurrenceId: bridgeId },
    'Encounter',
  ),
  'Story_Echo_01',
);

function echoOffer(
  selectedOptionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
  options: AuthoredTraitOfferTraits['options'],
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Echo',
    options,
    selectedOptionKey,
    rarificationActions: Object.freeze([]),
  });
}

function echoTraitOption(traitKey: string): AuthoredTraitOfferTraits['options'][number] {
  return traitKey === 'EchoDoubleLevelBoon'
    ? Object.freeze({ traitKey, echoPomTarget: null })
    : Object.freeze({ traitKey });
}

function baseBranch(history = createTraitHistoryState()) {
  const base = initializeTestRewardBranches()[0]!;
  const attached = attachTraitHistory(base.state.rewardHistory, history);
  return Object.freeze({
    ...base,
    state: Object.freeze({ ...base.state, rewardHistory: attached, traitHistory: history }),
  });
}

function baseBranchWithSources(sources: readonly string[], history = createTraitHistoryState()) {
  const base = initializeTestRewardBranches()[0]!;
  const rewardHistory = sources.reduce(recordLootTypeHistorySource, base.state.rewardHistory);
  return Object.freeze({
    ...base,
    state: Object.freeze({
      ...base.state,
      rewardHistory: attachTraitHistory(rewardHistory, history),
      traitHistory: history,
    }),
  });
}

function echoBoonChild(
  options: AuthoredEchoLastRunBoonOffer['options'],
  selectedOptionKey: AuthoredEchoLastRunBoonOffer['selectedOptionKey'] = 'option1',
): AuthoredEchoLastRunBoonOffer {
  return Object.freeze({ options, selectedOptionKey });
}

function echoBoonOffer(child?: AuthoredEchoLastRunBoonOffer): AuthoredTraitOfferTraits {
  return echoOffer('option1', [
    Object.freeze({
      traitKey: 'EchoLastRunBoon',
      ...(child === undefined ? {} : { echoLastRunBoon: child }),
    }),
    Object.freeze({ traitKey: 'DiminishingDodgeBoon' }),
    Object.freeze({ traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null }),
  ]);
}

function echoRewardOffer(): AuthoredTraitOfferTraits {
  return echoOffer('option1', [
    Object.freeze({ traitKey: 'EchoLastReward' }),
    Object.freeze({ traitKey: 'DiminishingDodgeBoon' }),
    Object.freeze({ traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null }),
  ]);
}

const echoReplayEntryKey = echoLastRewardPickupEntryKey('Encounter', 'Story_Echo_01', 'option1');

function echoReplaySite() {
  return createAcquisitionSiteAddress(createOccurrenceAddress(goldenHBiome, bridgeId), 'roomExit');
}

function echoReplayEntry() {
  return createAcquisitionEntryAddress(echoReplaySite(), echoReplayEntryKey);
}

function bridgeRoom(project: ReturnType<typeof createGoldenFGHProject>) {
  const h = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
    (biome) => biome.biomeKey === 'H',
  );
  if (h === undefined || !('rewards' in h)) throw new Error('H must be evaluated');
  const snapshot = 'snapshot' in h ? h.snapshot : h.materializedPrefix;
  const room = snapshot.decisions
    .filter((decision) => decision.kind === 'batch')
    .flatMap((decision) => decision.targets.map((target) => target.room))
    .find((candidate) => candidate.occurrenceId === bridgeId);
  if (room?.kind !== 'authored') throw new Error('Echo bridge room is missing');
  return room;
}

function completeGoldenFGHProject() {
  return authorLegalTraitOffers(createGoldenFGHProject());
}

function selectGoldenBridge(project = completeGoldenFGHProject()) {
  const selected = authorLegalTraitOffers(
    applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    }),
  );
  return applyProjectCommand(selected, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: echoOwner,
    value: echoOffer('option1', [
      { traitKey: 'DiminishingDodgeBoon' },
      { traitKey: 'DiminishingHealthAndManaBoon' },
      { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
    ]),
  });
}

function placeCombat09Cage2Last(project: ReturnType<typeof createGoldenFGHProject>) {
  return editTestRoomActionOrder(
    project,
    catalog,
    createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat09')),
    (order) => {
      const cage2 = order.find(
        (reference) =>
          reference.kind === 'interactLocalReward' &&
          reference.groupKey === 'cages' &&
          reference.slotKey === 'cage2',
      );
      if (cage2 === undefined) throw new Error('Combat09 Cage 2 action is missing');
      return [...order.filter((reference) => reference !== cage2), cage2];
    },
  );
}

function replaceLatestGoldenRewardWithConsumable(project = selectGoldenBridge()) {
  const selectedReward = createLocalRewardAddress(
    goldenHBiome,
    createOccurrenceId('golden-h-combat09'),
    'cages',
    'cage2',
  );
  const siblingReward = createLocalRewardAddress(
    goldenHBiome,
    createOccurrenceId('golden-h-combat03'),
    'cages',
    'cage1',
  );
  const swappedSibling = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: siblingReward,
    value: { rewardType: 'WeaponUpgrade' },
  });
  const replaced = applyProjectCommand(swappedSibling, catalog, {
    kind: 'ReplaceLocalReward',
    reward: selectedReward,
    value: { rewardType: 'MaxHealthDrop' },
  });
  return Object.freeze({
    rewardType: 'MaxHealthDrop' as const,
    project: placeCombat09Cage2Last(replaced),
  });
}

function makeBridgeOutgoingEligible(project: ReturnType<typeof completeGoldenFGHProject>) {
  const targetId = createOccurrenceId('golden-h-combat05');
  const replaced = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, targetId),
    gameName: 'H_MiniBoss02',
  });
  return authorLegalTraitOffers(
    applyProjectCommand(replaced, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenHBiome, targetId),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    }),
  );
}

function historyFromTraits(
  options: readonly {
    readonly giverKey: string;
    readonly traitKey: string;
    readonly rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic';
  }[],
) {
  return foldTraitHistoryEvents(
    catalog,
    options.map((option, index) =>
      Object.freeze({
        kind: 'traitOffer' as const,
        owner: echoOwner.owner,
        acquisitionRole: `setup${index}`,
        sequence: index + 1,
        giverKey: option.giverKey,
        options: Object.freeze([
          { traitKey: option.traitKey, rarity: option.rarity },
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'setup',
      }),
    ),
  );
}

function ordinaryPoolFor(
  history: ReturnType<typeof baseBranch>['state']['rewardHistory'],
): readonly string[] {
  const rewardType = catalog.rewards.rewardTypes.byKey.Boon;
  if (rewardType === undefined) throw new Error('Boon reward type is missing');
  const facts = {
    requirements: { records: { lootTypeHistory: history.lootTypeHistory } },
  } as RewardKernelFacts;
  return supportedPayloads(catalog.rewards, rewardType, facts).flatMap((payload) =>
    payload.kind === 'BoonSource' ? [payload.source] : [],
  );
}

function priorLeveledTraits() {
  const options = [
    ['Apollo', 'ApolloWeaponBoon'],
    ['Zeus', 'ZeusWeaponBoon'],
    ['Hestia', 'HestiaWeaponBoon'],
  ] as const;
  const events: TraitHistoryEvent[] = options.map(([giverKey, traitKey], index) =>
    Object.freeze({
      kind: 'traitOffer' as const,
      owner: echoOwner.owner,
      acquisitionRole: `prior${index}`,
      sequence: index + 1,
      giverKey,
      options: Object.freeze([
        { traitKey, rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'prior',
    }),
  );
  events.push(
    Object.freeze({
      kind: 'levelMutation' as const,
      owner: echoOwner.owner,
      acquisitionRole: 'priorApolloPom',
      sequence: 4,
      acquisitionPoint: 'prior',
      targetTraitKey: 'ApolloWeaponBoon',
      oldLevel: 1,
      newLevel: 3,
    }),
    Object.freeze({
      kind: 'levelMutation' as const,
      owner: echoOwner.owner,
      acquisitionRole: 'priorZeusPom',
      sequence: 5,
      acquisitionPoint: 'prior',
      targetTraitKey: 'ZeusWeaponBoon',
      oldLevel: 1,
      newLevel: 3,
    }),
    Object.freeze({
      kind: 'levelMutation' as const,
      owner: echoOwner.owner,
      acquisitionRole: 'priorHestiaPom',
      sequence: 6,
      acquisitionPoint: 'prior',
      targetTraitKey: 'HestiaWeaponBoon',
      oldLevel: 1,
      newLevel: 2,
    }),
  );
  return foldTraitHistoryEvents(catalog, events);
}

function echoOfferInDocument(document: JsonRecord): JsonRecord {
  const route = document.route as JsonRecord;
  const biome = (route.biomes as JsonRecord[]).find((candidate) => candidate.biomeKey === 'H')!;
  const topology = biome.topology as JsonRecord;
  const occurrence = (topology.occurrences as JsonRecord[]).find(
    (candidate) => candidate.occurrenceId === bridgeId,
  )!;
  const encounters = occurrence.encounters as JsonRecord;
  const byPhase = encounters.traitOffersByPhase as JsonRecord;
  return ((byPhase.Encounter as JsonRecord).Story_Echo_01 ?? {}) as JsonRecord;
}

describe('Echo Gate A direct choices', () => {
  it.each([
    ['DiminishingDodgeBoon', 'DiminishingHealthAndManaBoon', 'EchoDoubleLevelBoon'],
    ['EchoDeathDefianceRefill', 'DiminishingDodgeBoon', 'EchoDoubleLevelBoon'],
  ] as const)('keeps ordinary exact-three offers legal', (...optionTraitKeys) => {
    const project = completeGoldenFGHProject();
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const value = echoOffer('option1', [
      echoTraitOption(optionTraitKeys[0]),
      echoTraitOption(optionTraitKeys[1]),
      echoTraitOption(optionTraitKeys[2]),
    ]);
    const candidateArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: createTraitHistoryState(),
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    expect(
      (['option1', 'option2', 'option3'] as const).map((optionKey) =>
        evaluateTraitOfferFocusedOptionCandidate(catalog, project, evaluation, candidateArtifacts, {
          kind: 'traitOfferFocusedOption',
          trait: echoOwner,
          value,
          optionKey,
        }),
      ),
    ).toEqual([
      expect.objectContaining({ result: expect.objectContaining({ supported: true }) }),
      expect.objectContaining({ result: expect.objectContaining({ supported: true }) }),
      expect.objectContaining({ result: expect.objectContaining({ supported: true }) }),
    ]);
  });

  it('keeps Survive authorable without a Death Defiance condition', () => {
    const project = completeGoldenFGHProject();
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const value = echoOffer('option1', [
      { traitKey: 'EchoDeathDefianceRefill' },
      { traitKey: 'DiminishingDodgeBoon' },
      { traitKey: 'DiminishingHealthAndManaBoon' },
    ]);
    const candidateArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: createTraitHistoryState(),
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    const survive = evaluateTraitOfferFocusedOptionCandidate(
      catalog,
      project,
      evaluation,
      candidateArtifacts,
      { kind: 'traitOfferFocusedOption', trait: echoOwner, value, optionKey: 'option1' },
    );
    expect(survive).toMatchObject({
      kind: 'traitOfferFocusedOption',
      result: { supported: true },
    });
  });

  it('settles an explicit empty-domain Pom as a legal outer-only no-op', () => {
    const project = completeGoldenFGHProject();
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const value = echoOffer('option1', [
      { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
      { traitKey: 'DiminishingDodgeBoon' },
      { traitKey: 'DiminishingHealthAndManaBoon' },
    ]);
    const candidateArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: createTraitHistoryState(),
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    expect(
      evaluateEchoPomTargetDomain(catalog, project, evaluation, candidateArtifacts, {
        kind: 'echoPomTargetDomain',
        trait: echoOwner,
        value,
        optionKey: 'option1',
      }),
    ).toEqual({
      kind: 'echoPomTargetDomain',
      result: {
        candidates: [
          {
            value: null,
            support: 'forced',
            branchSupport: [true],
            selected: true,
          },
        ],
        emptyNoOpAllowed: true,
      },
    });
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      value,
      10,
      'encounterCompleted',
    );
    expect(
      result.branch.state.traitHistory?.equippedTraits.EchoDoubleLevelBoon?.rarity,
    ).toBeUndefined();
    expect(result.branch.state.traitHistory?.events.map((event) => event.kind)).toEqual([
      'traitOffer',
    ]);
    expect(result.findingEntries).toHaveLength(0);
  });

  it('publishes the pending Gold use from canonical trait history in Run State', () => {
    let project = selectGoldenBridge();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoOffer('option1', [
        { traitKey: 'EchoDoubleShop' },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
      ]),
    });
    const h = simulateProjectAssembly(catalog, project).evaluation.route?.biomes.find(
      (biome) => biome.biomeKey === 'H',
    );
    if (h === undefined || !('rewards' in h)) throw new Error('H reward evaluation is missing');
    const snapshot = h.rewards.runStateSnapshots.find(
      (candidate) => candidate.traits.echoShopDuplicateStatus === 'pending',
    );
    expect(snapshot).toMatchObject({
      owner: {
        kind: 'exitDecision',
        source: { kind: 'occurrence', occurrenceId: bridgeId },
      },
      traits: {
        echoShopDuplicateStatus: 'pending',
        equippedTraits: { EchoDoubleShop: { traitKey: 'EchoDoubleShop' } },
      },
    });
  });

  it('keeps ordinary direct acquisitions on ordinary prerequisite assessment', () => {
    const history = createTraitHistoryState();
    const offer: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Aphrodite',
      options: Object.freeze([
        Object.freeze({ traitKey: 'WeakPotencyBoon', rarity: 'Common' }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      echoOwner,
      'directSelection',
      offer,
      history,
      Object.freeze({ resolvedProviderKey: 'Aphrodite' }),
      0,
      undefined,
      true,
    );

    expect(evaluation.assessments).toEqual([
      expect.objectContaining({
        legal: false,
        findings: expect.arrayContaining([
          expect.objectContaining({ code: 'missingPrerequisite' }),
        ]),
      }),
    ]);
  });

  it.each([
    'DiminishingDodgeBoon',
    'DiminishingHealthAndManaBoon',
    'EchoDeathDefianceRefill',
    'EchoDoubleLevelBoon',
    'EchoDoubleShop',
  ] as const)('retains %s as a rarityless outer acquisition', (traitKey) => {
    const siblingKeys = [
      'DiminishingDodgeBoon',
      'DiminishingHealthAndManaBoon',
      'EchoDoubleLevelBoon',
    ]
      .filter((key) => key !== traitKey)
      .slice(0, 2);
    if (siblingKeys[0] === undefined || siblingKeys[1] === undefined)
      throw new Error('Echo test offer requires two siblings');
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoOffer('option1', [
        echoTraitOption(traitKey),
        echoTraitOption(siblingKeys[0]),
        echoTraitOption(siblingKeys[1]),
      ]),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits[traitKey]).toMatchObject({
      traitKey,
      giverKey: 'Echo',
    });
    expect(result.branch.state.traitHistory?.equippedTraits[traitKey]?.rarity).toBeUndefined();
    if (traitKey === 'EchoDoubleShop') {
      expect(result.branch.state.traitHistory?.equippedTraits[traitKey]?.acquisitionIdentity).toBe(
        `${semanticAddressKey(echoOwner)}:10`,
      );
    }
    expect(result.findingEntries).toHaveLength(0);
  });

  it('acquires Survive without a source-local Death Defiance condition', () => {
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoOffer('option1', [
        { traitKey: 'EchoDeathDefianceRefill' },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
      ]),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.EchoDeathDefianceRefill).toBeDefined();
    expect(result.findingEntries.map((entry) => entry.finding.code)).not.toContain('offerContext');
  });

  it('offers only greatest-level Pom ties and doubles the selected current level', () => {
    const history = priorLeveledTraits();
    const offer = echoOffer('option1', [
      { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: 'ZeusWeaponBoon' },
      { traitKey: 'DiminishingDodgeBoon' },
      { traitKey: 'DiminishingHealthAndManaBoon' },
    ]);
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: history,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    ).at(echoOwner);
    expect(capability?.echoPomTargets(offer, 'option1')).toEqual([
      ['ApolloWeaponBoon', 'ZeusWeaponBoon'],
    ]);

    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      offer,
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.ZeusWeaponBoon?.level).toBe(6);
    expect(result.branch.state.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(3);
    expect(result.branch.state.traitHistory?.equippedTraits.HestiaWeaponBoon?.level).toBe(2);
    expect(result.branch.state.traitHistory?.equippedTraits.EchoDoubleLevelBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.events.slice(-2).map((event) => event.kind)).toEqual([
      'traitOffer',
      'levelMutation',
    ]);
  });

  it.each([
    ['missing', undefined, 'echoPomTargetMissing'],
    ['false no-target', null, 'echoPomNoTargetUnavailable'],
    ['lower-level target', 'HestiaWeaponBoon', 'echoPomTargetUnavailable'],
  ] as const)('retains the outer Pom acquisition for a %s child', (_label, target, code) => {
    const history = priorLeveledTraits();
    const option = {
      traitKey: 'EchoDoubleLevelBoon',
      ...(target === undefined ? {} : { echoPomTarget: target }),
    };
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoOffer('option1', [
        option,
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
      ]),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.EchoDoubleLevelBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.equippedTraits.HestiaWeaponBoon?.level).toBe(2);
    expect(result.findingEntries.map((entry) => entry.finding.code)).toContain(code);
  });

  it('binds the real H Bridge offer, preserves its strict child through codec, and publishes Run State', () => {
    const project = selectGoldenBridge();
    const bridge = project.route.biomes
      .find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    expect(offer).toEqual({
      kind: 'traits',
      giverKey: 'Echo',
      options: [
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
        { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    });
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
    expect(decoded.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION);
    const invalidRarityDocument = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const invalidRarityOffer = echoOfferInDocument(invalidRarityDocument);
    ((invalidRarityOffer.options as JsonRecord[])[0] ?? {}).rarity = 'Common';
    expect(() => decodeProjectDocument(invalidRarityDocument, catalog)).toThrow(
      /options\.option1\.rarity: rarityless options have no rarity/,
    );
    const assembly = simulateProjectAssembly(catalog, decoded);
    const h = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'H')!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    expect(
      h.rewards.runStateSnapshots.some(
        (snapshot) => snapshot.traits.equippedTraits.DiminishingDodgeBoon !== undefined,
      ),
    ).toBe(true);
    if (offer?.kind !== 'traits') throw new Error('Echo offer must be traits');
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'echoPomTargetDomain',
        trait: echoOwner,
        value: offer,
        optionKey: 'option3',
      }).kind,
    ).toBe('echoPomTargetDomain');
  });

  it('rejects unknown and non-Pom encoded Echo target children', () => {
    const project = selectGoldenBridge();
    const unknownDocument = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const unknownOffer = echoOfferInDocument(unknownDocument);
    const unknownOptions = unknownOffer.options as JsonRecord[];
    unknownOptions[2]!.echoPomTarget = 'UnknownTrait';
    expect(() => decodeProjectDocument(unknownDocument, catalog)).toThrow(
      'unknown trait UnknownTrait',
    );

    const misplaced = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const misplacedOffer = echoOfferInDocument(misplaced);
    (misplacedOffer.options as JsonRecord[])[0]!.echoPomTarget = null;
    expect(() => decodeProjectDocument(misplaced, catalog)).toThrow(
      'is supported only by Echo Pom',
    );

    const malformed = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const malformedOffer = echoOfferInDocument(malformed);
    (malformedOffer.options as JsonRecord[])[2]!.echoPomTarget = 7;
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow('must be a trait key or null');
  });

  it('retains the real H invalid Pom outer checkpoint and excludes later state', () => {
    let project = selectGoldenBridge();
    const bridge = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (offer?.kind !== 'traits') throw new Error('Echo offer must be traits');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: Object.freeze({
        ...offer,
        selectedOptionKey: 'option3',
        options: Object.freeze([
          offer.options[0],
          offer.options[1],
          Object.freeze({ ...offer.options[2], echoPomTarget: 'ZeusWeaponBoon' }),
        ]) as AuthoredTraitOfferTraits['options'],
      }),
    });
    const h = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    const child = createEchoPomTargetAddress(echoOwner, 'option3');
    expect(h.coverage).toMatchObject({ kind: 'prefix', blockedAt: child });
    expect(h.rewards.branches).toHaveLength(1);
    expect(h.rewards.branches[0]?.state.traitHistory?.equippedTraits).toMatchObject({
      ApolloWeaponBoon: { level: 2 },
      EchoDoubleLevelBoon: { traitKey: 'EchoDoubleLevelBoon' },
    });
    expect(
      h.rewards.branches[0]?.state.traitHistory?.equippedTraits.EchoDoubleLevelBoon?.rarity,
    ).toBeUndefined();
    expect(
      h.rewards.branches[0]?.state.traitHistory?.equippedTraits.ZeusWeaponBoon,
    ).toBeUndefined();
    expect(h.findings).toContainEqual(
      expect.objectContaining({ code: 'echoPomTargetUnavailable', origin: child }),
    );
    const echoSnapshots = h.rewards.runStateSnapshots.filter(
      (snapshot) => snapshot.traits.equippedTraits.EchoDoubleLevelBoon !== undefined,
    );
    expect(echoSnapshots).toHaveLength(1);
    expect(echoSnapshots[0]?.traits.equippedTraits.EchoDoubleLevelBoon?.rarity).toBeUndefined();
    expect(echoSnapshots[0]?.owner).toMatchObject({
      kind: 'exitDecision',
      source: { kind: 'occurrence', occurrenceId: bridgeId },
    });
    expect(
      h.rewards.runStateAvailability.some((entry) => entry.availability === 'unavailable'),
    ).toBe(true);
    expect(
      project
        .route!.biomes.find((biome) => biome.biomeKey === 'H')!
        .topology!.occurrences.some(
          (occurrence) => occurrence.occurrenceId === 'golden-h-combat05',
        ),
    ).toBe(true);
    expect(
      h.rewards.branches[0]?.events.some(
        (event) =>
          'occurrenceId' in event.origin && event.origin.occurrenceId === 'golden-h-combat05',
      ),
    ).toBe(false);
  });
});

describe('Echo Gate B Boon Boon Boon', () => {
  it('publishes the source-resolved domain, exact equipped rarities, and Common floor', () => {
    const outcomes = echoLastRunBoonOutcomes(catalog, createTraitHistoryState(), {
      routeKey: 'Underworld',
    });
    expect([...new Set(outcomes.map((outcome) => outcome.option.giverKey))]).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Demeter',
      'Hephaestus',
      'Hera',
      'Hestia',
      'Poseidon',
      'Zeus',
      'Hermes',
      'Artemis',
      'Athena',
      'Dionysus',
    ]);
    expect([...new Set(outcomes.map((outcome) => outcome.option.rarity))]).toEqual([
      'Common',
      'Rare',
      'Epic',
      'Heroic',
      'Legendary',
      'Duo',
    ]);
    expect(
      outcomes
        .filter((outcome) => outcome.option.traitKey === 'SprintEchoBoon')
        .map((outcome) => outcome.option.giverKey),
    ).toEqual(['Aphrodite', 'Zeus']);

    const floorHistory = Object.freeze({
      ...createTraitHistoryState(),
      properUpbringingActive: true as const,
    });
    const floored = echoLastRunBoonOutcomes(catalog, floorHistory, { routeKey: 'Underworld' }).find(
      (outcome) =>
        outcome.option.giverKey === 'Aphrodite' &&
        outcome.option.traitKey === 'AphroditeWeaponBoon' &&
        outcome.option.rarity === 'Common',
    );
    expect(floored).toMatchObject({ effectiveRarity: 'Rare', assessment: { legal: true } });
  });

  it('keeps nested Athena candidates authorable without an outer Death Defiance condition', () => {
    const history = createTraitHistoryState();
    const child = echoBoonChild(
      Object.freeze([
        { giverKey: 'Athena', traitKey: 'DeathDefianceRefillBoon', rarity: 'Common' },
      ]),
    );
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: history,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    ).at(echoOwner);
    const firstAthena = capability
      ?.echoLastRunBoon(echoBoonOffer(child), 'option1')[0]
      ?.find((outcome) => outcome.option.traitKey === 'DeathDefianceRefillBoon');
    const secondAthena = capability
      ?.echoLastRunBoon(echoBoonOffer(child), 'option1')[0]
      ?.find((outcome) => outcome.option.traitKey === 'DeathDefianceRefillBoon');
    expect(firstAthena).toMatchObject({ assessment: { legal: true } });
    expect(secondAthena).toMatchObject({ assessment: { legal: true } });
    const uninvestedTaskForce = capability
      ?.echoLastRunBoon(echoBoonOffer(child), 'option1')[0]
      ?.find((outcome) => outcome.option.traitKey === 'OlympianSpellCountBoon');
    expect(uninvestedTaskForce).toMatchObject({ assessment: { legal: false } });
    const settledCapability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: history,
              context: Object.freeze({ resolvedProviderKey: 'Echo', settledSpellDrop: true }),
            }),
          ],
        ],
      ]),
    ).at(echoOwner);
    expect(
      settledCapability
        ?.echoLastRunBoon(echoBoonOffer(child), 'option1')[0]
        ?.find((outcome) => outcome.option.traitKey === 'OlympianSpellCountBoon'),
    ).toMatchObject({ assessment: { legal: true } });

    const onlyAthena = Object.freeze({
      ...history,
      bannedTraitKeys: Object.freeze([
        ...new Set(
          catalog.echoLastRunBoon.variants.values
            .map((variant) => variant.traitKey)
            .filter((traitKey) => traitKey !== 'DeathDefianceRefillBoon'),
        ),
      ]),
    });
    expect(
      assessTraitOption(catalog, 'EchoLastRunBoon', onlyAthena, {
        routeKey: 'Underworld',
        resolvedProviderKey: 'Echo',
      }).legal,
    ).toBe(true);

    const rejected = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoBoonOffer(child),
      10,
      'encounterCompleted',
    );
    expect(rejected.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon).toBeDefined();
    expect(
      rejected.branch.state.traitHistory?.equippedTraits.DeathDefianceRefillBoon,
    ).toMatchObject({
      giverKey: 'Athena',
      rarity: 'Common',
    });
    const accepted = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoBoonOffer(child),
      10,
      'encounterCompleted',
    );
    expect(
      accepted.branch.state.traitHistory?.equippedTraits.DeathDefianceRefillBoon,
    ).toMatchObject({
      giverKey: 'Athena',
      rarity: 'Common',
    });
  });

  it('publishes row-distinct transient domains without choosing an append default', () => {
    const project = completeGoldenFGHProject();
    const history = createTraitHistoryState();
    const child = echoBoonChild(
      Object.freeze([
        { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
      ] as const),
    );
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: history,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    const domain = evaluateEchoLastRunBoonDomain(
      catalog,
      project,
      simulateProjectAssembly(catalog, project).evaluation,
      artifacts,
      {
        kind: 'echoLastRunBoonDomain',
        trait: echoOwner,
        value: echoBoonOffer(child),
        optionKey: 'option1',
      },
    );
    if (domain.kind !== 'echoLastRunBoonDomain') throw new Error('Echo domain is unavailable');
    const firstRow = echoLastRunBoonTraitCandidatesForRow(
      domain.result.candidates,
      ['ApolloWeaponBoon'],
      { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon' },
    );
    expect(
      firstRow.find((candidate) => candidate.value.traitKey === 'ZeusWeaponBoon'),
    ).toMatchObject({ selected: true });
    expect(
      firstRow.find((candidate) => candidate.value.traitKey === 'ApolloWeaponBoon')?.support,
    ).toBe('impossible');
    const newRow = echoLastRunBoonTraitCandidatesForRow(
      domain.result.candidates,
      ['ZeusWeaponBoon', 'ApolloWeaponBoon'],
      undefined,
    );
    expect(
      newRow.filter((candidate) =>
        ['ZeusWeaponBoon', 'ApolloWeaponBoon'].includes(candidate.value.traitKey),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ support: 'impossible' }),
        expect.objectContaining({ support: 'impossible' }),
      ]),
    );
    const duoVariants = echoLastRunBoonTraitCandidatesForRow(
      domain.result.candidates,
      ['SprintEchoBoon'],
      undefined,
    ).filter((candidate) => candidate.value.traitKey === 'SprintEchoBoon');
    expect(duoVariants.map((candidate) => candidate.value.giverKey)).toEqual(['Aphrodite', 'Zeus']);
    expect(duoVariants.every((candidate) => candidate.support === 'impossible')).toBe(true);
    const exhausted = evaluateEchoLastRunBoonDraftSupport(
      domain.result.candidates.filter((candidate) =>
        ['ZeusWeaponBoon', 'ApolloWeaponBoon'].includes(candidate.option.traitKey),
      ),
      [
        { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
      ],
      0,
    );
    expect(exhausted).toMatchObject({
      rowSupport: [true, true],
      complete: true,
      remainingTraitIdentities: [],
      canAppend: false,
    });
    const prefix = Object.freeze({
      giverKey: 'Hera',
      traitKey: 'AllElementalBoon',
      rarity: 'Legendary' as const,
      allTogetherResult: Object.freeze({ earth: null, fire: null, air: null, water: null }),
    });
    const candidates = domain.result.candidates;
    const first = nextEchoLastRunBoonDraft(candidates, [prefix], 0)!;
    expect(first.rows).toEqual([prefix, {}]);
    expect(first.rows[0]).toBe(prefix);
    const full = nextEchoLastRunBoonDraft(candidates, first.rows, 1)!;
    expect(full).toEqual({ rows: [prefix, {}, {}], selectedIndex: 1 });
    expect(full.rows[0]?.allTogetherResult).toBe(prefix.allTogetherResult);
    expect(nextEchoLastRunBoonDraft(candidates, full.rows, 1)).toBeUndefined();
    expect(nextEchoLastRunBoonDraft([], first.rows, 0)).toBeUndefined();
    expect(nextEchoLastRunBoonDraft(candidates, [], 0)).toBeUndefined();
    expect(nextEchoLastRunBoonDraft(candidates, [{}, {}, {}, {}], 0)).toBeUndefined();
    for (const selectedIndex of [0, 1, 2]) {
      const removed = previousEchoLastRunBoonDraft(full.rows, selectedIndex)!;
      expect(removed).toEqual({ rows: [prefix, {}], selectedIndex: Math.min(selectedIndex, 1) });
      expect(removed.rows[0]).toBe(prefix);
    }
    const targeted = Object.freeze({
      giverKey: 'Hera',
      traitKey: 'BoonDecayBoon',
      targetTraitKey: 'ZeusWeaponBoon',
    });
    const natural = Object.freeze({
      giverKey: 'Demeter',
      traitKey: 'GoodStuffBoon',
      naturalSelectionTargets: ['ZeusWeaponBoon'] as const,
    });
    expect(previousEchoLastRunBoonDraft([targeted, natural, {}], 2)?.rows).toEqual([
      targeted,
      natural,
    ]);
    expect(previousEchoLastRunBoonDraft([{}], 0)).toBeUndefined();
    expect(previousEchoLastRunBoonDraft([], 0)).toBeUndefined();
    expect(previousEchoLastRunBoonDraft([{}, {}, {}, {}], 0)).toBeUndefined();
  });

  it('does not union BBB support across divergent pre-choice branches', () => {
    const project = completeGoldenFGHProject();
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: createTraitHistoryState(),
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
            Object.freeze({
              before: historyFromTraits([
                {
                  giverKey: 'Aphrodite',
                  traitKey: 'AphroditeWeaponBoon',
                  rarity: 'Common',
                },
              ]),
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    const domain = evaluateEchoLastRunBoonDomain(
      catalog,
      project,
      simulateProjectAssembly(catalog, project).evaluation,
      artifacts,
      {
        kind: 'echoLastRunBoonDomain',
        trait: echoOwner,
        value: echoBoonOffer(),
        optionKey: 'option1',
      },
    );
    if (domain.kind !== 'echoLastRunBoonDomain') throw new Error('Echo domain is unavailable');
    expect(
      domain.result.candidates.find(
        (candidate) =>
          candidate.option.giverKey === 'Aphrodite' &&
          candidate.option.traitKey === 'AphroditeWeaponBoon' &&
          candidate.option.rarity === 'Common',
      ),
    ).toMatchObject({
      support: 'impossible',
      branchSupport: [true, false],
      reason: 'branchDivergence',
    });
  });

  it('rejects one cached BBB rarity when retained branches disagree on its granted rarity', () => {
    const project = completeGoldenFGHProject();
    const ordinary = createTraitHistoryState();
    const floored = Object.freeze({
      ...createTraitHistoryState(),
      properUpbringingActive: true as const,
    });
    const child = echoBoonChild(
      Object.freeze([
        {
          giverKey: 'Aphrodite',
          traitKey: 'AphroditeWeaponBoon',
          rarity: 'Common',
        },
      ]),
    );
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: ordinary,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
            Object.freeze({
              before: floored,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    const domain = evaluateEchoLastRunBoonDomain(
      catalog,
      project,
      simulateProjectAssembly(catalog, project).evaluation,
      artifacts,
      {
        kind: 'echoLastRunBoonDomain',
        trait: echoOwner,
        value: echoBoonOffer(child),
        optionKey: 'option1',
      },
    );
    if (domain.kind !== 'echoLastRunBoonDomain') throw new Error('Echo domain is unavailable');
    const candidate = domain.result.candidates.find(
      (entry) =>
        entry.option.giverKey === 'Aphrodite' &&
        entry.option.traitKey === 'AphroditeWeaponBoon' &&
        entry.option.rarity === 'Common',
    );
    expect(candidate).toMatchObject({
      support: 'impossible',
      branchSupport: [true, true],
      reason: 'branchDivergence',
    });
    expect(candidate?.effectiveRarity).toBeUndefined();
    expect(
      evaluateEchoLastRunBoonDraftSupport(
        domain.result.candidates,
        [
          {
            giverKey: 'Aphrodite',
            traitKey: 'AphroditeWeaponBoon',
            rarity: 'Common',
          },
        ],
        0,
      ),
    ).toMatchObject({ rowSupport: [false], complete: false });
  });

  it.each([
    [
      'prerequisite-gated secondary',
      createTraitHistoryState(),
      { giverKey: 'Aphrodite', traitKey: 'WeakPotencyBoon', rarity: 'Common' as const },
    ],
    [
      'Heroic',
      createTraitHistoryState(),
      { giverKey: 'Aphrodite', traitKey: 'AphroditeWeaponBoon', rarity: 'Heroic' as const },
    ],
    [
      'Common',
      createTraitHistoryState(),
      { giverKey: 'Aphrodite', traitKey: 'AphroditeWeaponBoon', rarity: 'Common' as const },
    ],
    [
      'Legendary',
      createTraitHistoryState(),
      { giverKey: 'Aphrodite', traitKey: 'RandomStatusBoon', rarity: 'Legendary' as const },
    ],
    [
      'Duo',
      createTraitHistoryState(),
      { giverKey: 'Aphrodite', traitKey: 'SprintEchoBoon', rarity: 'Duo' as const },
    ],
  ] as const)(
    'directly equips one %s nested trait without its ordinary offer prerequisites',
    (_label, history, option) => {
      const result = settleEncounterTraitOffer(
        catalog,
        baseBranch(history),
        echoOwner.owner,
        echoBoonOffer(
          echoBoonChild(Object.freeze([option]) as AuthoredEchoLastRunBoonOffer['options']),
        ),
        10,
        'encounterCompleted',
      );
      expect(result.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon).toMatchObject({
        giverKey: 'Echo',
        traitKey: 'EchoLastRunBoon',
      });
      expect(
        result.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon?.rarity,
      ).toBeUndefined();
      expect(result.branch.state.traitHistory?.equippedTraits[option.traitKey]).toMatchObject({
        giverKey: option.giverKey,
        rarity: option.rarity,
        traitKey: option.traitKey,
      });
      const outcome = echoLastRunBoonOutcomes(catalog, history, { routeKey: 'Underworld' }).find(
        (candidate) =>
          candidate.option.giverKey === option.giverKey &&
          candidate.option.traitKey === option.traitKey &&
          candidate.option.rarity === option.rarity,
      );
      expect(outcome).toBeDefined();
      expect(result.branch.state.traitHistory?.equippedTraits[option.traitKey]?.level).toBe(
        outcome?.effectiveLevel,
      );
      if (_label === 'Heroic' || _label === 'Common') expect(outcome?.effectiveLevel).toBe(1);
      if (_label === 'Duo' || _label === 'Legendary')
        expect(outcome?.effectiveLevel).toBeUndefined();
      expect(
        result.branch.state.traitHistory?.events
          .slice(-2)
          .map((event) =>
            event.kind === 'traitOffer'
              ? [event.giverKey, event.options[0]?.traitKey]
              : [event.kind],
          ),
      ).toEqual([
        ['Echo', 'EchoLastRunBoon'],
        [option.giverKey, option.traitKey],
      ]);
      expect(result.findingEntries).toHaveLength(0);
    },
  );

  it('retains only current-run BBB replay exclusions after bypassing ordinary prerequisites', () => {
    const empty = echoLastRunBoonOutcomes(catalog, createTraitHistoryState(), {
      routeKey: 'Underworld',
    });
    expect(
      empty.find(
        (outcome) =>
          outcome.option.giverKey === 'Aphrodite' &&
          outcome.option.traitKey === 'WeakPotencyBoon' &&
          outcome.option.rarity === 'Common',
      ),
    ).toMatchObject({ assessment: { legal: true } });
    expect(
      catalog.echoLastRunBoon.variants.values.some((variant) => variant.giverKey === 'Hades'),
    ).toBe(false);

    const equipped = echoLastRunBoonOutcomes(
      catalog,
      historyFromTraits([{ giverKey: 'Aphrodite', traitKey: 'WeakPotencyBoon', rarity: 'Common' }]),
      { routeKey: 'Underworld' },
    ).find((outcome) => outcome.option.traitKey === 'WeakPotencyBoon');
    expect(equipped).toMatchObject({
      assessment: {
        legal: false,
        findings: expect.arrayContaining([expect.objectContaining({ code: 'alreadyEquipped' })]),
      },
    });

    const occupied = echoLastRunBoonOutcomes(
      catalog,
      historyFromTraits([{ giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' }]),
      { routeKey: 'Underworld' },
    ).find(
      (outcome) =>
        outcome.option.giverKey === 'Aphrodite' &&
        outcome.option.traitKey === 'AphroditeWeaponBoon' &&
        outcome.option.rarity === 'Common',
    );
    expect(occupied).toMatchObject({
      assessment: {
        legal: false,
        findings: expect.arrayContaining([expect.objectContaining({ code: 'occupiedBoonSlot' })]),
      },
    });

    const banned = echoLastRunBoonOutcomes(
      catalog,
      Object.freeze({
        ...createTraitHistoryState(),
        bannedTraitKeys: Object.freeze(['WeakPotencyBoon']),
      }),
      { routeKey: 'Underworld' },
    ).find((outcome) => outcome.option.traitKey === 'WeakPotencyBoon');
    expect(banned).toMatchObject({
      assessment: {
        legal: false,
        findings: expect.arrayContaining([expect.objectContaining({ code: 'bannedTrait' })]),
      },
    });
  });

  it('bypasses linked groups but retains exact eligibility at its pre-choice context', () => {
    const outcome = (
      traitKey: string,
      history: ReturnType<typeof createTraitHistoryState>,
      context: Parameters<typeof echoLastRunBoonOutcomes>[2],
    ) => {
      const value = echoLastRunBoonOutcomes(catalog, history, {
        routeKey: 'Underworld',
        ...context,
      }).find((candidate) => candidate.option.traitKey === traitKey);
      expect(value).toBeDefined();
      return value!;
    };
    const empty = createTraitHistoryState();

    expect(outcome('WeakPotencyBoon', empty, {}).assessment.legal).toBe(true);
    expect(outcome('SprintEchoBoon', empty, { devotionNoDuo: false }).assessment.legal).toBe(true);
    expect(outcome('SprintEchoBoon', empty, { devotionNoDuo: true }).assessment).toMatchObject({
      legal: false,
      findings: expect.arrayContaining([expect.objectContaining({ code: 'offerContext' })]),
    });
    expect(
      outcome('PlantHealthBoon', empty, { routeKey: 'Underworld', blockGiftBoons: true }).assessment
        .legal,
    ).toBe(false);
    expect(outcome('OlympianSpellCountBoon', empty, {}).assessment.legal).toBe(false);
    expect(
      outcome('OlympianSpellCountBoon', empty, { settledSpellDrop: true }).assessment.legal,
    ).toBe(true);

    const fireHistory = historyFromTraits([
      { giverKey: 'Apollo', traitKey: 'ApolloCastBoon', rarity: 'Common' },
      { giverKey: 'Apollo', traitKey: 'ApolloSprintBoon', rarity: 'Common' },
    ]);
    expect(outcome('ElementalRallyBoon', empty, {}).assessment.legal).toBe(false);
    expect(outcome('ElementalRallyBoon', fireHistory, {}).assessment.legal).toBe(true);
    expect(outcome('CastProjectileBoon', empty, {}).assessment.legal).toBe(true);
    expect(
      outcome(
        'CastProjectileBoon',
        historyFromTraits([{ giverKey: 'Zeus', traitKey: 'CastAnywhereBoon', rarity: 'Common' }]),
        {},
      ).assessment.legal,
    ).toBe(false);
  });

  it('publishes Bridal Glow targets and retains its missing acquisition detail after the outer trait', () => {
    const history = historyFromTraits([
      { giverKey: 'Hephaestus', traitKey: 'HephaestusWeaponBoon', rarity: 'Common' },
    ]);
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: history,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    ).at(echoOwner);
    const offer = echoBoonOffer(
      echoBoonChild(
        Object.freeze([{ giverKey: 'Hera', traitKey: 'BoonDecayBoon', rarity: 'Heroic' }]),
      ),
    );
    const outcome = capability
      ?.echoLastRunBoon(offer, 'option1')[0]
      ?.find(
        (candidate) =>
          candidate.option.giverKey === 'Hera' &&
          candidate.option.traitKey === 'BoonDecayBoon' &&
          candidate.option.rarity === 'Heroic',
      );
    expect(outcome).toMatchObject({
      assessment: { legal: true },
      targetTraitKeys: ['HephaestusWeaponBoon'],
    });
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      offer,
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.equippedTraits.BoonDecayBoon).toBeUndefined();
    expect(result.branch.state.traitHistory?.equippedTraits.HephaestusWeaponBoon).toMatchObject({
      rarity: 'Common',
      level: 1,
    });
    expect(result.branch.state.rewardHistory.lootTypeHistory).toEqual({});
    expect(result.findingEntries.map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'targetedAcquisitionTargetMissing',
        origin: createEchoLastRunBoonAddress(echoOwner, 'option1'),
      }),
    );
  });

  it('publishes the selected Echo carrier domain from the same pre-acquisition frontier', () => {
    const project = completeGoldenFGHProject();
    const history = historyFromTraits([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'CommonGlobalDamageBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'DamageSharePotencyBoon', rarity: 'Common' },
    ]);
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: history,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    const allTogether = evaluateEchoLastRunBoonDomain(
      catalog,
      project,
      simulateProjectAssembly(catalog, project).evaluation,
      artifacts,
      {
        kind: 'echoLastRunBoonDomain',
        trait: echoOwner,
        value: echoBoonOffer(
          echoBoonChild(
            Object.freeze([
              { giverKey: 'Hera', traitKey: 'AllElementalBoon', rarity: 'Legendary' },
            ]),
          ),
        ),
        optionKey: 'option1',
      },
    );
    expect(allTogether).toMatchObject({
      kind: 'echoLastRunBoonDomain',
      result: {
        selectedCarrier: {
          kind: 'allTogether',
          complete: false,
          sets: [{ setKey: 'earth' }, { setKey: 'fire' }, { setKey: 'air' }, { setKey: 'water' }],
        },
      },
    });

    const naturalHistory = historyFromTraits([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    ]);
    const naturalArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: naturalHistory,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    const natural = evaluateEchoLastRunBoonDomain(
      catalog,
      project,
      simulateProjectAssembly(catalog, project).evaluation,
      naturalArtifacts,
      {
        kind: 'echoLastRunBoonDomain',
        trait: echoOwner,
        value: echoBoonOffer(
          echoBoonChild(
            Object.freeze([{ giverKey: 'Demeter', traitKey: 'GoodStuffBoon', rarity: 'Duo' }]),
          ),
        ),
        optionKey: 'option1',
      },
    );
    expect(natural).toMatchObject({
      kind: 'echoLastRunBoonDomain',
      result: {
        selectedCarrier: {
          kind: 'naturalSelection',
          slotCount: 8,
          complete: false,
          supported: false,
          nextTargetCandidates: [
            expect.objectContaining({ value: 'ApolloWeaponBoon', support: 'forced' }),
          ],
        },
      },
    });
  });

  it('keeps fallback-only Bridal Glow targets out of BBB availability', () => {
    const history = historyFromTraits([
      { giverKey: 'Hephaestus', traitKey: 'HephaestusWeaponBoon', rarity: 'Heroic' },
    ]);
    const outcome = echoLastRunBoonOutcomes(catalog, history, { routeKey: 'Underworld' }).find(
      (candidate) =>
        candidate.option.giverKey === 'Hera' &&
        candidate.option.traitKey === 'BoonDecayBoon' &&
        candidate.option.rarity === 'Common',
    );
    expect(outcome).toMatchObject({
      targetTraitKeys: [],
      assessment: {
        legal: false,
        findings: expect.arrayContaining([
          expect.objectContaining({ code: 'targetedAcquisitionNoEligibleTarget' }),
        ]),
      },
    });
  });

  it('reuses Bridal Glow acquisition semantics for the selected Echo outcome', () => {
    const history = historyFromTraits([
      { giverKey: 'Hephaestus', traitKey: 'HephaestusWeaponBoon', rarity: 'Common' },
    ]);
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            {
              giverKey: 'Hera',
              traitKey: 'BoonDecayBoon',
              rarity: 'Common',
              targetTraitKey: 'HephaestusWeaponBoon',
            },
          ]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.BoonDecayBoon).toMatchObject({
      giverKey: 'Hera',
      rarity: 'Common',
    });
    expect(result.branch.state.traitHistory?.events.at(-2)).toMatchObject({
      kind: 'traitOffer',
      targetedAcquisitionTransition: {
        kind: 'promoteGodTraitToHeroic',
        targetTraitKey: 'HephaestusWeaponBoon',
      },
    });
    expect(result.branch.state.traitHistory?.equippedTraits.HephaestusWeaponBoon).toMatchObject({
      rarity: 'Heroic',
      level: 2,
    });
    const promoted = settleFountainRarityMutation(
      catalog,
      result.branch.state.traitHistory!,
      echoOwner.owner,
      11,
      'BoonDecayBoon',
    );
    expect(promoted.legal).toBe(true);
    expect(promoted.history.equippedTraits.HephaestusWeaponBoon).toMatchObject({
      rarity: 'Heroic',
      level: 5,
    });
    expect(result.branch.state.rewardHistory.lootTypeHistory.HeraUpgrade).toBe(1);
  });

  it('reuses All Together direct grants for the selected Echo outcome', () => {
    const allTogetherResult = Object.freeze({
      earth: 'ElementalDamageBoon',
      fire: 'ElementalBaseDamageBoon',
      air: 'ElementalDamageFloorBoon',
      water: 'ElementalHealthBoon',
    });
    const history = historyFromTraits([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'CommonGlobalDamageBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'DamageSharePotencyBoon', rarity: 'Common' },
    ]);
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            {
              giverKey: 'Hera',
              traitKey: 'AllElementalBoon',
              rarity: 'Legendary',
              allTogetherResult,
            },
          ]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.AllElementalBoon).toBeDefined();
    for (const traitKey of Object.values(allTogetherResult))
      expect(result.branch.state.traitHistory?.equippedTraits[traitKey]).toBeDefined();
  });

  it('retains a nested All Together child finding at its exact repair checkpoint', () => {
    const history = historyFromTraits([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'CommonGlobalDamageBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'DamageSharePotencyBoon', rarity: 'Common' },
    ]);
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([{ giverKey: 'Hera', traitKey: 'AllElementalBoon', rarity: 'Legendary' }]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    if (result.blockedChild === undefined)
      throw new Error('nested All Together checkpoint missing');
    expect(result.blockedChild.address).toEqual(createEchoLastRunBoonAddress(echoOwner, 'option1'));
    expect(result.findingEntries).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({
          code: 'allTogetherResultMissing',
          origin: result.blockedChild.address,
        }),
      }),
    );
  });

  it('reuses Natural Selection target order for the selected Echo outcome', () => {
    const target = 'ApolloWeaponBoon';
    const history = historyFromTraits([{ giverKey: 'Apollo', traitKey: target, rarity: 'Common' }]);
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            {
              giverKey: 'Demeter',
              traitKey: 'GoodStuffBoon',
              rarity: 'Duo',
              naturalSelectionTargets: [
                target,
                target,
                target,
                target,
                target,
                target,
                target,
                target,
              ] as const,
            },
          ]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.GoodStuffBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.equippedTraits[target]).toMatchObject({ level: 9 });
  });

  it('requires targeted detail only from the selected nested row', () => {
    const history = historyFromTraits([
      { giverKey: 'Hephaestus', traitKey: 'HephaestusWeaponBoon', rarity: 'Common' },
    ]);
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            { giverKey: 'Apollo', traitKey: 'ApolloCastBoon', rarity: 'Common' },
            { giverKey: 'Hera', traitKey: 'BoonDecayBoon', rarity: 'Heroic' },
          ] as const),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.equippedTraits.ApolloCastBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.equippedTraits.BoonDecayBoon).toBeUndefined();
    expect(result.findingEntries.map((entry) => entry.finding)).not.toContainEqual(
      expect.objectContaining({ code: 'targetedAcquisitionTargetMissing' }),
    );
  });

  it('reuses Cherished Heirloom current-keepsake acquisition semantics', () => {
    const history = historyFromTraits([
      { giverKey: 'Demeter', traitKey: 'DemeterWeaponBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'HeraCastBoon', rarity: 'Common' },
    ]);
    const initial = baseBranch(history);
    const keepsakes = createKeepsakeState(catalog, 'GoldifyKeepsake', initial.state.arcanaFear);
    const result = settleEncounterTraitOffer(
      catalog,
      Object.freeze({
        ...initial,
        state: Object.freeze({ ...initial.state, keepsakes: keepsakes }),
      }),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([{ giverKey: 'Demeter', traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' }]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.KeepsakeLevelBoon).toMatchObject({
      giverKey: 'Demeter',
      rarity: 'Duo',
    });
    expect(keepsakes.timePiece?.remainingCharges).toBe(4);
    expect(result.branch.state.keepsakes.timePiece?.remainingCharges).toBe(5);
    expect(result.branch.state.rewardHistory.lootTypeHistory.DemeterUpgrade).toBe(1);
  });

  it('does not consume Calling Card or create Vow of Denial bans for the direct nested result', () => {
    const defaults = createDefaultRouteLoadout(catalog);
    const arcanaFear = createArcanaFearState(catalog, {
      ...defaults,
      fearRanks: { ...defaults.fearRanks, BanUnpickedBoonsShrineUpgrade: 1 },
    });
    const initialized = initializeTestRewardBranches()[0]!;
    const keepsakes = createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear);
    const branch = Object.freeze({
      ...initialized,
      state: Object.freeze({ ...initialized.state, arcanaFear: arcanaFear, keepsakes: keepsakes }),
    });
    const result = settleEncounterTraitOffer(
      catalog,
      branch,
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            { giverKey: 'Aphrodite', traitKey: 'AphroditeWeaponBoon', rarity: 'Common' },
          ]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.keepsakes.callingCard).toEqual(keepsakes.callingCard);
    expect(result.branch.state.traitHistory?.bannedTraitKeys).toEqual([]);
    expect(result.branch.state.traitHistory?.equippedTraits.AphroditeWeaponBoon).toBeDefined();
  });

  it('forbids ordinary slot replacement and makes an exhausted nested domain disable the outer row', () => {
    const occupied = historyFromTraits([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    ]);
    const aphroditeWeapon = echoLastRunBoonOutcomes(catalog, occupied, {
      routeKey: 'Underworld',
    }).find(
      (outcome) =>
        outcome.option.giverKey === 'Aphrodite' &&
        outcome.option.traitKey === 'AphroditeWeaponBoon' &&
        outcome.option.rarity === 'Rare',
    );
    expect(aphroditeWeapon).toMatchObject({
      assessment: {
        legal: false,
        findings: expect.arrayContaining([expect.objectContaining({ code: 'occupiedBoonSlot' })]),
      },
    });
    expect(aphroditeWeapon?.assessment.replacementTransition).toBeUndefined();

    const allTraitKeys = [
      ...new Set(catalog.echoLastRunBoon.variants.values.map((variant) => variant.traitKey)),
    ];
    const exhausted = Object.freeze({
      ...createTraitHistoryState(),
      bannedTraitKeys: Object.freeze(allTraitKeys),
    });
    expect(
      assessTraitOption(catalog, 'EchoLastRunBoon', exhausted, {
        routeKey: 'Underworld',
        resolvedProviderKey: 'Echo',
      }).findings,
    ).toContainEqual(
      expect.objectContaining({ code: 'offerContext', detail: 'echoLastRunBoonEmpty' }),
    );
  });

  it('retains an invalid selected child after the outer acquisition without mutating source history', () => {
    const history = historyFromTraits([
      { giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon', rarity: 'Common' },
    ]);
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            { giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon', rarity: 'Heroic' },
            { giverKey: 'Zeus', traitKey: 'ZeusRetaliateBoon', rarity: 'Common' },
          ] as const),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.equippedTraits.ZeusRetaliateBoon).toBeUndefined();
    expect(result.branch.state.rewardHistory.lootTypeHistory).toEqual({});
    expect(result.findingEntries.map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'echoLastRunBoonOptionUnavailable',
        origin: createEchoLastRunBoonAddress(echoOwner, 'option1'),
      }),
    );
  });

  it('uses the settled Spell Drop prefix for the reached Echo child without treating a starting Hex as one', () => {
    const child = echoBoonChild(
      Object.freeze([{ giverKey: 'Athena', traitKey: 'OlympianSpellCountBoon', rarity: 'Common' }]),
    );
    const startingHex = recordAspectStartingTrait(
      catalog,
      createTraitHistoryState(),
      echoOwner.owner,
      {
        aspectKey: 'SuitHexAspect',
      },
    );
    const withoutSpellDrop = settleEncounterTraitOffer(
      catalog,
      baseBranch(startingHex),
      echoOwner.owner,
      echoBoonOffer(child),
      10,
      'encounterCompleted',
    );
    expect(
      withoutSpellDrop.branch.state.traitHistory?.equippedTraits.OlympianSpellCountBoon,
    ).toBeUndefined();
    expect(withoutSpellDrop.findingEntries.map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({ code: 'echoLastRunBoonOptionUnavailable' }),
    );

    const branch = baseBranch(startingHex);
    const withSettledSpellDrop = Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        rewardHistory: Object.freeze({
          ...branch.state.rewardHistory,
          useRecord: Object.freeze({ ...branch.state.rewardHistory.useRecord, SpellDrop: 1 }),
        }),
      }),
    });
    const withSpellDrop = settleEncounterTraitOffer(
      catalog,
      withSettledSpellDrop,
      echoOwner.owner,
      echoBoonOffer(child),
      10,
      'encounterCompleted',
    );
    expect(withSpellDrop.findingEntries).toHaveLength(0);
    expect(
      withSpellDrop.branch.state.traitHistory?.equippedTraits.OlympianSpellCountBoon,
    ).toMatchObject({
      giverKey: 'Athena',
      rarity: 'Common',
    });
    const selected = selectedTraitOfferProducts([withSpellDrop.branch], [], catalog);
    expect(
      selected.candidateContexts.get(semanticAddressKey(echoOwner))?.[0]?.context,
    ).toMatchObject({
      settledSpellDrop: true,
    });
  });

  it('retains a valid selection with an invalid unselected row before any nested mutation', () => {
    const history = historyFromTraits([
      { giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon', rarity: 'Common' },
    ]);
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
            { giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon', rarity: 'Heroic' },
          ] as const),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.equippedTraits.ZeusWeaponBoon).toBeUndefined();
    expect(result.branch.state.rewardHistory.lootTypeHistory).toEqual({});
    expect(result.findingEntries.map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'echoLastRunBoonOptionUnavailable',
        evidence: expect.objectContaining({
          detail: 'Aphrodite:HighHealthOffenseBoon:Heroic',
        }),
        origin: createEchoLastRunBoonAddress(echoOwner, 'option1'),
      }),
    );
  });

  it('retains a missing child as an exact repair checkpoint after the outer acquisition', () => {
    const result = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoBoonOffer(),
      10,
      'encounterCompleted',
    );
    expect(result.branch.state.traitHistory?.equippedTraits.EchoLastRunBoon).toBeDefined();
    expect(result.branch.state.traitHistory?.events).toHaveLength(1);
    expect(result.branch.state.rewardHistory.lootTypeHistory).toEqual({});
    expect(result.findingEntries.map((entry) => entry.finding)).toContainEqual(
      expect.objectContaining({
        code: 'echoLastRunBoonMissing',
        origin: createEchoLastRunBoonAddress(echoOwner, 'option1'),
      }),
    );
  });

  it('records only the selected source, preserves present membership, and expands a capped pool', () => {
    const child = echoBoonChild(
      Object.freeze([
        { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { giverKey: 'Apollo', traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
      ] as const),
    );
    const cappedSources = ['AphroditeUpgrade', 'ApolloUpgrade', 'AresUpgrade', 'DemeterUpgrade'];
    const expanded = settleEncounterTraitOffer(
      catalog,
      baseBranchWithSources(cappedSources),
      echoOwner.owner,
      echoBoonOffer(child),
      10,
      'encounterCompleted',
    );
    expect(expanded.branch.state.rewardHistory.lootTypeHistory).toMatchObject({
      AphroditeUpgrade: 1,
      ApolloUpgrade: 1,
      AresUpgrade: 1,
      DemeterUpgrade: 1,
      ZeusUpgrade: 1,
    });
    expect(ordinaryPoolFor(expanded.branch.state.rewardHistory)).toEqual([
      'AphroditeUpgrade',
      'ApolloUpgrade',
      'AresUpgrade',
      'DemeterUpgrade',
      'ZeusUpgrade',
    ]);

    const present = settleEncounterTraitOffer(
      catalog,
      baseBranchWithSources(['ZeusUpgrade']),
      echoOwner.owner,
      echoBoonOffer(child),
      10,
      'encounterCompleted',
    );
    expect(present.branch.state.rewardHistory.lootTypeHistory).toEqual({ ZeusUpgrade: 2 });
    expect(Object.keys(present.branch.state.rewardHistory.lootTypeHistory)).toEqual([
      'ZeusUpgrade',
    ]);
  });

  it.each([
    ['Aphrodite', 'AphroditeUpgrade'],
    ['Zeus', 'ZeusUpgrade'],
  ] as const)(
    'preserves the chosen %s identity for one Duo and never records both partners',
    (giverKey, expectedSource) => {
      const history = historyFromTraits([
        { giverKey: 'Aphrodite', traitKey: 'AphroditeWeaponBoon', rarity: 'Common' },
        { giverKey: 'Zeus', traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
      ]);
      const result = settleEncounterTraitOffer(
        catalog,
        baseBranch(history),
        echoOwner.owner,
        echoBoonOffer(
          echoBoonChild(Object.freeze([{ giverKey, traitKey: 'SprintEchoBoon', rarity: 'Duo' }])),
        ),
        10,
        'encounterCompleted',
      );
      expect(result.branch.state.traitHistory?.equippedTraits.SprintEchoBoon).toMatchObject({
        giverKey,
      });
      expect(result.branch.state.rewardHistory.lootTypeHistory).toEqual({ [expectedSource]: 1 });
    },
  );

  it('applies source-specific non-ordinary history without entering the ordinary pool', () => {
    const hermes = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([{ giverKey: 'Hermes', traitKey: 'DodgeChanceBoon', rarity: 'Common' }]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(hermes.branch.state.rewardHistory.lootTypeHistory).toEqual({ HermesUpgrade: 1 });
    expect(ordinaryPoolFor(hermes.branch.state.rewardHistory)).not.toContain('HermesUpgrade');

    const artemis = settleEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            { giverKey: 'Artemis', traitKey: 'SupportingFireBoon', rarity: 'Heroic' },
          ]),
        ),
      ),
      10,
      'encounterCompleted',
    );
    expect(artemis.branch.state.rewardHistory.lootTypeHistory).toEqual({});
  });

  it('round-trips the strict child and rejects malformed cardinality, sources, rarities, and Duo duplicates', () => {
    let project = selectGoldenBridge();
    const bridge = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const existing = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (existing?.kind !== 'traits') throw new Error('Echo offer is missing');
    const valid = echoBoonOffer(
      echoBoonChild(
        Object.freeze([
          {
            giverKey: 'Hera',
            traitKey: 'BoonDecayBoon',
            rarity: 'Heroic',
            targetTraitKey: 'HephaestusWeaponBoon',
          },
          {
            giverKey: 'Hera',
            traitKey: 'AllElementalBoon',
            rarity: 'Legendary',
            allTogetherResult: {
              earth: 'ElementalDamageBoon',
              fire: 'ElementalBaseDamageBoon',
              air: 'ElementalDamageFloorBoon',
              water: 'ElementalHealthBoon',
            },
          },
          {
            giverKey: 'Demeter',
            traitKey: 'GoodStuffBoon',
            rarity: 'Duo',
            naturalSelectionTargets: ['HephaestusWeaponBoon'],
          },
        ] as const),
        'option1',
      ),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: valid,
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    const malformed = (mutate: (child: JsonRecord) => void): JsonRecord => {
      const document = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
      const option = (echoOfferInDocument(document).options as JsonRecord[])[0]!;
      const child = option.echoLastRunBoon as JsonRecord;
      mutate(child);
      return document;
    };
    expect(() =>
      decodeProjectDocument(
        malformed((child) => {
          child.options = [];
        }),
        catalog,
      ),
    ).toThrow(/must contain one to three options/);
    expect(() =>
      decodeProjectDocument(
        malformed((child) => {
          child.options = [
            { giverKey: 'Aphrodite', traitKey: 'SprintEchoBoon', rarity: 'Duo' },
            { giverKey: 'Zeus', traitKey: 'SprintEchoBoon', rarity: 'Duo' },
          ];
        }),
        catalog,
      ),
    ).toThrow(/trait keys must be distinct/);
    expect(() =>
      decodeProjectDocument(
        malformed((child) => {
          child.options = [{ giverKey: 'Hades', traitKey: 'CastProjectileBoon', rarity: 'Common' }];
          child.selectedOptionKey = 'option1';
        }),
        catalog,
      ),
    ).toThrow(/is not an Echo last-run source/);
    expect(() =>
      decodeProjectDocument(
        malformed((child) => {
          child.options = [
            { giverKey: 'Aphrodite', traitKey: 'AphroditeWeaponBoon', rarity: 'Legendary' },
          ];
          child.selectedOptionKey = 'option1';
        }),
        catalog,
      ),
    ).toThrow(/is not an equipped rarity/);
    expect(() =>
      decodeProjectDocument(
        malformed((child) => {
          child.options = [
            { giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon', rarity: 'Common' },
          ];
          child.selectedOptionKey = 'option3';
        }),
        catalog,
      ),
    ).toThrow(/must select a present option/);
    expect(() =>
      decodeProjectDocument(
        malformed((child) => {
          child.options = [
            {
              giverKey: 'Aphrodite',
              traitKey: 'HighHealthOffenseBoon',
              rarity: 'Common',
              targetTraitKey: 'HephaestusWeaponBoon',
            },
          ];
          child.selectedOptionKey = 'option1';
        }),
        catalog,
      ),
    ).toThrow(/does not support an Echo last-run acquisition target/);
    expect(() =>
      decodeProjectDocument(
        malformed((child) => {
          child.extra = true;
        }),
        catalog,
      ),
    ).toThrow(/echoLastRunBoon\.extra: is not a project document field/);
  });

  it('settles the real H Echo fold into Run State with the nested trait and future pool source', () => {
    let project = completeGoldenFGHProject();
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
      trait: echoOwner,
      value: echoBoonOffer(
        echoBoonChild(
          Object.freeze([
            { giverKey: 'Aphrodite', traitKey: 'HighHealthOffenseBoon', rarity: 'Common' },
          ]),
        ),
      ),
    });
    const h = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    expect(h.rewards.branches.length).toBeGreaterThan(0);
    expect(
      h.rewards.branches.every(
        (branch) =>
          branch.state.rewardHistory.lootTypeHistory.AphroditeUpgrade === 1 &&
          branch.state.traitHistory?.equippedTraits.EchoLastRunBoon?.rarity === undefined &&
          branch.state.traitHistory?.equippedTraits.HighHealthOffenseBoon?.rarity === 'Common',
      ),
    ).toBe(true);
    const snapshot = [...h.rewards.runStateSnapshots]
      .reverse()
      .find((candidate) => candidate.traits.equippedTraits.HighHealthOffenseBoon !== undefined);
    expect(snapshot).toMatchObject({
      godPool: {
        acquiredSourceKeys: expect.arrayContaining(['AphroditeUpgrade']),
        effectiveSourceKeys: expect.arrayContaining(['AphroditeUpgrade']),
      },
      traits: {
        equippedTraits: {
          EchoLastRunBoon: { traitKey: 'EchoLastRunBoon' },
          HighHealthOffenseBoon: { rarity: 'Common' },
        },
      },
    });
    expect(snapshot?.traits.equippedTraits.EchoLastRunBoon?.rarity).toBeUndefined();
  });

  it('stops the real H bridge at the unresolved Echo offer without applying an Echo effect', () => {
    let project = completeGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ResetEncounterTraitOffer',
      trait: echoOwner,
    });

    const assembly = simulateProjectAssembly(catalog, project);
    const h = assembly.evaluation.route!.biomes.find((biome) => biome.biomeKey === 'H')!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    expect(
      h.findings.filter(
        (finding) =>
          finding.code === 'traitOfferMissing' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(echoOwner),
      ),
    ).toHaveLength(1);
    expect(h.coverage).toMatchObject({ kind: 'prefix', blockedAt: echoOwner });
    expect(
      h.rewards.branches.every((branch) =>
        Object.keys(branch.state.traitHistory?.equippedTraits ?? {}).every(
          (traitKey) => !traitKey.startsWith('Echo'),
        ),
      ),
    ).toBe(true);

    const draft = createPreparedProjectCandidateSession(
      catalog,
      assembly,
    ).traitOfferStartingOutcome(echoOwner, 'Echo');
    expect(draft).toMatchObject({
      kind: 'traits',
      giverKey: 'Echo',
      selectedOptionKey: 'option1',
    });
    expect(draft?.kind === 'traits' ? draft.options : []).toHaveLength(3);
  });

  it('retains Reward and Gift domains at the unresolved real H Echo frontier', () => {
    const replacement = replaceLatestGoldenRewardWithConsumable();
    let project = applyProjectCommand(replacement.project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ResetEncounterTraitOffer',
      trait: echoOwner,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const value = echoOffer('option3', [
      { traitKey: 'EchoLastReward' },
      { traitKey: 'EchoRepeatKeepsakeBoon' },
      { traitKey: 'DiminishingDodgeBoon' },
    ]);
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    const offer = session.evaluate({ kind: 'traitOffer', trait: echoOwner, value });
    expect(offer.kind).toBe('traitOffer');
    if (offer.kind !== 'traitOffer') throw new Error('Echo offer candidate is unavailable');
    expect(offer.result.supported).toBe(true);
    expect(offer.result.assessments.every((assessment) => assessment.legal)).toBe(true);
    const h = assembly.evaluation.route!.biomes.find((biome) => biome.biomeKey === 'H')!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    expect(h.coverage).toMatchObject({ kind: 'prefix', blockedAt: echoOwner });
    expect(
      h.rewards.branches.every(
        (branch) => branch.state.traitHistory?.equippedTraits.EchoRepeatKeepsakeBoon === undefined,
      ),
    ).toBe(true);
  });

  it('keeps the real H invalid child addressable while excluding later route state', () => {
    let project = completeGoldenFGHProject();
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
      trait: echoOwner,
      value: echoBoonOffer(
        echoBoonChild(
          Object.freeze([{ giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Heroic' }]),
        ),
      ),
    });
    const h = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    const child = createEchoLastRunBoonAddress(echoOwner, 'option1');
    expect(h.coverage).toMatchObject({ kind: 'prefix', blockedAt: child });
    expect(h.rewards.branches).toHaveLength(1);
    expect(
      h.rewards.branches.every(
        (branch) =>
          branch.state.traitHistory?.equippedTraits.EchoLastRunBoon !== undefined &&
          branch.state.traitHistory.equippedTraits.ApolloWeaponBoon?.rarity === 'Common' &&
          branch.state.rewardHistory.lootTypeHistory.ApolloUpgrade === 1,
      ),
    ).toBe(true);
    expect(h.findings).toContainEqual(
      expect.objectContaining({ code: 'echoLastRunBoonOptionUnavailable', origin: child }),
    );
  });
});

describe('Echo Gate C Reward Reward Reward', () => {
  it('creates one required unresolved room-exit pickup with an exact Echo-contact dependency', () => {
    const project = applyProjectCommand(selectGoldenBridge(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    const occurrence = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === bridgeId)!;
    expect(occurrence.acquisitionSites?.roomExit).toEqual({
      pickupEntries: { [echoReplayEntryKey]: null },
    });
    const materializedBridge = bridgeRoom(project);
    const row = materializedBridge.roomActionRoster.rows.find(
      (candidate) =>
        candidate.reference.kind === 'interactAcquisitionEntry' &&
        candidate.reference.entryKey === echoReplayEntryKey,
    );
    expect(row).toMatchObject({
      participation: 'required',
      rank: expect.any(Number),
      dependencies: [
        {
          kind: 'afterAction',
          action: { kind: 'interactEncounter', phaseKey: 'Encounter' },
        },
      ],
    });
    expect(
      materializedBridge.roomActionRoster.proposals.some(
        (proposal) =>
          proposal.kind === 'remove' &&
          proposal.reference.kind === 'interactAcquisitionEntry' &&
          proposal.reference.entryKey === echoReplayEntryKey,
      ),
    ).toBe(false);
  });

  it('replays the latest consumable source at Echo without regenerating the room exit', () => {
    const replacement = replaceLatestGoldenRewardWithConsumable();
    let project = replacement.project;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: echoReplayEntry(),
      value: { rewardType: replacement.rewardType },
    });
    project = makeBridgeOutgoingEligible(project);
    const assembly = simulateProjectAssembly(catalog, project);
    const h = assembly.evaluation.route!.biomes.find((biome) => biome.biomeKey === 'H')!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    const replayEntry = echoReplayEntry();
    expect(h.findings).not.toContainEqual(expect.objectContaining({ origin: replayEntry }));
    expect(
      h.rewards.branches.every((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.entry) === semanticAddressKey(replayEntry),
        ),
      ),
    ).toBe(true);
    expect(
      h.rewards.branches
        .flatMap((branch) => branch.events)
        .find(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.entry) === semanticAddressKey(replayEntry),
        ),
    ).toEqual(
      expect.objectContaining({
        source: expect.objectContaining({
          producer: {
            kind: 'echoLastReward',
            sourceOwner: echoRewardProducerOwner,
            sourceRole: 'self',
          },
        }),
      }),
    );
  });

  it('retains a stale generated pickup at its exact entry and repairs changed history', () => {
    let project = selectGoldenBridge();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: echoReplayEntry(),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const replacement = replaceLatestGoldenRewardWithConsumable(project);
    project = makeBridgeOutgoingEligible(replacement.project);
    const stale = simulateProjectAssembly(catalog, project);
    const h = stale.evaluation.route!.biomes.find((biome) => biome.biomeKey === 'H')!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    const replayEntry = echoReplayEntry();
    expect(h.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardSourceUnavailable', origin: replayEntry }),
    );
    expect(
      derivedAcquisitionEntriesForProjectEvaluationAssembly(stale, replayEntry.site),
    ).toContainEqual(
      expect.objectContaining({
        address: replayEntry,
        fixedReward: expect.objectContaining({ offer: { rewardType: replacement.rewardType } }),
        retainedSourceMismatch: true,
        rewardTypes: [replacement.rewardType],
      }),
    );
    const staleSession = createPreparedProjectCandidateSession(catalog, stale);
    expect(
      staleSession.evaluate({
        kind: 'acquisitionEntryOffer',
        entry: replayEntry,
        value: { rewardType: replacement.rewardType },
      }),
    ).toMatchObject({ kind: 'acquisitionEntryOffer', result: { supported: true } });
    expect(
      staleSession.evaluate({
        kind: 'acquisitionEntryOffer',
        entry: replayEntry,
        value: { rewardType: 'WeaponUpgrade' },
      }),
    ).toMatchObject({ kind: 'acquisitionEntryOffer', result: { supported: false } });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: replayEntry,
      value: { rewardType: replacement.rewardType },
    });
    const repaired = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in repaired)) throw new Error('H must be evaluated');
    expect(repaired.findings).not.toContainEqual(expect.objectContaining({ origin: replayEntry }));
  });

  it('retains the generated payload while dormant and restores required participation on reselect', () => {
    let project = applyProjectCommand(selectGoldenBridge(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: echoReplayEntry(),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: echoOwner,
      selectedOptionKey: 'option2',
    });
    const dormantOccurrence = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === bridgeId)!;
    expect(dormantOccurrence.acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: { [echoReplayEntryKey]: { offer: { rewardType: 'WeaponUpgrade' } } },
    });
    const dormantReference = Object.freeze({
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit',
      entryKey: echoReplayEntryKey,
    });
    const dormantRoom = bridgeRoom(project);
    expect(
      dormantRoom.roomActionRoster.rows.find(
        (candidate) => candidate.key === roomActionKey(dormantReference),
      ),
    ).toMatchObject({ stale: true, executable: false });
    expect(
      dormantRoom.roomActionRoster.proposals.find(
        (proposal) =>
          proposal.kind === 'remove' &&
          roomActionKey(proposal.reference) === roomActionKey(dormantReference),
      ),
    ).toMatchObject({ structurallyAuthorable: true });
    const removedDormant = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenHBiome, bridgeId, roomActionKey(dormantReference)),
    });
    expect(() =>
      applyProjectCommand(removedDormant, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(goldenHBiome, bridgeId, roomActionKey(dormantReference)),
        reference: dormantReference,
        index: 0,
      }),
    ).toThrow('room action is not active for this occurrence');
    const dormantH = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in dormantH)) throw new Error('H must be evaluated');
    expect(dormantH.findings).not.toContainEqual(
      expect.objectContaining({ origin: echoReplayEntry() }),
    );
    expect(
      dormantH.rewards.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.entry) === semanticAddressKey(echoReplayEntry()),
        ),
      ),
    ).toBe(false);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    const restoredOccurrence = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === bridgeId)!;
    expect(restoredOccurrence.acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: { [echoReplayEntryKey]: { offer: { rewardType: 'WeaponUpgrade' } } },
    });
    const restoredRow = bridgeRoom(project).roomActionRoster.rows.find(
      (candidate) =>
        candidate.reference.kind === 'interactAcquisitionEntry' &&
        candidate.reference.entryKey === echoReplayEntryKey,
    );
    expect(restoredRow).toMatchObject({
      participation: 'required',
      rank: expect.any(Number),
      stale: false,
    });
  });

  it('round-trips schema 50 and rejects the retired nested replay child', () => {
    let project = selectGoldenBridge();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: echoReplayEntry(),
      value: { rewardType: 'WeaponUpgrade' },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    const retired = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const options = echoOfferInDocument(retired).options as JsonRecord[];
    options[0]!.echoLastReward = { disposition: { kind: 'normal' } };
    expect(() => decodeProjectDocument(retired, catalog)).toThrow(
      /echoLastReward: is not a project document field/,
    );

    const forged = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const route = forged.route as JsonRecord;
    const biome = (route.biomes as JsonRecord[]).find((candidate) => candidate.biomeKey === 'H')!;
    const topology = biome.topology as JsonRecord;
    const bridge = (topology.occurrences as JsonRecord[]).find(
      (candidate) => candidate.occurrenceId === bridgeId,
    )!;
    const sites = bridge.acquisitionSites as JsonRecord;
    const roomExit = sites.roomExit as JsonRecord;
    const entries = roomExit.pickupEntries as JsonRecord;
    entries['echoLastReward:Encounter:forged:option1'] = null;
    expect(() => decodeProjectDocument(forged, catalog)).toThrow(
      /does not name a declaration-owned Echo Last Reward entry/,
    );
  });

  it('retains a nested Echo Quick Buck site and authored action through an outer switch', () => {
    const selectedReward = createLocalRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-combat09'),
      'cages',
      'cage2',
    );
    const siblingReward = createLocalRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-combat03'),
      'cages',
      'cage1',
    );
    let project = applyProjectCommand(selectGoldenBridge(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: siblingReward,
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: selectedReward,
      value: { rewardType: 'HermesUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(selectedReward, 'self'),
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'DodgeChanceBoon', rarity: 'Common' },
          { traitKey: 'SlowProjectileBoon', rarity: 'Common' },
          { traitKey: 'SprintShieldBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    project = makeBridgeOutgoingEligible(placeCombat09Cage2Last(project));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: echoReplayEntry(),
      value: { rewardType: 'HermesUpgrade' },
    });
    const replayTrait = createTraitOfferAddress(echoReplayEntry(), 'self');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: replayTrait,
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'MoneyMultiplierBoon', rarity: 'Common' },
          { traitKey: 'DodgeChanceBoon', rarity: 'Common' },
          { traitKey: 'SlowProjectileBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    const siteKey = traitGeneratedPickupSiteKey(replayTrait, 'option1');
    const reference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey,
      entryKey: 'quickBuckGold',
    };
    const bridge = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(goldenHBiome, bridgeId, roomActionKey(reference)),
      reference,
      index: bridge.roomActions.order.length,
    });
    expect(
      project
        .route!.biomes.find((biome) => biome.biomeKey === 'H')!
        .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)
        ?.acquisitionSites?.[siteKey],
    ).toMatchObject({
      pickupEntries: { quickBuckGold: { offer: { rewardType: 'RoomMoneyDrop' } } },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    const generatedRow = bridgeRoom(project).roomActionRoster.rows.find(
      (candidate) =>
        candidate.reference.kind === 'interactAcquisitionEntry' &&
        candidate.reference.siteKey === siteKey &&
        candidate.reference.entryKey === 'quickBuckGold',
    );
    expect(generatedRow).toMatchObject({
      participation: 'optional',
      window: { kind: 'postOutgoing' },
      dependencies: [
        {
          kind: 'afterAction',
          action: {
            kind: 'interactAcquisitionEntry',
            siteKey: 'roomExit',
            entryKey: echoReplayEntryKey,
          },
        },
      ],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: echoOwner,
      selectedOptionKey: 'option2',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: echoOwner,
      selectedOptionKey: 'option1',
    });
    const restored = project
      .route!.biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    expect(restored.acquisitionSites?.[siteKey]).toMatchObject({
      pickupEntries: { quickBuckGold: { offer: { rewardType: 'RoomMoneyDrop' } } },
    });
    expect(restored.roomActions.order).toContainEqual(reference);
  });

  it('supports Time Piece through the shared required replay acquisition role', () => {
    let project = applyProjectCommand(selectGoldenBridge(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    project = placeCombat09Cage2Last(project);
    project = makeBridgeOutgoingEligible(project);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: echoReplayEntry(),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(echoReplayEntry(), 'self'),
      value: { kind: 'timePiece' },
    });
    const h = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    expect(h.rewards.branches[0]?.events).toContainEqual(
      expect.objectContaining({ kind: 'conversionToGold', origin: echoReplayEntry() }),
    );
  });

  it('derives and persists the latest concrete loot replay, then settles a fresh offer before exits', () => {
    let project = selectGoldenBridge();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: echoRewardOffer(),
    });
    project = placeCombat09Cage2Last(project);
    project = makeBridgeOutgoingEligible(project);
    const incomplete = simulateProjectAssembly(catalog, project);
    const incompleteH = incomplete.evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in incompleteH)) throw new Error('H must be evaluated');
    const replayEntry = echoReplayEntry();
    expect(incompleteH.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardMissing', origin: replayEntry }),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: replayEntry,
      value: { rewardType: 'WeaponUpgrade' },
    });
    const replayTrait = createTraitOfferAddress(replayEntry, 'self');
    const replayDraft = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).traitOfferStartingOutcome(replayTrait, 'WeaponUpgrade');
    if (replayDraft === undefined) throw new Error('Fresh Hammer replay offer is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: replayTrait,
      value: replayDraft,
    });
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
    expect(decoded).toEqual(project);
    const h = simulateProjectAssembly(catalog, decoded).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    expect(h.findings).not.toContainEqual(expect.objectContaining({ origin: replayEntry }));
    expect(h.rewards.branches.length).toBeGreaterThan(0);
    expect(
      h.rewards.branches.every((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.settlement !== undefined &&
            semanticAddressKey(event.settlement.entry) === semanticAddressKey(replayEntry),
        ),
      ),
    ).toBe(true);
    expect(
      h.rewards.branches.every(
        (branch) => branch.state.rewardHistory.lootTypeHistory.WeaponUpgrade === 3,
      ),
    ).toBe(true);
  });
});
