import { describe, expect, it } from 'vitest';

import {
  buildRunRecord,
  RunRecordBuildError,
} from '@planner/workspace/run-recording/runRecordBuilder';
import type {
  SaveCheckpoint,
  SavedEncounter,
  SavedRoom,
  SavedRunState,
  SavedTrait,
} from '@planner/workspace/run-recording/saveCheckpoint';
import { traitWorldTime } from '@planner/workspace/run-recording/traitWorldTime';

function room(name: string, values: Partial<SavedRoom> = {}): SavedRoom {
  return {
    name,
    exitDoors: [],
    offeredRewards: {},
    predeterminedDoors: [],
    useRecord: {},
    kills: {},
    encounters: [],
    cages: [],
    wellShop: false,
    surfaceShop: false,
    sellShop: false,
    ...values,
  };
}

function encounter(name: string, values: Partial<SavedEncounter> = {}): SavedEncounter {
  return { name, waves: [], blacklist: [], eliteAttributes: {}, rewardsToRestore: [], ...values };
}

const baseRun: SavedRunState = {
  biomeVisitOrder: ['O'],
  dream: false,
  cleared: false,
  heroDead: false,
  metaConversionUses: 0,
  biomeBoonSkipCount: 0,
  surfaceShopPurchases: 0,
  traitsSold: 0,
  wellShopPurchases: {},
  npcInteractions: {},
  rewardStores: {},
  lootChoices: [],
};

const startTraits: readonly SavedTrait[] = [
  { name: 'GoldifyKeepsake', id: '0110.50.5', rarity: 'Epic', boonConversionUses: 3 },
];

interface Step {
  readonly kind?: SaveCheckpoint['kind'];
  readonly history: readonly string[];
  readonly current: SavedRoom;
  readonly departure?: SavedRoom;
  readonly run?: Partial<SavedRunState>;
  readonly traits?: readonly SavedTrait[] | null;
  readonly worldTime?: number;
}

function save(step: Step): SaveCheckpoint {
  const traits = step.traits === undefined ? startTraits : step.traits;
  return {
    kind: step.kind ?? 'entry',
    timestamp: 1_700_000_000,
    runCount: 7,
    mapName: '',
    nextMap: step.kind === 'postReward' ? '' : step.current.name,
    worldTime: step.worldTime ?? step.history.length * 10 + 5,
    history: step.history,
    ...(step.departure === undefined ? {} : { departure: step.departure }),
    currentRoom: step.current,
    run: { ...baseRun, ...step.run },
    ...(traits === null
      ? {}
      : {
          hero: {
            traits,
            slotted: { Keepsake: 'GoldifyKeepsake', Aspect: 'StaffClearCastAspect' },
          },
        }),
    profile: {
      primaryWeapon: 'WeaponStaffSwing',
      equippedFamiliar: 'PolecatFamiliar',
      shrineUpgrades: { ShopPricesShrineUpgrade: 1 },
      arcana: { MetaToRunUpgrade: 3 },
      money: 300,
    },
  };
}

describe('run record builder', () => {
  it('separates ship-wheel offers from the Artificer roll', () => {
    const entered = room('O_Combat05', {
      encounters: [
        encounter('GeneratedO_Intro01'),
        encounter('GeneratedO'),
        encounter('GeneratedO'),
      ],
    });
    const settled = room('O_Combat05', {
      useRecord: { MaxHealthDrop: 1, ShipsSteeringWheelLeft: 2 },
      encounters: [
        encounter('GeneratedO_Intro01', { roomRewardOverride: 'Empty' }),
        encounter('GeneratedO', {
          rewardStoreName: 'MetaProgress',
          roomRewardOverride: 'MetaCardPointsCommonBigDrop',
        }),
        encounter('GeneratedO', {
          rewardStoreName: 'RunProgress',
          roomRewardOverride: 'SpellDrop',
        }),
      ],
    });
    const stores = {
      MetaProgress: ['GiftDrop', 'MetaCardPointsCommonBigDrop', 'MetaCurrencyDrop'],
      RunProgress: ['MaxHealthDrop', 'MaxManaDrop', 'SpellDrop', 'Boon'],
    };
    const record = buildRunRecord([
      save({ history: [], current: entered, run: { rewardStores: stores } }),
      save({
        kind: 'postReward',
        history: [],
        current: settled,
        run: {
          metaConversionUses: 1,
          rewardStores: { MetaProgress: ['MetaCurrencyDrop'], RunProgress: ['Boon'] },
        },
      }),
      save({
        history: ['O_Combat05'],
        current: room('O_Devotion01'),
        departure: settled,
        run: { metaConversionUses: 1 },
      }),
    ]);
    expect(record.rooms[0]).toMatchObject({
      wheels: [
        {
          store: 'MetaProgress',
          picked: { type: 'MetaCardPointsCommonBigDrop' },
          offers: 2,
          side: 'left',
          unpicked: { type: 'GiftDrop' },
        },
        {
          store: 'RunProgress',
          picked: { type: 'SpellDrop' },
          offers: 2,
          side: 'left',
          unpicked: { type: 'MaxManaDrop' },
        },
      ],
      conversions: { artificer: 1 },
    });
  });

  it('leaves wheel offers unknown when left and right picks are mixed', () => {
    const settled = room('O_Combat05', {
      useRecord: { ShipsSteeringWheelLeft: 1, ShipsSteeringWheelRight: 1 },
      encounters: [
        encounter('GeneratedO', { rewardStoreName: 'RunProgress', roomRewardOverride: 'Boon' }),
        encounter('GeneratedO', { rewardStoreName: 'RunProgress', roomRewardOverride: 'Boon' }),
      ],
      forceLootName: 'ZeusUpgrade',
    });
    const record = buildRunRecord([
      save({ history: [], current: room('O_Combat05', { encounters: settled.encounters }) }),
      save({ history: ['O_Combat05'], current: room('O_Intro'), departure: settled }),
    ]);
    expect(record.rooms[0]?.wheels).toEqual([
      { store: 'RunProgress', picked: { type: 'Boon' }, offers: 2 },
      { store: 'RunProgress', picked: { type: 'Boon', lootName: 'ZeusUpgrade' }, offers: 2 },
    ]);
  });

  it('reads Hermes Shrine rushes, delays and the purchase counter', () => {
    const stock = [
      { slot: 1, name: 'ArmorBoost', boosted: false, purchased: false },
      { slot: 2, name: 'MaxHealthDrop', boosted: false, purchased: false },
      { slot: 3, name: 'ShopHermesUpgrade', boosted: false, purchased: false },
    ];
    const departed = room('O_Reprieve01', {
      surfaceShop: true,
      store: [
        { slot: 1, name: 'ArmorBoost', boosted: false, purchased: true, roomDelay: 8 },
        { slot: 2, name: 'MaxHealthDrop', boosted: false, purchased: false, roomDelay: 6 },
      ],
    });
    const record = buildRunRecord([
      save({ history: [], current: room('O_Reprieve01', { surfaceShop: true, store: stock }) }),
      save({
        history: ['O_Reprieve01'],
        current: room('O_Combat05'),
        departure: departed,
        run: { surfaceShopPurchases: 3 },
      }),
    ]);
    expect(record.rooms[0]?.store).toEqual({
      kind: 'hermesShrine',
      stock: [
        { slot: 1, name: 'ArmorBoost' },
        { slot: 2, name: 'MaxHealthDrop' },
        { slot: 3, name: 'ShopHermesUpgrade' },
      ],
      purchases: [
        { slot: 1, delivery: 'delayed', delay: 8 },
        { slot: 3, delivery: 'rushed' },
      ],
      purchaseCount: 3,
    });
  });

  it('places World Shop purchases by the slots their options leave empty', () => {
    const boon = (slot: number, lootName: string) => ({
      slot,
      name: 'RandomLoot',
      type: 'Boon',
      lootName,
      baseCost: 150,
      boosted: false,
      purchased: false,
    });
    const heal = { slot: 2, name: 'MaxManaDrop', boosted: false, purchased: false };
    const shop = [boon(1, 'AresUpgrade'), heal, boon(3, 'AphroditeUpgrade')];
    const visit = (left: readonly (typeof shop)[number][]) =>
      buildRunRecord([
        save({ history: [], current: room('F_Shop01', { store: shop }) }),
        save({
          history: ['F_Shop01'],
          current: room('F_Combat12'),
          departure: room('F_Shop01', { store: left }),
        }),
      ]).rooms[0]!.store;
    // Two RandomLoot options differ by god; the Ares slot is the one left.
    expect(visit([boon(1, 'AresUpgrade')])?.purchases).toEqual([{ slot: 2 }, { slot: 3 }]);
    expect(visit([heal, boon(3, 'AphroditeUpgrade')])?.purchases).toEqual([{ slot: 1 }]);
    // An option that disagrees with its stock slot leaves the purchases unknown.
    const disagreeing = visit([boon(1, 'AphroditeUpgrade')]);
    expect(disagreeing).toMatchObject({ kind: 'worldShop' });
    expect(disagreeing?.purchases).toBeUndefined();
  });

  it('places Stygian Well purchases only when their names are unambiguous', () => {
    const option = (slot: number, name: string) => ({
      slot,
      name,
      boosted: false,
      purchased: false,
    });
    const visit = (stock: ReturnType<typeof option>[], bought: Record<string, number>) =>
      buildRunRecord([
        save({ history: [], current: room('F_Combat12', { wellShop: true, store: stock }) }),
        save({
          history: ['F_Combat12'],
          current: room('F_Combat13'),
          departure: room('F_Combat12'),
          run: { wellShopPurchases: bought },
        }),
      ]).rooms[0]!.store;
    const stock = [option(1, 'HealDropRange'), option(2, 'TemporaryMoveSpeedTrait')];
    expect(visit(stock, { TemporaryMoveSpeedTrait: 1 })).toMatchObject({
      kind: 'well',
      purchases: [{ slot: 2 }],
    });
    expect(visit(stock, { TemporaryMoveSpeedTrait: 1, TemporaryDiscountTrait: 1 })).toMatchObject({
      purchases: [{ slot: 2 }],
      unstockedPurchases: ['TemporaryDiscountTrait'],
    });
    const repeated = [option(1, 'HealDropRange'), option(2, 'HealDropRange')];
    expect(visit(repeated, { HealDropRange: 1 })?.purchases).toBeUndefined();
  });

  it('omits a Hermes Shrine delay that is not a room count', () => {
    const stock = [{ slot: 1, name: 'ArmorBoost', boosted: false, purchased: false }];
    const visit = (roomDelay?: number) =>
      buildRunRecord([
        save({ history: [], current: room('O_Reprieve01', { surfaceShop: true, store: stock }) }),
        save({
          history: ['O_Reprieve01'],
          current: room('O_Combat05'),
          departure: room('O_Reprieve01', {
            surfaceShop: true,
            store: [
              {
                ...stock[0]!,
                purchased: true,
                ...(roomDelay === undefined ? {} : { roomDelay }),
              },
            ],
          }),
        }),
      ]).rooms[0]!.store?.purchases;
    expect(visit()).toEqual([{ slot: 1, delivery: 'delayed' }]);
    expect(visit(0)).toEqual([{ slot: 1, delivery: 'delayed' }]);
    expect(visit(2.5)).toEqual([{ slot: 1, delivery: 'delayed' }]);
    expect(visit(4)).toEqual([{ slot: 1, delivery: 'delayed', delay: 4 }]);
  });

  it('counts Forfeit skips across the biome reset of their counter', () => {
    const record = buildRunRecord([
      save({ history: [], current: room('N_PostBoss01'), run: { biomeBoonSkipCount: 2 } }),
      save({
        history: ['N_PostBoss01'],
        current: room('O_Intro'),
        departure: room('N_PostBoss01'),
        run: { biomeBoonSkipCount: 0 },
      }),
      save({
        history: ['N_PostBoss01', 'O_Intro'],
        current: room('O_Combat01'),
        departure: room('O_Intro'),
        run: { biomeBoonSkipCount: 1 },
      }),
    ]);
    expect(record.rooms.map((entry) => entry.forfeitSkips)).toEqual([undefined, 1, undefined]);
  });

  it('keeps the last write of a rewritten checkpoint', () => {
    const record = buildRunRecord([
      save({ history: [], current: room('F_Opening01') }),
      save({
        kind: 'postReward',
        history: [],
        current: room('F_Opening01', { useRecord: { HeraUpgrade: 1 } }),
      }),
      save({
        kind: 'postReward',
        history: [],
        current: room('F_Opening01', { useRecord: { HeraUpgrade: 1, RoomMoneyDrop: 1 } }),
      }),
    ]);
    expect(record.rooms[0]?.uses).toEqual({ HeraUpgrade: 1, RoomMoneyDrop: 1 });
  });

  it('places a loot screen in the room whose index is its depth', () => {
    const screen = (giver: string, depth: number) => ({
      giver,
      depth,
      options: [{ name: `${giver}Boon`, chosen: true }],
    });
    const record = buildRunRecord([
      save({ history: [], current: room('F_Opening01') }),
      save({
        history: ['F_Opening01'],
        current: room('F_Combat01'),
        departure: room('F_Opening01'),
        run: { lootChoices: [screen('HeraUpgrade', 0), screen('ZeusUpgrade', 1)] },
      }),
    ]);
    expect(record.rooms.map((entry) => entry.traitScreens.map((item) => item.giver))).toEqual([
      ['HeraUpgrade'],
      ['ZeusUpgrade'],
    ]);
  });

  it('places sold Pool of Purging slots, including a trailing one', () => {
    const departed = room('F_PostBoss01', {
      sellShop: true,
      sellOptions: [
        { slot: 1, name: 'AphroditeManaBoon' },
        { slot: 3, name: 'AresCastBoon' },
      ],
    });
    const record = buildRunRecord([
      save({ history: [], current: room('F_PostBoss01', { sellShop: true }) }),
      save({
        history: ['F_PostBoss01'],
        current: room('G_Intro'),
        departure: departed,
        run: { traitsSold: 2 },
      }),
    ]);
    expect(record.rooms[0]?.pool).toEqual({
      slots: [
        { slot: 1, name: 'AphroditeManaBoon' },
        { slot: 3, name: 'AresCastBoon' },
      ],
      soldSlots: [2, 4],
      sales: 2,
    });
  });

  it('counts a revisited room object per visit', () => {
    const hub = (uses: Record<string, number>, timesVisited: number) =>
      room('N_Hub', { useRecord: uses, timesVisited });
    const record = buildRunRecord([
      save({ history: [], current: room('N_Hub') }),
      save({
        history: ['N_Hub'],
        current: room('N_Combat02'),
        departure: hub({ EphyraExitDoor: 1 }, 1),
      }),
      save({
        history: ['N_Hub', 'N_Combat02'],
        current: room('N_Hub'),
        departure: room('N_Combat02', { timesVisited: 1 }),
      }),
      save({
        history: ['N_Hub', 'N_Combat02', 'N_Hub'],
        current: room('N_Combat14'),
        departure: hub({ EphyraExitDoor: 2, HealthFountainN: 1 }, 3),
      }),
    ]);
    expect(record.rooms.map((entry) => entry.uses)).toEqual([
      { EphyraExitDoor: 1 },
      {},
      { EphyraExitDoor: 1, HealthFountainN: 1 },
      {},
    ]);
  });

  it('keeps a revisit to what that visit itself shows', () => {
    const combat = (values: Partial<SavedRoom>) =>
      room('N_Combat02', {
        chosenRewardType: 'Boon',
        forceLootName: 'ZeusUpgrade',
        encounter: encounter('GeneratedN'),
        ...values,
      });
    const firstEntry = combat({
      timesVisited: 1,
      encounter: encounter('GeneratedN', { waves: [{ spawns: [] }] }),
    });
    const record = buildRunRecord([
      save({ history: [], current: firstEntry }),
      save({
        history: ['N_Combat02'],
        current: room('N_Sub01'),
        departure: combat({ timesVisited: 1, useRecord: { ZeusUpgrade: 1 } }),
      }),
      save({
        history: ['N_Combat02', 'N_Sub01'],
        current: combat({ timesVisited: 3, useRecord: { ZeusUpgrade: 1 } }),
        departure: room('N_Sub01'),
      }),
      // The run is abandoned in the revisit: only its entry was observed.
    ]);
    const [first, , revisit] = record.rooms;
    expect(first).toMatchObject({
      reward: { type: 'Boon', lootName: 'ZeusUpgrade' },
      encounters: [{ name: 'GeneratedN' }],
      uses: { ZeusUpgrade: 1 },
    });
    expect(revisit).toMatchObject({ name: 'N_Combat02', encounters: [], uses: {} });
    expect(revisit?.reward).toBeUndefined();
  });

  it('orders Fields cages by opening time and splits optional rewards', () => {
    const cage = (rewardType: string, startTime: number) => ({
      rewardType,
      encounter: encounter('GeneratedH', { startTime, eligibleSpawnPoints: [startTime * 10] }),
    });
    const restore = (objectId: string, reward: string, point: number) => ({
      objectId,
      reward,
      point,
    });
    const entered = room('H_Combat15', {
      cages: [cage('WeaponUpgrade', 9), cage('HermesUpgrade', 4)],
    });
    const settled = (rewards: ReturnType<typeof restore>[]) =>
      room('H_Combat15', {
        cages: entered.cages,
        heroStartPoint: 760471,
        encounter: encounter('GeneratedH_PassiveSmall', { rewardsToRestore: rewards }),
      });
    const record = buildRunRecord([
      save({ history: [], current: entered }),
      save({
        kind: 'postReward',
        history: [],
        current: settled([
          restore('1', 'MaxManaDropSmall', 572849),
          restore('2', 'RoomMoneyTinyDrop', 5),
        ]),
      }),
      save({
        history: ['H_Combat15'],
        current: room('H_MiniBoss01'),
        departure: settled([restore('1', 'MaxManaDropSmall', 572849)]),
      }),
    ]);
    expect(record.rooms[0]?.fields).toEqual({
      entryPoint: 760471,
      cageOrder: 'opening',
      cages: [
        {
          reward: { type: 'HermesUpgrade' },
          encounter: { name: 'GeneratedH' },
          openedAt: 4,
          spawnPointIds: [40],
        },
        {
          reward: { type: 'WeaponUpgrade' },
          encounter: { name: 'GeneratedH' },
          openedAt: 9,
          spawnPointIds: [90],
        },
      ],
      optionalRewards: [
        { reward: 'RoomMoneyTinyDrop', point: 5, collected: true },
        { reward: 'MaxManaDropSmall', point: 572849, collected: false },
      ],
    });

    // Without the end-of-combat snapshot nothing tells collected rewards apart,
    // and a cage without an opening time leaves the order unknown.
    const unopened = room('H_Combat15', {
      cages: [
        cage('WeaponUpgrade', 9),
        { rewardType: 'HermesUpgrade', encounter: encounter('GeneratedH') },
      ],
    });
    const partial = buildRunRecord([
      save({ history: [], current: unopened }),
      save({
        history: ['H_Combat15'],
        current: room('H_MiniBoss01'),
        departure: room('H_Combat15', {
          cages: unopened.cages,
          encounter: encounter('GeneratedH_PassiveSmall', {
            rewardsToRestore: [restore('1', 'MaxManaDropSmall', 572849)],
          }),
        }),
      }),
    ]).rooms[0]?.fields;
    expect(partial).toMatchObject({
      cageOrder: 'unknown',
      cages: [{ reward: { type: 'WeaponUpgrade' } }, { reward: { type: 'HermesUpgrade' } }],
      optionalRewards: [{ reward: 'MaxManaDropSmall', point: 572849 }],
    });
    expect(partial?.optionalRewards[0]).not.toHaveProperty('collected');
  });

  it('attributes trait gains, losses, keepsake swaps and Time Piece uses to rooms', () => {
    const boon = { name: 'ZeusWeaponBoon', id: '1112.250.123', rarity: 'Rare', stackNum: 1 };
    const swapped: SavedTrait[] = [
      { name: 'LowHealthCritKeepsake', id: '11120.50.4', rarity: 'Common' },
    ];
    const first = save({ history: [], current: room('F_Opening01') });
    const second: SaveCheckpoint = {
      ...save({
        history: ['F_Opening01'],
        current: room('F_Combat01'),
        departure: room('F_Opening01'),
        traits: [{ ...startTraits[0]!, boonConversionUses: 2 }, boon],
        worldTime: 15,
      }),
    };
    const third: SaveCheckpoint = {
      ...save({
        history: ['F_Opening01', 'F_Combat01'],
        current: room('F_Combat02'),
        departure: room('F_Combat01'),
        traits: [boon, ...swapped],
        worldTime: 25,
      }),
    };
    const swappedSave: SaveCheckpoint = {
      ...third,
      hero: { traits: third.hero!.traits, slotted: { Keepsake: 'LowHealthCritKeepsake' } },
    };
    const record = buildRunRecord([first, second, swappedSave]);
    expect(record.rooms[0]).toMatchObject({
      traits: {
        acquired: [{ name: 'ZeusWeaponBoon', rarity: 'Rare', level: 1, worldTime: 12.25 }],
        removed: [],
      },
      conversions: { timePiece: 1 },
    });
    expect(record.rooms[1]).toMatchObject({
      traits: {
        acquired: [{ name: 'LowHealthCritKeepsake', rarity: 'Common', worldTime: 20.5 }],
        removed: ['GoldifyKeepsake'],
      },
      keepsakeSwap: { from: 'GoldifyKeepsake', to: 'LowHealthCritKeepsake' },
    });
  });

  it('records a trait replaced by a higher grade of itself as an upgrade', () => {
    const pom = (id: string, stackNum: number) => ({
      name: 'ZeusWeaponBoon',
      id,
      rarity: 'Rare',
      stackNum,
    });
    const record = buildRunRecord([
      save({ history: [], current: room('F_Opening01'), traits: [pom('0110.50.5', 1)] }),
      save({
        history: ['F_Opening01'],
        current: room('F_Combat01'),
        departure: room('F_Opening01'),
        traits: [pom('1112.250.123', 2)],
        worldTime: 15,
      }),
    ]);
    expect(record.rooms[0]?.traits).toEqual({
      acquired: [],
      removed: [],
      upgraded: [
        {
          name: 'ZeusWeaponBoon',
          from: { rarity: 'Rare', level: 1 },
          to: { rarity: 'Rare', level: 2 },
          worldTime: 12.25,
        },
      ],
    });
  });

  it('ends a run on the hub save of the dead hero', () => {
    const boss = room('I_Boss01', { useRecord: { MixerIBossDrop: 1 } });
    const record = buildRunRecord(
      [save({ history: [], current: room('I_Boss01') })],
      save({
        kind: 'hub',
        history: ['I_Boss01'],
        current: boss,
        departure: boss,
        traits: null,
        run: { heroDead: true, cleared: true, runResult: 1, biomeVisitOrder: ['F', 'G', 'H', 'I'] },
      }),
    );
    expect(record.outcome).toEqual({ kind: 'victory', endingRoom: 'I_Boss01', runResult: 1 });
    expect(record.route.biomes).toEqual(['F', 'G', 'H', 'I']);
    expect(record.rooms[0]?.uses).toEqual({ MixerIBossDrop: 1 });
  });

  it('rejects checkpoints that do not form one run', () => {
    const start = save({ history: [], current: room('F_Opening01') });
    expect(() => buildRunRecord([])).toThrow(RunRecordBuildError);
    expect(() =>
      buildRunRecord([save({ history: ['F_Opening01'], current: room('F_Combat01') })]),
    ).toThrow(/starts with an entry save/);
    expect(() => buildRunRecord([start, { ...start, runCount: 8 }])).toThrow(/different runs/);
    expect(() => buildRunRecord([start], { ...start, kind: 'hub' })).toThrow(/dead hero/);
    expect(() =>
      buildRunRecord([
        start,
        save({
          history: ['F_Opening01'],
          current: room('F_Combat01'),
          departure: room('F_Shop01'),
        }),
      ]),
    ).toThrow(/departure does not match/);
  });
});

describe('trait world time', () => {
  it('parses the world time between two checkpoints', () => {
    expect(traitWorldTime('21266.1395432290160.028722521616146', 35, 67)).toBe(66.139543229016);
    // Several count/depth splits agree on one world time.
    expect(traitWorldTime('3522565.273677085760.33186322567053', 520, 567)).toBe(565.27367708576);
    expect(traitWorldTime('1234560.5', 0, 1e6)).toBeUndefined();
    expect(traitWorldTime('not-an-id', 0, 10)).toBeUndefined();
  });
});
