import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { createDefaultRoomState } from '../../../src/authored-project/room-state/defaults';

function room(gameName: string): RoomDeclaration {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
}

describe('authored room-state defaults', () => {
  it('constructs complete declaration-owned complex defaults', () => {
    expect(
      createDefaultRoomState(catalog, room('H_Combat02'), {
        role: 'ordinary',
        entryActive: true,
      }),
    ).toMatchObject({
      kind: 'fieldsCombat',
      cages: {
        cage1: { offer: { rewardType: expect.any(String) } },
        cage2: { offer: { rewardType: expect.any(String) } },
        cage3: { offer: { rewardType: expect.any(String) } },
      },
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
      reward: { offer: { rewardType: expect.any(String) } },
      sideRooms: {
        sideDoor1: {
          generation: 'notGenerated',
          enteredOrdinal: null,
          reward: { offer: { rewardType: expect.any(String) } },
        },
        sideDoor2: {
          generation: 'notGenerated',
          enteredOrdinal: null,
          reward: { offer: { rewardType: expect.any(String) } },
        },
      },
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
      reward: { offer: declaration.incomingReward.defaultOffersByStore.RunProgress },
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
        purchaseOrder: [],
        offers: {
          Boon: {},
          MajorNonBoon: {},
          Minor: {},
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
        reward: { offer: policy.remainingOffers.reward.defaultOffersByStore.RunProgress },
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
      reward: { offer: policy.remainingOffers.reward.defaultOffersByStore.RunProgress },
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
