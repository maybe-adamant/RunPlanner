import { describe, expect, it } from 'vitest';

import { catalog, CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';

const acquisition = (gameName: string) =>
  catalog.rewards.acquisitions.values.find((candidate) => candidate.gameName === gameName);

describe('gold catalog facts', () => {
  it('pays money pickups their DropMoney and convertible rewards their GoldifyValue', () => {
    expect(
      ['RoomMoneyTinyDrop', 'RoomMoneySmallDrop', 'RoomMoneyDrop', 'RoomMoneyTripleDrop'].map(
        (gameName) => acquisition(gameName)?.goldGrant,
      ),
    ).toEqual([20, 50, 100, 300]);
    const convertible = catalog.rewards.acquisitions.values.filter(
      (candidate) => candidate.goldConversionEligible,
    );
    expect(convertible.every((candidate) => candidate.goldifyValue !== undefined)).toBe(true);
    expect(
      catalog.rewards.acquisitions.values.some(
        (candidate) => !candidate.goldConversionEligible && candidate.goldifyValue !== undefined,
      ),
    ).toBe(false);
    expect(
      Object.fromEntries(
        [
          'ZeusUpgrade',
          'StackUpgrade',
          'StackUpgradeTriple',
          'WeaponUpgrade',
          'SpellDrop',
          'MaxHealthDropBig',
          'EmptyMaxHealthSmallDrop',
          'RoomRewardConsolationPrize',
          'ArmorBoostStore',
          'MetaCurrencyBigDrop',
        ].map((gameName) => [gameName, acquisition(gameName)?.goldifyValue]),
      ),
    ).toEqual({
      ZeusUpgrade: 400,
      StackUpgrade: 300,
      StackUpgradeTriple: 500,
      WeaponUpgrade: 500,
      SpellDrop: 500,
      MaxHealthDropBig: 400,
      EmptyMaxHealthSmallDrop: 150,
      RoomRewardConsolationPrize: 150,
      ArmorBoostStore: 200,
      MetaCurrencyBigDrop: 200,
    });
  });

  it('declares the gold multipliers, the loan and the trait-produced gold', () => {
    expect(catalog.traits.byKey.MoneyMultiplierBoon?.gold).toEqual({
      kind: 'moneyMultiplier',
      byRarity: { Common: 1.2, Rare: 1.3, Epic: 1.4, Heroic: 1.5 },
    });
    expect(catalog.traits.byKey.RoomRewardBonusBoon?.gold).toEqual({
      kind: 'moneyRewardBonus',
      byRarity: { Common: 1.5, Rare: 1.75, Epic: 2, Heroic: 2.25 },
    });
    expect(catalog.traits.byKey.BankBoon?.gold).toEqual({
      kind: 'loan',
      returnByRarity: { Common: 300, Rare: 400, Epic: 500, Heroic: 600 },
    });
    const narcissus = catalog.traits.byKey.NarcissusC?.selectedDisposition;
    expect(narcissus?.kind === 'producePickups' ? narcissus.pickups : undefined).toEqual([
      { key: 'currency', rewardType: 'Currency', goldByAcquisitionOrdinal: [100, 100, 150, 250] },
    ]);
    expect(catalog.chaos.blessings.byKey.ChaosMoneyBlessing?.moneyMultiplierOperandKey).toBe(
      'moneyBonus',
    );
    expect(catalog.chaos.curses.byKey.ChaosNoMoneyCurse?.blocksGold).toBe(true);
    expect(
      catalog.chaos.curses.values.filter((curse) => curse.blocksGold).map((curse) => curse.key),
    ).toEqual(['ChaosNoMoneyCurse']);
  });

  it('declares starting gold, the Gold Purse, sales and Nemesis gold', () => {
    expect(catalog.arcanaCards.byKey.StartingGold?.startingGoldByRarity).toEqual({
      Common: 200,
      Rare: 250,
      Epic: 300,
      Heroic: 350,
    });
    expect(catalog.keepsakes.byKey.BonusMoneyKeepsake?.goldByRank).toEqual({
      Common: 100,
      Rare: 125,
      Epic: 150,
      Heroic: 200,
    });
    expect(catalog.keepsakes.byKey.GoldifyKeepsake?.effect).toMatchObject({
      kind: 'timePiece',
      boostedConversionBonus: 150,
    });
    expect(catalog.gold.fallbackGold).toBe(90);
    expect(catalog.gold.purgingPoolSale).toMatchObject({
      byRarity: { Common: { min: 30, max: 50 }, Legendary: { min: 400, max: 450 } },
      infusion: { min: 100, max: 130 },
      unranked: 20,
      perLevel: 20,
      roundDownTo: 5,
    });
    const midas = catalog.rewards.shops.byKey.RoomShop?.groups.values
      .flatMap((group) => group.options.values)
      .find((option) => option.key === 'DamageSelfDrop');
    expect(midas?.goldPayout).toEqual({
      healthCost: { min: 10, max: 30 },
      goldPerHealthHundredths: { min: 110, max: 180 },
    });
    expect(
      catalog.encounterDefinitions.values
        .filter((definition) => definition.goldBet !== undefined)
        .map((definition) => [definition.key, definition.goldBet?.maxBet]),
    ).toEqual([
      ['NemesisCombatF', 100],
      ['NemesisCombatG', 100],
      ['NemesisCombatH', 100],
      ['NemesisCombatI', 100],
    ]);
    expect(
      catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent?.goldTrade.variants.map(
        (variant) => [variant.rewardType, variant.goldCost.min, variant.goldCost.max],
      ),
    ).toEqual([
      ['MaxHealthDrop', 105, 130],
      ['MaxHealthDropBig', 230, 255],
      ['MaxManaDrop', 80, 105],
      ['MaxManaDropBig', 180, 205],
      ['StackUpgrade', 80, 105],
      ['StackUpgradeBig', 280, 305],
      ['WeaponUpgrade', 180, 205],
    ]);
  });

  it('declares the money store of every generated encounter and none of the rest', () => {
    const store = (key: string) => catalog.encounterDefinitions.byKey[key]?.moneyStore;
    expect(
      Object.fromEntries(
        [
          'GeneratedF',
          'GeneratedAnomalyB',
          'GeneratedG',
          'GeneratedH_Passive',
          'GeneratedH',
          'MournerIntro',
          'GeneratedI_GoalReward',
          'GeneratedNSubRoom_Bigger',
          'GeneratedO',
          'P_Combat07_PreCombat02',
          'GeneratedQ_Islands',
          'DevotionTestO',
          'ArtemisCombatN',
          'NemesisCombatI',
          'HeraclesCombatP',
          'MiniBossTreant',
          'MiniBossJellyfish',
          'MiniBossDragon',
          'MiniBossBrute',
        ].map((key) => [key, store(key)]),
      ),
    ).toEqual({
      GeneratedF: { capMin: 10, capMax: 15, runDepthRamp: 0.5 },
      GeneratedAnomalyB: { capMin: 10, capMax: 15, runDepthRamp: 0.5 },
      GeneratedG: { capMin: 15, capMax: 25, runDepthRamp: 0 },
      GeneratedH_Passive: { capMin: 10, capMax: 30, runDepthRamp: 0 },
      GeneratedH: { capMin: 30, capMax: 45, runDepthRamp: 0 },
      MournerIntro: { capMin: 30, capMax: 45, runDepthRamp: 0 },
      GeneratedI_GoalReward: { capMin: 35, capMax: 45, runDepthRamp: 0 },
      GeneratedNSubRoom_Bigger: { capMin: 15, capMax: 25, runDepthRamp: 0 },
      GeneratedO: { capMin: 20, capMax: 30, runDepthRamp: 0 },
      P_Combat07_PreCombat02: { capMin: 25, capMax: 35, runDepthRamp: 0 },
      GeneratedQ_Islands: { capMin: 60, capMax: 85, runDepthRamp: 0 },
      DevotionTestO: { capMin: 20, capMax: 30, runDepthRamp: 0 },
      ArtemisCombatN: { capMin: 30, capMax: 30, runDepthRamp: 0 },
      NemesisCombatI: { capMin: 30, capMax: 30, runDepthRamp: 0 },
      HeraclesCombatP: { capMin: 100, capMax: 145, runDepthRamp: 0 },
      MiniBossTreant: { capMin: 15, capMax: 15, runDepthRamp: 0 },
      MiniBossJellyfish: { capMin: 25, capMax: 25, runDepthRamp: 0 },
      MiniBossDragon: { capMin: 15, capMax: 25, runDepthRamp: 0 },
      MiniBossBrute: { capMin: 60, capMax: 85, runDepthRamp: 0 },
    });
    // Native generates only these combats; the others pay their kill drops uncapped.
    expect(
      [
        'FIntroFight',
        'FishmanIntro',
        'ClockworkIntro',
        'PIntroCombat01',
        'ArachneCombatF',
        'MiniBossCaptain',
        'MiniBossStalker',
        'MiniBossCrawler',
        'BossHecate01',
        'Empty_Chaos',
      ].map(store),
    ).toEqual(Array(10).fill(undefined));
    expect(
      catalog.encounterDefinitions.values.filter((definition) => definition.moneyStore).length,
    ).toBe(124);
  });

  it('declares the Heracles bounty, Wealth from the Dead and Success Rate luck', () => {
    expect(
      catalog.encounterDefinitions.values
        .filter((definition) => definition.killBounty !== undefined)
        .map((definition) => [definition.key, definition.killBounty]),
    ).toEqual(
      ['HeraclesCombatN', 'HeraclesCombatO', 'HeraclesCombatP'].map((key) => [
        key,
        { goldPerMark: 20, marksPerWave: { min: 2, max: 3 }, waves: 3 },
      ]),
    );
    expect(catalog.traits.byKey.MoneyOnDeathCurse?.gold).toEqual({
      kind: 'goldOnKill',
      chance: 0.1,
      dropCap: 2,
      goldByAcquisitionOrdinal: [20, 30, 40, 60],
    });
    expect(catalog.traits.byKey.LuckyBoon?.luckMultiplierByRarity).toEqual({
      Common: 1.3,
      Rare: 1.4,
      Epic: 1.5,
      Heroic: 1.6,
    });
  });

  it('rejects a convertible reward without a GoldifyValue and a malformed loan', () => {
    expect(() =>
      createCatalog({
        ...declarations,
        rewardKernel: {
          ...declarations.rewardKernel,
          acquisitions: declarations.rewardKernel.acquisitions.map((candidate) =>
            candidate.gameName === 'TalentDrop'
              ? Object.fromEntries(
                  Object.entries(candidate).filter(([key]) => key !== 'goldifyValue'),
                )
              : candidate,
          ) as typeof declarations.rewardKernel.acquisitions,
        },
      }),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'BankBoon'
              ? { ...trait, gold: { kind: 'loan', returnByRarity: { Common: 300 } } }
              : trait,
          ) as typeof declarations.traitCatalog.traits,
        },
      }),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog({
        ...declarations,
        encounterDefinitions: declarations.encounterDefinitions.map((definition) =>
          definition.key === 'GeneratedG'
            ? { ...definition, moneyStore: { capMin: 25, capMax: 15, runDepthRamp: 0 } }
            : definition,
        ) as unknown as typeof declarations.encounterDefinitions,
      }),
    ).toThrow(CatalogContractError);
  });
});
