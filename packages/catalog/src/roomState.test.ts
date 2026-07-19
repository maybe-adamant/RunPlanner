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

const ordinary = { role: 'ordinary', entryActive: true } as const;

describe('F/G authored room state v2', () => {
  it('composes counted offer defaults from the resolved store', () => {
    expect(
      createDefaultRoomState(catalog, room('F_Combat02'), {
        ...ordinary,
        resolvedStoreKey: 'MetaProgress',
      }),
    ).toEqual({
      kind: 'counted',
      offer: { rewardType: 'GiftDrop' },
    });
    expect(createDefaultRoomState(catalog, room('G_Intro'), ordinary)).toEqual({ kind: 'none' });
    expect(createDefaultRoomState(catalog, room('F_Story01'), ordinary)).toEqual({ kind: 'fixed' });
  });

  it('keeps unpicked shops inventory-free and materializes complete entry state', () => {
    expect(
      createDefaultRoomState(catalog, room('F_Shop01'), {
        role: 'ordinary',
        entryActive: false,
      }),
    ).toEqual({ kind: 'shop' });

    const entered = createDefaultRoomState(catalog, room('F_Shop01'), ordinary);
    expect(entered).toMatchObject({
      kind: 'shop',
      shop: {
        profileKey: 'WorldShop',
        offers: {
          Boon: {
            offer: {
              rewardType: 'RandomLoot',
              payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
            },
            purchased: false,
          },
        },
      },
    });
  });

  it('derives forked preboss state from terminal role and entry status', () => {
    const preboss = room('G_PreBoss01');
    expect(
      createDefaultRoomState(catalog, preboss, {
        role: 'terminalShop',
        resolvedStoreKey: 'RunProgress',
        entryActive: false,
      }),
    ).toEqual({ kind: 'shop' });
    expect(
      createDefaultRoomState(catalog, preboss, {
        role: 'terminalFreeReward',
        resolvedStoreKey: 'RunProgress',
        entryActive: false,
      }),
    ).toEqual({
      kind: 'freeReward',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
  });

  it('decodes complete offers and rejects filtered rewards or invalid payloads', () => {
    expect(
      decodeRoomState(
        { kind: 'counted', offer: { rewardType: 'GiftDrop' } },
        catalog,
        room('F_Combat02'),
        ordinary,
        '$.state',
      ),
    ).toEqual({ kind: 'counted', offer: { rewardType: 'GiftDrop' } });

    expect(() =>
      decodeRoomState(
        {
          kind: 'counted',
          offer: {
            rewardType: 'Devotion',
            payload: {
              kind: 'DevotionPair',
              chosenSource: 'ApolloUpgrade',
              spurnedSource: 'ZeusUpgrade',
            },
          },
        },
        catalog,
        room('F_Combat01'),
        ordinary,
        '$.state',
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.state.offer.rewardType',
        'Devotion is filtered from this room',
      ),
    );
  });

  it('requires shop inventory only for an entered occurrence', () => {
    expect(
      decodeRoomState(
        { kind: 'shop' },
        catalog,
        room('F_Shop01'),
        { role: 'ordinary', entryActive: false },
        '$.state',
      ),
    ).toEqual({ kind: 'shop' });
    expect(() =>
      decodeRoomState({ kind: 'shop' }, catalog, room('F_Shop01'), ordinary, '$.state'),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.state.shop',
        'is required for an entered shop occurrence',
      ),
    );
  });
});
