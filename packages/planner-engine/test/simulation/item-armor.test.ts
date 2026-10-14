import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  seaStarDuplicateSiteKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { factsWithHistory } from '@run-planner/engine/reward-kernel';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { surfaceShrineDeliveriesProject } from '@run-planner/test-fixtures/surface';
import { goldenFBiome } from '@run-planner/test-fixtures/underworld';
import { createUnresolvedAcquisitionRewardState } from '../../src/authored-project/traits/state';
import { createKeepsakeState } from '../../src/simulation/keepsakes/state';
import {
  settleOwnedAcquisitionSite,
  settlePickupAcquisitionSite,
} from '../../src/simulation/rewards/acquisition/site-settlement';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import type { SimulationState } from '../../src/simulation/state/model';
import { createTraitHistoryState } from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { baseFacts } from './shop-trait-purchase-support';

const biome = createBiomeAddress('Underworld', 'F');
const facts = (state: SimulationState) =>
  factsWithHistory(baseFacts(), state.rewardHistory, new Set());

function pickup(name: string, rewardType: string, producerLifecycleKey: string) {
  const occurrenceId = createOccurrenceId(`armor-${name}`);
  return Object.freeze({
    siteOwner: createOccurrenceAddress(biome, occurrenceId),
    origin: createIncomingRewardAddress(biome, occurrenceId),
    offer: Object.freeze({ rewardType }),
    producerLifecycleKey,
  });
}

function collect(
  branch: RewardBranchState,
  item: ReturnType<typeof pickup>,
  options: { readonly timePiece?: boolean; readonly seaStarProc?: boolean } = {},
) {
  return settleOwnedAcquisitionSite(
    catalog,
    [branch],
    {
      siteOwner: item.siteOwner,
      pointKey: 'roomRewardPickup',
      entryKey: 'self',
      historySequence: 1,
      source: {
        origin: item.origin,
        offer: item.offer,
        producerLifecycleKey: item.producerLifecycleKey,
        instanceProvenance: 'free',
        presentsMaterializedScreen: false,
        dispositionByAcquisitionRole: Object.freeze({
          self: Object.freeze(
            options.timePiece === true
              ? { kind: 'timePiece' as const }
              : { kind: 'normal' as const },
          ),
        }),
      },
      ...(options.seaStarProc === true
        ? {
            authoredSeaStarDuplicateSiteKeys: new Set([
              seaStarDuplicateSiteKey(createAcquisitionRoleAddress(item.origin, 'self')),
            ]),
          }
        : {}),
    },
    facts,
  ).branches;
}

function collectSeaStarDuplicate(branch: RewardBranchState, item: ReturnType<typeof pickup>) {
  return settlePickupAcquisitionSite(catalog, [branch], {
    siteOwner: item.siteOwner,
    site: createAcquisitionSiteAddress(item.siteOwner, 'seaStarDuplicate:armor:self'),
    entries: Object.freeze({
      seaStarDuplicate: createUnresolvedAcquisitionRewardState(
        catalog,
        item.offer,
        { kind: 'producerLifecycle', key: item.producerLifecycleKey },
        'Underworld',
      ),
    }),
    order: Object.freeze(['seaStarDuplicate']),
    presentsMaterializedScreen: false,
    producerLifecycleKey: item.producerLifecycleKey,
    producerByEntryKey: Object.freeze({
      seaStarDuplicate: Object.freeze({
        kind: 'seaStarDuplicate' as const,
        sourceOwner: item.origin,
        sourceRole: 'self',
      }),
    }),
    requiredEntryKeys: new Set(),
    seaStarDuplicateEntryKeys: new Set(['seaStarDuplicate']),
    historySequence: 2,
    facts,
  }).branches;
}

function branchWith(patch: Partial<SimulationState> = {}): RewardBranchState {
  const branch = initializeTestRewardBranches()[0]!;
  return Object.freeze({ ...branch, state: Object.freeze({ ...branch.state, ...patch }) });
}

describe('item armor at acquisition', () => {
  it('credits each armor item from every free producer that drops it', () => {
    for (const [rewardType, producer, armor] of [
      ['ArmorBoost', 'RoomReward', 20],
      ['ArmorBigBoost', 'HermesShrineDelivery', 40],
      ['ArmorBoost', 'NemesisEventPickup', 20],
    ] as const) {
      const [settled] = collect(
        branchWith(),
        pickup(`${rewardType}-${producer}`, rewardType, producer),
      );
      const history = settled!.state.rewardHistory;
      expect(history.itemArmor, `${rewardType} from ${producer}`).toBe(armor);
      expect(history.consumableRecord[rewardType]).toBe(1);
      expect(history.maxStatGains).toEqual({ maxHealth: 0, maxMana: 0 });
    }
  });

  it('adds nothing for an item Time Piece converts to gold', () => {
    const branch = initializeTestRewardBranches()[0]!;
    const holding = branchWith({
      keepsakes: createKeepsakeState(catalog, 'GoldifyKeepsake', branch.state.arcanaFear),
    });
    const [converted] = collect(holding, pickup('goldified', 'ArmorBoost', 'RoomReward'), {
      timePiece: true,
    });
    expect(converted!.events).toContainEqual(expect.objectContaining({ kind: 'conversionToGold' }));
    expect(converted!.state.rewardHistory.itemArmor).toBe(0);
    expect(converted!.state.rewardHistory.consumableRecord.ArmorBoost).toBeUndefined();
  });

  it('credits a Sea Star duplicate again', () => {
    const seaStar = Object.freeze({
      ...createTraitHistoryState(),
      equippedTraits: Object.freeze({
        DoubleRewardBoon: Object.freeze({
          traitKey: 'DoubleRewardBoon',
          giverKey: 'Poseidon',
          providerKind: 'olympian' as const,
          rarity: 'Common' as const,
          sourceRole: 'selection',
        }),
      }),
    });
    const item = pickup('double', 'ArmorBoost', 'RoomReward');
    const [source] = collect(branchWith({ traitHistory: seaStar }), item, { seaStarProc: true });
    expect(source!.state.rewardHistory.itemArmor).toBe(20);
    const [duplicate] = collectSeaStarDuplicate(source!, item);
    expect(duplicate!.state.rewardHistory.itemArmor).toBe(40);
    expect(duplicate!.state.rewardHistory.consumableRecord.ArmorBoost).toBe(2);
  });
});

describe('item armor on authored routes', () => {
  function terminal(project: ProjectDocument, biomeKey: string) {
    const result = simulateProject(catalog, project).route.biomes.find(
      (candidate) => candidate.biomeKey === biomeKey,
    );
    if (result?.authoring !== 'complete' || result.validity !== 'valid')
      throw new Error(`${biomeKey} did not evaluate validly`);
    return result.rewards.branches.map((branch) => branch.state.rewardHistory);
  }

  it('credits a World Shop purchase', () => {
    const histories = terminal(loadUnderworldWorldShopTravelDealCheckpoint(), 'F');
    expect(histories.length).toBeGreaterThan(0);
    for (const history of histories) {
      expect(history.consumableRecord.ArmorBoost).toBe(1);
      expect(history.itemArmor).toBe(20);
    }
  });

  it('credits a Hermes Shrine delivery', () => {
    for (const history of terminal(surfaceShrineDeliveriesProject(), 'O')) {
      expect(history.consumableRecord.ArmorBoost).toBe(1);
      expect(history.itemArmor).toBe(20);
    }
  });

  it('records a Well armor purchase as a consumable and credits it', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const offered = applyProjectCommand(loadUnderworldFStygianWellCheckpoint(), catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    expect(terminal(offered, 'F').every((history) => history.itemArmor === 0)).toBe(true);
    const bought = applyProjectCommand(offered, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:healing',
      purchased: true,
    });
    const histories = terminal(bought, 'F');
    expect(histories.length).toBeGreaterThan(0);
    for (const history of histories) {
      expect(history.consumableRecord.ArmorBoostStore).toBe(1);
      expect(history.itemArmor).toBe(20);
    }
  });
});
