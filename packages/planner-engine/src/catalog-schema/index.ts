import type {
  CountedRewardBinding,
  EnteredRewardStoreHistoryPolicy,
  RewardProducerBinding,
} from '../reward-kernel/bindings';
import type { RewardKernelCatalog } from '../reward-kernel/model';
import type { CounterAxis, RequirementExpression, RoomStructuralTag } from '../requirements/model';
import type { ProducerLifecyclePointKey } from '../reward-kernel/model';
import type { CatalogCollection } from '../normalized/collection';
import type {
  EnemyGoldDrop,
  GeneratedEncounterSelection,
  InfiniteRosterSelection,
} from './encounter-generation';
export type {
  EncounterEnemyChoice,
  EnemyGoldDrop,
  GeneratedEncounterSelection,
  InfiniteRosterEnemyChoice,
  InfiniteRosterSelection,
} from './encounter-generation';

export type {
  AspectDeclaration,
  BoonRarityOverride,
  BoonRarityRollOrder,
  BoonRarityValues,
  BoonReplacementDeclaration,
  HammerCompatibility,
  TraitCatalog,
  ChaosTraitCatalog,
  ChaosCurseDeclaration,
  ChaosBlessingDeclaration,
  ChaosMaxStatOperand,
  ChaosNumericOperand,
  ChaosOperandSaveField,
  ChaosOfferRequirement,
  TraitDeclaration,
  TraitElement,
  EchoLastRunBoonCatalog,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
  TraitEquipmentSlot,
  TraitOrdinaryBoonSlot,
  TraitRarity,
  InRunTraitRarity,
  TraitMaxStatEffect,
  TraitMaxStatValue,
  TraitRequirementExpression,
  ProperUpbringingEffect,
  TargetedTraitAcquisition,
  TraitSelectedDisposition,
  TraitAcquisitionOrdinalValues,
  TraitGoldEffect,
  ResolvedTraitAcquisitionOrdinalEffect,
  DirectTraitSetKey,
  HexDeclaration,
  HexGodSentDeclaration,
  HexLayoutDeclaration,
  HexLayoutNodeDeclaration,
  HexNodeKind,
  HexRepeatableTalentDeclaration,
  HexLayoutKey,
  HexTalentCandidateDeclaration,
  WeaponDeclaration,
} from './traits';
export {
  BASE_TRAIT_ELEMENTS,
  highestBaseElementCount,
  concaveStoneProcGiver,
  resolveTraitAcquisitionOrdinalEffect,
} from './traits';
export { nativeExitDoorOrder, type OpenExitDoor } from './exit-door-order';
import type {
  AspectDeclaration,
  TraitDeclaration,
  TraitElement,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
  InRunTraitRarity,
  MaxStatKey,
  WeaponDeclaration,
} from './traits';

export type { CatalogCollection } from '../normalized/collection';
export type { RoomStructuralTag } from '../requirements/model';

export interface BiomeDeclaration {
  readonly key: string;
  readonly label: string;
  /** Native room MinDepthBeforeIntros: below this biome depth generation admits only introduced enemies. */
  readonly minDepthBeforeIntros: number;
}

/** Native Dream-route choice facts. The engine applies the public itinerary policy. */
interface DreamItineraryDeclaration {
  readonly biomeCount: number;
  readonly initialBiomeKeys: readonly string[];
  readonly laterAdditionalBiomeKeys: readonly string[];
  /** A later choice cannot be this immediate native successor. */
  readonly naturalSuccessorByBiomeKey: Readonly<Record<string, string>>;
}

export interface RouteDeclaration {
  readonly key: string;
  readonly label: string;
  readonly biomeKeys: readonly string[];
  /** Route-owned fixed completion identities, resolved by biome and itinerary ordinal. */
  readonly completion: {
    /** The sole route-selected Preboss map for each supported biome identity. */
    readonly prebossRoomGameNameByBiomeKey: Readonly<Record<string, string>>;
    /** Exact Postboss room for each route ordinal; the terminal position is null. */
    readonly postbossRoomGameNamesByOrdinal: readonly (string | null)[];
  };
  /** Present only for the native Dream route, whose itinerary is authored at project creation. */
  readonly dreamItinerary?: DreamItineraryDeclaration;
  /** The save profile the route's run starts from. */
  readonly initialProfile: RouteInitialProfileDeclaration;
}

/**
 * A mature save supplies authored equipment and progression. A brand-new
 * profile's first attempt starts with the aspectless Staff, no keepsake,
 * Arcana or Fear, from one fixed opening that rolls the run-start reward
 * without spawning it.
 */
export type RouteInitialProfileDeclaration =
  | { readonly kind: 'matureSave' }
  | {
      readonly kind: 'freshFile';
      readonly fixedWeaponKey: string;
      readonly openingRoomGameName: string;
      /**
       * The opening draws the run-start reward's type from its counted store
       * and records that store on entry, but nothing is offered or acquired.
       */
      readonly runStartReward: 'unspawnedRoll';
    };

/** The one declaration-owned reward domain offered before a route chooses an entry room. */
interface RunStartRewardDeclaration {
  readonly incomingReward: CountedRewardBinding;
}

export type ArcanaActivationRule =
  | { readonly kind: 'adjacentActive' }
  | { readonly kind: 'manualCostsOneThroughFive' }
  | { readonly kind: 'manualCostMultiplicityAtMost'; readonly maximum: number }
  | { readonly kind: 'surroundingCellsActive' }
  | { readonly kind: 'completeOtherRowOrColumn' }
  | { readonly kind: 'manualCardCount'; readonly minimum: number; readonly maximum: number };

export interface ArcanaCardDeclaration {
  readonly key: string;
  readonly label: string;
  readonly traitKey: string;
  readonly row: number;
  readonly column: number;
  readonly graspCost: number;
  readonly activation:
    | { readonly kind: 'manual' }
    | { readonly kind: 'automatic'; readonly rule: ArcanaActivationRule };
  readonly permanentRank: 3;
  /** Source-declared Fated incompatibility, consumed by Arcana candidate authority. */
  readonly fatedIncompatible: boolean;
  /** Native companions consulted against the progressively equipped random-draw state. */
  readonly randomDrawRequiredCardKeys: readonly string[];
  /** Judgment's rank-scaled post-Boss activation counts. */
  readonly postBossActivationCounts?: Readonly<{
    readonly Common: number;
    readonly Rare: number;
    readonly Epic: number;
    readonly Heroic: number;
  }>;
  /** The Artificer's exact run-local capacity; absent from every other card. */
  readonly artificerCapacityByRarity?: Readonly<{
    readonly Common: number;
    readonly Rare: number;
    readonly Epic: number;
    readonly Heroic: number;
  }>;
  readonly boonRarityContributions?: Readonly<
    Record<'Common' | 'Rare' | 'Epic' | 'Heroic', import('./traits').BoonRarityContribution>
  >;
  /** The Centaur's room-entry cycle: every `interval` entered rooms grants max health and Magick. */
  readonly roomEntryStatGrowth?: {
    readonly interval: number;
    readonly maxHealthByRarity: Readonly<Record<InRunTraitRarity, number>>;
    readonly maxManaByRarity: Readonly<Record<InRunTraitRarity, number>>;
  };
  /** Source `BonusMoney`: gold the card pays, unmultiplied, when it becomes active, by its rarity. */
  readonly startingGoldByRarity?: Readonly<Record<InRunTraitRarity, number>>;
  /** Flat `PropertyChanges` maxima while the card is active, by its rarity. */
  readonly maxStatBonus?: {
    readonly maxHealthByRarity: Readonly<Record<InRunTraitRarity, number>>;
    readonly maxManaByRarity: Readonly<Record<InRunTraitRarity, number>>;
  };
  /** Source `RerollCount`, added to the run's reroll pool, and the reroll kind holding the card enables. */
  readonly rerolls?: ArcanaRerollGrant;
}

/**
 * `doors`: `AllowDoorReroll` (exit doors, Hub board doors, ship wheels and
 * Fields cages); `screens`: the offer-screen reroll button; `poolOnly`: neither.
 * Barren's Arcana suspension removes the enabling card, not its pool grant.
 */
export type ArcanaRerollKind = 'doors' | 'screens' | 'poolOnly';

export interface ArcanaRerollGrant {
  readonly countByRarity: Readonly<Record<InRunTraitRarity, number>>;
  readonly enables: ArcanaRerollKind;
}

export interface FearVowDeclaration {
  readonly key: string;
  readonly label: string;
  readonly incrementalFear: readonly number[];
  readonly circeRemovable: boolean;
  readonly effect?:
    | { readonly kind: 'banUnselectedTraits'; readonly count: 2 }
    | {
        readonly kind: 'substituteRoomReward';
        readonly maximumPerBiome: 1;
        readonly qualifyingRewardTypes: readonly ['Boon', 'HermesUpgrade'];
        readonly replacementRewardType: 'RoomRewardConsolationPrize';
      }
    | {
        readonly kind: 'limitStartingGrasp';
        readonly baseCapacity: 30;
        readonly availablePercentByRank: readonly [60, 40, 20, 0];
      }
    | {
        /** Per-rank chance that each eligible source spawn request becomes a next-biome enemy. */
        readonly kind: 'substituteNextBiomeEnemy';
        readonly chanceByRank: readonly number[];
      }
    | {
        /** Per-rank multiplier on every shop price. */
        readonly kind: 'shopPriceMultiplier';
        readonly multiplierByRank: readonly number[];
      };
}

export type KeepsakeRank = 'Common' | 'Rare' | 'Epic' | 'Heroic';

export type KeepsakeRankProfile<
  Common extends number,
  Rare extends number,
  Epic extends number,
  Heroic extends number,
> = Readonly<{
  readonly Common: Common;
  readonly Rare: Rare;
  readonly Epic: Epic;
  readonly Heroic: Heroic;
}>;

/** A familiar the profile equips at run start. */
export interface FamiliarDeclaration {
  readonly key: string;
  readonly label: string;
  /** Familiar-shop levels of each upgraded trait, all owned on a mature save; each adds one stack. */
  readonly matureTraitUpgradeCount: number;
  /** The flat maximum its first trait adds per stack, when that trait changes one. */
  readonly maxStatPerStack?: {
    readonly stat: MaxStatKey;
    readonly amount: number;
  };
}

/** A rank-III ordinary keepsake. Effects are deliberately introduced by their owning gates. */
export interface KeepsakeDeclaration {
  readonly key: string;
  readonly label: string;
  readonly rank: 'Epic';
  readonly fatedDisposition: 'neutral' | 'enabling' | 'opposing';
  /** Source `BonusMoney`: gold paid when the keepsake is equipped, by its rank. */
  readonly goldByRank?: KeepsakeRankProfile<number, number, number, number>;
  /** Closed planner disposition for Echo's captured-keepsake replay. */
  readonly echoGift:
    | { readonly availability: 'excluded' }
    | {
        readonly availability: 'eligible';
        readonly effect:
          | { readonly kind: 'figLeaf'; readonly schedule: 'oneShot' }
          | { readonly kind: 'experimentalHammer'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'crystalFigurine'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'concaveStone'; readonly schedule: 'oneShot' }
          | { readonly kind: 'transcendentEmbryo'; readonly schedule: 'oneShot' }
          | { readonly kind: 'callingCard'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'timePiece'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'olympianRewardPressure'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'moonBeam'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'lionFang'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'silkenSash'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'maxManaGrant'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'maxHealthCap'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'modeledNeutral'; readonly schedule: 'noModeledEffect' };
      };
  /** Closed, source-backed rank data consumed by supported effect transitions. */
  readonly effect?:
    | {
        readonly kind: 'jeweledPom';
        readonly giverKey: string;
        readonly subsequentEligibleTraitLevelsByRank: KeepsakeRankProfile<
          number,
          number,
          number,
          number
        >;
      }
    | {
        readonly kind: 'experimentalHammer';
        readonly giverKey: string;
        readonly qualifyingEncounterUsesByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'callingCard';
        readonly rarificationChargesByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'timePiece';
        readonly conversionChargesByRank: KeepsakeRankProfile<number, number, number, number>;
        /** Gold added to a converted reward spawned with a boosted rarity table. */
        readonly boostedConversionBonus: number;
      }
    | {
        readonly kind: 'figLeaf';
        readonly biomeUsesByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'gorgonAmulet';
        readonly uses: 1;
        readonly minimumBiomeDepth: number;
        readonly providerKey: string;
        readonly rarityLevelByRank: KeepsakeRankProfile<
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4
        >;
        readonly naturalEncounterKey: string;
      }
    | {
        readonly kind: 'fountainRarity';
        readonly uses: 1;
        readonly targetRarityLevelByRank: Readonly<{
          readonly Common: 1 | 2 | 3 | 4;
          readonly Rare: 1 | 2 | 3 | 4;
          readonly Epic: 1 | 2 | 3 | 4;
        }>;
        readonly sourceMaxRarityLevel: 1;
      }
    | {
        readonly kind: 'crystalFigurine';
        readonly uses: 1;
        readonly requestedCards: number;
        readonly rarityLevelByRank: KeepsakeRankProfile<
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4
        >;
      }
    | {
        readonly kind: 'concaveStone';
        readonly uses: 1;
        readonly procSupportByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'transcendentEmbryo';
        readonly source: 'Chaos';
        readonly interval: 8;
        readonly blessingRarityByRank: Readonly<Record<KeepsakeRank, InRunTraitRarity>>;
      }
    | {
        /** The nine provider keepsakes share one exact reward-pressure contract. */
        readonly kind: 'olympianRewardPressure';
        readonly priorityRewardType: string;
        readonly providerKey: string;
        readonly providerForceUses: 1;
        readonly providerRarificationUses: 1;
        /** These declarations intentionally have no Heroic source row. */
        readonly maximumSourceRarityLevelByRank: Readonly<{
          Common: 1 | 2 | 3;
          Rare: 1 | 2 | 3;
          Epic: 1 | 2 | 3;
        }>;
      }
    | {
        readonly kind: 'moonBeam';
        readonly pathPointsByRank: KeepsakeRankProfile<number, number, number, number>;
        readonly priorityRewardTypes: readonly [string, string, string];
      }
    | {
        /** Damage dealt and taken multiplier, growing at each qualifying encounter end. */
        readonly kind: 'discordantBell';
        readonly initialMultiplier: number;
        readonly growthPerEncounterByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        /** Damage multiplier set on equip, decaying at each qualifying encounter end until spent. */
        readonly kind: 'lionFang';
        readonly initialMultiplierByRank: KeepsakeRankProfile<number, number, number, number>;
        readonly decayPerEncounter: number;
        readonly expiredMultiplier: number;
      }
    | {
        /** Armor set on equip, gained again on each door into a first-visit room. */
        readonly kind: 'silkenSash';
        readonly baseArmor: number;
        readonly doorArmorByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        /** Each equip sets one permanent source-marked max-Magick bonus to its rank's amount. */
        readonly kind: 'maxManaGrant';
        readonly maxManaByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        /** Fixes max health while active; the first Boss cleared while active expires it. */
        readonly kind: 'maxHealthCap';
        readonly maxHealth: number;
      };
}

export type EncounterPhaseKind = 'boss' | 'combat' | 'miniboss' | 'nonCombat' | 'story';

/**
 * Only these phase kinds create a player-facing combat interval. Story and
 * other noncombat encounters still retain their game encounter identity for
 * history and provider ownership, but never expose Start/End encounter UI.
 */
export function isCombatBearingEncounterPhaseKind(
  kind: EncounterPhaseKind,
): kind is 'boss' | 'combat' | 'miniboss' {
  return kind === 'boss' || kind === 'combat' || kind === 'miniboss';
}

/**
 * The envelope declares that a slot is potentially present. The owning room
 * template evaluates its current structural activation from authored state;
 * lifecycle execution never uses this disposition as a second evaluator.
 */
export type EncounterSlotActivation = 'always' | 'templateControlled';

export interface EncounterRewardWheelAttachment {
  readonly kind: 'rewardWheel';
  readonly key: string;
  readonly reward: CountedRewardBinding;
  readonly defaultStoreKey: string;
  readonly offerKeys: readonly string[];
  readonly offerCount: {
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
  };
  readonly picked: 'exactlyOne';
}

/** A Fields-style local reward owned by an exact local-child slot. */
interface EncounterLocalRewardAttachment {
  readonly kind: 'localReward';
  readonly groupKey: string;
  readonly slotKey: string;
}

export type EncounterSlotRewardAttachment =
  EncounterLocalRewardAttachment | EncounterRewardWheelAttachment;

/** A stable authored position in a room-local encounter envelope. */
export interface EncounterEnvelopeSlot {
  readonly key: string;
  readonly activation: EncounterSlotActivation;
  /**
   * A structural gate for a template-controlled potential slot. It is read
   * from the predecessor preparation checkpoint, before any phase in this
   * room can start or advance encounter counters.
   */
  readonly activationRequirement?: RequirementExpression;
  readonly rewardAttachment?: EncounterSlotRewardAttachment;
  /**
   * The slot whose encounter's money store this slot's kills drain. Native
   * pays kill gold from the room's own encounter, and a slot started beside it
   * (a Fields cage) never becomes that encounter; absent, a phase drains its own.
   */
  readonly moneyStoreSlotKey?: string;
}

/**
 * Reusable room-local encounter topology. It owns neither selected identity,
 * requirement policy, effective kind, nor counter effects.
 */
export interface EncounterEnvelope {
  readonly key: string;
  readonly slots: readonly EncounterEnvelopeSlot[];
}

export type NpcShoppingFamily = 'Nemesis' | 'Heracles';

/** Native named requirement consumed when this encounter is prepared. */
export interface NpcShoppingProtection {
  readonly family: NpcShoppingFamily;
  readonly roomWindow: number;
}

/** One concrete normalized game encounter selected by a fixed or pool slot. */
/** Native `MoneyDropCapMin`, `MoneyDropCapMax` and `MoneyDropCapDepthRamp`. */
export interface EncounterMoneyStore {
  readonly capMin: number;
  readonly capMax: number;
  /** Gold added per run depth before the money multiplier. */
  readonly runDepthRamp: number;
  /**
   * A store set in the encounter's data rather than drawn at the door: the
   * value is `capMin`, with no ramp and no money multiplier.
   */
  readonly undrawn?: true;
}

export interface EncounterDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  /** Exact encounter-level policy for advancing delayed Hermes Shrine delivery uses. */
  readonly advancesHermesShrineDeliveryUses: boolean;
  /** Source-declared positive Fig Leaf support for this exact encounter. */
  readonly canEncounterSkip: boolean;
  /** Source-declared room-wide blocker carried by this encounter. */
  readonly blocksFigLeaf: boolean;
  /** Source-declared active-encounter blocker for Gorgon Amulet. */
  readonly blocksGorgon: boolean;
  readonly hostsGorgon: boolean;
  /** Native Aetos callback support; waves are best-effort native targets. */
  readonly aetosWaves?: readonly number[];
  /** A successful skip suppresses the remainder of this room envelope. */
  readonly skipEndEncounterEffects: boolean;
  /** Keepsakes whose ordinary rack selection is unavailable after this encounter. */
  readonly blocksKeepsakeSelectionKeys?: readonly string[];
  readonly requirements?: RequirementExpression;
  /**
   * Native reaches this identity only by replacing a drawn encounter whose spawns
   * include an enemy it introduces (RunLogic SetupEncounter). As an authored
   * member it is eligible only where its gate passes and a trigger enemy is admissible.
   */
  readonly enemyTriggeredIntroduction?: true;
  readonly sequenceEffect?: { readonly kind: 'terminateSuffix' };
  /** Presentation-only grouping for the later read-only NPC route index. */
  readonly npcPresentationKey?: string;
  readonly npcShoppingProtection?: NpcShoppingProtection;
  /** This encounter inherits the native Shop NPC shopping start callbacks. */
  readonly hostsNpcShoppingEvents?: boolean;
  /** Explicit declaration-owned producer for an encounter-local trait offer. */
  readonly traitOfferProducer?: {
    readonly kind: 'traitOffer';
    readonly giverKey: string;
  };
  readonly requiresInteraction?: boolean;
  readonly suppressesIncomingReward?: boolean;
  /** The encounter spawns the room reward before its combat rather than after it. */
  readonly createsIncomingRewardAtStart?: boolean;
  /**
   * A kill-contest bet on the encounter's end: the bet is the held gold up to
   * `maxBet`; a win pays it times the money multiplier, a loss takes it.
   */
  readonly goldBet?: { readonly maxBet: number };
  /**
   * Native money store: generation draws `MoneyDropCapMin..Max` plus
   * `MoneyDropCapDepthRamp` × run depth, times the money multiplier, and enemy
   * kill drops pay from it. Absent where native does not generate the encounter.
   */
  readonly moneyStore?: EncounterMoneyStore;
  /** Heracles marks enemies whose kill the player is credited for, paid as one pickup. */
  readonly killBounty?: {
    readonly goldPerMark: number;
    readonly marksPerWave: { readonly min: number; readonly max: number };
    readonly waves: number;
  };
  readonly nemesisRandomEvent?: {
    readonly freeItem: {
      readonly resultRewardTypes: readonly [
        'EmptyMaxHealthDrop',
        'HealDrop',
        'LastStandDrop',
        'ArmorBoost',
      ];
      readonly conditionalResultRewardType: 'LastStandDrop';
      readonly response: 'none';
      readonly pickupRequired: false;
    };
    readonly goldTrade: {
      readonly variants: readonly {
        readonly rewardType: string;
        readonly enteredBiome: { readonly min?: number; readonly max?: number };
        readonly requirement: 'none' | 'pomLegal' | 'hammerEarlyOrLate';
        /** Gold paid on accept, an integer drawn evenly from `min..max`. */
        readonly goldCost: { readonly min: number; readonly max: number };
      }[];
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
    };
    readonly damageTrade: {
      readonly variants: readonly {
        readonly rewardType: string;
        readonly enteredBiome: { readonly min?: number; readonly max?: number };
        readonly requirement: 'none' | 'pomLegal' | 'talentLegal';
      }[];
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
    };
    readonly traitTrade: {
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
      readonly fixedResultRewardType: 'RoomMoneyTripleDrop';
      readonly traitSelection: 'eligibleGodTraitCommonPriority';
    };
    readonly damageContest: {
      readonly successResultRewardTypes: readonly [
        'MaxHealthDrop',
        'MaxManaDrop',
        'StackUpgrade',
        'RoomMoneyDrop',
        'TalentDrop',
      ];
      readonly failureResultRewardType: 'RoomRewardConsolationPrize';
      readonly response: 'none';
      /** Only LootData results drop through `CreateLoot`, which gates the exit. */
      readonly requiredResultRewardTypes: readonly ['StackUpgrade'];
    };
    readonly hOptionalCapacityReservation: 1;
  };
  /** Closed native encounter-customization domain for this concrete encounter. */
  readonly customization?: readonly EncounterCustomizationDecision[];
  /** Native SpawnWaves of an all-fixed combat identity, in wave order. */
  readonly fixedRoster?: readonly (readonly EncounterFixedSpawn[])[];
  /**
   * A miniboss or boss encounter's own enemies, the boss among them: its
   * spawn waves and pre-placed units in native order, weapon-spawned adds
   * excluded. Each of `choices` is one random pick of spawns by weight, fielded
   * after the waves; `wipedByEnemyKey` names the enemy whose death kills every
   * other enemy without loot (`WipeEnemiesOnKill`).
   */
  readonly bossRoster?: {
    readonly waves: readonly (readonly BossRosterSpawn[])[];
    readonly choices?: readonly (readonly {
      readonly weight: number;
      readonly spawns: readonly BossRosterSpawn[];
    }[])[];
    readonly wipedByEnemyKey?: string;
  };
}

/** One spawn of a boss roster; `hatched` spawns from an egg the player may kill first. */
export interface BossRosterSpawn {
  readonly enemyKey: string;
  readonly count: number;
  readonly hatched?: true;
}

/** One declaration-owned fixed spawn with its native count. */
interface EncounterFixedSpawn {
  readonly enemyKey: string;
  readonly label: string;
  readonly count: number;
}

interface EncounterCustomizationChoice {
  readonly key: string;
  readonly label: string;
  readonly nativeId: string;
  /** Routes whose save profile can never produce this native result. */
  readonly excludedRouteKeys?: readonly string[];
}

export type EncounterCustomizationDecision =
  | {
      readonly key: string;
      readonly label: string;
      readonly selection: GeneratedEncounterSelection;
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly selection: {
        readonly kind: 'single';
        readonly choices: readonly EncounterCustomizationChoice[];
      };
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly selection: {
        readonly kind: 'orderedPrefix';
        readonly choices: readonly EncounterCustomizationChoice[];
        readonly maximumLength: 2;
      };
    }
  | {
      readonly key: string;
      readonly label: string;
      /** Native inclusive cocoon-count draw bounds for combat setup. */
      readonly selection: {
        readonly kind: 'cocoonCount';
        readonly minimum: number;
        readonly maximum: number;
      };
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly selection: InfiniteRosterSelection;
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly selection: { readonly kind: 'cocoonRewardPoint' };
    };

/** Closed concrete identity mapping for one persisted authored encounter choice. */
type EncounterChoiceResolution =
  | { readonly kind: 'direct'; readonly encounterDefinitionKey: string }
  | {
      readonly kind: 'rewardContext';
      /**
       * Overrides reward resolution at reached biome encounter depth one until
       * that identity has occurred on the route. For an intro this mirrors
       * native AlwaysForce-until-completed; the mature Chronos intro is natively
       * forced at depth one once ClockworkIntro is completed, equivalent within
       * one route.
       */
      readonly firstBiomeEncounterDefinitionKey?: string;
      /** Route-specific first-biome identity; it replaces the default on that route. */
      readonly firstBiomeEncounterDefinitionKeyByRoute?: Readonly<Record<string, string>>;
      readonly defaultEncounterDefinitionKey: string;
      readonly encounterDefinitionKeyByRewardType: Readonly<Record<string, string>>;
    };

/** One persisted friendly encounter choice and its closed concrete mapping. */
export interface EncounterAuthoringProfile {
  readonly key: string;
  readonly label: string;
  /** Declaration-invariant structural phase kind, never a guessed identity. */
  readonly kind: EncounterPhaseKind;
  readonly encounterDefinitionKeys: readonly string[];
  readonly resolution: EncounterChoiceResolution;
  /** The only routes whose save profile can offer this choice; absent means every route. */
  readonly routeKeys?: readonly string[];
}

/** Exact game support plus the smaller authored choice domain for one selectable slot. */
export interface EncounterSet {
  readonly key: string;
  readonly encounterDefinitionKeys: readonly string[];
  readonly defaultAuthoringProfileKey: string;
  readonly authoringProfiles: readonly EncounterAuthoringProfile[];
}

/** Complete room-declaration binding for one stable envelope slot. */
export type EncounterSlotBinding =
  | {
      readonly slotKey: string;
      readonly kind: 'set';
      readonly encounterSetKey: string;
    }
  | {
      readonly slotKey: string;
      readonly kind: 'fixed';
      readonly encounterDefinitionKey: string;
      readonly rivalsEncounterDefinitionKey?: string;
      readonly shadowEncounterDefinitionKey?: string;
    };

export type RoomLifecycleEffectKind =
  | 'advanceEncounterDepth'
  | 'advanceRoomCounters'
  | 'recordAppearance'
  | 'recordCommit'
  | 'recordEncounter'
  | 'recordEncounterCompletion'
  | 'recordEncounterStart'
  | 'recordEnteredRewardStore'
  | 'recordExit'
  | 'recordOfferPoint'
  | 'recordPhaseOfferPoint'
  | 'recordOutgoingGeneration'
  | 'recordPreparation'
  | 'recordProducerPoint'
  | 'recordRequiredObjectCompletions'
  | 'recordRequiredObjectSpawns'
  | 'recordAcquisitionPoint';

interface OnlyEncounterSlotSelector {
  readonly kind: 'only';
}

type EncounterSlotSelector = OnlyEncounterSlotSelector;

interface RoomLifecycleOperationBase {
  readonly effects: readonly RoomLifecycleEffectKind[];
}

export type RoomLifecycleOperation =
  | (RoomLifecycleOperationBase & { readonly kind: 'prepareRoom' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'materializeOfferPoint';
      readonly offerPoint: string;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'enterRoom' })
  | (RoomLifecycleOperationBase & { readonly kind: 'spawnRequiredObjects' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'startEncounter';
      readonly encounter: EncounterSlotSelector;
    })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'completeEncounter';
      readonly encounter: EncounterSlotSelector;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'completeRequiredObjects' })
  | (RoomLifecycleOperationBase & { readonly kind: 'runEncounterSequence' })
  | (RoomLifecycleOperationBase & { readonly kind: 'runRewardEncounterSequence' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'advanceProducer';
      readonly point: ProducerLifecyclePointKey;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'generateOutgoingBatch' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'settleAcquisitionPoint';
      readonly point: string;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'commitRoom' })
  | (RoomLifecycleOperationBase & { readonly kind: 'exitRoom' });

export type RoomLifecycleProducerPolicy =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'required';
      readonly lifecycleProfileKeys: readonly string[];
    };

export interface RoomLifecycleProfile {
  readonly key: string;
  readonly encounterEnvelopeKeys: readonly string[];
  readonly producer: RoomLifecycleProducerPolicy;
  readonly operations: readonly RoomLifecycleOperation[];
}

export type RoomKind =
  | 'Boss'
  | 'Combat'
  | 'Devotion'
  | 'Hub'
  | 'Intro'
  | 'Miniboss'
  | 'Opening'
  | 'PreHub'
  | 'PostBoss'
  | 'Preboss'
  | 'Reprieve'
  | 'Shop'
  | 'Story';

export type RoomTemplateKey =
  | 'Anomaly'
  | 'Boss'
  | 'Chaos'
  | 'ContractBoss'
  | 'Devotion'
  | 'EphyraCombat'
  | 'EphyraSideRoom'
  | 'FixedIntro'
  | 'FixedOpening'
  | 'FixedPreHub'
  | 'FieldsCombat'
  | 'ClockworkCombat'
  | 'Fountain'
  | 'Miniboss'
  | 'Preboss'
  | 'PostBoss'
  | 'RewardlessCombat'
  | 'Shop'
  | 'ShipCombat'
  | 'StandardCombat'
  | 'Story';

type DerivedRoomClassification = 'hub';

export type RoomMode =
  | { readonly kind: 'authored'; readonly templateKey: RoomTemplateKey }
  | { readonly kind: 'derived'; readonly classification: DerivedRoomClassification };

export type ExitCompatibilityPolicy =
  | { readonly key: string; readonly kind: 'unconstrained' }
  | {
      readonly key: string;
      readonly kind: 'targetHasTag';
      readonly targetTag: RoomStructuralTag;
    }
  | {
      readonly key: string;
      readonly kind: 'sourceTagRequiresTargetTag';
      readonly sourceTag: RoomStructuralTag;
      readonly targetTag: RoomStructuralTag;
    };

/** A map exit door: its ObjectId and the obstacle name the native door sort compares. */
export interface ExitDoorSetup {
  readonly doorId: number;
  readonly obstacleName: string;
}

export interface ExitTypeDeclaration {
  readonly key: string;
  readonly compatibilityPolicyKey: string;
  readonly behavior: ExitBehavior;
  /** Native door `AllowReroll`; the destination's `ForceDoorAllowReroll` can still grant it. */
  readonly allowReroll: boolean;
  /** The obstacle name of a door of this type spawned at runtime rather than placed on the map. */
  readonly spawnedObstacleName?: string;
}

export type ExitBehavior =
  | {
      readonly kind: 'playerSelected';
      readonly rewardPreview: 'visible' | 'hidden';
    }
  | {
      readonly kind: 'automaticHostContinuation';
      readonly rewardPreview: 'hidden';
    };

export interface RoomExit {
  readonly index: number;
  readonly type: string;
  readonly compatibilityPolicyKey: string;
  readonly behavior: ExitBehavior;
  /** The physical door's native `AllowReroll`: its type's, unless the room's door differs. */
  readonly allowReroll: boolean;
}

interface ZagreusContractAdditionalExitDeclaration {
  readonly kind: 'zagreusContract';
  readonly key: 'zagreusContract';
  readonly physicalExit: Omit<RoomExit, 'index'>;
  readonly targetRoomGameName: string;
  readonly maxEnteredThisRoute: number;
  /** A source-local prerequisite for offering the contract door. */
  readonly requirement?: RequirementExpression;
}

interface ChaosAdditionalExitDeclaration {
  readonly kind: 'chaos';
  readonly key: 'chaos';
  readonly physicalExit: Omit<RoomExit, 'index'>;
  /** A room can host Chaos even when ordinary spawning is not available. */
  readonly canHost: boolean;
  /** Ordinary authoring eligibility; Ixion forcing is a separate chronology. */
  readonly canSpawn: boolean;
  /** A source-local prerequisite for ordinary spawning. */
  readonly requirement?: RequirementExpression;
}

export type AdditionalExitDeclaration =
  ZagreusContractAdditionalExitDeclaration | ChaosAdditionalExitDeclaration;

/** Each native LeaveRoom adds one room-history record; rooms declare no history or depth step. */
export interface RoomCounterEffects {
  /** Native StartRoom `RunOverrides.BiomeDepthCache`: an absolute value set on entry. */
  readonly enteredBiomeDepthCache?: number;
  /**
   * Derived from `nextRoomSet`: native GetBiomeDepth is 1 while the current room
   * has NextRoomSet, so leaving it leaves the cache at 1 whatever it was.
   */
  readonly resetsBiomeDepthCache?: true;
}

type PhantomPlaceholderSetKey = 'N' | 'N_SubRooms';

/**
 * A room whose return door `ChooseNextRoomData` still fills: the placeholder
 * room and its reward are drawn but never entered. Main rooms draw from `N`,
 * side rooms from `N_SubRooms`.
 */
export interface PhantomExitDeclaration {
  /** The current room's native room set, which the placeholder is drawn from. */
  readonly placeholderRoomSetKey: PhantomPlaceholderSetKey;
}

/**
 * The rooms one native room set offers a phantom exit as its placeholder,
 * excluding those `IsRoomEligible` never admits there (entered-once and
 * linked-only rooms). Order is the order an unpinned exit settles in.
 */
export interface PhantomPlaceholderSet {
  readonly key: PhantomPlaceholderSetKey;
  readonly roomGameNames: readonly string[];
}

export interface PhantomExitPolicy {
  /** The return door sorts first in its unlock's name-ordered doors, before every side door. */
  readonly unlockOrderPosition: 'first';
  readonly placeholderSets: CatalogCollection<PhantomPlaceholderSet>;
}

export interface RoomCaps {
  readonly maxAppearancesThisBiome?: number;
  readonly maxCreationsThisRun?: number;
  readonly maxCreationsPerRoom?: number;
}
export type ResourceFamily = 'Pickaxe' | 'Exorcism' | 'Shovel' | 'Fishing';
export interface ResourcePointSupport {
  readonly families: readonly ResourceFamily[];
  readonly capacity: 'simpleComplex' | 'allTools';
  readonly ignoresBiomeLimit?: boolean;
  /** Route identities excluded from native point setup for this support profile. */
  readonly excludedRouteKeys?: readonly string[];
  readonly rules: Readonly<
    Record<
      ResourceFamily,
      {
        readonly grantedTraitKey: string;
        readonly element: 'Fire' | 'Air' | 'Earth' | 'Water';
        readonly sameFamilyLookback: number;
        readonly crossFamilyLookback: Readonly<Record<ResourceFamily, number>>;
      }
    >
  >;
}

export interface RequiredRoomObjectDescriptor {
  readonly key: 'SoulPylon';
  readonly spawnTiming: 'roomEntry';
  readonly completionRequirement: 'destroyBeforeExit';
}

export type RoomForce =
  | {
      readonly kind: 'depthWindow';
      readonly axis: CounterAxis;
      readonly start: number;
      readonly deadline: number;
    }
  | { readonly kind: 'requirement'; readonly requirement: RequirementExpression }
  | { readonly kind: 'always' };

type RemainingPrebossOfferPolicy =
  { readonly kind: 'none' } | { readonly kind: 'counted'; readonly reward: CountedRewardBinding };

/** The room-owned reward surface exposed by a selected starting point or door. */
type RoomOfferRewardBinding =
  | { readonly kind: 'none' }
  | { readonly kind: 'incomingReward' }
  | { readonly kind: 'localRewardGroup'; readonly groupKey: string };

/** A narrow declaration-owned encounter replacement for a contextual route entry. */
export interface EntryContextualEncounterRule {
  readonly routeKey: 'Dream' | 'FreshFile';
  readonly position: 'every' | 'first';
  readonly encounterDefinitionKey: string;
}

/**
 * Source `ForceLootTableFirstRun` and `ForceCommonLootFirstRun`, which apply
 * while the save has no completed run: the route owning that profile.
 */
export interface FirstRunTraitOfferRule {
  readonly routeKey: string;
  /** The forced loot table: the only traits such a screen may offer. */
  readonly traitKeys: readonly string[];
  readonly rarity: 'Common';
}

/**
 * Source `SpawnErisForCurse`: on this route Eris may stand in the room; talking
 * applies her curse trait and drops one required gift.
 */
export interface ErisHostDeclaration {
  readonly routeKey: string;
  readonly curseTraitKey: string;
  readonly giftRewardType: string;
  readonly producerLifecycleKey: string;
}

export type PrebossBatchPolicy =
  | {
      readonly kind: 'takeOverNormalDoors';
      readonly remainingOffers: RemainingPrebossOfferPolicy;
    }
  | { readonly kind: 'retainNormalPeers' };

/**
 * The room a route's save profile realizes in place of the declared one: its
 * kind, template, reward binding and encounter, with no declared lifecycle
 * profile. Eligibility, force, caps and exits stay the declaration's.
 */
export interface RoomRouteOverlay {
  readonly routeKey: string;
  readonly label: string;
  readonly kind: RoomKind;
  readonly mode: RoomMode;
  readonly incomingReward: RewardProducerBinding;
  readonly offerRewardBinding: RoomOfferRewardBinding;
  readonly encounterSlotBindings: readonly EncounterSlotBinding[];
}

export interface RoomDeclaration {
  /** Native cocoon anchors in numbered capture order. */
  readonly cocoonRewardPointIds?: readonly number[];
  readonly gameName: string;
  readonly label: string;
  /** Exact game RoomSet identity; authored topology supplies the host route biome. */
  readonly roomSetKey: string;
  /**
   * Breakables on the room's map that native may swap for a golden urn
   * (obstacles carrying `BreakableValueOptions`); absent when the map has none.
   */
  readonly swappableBreakables?: number;
  readonly kind: RoomKind;
  readonly mode: RoomMode;
  /** Optional declaration-owned lifecycle specialization for this room. */
  readonly lifecycleProfileKey?: string;
  readonly structuralTags: readonly RoomStructuralTag[];
  readonly exits: readonly RoomExit[];
  readonly additionalExits: readonly AdditionalExitDeclaration[];
  /**
   * The room's map exit doors in its door-setup order, the order open doors
   * enter the game's offered-exit table; with the obstacle names it decides
   * the native processing order of any open set. A room with exits lists one
   * door per exit; the Hub lists every map exit door.
   */
  readonly exitDoorSetupOrder?: readonly ExitDoorSetup[];
  readonly incomingReward: RewardProducerBinding;
  /** Entry-only contextual encounter differences; reward ownership remains route-start owned. */
  readonly entryContextualEncounterRules?: readonly EntryContextualEncounterRule[];
  /** Route overlays resolved with the route position, like the contextual encounter rules. */
  readonly routeOverlays?: readonly RoomRouteOverlay[];
  /** A real required pickup whose payload is intentionally outside simulated state. */
  readonly effectNeutralRequiredReward: boolean;
  /** Declaration-owned binding for the reward surface exposed by this room. */
  readonly offerRewardBinding: RoomOfferRewardBinding;
  /** The normalized room declaration flag that suppresses Gift trait offers. */
  readonly blockGiftBoons: boolean;
  /** Source-declared room-owned blocker for Gorgon Amulet. */
  readonly blocksGorgon: boolean;
  /** Native RoomData `NextRoomSet`, declared or inherited; native biome depth counts from it. */
  readonly nextRoomSet: boolean;
  /** Native RoomData `NoReroll`, declared or inherited: no door into this room is rerollable. */
  readonly noReroll: boolean;
  /** Native RoomData `ForceDoorAllowReroll`: every door into this room allows a reroll. */
  readonly forceDoorAllowReroll: boolean;
  /** The hidden return door this room unlocks with its other exits, drawing a placeholder room. */
  readonly phantomExit?: PhantomExitDeclaration;
  /** Exact physical Postboss rack presence, independent of route position. */
  readonly hasKeepsakeRack: boolean;
  /** Routes whose save profile lacks the rack. */
  readonly keepsakeRackExcludedRouteKeys?: readonly string[];
  /** Exact physical fountain requirement for this room. */
  readonly hasRequiredFountain: boolean;
  /** Declaration-owned stable physical Pool slots at this exact host. */
  readonly purgingPool?: {
    readonly slotKeys: readonly ['left', 'middle', 'right'];
    /** Routes whose save profile lacks a usable Pool. */
    readonly excludedRouteKeys?: readonly string[];
    /** The sell screen shows the native reroll button. */
    readonly screenReroll: boolean;
  };
  /** Exact installed `ChallengeSwitchBase` anchors available to competing secret spawns. */
  readonly challengeSwitchAnchorCount?: number;
  /** Exact installed `SecretPoint` anchors for forced Chaos gates. */
  readonly secretPointAnchorCount?: number;
  /** Exact Surface Shop chance and forced status; inventory is always authored when present. */
  readonly surfaceShop?: {
    readonly profileKey: 'SurfaceShop';
    readonly spawnChance: number;
    readonly forced: boolean;
  };
  /** Exact RoomShop placement facts. Unlike SurfaceShop, inventory is optional authoring. */
  readonly roomShop?: {
    readonly profileKey: 'RoomShop';
    readonly spawnChance: number;
    readonly forced: boolean;
    /** Routes whose save profile lacks this Well upgrade. */
    readonly excludedRouteKeys?: readonly string[];
  };
  readonly boonRarityOverride?: import('./traits').BoonRarityOverride;
  /** Trait-offer policy for loot opened in this room on the first run. */
  readonly firstRunOffer?: FirstRunTraitOfferRule;
  readonly erisHost?: ErisHostDeclaration;
  readonly prebossBatchPolicy?: PrebossBatchPolicy;
  readonly forcedRewardStoreKey?: string;
  readonly individualRewardStoreKey?: string;
  readonly enteredRewardStoreHistory: EnteredRewardStoreHistoryPolicy;
  readonly encounterEnvelopeKey: string;
  /** Native Encounter carriers intentionally omitted from the simulated phase envelope. */
  readonly unmodeledEncounterKeys?: readonly string[];
  readonly advancesExperimentalHammerUses: boolean;
  /** Source `IgnoreEncounterUses`; suppresses encounter-counted end effects. */
  readonly ignoreEncounterUses: boolean;
  /** Exact room-level policy for advancing delayed Hermes Shrine delivery uses. */
  readonly advancesHermesShrineDeliveryUses: boolean;
  /** Source `SkipRoomsPerUpgrade`; suppresses Steady Growth's end-effects clock. */
  readonly skipRoomsPerUpgrade: boolean;
  /** Source `SkipTimedDropResources`; defers a due timed pickup until the next valid room. */
  readonly skipTimedDropResources: boolean;
  /** Source `SkipTimedDropResourceInDream`; defers a due timed pickup only on Dream. */
  readonly skipTimedDropResourcesInDream: boolean;
  readonly encounterSlotBindings: readonly EncounterSlotBinding[];
  readonly counters: RoomCounterEffects;
  readonly caps: RoomCaps;
  readonly resourcePointSupport: ResourcePointSupport;
  readonly eligibility?: RequirementExpression;
  readonly force?: RoomForce;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly localChildren: readonly LocalChildDescriptor[];
  /** Entry-generated, optional Fields pickups and their exact map capacity. */
  readonly fieldsOptionalRewards?: FieldsOptionalRewardDescriptor;
  /** Exact room-scoped physical points for authored Fields combat layouts. */
  readonly fieldsSpatial?: FieldsSpatialDeclaration;
  /** Source-owned zero-cost Infernal Contract pedestal at qualifying Preboss rooms. */
  readonly infernalContractReward?: {
    readonly entryKey: 'infernalContractReward';
    readonly generationProfileKey: string;
    readonly producerLifecycleKey: string;
    readonly rewardTypes: readonly [string, string, string, string, string];
  };
}

export interface FieldsOptionalRewardDescriptor {
  readonly key: 'optionalRewards';
  readonly optionalRewardCapacity: number;
  readonly slotKeys: readonly string[];
  readonly reward: CountedRewardBinding;
}

/** Exact room-scoped physical points available to a Fields combat room. */
export interface FieldsSpatialDeclaration {
  readonly entryPairs: readonly {
    readonly startPointId: number;
    readonly endPointId: number;
  }[];
  readonly cagePointIds: readonly number[];
  readonly optionalPointIds: readonly number[];
  readonly nemesisExcludedOptionalPointIds: readonly number[];
  /**
   * One enemy spawn point exclusive to each mapped cage point's
   * `RewardCageSpawnPoints` group; an opened cage's eligible spawn points
   * contain only its own representative. Unmapped cage points have none.
   */
  readonly cageSpawnRepresentatives: readonly {
    readonly cagePointId: number;
    readonly spawnPointId: number;
  }[];
}

export type AuthoredFieldInitialization<T> =
  { readonly kind: 'required' } | { readonly kind: 'defaulted'; readonly value: T };

export type AuthoredFieldDescriptor =
  | {
      readonly key: string;
      readonly kind: 'boolean';
      readonly initialization: AuthoredFieldInitialization<boolean>;
    }
  | {
      readonly key: string;
      readonly kind: 'boundedInteger';
      readonly min: number;
      readonly max: number;
      readonly initialization: AuthoredFieldInitialization<number>;
    }
  | {
      readonly key: string;
      readonly kind: 'enum';
      readonly values: readonly string[];
      readonly initialization: AuthoredFieldInitialization<string>;
    };

export type LocalChildDescriptor =
  | {
      readonly key: string;
      readonly kind: 'boundedRewardSlots';
      /** Closed application materialization capability for an exposed group. */
      readonly offerRewardCapability?: 'fieldsCages';
      readonly slotKeys: readonly string[];
      readonly rawCapacity: number;
      readonly maxActiveSlots: number;
      readonly reward: CountedRewardBinding;
      readonly fields: readonly AuthoredFieldDescriptor[];
    }
  | {
      readonly key: string;
      readonly kind: 'fixedRoomSlots';
      readonly slots: readonly {
        readonly slotKey: string;
        readonly roomGameName: string;
        readonly physicalDoorId: number;
        readonly availabilityRank: number;
      }[];
      readonly rewardGeneration: 'nativeDoorOrder';
      readonly fields: readonly AuthoredFieldDescriptor[];
    };

export type StartDescriptor =
  | {
      readonly kind: 'authoredChoice';
      readonly roomGameNames: readonly [string, ...string[]];
    }
  | { readonly kind: 'fixedAuthored'; readonly roomGameName: string };

export type RewardStorePolicy =
  | {
      readonly kind: 'authoredBaseStore';
      readonly storeKeys: readonly string[];
      readonly targetMetaRewardsRatio: number;
      readonly targetMetaRewardsAdjustSpeed: number;
    }
  | {
      readonly kind: 'sourceOfferPoint';
      readonly selector: SourceOfferPointSelector;
    }
  | { readonly kind: 'none' };

type SourceOfferPointSelector = 'lastActiveWheel';

export interface SourceRewardStorePolicyOverride {
  readonly sourceRoomTemplateKey: RoomTemplateKey;
  readonly policy: RewardStorePolicy;
}

interface StagedCandidatePoolDescriptor {
  readonly key: string;
  readonly roomGameNames: readonly string[];
}

export interface GeneratedProgressionPolicy {
  readonly kind: 'eligibilityDriven';
}

export interface HubEntryProgressionPolicy {
  readonly kind: 'staged';
  readonly stages: readonly StagedCandidatePoolDescriptor[];
}

export type NormalDoorBatchPolicy =
  | {
      readonly kind: 'standard';
      readonly fields: readonly AuthoredFieldDescriptor[];
    }
  | {
      readonly kind: 'fields';
      readonly fields: readonly AuthoredFieldDescriptor[];
      readonly minDoorCageRewards: number;
      readonly maxDoorCageRewards: number;
      readonly maxDoorCageCeiling: number;
      readonly maxOutcomeSupport: {
        readonly optionalBiomeDepths: readonly number[];
        readonly requiredBiomeDepths: readonly number[];
      };
    }
  | {
      readonly kind: 'clockwork';
      readonly initialGoalCount: number;
      readonly fields: readonly AuthoredFieldDescriptor[];
    };

/**
 * The declaration-owned policy for a normal exit decision. A Hub can carry a
 * bounded entry decision without becoming a second general progression family.
 */
interface NormalDecisionProgressionCommon {
  readonly batchPolicy: NormalDoorBatchPolicy;
  readonly rewardStorePolicy: RewardStorePolicy;
  readonly rewardStoreOverrides: readonly SourceRewardStorePolicyOverride[];
}

export interface GeneratedProgressionDescriptor extends NormalDecisionProgressionCommon {
  readonly kind: 'generated';
  readonly progressionPolicy: GeneratedProgressionPolicy;
  readonly anomalyReplacement?: OceanusAnomalyReplacementDescriptor;
}

export interface OceanusAnomalyReplacementDescriptor {
  readonly kind: 'oceanusAnomaly';
  readonly source: {
    readonly minimumBiomeDepthCache: number;
    readonly excludedRoomGameNames: readonly string[];
    readonly excludedSourceEncounterGameNames: readonly string[];
    readonly maxEnteredReplacementsThisRoute: number;
    /** Route identities excluded from this source-side replacement. */
    readonly excludedRouteKeys?: readonly string[];
  };
  readonly replaceableTargetRoomGameNames: readonly string[];
  readonly replacementRoomGameNames: readonly string[];
  readonly defaultReplacementRoomGameName: string;
}

export interface HubEntryNormalDecisionDescriptor extends NormalDecisionProgressionCommon {
  /** Stable physical identity for the bounded normal exit from the Opening. */
  readonly exitKey: string;
  readonly progressionPolicy: HubEntryProgressionPolicy;
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
}

export type NormalDecisionProgressionDescriptor =
  GeneratedProgressionDescriptor | HubEntryNormalDecisionDescriptor;

/**
 * The only terminal resolution admitted after a bounded Hub entry. It is
 * deliberately closed: the terminal belongs to this Hub progression rather
 * than to a generic source rule.
 */
export interface HubTerminalTakeoverDescriptor {
  readonly roomGameName: string;
  readonly eligibility: RequirementExpression;
  readonly force: 'required';
}

/**
 * A completed Hub has no authored room declaration as its source, so its
 * width-one exit carries its own fixed target and normalized physical metadata.
 */
export interface CompletedHubExitDescriptor {
  readonly exitKey: string;
  readonly roomGameName: string;
  readonly physicalExit: RoomExit;
}

export type BiomeTransitionCounterAxis = 'biomeDepthCache' | 'biomeEncounterDepth';

export interface BiomeTransitionCounterReset {
  readonly kind: 'resetCounter';
  readonly axis: BiomeTransitionCounterAxis;
}

export interface CompletionDescriptor {
  /** Normal physical Boss map; retained as the default completion identity. */
  readonly bossRoomGameName: string;
  /** Distinct physical Rivals map, when the biome declares one. */
  readonly rivalsBossRoomGameName?: string;
  readonly transitionEffects: readonly BiomeTransitionCounterReset[];
  /**
   * Authority for the Preboss -> Boss door's store, when it differs from the
   * biome's ordinary door policy. The boss door is an ordinary door in native
   * and normally shares the progression's policy, so this is declared only
   * where the two genuinely diverge: Q rolls at its boss door under a 0.15
   * target while its ordinary doors carry no store at all. Resolution is
   * `bossRewardStorePolicy ?? progression.rewardStorePolicy`, which leaves
   * every other biome's boss door on the policy it already had.
   */
  readonly bossRewardStorePolicy?: RewardStorePolicy;
}

interface HubSlotDescriptor {
  readonly slotKey: string;
  readonly roomGameName: string;
  /** The door's map ObjectId, its key in the game's offered-exit table. */
  readonly physicalDoorId: number;
  /**
   * Zero-based position at which the Hub map's door setup inserts this door
   * into the offered-exit table among the board doors, read from the Hub
   * room's door-setup order.
   */
  readonly offeredExitInsertionRank: number;
}

interface HubOpenSlotConstraint {
  readonly kind: 'maxOpenFromSlots';
  readonly slotKeys: readonly string[];
  readonly max: number;
}

interface HubRewardLookupDescriptor {
  readonly key: string;
  readonly source: 'allOpenTargetOffers';
}

interface HubTargetCompletionDescriptor {
  readonly kind: 'requiredRoomObject';
  readonly objectKey: 'SoulPylon';
}

interface HubSideRoomGenerationPolicy {
  readonly kind: 'visitPressure';
  readonly generatedCountKey: string;
  readonly minimumPerVisit: {
    readonly numerator: number;
    readonly denominator: number;
  };
  readonly remainingSlots: 'optional';
  readonly forcedOrder: 'availabilityRankPrefix';
}

export interface HubDecisionDescriptor {
  readonly kind: 'hub';
  readonly hubKey: string;
  readonly entry: HubEntryNormalDecisionDescriptor;
  readonly terminal: HubTerminalTakeoverDescriptor;
  readonly slots: readonly HubSlotDescriptor[];
  readonly openCount: { readonly min: number; readonly max: number };
  readonly openSlotConstraints: readonly HubOpenSlotConstraint[];
  readonly requiredVisits: number;
  readonly targetCompletion: HubTargetCompletionDescriptor;
  readonly restoreRoomGameName: string;
  readonly rewardStorePolicy: RewardStorePolicy;
  readonly rewardLookup: HubRewardLookupDescriptor;
  readonly sideRoomGeneration: HubSideRoomGenerationPolicy;
  /** Placeholder rooms for this Hub's rooms' hidden return doors. */
  readonly phantomExits: PhantomExitPolicy;
  readonly fields: readonly AuthoredFieldDescriptor[];
  readonly completedExit: CompletedHubExitDescriptor;
}

export type ProgressionDescriptor = GeneratedProgressionDescriptor | HubDecisionDescriptor;

export interface BiomeLayout {
  readonly biomeKey: string;
  readonly start: StartDescriptor;
  readonly progression: ProgressionDescriptor;
  /** Closed target domain and default for authored Chaos exits in this host. */
  readonly chaos?: {
    readonly roomGameNames: readonly [string, ...string[]];
    readonly defaultRoomGameName: string;
    readonly offerSpacingWindow: number;
  };
  readonly completion: CompletionDescriptor;
  readonly fields: readonly AuthoredFieldDescriptor[];
}

/** The three challenge switch kinds (`EncounterSets` Time, PerfectClear and Elite options). */
export type ChallengeSwitchKind = 'time' | 'perfectClear' | 'elite';

export const CHALLENGE_SWITCH_KINDS = Object.freeze([
  'time',
  'perfectClear',
  'elite',
] as const satisfies readonly ChallengeSwitchKind[]);

/** One switch kind's gates beyond the shared spawn rules. */
export interface ChallengeSwitchKindDeclaration {
  readonly key: ChallengeSwitchKind;
  /** The variant a newly observed switch of this kind starts from. */
  readonly defaultVariantKey: string;
  /** The kind's own `BiomeDepthCache` floor, below the shared one when lower. */
  readonly minimumBiomeDepth?: number;
  /** The room's kind-level requirement (`EliteSwitchRequirements`). */
  readonly requirement?: RequirementExpression;
  /** The reward a hit turns the claim into; absent where a hit changes no reward. */
  readonly hitRewardType?: string;
  /** The claim pays gold that decays with the clear time instead of a consumable. */
  readonly goldReward: boolean;
}

/** One switch obstacle variant: its kind, draw weight and reward. */
export interface ChallengeSwitchVariantDeclaration {
  /** Native obstacle name. */
  readonly key: string;
  readonly switchKind: ChallengeSwitchKind;
  /** Native option multiplicity among the eligible variants. */
  readonly weight: number;
  /** The reward its clean claim spawns. */
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
}

/** A room able to hold a switch: a `ChallengeSwitchBase` anchor and a nonzero chance. */
export interface ChallengeSwitchHostDeclaration {
  readonly gameName: string;
  /** Native `ChallengeSpawnChance`; a chance, never a rule. */
  readonly spawnChance: number;
  /** The one encounter each kind fields in this room (`<Kind>EncounterOptions`). */
  readonly encounterKeyBySwitchKind: Readonly<Record<ChallengeSwitchKind, string>>;
}

/** Challenge switches: optional room objects rolled at room entry. */
export interface ChallengeSwitchCatalog {
  readonly kinds: CatalogCollection<ChallengeSwitchKindDeclaration>;
  readonly variants: CatalogCollection<ChallengeSwitchVariantDeclaration>;
  readonly hosts: CatalogCollection<ChallengeSwitchHostDeclaration>;
  /** Shared `ChallengeSpawnRequirements` `BiomeDepthCache` floor. */
  readonly minimumBiomeDepth: number;
  /** `RequiredMinRoomsSinceEvent` ChallengeSwitch count. */
  readonly minimumRoomsSinceLast: number;
  /** Lifecycle of the pickups a claim spawns. */
  readonly producerLifecycleKey: string;
  /** Time-switch gold before the money multiplier. */
  readonly gold: {
    readonly startingValue: number;
    readonly minimumValue: number;
    readonly defaultValue: number;
  };
  /** The bonus drop a clean claim may add (`LootDrops`). */
  readonly bonusReward: { readonly rewardType: string; readonly dropChance: number };
}

/** Gold facts with no narrower owner. */
export interface GoldCatalogDeclaration {
  /** Gold a trait screen with no options pays instead, before the money multiplier. */
  readonly fallbackGold: number;
  /**
   * A Pool of Purging sale: the sold trait's rarity range drawn as an integer
   * and floored to `roundDownTo`, plus `perLevel` for each level above the
   * first; an Infusion uses its own range and an unranked trait `unranked`.
   */
  readonly purgingPoolSale: {
    readonly byRarity: Readonly<
      Record<
        'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Duo' | 'Legendary',
        { readonly min: number; readonly max: number }
      >
    >;
    readonly infusion: { readonly min: number; readonly max: number };
    readonly unranked: number;
    readonly perLevel: number;
    readonly roundDownTo: number;
  };
}

export interface Catalog {
  readonly version: string;
  readonly biomes: CatalogCollection<BiomeDeclaration>;
  readonly routes: CatalogCollection<RouteDeclaration>;
  readonly runStartReward: RunStartRewardDeclaration;
  readonly arcanaCards: CatalogCollection<ArcanaCardDeclaration>;
  readonly fearVows: CatalogCollection<FearVowDeclaration>;
  readonly keepsakes: CatalogCollection<KeepsakeDeclaration>;
  readonly defaultStartingKeepsakeKey: string;
  readonly familiars: CatalogCollection<FamiliarDeclaration>;
  /** The familiar a new mature-save route starts with. */
  readonly defaultFamiliarKey: string;
  /** `HeroData` base maxima before any trait. */
  readonly heroMaxStats: Readonly<Record<MaxStatKey, number>>;
  readonly gold: GoldCatalogDeclaration;
  readonly rewards: RewardKernelCatalog;
  readonly encounterEnvelopes: CatalogCollection<EncounterEnvelope>;
  readonly encounterDefinitions: CatalogCollection<EncounterDefinition>;
  readonly encounterSets: CatalogCollection<EncounterSet>;
  /** What one kill of each enemy a known roster can field drops, by native enemy id. */
  readonly enemyGoldDrops: CatalogCollection<EnemyGoldDrop>;
  /** Source `NoRecentFieldNPCEncounter`: the encounters that host a field NPC. */
  readonly fieldNpcEncounterKeys: readonly string[];
  readonly roomLifecycleProfiles: CatalogCollection<RoomLifecycleProfile>;
  readonly exitCompatibilityPolicies: CatalogCollection<ExitCompatibilityPolicy>;
  readonly exitTypes: CatalogCollection<ExitTypeDeclaration>;
  readonly rooms: CatalogCollection<RoomDeclaration>;
  readonly challengeSwitches: ChallengeSwitchCatalog;
  readonly biomeLayouts: CatalogCollection<BiomeLayout>;
  readonly weapons: CatalogCollection<WeaponDeclaration>;
  readonly aspects: CatalogCollection<AspectDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
  /** Complete normalized Chaos declarations. */
  readonly chaos: import('./traits').ChaosTraitCatalog;
  readonly traitGivers: CatalogCollection<TraitGiverDeclaration>;
  /** Catalog-normalized source game names used by payload-source acquisition roles. */
  readonly traitGiverByAcquisitionGameName: Readonly<Record<string, string>>;
  readonly boonRarityBases: Readonly<
    Record<'olympian' | 'hermes', import('./traits').BoonRarityValues>
  >;
  readonly boonRarityRollOrder: import('./traits').BoonRarityRollOrder;
  readonly boonReplacement: import('./traits').BoonReplacementDeclaration;
  readonly echoLastRunBoon: import('./traits').EchoLastRunBoonCatalog;
  /** Complete normalized frozen Hex layout declarations. */
  readonly hexes: CatalogCollection<import('./traits').HexDeclaration>;
  readonly traitOfferContexts: CatalogCollection<TraitOfferContextDeclaration>;
  readonly traitRarityOrder: readonly ['Common', 'Rare', 'Epic', 'Heroic'];
  readonly traitElements: readonly TraitElement[];
  readonly traitBaseElements: readonly ['Earth', 'Air', 'Fire', 'Water'];
}

export interface CatalogSummary {
  readonly version: string;
  readonly routeCount: number;
  readonly biomeCount: number;
  readonly rewardTypeCount: number;
  readonly roomCount: number;
}

export function summarizeCatalog(catalog: Catalog): CatalogSummary {
  return {
    version: catalog.version,
    routeCount: catalog.routes.values.length,
    biomeCount: catalog.biomes.values.length,
    rewardTypeCount: catalog.rewards.rewardTypes.values.length,
    roomCount: catalog.rooms.values.length,
  };
}
