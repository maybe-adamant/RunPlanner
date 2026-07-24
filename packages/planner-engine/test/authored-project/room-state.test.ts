import { describe, expect, it } from 'vitest';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createDefaultRoomState,
  decodeRoomState,
  ProjectDocumentContractError,
} from '@run-planner/engine/authored-project';

import { createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';
import { catalog } from '@run-planner/hades2-catalog';

import {
  createFReplacementProject,
  fReplacementOccurrenceIds,
} from './fixtures/fReplacementProject';

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

  it('retains admitted offers across real F Combat and Miniboss replacements', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const combatId = fReplacementOccurrenceIds.combat;
    const minibossId = fReplacementOccurrenceIds.miniboss;
    let project = createFReplacementProject();

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, combatId),
      gameName: 'F_Combat06',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, minibossId),
      gameName: 'F_MiniBoss03',
    });
    const topology = project.routes[0]?.biomes[0];
    if (topology?.kind !== 'LinearBiome') {
      throw new Error('minimal F replacement fixture is missing its Linear topology');
    }

    expect(topology.topology?.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrenceId: combatId,
          gameName: 'F_Combat06',
          state: { kind: 'counted', offer: { rewardType: 'GiftDrop' } },
        }),
        expect.objectContaining({
          occurrenceId: minibossId,
          gameName: 'F_MiniBoss03',
          state: {
            kind: 'counted',
            offer: {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
            },
          },
        }),
      ]),
    );
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

  it('allows a shop-only preboss to serve ordinary or direct-terminal roles', () => {
    const directCatalog = createCatalog({
      ...declarations,
      rooms: declarations.rooms.map((candidate) =>
        candidate.gameName === 'F_PreBoss01'
          ? {
              ...candidate,
              mode: { kind: 'authored', templateKey: 'ShopPreboss' },
              entryOfferPolicy: undefined,
            }
          : candidate,
      ),
      biomeLayouts: declarations.biomeLayouts.map((layout) =>
        layout.biomeKey === 'F'
          ? {
              ...layout,
              terminal: { kind: 'directTransition', roomGameName: 'F_PreBoss01' },
            }
          : layout,
      ),
    } as RawCatalogInput);
    const preboss = directCatalog.rooms.byKey.F_PreBoss01;
    if (preboss === undefined) {
      throw new Error('direct preboss fixture is missing');
    }

    expect(
      createDefaultRoomState(directCatalog, preboss, {
        role: 'terminalShop',
        entryActive: false,
      }),
    ).toEqual({ kind: 'shop' });
    expect(
      decodeRoomState(
        { kind: 'shop' },
        directCatalog,
        preboss,
        { role: 'terminalShop', entryActive: false },
        '$.state',
      ),
    ).toEqual({ kind: 'shop' });
    expect(() =>
      createDefaultRoomState(directCatalog, preboss, {
        role: 'terminalFreeReward',
        resolvedStoreKey: 'RunProgress',
        entryActive: false,
      }),
    ).toThrowError(
      new ProjectDocumentContractError(
        'rooms.F_PreBoss01.state',
        'ShopPreboss cannot use terminal free-reward role',
      ),
    );
  });
});
