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

describe('F catalog migration slice', () => {
  it('normalizes verified reward, encounter, and room declarations', () => {
    expect(catalog.version).toBe('0.1.0-fg-slice-5');
    expect(catalog.routes.byKey.Underworld?.biomeSteps.map((step) => step.key)).toEqual([
      'Underworld_F',
      'Underworld_G',
      'Underworld_H',
      'Underworld_I',
    ]);

    const runProgress = catalog.rewardStores.byKey.RunProgress;
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
    expect(runProgress?.rewardTypes).toEqual([
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

    const metaProgress = catalog.rewardStores.byKey.MetaProgress;
    expect(metaProgress?.entries.map((entry) => entry.rewardType)).toEqual([
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyBigDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
      'MetaCardPointsCommonBigDrop',
    ]);
    expect(metaProgress?.rewardTypes).toEqual([
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonBigDrop',
    ]);
    expect(metaProgress?.entries[0]?.requirement).toBeUndefined();
    expect(metaProgress?.entries[1]?.requirement).toEqual({
      kind: 'counterRange',
      axis: 'enteredBiomes',
      range: { max: 1 },
    });
    expect(metaProgress?.entries[3]?.requirement).toEqual({
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
    expect(openingReward.defaultReward).toEqual({
      rewardType: 'Boon',
      payload: { source: 'ApolloUpgrade' },
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
    expect(multiStoreReward.defaultStoreKey).toBe('RunProgress');
    expect(multiStoreReward.defaultReward).toEqual({
      rewardType: 'Boon',
      payload: { source: 'ApolloUpgrade' },
    });
    expect(multiStoreReward.allowedRewardTypes).toEqual([
      ...runProgress!.rewardTypes,
      ...metaProgress!.rewardTypes,
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
      expect(room.templateKey).toBe('StandardCombat');
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
        expect(reward.defaultStoreKey).toBe('RunProgress');
        expect(reward.ineligibleRewardTypes).toEqual([]);
      }
    }
  });

  it('rejects duplicate room game names with a declaration path', () => {
    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [...declarations.rooms, declarations.rooms[0]],
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
    if (opening === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [
          {
            ...opening,
            templateKey: 'MissingTemplate' as typeof opening.templateKey,
          },
        ],
      }),
    ).toThrowError(
      new CatalogContractError('rooms[0].templateKey', 'unknown room template MissingTemplate'),
    );
  });

  it('requires an explicit default for a multi-store reward binding', () => {
    const combat = declarations.rooms.find((room) => room.gameName === 'F_Combat02');
    expect(combat).toBeDefined();
    if (combat === undefined) {
      return;
    }

    const incomingReward = {
      kind: combat.incomingReward.kind,
      storeKeys: combat.incomingReward.storeKeys,
      eligibleRewardTypes: combat.incomingReward.eligibleRewardTypes,
      ineligibleRewardTypes: combat.incomingReward.ineligibleRewardTypes,
    };

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [{ ...combat, incomingReward }],
      }),
    ).toThrowError(
      new CatalogContractError(
        'rooms[0].incomingReward.defaultStoreKey',
        'is required when several stores are referenced',
      ),
    );
  });

  it('rejects unresolved reward stores at the room contact', () => {
    const opening = declarations.rooms[0];
    expect(opening).toBeDefined();
    if (opening === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rooms: [
          {
            ...opening,
            incomingReward: {
              ...opening.incomingReward,
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

  it('rejects a current-run requirement kind without an evaluator', () => {
    const store = declarations.rewardStores[0];
    const entry = store.entries[0];
    const requirement = {
      kind: 'externalSavePredicate',
    } as unknown as RequirementExpression;

    expect(() =>
      createCatalog({
        ...declarations,
        rewardStores: [
          {
            ...store,
            entries: [{ ...entry, requirement }],
          },
        ],
      }),
    ).toThrowError(
      new CatalogContractError(
        'rewardStores[0].entries[0].requirement.kind',
        'has no current-run evaluator: externalSavePredicate',
      ),
    );
  });

  it('rejects a primitive whose payload default violates its domain', () => {
    const boon = declarations.rewardPrimitives.find((primitive) => primitive.gameName === 'Boon');
    expect(boon).toBeDefined();
    if (boon === undefined) {
      return;
    }

    expect(() =>
      createCatalog({
        ...declarations,
        rewardPrimitives: declarations.rewardPrimitives.map((primitive) =>
          primitive.gameName === 'Boon'
            ? { ...boon, defaultPayload: { source: 'MissingUpgrade' } }
            : primitive,
        ),
      }),
    ).toThrowError(
      new CatalogContractError(
        'rewardPrimitives.Boon.defaultPayload.source',
        'MissingUpgrade is not in payload domain BoonSource',
      ),
    );
  });
});
