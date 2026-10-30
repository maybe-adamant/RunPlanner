/**
 * An observed Hades II run in game vocabulary: native names, never catalog keys.
 * A fact the game did not record is absent; nothing here is inferred planner meaning.
 */
export const RUN_RECORD_VERSION = 1;

export interface RunRecord {
  readonly recordVersion: typeof RUN_RECORD_VERSION;
  readonly run: RunRecordIdentity;
  readonly route: RunRecordRoute;
  readonly outcome: RunRecordOutcome;
  readonly loadout: RunRecordLoadout;
  readonly rooms: readonly RunRecordRoom[];
}

export interface RunRecordIdentity {
  /** The profile's run count, constant for the whole run. */
  readonly runCount: number;
  /** Unix seconds at which the run started. */
  readonly startedAt: number;
}

export interface RunRecordRoute {
  /** Biome letters in visit order (`BiomeVisitOrder`). */
  readonly biomes: readonly string[];
  readonly dream: boolean;
  /** `CurrentRun.MaxClockworkNonGoalRewards`, rolled on entering Tartarus. */
  readonly maxClockworkNonGoalRewards?: number;
}

export type RunRecordOutcomeKind = 'victory' | 'death' | 'abandoned';

export interface RunRecordOutcome {
  readonly kind: RunRecordOutcomeKind;
  /** The last room entered. */
  readonly endingRoom: string;
  /** Native `RunResultData` value; absent for an abandoned run. */
  readonly runResult?: number;
  readonly killedBy?: string;
}

export interface RunRecordLoadout {
  readonly weapon: string;
  readonly aspect?: RunRecordRankedTrait;
  readonly familiar?: RunRecordFamiliar;
  readonly keepsake?: RunRecordRankedTrait;
  readonly arcana: readonly RunRecordArcana[];
  /** Every Fear Vow rank, zero ranks included. */
  readonly vows: Readonly<Record<string, number>>;
  readonly startingGold: number;
  /**
   * Traits held at the run's first save that the fields above do not describe,
   * such as the trait Jeweled Pom or Experimental Hammer grants on equip.
   */
  readonly startingTraits: readonly RunRecordStartingTrait[];
}

export interface RunRecordStartingTrait {
  readonly name: string;
  readonly rarity?: string;
  readonly level?: number;
  /** `_worldTime` of the grant, parsed from the trait id. */
  readonly worldTime?: number;
}

export interface RunRecordRankedTrait {
  readonly name: string;
  readonly rarity?: string;
}

export interface RunRecordFamiliar {
  readonly name: string;
  /** The familiar's equipped trait and its stack level. */
  readonly trait?: string;
  readonly level?: number;
}

export interface RunRecordArcana {
  readonly name: string;
  readonly level: number;
}

/** One `RoomHistory` entry: one visit. */
export interface RunRecordRoom {
  readonly name: string;
  /** Absent on a revisit that did not collect the room's reward. */
  readonly reward?: RunRecordRoomReward;
  /** Exit doors offered on leaving, by native door id. */
  readonly doors: readonly RunRecordDoor[];
  /** Pre-generated door targets (N Hub board, N side rooms). */
  readonly predeterminedDoors?: readonly RunRecordDoorTarget[];
  /** The next visited room; absent for the last room. */
  readonly exit?: string;
  /** Encounters entered on this visit; a revisit does not re-enter a finished one. */
  readonly encounters: readonly RunRecordEncounter[];
  /** `UseRecord` counts of this visit: pickups, purchases and interactions. */
  readonly uses: Readonly<Record<string, number>>;
  /** Kills of this visit by enemy name, including summons and props. */
  readonly kills?: Readonly<Record<string, number>>;
  readonly traitScreens: readonly RunRecordTraitScreen[];
  readonly traits: RunRecordTraitChanges;
  readonly store?: RunRecordStore;
  readonly pool?: RunRecordPool;
  readonly wheels?: readonly RunRecordWheel[];
  readonly fields?: RunRecordFields;
  /** Forfeit Vow skips counted in this room. */
  readonly forfeitSkips?: number;
  readonly conversions?: RunRecordConversions;
  readonly keepsakeSwap?: RunRecordKeepsakeSwap;
  /** `NPCInteractions` counts gained in this room. */
  readonly npcInteractions?: Readonly<Record<string, number>>;
  /** Names added to `BannedTraits` in this room (Vow of Denial), in no particular order. */
  readonly bannedTraits?: readonly string[];
  /** The slotted Spell and its Path of Stars when either changed in this room. */
  readonly spell?: RunRecordSpell;
  /** Gathering tools whose element the hero gained in this room (`ToolElementsSpawned`). */
  readonly toolElements?: readonly string[];
  /**
   * Arcana cards drawn into `TemporaryMetaUpgrades` in this room (Judgment, the
   * Crystal Figurine), in grant order: each card's trait joins `Hero.Traits` as drawn.
   */
  readonly grantedArcana?: readonly string[];
  /**
   * Door, ship-wheel and Fields cage rerolls spent here: the `NumRerolls` the
   * room spent beyond its screen rerolls. A gain in the same room hides spends.
   */
  readonly rerolls?: number;
  /**
   * `SpentRerolls`: screen rerolls by the rerolled screen's id, a loot's object
   * id or a store screen's name (`WellShop`, `SellTraits`). The n-th reroll of
   * one screen costs n.
   */
  readonly spentRerolls?: Readonly<Record<string, number>>;
  /**
   * `PoseidonDoubleRewardCount` gained here: pickups Sea Star duplicated. The
   * duplicated pickups are not saved.
   */
  readonly doubleRewards?: number;
  /**
   * `OlympusEagleSpawn`: Aetos appeared in this room. The game sets it on the
   * room, so the encounter and wave it joined are not saved.
   */
  readonly olympusEagleSpawn?: true;
  /** Run state of the room's entry save, which leaving the previous room writes. */
  readonly entry?: RunRecordRoomEntry;
}

/**
 * Run state an entry save holds. A record carries it on every room or on none;
 * a zero counter or empty list is absent.
 */
export interface RunRecordRoomEntry {
  /**
   * `Hero.Traits` by name, each the first instance the game's trait queries
   * resolve, where it differs from the previous room's entry save; the first
   * room holds every trait.
   */
  readonly traits?: Readonly<Record<string, RunRecordHeldTrait>>;
  /** Names the previous room's entry save held and this one does not, sorted. */
  readonly lostTraits?: readonly string[];
  /** `Hero.SlottedTraits.Keepsake`. */
  readonly keepsake?: string;
  /** `Hero.Elements`. */
  readonly elements?: Readonly<Record<string, number>>;
  /** `Hero.MaxHealth`; absent in a record made before it was kept. */
  readonly maxHealth?: number;
  /**
   * `RewardStores` entry counts by name, for each store whose contents differ
   * from the previous room's entry save; the first room holds every store.
   */
  readonly rewardStores?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** `BannedTraits`, sorted. */
  readonly bannedTraits?: readonly string[];
  /** `MetaConversionUses`: Artificer conversions spent this run. */
  readonly metaConversionUses?: number;
  /** `WellShopPurchases` by item name. */
  readonly wellShopPurchases?: Readonly<Record<string, number>>;
  /** `BiomeBoonSkipCount`: Forfeit skips this biome. */
  readonly biomeBoonSkipCount?: number;
  /** `NumRerolls`: the run's rerolls left. */
  readonly numRerolls?: number;
  /** Invested Path of Stars nodes by `depth:slot`, sorted. */
  readonly investedTalents?: readonly string[];
}

export interface RunRecordHeldTrait {
  readonly rarity?: string;
  /** `StackNum`. */
  readonly level?: number;
  readonly remainingUses?: number;
  /** `BoonConversionUses`: the Time Piece's remaining conversions. */
  readonly boonConversionUses?: number;
  /** `RarityUpgradeData.Uses`: a Rarify source's charges left. */
  readonly rarityUpgradeUses?: number;
}

export interface RunRecordSpell {
  readonly name: string;
  /** The talent tree structure name. */
  readonly layout?: string;
  /** Talent nodes by `depth:slot` as the game numbers them: depths from 1, slots from 0. */
  readonly talents: Readonly<Record<string, RunRecordTalent>>;
}

export interface RunRecordTalent {
  readonly name: string;
  readonly invested: boolean;
}

export interface RunRecordRoomReward {
  readonly type?: string;
  readonly lootName?: string;
  readonly store?: string;
}

export interface RunRecordDoorTarget {
  readonly door: number;
  readonly room: string;
}

export interface RunRecordDoor extends RunRecordDoorTarget {
  readonly reward?: RunRecordDoorReward;
  /**
   * Fields cage reward types rolled for a door never taken, sorted; the roll
   * order and any boon's god are not saved.
   */
  readonly cageRewards?: readonly string[];
}

export interface RunRecordDoorReward {
  readonly type: string;
  readonly lootName?: string;
  /** Devotion's two gods. */
  readonly lootNames?: readonly [string, string];
}

export interface RunRecordEncounter {
  readonly name: string;
  readonly difficulty?: number;
  readonly waves?: readonly RunRecordWave[];
  readonly blacklist?: readonly string[];
  /** Fangs perks by elite enemy name. */
  readonly fangs?: Readonly<Record<string, readonly string[]>>;
  /** Fig Leaf skipped the phase's spawns (`SpawnsSkipped`). */
  readonly skipped?: true;
}

export interface RunRecordWave {
  readonly difficulty?: number;
  readonly spawns: readonly RunRecordSpawn[];
}

export interface RunRecordSpawn {
  readonly enemy: string;
  readonly count?: number;
  /** The game generated this request rather than taking it from the encounter's template. */
  readonly generated?: true;
  readonly miniBossShrine?: true;
  readonly infinite?: true;
}

export interface RunRecordTraitScreen {
  /** The loot that opened the screen, e.g. `ZeusUpgrade`, `TrialUpgrade`. */
  readonly giver: string;
  readonly options: readonly RunRecordTraitOption[];
  readonly replaced?: RunRecordRankedTrait;
}

export interface RunRecordTraitOption {
  readonly name: string;
  readonly rarity?: string;
  readonly chosen: boolean;
}

export interface RunRecordTraitChanges {
  /** Traits gained in this room, in acquisition order. */
  readonly acquired: readonly RunRecordTraitAcquisition[];
  /** Names of traits lost in this room (sold, swapped or expired). */
  readonly removed: readonly string[];
  /** Traits replaced by a higher rarity or level of the same trait, in acquisition order. */
  readonly upgraded: readonly RunRecordTraitUpgrade[];
}

export interface RunRecordTraitUpgrade {
  readonly name: string;
  readonly from: RunRecordTraitGrade;
  readonly to: RunRecordTraitGrade;
  readonly worldTime?: number;
}

export interface RunRecordTraitGrade {
  readonly rarity?: string;
  readonly level?: number;
}

export interface RunRecordTraitAcquisition {
  readonly name: string;
  readonly rarity?: string;
  readonly level?: number;
  /** `_worldTime` of the acquisition, parsed from the trait id. */
  readonly worldTime?: number;
  /** `RemainingUses` when first saved, such as a Chaos curse's duration. */
  readonly remainingUses?: number;
  /**
   * Numeric fields of the trait's first saved table that the recorder was asked
   * to keep, by dotted path (a numeric segment is a 1-based Lua array key).
   */
  readonly savedValues?: Readonly<Record<string, number>>;
  /** `UpgradedTraitName`: the trait a promoting pick such as Bridal Glow upgraded. */
  readonly upgradedTrait?: string;
}

export type RunRecordStoreKind = 'worldShop' | 'hermesShrine' | 'well';

export interface RunRecordStore {
  readonly kind: RunRecordStoreKind;
  readonly stock: readonly RunRecordStockOption[];
  /** Absent when the purchases were not observed or cannot be told apart. */
  readonly purchases?: readonly RunRecordPurchase[];
  /** Stygian Well items bought here that the opening stock did not hold (a restock), by name. */
  readonly unstockedPurchases?: readonly string[];
  /** Hermes Shrine purchase counter gained here; a rush counts twice. */
  readonly purchaseCount?: number;
  /**
   * Hermes Shrine: the Travel Deal option the room's first rush restocked into
   * the rushed slot, as left on leaving. Absent when nothing was left there.
   */
  readonly refill?: RunRecordStoreRefill;
}

export interface RunRecordStoreRefill {
  /** The restocked option, at the rushed slot it took. */
  readonly option: RunRecordStockOption;
  /** Its delayed purchase; absent when it was left unbought. */
  readonly purchase?: RunRecordPurchase;
}

export interface RunRecordStockOption {
  /** 1-based stock position. */
  readonly slot: number;
  readonly name: string;
  readonly type?: string;
  readonly lootName?: string;
  /** Unmultiplied cost where the stock carries one. */
  readonly baseCost?: number;
  /** The option carries a boosted rarity table. */
  readonly boosted?: true;
}

export interface RunRecordPurchase {
  readonly slot: number;
  /** Hermes Shrine delivery: rushed in the room, or delayed by `delay` rooms when known. */
  readonly delivery?: 'rushed' | 'delayed';
  readonly delay?: number;
}

export interface RunRecordPool {
  /** Slots still offered when the room was left. */
  readonly slots: readonly RunRecordPoolSlot[];
  readonly soldSlots: readonly number[];
  /** `TraitsSold` gained here. */
  readonly sales: number;
}

export interface RunRecordPoolSlot {
  readonly slot: number;
  readonly name: string;
  readonly rarity?: string;
  readonly value?: number;
}

export interface RunRecordWheel {
  readonly store: string;
  readonly picked: { readonly type: string; readonly lootName?: string };
  readonly offers?: 1 | 2;
  readonly side?: 'left' | 'right';
}

export interface RunRecordFields {
  readonly entryPoint?: number;
  /** `opening` when every cage's opening time is known and `cages` follows it. */
  readonly cageOrder: 'opening' | 'unknown';
  readonly cages: readonly RunRecordCage[];
  readonly optionalRewards: readonly RunRecordOptionalReward[];
}

export interface RunRecordCage {
  readonly reward: { readonly type: string; readonly lootName?: string };
  readonly encounter: RunRecordEncounter;
  readonly openedAt?: number;
  /** The enemy spawn group the game assigned to the cage's point. */
  readonly spawnPointIds?: readonly number[];
}

export interface RunRecordOptionalReward {
  readonly reward: string;
  readonly point: number;
  /**
   * Whether it was picked up after the room's combat ended; absent when either
   * end of that window was not observed. Rewards picked up during combat have no point.
   */
  readonly collected?: boolean;
}

export interface RunRecordConversions {
  /** Artificer conversions (`MetaConversionUses` gained). */
  readonly artificer?: number;
  /** Time Piece conversions (`BoonConversionUses` spent). */
  readonly timePiece?: number;
}

export interface RunRecordKeepsakeSwap {
  readonly from?: string;
  readonly to: string;
}
