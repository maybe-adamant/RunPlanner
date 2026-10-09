import type { OccurrenceAddress } from '../../authored-project/addresses';
import type { EquippedTrait } from '../../authored-project/traits/state';
import type { InRunTraitRarity, KeepsakeRank } from '../../catalog-schema';
import type { ActiveArcanaState, ArcanaRoomEntryGrowth } from '../arcana-fear';
import type { StygianWellRunState, StygianWellTimedInstance } from '../commerce/stygian-well';
import type { HexProgressState } from '../hex-progress';
import type { KeepsakeState, OlympianProviderSource } from '../keepsakes/state';
import type { MaxStatGrant } from '../max-stats';
import type { ChaosBlessingInstance, ChaosCurseInstance } from '../traits/history/model';

/** A mid-run start: a biome's Opening (Intro) or its Preboss. */
export interface StartPoint {
  readonly biomeKey: string;
  readonly kind: 'opening' | 'preboss';
}

/** The install families that must agree across every reached branch. */
export type StartInstallationFamily =
  | 'equipment'
  | 'traits'
  | 'chaos'
  | 'keepsake'
  | 'arcana'
  | 'fear'
  | 'maxStats'
  | 'stygianWell'
  | 'hermesDeliveries'
  | 'hex'
  | 'rewardPriorities'
  | 'runRecords'
  | 'biomeRecords'
  | 'counters';

export type StartInstallationUnavailableReason =
  | { readonly kind: 'notOnItinerary' }
  /** The first biome's Opening is a normal run. */
  | { readonly kind: 'routeStart' }
  /** Evaluation did not reach the start state: a blocked or unauthored predecessor. */
  | { readonly kind: 'notReached' }
  | {
      readonly kind: 'branchesDisagree';
      readonly families: readonly StartInstallationFamily[];
    };

export type StartInstallationResult =
  | { readonly availability: 'available'; readonly installation: StartInstallation }
  | { readonly availability: 'unavailable'; readonly reason: StartInstallationUnavailableReason };

export interface StartInstallationEquipment {
  readonly weaponKey: string;
  readonly aspectKey: string | null;
  /** Premium Service was acquired: the aspect is re-added at Perfect. */
  readonly aspectPerfect: boolean;
  readonly familiarKey: string | null;
  /** The familiar stack multiplier from selected traits (Circe); 1 without one. */
  readonly familiarStackMultiplier: number;
}

/** One equipped trait instance and its planner-known per-instance fields. */
export type StartInstalledTrait = Omit<
  EquippedTrait,
  'giverKey' | 'providerKind' | 'sourceRole' | 'acquisitionIdentity'
> & {
  /** The equipment slot it occupies, when it occupies one. */
  readonly slotKey?: string;
  /** Installed by native `StartNewRun` from the loadout (an aspect's starting trait). */
  readonly grantedByRunStart?: true;
};

export type StartActiveChaosCurse = Omit<
  ChaosCurseInstance,
  'acquisitionIdentity' | 'owner' | 'semanticTag'
>;

export interface StartMaturedChaosBlessing extends Omit<
  ChaosBlessingInstance,
  'acquisitionIdentity'
> {
  /** Granted by Transcendent Embryo (native `FromChaosKeepsake`). */
  readonly fromChaosKeepsake: boolean;
}

export interface StartInstallationChaos {
  readonly active: readonly StartActiveChaosCurse[];
  readonly matured: readonly StartMaturedChaosBlessing[];
}

/** One keepsake trait the hero holds. */
export interface StartHeldKeepsake {
  readonly key: string;
  /** Its trait rarity: the equip rank with Cherished Heirloom's bonus, or Common for Echo's copy. */
  readonly rank: KeepsakeRank;
  /** In the keepsake slot; otherwise a retained Permanent keepsake or Echo's copy. */
  readonly slotted: boolean;
}

export interface StartInstallationKeepsake {
  readonly currentKey: string | null;
  /** Keepsakes equipped this run, in order (rack legality, Fated status). */
  readonly usedKeys: readonly string[];
  /** Keepsakes replaced at a rack, which cannot be equipped again this run. */
  readonly removedKeys: readonly string[];
  /**
   * Every keepsake trait held: the slotted one, Permanent keepsakes a swap kept
   * (Bell, Pom, and a Calling Card or Time Piece that left with uses), and
   * Echo's Common copy once replayed. A spent Echo Figurine is gone.
   */
  readonly held: readonly StartHeldKeepsake[];
  readonly fatedStatus: KeepsakeState['fatedStatus'];
  readonly olympianSources: readonly Omit<OlympianProviderSource, 'acquisitionOrder'>[];
  readonly jeweledPom?: {
    readonly grantedTraitKey: string;
    readonly active: boolean;
    readonly levels: number;
  };
  readonly experimentalHammers: readonly {
    readonly traitKey: string;
    readonly remainingUses: number;
    readonly active: boolean;
  }[];
  readonly callingCard?: KeepsakeState['callingCard'];
  readonly timePiece?: KeepsakeState['timePiece'];
  readonly figLeafRemainingUses?: number;
  readonly gorgon?: KeepsakeState['gorgon'];
  readonly phial?: KeepsakeState['phial'];
  readonly figurine?: KeepsakeState['figurine'];
  readonly stone?: KeepsakeState['stone'];
  readonly transcendentEmbryo?: {
    readonly origin: 'ordinary' | 'echo';
    readonly rarity: InRunTraitRarity;
    readonly progress: number;
    readonly markedBlessingKey: string;
    readonly markedBlessingValues: Readonly<Record<string, number>>;
  };
  readonly discordantBell?: KeepsakeState['discordantBell'];
  readonly lionFang?: KeepsakeState['lionFang'];
  readonly maxHealthCap?: KeepsakeState['maxHealthCap'];
}

export interface StartInstallationArcana {
  /** Active cards at their current rarity, Lapis promotion and temporary activation included. */
  readonly active: readonly ActiveArcanaState[];
  /** Room-entry stat cycles (The Centaur's tick), by card key. */
  readonly roomEntryGrowth: Readonly<Record<string, ArcanaRoomEntryGrowth>>;
  readonly artificer?: { readonly usedCount: number; readonly remainingCount: number };
  /** A Barren curse holds the Arcana unequipped. */
  readonly barrenActive: boolean;
}

export interface StartInstallationFear {
  readonly configuredRanks: Readonly<Record<string, number>>;
  /** Vows Circe disabled. */
  readonly disabledVowKeys: readonly string[];
  readonly effectiveRanks: Readonly<Record<string, number>>;
}

/** Well holdings without their planner provenance. */
export type StartStygianWell = Omit<StygianWellRunState, 'timedInstances'> & {
  readonly timedInstances: readonly Omit<StygianWellTimedInstance, 'source'>[];
};

export interface StartHermesDelivery {
  readonly entryKey: string;
  readonly rewardType: string;
  readonly rushed: boolean;
  /** Encounters left before the order falls due. */
  readonly remainingUses: number;
}

export type StartInstallationHex = Pick<
  HexProgressState,
  'tree' | 'spellTraitKey' | 'godSentAdded' | 'talentDropsClosed' | 'investedNodeKeys'
> & {
  /** Unspent talent points. */
  readonly talentPoints: number;
};

/** Run-wide reward records (`UseRecord`, `LootTypeHistory`, `ConsumableRecord`). */
export interface StartRunRecords {
  readonly useRecord: Readonly<Record<string, number>>;
  readonly lootTypeHistory: Readonly<Record<string, number>>;
  readonly consumableRecord: Readonly<Record<string, number>>;
}

/** Biome-local records: after the native biome-start reset at an Opening, current at a Preboss. */
export interface StartBiomeRecords {
  readonly form: 'postReset' | 'current';
  readonly biomeUseRecord: Readonly<Record<string, number>>;
  readonly lootBiomeRecord: Readonly<Record<string, number>>;
  readonly forfeitConsumed: boolean;
  readonly figLeafActivatedThisBiome: boolean;
}

export interface StartInstallationCounters {
  readonly roomHistoryOrdinal: number;
  readonly runDepthCache: number;
  readonly routeEncounterDepth: number;
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly lastDevotionDepth?: number;
  /** I's Clockwork counters, at an I Preboss. */
  readonly clockwork?: {
    readonly goalsRemaining: number;
    readonly nonGoalRewardsAcquired: number;
    readonly maxNonGoalRewards: number;
  };
}

export interface StartRewardStore {
  readonly storeKey: string;
  readonly remainingEntryCounts: readonly number[];
}

/**
 * A Preboss's stores already include its own creation; an Opening's are its
 * predecessor's, before the start room is created.
 */
export interface StartRewardStores {
  /** Stores exact across every branch; untouched stores stay native-fresh. */
  readonly stores: readonly StartRewardStore[];
  /** Stores that differ by branch, left for the game to build fresh. */
  readonly omittedStoreKeys: readonly string[];
}

export interface StartMaxStats {
  readonly maxHealth: number;
  readonly maxMana: number;
  /**
   * Recorded grants no installed trait re-creates. The slotted keepsake's own
   * max-Magick grant is left out: its equip re-creates it.
   */
  readonly grants: readonly MaxStatGrant[];
}

/** One stub native `RoomHistory` record per planned room departure. */
export interface StartRoomHistoryRecord {
  readonly gameName: string;
  /** The room's native RoomData `NextRoomSet`, where native biome depth counts from. */
  readonly nextRoomSet: boolean;
}

/**
 * The start biome is excluded for an Opening, whose native Intro enters it,
 * and included for a Preboss, which is already inside it.
 */
export interface StartInstallationRoute {
  readonly routeKey: string;
  /** Native `EnteredBiomes`. */
  readonly enteredBiomes: number;
  /** Itinerary biomes already entered, in order (native `BiomeVisitOrder`, Dream's visited prefix). */
  readonly visitedBiomeKeys: readonly string[];
}

/**
 * The planner's exact state at a mid-run start, in the terms the game installs
 * it. Unordered collections are sorted; chronological ones keep their order.
 */
export interface StartInstallation {
  readonly startPoint: StartPoint;
  /** The Preboss whose received state is installed; an Opening installs its predecessor's terminal state. */
  readonly startOccurrence?: OccurrenceAddress;
  readonly startRoomGameName: string;
  readonly route: StartInstallationRoute;
  readonly roomHistory: readonly StartRoomHistoryRecord[];
  readonly counters: StartInstallationCounters;
  readonly equipment: StartInstallationEquipment;
  readonly traits: readonly StartInstalledTrait[];
  readonly chaos: StartInstallationChaos;
  readonly keepsake: StartInstallationKeepsake;
  readonly arcana: StartInstallationArcana;
  readonly fear: StartInstallationFear;
  readonly maxStats: StartMaxStats;
  readonly stygianWell: StartStygianWell;
  readonly hermesDeliveries: readonly StartHermesDelivery[];
  readonly hex: StartInstallationHex;
  readonly rewardPriorities: readonly string[];
  readonly runRecords: StartRunRecords;
  readonly biomeRecords: StartBiomeRecords;
  readonly rewardStores: StartRewardStores;
}
