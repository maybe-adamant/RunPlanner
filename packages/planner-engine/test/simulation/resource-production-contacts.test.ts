import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  traitGeneratedPickupSiteKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { replaceTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import { simulateProject } from '../../src/simulation';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';
import {
  createUnresolvedAcquisitionRewardState,
  type AuthoredTraitOffer,
} from '../../src/authored-project/traits/state';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import type { RewardBranch } from '../../src/simulation/rewards';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import {
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitHistoryEvent,
  type TraitHistoryState,
} from '../../src/simulation/traits';
import { ordinaryRoutePosition } from '../support/route-position';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoGoldHistory,
  echoGoldShop,
  initializeTestRewardBranches,
} from './shop-trait-purchase-support';

function withTraits<Branch extends RewardBranch>(
  branch: Branch,
  traits: TraitHistoryState,
): Branch {
  return Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      traitHistory: traits,
      rewardHistory: attachTraitHistory(branch.state.rewardHistory, traits),
    }),
  });
}

function poseidonOffer(options: readonly [string, string, string], rarity: 'Common' | 'Rare') {
  return Object.freeze({
    kind: 'traits' as const,
    giverKey: 'Poseidon',
    options: Object.freeze(options.map((traitKey) => Object.freeze({ traitKey, rarity }))),
    selectedOptionKey: 'option1' as const,
  }) as unknown as AuthoredTraitOffer;
}

describe('Gold Gold Gold duplicate production', () => {
  it('keeps a duplicate Ashes spawned before Buried Treasure at its spawn amount', () => {
    // Poseidon was already met, so the Shop boon may offer Buried Treasure.
    const traits = foldTraitHistoryEvents(catalog, [
      ...echoGoldHistory().events,
      Object.freeze({
        kind: 'traitOffer' as const,
        owner: { kind: 'project' as const },
        acquisitionRole: 'seedPoseidon',
        sequence: 1,
        giverKey: 'Poseidon',
        options: Object.freeze(
          ['PoseidonWeaponBoon', 'PoseidonSpecialBoon', 'PoseidonCastBoon'].map((traitKey) =>
            Object.freeze({ traitKey, rarity: 'Rare' as const }),
          ),
        ),
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'encounterCompleted',
        acquisitionIdentity: 'seed-poseidon',
      }) as unknown as TraitHistoryEvent,
    ]);
    const boonOffer = Object.freeze({
      rewardType: 'RandomLoot' as const,
      payload: Object.freeze({ kind: 'BoonSource' as const, source: 'PoseidonUpgrade' }),
    });
    const boon = Object.freeze({
      ...createUnresolvedAcquisitionRewardState(
        catalog,
        boonOffer,
        {
          kind: 'shopProfile',
          key: 'WorldShop',
        },
        'Underworld',
      ),
      traitOffersByAcquisitionRole: Object.freeze({
        source: poseidonOffer(
          ['RoomRewardBonusBoon', 'PoseidonCastBoon', 'PoseidonSprintBoon'],
          'Rare',
        ),
      }),
    });
    // Ashes first (spawning the 5-Ashes duplicate), then Rare Buried Treasure, then the duplicate.
    const result = echoGoldShop(['MajorNonBoon', 'Boon', ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY], {
      includeDuplicate: true,
      initialBranches: initializeTestRewardBranches().map((branch) => withTraits(branch, traits)),
      offerOverrides: { MajorNonBoon: { rewardType: 'MetaCardPointsCommonDrop' } },
      rewardOverrides: { Boon: boon as never },
    });
    expect([...result.findings.values()]).toEqual([]);
    const [branch] = result.settlement.branches;
    expect(branch?.state.traitHistory.equippedTraits.RoomRewardBonusBoon?.rarity).toBe('Rare');
    expect(branch?.state.rewardHistory.consumableRecord.MetaCardPointsCommonDrop).toBe(2);
    expect(branch?.state.rewardHistory.resourceGains).toEqual({ MetaCardPointsCommon: 10 });
  });
});

describe('screen-produced pickup production', () => {
  const combat09 = createOccurrenceId('golden-h-combat09');
  const cage2 = createLocalRewardAddress(goldenHBiome, combat09, 'cages', 'cage2');
  const screen = createTraitOfferAddress(cage2, 'source');

  /** Equips Steady Growth one interval short of the `ordinal`th encounter end in H. */
  function withSteadyGrowthDueAt(branch: RewardBranch, ordinal: number): RewardBranch {
    const sequence = Math.max(0, ...branch.state.traitHistory.events.map((e) => e.sequence));
    const settled = settleEncounterTraitOffer(
      catalog,
      Object.freeze({ ...branch, pendingShopContinuations: Object.freeze({}) }),
      createEncounterPhaseAddress(
        createBiomeAddress('Underworld', 'G'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('seed-steady-growth') },
        'Encounter',
      ),
      Object.freeze({
        kind: 'traits',
        giverKey: 'Demeter',
        options: Object.freeze(
          ['BoonGrowthBoon', 'DemeterSprintBoon', 'CastNovaBoon'].map((traitKey) =>
            Object.freeze({ traitKey, rarity: 'Common' as const }),
          ),
        ),
        selectedOptionKey: 'option1',
      }) as unknown as AuthoredTraitOffer,
      sequence,
      'encounterCompleted',
    );
    const history = settled.branch.state.traitHistory;
    const steady = history.equippedTraits.BoonGrowthBoon;
    const disposition = catalog.traits.byKey.BoonGrowthBoon?.selectedDisposition;
    if (steady?.acquisitionIdentity === undefined || disposition?.kind !== 'steadyGrowth')
      throw new Error('Steady Growth was not acquired');
    const requiredInterval = disposition.intervalsByRarity.Common!;
    const traits = foldTraitHistoryEvents(catalog, [
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
    ]);
    // Hera is dropped from this run's loot history so a fifth god, Poseidon, can appear.
    const { HeraUpgrade: _hera, ...lootTypeHistory } = branch.state.rewardHistory.lootTypeHistory;
    void _hera;
    const seeded = withTraits(branch, traits);
    return Object.freeze({
      ...seeded,
      state: Object.freeze({
        ...seeded.state,
        rewardHistory: Object.freeze({ ...seeded.state.rewardHistory, lootTypeHistory }),
      }),
    });
  }

  function buriedTreasureCageProject(): ProjectDocument {
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: cage2,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
    });
    // The Buried Treasure option itself stays Common; the rest match their equipped slots.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: screen,
      value: Object.freeze({
        kind: 'traits',
        giverKey: 'Poseidon',
        options: Object.freeze([
          Object.freeze({ traitKey: 'RoomRewardBonusBoon', rarity: 'Common' as const }),
          Object.freeze({ traitKey: 'PoseidonCastBoon', rarity: 'Rare' as const }),
          Object.freeze({ traitKey: 'PoseidonSprintBoon', rarity: 'Rare' as const }),
        ]),
        selectedOptionKey: 'option1',
      }) as unknown as AuthoredTraitOffer,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: createSteadyGrowthOutcomeAddress(
        createOccurrenceAddress(goldenHBiome, combat09),
        'Cage01',
      ),
      targetTraitKey: 'RoomRewardBonusBoon',
    });
    return replaceTestRoomActionOrder(project, catalog, goldenHBiome, combat09, [
      { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
      { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
      { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
      { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
      {
        kind: 'interactAcquisitionEntry',
        siteKey: traitGeneratedPickupSiteKey(screen, 'option1'),
        entryKey: 'bones',
      },
    ]);
  }

  it('stores Buried Treasure Bones at its screen close, before a Steady Growth promotion', () => {
    const pristine = simulateProject(catalog, createGoldenFGHProject()).route!.biomes;
    const g = pristine.find((candidate) => candidate.biomeKey === 'G');
    const h = pristine.find((candidate) => candidate.biomeKey === 'H');
    if (g?.authoring !== 'complete' || g.validity !== 'valid' || h?.authoring !== 'complete')
      throw new Error('fixture biomes are incomplete');
    const promotionOrdinal =
      h.history.events
        .filter((event) => event.kind === 'encounterEndEffectsApplied')
        .findIndex(
          (event) =>
            event.origin.kind === 'occurrence' &&
            event.origin.occurrenceId === combat09 &&
            event.kind === 'encounterEndEffectsApplied' &&
            event.phaseKey === 'Cage01',
        ) + 1;
    const project = buriedTreasureCageProject();
    const plan = project.route!.biomes.find((candidate) => candidate.biomeKey === 'H')!;
    const rewards = evaluateProgressiveBiomeAssembly(catalog, goldenHBiome, plan, {
      routePosition: ordinaryRoutePosition(catalog, 'Underworld', 'H'),
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: project.route!.loadout,
      seed: {
        history: g.history,
        rewardBranches: g.rewards.branches.map((branch) =>
          withSteadyGrowthDueAt(branch, promotionOrdinal),
        ),
      },
    })?.evaluation.rewards;
    if (rewards === undefined) throw new Error('H published no reward assessment');
    expect(rewards.findings).toEqual([]);
    const snapshot = (checkpoint: string) =>
      rewards.runStateSnapshots.find(
        (candidate) =>
          semanticAddressKey(candidate.owner).includes('golden-h-combat09') &&
          candidate.checkpoint === checkpoint,
      );
    const entry = snapshot('roomEntered')!;
    const exit = snapshot('beforeRoomExit')!;
    expect(exit.traits.equippedTraits.RoomRewardBonusBoon?.rarity).toBe('Rare');
    // 50 Bones at Common (75), not re-rolled at the promoted Rare rate (88).
    expect((exit.resourceGains.MetaCurrency ?? 0) - (entry.resourceGains.MetaCurrency ?? 0)).toBe(
      75,
    );
  });
});
