import { describe, expect, it } from 'vitest';
import {
  createDefaultRoomState,
  decodeRoomState,
  ProjectDocumentContractError,
} from '@run-planner/core';

import { catalog } from './index';

function room(gameName: string) {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) {
    throw new Error(`missing room ${gameName}`);
  }
  return declaration;
}

describe('F/G authored room state', () => {
  it('composes counted reward defaults through store and primitive defaults', () => {
    expect(createDefaultRoomState(catalog, room('F_Combat02'))).toEqual({
      kind: 'counted',
      choice: {
        storeKey: 'RunProgress',
        reward: {
          rewardType: 'Boon',
          payload: { source: 'ApolloUpgrade' },
        },
      },
    });
    expect(createDefaultRoomState(catalog, room('G_Intro'))).toEqual({ kind: 'none' });
    expect(createDefaultRoomState(catalog, room('F_Story01'))).toEqual({ kind: 'fixed' });
  });

  it('creates complete WorldShop offers with concrete purchase state', () => {
    expect(createDefaultRoomState(catalog, room('F_Shop01'))).toEqual({
      kind: 'shop',
      shop: {
        profileKey: 'WorldShop',
        offers: {
          Boon: {
            reward: {
              rewardType: 'RandomLoot',
              payload: { source: 'ApolloUpgrade' },
            },
            purchased: false,
          },
          MajorNonBoon: {
            reward: { rewardType: 'WeaponUpgradeDrop' },
            purchased: false,
          },
          Minor: {
            reward: { rewardType: 'MaxManaDrop' },
            purchased: false,
          },
        },
      },
    });
  });

  it('derives forked preboss state from terminal role', () => {
    const preboss = room('G_PreBoss01');

    expect(createDefaultRoomState(catalog, preboss, 'terminalShop')).toMatchObject({
      kind: 'shop',
      shop: { profileKey: 'WorldShop' },
    });
    expect(createDefaultRoomState(catalog, preboss, 'terminalFreeReward')).toEqual({
      kind: 'freeReward',
      choice: {
        storeKey: 'RunProgress',
        reward: { rewardType: 'Boon', payload: { source: 'ApolloUpgrade' } },
      },
    });
    expect(() => createDefaultRoomState(catalog, preboss)).toThrowError(
      new ProjectDocumentContractError(
        'rooms.G_PreBoss01.state',
        'ForkedPreboss requires a derived terminal role',
      ),
    );
  });

  it('decodes complete replacements and rejects filtered rewards or invalid payloads', () => {
    expect(
      decodeRoomState(
        {
          kind: 'counted',
          choice: {
            storeKey: 'MetaProgress',
            reward: { rewardType: 'GiftDrop' },
          },
        },
        catalog,
        room('F_Combat02'),
        'ordinary',
        '$.state',
      ),
    ).toEqual({
      kind: 'counted',
      choice: { storeKey: 'MetaProgress', reward: { rewardType: 'GiftDrop' } },
    });

    expect(() =>
      decodeRoomState(
        {
          kind: 'counted',
          choice: {
            storeKey: 'RunProgress',
            reward: {
              rewardType: 'Devotion',
              payload: { sources: ['ApolloUpgrade', 'ZeusUpgrade'] },
            },
          },
        },
        catalog,
        room('F_Combat01'),
        'ordinary',
        '$.state',
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.state.choice.reward.rewardType',
        'Devotion is filtered from this room',
      ),
    );

    expect(() =>
      decodeRoomState(
        {
          kind: 'counted',
          choice: {
            storeKey: 'RunProgress',
            reward: { rewardType: 'Boon', payload: { source: 'MissingUpgrade' } },
          },
        },
        catalog,
        room('F_Combat02'),
        'ordinary',
        '$.state',
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.state.choice.reward.payload.source',
        'MissingUpgrade is not in BoonSource',
      ),
    );
  });

  it('decodes shop purchases against stable slot domains', () => {
    const defaultState = createDefaultRoomState(catalog, room('F_Shop01'));
    if (defaultState.kind !== 'shop') {
      throw new Error('expected shop state');
    }
    const decoded = decodeRoomState(
      {
        ...defaultState,
        shop: {
          ...defaultState.shop,
          offers: {
            ...defaultState.shop.offers,
            Minor: {
              reward: { rewardType: 'StackUpgrade' },
              purchased: true,
            },
          },
        },
      },
      catalog,
      room('F_Shop01'),
      'ordinary',
      '$.state',
    );

    expect(decoded).toMatchObject({
      kind: 'shop',
      shop: {
        offers: {
          Minor: { reward: { rewardType: 'StackUpgrade' }, purchased: true },
        },
      },
    });
  });
});
