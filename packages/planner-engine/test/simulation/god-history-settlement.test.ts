import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type AuthoredTraitOffer,
} from '@run-planner/engine/authored-project';
import { factsWithHistory } from '@run-planner/engine/reward-kernel';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createDefaultRoomState } from '../../src/authored-project/room-state/defaults';
import { createDefaultRoomEncounterState } from '../../src/authored-project/room-state/encounter-envelope';
import { materializeAuthoredRoom } from '../../src/simulation/materialization/rooms/assemble';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition/site-settlement';
import { processShopInventory } from '../../src/simulation/rewards/shop/inventory';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import { replaceSimulationTraitHistory } from '../../src/simulation/state/transitions';
import { foldTraitHistoryEvents } from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { traitFrontierState } from '../support/simulation-state';
import { ordinaryPositionFor } from '../support/route-position';
import {
  baseFacts,
  completeShopFixtureReward,
  completeWorldShopOffers,
} from './shop-trait-purchase-support';

const biome = createBiomeAddress('Underworld', 'F');

function closedBranch(): RewardBranchState {
  const branch = initializeTestRewardBranches()[0]!;
  return Object.freeze({
    ...branch,
    state: traitFrontierState(undefined, { saveFileGodHistory: 'closed' }),
  });
}

function poseidonScreen(selectedTraitKey = 'PoseidonWeaponBoon'): AuthoredTraitOffer {
  return {
    kind: 'traits',
    giverKey: 'Poseidon',
    options: [
      { traitKey: selectedTraitKey, rarity: 'Common' },
      { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
      { traitKey: 'PoseidonCastBoon', rarity: 'Common' },
    ],
    selectedOptionKey: 'option1',
  } as AuthoredTraitOffer;
}

/** Picks up one free Poseidon door reward with the given authored screen. */
function settlePoseidonDoor(branch: RewardBranchState, screen: AuthoredTraitOffer | null) {
  const occurrenceId = createOccurrenceId('god-history-door');
  return settleOwnedAcquisitionSite(
    catalog,
    [branch],
    {
      siteOwner: createOccurrenceAddress(biome, occurrenceId),
      pointKey: 'roomRewardPickup',
      entryKey: 'self',
      source: {
        origin: createIncomingRewardAddress(biome, occurrenceId),
        offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        presentsMaterializedScreen: true,
        traitContext: {},
        traitOffersByAcquisitionRole: { source: screen },
      },
      historySequence: 1,
    },
    (state) => factsWithHistory(baseFacts(), state.rewardHistory, new Set()),
  );
}

describe('god use and pickup settlement contacts', () => {
  it('records both use and pickup when the upgrade screen completes', () => {
    const settled = settlePoseidonDoor(closedBranch(), poseidonScreen());
    expect(settled.findingEmissions).toEqual([]);
    const history = settled.branches[0]!.state.rewardHistory;
    expect(history.lifetimeGodUseRecord).toEqual({ PoseidonUpgrade: 1 });
    expect(history.lifetimeGodPickupRecord).toEqual({ PoseidonUpgrade: 1 });
  });

  it('records use without pickup when the reached screen has no selection', () => {
    const settled = settlePoseidonDoor(closedBranch(), null);
    expect(settled.branches).toEqual([]);
    const blocked = settled.traitChildSettlements?.[0]?.branch;
    expect(blocked?.state.rewardHistory.lifetimeGodUseRecord).toEqual({ PoseidonUpgrade: 1 });
    expect(blocked?.state.rewardHistory.lifetimeGodPickupRecord).toEqual({});
  });

  it('records use without pickup when the reached screen is invalid', () => {
    const settled = settlePoseidonDoor(closedBranch(), poseidonScreen('ZeusWeaponBoon'));
    expect(settled.findingEmissions.length).toBeGreaterThan(0);
    const history = settled.branches[0]!.state.rewardHistory;
    expect(history.lifetimeGodUseRecord).toEqual({ PoseidonUpgrade: 1 });
    expect(history.lifetimeGodPickupRecord).toEqual({});
  });

  it('retains both records after the selected boon is removed', () => {
    const settled = settlePoseidonDoor(closedBranch(), poseidonScreen()).branches[0]!;
    const removed = foldTraitHistoryEvents(catalog, [
      ...settled.state.traitHistory.events,
      {
        kind: 'traitRemoval',
        owner: { kind: 'project' },
        acquisitionRole: 'sale',
        sequence: 2,
        acquisitionPoint: 'test',
        traitKey: 'PoseidonWeaponBoon',
        match: 'currentTraitKey',
      },
    ]);
    const after = replaceSimulationTraitHistory(settled.state, removed);
    expect(after.traitHistory.equippedTraits.PoseidonWeaponBoon).toBeUndefined();
    expect(after.rewardHistory.lifetimeGodUseRecord).toEqual({ PoseidonUpgrade: 1 });
    expect(after.rewardHistory.lifetimeGodPickupRecord).toEqual({ PoseidonUpgrade: 1 });
  });

  it('adds the run pickup to a mature file without changing the run pool facts', () => {
    const mature = initializeTestRewardBranches()[0]!;
    const history = settlePoseidonDoor(mature, poseidonScreen()).branches[0]!.state.rewardHistory;
    expect(history.lifetimeGodPickupRecord.PoseidonUpgrade).toBe(2);
    expect(history.lootTypeHistory).toEqual({ PoseidonUpgrade: 1 });
  });
});

describe('World Shop inventory generation reads god pickups', () => {
  function worldShopBoonFindings(branch: RewardBranchState, source: string) {
    const room = catalog.rooms.byKey.F_Shop01!;
    const loadout = createDefaultRouteLoadout(catalog);
    const state = createDefaultRoomState(catalog, room, {
      routeKey: 'Underworld',
      role: 'ordinary',
      entryActive: true,
      loadout,
    });
    if (state.kind !== 'shop' || state.shop === undefined) throw new Error('missing World Shop');
    const boon = completeShopFixtureReward(
      { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source } },
      loadout,
    );
    const shop = Object.freeze({
      ...state.shop,
      offers: completeWorldShopOffers(state.shop, loadout, { Boon: boon }),
    });
    const occurrenceId = createOccurrenceId('god-history-shop');
    const canonical = materializeAuthoredRoom({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      room,
      occurrence: Object.freeze({
        occurrenceId,
        gameName: room.gameName,
        state: Object.freeze({ ...state, shop }),
        acquisitionSites: Object.freeze({}),
        encounters: createDefaultRoomEncounterState(catalog, room, 'god-history-shop.encounters'),
        additionalExits: Object.freeze([]),
        roomActions: Object.freeze({ order: Object.freeze([]) }),
      }),
      role: 'ordinary',
      entered: true,
      lifecycleProfileKey: 'WorldShopRoom',
      loadout,
    });
    const inventory = processShopInventory([branch], {
      catalog,
      room: canonical,
      declaration: room,
      historySequence: 2,
      facts: (reached) => factsWithHistory(baseFacts(), reached.rewardHistory, new Set()),
      fail: (detail) => {
        throw new Error(detail);
      },
    });
    return inventory.findingEmissions.map((entry) => entry.finding.code);
  }

  it('offers only gods picked up on a closed file once one has been', () => {
    const afterPoseidon = settlePoseidonDoor(closedBranch(), poseidonScreen()).branches[0]!;
    expect(worldShopBoonFindings(afterPoseidon, 'PoseidonUpgrade')).toEqual([]);
    expect(worldShopBoonFindings(afterPoseidon, 'ApolloUpgrade')).toEqual(['shopOfferUnavailable']);
    // Nothing picked up yet: the native fallback admits every eligible god.
    expect(worldShopBoonFindings(closedBranch(), 'ApolloUpgrade')).toEqual([]);
  });

  it('keeps every god available on a mature file', () => {
    const mature = initializeTestRewardBranches()[0]!;
    const afterPoseidon = settlePoseidonDoor(mature, poseidonScreen()).branches[0]!;
    expect(worldShopBoonFindings(afterPoseidon, 'ApolloUpgrade')).toEqual([]);
    expect(worldShopBoonFindings(afterPoseidon, 'HestiaUpgrade')).toEqual([]);
  });
});
