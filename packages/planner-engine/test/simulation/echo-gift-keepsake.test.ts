import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createCompletionRoomAddress,
  createEncounterPhaseAddress,
  createEchoKeepsakeReplayAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
  createProjectHistory,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  goldenHBiome,
} from '@run-planner/test-fixtures';

import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { evaluateKeepsakeEquipResultCandidate } from '../../src/simulation/candidates/keepsake-equip-result';
import {
  advanceExperimentalHammers,
  assessExperimentalHammerEquipResult,
  createKeepsakeState,
  type KeepsakeState,
} from '../../src/simulation/keepsakes';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import {
  processEncounterTraitOffer,
  type RewardBranchState,
} from '../../src/simulation/rewards/processing';
import {
  assessTraitOption,
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  type TraitHistoryEvent,
  type TraitHistoryState,
} from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';

const giftTraitKey = 'EchoRepeatKeepsakeBoon';
const giftIdentity = 'echo-gift-1';
const giftOwner = createEncounterPhaseAddress(
  createBiomeAddress('Underworld', 'H'),
  { kind: 'occurrence', occurrenceId: createOccurrenceId('echo-gift-test') },
  'Encounter',
);
const replayOwner = createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'G'));

function route() {
  const project = createGoldenFGHProject();
  const value = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
  if (value === undefined) throw new Error('missing Underworld route');
  return { project, value };
}

function evaluatedG() {
  const { project } = route();
  const value = simulateProject(catalog, project)
    .routes.find((candidate) => candidate.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === 'G');
  if (value?.authoring !== 'complete' || value.validity !== 'valid')
    throw new Error('expected valid G fixture');
  return value;
}

function giftEvent(
  capturedKeepsakeKey: string,
  sequence = 0,
): Extract<TraitHistoryEvent, { readonly kind: 'traitOffer' }> {
  return Object.freeze({
    kind: 'traitOffer',
    owner: giftOwner,
    acquisitionRole: 'selection',
    sequence,
    giverKey: 'Echo',
    options: Object.freeze([{ traitKey: giftTraitKey }] as const),
    selectedOptionKey: 'option1',
    acquisitionPoint: 'encounterCompleted',
    acquisitionIdentity: giftIdentity,
    echoRepeatedKeepsakeKey: capturedKeepsakeKey,
  });
}

function giftHistory(
  capturedKeepsakeKey: string,
  prefix: readonly TraitHistoryEvent[] = [],
): TraitHistoryState {
  const priorBiomeEvents = prefix.map((event, index) =>
    Object.freeze({ ...event, sequence: index - prefix.length - 1 }),
  );
  return foldTraitHistoryEvents(catalog, [...priorBiomeEvents, giftEvent(capturedKeepsakeKey, -1)]);
}

function retainedKeepsakeState(
  capturedKeepsakeKey: string,
  currentKeepsakeKey = capturedKeepsakeKey,
): KeepsakeState {
  const { value } = route();
  const arcanaFear = createArcanaFearState(catalog, value.loadout);
  const captured = createKeepsakeState(catalog, capturedKeepsakeKey, arcanaFear);
  return currentKeepsakeKey === capturedKeepsakeKey
    ? captured
    : Object.freeze({
        ...captured,
        currentKey: currentKeepsakeKey,
        history: Object.freeze([
          ...captured.history,
          Object.freeze({ key: currentKeepsakeKey, kind: 'replace' as const }),
        ]),
        removedKeys: Object.freeze([...captured.removedKeys, capturedKeepsakeKey]),
      });
}

function branchWithGift(
  capturedKeepsakeKey: string,
  currentKeepsakeKey = capturedKeepsakeKey,
  options: {
    readonly history?: TraitHistoryState;
    readonly keepsakes?: KeepsakeState;
  } = {},
): RewardBranchState {
  const base = initializeTestRewardBranches()[0]!;
  const traitHistory = options.history ?? giftHistory(capturedKeepsakeKey);
  return Object.freeze({
    ...base,
    history: attachTraitHistory(base.history, traitHistory),
    traitHistory,
    keepsakes: options.keepsakes ?? retainedKeepsakeState(capturedKeepsakeKey, currentKeepsakeKey),
  });
}

function replayBiome(
  branches: NonNullable<Parameters<typeof evaluateBiomeRewardsAssemblyInternal>[5]>,
  experimentalHammer?:
    { readonly kind: 'selected'; readonly traitKey: string } | { readonly kind: 'exhausted' },
) {
  const evaluated = evaluatedG();
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    {
      ...evaluated.snapshot,
      ...(experimentalHammer === undefined
        ? {}
        : { echoKeepsakeReplayResults: { experimentalHammer } }),
    },
    {
      ...evaluated.history,
      events: Object.freeze([]),
      rooms: Object.freeze([]),
    },
    2,
    route().value.loadout,
    branches,
  );
}

function hammerEvent(
  traitKey: string,
  sequence: number,
  acquisitionIdentity = `hammer-${sequence}`,
): Extract<TraitHistoryEvent, { readonly kind: 'traitOffer' }> {
  const giverKey = catalog.traitGivers.values.find((giver) =>
    giver.traitKeys.includes(traitKey),
  )?.key;
  if (giverKey === undefined) throw new Error(`missing giver for ${traitKey}`);
  return Object.freeze({
    kind: 'traitOffer',
    owner: giftOwner,
    acquisitionRole: 'experimentalHammer',
    sequence,
    giverKey,
    options: Object.freeze([{ traitKey }] as const),
    selectedOptionKey: 'option1',
    acquisitionPoint: 'keepsakeEquip',
    acquisitionIdentity,
  });
}

function saturatedGiftHammerHistory(): TraitHistoryState {
  const { value } = route();
  const compatible = catalog.traits.values.filter(
    (trait) =>
      trait.hammerCompatibility?.weaponKey === value.loadout.weaponKey &&
      trait.hammerCompatibility.aspectKeys.includes(value.loadout.aspectKey),
  );
  return giftHistory(
    'TempHammerKeepsake',
    compatible.map((trait, index) => hammerEvent(trait.key, index)),
  );
}

describe('Echo Gift Gift Gift', () => {
  it('owns the exact four source exclusions while every other keepsake remains capturable', () => {
    const excluded = new Set([
      'AthenaEncounterKeepsake',
      'HadesAndPersephoneKeepsake',
      'EscalatingKeepsake',
      'FountainRarityKeepsake',
    ]);
    const history = createTraitHistoryState();
    for (const keepsake of catalog.keepsakes.values) {
      const assessment = assessTraitOption(catalog, giftTraitKey, history, {
        currentKeepsakeKey: keepsake.key,
      });
      expect(
        assessment.findings.some(
          (finding) => finding.code === 'offerContext' && finding.detail === 'echoKeepsakeExcluded',
        ),
        keepsake.key,
      ).toBe(excluded.has(keepsake.key));
    }
  });

  it('captures the acquisition-time key and never retargets after a rack change', () => {
    const base = initializeTestRewardBranches()[0]!;
    const branch = Object.freeze({
      ...base,
      keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', base.arcanaFear),
    });
    const result = processEncounterTraitOffer(
      catalog,
      branch,
      giftOwner,
      {
        kind: 'traits',
        giverKey: 'Echo',
        options: Object.freeze([
          { traitKey: giftTraitKey },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ]),
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
        deathDefianceConditionMet: false,
      },
      10,
      'encounterCompleted',
    );
    expect(result.traitHistory?.equippedTraits[giftTraitKey]).toMatchObject({
      echoRepeatedKeepsakeKey: 'GoldifyKeepsake',
      echoKeepsakeReplayCount: 0,
    });
    if (result.traitHistory === undefined)
      throw new Error('Gift acquisition did not publish history');
    const swapped = branchWithGift('GoldifyKeepsake', 'RarifyKeepsake', {
      history: result.traitHistory,
      keepsakes: {
        ...result.keepsakes,
        currentKey: 'RarifyKeepsake',
        history: Object.freeze([
          ...result.keepsakes.history,
          { key: 'RarifyKeepsake', kind: 'replace' as const },
        ]),
      },
    });
    const replayed = replayBiome([swapped]).simulation.branches[0]!;
    expect(replayed.keepsakes.timePiece?.remainingCharges).toBe(6);
    expect(replayed.keepsakes.callingCard).toBeUndefined();
    expect(replayed.traitHistory?.equippedTraits[giftTraitKey]?.echoRepeatedKeepsakeKey).toBe(
      'GoldifyKeepsake',
    );
  });

  it.each([0, 2])(
    'applies Fig Leaf max(existing, 1) once from an existing count of %i',
    (remainingUses) => {
      const keepsakes = retainedKeepsakeState('SkipEncounterKeepsake');
      const initial = branchWithGift('SkipEncounterKeepsake', 'SkipEncounterKeepsake', {
        keepsakes: {
          ...keepsakes,
          figLeaf: { remainingUses, activatedThisBiome: true },
        },
      });
      const once = replayBiome([initial]).simulation.branches[0]!;
      expect(once.keepsakes.figLeaf).toEqual({
        remainingUses: Math.max(remainingUses, 1),
        activatedThisBiome: false,
      });
      expect(once.traitHistory?.equippedTraits[giftTraitKey]?.echoKeepsakeReplayCount).toBe(1);
      const twice = replayBiome([once]).simulation.branches[0]!;
      expect(twice.keepsakes.figLeaf?.remainingUses).toBe(Math.max(remainingUses, 1));
      expect(twice.traitHistory?.equippedTraits[giftTraitKey]?.echoKeepsakeReplayCount).toBe(1);
    },
  );

  it.each([
    ['RarifyKeepsake', 'callingCard', 6],
    ['GoldifyKeepsake', 'timePiece', 4],
  ] as const)('adds rank-I %s charges at every succeeding biome start', (key, ledger, initial) => {
    const first = replayBiome([branchWithGift(key)]).simulation.branches[0]!;
    expect(first.keepsakes[ledger]?.remainingCharges).toBe(initial + 2);
    expect(first.traitHistory?.equippedTraits[giftTraitKey]?.echoKeepsakeReplayCount).toBe(1);
    const second = replayBiome([first]).simulation.branches[0]!;
    expect(second.keepsakes[ledger]?.remainingCharges).toBe(initial + 4);
    expect(second.traitHistory?.equippedTraits[giftTraitKey]?.echoKeepsakeReplayCount).toBe(2);
  });

  it('retains an eligible effect-neutral capture without inventing a replay mutation', () => {
    const result = replayBiome([branchWithGift('ManaOverTimeRefundKeepsake')]).simulation
      .branches[0]!;
    expect(result.keepsakes.currentKey).toBe('ManaOverTimeRefundKeepsake');
    expect(result.traitHistory?.equippedTraits[giftTraitKey]).toMatchObject({
      echoRepeatedKeepsakeKey: 'ManaOverTimeRefundKeepsake',
      echoKeepsakeReplayCount: 0,
    });
  });

  it('waits for Experimental Hammer to be unequipped, then settles one selected rank-I replay', () => {
    const waiting = replayBiome([branchWithGift('TempHammerKeepsake')]);
    expect(waiting.simulation.findings).not.toContainEqual(
      expect.objectContaining({ origin: expect.objectContaining({ kind: 'keepsakeEquipResult' }) }),
    );
    expect(
      waiting.simulation.branches[0]?.traitHistory?.equippedTraits[giftTraitKey]
        ?.echoKeepsakeReplayCount,
    ).toBe(0);

    const switched = branchWithGift('TempHammerKeepsake', 'ManaOverTimeRefundKeepsake');
    const missing = replayBiome([switched]);
    expect(missing.simulation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultMissing' }),
    );
    const settled = replayBiome([switched], { kind: 'selected', traitKey: 'StaffLongAttackTrait' })
      .simulation.branches[0]!;
    expect(settled.keepsakes.experimentalHammers).toContainEqual(
      expect.objectContaining({
        traitKey: 'StaffLongAttackTrait',
        remainingUses: 10,
        active: true,
      }),
    );
    expect(settled.traitHistory?.equippedTraits.StaffLongAttackTrait).toMatchObject({
      hammerRank: 'RankI',
    });
    expect(settled.traitHistory?.equippedTraits.StaffLongAttackTrait?.rarity).toBeUndefined();
    expect(settled.traitHistory?.equippedTraits[giftTraitKey]?.echoKeepsakeReplayCount).toBe(1);
  });

  it('accepts the exhausted Hammer result only at an exact empty domain and consumes the one-shot', () => {
    const { value } = route();
    const history = saturatedGiftHammerHistory();
    expect(
      assessExperimentalHammerEquipResult(catalog, { kind: 'exhausted' }, history, value.loadout),
    ).toMatchObject({ legal: true });
    const branch = branchWithGift('TempHammerKeepsake', 'ManaOverTimeRefundKeepsake', { history });
    expect(branch.keepsakes.currentKey).toBe('ManaOverTimeRefundKeepsake');
    expect(branch.traitHistory?.equippedTraits[giftTraitKey]).toMatchObject({
      echoRepeatedKeepsakeKey: 'TempHammerKeepsake',
      echoKeepsakeReplayCount: 0,
      acquisitionIdentity: giftIdentity,
    });
    const replay = replayBiome([branch], { kind: 'exhausted' });
    expect(replay.simulation.findings).toEqual([]);
    const result = replay.simulation.branches[0]!;
    expect(result.keepsakes.experimentalHammers).toEqual([]);
    expect(result.traitHistory?.equippedTraits[giftTraitKey]?.echoKeepsakeReplayCount).toBe(1);
    expect(replayBiome([result], { kind: 'exhausted' }).simulation.findings).toHaveLength(0);
  });

  it('keeps overlapping Hammer instances distinct and expires only the exhausted identity', () => {
    const existingIdentity = 'ordinary-hammer';
    const history = giftHistory('TempHammerKeepsake', [
      hammerEvent('StaffLongAttackTrait', 0, existingIdentity),
    ]);
    const retained = retainedKeepsakeState('TempHammerKeepsake', 'ManaOverTimeRefundKeepsake');
    const branch = branchWithGift('TempHammerKeepsake', 'ManaOverTimeRefundKeepsake', {
      history,
      keepsakes: {
        ...retained,
        experimentalHammers: Object.freeze([
          {
            traitKey: 'StaffLongAttackTrait',
            remainingUses: 1,
            acquisitionIdentity: existingIdentity,
            active: true,
          },
        ]),
      },
    });
    const replayed = replayBiome([branch], { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' })
      .simulation.branches[0]!;
    expect(replayed.keepsakes.experimentalHammers).toHaveLength(2);
    const advanced = advanceExperimentalHammers(replayed.keepsakes);
    expect(advanced.expired).toEqual([
      expect.objectContaining({ acquisitionIdentity: existingIdentity, active: false }),
    ]);
    expect(advanced.state.experimentalHammers).toEqual([
      expect.objectContaining({ acquisitionIdentity: existingIdentity, remainingUses: 0 }),
      expect.objectContaining({
        traitKey: 'StaffJumpSpecialTrait',
        remainingUses: 9,
        active: true,
      }),
    ]);
    const removed = foldTraitHistoryEvents(catalog, [
      ...replayed.traitHistory!.events,
      {
        kind: 'traitRemoval',
        owner: replayOwner,
        acquisitionRole: 'experimentalHammerExpiry',
        sequence: 20,
        acquisitionPoint: 'encounterCompleted',
        traitKey: 'StaffLongAttackTrait',
        acquisitionIdentity: existingIdentity,
      },
    ]);
    expect(removed.equippedTraits.StaffLongAttackTrait).toBeUndefined();
    expect(removed.equippedTraits.StaffJumpSpecialTrait).toBeDefined();
  });

  it('rejects divergent captured Gift state and divergent current keys before Hammer publication', () => {
    expect(() =>
      replayBiome([branchWithGift('SkipEncounterKeepsake'), branchWithGift('GoldifyKeepsake')]),
    ).toThrow('Echo keepsake replay frontier is divergent');
    const history = giftHistory('TempHammerKeepsake');
    expect(() =>
      replayBiome([
        branchWithGift('TempHammerKeepsake', 'ManaOverTimeRefundKeepsake', { history }),
        branchWithGift('TempHammerKeepsake', 'BossPreDamageKeepsake', { history }),
      ]),
    ).toThrow('divergent current keepsakes');
  });

  it('publishes the biome-owned exhausted option only when the shared domain is empty', () => {
    const { project, value } = route();
    const resultAddress = createKeepsakeEquipResultAddress(replayOwner, 'experimentalHammer');
    const history = createTraitHistoryState();
    const context = {
      frontiers: Object.freeze([
        {
          before: history,
          fatedStatus: 'Unknown' as const,
          arcanaFear: createArcanaFearState(catalog, value.loadout),
          loadout: value.loadout,
        },
      ]),
    };
    const result = evaluateKeepsakeEquipResultCandidate(
      catalog,
      project,
      simulateProject(catalog, project),
      { at: () => context, entries: () => Object.freeze([]) },
      { kind: 'keepsakeEquipResult', result: resultAddress, value: { kind: 'exhausted' } },
    );
    expect(result).toMatchObject({ kind: 'keepsakeEquipResult' });
    if (result.kind !== 'keepsakeEquipResult') throw new Error('expected Hammer result');
    expect(
      result.result.options.find(
        (option) => 'kind' in option.value && option.value.kind === 'exhausted',
      ),
    ).toMatchObject({ selectedPossible: false });

    const saturated = saturatedGiftHammerHistory();
    const exhausted = evaluateKeepsakeEquipResultCandidate(
      catalog,
      project,
      simulateProject(catalog, project),
      {
        at: () => ({
          frontiers: Object.freeze([
            {
              before: saturated,
              fatedStatus: 'Unknown' as const,
              arcanaFear: createArcanaFearState(catalog, value.loadout),
              loadout: value.loadout,
            },
          ]),
        }),
        entries: () => Object.freeze([]),
      },
      { kind: 'keepsakeEquipResult', result: resultAddress, value: { kind: 'exhausted' } },
    );
    expect(exhausted).toMatchObject({ kind: 'keepsakeEquipResult' });
    if (exhausted.kind !== 'keepsakeEquipResult') throw new Error('expected Hammer result');
    expect(
      exhausted.result.options.find(
        (option) => 'kind' in option.value && option.value.kind === 'exhausted',
      ),
    ).toMatchObject({ selectedPossible: true });
    expect(exhausted.result.selectedPossible).toBe(true);
  });

  it('persists only the biome-owned Hammer resolution through strict schema 40 and undo/redo', () => {
    const { project } = route();
    const address = createKeepsakeEquipResultAddress(replayOwner, 'experimentalHammer');
    const selected = applyProjectCommand(project, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: address,
      value: { kind: 'selected', traitKey: 'StaffLongAttackTrait' },
    });
    const roundTrip = decodeProjectDocument(JSON.parse(encodeProjectDocument(selected)), catalog);
    expect(
      roundTrip.routes[0]?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.echoKeepsakeReplayResults,
    ).toEqual({ experimentalHammer: { kind: 'selected', traitKey: 'StaffLongAttackTrait' } });

    const malformed = JSON.parse(encodeProjectDocument(selected)) as {
      routes: { biomes: { biomeKey: string; echoKeepsakeReplayResults?: unknown }[] }[];
    };
    const g = malformed.routes[0]!.biomes.find((biome) => biome.biomeKey === 'G')!;
    g.echoKeepsakeReplayResults = { experimentalHammer: { traitKey: 'StaffLongAttackTrait' } };
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow(/kind/);

    const history = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: address,
      value: { kind: 'exhausted' },
    });
    expect(
      history.present.routes[0]?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.echoKeepsakeReplayResults,
    ).toEqual({ experimentalHammer: { kind: 'exhausted' } });
    const undone = undoProjectHistory(history);
    expect(
      undone.present.routes[0]?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.echoKeepsakeReplayResults,
    ).toBeUndefined();
    expect(redoProjectHistory(undone).present).toBe(history.present);
  });

  it('does not replay Gift when Echo is acquired in the final modeled biome', () => {
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    const echo = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
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
      trait: echo,
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: Object.freeze([
          { traitKey: giftTraitKey },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ]),
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
        deathDefianceConditionMet: false,
      },
    });
    const h = simulateProject(catalog, project).routes[0]?.biomes.find(
      (biome) => biome.biomeKey === 'H',
    );
    if (h?.authoring !== 'complete') throw new Error('expected complete H');
    expect(h.rewards.branches[0]?.traitHistory?.equippedTraits[giftTraitKey]).toMatchObject({
      echoRepeatedKeepsakeKey: 'GoldifyKeepsake',
      echoKeepsakeReplayCount: 0,
    });
  });

  it('carries a captured Experimental Hammer from H into the exact I biome-start child', () => {
    const forcedTargetId = createOccurrenceId('golden-h-combat05');
    const echo = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
        'Encounter',
      ),
      'selection',
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'TempHammerKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress('Underworld'),
        'experimentalHammer',
      ),
      value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    // Derive the reached history before replacing the target: replacement
    // correctly clears its authored reward leaf in the current strict schema.
    const reachedH = simulateProject(catalog, project).routes[0]?.biomes.find(
      (biome) => biome.biomeKey === 'H',
    );
    if (
      reachedH === undefined ||
      !('rewards' in reachedH) ||
      reachedH.rewards.branches[0] === undefined
    )
      throw new Error('expected reached forced H miniboss frontier');
    const before = reachedH.rewards.branches[0].traitHistory ?? createTraitHistoryState();
    const loadout = project.routes[0]!.loadout;
    // Echo lengthens this characterized route into H's forced-miniboss window.
    // Reauthor only that target and its Boon leaf: retaining H_Combat05's old
    // Apollo leaf after changing the room would be chronologically false.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenHBiome, forcedTargetId),
      gameName: 'H_MiniBoss02',
    });
    const replacement = catalog.traitGivers.values
      .filter((giver) => giver.key === 'Apollo')
      .map((giver) => ({
        giver,
        traitKeys: giver.traitKeys.filter((traitKey) => {
          const trait = catalog.traits.byKey[traitKey];
          return (
            trait?.rarityDomain.kind === 'ranked' &&
            trait.rarityDomain.freshOfferRarities.includes('Common') &&
            trait.targetedAcquisition === undefined &&
            assessTraitOption(
              catalog,
              traitKey,
              before,
              {
                ...loadout,
                resolvedProviderKey: giver.key,
                deathDefianceConditionMet: false,
              },
              'Common',
            ).legal
          );
        }),
      }))
      .find((candidate) => candidate.traitKeys.length >= 3);
    if (replacement === undefined) throw new Error('no truthful forced-miniboss Boon leaf');
    const [first, second, third] = replacement.traitKeys;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error('forced-miniboss Boon leaf is incomplete');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenHBiome, forcedTargetId),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: `${replacement.giver.key}Upgrade` },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(goldenHBiome, forcedTargetId),
        'source',
      ),
      value: {
        kind: 'traits',
        giverKey: replacement.giver.key,
        options: [
          { traitKey: first, rarity: 'Common' },
          { traitKey: second, rarity: 'Common' },
          { traitKey: third, rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echo,
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          { traitKey: giftTraitKey },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
        deathDefianceConditionMet: false,
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(
        createCompletionRoomAddress(goldenHBiome, 'postboss'),
      ),
      value: { kind: 'replace', keepsakeKey: 'ManaOverTimeRefundKeepsake' },
    });
    const iReplay = createKeepsakeEquipResultAddress(
      createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'I')),
      'experimentalHammer',
    );
    const pending = simulateProjectAssembly(catalog, project);
    expect(pending.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'keepsakeEquipResultMissing', origin: iReplay }),
    );
    const candidates = createPreparedProjectCandidateSession(catalog, pending).evaluate({
      kind: 'keepsakeEquipResult',
      result: iReplay,
    });
    if (candidates.kind !== 'keepsakeEquipResult')
      throw new Error(`I Gift child is unavailable: ${JSON.stringify(candidates)}`);
    const selected = candidates.result.options.find(
      (option) =>
        option.selectedPossible && 'kind' in option.value && option.value.kind === 'selected',
    );
    if (selected === undefined || !('kind' in selected.value) || selected.value.kind !== 'selected')
      throw new Error('I Gift child has no compatible Hammer');
    const selectedTraitKey = selected.value.traitKey;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: iReplay,
      value: selected.value,
    });
    const i = simulateProject(catalog, project).routes[0]?.biomes.find(
      (biome) => biome.biomeKey === 'I',
    );
    if (i?.authoring !== 'complete' || i.validity !== 'valid')
      throw new Error(`expected valid I replay, got ${i?.validity ?? 'missing'}`);
    expect(i.rewards.branches[0]?.traitHistory?.events).toContainEqual(
      expect.objectContaining({
        kind: 'echoKeepsakeReplay',
        owner: createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'I')),
      }),
    );
    expect(i.rewards.branches[0]?.traitHistory?.equippedTraits[selectedTraitKey]).toMatchObject({
      hammerRank: 'RankI',
    });
  });
});
