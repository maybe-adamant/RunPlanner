import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAcquisitionSiteAddress,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  createBiomeAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  seaStarDuplicateSiteKey,
  createAcquisitionRoleAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { evaluateRequirement, type RequirementExpression } from '@run-planner/engine/requirements';
import { factsWithHistory } from '@run-planner/engine/reward-kernel';
import { simulateProject, type RunStateSnapshot } from '@run-planner/engine/simulation';
import { replaceTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import type { EquippedTrait } from '../../src/authored-project/traits/state';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits/state';
import type { InRunTraitRarity } from '../../src/catalog-schema';
import {
  settleOwnedAcquisitionSite,
  settlePickupAcquisitionSite,
} from '../../src/simulation/rewards/acquisition/site-settlement';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import {
  producePendingResourcePickups,
  resolveProducedResourceAmounts,
} from '../../src/simulation/state/pending-resource-pickups';
import type { SimulationState } from '../../src/simulation/state/model';
import { replaceSimulationTraitHistory } from '../../src/simulation/state/transitions';
import { createTraitHistoryState } from '../../src/simulation/traits';
import type { TraitHistoryState } from '../../src/simulation/traits/history/model';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { baseFacts } from './shop-trait-purchase-support';

const biome = createBiomeAddress('Underworld', 'F');

function equipped(traitKey: string, rarity: InRunTraitRarity): EquippedTrait {
  return Object.freeze({
    traitKey,
    giverKey: 'Poseidon',
    providerKind: 'olympian' as const,
    rarity,
    sourceRole: 'selection',
  });
}

function traitsWith(...traits: readonly EquippedTrait[]): TraitHistoryState {
  return Object.freeze({
    ...createTraitHistoryState(),
    equippedTraits: Object.freeze(Object.fromEntries(traits.map((t) => [t.traitKey, t]))),
  });
}

const buriedTreasure = (rarity: InRunTraitRarity = 'Common') =>
  equipped('RoomRewardBonusBoon', rarity);
const seaStar = equipped('DoubleRewardBoon', 'Common');

function branchWith(traitHistory: TraitHistoryState): RewardBranchState {
  const branch = initializeTestRewardBranches()[0]!;
  return Object.freeze({
    ...branch,
    state: Object.freeze({ ...branch.state, traitHistory }),
  });
}

function withTraits(branch: RewardBranchState, traitHistory: TraitHistoryState) {
  return Object.freeze({
    ...branch,
    state: replaceSimulationTraitHistory(branch.state, traitHistory),
  });
}

const facts = (state: SimulationState) =>
  factsWithHistory(baseFacts(), state.rewardHistory, new Set());

function roomPickup(name: string, rewardType: string, producerLifecycleKey = 'RoomReward') {
  const occurrenceId = createOccurrenceId(`resource-${name}`);
  return Object.freeze({
    siteOwner: createOccurrenceAddress(biome, occurrenceId),
    origin: createIncomingRewardAddress(biome, occurrenceId),
    offer: Object.freeze({ rewardType }),
    producerLifecycleKey,
  });
}

function collect(
  branch: RewardBranchState,
  pickup: ReturnType<typeof roomPickup>,
  seaStarProc = false,
) {
  return settleOwnedAcquisitionSite(
    catalog,
    [branch],
    {
      siteOwner: pickup.siteOwner,
      pointKey: 'roomRewardPickup',
      entryKey: 'self',
      historySequence: 1,
      source: {
        origin: pickup.origin,
        offer: pickup.offer,
        producerLifecycleKey: pickup.producerLifecycleKey,
        instanceProvenance: 'free',
        presentsMaterializedScreen: false,
        dispositionByAcquisitionRole: Object.freeze({
          self: Object.freeze({ kind: 'normal' as const }),
        }),
      },
      ...(seaStarProc
        ? {
            authoredSeaStarDuplicateSiteKeys: new Set([
              seaStarDuplicateSiteKey(createAcquisitionRoleAddress(pickup.origin, 'self')),
            ]),
          }
        : {}),
    },
    facts,
  ).branches;
}

function collectSeaStarDuplicate(branch: RewardBranchState, pickup: ReturnType<typeof roomPickup>) {
  return settlePickupAcquisitionSite(catalog, [branch], {
    siteOwner: pickup.siteOwner,
    site: createAcquisitionSiteAddress(pickup.siteOwner, 'seaStarDuplicate:resource:self'),
    entries: Object.freeze({
      seaStarDuplicate: createUnresolvedAcquisitionRewardState(
        catalog,
        pickup.offer,
        {
          kind: 'producerLifecycle',
          key: pickup.producerLifecycleKey,
        },
        'Underworld',
      ),
    }),
    order: Object.freeze(['seaStarDuplicate']),
    presentsMaterializedScreen: false,
    producerLifecycleKey: pickup.producerLifecycleKey,
    producerByEntryKey: Object.freeze({
      seaStarDuplicate: Object.freeze({
        kind: 'seaStarDuplicate' as const,
        sourceOwner: pickup.origin,
        sourceRole: 'self',
      }),
    }),
    requiredEntryKeys: new Set(),
    seaStarDuplicateEntryKeys: new Set(['seaStarDuplicate']),
    historySequence: 2,
    facts,
  }).branches;
}

describe('resource quantity production', () => {
  const amount = (gameName: string, rarity?: InRunTraitRarity, producer = 'RoomReward') =>
    resolveProducedResourceAmounts(
      catalog,
      gameName,
      producer,
      rarity === undefined ? createTraitHistoryState() : traitsWith(buriedTreasure(rarity)),
    );
  const rarities = ['Common', 'Rare', 'Epic', 'Heroic'] as const;

  it('rounds each object once from its base AddResources under Buried Treasure', () => {
    expect(amount('MetaCardPointsCommonDrop')).toEqual({ MetaCardPointsCommon: 5 });
    expect(rarities.map((r) => amount('MetaCardPointsCommonDrop', r))).toEqual(
      [8, 9, 10, 11].map((value) => ({ MetaCardPointsCommon: value })),
    );
    expect(rarities.map((r) => amount('MetaCardPointsCommonBigDrop', r))).toEqual(
      [15, 18, 20, 23].map((value) => ({ MetaCardPointsCommon: value })),
    );
    expect(rarities.map((r) => amount('MetaCurrencyDrop', r))).toEqual(
      [75, 88, 100, 113].map((value) => ({ MetaCurrency: value })),
    );
    expect(amount('MetaCurrencyBigDrop', 'Epic')).toEqual({ MetaCurrency: 200 });
  });

  it('keeps NPC drops at base, scales store items, and applies producer overrides', () => {
    expect(amount('MetaCardPointsCommonDrop', 'Heroic', 'NemesisEventPickup')).toEqual({
      MetaCardPointsCommon: 5,
    });
    expect(amount('MetaCardPointsCommonDrop', 'Common', 'WorldShop')).toEqual({
      MetaCardPointsCommon: 8,
    });
    expect(amount('MetaCardPointsCommonDrop', 'Common', 'NarcissusPickup')).toEqual({
      MetaCardPointsCommon: 15,
    });
    expect(amount('MaxHealthDrop', 'Common')).toBeUndefined();
  });

  it('fixes each Eris gift at its override, exempt from resource bonuses', () => {
    expect(amount('MetaCardPointsCommonDrop', 'Heroic', 'ErisCursePickup')).toEqual({
      MetaCardPointsCommon: 20,
    });
    // Psyche is untracked: the H gift carries no amount.
    expect(amount('MemPointsCommonDrop', 'Heroic', 'ErisCursePickup')).toBeUndefined();
    expect(amount('MetaCurrencyDrop', 'Heroic', 'ErisCursePickup')).toEqual({
      MetaCurrency: 300,
    });
    expect(amount('MemPointsCommonDrop')).toBeUndefined();
  });
});

describe('resource gains at acquisition', () => {
  it('credits the stored amount per resource key and keeps pickup counts', () => {
    const ashes = roomPickup('ashes', 'MetaCardPointsCommonDrop');
    const bones = roomPickup('bones', 'MetaCurrencyBigDrop');
    const [afterAshes] = collect(branchWith(traitsWith(buriedTreasure())), ashes);
    const [afterBones] = collect(afterAshes!, bones);
    expect(afterBones!.state.rewardHistory.resourceGains).toEqual({
      MetaCardPointsCommon: 8,
      MetaCurrency: 150,
    });
    expect(afterBones!.state.rewardHistory.consumableRecord).toEqual({
      MetaCardPointsCommonDrop: 1,
      MetaCurrencyBigDrop: 1,
    });
    expect(afterBones!.state.pendingResourcePickups).toEqual({});
  });

  it('grants a Sea Star duplicate the same rounded amount again', () => {
    const ashes = roomPickup('double-up', 'MetaCardPointsCommonDrop');
    const [source] = collect(branchWith(traitsWith(buriedTreasure(), seaStar)), ashes, true);
    expect(source!.state.rewardHistory.resourceGains).toEqual({ MetaCardPointsCommon: 8 });
    // Losing the bonus before the second pickup does not change the retained object.
    const [duplicate] = collectSeaStarDuplicate(withTraits(source!, traitsWith(seaStar)), ashes);
    expect(duplicate!.state.rewardHistory.resourceGains).toEqual({ MetaCardPointsCommon: 16 });
    expect(duplicate!.state.rewardHistory.consumableRecord.MetaCardPointsCommonDrop).toBe(2);
    expect(duplicate!.state.pendingResourcePickups).toEqual({});
  });

  it('keeps a delayed pickup at its production amount across later trait changes', () => {
    const early = roomPickup('produced-plain', 'MetaCardPointsCommonDrop');
    const plain = branchWith(createTraitHistoryState());
    const produced = Object.freeze({
      ...plain,
      state: producePendingResourcePickups(catalog, plain.state, [early]),
    });
    const [gained] = collect(withTraits(produced, traitsWith(buriedTreasure('Epic'))), early);
    expect(gained!.state.rewardHistory.resourceGains).toEqual({ MetaCardPointsCommon: 5 });

    const late = roomPickup('produced-boosted', 'MetaCardPointsCommonDrop');
    const boosted = branchWith(traitsWith(buriedTreasure()));
    const stored = Object.freeze({
      ...boosted,
      state: producePendingResourcePickups(catalog, boosted.state, [late]),
    });
    const [kept] = collect(withTraits(stored, createTraitHistoryState()), late);
    expect(kept!.state.rewardHistory.resourceGains).toEqual({ MetaCardPointsCommon: 8 });
  });

  it('exposes gains to requirement contexts as a summed resource record', () => {
    const threshold: RequirementExpression = {
      kind: 'recordCount',
      record: 'resourceGains',
      keys: ['MetaCardPointsCommon'],
      range: { min: 5 },
    };
    const branch = branchWith(createTraitHistoryState());
    expect(evaluateRequirement(threshold, facts(branch.state).requirements)).toBe(false);
    const [gained] = collect(branch, roomPickup('threshold', 'MetaCardPointsCommonDrop'));
    expect(evaluateRequirement(threshold, facts(gained!.state).requirements)).toBe(true);
    const [bones] = collect(branch, roomPickup('threshold-bones', 'MetaCurrencyDrop'));
    expect(evaluateRequirement(threshold, facts(bones!.state).requirements)).toBe(false);
    const [gift] = collect(
      branch,
      roomPickup('threshold-eris', 'MetaCardPointsCommonDrop', 'ErisCursePickup'),
    );
    expect(gift!.state.rewardHistory.resourceGains).toEqual({ MetaCardPointsCommon: 20 });
    expect(evaluateRequirement(threshold, facts(gift!.state).requirements)).toBe(true);
  });

  it('never lets Sea Star duplicate an Eris gift', () => {
    const gift = roomPickup('eris-sea-star', 'MetaCardPointsCommonDrop', 'ErisCursePickup');
    const [collected] = collect(branchWith(traitsWith(seaStar)), gift, true);
    const role = semanticAddressKey(createAcquisitionRoleAddress(gift.origin, 'self'));
    expect(collected!.seaStarDuplicateEligibilityBySource?.[role]).toMatchObject({
      supported: false,
      evidence: { seaStarActive: true, canDuplicate: true, blocksSeaStarDuplication: true },
    });
    const ashes = roomPickup('ashes-sea-star', 'MetaCardPointsCommonDrop');
    const [ordinary] = collect(branchWith(traitsWith(seaStar)), ashes, true);
    expect(
      ordinary!.seaStarDuplicateEligibilityBySource?.[
        semanticAddressKey(createAcquisitionRoleAddress(ashes.origin, 'self'))
      ]?.supported,
    ).toBe(true);
  });
});

describe('resource gains in the Run State product', () => {
  const occurrenceId = createOccurrenceId('golden-h-combat02');
  const optional = Object.freeze({
    kind: 'interactLocalReward' as const,
    groupKey: 'optionalRewards',
    slotKey: 'optional1',
  });
  const cages = [
    { kind: 'completeFieldsCage' as const, phaseKey: 'Cage02' },
    { kind: 'interactLocalReward' as const, groupKey: 'cages', slotKey: 'cage2' },
    { kind: 'completeFieldsCage' as const, phaseKey: 'Cage01' },
    { kind: 'interactLocalReward' as const, groupKey: 'cages', slotKey: 'cage1' },
  ];
  const withOptionalBones = applyProjectCommand(createGoldenFGHProject(), catalog, {
    kind: 'ReplaceLocalReward',
    reward: createLocalRewardAddress(goldenHBiome, occurrenceId, 'optionalRewards', 'optional1'),
    value: { rewardType: 'MetaCurrencyDrop' },
  });
  const ordered = (optionalFirst: boolean) =>
    replaceTestRoomActionOrder(
      withOptionalBones,
      catalog,
      goldenHBiome,
      occurrenceId,
      optionalFirst ? [optional, ...cages] : [...cages, optional],
    );

  function hGains(project: ProjectDocument) {
    const biomeResult = simulateProject(catalog, project).route.biomes.find(
      (candidate) => candidate.biomeKey === 'H',
    );
    if (biomeResult?.authoring !== 'complete' || biomeResult.validity !== 'valid')
      throw new Error('H did not evaluate validly');
    const at = (snapshot: RunStateSnapshot | undefined) => snapshot?.resourceGains.MetaCurrency;
    const owner = (key: string) =>
      biomeResult.rewards.runStateSnapshots.find((snapshot) =>
        semanticAddressKey(snapshot.owner).includes(key),
      );
    const bonesAtThreshold = {
      kind: 'recordCount',
      record: 'resourceGains',
      keys: ['MetaCurrency'],
      range: { min: 300 },
    } as const;
    const generation = biomeResult.rewards.targetHistory.filter((checkpoint) =>
      semanticAddressKey(checkpoint.origin).includes('golden-h-combat02'),
    );
    return {
      entry: at(owner('"golden-h-combat02","roomEntered"')),
      generation: at(owner('{"kind":"occurrence","occurrenceId":"golden-h-combat02"}')),
      exit: at(owner('"golden-h-combat02","beforeRoomExit"')),
      next: at(owner('"golden-h-combat09","roomEntered"')),
      // Objects spawned at Fields entry but not yet collected at generation.
      pendingAtGeneration: generation.flatMap((checkpoint) =>
        checkpoint.states.flatMap((state) =>
          Object.values(state.pendingResourcePickups).flatMap((room) => Object.values(room)),
        ),
      ),
      thresholdAtGeneration: generation.flatMap((checkpoint) =>
        checkpoint.states.map((state) =>
          evaluateRequirement(bonesAtThreshold, facts(state).requirements),
        ),
      ),
    };
  }

  it('counts only pickups settled before outgoing generation toward its doors', () => {
    expect(hGains(ordered(true))).toMatchObject({
      entry: 250,
      generation: 300,
      exit: 300,
      next: 300,
    });
    const late = hGains(ordered(false));
    expect(late).toMatchObject({ entry: 250, generation: 250, exit: 300, next: 300 });
    expect(late.pendingAtGeneration).toContainEqual({ MetaCurrency: 50 });
    expect(late.thresholdAtGeneration.length).toBeGreaterThan(0);
    expect(late.thresholdAtGeneration.every((met) => !met)).toBe(true);
    expect(hGains(ordered(true)).thresholdAtGeneration.every((met) => met)).toBe(true);
  });

  it('restores the prior gains when engine history undoes and redoes an edit', () => {
    const before = ordered(false);
    const edited = applyProjectHistoryCommand(createProjectHistory(before), catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(goldenHBiome, occurrenceId, 'optionalRewards', 'optional1'),
      value: { rewardType: 'MetaCardPointsCommonDrop' },
    });
    expect(hGains(edited.present)).toMatchObject({ exit: 250, next: 250 });
    const undone = undoProjectHistory(edited);
    expect(undone.present).toBe(before);
    expect(hGains(undone.present)).toEqual(hGains(before));
    expect(hGains(redoProjectHistory(undone).present)).toEqual(hGains(edited.present));
  });
});
