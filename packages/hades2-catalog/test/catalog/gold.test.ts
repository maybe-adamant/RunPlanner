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
    // The Nemesis event's data-set store, beside the generated ones.
    expect(store('NemesisRandomEvent')).toEqual({
      capMin: 25,
      capMax: 25,
      runDepthRamp: 0,
      undrawn: true,
    });
    expect(
      catalog.encounterDefinitions.values.filter((definition) => definition.moneyStore).length,
    ).toBe(125);
  });

  it('drains a Fields room’s Passive store from its cages', () => {
    expect(
      catalog.encounterEnvelopes.byKey.FieldsEncounter!.slots.map((slot) => [
        slot.key,
        slot.moneyStoreSlotKey,
      ]),
    ).toEqual([
      ['Passive', undefined],
      ['Cage01', 'Passive'],
      ['Cage02', 'Passive'],
      ['Cage03', 'Passive'],
    ]);
    const withSlot = (moneyStoreSlotKey: string) => () =>
      createCatalog({
        ...declarations,
        encounterEnvelopes: declarations.encounterEnvelopes.map((envelope) =>
          envelope.key === 'FieldsEncounter'
            ? {
                ...envelope,
                slots: envelope.slots.map((slot) =>
                  slot.key === 'Cage01' ? { ...slot, moneyStoreSlotKey } : slot,
                ),
              }
            : envelope,
        ),
      });
    // A cage cannot drain itself, another cage or a missing slot.
    for (const key of ['Cage01', 'Cage02', 'Missing'])
      expect(withSlot(key)).toThrow(CatalogContractError);
  });

  it('counts each room map’s swappable breakables', () => {
    const breakables = (gameName: string) => catalog.rooms.byKey[gameName]?.swappableBreakables;
    expect(
      ['F_Combat01', 'F_Shop01', 'I_Combat08', 'I_MiniBoss02', 'N_Sub05', 'Q_Combat04'].map(
        breakables,
      ),
    ).toEqual([15, 24, 1, 111, 4, 4]);
    // Fields maps and these rooms place none.
    expect(
      ['H_Combat01', 'I_Combat14', 'I_PreBoss01', 'G_Shop01', 'Q_Boss01'].map(breakables),
    ).toEqual(Array(5).fill(undefined));
    expect(() =>
      createCatalog({ ...declarations, swappableBreakables: { NoSuchRoom: 3 } }),
    ).toThrow(CatalogContractError);
  });

  it('declares each fixed miniboss roster and its wipe', () => {
    expect(catalog.encounterDefinitions.byKey.MiniBossSatyrCrossbow?.bossRoster).toEqual({
      waves: [[{ enemyKey: 'SatyrCrossbow', count: 1 }], [{ enemyKey: 'Carrion', count: 5 }]],
      wipedByEnemyKey: 'SatyrCrossbow',
    });
    const minibosses = catalog.encounterDefinitions.values.filter(
      (definition) => definition.kind === 'miniboss',
    );
    // Only the shadow Fog emitter's endless Screamers leave its roster open.
    expect(
      minibosses
        .filter((definition) => definition.bossRoster === undefined)
        .map((definition) => definition.key),
    ).toEqual(['MiniBossFogEmitter_Shrine']);
    const withRoster =
      (bossRoster: {
        readonly waves: readonly (readonly { enemyKey: string; count: number; hatched?: true }[])[];
        readonly wipedByEnemyKey?: string;
      }) =>
      () =>
        createCatalog({
          ...declarations,
          encounterDefinitions: declarations.encounterDefinitions.map((definition) =>
            definition.key === 'MiniBossBoar' ? { ...definition, bossRoster } : definition,
          ) as Parameters<typeof createCatalog>[0]['encounterDefinitions'],
        });
    expect(
      withRoster({ waves: [[{ enemyKey: 'Boar', count: 1 }]], wipedByEnemyKey: 'Zombie' }),
    ).toThrow(CatalogContractError);
    expect(withRoster({ waves: [] })).toThrow(CatalogContractError);
    // A store-capped encounter cannot leave its roster to random picks or hatching.
    expect(withRoster({ waves: [[{ enemyKey: 'Boar', count: 1, hatched: true }]] })).toThrow(
      CatalogContractError,
    );
    // Every boss declares its roster; Cerberus draws one spawn encounter by weight.
    expect(
      catalog.encounterDefinitions.values
        .filter((definition) => definition.kind === 'boss' && definition.bossRoster === undefined)
        .map((definition) => definition.key),
    ).toEqual(['BossZagreus01']);
    expect(
      catalog.encounterDefinitions.byKey.BossInfestedCerberus02?.bossRoster?.choices?.[0]?.map(
        (option) => option.weight,
      ),
    ).toEqual([1, 1, 1, 2]);
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

describe('enemy gold drops', () => {
  const drop = (key: string) => catalog.enemyGoldDrops.byKey[key];

  it('resolves each enemy’s inherited kill drop into a chance and a truncated parcel range', () => {
    // BaseVulnerableEnemy 0.33 × 18 = 5.94 up to × 1.3 = 7.722.
    expect(drop('Brawler')).toEqual({
      key: 'Brawler',
      kind: 'parcel',
      chance: 0.7,
      value: { min: 5, max: 7 },
    });
    // Guard2 inherits Guard's 25% chance; Lycaon's elite its own 0.225.
    expect(drop('Guard2')).toMatchObject({ chance: 0.25, value: { min: 3, max: 5 } });
    expect(drop('Lycanthrope_Elite')).toMatchObject({ chance: 0.7, value: { min: 69, max: 90 } });
    // Biome bases: Thessaly 0.125, Olympus 0.035, the Summit 0.16.
    expect(drop('Swab')).toMatchObject({ value: { min: 8, max: 10 } });
    expect(drop('SentryBot')).toMatchObject({ value: { min: 1, max: 2 } });
    expect(drop('Brute_Elite')).toMatchObject({ value: { min: 64, max: 83 } });
    // A truncated lower bound can be zero (0.075 × 13 = 0.975).
    expect(drop('WaterElemental')).toMatchObject({ chance: 0.2, value: { min: 0, max: 1 } });
    expect(drop('Treant2')).toEqual({ key: 'Treant2', kind: 'none' });
    expect(drop('FishSwarmerSquad')).toEqual({
      key: 'FishSwarmerSquad',
      kind: 'unitGroup',
      unitKey: 'FishSwarmer',
      size: 5,
    });
    expect(drop('SimpleSquad_Elite')).toMatchObject({ unitKey: 'Simple_Elite', size: 2 });
    expect(drop('Simple_Elite')).toMatchObject({ value: { min: 8, max: 10 } });
    // Miniboss units: their own ratings, a static parcel and the chance-0 ones.
    expect(drop('SatyrRatCatcher_Miniboss')).toMatchObject({ value: { min: 132, max: 171 } });
    expect(drop('Talos')).toMatchObject({ chance: 0.7, value: { min: 17, max: 22 } });
    expect(drop('Captain')).toMatchObject({ chance: 0.25, value: { min: 40, max: 52 } });
    expect(drop('FogEmitter_Elite')).toMatchObject({ chance: 1, value: { min: 50, max: 70 } });
    expect(drop('Brute_Miniboss')).toEqual({ key: 'Brute_Miniboss', kind: 'none' });
  });

  it('rates every generated enemy as its generator facts do', () => {
    const rated = new Map(
      declarations.enemyGoldDrops.flatMap((entry) =>
        entry.kind === 'parcel' && entry.value.kind === 'perDifficulty'
          ? [[entry.key, entry.value.difficultyRating] as const]
          : [],
      ),
    );
    const mismatches: string[] = [];
    let checked = 0;
    for (const definition of catalog.encounterDefinitions.values)
      for (const decision of definition.customization ?? []) {
        if (decision.selection.kind !== 'generated') continue;
        const { choices, fixedEnemies, generatedSeeds, fixedWaves } = decision.selection;
        for (const choice of [
          ...choices,
          ...fixedEnemies,
          ...(generatedSeeds ?? []),
          ...(fixedWaves ?? []).flat(),
        ]) {
          const rating = rated.get(choice.nativeId);
          if (rating === undefined) continue;
          checked += 1;
          if (rating !== choice.difficultyRating)
            mismatches.push(
              `${definition.key}:${choice.nativeId} ${rating}≠${choice.difficultyRating}`,
            );
        }
      }
    expect(mismatches).toEqual([]);
    expect(checked).toBeGreaterThan(500);
  });

  it('refuses a missing, unreachable, multi-parcel or mis-sized drop', () => {
    const withDrops = (enemyGoldDrops: typeof declarations.enemyGoldDrops) => () =>
      createCatalog({ ...declarations, enemyGoldDrops });
    expect(
      withDrops(declarations.enemyGoldDrops.filter((entry) => entry.key !== 'Mati_Elite')),
    ).toThrow(CatalogContractError);
    expect(
      withDrops([...declarations.enemyGoldDrops, { key: 'FogEmitter', kind: 'none' }]),
    ).toThrow(CatalogContractError);
    expect(
      withDrops(
        declarations.enemyGoldDrops.map((entry) =>
          entry.key === 'Mati' && entry.kind === 'parcel' ? { ...entry, maxParcels: 2 } : entry,
        ),
      ),
    ).toThrow(CatalogContractError);
    expect(
      withDrops(
        declarations.enemyGoldDrops.map((entry) =>
          entry.key === 'SimpleSquad' && entry.kind === 'unitGroup' ? { ...entry, size: 3 } : entry,
        ),
      ),
    ).toThrow(CatalogContractError);
  });
});
