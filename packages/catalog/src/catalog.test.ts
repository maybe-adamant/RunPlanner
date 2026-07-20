import { describe, expect, it } from 'vitest';
import type {
  CountedRewardBinding,
  RequirementExpression,
  RewardProducerBinding,
} from '@run-planner/core';

import { CatalogContractError, createCatalog } from './catalog';
import { declarations } from './declarations';
import { catalog } from './index';

function requireCounted(binding: RewardProducerBinding | undefined): CountedRewardBinding {
  if (binding?.kind !== 'countedChoice') {
    throw new Error('expected counted reward binding');
  }
  return binding;
}

function storeRewardTypes(store: { readonly entries: readonly { readonly rewardType: string }[] }) {
  return [...new Set(store.entries.map((entry) => entry.rewardType))];
}

describe('F catalog migration slice', () => {
  it('keeps biome identity global while routes own reusable ordered references', () => {
    const withAlternateRoute = createCatalog({
      ...declarations,
      routes: [
        ...declarations.routes,
        { key: 'Alternate', label: 'Alternate', biomeKeys: ['F', 'P'] },
      ],
    });

    expect(withAlternateRoute.biomes.values).toHaveLength(8);
    expect(withAlternateRoute.biomes.byKey.F).toEqual({ key: 'F', label: 'Erebus' });
    expect(withAlternateRoute.routes.byKey.Underworld?.biomeKeys).toEqual(['F', 'G', 'H', 'I']);
    expect(withAlternateRoute.routes.byKey.Alternate?.biomeKeys).toEqual(['F', 'P']);
  });

  it('rejects unknown and repeated biome references within a route', () => {
    expect(() =>
      createCatalog({
        ...declarations,
        routes: [{ key: 'Broken', label: 'Broken', biomeKeys: ['Missing'] }],
      }),
    ).toThrowError(new CatalogContractError('routes[0].biomeKeys[0]', 'unknown biome Missing'));

    expect(() =>
      createCatalog({
        ...declarations,
        routes: [{ key: 'Broken', label: 'Broken', biomeKeys: ['F', 'F'] }],
      }),
    ).toThrowError(
      new CatalogContractError('routes[0].biomeKeys[1]', 'duplicates biome F within route Broken'),
    );
  });

  it('normalizes verified reward, encounter, and room declarations', () => {
    expect(catalog.version).toBe('0.10.0-n-dormant');
    expect(catalog.routes.byKey.Underworld?.biomeKeys).toEqual(['F', 'G', 'H', 'I']);

    const runProgress = catalog.rewards.stores.byKey.RunProgress;
    expect(runProgress?.entries.map((entry) => entry.rewardType)).toEqual([
      'MaxHealthDrop',
      'MaxHealthDrop',
      'MaxManaDrop',
      'MaxManaDrop',
      'RoomMoneyDrop',
      'RoomMoneyDrop',
      'StackUpgrade',
      'StackUpgrade',
      'WeaponUpgrade',
      'WeaponUpgrade',
      'HermesUpgrade',
      'Devotion',
      'SpellDrop',
      'TalentDrop',
      'Boon',
      'Boon',
      'Boon',
      'Boon',
    ]);
    expect(storeRewardTypes(runProgress!)).toEqual([
      'MaxHealthDrop',
      'MaxManaDrop',
      'RoomMoneyDrop',
      'StackUpgrade',
      'WeaponUpgrade',
      'HermesUpgrade',
      'Devotion',
      'SpellDrop',
      'TalentDrop',
      'Boon',
    ]);

    const metaProgress = catalog.rewards.stores.byKey.MetaProgress;
    expect(metaProgress?.entries.map((entry) => entry.rewardType)).toEqual([
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCurrencyBigDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
    ]);
    expect(storeRewardTypes(metaProgress!)).toEqual([
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCardPointsCommonDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonBigDrop',
    ]);
    expect(metaProgress?.entries[0]?.requirement).toBeUndefined();
    expect(metaProgress?.entries[1]?.requirement).toEqual({
      kind: 'counterRange',
      axis: 'enteredBiomes',
      range: { max: 1 },
    });
    expect(metaProgress?.entries[7]?.requirement).toEqual({
      kind: 'counterRange',
      axis: 'enteredBiomes',
      range: { min: 2 },
    });

    const opening = catalog.rooms.byKey.F_Opening01;
    const openingReward = requireCounted(opening?.incomingReward);
    expect(openingReward.allowedRewardTypes).toEqual([
      'StackUpgrade',
      'WeaponUpgrade',
      'HermesUpgrade',
      'SpellDrop',
      'TalentDrop',
      'Boon',
    ]);
    expect(openingReward.defaultOffersByStore.RunProgress).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    });

    const combat = catalog.rooms.byKey.F_Combat01;
    const combatReward = requireCounted(combat?.incomingReward);
    expect(combat?.encounterProfileKey).toBe('StandardCombat');
    expect(combat?.eligibility).toEqual({
      kind: 'counterRange',
      axis: 'biomeEncounterDepth',
      range: { max: 5 },
    });
    expect(combatReward.allowedRewardTypes).not.toContain('Devotion');

    const multiStoreCombat = catalog.rooms.byKey.F_Combat02;
    const multiStoreReward = requireCounted(multiStoreCombat?.incomingReward);
    expect(multiStoreCombat?.exits).toHaveLength(2);
    expect(multiStoreReward.storeKeys).toEqual(['RunProgress', 'MetaProgress']);
    expect(multiStoreReward.storeKeys[0]).toBe('RunProgress');
    expect(multiStoreReward.defaultOffersByStore.RunProgress).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    });
    expect(multiStoreReward.allowedRewardTypes).toEqual([
      ...storeRewardTypes(runProgress!),
      ...storeRewardTypes(metaProgress!),
    ]);

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.rooms.values)).toBe(true);
    expect(Object.isFrozen(runProgress?.entries)).toBe(true);
  });

  it('matches every F combat room exit and depth declaration', () => {
    const expectedRooms = [
      ['F_Combat01', 1, { max: 5 }],
      ['F_Combat02', 2, { max: 5 }],
      ['F_Combat03', 2, { max: 5 }],
      ['F_Combat04', 2, { max: 5 }],
      ['F_Combat05', 2, { min: 5 }],
      ['F_Combat06', 2, undefined],
      ['F_Combat07', 2, undefined],
      ['F_Combat08', 2, { max: 5 }],
      ['F_Combat09', 1, { max: 4 }],
      ['F_Combat10', 1, { max: 5 }],
      ['F_Combat11', 2, { min: 5 }],
      ['F_Combat12', 2, { min: 5 }],
      ['F_Combat13', 2, undefined],
      ['F_Combat14', 2, { min: 5 }],
      ['F_Combat15', 2, { min: 5 }],
      ['F_Combat16', 2, { min: 5 }],
      ['F_Combat17', 2, { min: 5 }],
      ['F_Combat18', 2, { min: 5 }],
      ['F_Combat19', 2, { max: 5 }],
      ['F_Combat20', 2, { min: 5 }],
      ['F_Combat21', 2, { max: 5 }],
      ['F_Combat22', 2, { max: 5 }],
    ] as const;

    for (const [gameName, exitCount, depthRange] of expectedRooms) {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing normalized room ${gameName}`);
      }

      expect(room.label).toBe(gameName.replace('F_', '').replace('Combat', 'Combat '));
      expect(room.kind).toBe('Combat');
      expect(room.mode).toEqual({ kind: 'authored', templateKey: 'StandardCombat' });
      expect(room.exits).toHaveLength(exitCount);
      expect(room.exits.map((exit) => exit.index)).toEqual(
        Array.from({ length: exitCount }, (_, index) => index + 1),
      );
      expect(room.encounterProfileKey).toBe('StandardCombat');
      expect(room.counters).toEqual({ biomeDepthCache: 1, roomHistoryOrdinal: 1 });
      expect(room.caps).toEqual({ maxAppearancesThisBiome: 1 });
      expect(room.eligibility).toEqual(
        depthRange === undefined
          ? undefined
          : {
              kind: 'counterRange',
              axis: 'biomeEncounterDepth',
              range: depthRange,
            },
      );

      if (gameName === 'F_Combat01') {
        const reward = requireCounted(room.incomingReward);
        expect(reward.storeKeys).toEqual(['RunProgress']);
        expect(reward.ineligibleRewardTypes).toEqual(['Devotion']);
      } else {
        const reward = requireCounted(room.incomingReward);
        expect(reward.storeKeys).toEqual(['RunProgress', 'MetaProgress']);
        expect(reward.storeKeys[0]).toBe('RunProgress');
        expect(reward.ineligibleRewardTypes).toEqual([]);
      }
    }
  });

  it('binds every F/G producer to lifecycle, override, and store-history authority', () => {
    const fgRooms = catalog.rooms.values.filter(
      (room) => room.biomeKey === 'F' || room.biomeKey === 'G',
    );
    const noStoreHistory = new Set(['G_Intro', 'F_Boss01', 'F_PostBoss01', 'G_PostBoss01']);
    for (const room of fgRooms) {
      expect(room.enteredRewardStoreHistory).toEqual(
        noStoreHistory.has(room.gameName) ? { kind: 'none' } : { kind: 'resolvedOffer' },
      );
      if (room.incomingReward.kind !== 'none') {
        expect(room.incomingReward.producerLifecycleKey).toBe('RoomReward');
      }
    }

    const forcedRooms = fgRooms
      .filter((room) => room.forcedRewardStoreKey === 'RunProgress')
      .map((room) => room.gameName);
    expect(forcedRooms).toEqual([
      'F_Opening01',
      'F_Opening02',
      'F_Opening03',
      'F_Combat01',
      'F_MiniBoss01',
      'F_MiniBoss02',
      'F_MiniBoss03',
      'F_PreBoss01',
      'G_MiniBoss01',
      'G_MiniBoss02',
      'G_MiniBoss03',
      'G_PreBoss01',
    ]);
  });

  it('rejects duplicate room game names with a declaration path', () => {
    const opening = declarations.rooms[0];
    if (opening === undefined) {
      throw new Error('F opening fixture is missing');
    }
    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [...declarations.rooms, opening],
      }),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${declarations.rooms.length}].gameName`,
        'duplicates F_Opening01',
      ),
    );
  });

  it('rejects unknown room templates at the declaration boundary', () => {
    const opening = declarations.rooms[0];
    expect(opening).toBeDefined();
    if (opening === undefined || opening.mode.kind !== 'authored') {
      throw new Error('F authored opening fixture is missing');
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [
          {
            ...opening,
            mode: {
              kind: 'authored',
              templateKey: 'MissingTemplate' as typeof opening.mode.templateKey,
            },
          },
        ],
      }),
    ).toThrowError(
      new CatalogContractError(
        'rooms[0].mode.templateKey',
        'unknown room template MissingTemplate',
      ),
    );
  });

  it('requires the batch default to belong to its authored store domain', () => {
    const layout = declarations.biomeLayouts[0];
    expect(() =>
      createCatalog({
        ...declarations,
        biomeLayouts: [
          {
            ...layout,
            continuation: {
              ...layout.continuation,
              rewardStorePolicy: {
                ...layout.continuation.rewardStorePolicy,
                defaultStoreKey: 'MissingStore',
              },
            },
          },
        ],
      }),
    ).toThrowError(
      new CatalogContractError(
        'biomeLayouts[0].continuation.rewardStorePolicy.defaultStoreKey',
        'must belong to the authored base store domain',
      ),
    );
  });

  it('rejects unresolved reward stores at the room contact', () => {
    const opening = declarations.rooms[0];
    expect(opening).toBeDefined();
    if (opening === undefined || opening.incomingReward.kind !== 'countedChoice') {
      throw new Error('F counted opening fixture is missing');
    }
    const incomingReward = opening.incomingReward;

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [
          {
            ...opening,
            incomingReward: {
              ...incomingReward,
              storeKeys: ['MissingStore'],
            },
          },
        ],
      }),
    ).toThrowError(
      new CatalogContractError(
        'rooms[0].incomingReward.storeKeys[0]',
        'unknown reward store MissingStore',
      ),
    );
  });

  it('requires shop producers to use the Shop reward type', () => {
    const shopIndex = declarations.rooms.findIndex((room) => room.gameName === 'F_Shop01');
    const shop = declarations.rooms[shopIndex];
    if (shop?.incomingReward.kind !== 'shop') {
      throw new Error('missing F shop declaration');
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: declarations.rooms.map((room, index) =>
          index === shopIndex
            ? {
                ...shop,
                incomingReward: {
                  ...shop.incomingReward,
                  rewardType: 'Boon' as 'Shop',
                },
              }
            : room,
        ),
      }),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${shopIndex}].incomingReward.rewardType`,
        'shop producer requires Shop, received Boon',
      ),
    );
  });

  it('rejects a current-run requirement kind without an evaluator', () => {
    const store = declarations.rewardKernel.stores[0];
    if (store === undefined) {
      throw new Error('missing RunProgress store declaration');
    }
    const entry = store.entries[0];
    if (entry === undefined) {
      throw new Error('missing RunProgress store entry');
    }
    const requirement = {
      kind: 'externalSavePredicate',
    } as unknown as RequirementExpression;

    expect(() =>
      createCatalog({
        ...declarations,
        rewardKernel: {
          ...declarations.rewardKernel,
          stores: [{ ...store, entries: [{ ...entry, requirement }] }],
        },
      }),
    ).toThrowError(
      new CatalogContractError(
        'stores[0].entries[0].requirement.kind',
        'has no current-run evaluator: externalSavePredicate',
      ),
    );
  });

  it('rejects a reward type whose payload default violates its domain', () => {
    const boon = declarations.rewardKernel.rewardTypes.find(
      (rewardType) => rewardType.gameName === 'Boon',
    );
    expect(boon).toBeDefined();
    if (boon === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rewardKernel: {
          ...declarations.rewardKernel,
          rewardTypes: declarations.rewardKernel.rewardTypes.map((rewardType) =>
            rewardType.gameName === 'Boon'
              ? {
                  ...boon,
                  defaultPayload: { kind: 'BoonSource', source: 'MissingUpgrade' },
                }
              : rewardType,
          ),
        },
      }),
    ).toThrowError(
      new CatalogContractError(
        'rewardTypes.Boon.defaultPayload',
        'does not match payload domain BoonSource',
      ),
    );
  });
});
