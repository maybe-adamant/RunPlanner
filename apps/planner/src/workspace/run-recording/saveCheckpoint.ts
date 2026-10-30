import type { RunRecordSavedValuePaths } from '@run-planner/engine/run-record';

import type { LuaTable, LuaValue } from './luabins';
import type { DecodedSave } from './saveFile';

/**
 * The run facts one decoded save contributes, in save vocabulary. A raw save
 * is reduced to this view as soon as it is read.
 */
export interface SaveCheckpoint {
  /** `entry` on room entry, `postReward` when exits unlock, `hub` for a profile save. */
  readonly kind: 'entry' | 'postReward' | 'hub';
  readonly timestamp: number;
  readonly runCount: number;
  readonly mapName: string;
  readonly nextMap: string;
  readonly worldTime: number;
  /** `RoomHistory` names in order. */
  readonly history: readonly string[];
  /** The last `RoomHistory` entry, which a save keeps unstripped: the departed room. */
  readonly departure?: SavedRoom;
  readonly currentRoom: SavedRoom;
  readonly run: SavedRunState;
  /** Absent when the save keeps no build (the hub save). */
  readonly hero?: SavedHero;
  readonly profile: SavedProfile;
}

export interface SavedRunState {
  readonly biomeVisitOrder: readonly string[];
  readonly dream: boolean;
  readonly runResult?: number;
  readonly cleared: boolean;
  readonly killedBy?: string;
  readonly heroDead: boolean;
  readonly metaConversionUses: number;
  readonly biomeBoonSkipCount: number;
  readonly surfaceShopPurchases: number;
  readonly traitsSold: number;
  readonly wellShopPurchases: Readonly<Record<string, number>>;
  /** `ToolElementsSpawned`: gathering tools whose element the run has granted. */
  readonly toolElementsSpawned: Readonly<Record<string, number>>;
  readonly maxClockworkNonGoalRewards?: number;
  readonly npcInteractions: Readonly<Record<string, number>>;
  /** Entry names per reward store, in store order. */
  readonly rewardStores: Readonly<Record<string, readonly string[]>>;
  readonly lootChoices: readonly SavedLootChoice[];
  /** `BannedTraits` names, sorted. */
  readonly bannedTraits: readonly string[];
  /** `TemporaryMetaUpgrades`: Arcana cards drawn this biome, sorted. */
  readonly temporaryMetaUpgrades: readonly string[];
  /** `NumRerolls`: rerolls left. */
  readonly numRerolls?: number;
  /** `PoseidonDoubleRewardCount`: Sea Star duplicates this run. */
  readonly poseidonDoubleRewardCount: number;
}

export interface SavedLootChoice {
  readonly giver: string;
  readonly depth: number;
  readonly options: readonly { name: string; rarity?: string; chosen: boolean }[];
  readonly traitToReplace?: string;
  readonly oldRarity?: string;
}

export interface SavedTrait {
  readonly name: string;
  readonly id?: string;
  readonly rarity?: string;
  readonly stackNum?: number;
  readonly boonConversionUses?: number;
  readonly remainingUses?: number;
  /** `RarityUpgradeData.Uses`: Rarify charges left, not the keepsake's own `Uses`. */
  readonly rarityUpgradeUses?: number;
  /** `SourceName`: the Arcana card that granted the trait. */
  readonly sourceName?: string;
  /** The numbers at the paths kept for this trait's name, by dotted path. */
  readonly savedValues?: Readonly<Record<string, number>>;
  /** `UpgradedTraitName`: the trait a promoting pick such as Bridal Glow upgraded. */
  readonly upgradedTrait?: string;
}

export interface SavedHero {
  readonly traits: readonly SavedTrait[];
  readonly slotted: Readonly<Record<string, string>>;
  readonly spell?: SavedSpell;
  /** `Hero.Elements`: element counts, zeros left out. */
  readonly elements: Readonly<Record<string, number>>;
  /** `Hero.MaxHealth`. */
  readonly maxHealth?: number;
}

/** `Hero.SlottedSpell`: the spell, its tree structure and talents by `depth:slot`. */
export interface SavedSpell {
  readonly name: string;
  readonly layout?: string;
  readonly talents: Readonly<Record<string, { readonly name: string; readonly invested: boolean }>>;
}

export interface SavedProfile {
  readonly primaryWeapon?: string;
  readonly equippedFamiliar?: string;
  readonly shrineUpgrades: Readonly<Record<string, number>>;
  /** Equipped Arcana by name with card level. */
  readonly arcana: Readonly<Record<string, number>>;
  readonly money: number;
}

export interface SavedSpawn {
  readonly name: string;
  readonly totalCount?: number;
  readonly generated: boolean;
  readonly requiredMiniBossShrine: boolean;
  readonly infiniteSpawns: boolean;
}

export interface SavedWave {
  readonly difficulty?: number;
  readonly spawns: readonly SavedSpawn[];
}

export interface SavedEncounter {
  readonly name: string;
  readonly difficulty?: number;
  readonly waves: readonly SavedWave[];
  readonly blacklist: readonly string[];
  readonly eliteAttributes: Readonly<Record<string, readonly string[]>>;
  readonly startTime?: number;
  readonly eligibleSpawnPoints?: readonly number[];
  readonly rewardStoreName?: string;
  readonly roomRewardOverride?: string;
  /** Fig Leaf skipped the encounter's spawns, set when the encounter starts. */
  readonly spawnsSkipped: boolean;
  /** Uncollected optional rewards by object id. */
  readonly rewardsToRestore: readonly { reward: string; point: number; objectId: string }[];
}

export interface SavedStoreOption {
  readonly slot: number;
  readonly name: string;
  readonly type?: string;
  readonly lootName?: string;
  readonly baseCost?: number;
  readonly boosted: boolean;
  readonly purchased: boolean;
  readonly roomDelay?: number;
}

export interface SavedCage {
  readonly rewardType: string;
  readonly lootName?: string;
  readonly encounter: SavedEncounter;
}

export interface SavedRoom {
  readonly name: string;
  readonly timesVisited?: number;
  readonly chosenRewardType?: string;
  readonly forceLootName?: string;
  readonly rewardStoreName?: string;
  readonly exitDoors: readonly { door: number; room: string }[];
  readonly offeredRewards: Readonly<
    Record<string, { type: string; lootName?: string; lootNames?: readonly [string, string] }>
  >;
  readonly predeterminedDoors: readonly { door: number; room: string }[];
  readonly useRecord: Readonly<Record<string, number>>;
  readonly kills: Readonly<Record<string, number>>;
  readonly encounter?: SavedEncounter;
  readonly encounters: readonly SavedEncounter[];
  readonly store?: readonly SavedStoreOption[];
  readonly sellOptions?: readonly { slot: number; name: string; rarity?: string; value?: number }[];
  readonly cages: readonly SavedCage[];
  readonly heroStartPoint?: number;
  readonly wellShop: boolean;
  readonly surfaceShop: boolean;
  readonly sellShop: boolean;
  /** `SpentRerolls`: screen rerolls by the rerolled screen's id. */
  readonly spentRerolls?: Readonly<Record<string, number>>;
  /** `OlympusEagleSpawn`: Aetos appeared in the room. */
  readonly olympusEagleSpawn: boolean;
}

export class SaveCheckpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveCheckpointError';
  }
}

function isTable(value: LuaValue | undefined): value is LuaTable {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function table(value: LuaValue | undefined): LuaTable {
  return isTable(value) ? value : {};
}

/** Entries of an array-like Lua table by their 1-based key, in key order. */
function slots(value: LuaValue | undefined): readonly [number, LuaValue][] {
  if (Array.isArray(value)) return value.map((entry, index) => [index + 1, entry]);
  if (!isTable(value)) return [];
  return Object.entries(value)
    .filter(([key]) => /^[1-9]\d*$/.test(key))
    .map(([key, entry]): [number, LuaValue] => [Number(key), entry])
    .sort(([left], [right]) => left - right);
}

/** Entries of a Lua table by numeric key, 0 included, in key order: Hex tree slots start at 0. */
function numbered(value: LuaValue | undefined): readonly [number, LuaValue][] {
  if (Array.isArray(value)) return value.map((entry, index) => [index + 1, entry]);
  if (!isTable(value)) return [];
  return Object.entries(value)
    .filter(([key]) => /^(?:0|[1-9]\d*)$/.test(key))
    .map(([key, entry]): [number, LuaValue] => [Number(key), entry])
    .sort(([left], [right]) => left - right);
}

function items(value: LuaValue | undefined): readonly LuaValue[] {
  return slots(value).map(([, entry]) => entry);
}

function text(value: LuaValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function number(value: LuaValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function counts(value: LuaValue | undefined): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(table(value)))
    if (typeof entry === 'number' && entry !== 0) result[key] = entry;
  return result;
}

function doorMap(value: LuaValue | undefined): readonly { door: number; room: string }[] {
  return Object.entries(table(value))
    .flatMap(([key, room]) =>
      typeof room === 'string' && /^\d+$/.test(key) ? [{ door: Number(key), room }] : [],
    )
    .sort((left, right) => left.door - right.door);
}

function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

function encounter(value: LuaValue | undefined): SavedEncounter | undefined {
  if (!isTable(value)) return undefined;
  const name = text(value.Name);
  if (name === undefined) return undefined;
  const waves = items(value.SpawnWaves).flatMap((wave) => {
    if (!isTable(wave)) return [];
    const spawns = items(wave.Spawns).flatMap((spawn): SavedSpawn[] => {
      if (!isTable(spawn)) return [];
      const enemy = text(spawn.Name);
      if (enemy === undefined) return [];
      return [
        {
          name: enemy,
          ...optional('totalCount', number(spawn.TotalCount)),
          generated: spawn.Generated === true,
          requiredMiniBossShrine: spawn.RequiredMiniBossShrine === true,
          infiniteSpawns: spawn.InfiniteSpawns === true,
        },
      ];
    });
    return [{ ...optional('difficulty', number(wave.DifficultyRating)), spawns }];
  });
  const eliteAttributes: Record<string, readonly string[]> = {};
  for (const [enemy, perks] of Object.entries(table(value.EliteAttributes))) {
    const names = items(perks).flatMap((perk) => (typeof perk === 'string' ? [perk] : []));
    if (names.length > 0) eliteAttributes[enemy] = names;
  }
  const points = items(value.EligibleSpawnPoints).flatMap((point) =>
    typeof point === 'number' ? [point] : [],
  );
  const rewardsToRestore = Object.entries(table(value.RewardsToRestore))
    .flatMap(([objectId, entry]) => {
      if (!isTable(entry)) return [];
      const reward = text(entry.RewardOverride);
      const point = number(entry.SpawnRewardOnId);
      return reward === undefined || point === undefined ? [] : [{ reward, point, objectId }];
    })
    .sort((left, right) => Number(left.objectId) - Number(right.objectId));
  return {
    name,
    ...optional('difficulty', number(value.DifficultyRating)),
    waves,
    blacklist: Object.entries(table(value.Blacklist))
      .filter(([, blocked]) => blocked === true)
      .map(([enemy]) => enemy)
      .sort(),
    eliteAttributes,
    ...optional('startTime', number(value.StartTime)),
    ...optional('eligibleSpawnPoints', points.length > 0 ? points : undefined),
    ...optional('rewardStoreName', text(value.RewardStoreName)),
    ...optional('roomRewardOverride', text(value.EncounterRoomRewardOverride)),
    spawnsSkipped: value.SpawnsSkipped === true,
    rewardsToRestore,
  };
}

function storeOptions(value: LuaValue | undefined): readonly SavedStoreOption[] | undefined {
  if (!isTable(value)) return undefined;
  return slots(value.StoreOptions).flatMap(([slot, option]): SavedStoreOption[] => {
    if (!isTable(option)) return [];
    const name = text(option.Name);
    if (name === undefined) return [];
    const args = table(option.Args);
    const baseCost = number(table(args.ResourceCosts).Money) ?? number(option.CostOverride);
    return [
      {
        slot,
        name,
        ...optional('type', text(option.Type)),
        ...optional('lootName', text(args.ForceLootName)),
        ...optional('baseCost', baseCost),
        boosted: isTable(args.BoonRaritiesOverride),
        purchased: option.Purchased === true,
        ...optional('roomDelay', number(option.RoomDelay)),
      },
    ];
  });
}

function offeredRewards(value: LuaValue | undefined): SavedRoom['offeredRewards'] {
  const result: Record<
    string,
    { type: string; lootName?: string; lootNames?: readonly [string, string] }
  > = {};
  for (const [door, offer] of Object.entries(table(value))) {
    if (!isTable(offer)) continue;
    const type = text(offer.Type);
    if (type === undefined) continue;
    const lootA = text(offer.LootAName);
    const lootB = text(offer.LootBName);
    result[door] = {
      type,
      ...optional('lootName', text(offer.ForceLootName)),
      ...optional(
        'lootNames',
        lootA !== undefined && lootB !== undefined ? ([lootA, lootB] as const) : undefined,
      ),
    };
  }
  return result;
}

function room(value: LuaValue | undefined): SavedRoom | undefined {
  if (!isTable(value)) return undefined;
  const name = text(value.Name);
  if (name === undefined) return undefined;
  const sellOptions =
    isTable(value.SellOptions) || Array.isArray(value.SellOptions)
      ? slots(value.SellOptions).flatMap(([slot, option]) => {
          if (!isTable(option)) return [];
          const trait = text(option.Name);
          return trait === undefined
            ? []
            : [
                {
                  slot,
                  name: trait,
                  ...optional('rarity', text(option.Rarity)),
                  ...optional('value', number(option.Value)),
                },
              ];
        })
      : undefined;
  const cages = items(value.CageRewards).flatMap((cage): SavedCage[] => {
    if (!isTable(cage)) return [];
    const rewardType = text(cage.RewardType);
    const cageEncounter = encounter(cage.Encounter);
    if (rewardType === undefined || cageEncounter === undefined) return [];
    return [
      { rewardType, ...optional('lootName', text(cage.ForceLootName)), encounter: cageEncounter },
    ];
  });
  const roomEncounter = encounter(value.Encounter);
  return {
    name,
    ...optional('timesVisited', number(value.TimesVisited)),
    ...optional('chosenRewardType', text(value.ChosenRewardType)),
    ...optional('forceLootName', text(value.ForceLootName)),
    ...optional('rewardStoreName', text(value.RewardStoreName)),
    exitDoors: doorMap(value.ExitDoorRooms),
    offeredRewards: offeredRewards(value.OfferedRewards),
    predeterminedDoors: doorMap(value.PredeterminedDoorRooms),
    useRecord: counts(value.UseRecord),
    kills: counts(value.Kills),
    ...optional('encounter', roomEncounter),
    encounters: items(value.Encounters).flatMap((entry) => {
      const phase = encounter(entry);
      return phase === undefined ? [] : [phase];
    }),
    ...optional('store', storeOptions(value.Store)),
    ...optional('sellOptions', sellOptions),
    cages,
    ...optional('heroStartPoint', number(value.HeroStartPoint)),
    wellShop: value.WellShopChanceSuccess === true,
    surfaceShop: value.SurfaceShopChanceSuccess === true,
    sellShop: value.SellShopChanceSuccess === true,
    olympusEagleSpawn: value.OlympusEagleSpawn === true,
    ...optional(
      'spentRerolls',
      Object.keys(counts(value.SpentRerolls)).length > 0 ? counts(value.SpentRerolls) : undefined,
    ),
  };
}

function lootChoices(value: LuaValue | undefined): readonly SavedLootChoice[] {
  return items(value).flatMap((entry): SavedLootChoice[] => {
    if (!isTable(entry)) return [];
    const giver = text(entry.UpgradeName);
    const depth = number(entry.Depth);
    if (giver === undefined || depth === undefined) return [];
    const options = items(entry.UpgradeChoices).flatMap((option) => {
      if (!isTable(option)) return [];
      const name = text(option.Name);
      return name === undefined
        ? []
        : [
            {
              name,
              ...optional('rarity', text(option.Rarity)),
              chosen: option.Chosen === 'true' || option.Chosen === true,
            },
          ];
    });
    return [
      {
        giver,
        depth,
        options,
        ...optional('traitToReplace', text(entry.TraitToReplace)),
        ...optional('oldRarity', text(entry.OldRarity)),
      },
    ];
  });
}

/** The value at a dotted path; a numeric segment is a 1-based Lua array key. */
function atPath(value: LuaValue | undefined, path: string): LuaValue | undefined {
  let current = value;
  for (const segment of path.split('.')) {
    if (Array.isArray(current) && /^[1-9]\d*$/.test(segment))
      current = (current as readonly LuaValue[])[Number(segment) - 1];
    else if (isTable(current)) current = current[segment];
    else return undefined;
  }
  return current;
}

function savedValues(
  entry: LuaTable,
  paths: readonly string[] | undefined,
): Readonly<Record<string, number>> | undefined {
  const values: Record<string, number> = {};
  for (const path of paths ?? []) {
    const found = number(atPath(entry, path));
    if (found !== undefined) values[path] = found;
  }
  return Object.keys(values).length === 0 ? undefined : values;
}

function hero(
  value: LuaValue | undefined,
  savedValuePaths: RunRecordSavedValuePaths,
): SavedHero | undefined {
  if (!isTable(value)) return undefined;
  const traits = items(value.Traits).flatMap((entry): SavedTrait[] => {
    if (!isTable(entry)) return [];
    const name = text(entry.Name);
    if (name === undefined) return [];
    return [
      {
        name,
        ...optional('id', text(entry.Id)),
        ...optional('rarity', text(entry.Rarity)),
        ...optional('stackNum', number(entry.StackNum)),
        ...optional('boonConversionUses', number(entry.BoonConversionUses)),
        ...optional('remainingUses', number(entry.RemainingUses)),
        ...optional('rarityUpgradeUses', number(atPath(entry, 'RarityUpgradeData.Uses'))),
        ...optional('sourceName', text(entry.SourceName)),
        ...optional('savedValues', savedValues(entry, savedValuePaths.get(name))),
        ...optional('upgradedTrait', text(entry.UpgradedTraitName)),
      },
    ];
  });
  if (traits.length === 0) return undefined;
  const slotted: Record<string, string> = {};
  for (const [slot, trait] of Object.entries(table(value.SlottedTraits)))
    if (typeof trait === 'string') slotted[slot] = trait;
  const savedSpell = spell(value.SlottedSpell);
  return {
    traits,
    slotted,
    ...optional('spell', savedSpell),
    elements: counts(value.Elements),
    ...optional('maxHealth', number(value.MaxHealth)),
  };
}

function spell(value: LuaValue | undefined): SavedSpell | undefined {
  if (!isTable(value)) return undefined;
  const name = text(value.Name);
  if (name === undefined) return undefined;
  const tree = table(value.Talents);
  const talents: Record<string, { name: string; invested: boolean }> = {};
  for (const [depth, nodes] of slots(tree))
    for (const [slot, node] of numbered(nodes)) {
      const talent = isTable(node) ? text(node.Name) : undefined;
      if (talent !== undefined)
        talents[`${depth}:${slot}`] = {
          name: talent,
          invested: (node as LuaTable).Invested === true,
        };
    }
  return { name, ...optional('layout', text(tree.Name)), talents };
}

function rewardStores(value: LuaValue | undefined): SavedRunState['rewardStores'] {
  const result: Record<string, readonly string[]> = {};
  for (const [store, entries] of Object.entries(table(value)))
    result[store] = items(entries).flatMap((entry) => {
      const name = isTable(entry) ? text(entry.Name) : undefined;
      return name === undefined ? [] : [name];
    });
  return result;
}

/** Reduces one decoded save to its checkpoint view, keeping the given trait paths. */
export function extractSaveCheckpoint(
  save: DecodedSave,
  temp: boolean,
  savedValuePaths: RunRecordSavedValuePaths,
): SaveCheckpoint {
  const globals = save.globals;
  const run = table(globals.CurrentRun);
  const gameState = table(globals.GameState);
  const currentRoom = room(run.CurrentRoom);
  if (currentRoom === undefined)
    throw new SaveCheckpointError('save has no CurrentRun.CurrentRoom');
  const historyEntries = items(run.RoomHistory);
  const history = historyEntries.map((entry, index) => {
    const name = isTable(entry) ? text(entry.Name) : undefined;
    if (name === undefined) throw new SaveCheckpointError(`RoomHistory[${index + 1}] has no name`);
    return name;
  });
  const departure = room(historyEntries[historyEntries.length - 1]);
  const heroTable = table(run.Hero);
  const arcana: Record<string, number> = {};
  for (const [name, state] of Object.entries(table(gameState.MetaUpgradeState))) {
    if (!isTable(state) || state.Equipped !== true) continue;
    const level = number(state.Level);
    if (level !== undefined) arcana[name] = level;
  }
  const shrineUpgrades: Record<string, number> = {};
  for (const [vow, rank] of Object.entries(table(gameState.ShrineUpgrades)))
    if (typeof rank === 'number') shrineUpgrades[vow] = rank;
  const savedHero = hero(heroTable, savedValuePaths);
  return Object.freeze({
    kind: !temp ? 'hub' : save.header.nextMap === '' ? 'postReward' : 'entry',
    timestamp: save.header.timestamp,
    runCount: save.header.runCount,
    mapName: save.header.mapName,
    nextMap: save.header.nextMap,
    worldTime: number(globals._worldTime) ?? 0,
    history,
    ...optional('departure', departure),
    currentRoom,
    run: {
      biomeVisitOrder: items(run.BiomeVisitOrder).flatMap((biome) =>
        typeof biome === 'string' ? [biome] : [],
      ),
      dream: run.IsDreamRun === true,
      ...optional('runResult', number(run.RunResult)),
      cleared: run.Cleared === true,
      ...optional('killedBy', text(run.KilledByName)),
      heroDead: heroTable.IsDead === true,
      metaConversionUses: number(run.MetaConversionUses) ?? 0,
      biomeBoonSkipCount: number(run.BiomeBoonSkipCount) ?? 0,
      surfaceShopPurchases: number(run.SurfaceShopPurchases) ?? 0,
      traitsSold: number(run.TraitsSold) ?? 0,
      wellShopPurchases: counts(run.WellShopPurchases),
      toolElementsSpawned: counts(run.ToolElementsSpawned),
      ...optional('maxClockworkNonGoalRewards', number(run.MaxClockworkNonGoalRewards)),
      npcInteractions: counts(run.NPCInteractions),
      rewardStores: rewardStores(run.RewardStores),
      lootChoices: lootChoices(run.LootChoiceHistory),
      bannedTraits: Object.entries(table(run.BannedTraits))
        .filter(([, banned]) => banned === true)
        .map(([name]) => name)
        .sort(),
      temporaryMetaUpgrades: Object.entries(table(run.TemporaryMetaUpgrades))
        .filter(([, drawn]) => drawn === true)
        .map(([name]) => name)
        .sort(),
      ...optional('numRerolls', number(run.NumRerolls)),
      poseidonDoubleRewardCount: number(run.PoseidonDoubleRewardCount) ?? 0,
    },
    ...optional('hero', savedHero),
    profile: {
      ...optional('primaryWeapon', text(gameState.PrimaryWeaponName)),
      ...optional('equippedFamiliar', text(gameState.EquippedFamiliar)),
      shrineUpgrades,
      arcana,
      money: number(table(gameState.Resources).Money) ?? 0,
    },
  });
}
