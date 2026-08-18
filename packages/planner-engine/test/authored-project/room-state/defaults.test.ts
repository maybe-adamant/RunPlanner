import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import {
  createUnresolvedLevelResolutions,
  producerLevelEffectSource,
} from '../../../src/authored-project/traits';

function room(gameName: string): RoomDeclaration {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
}

describe('authored room-state defaults', () => {
  it('creates a random level child only for the RoomReward GiftDrop producer', () => {
    const standard = room('F_Combat04');
    if (standard.incomingReward.kind === 'none') throw new Error('expected reward producer');
    expect(
      createUnresolvedLevelResolutions(
        catalog,
        { rewardType: 'GiftDrop' },
        producerLevelEffectSource(standard.incomingReward),
      ),
    ).toEqual({ self: { kind: 'random', targetTraitKey: null } });

    const shop = room('F_Shop01');
    if (shop.incomingReward.kind !== 'shop') throw new Error('expected shop producer');
    expect(
      createUnresolvedLevelResolutions(
        catalog,
        { rewardType: 'GiftDrop' },
        {
          kind: 'shopProfile',
          key: shop.incomingReward.shopProfileKey,
        },
      ),
    ).toBeUndefined();
  });

  it('constructs declaration-owned structure with unresolved authorable rewards', () => {
    expect(
      createDefaultRoomState(catalog, room('H_Combat02'), {
        role: 'ordinary',
        entryActive: true,
      }),
    ).toMatchObject({
      kind: 'fieldsCombat',
      cages: {
        cage1: null,
        cage2: null,
        cage3: null,
      },
      optionalRewardCount: 2,
      optionalRewards: {
        optional1: null,
        optional2: null,
        optional3: null,
      },
    });

    expect(
      createDefaultRoomState(catalog, room('H_Combat02'), {
        role: 'ordinary',
        entryActive: true,
        activeCageCount: 3,
      }),
    ).toMatchObject({
      kind: 'fieldsCombat',
      cages: { cage3: null },
    });

    expect(
      createDefaultRoomState(catalog, room('O_Combat01'), {
        role: 'ordinary',
        entryActive: true,
      }),
    ).toMatchObject({
      kind: 'shipCombat',
      encounterCount: 2,
      wheels: {
        wheel1: { offerCount: 1, pickedOfferIndex: 1 },
        wheel2: { offerCount: 1, pickedOfferIndex: 1 },
      },
    });

    expect(
      createDefaultRoomState(catalog, room('N_Combat02'), {
        role: 'ordinary',
        entryActive: true,
      }),
    ).toMatchObject({
      kind: 'ephyraCombat',
      reward: null,
    });
  });

  it('lets declaration-owned stores override the resolved batch store', () => {
    const declaration = room('F_Combat01');
    if (declaration.incomingReward.kind !== 'countedChoice') {
      throw new Error('F_Combat01 must have a counted reward binding');
    }
    expect(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        resolvedStoreKey: 'MetaProgress',
        entryActive: true,
      }),
    ).toMatchObject({
      kind: 'counted',
      reward: null,
    });
  });

  it('keeps Shop inventory dormant until entry and constructs the complete active inventory', () => {
    const declaration = room('F_Shop01');
    expect(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: false,
      }),
    ).toEqual({ kind: 'shop' });
    expect(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      }),
    ).toMatchObject({
      kind: 'shop',
      shop: {
        profileKey: 'WorldShop',
        offers: {
          Boon: { reward: null },
          MajorNonBoon: { reward: null },
          Minor: { reward: null },
        },
      },
    });
  });

  it.each(['F_PreBoss01', 'G_PreBoss01', 'P_PreBoss01'])(
    '%s free offers use the declaration-forced RunProgress store',
    (gameName) => {
      const declaration = room(gameName);
      const policy = declaration.prebossBatchPolicy;
      if (policy?.kind !== 'takeOverNormalDoors' || policy.remainingOffers.kind !== 'counted') {
        throw new Error(`${gameName} must have counted remaining offers`);
      }
      expect(
        createDefaultRoomState(catalog, declaration, {
          role: 'prebossFreeReward',
          resolvedStoreKey: 'MetaProgress',
          entryActive: false,
        }),
      ).toMatchObject({
        kind: 'freeReward',
        reward: null,
      });
    },
  );

  it('constructs Preboss Shop and free-reward roles from one declaration', () => {
    const declaration = room('H_PreBoss01');
    const policy = declaration.prebossBatchPolicy;
    if (policy?.kind !== 'takeOverNormalDoors' || policy.remainingOffers.kind !== 'counted') {
      throw new Error('H_PreBoss01 must have counted remaining offers');
    }
    expect(
      createDefaultRoomState(catalog, declaration, {
        role: 'prebossShop',
        entryActive: false,
      }),
    ).toEqual({ kind: 'shop' });
    expect(
      createDefaultRoomState(catalog, declaration, {
        role: 'prebossShop',
        entryActive: true,
      }),
    ).toMatchObject({ kind: 'shop', shop: { profileKey: 'WorldShop' } });
    expect(
      createDefaultRoomState(catalog, declaration, {
        role: 'prebossFreeReward',
        entryActive: false,
      }),
    ).toMatchObject({
      kind: 'freeReward',
      reward: null,
    });
  });

  it('rejects a Preboss without its declaration-derived offer role at the default path', () => {
    expect(() =>
      createDefaultRoomState(catalog, room('H_PreBoss01'), {
        role: 'ordinary',
        entryActive: false,
      }),
    ).toThrow('rooms.H_PreBoss01.state: Preboss requires a declaration-derived offer role');
  });
});
