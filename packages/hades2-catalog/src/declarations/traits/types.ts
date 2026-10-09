import type {
  TraitCatalog,
  TraitDeclaration,
  TraitElement,
  TraitRequirementExpression,
  TraitRarity,
  ProperUpbringingEffect,
  TargetedTraitAcquisition,
  TraitSelectedDisposition,
} from '@run-planner/engine/catalog-schema';

/** Raw catalog declarations intentionally remain separate from normalized
 * engine products.  They are runtime-validated at the catalog boundary. */
export interface RawTraitDeclaration {
  readonly key: string;
  readonly label: string;
  /** Explicit planner disposition for a non-Hammer trait whose source scaling
   * tiers do not participate in player-facing boon rarity. */
  readonly rarityDomain?: 'none';
  readonly freshOfferRarities?: readonly TraitRarity[];
  readonly equippedRarities?: readonly TraitRarity[];
  readonly eligibilityRequirements: readonly TraitRequirementExpression[];
  readonly linkedBoonRequirements: readonly TraitRequirementExpression[];
  readonly equipmentSlot?: TraitDeclaration['equipmentSlot'];
  readonly elementContributions: TraitDeclaration['elementContributions'];
  readonly usesBoonRarity: boolean;
  /** May enter the initial offer as a linked priority seed, or be skipped. */
  readonly optionalLinkedPriority?: boolean;
  readonly blockStacking: boolean;
  readonly blockOfferIfPreviouslyPicked?: boolean;
  readonly blockInRunRarify: boolean;
  /** Native boss payout leaves this equipped instance present but no longer rarifiable. */
  readonly nonFinalBossRarityBlock?: true;
  readonly excludeFromRarityCount: boolean;
  readonly rarityFloorEffect?: ProperUpbringingEffect;
  readonly targetedAcquisition?: TargetedTraitAcquisition;
  readonly maximumEligibleLevelByRarity?: TraitDeclaration['maximumEligibleLevelByRarity'];
  /** Omitted declarations retain ordinary persistent-trait equip behavior. */
  readonly selectedDisposition?: TraitSelectedDisposition;
  readonly selfExclusion?: string;
  /** Raw Hammer declarations receive the source-closed Rank II matrix below. */
  readonly hammerCompatibility?: Omit<
    NonNullable<TraitDeclaration['hammerCompatibility']>,
    'supportsRankII'
  >;
  readonly roomsPerUpgradeGrowth?: TraitDeclaration['roomsPerUpgradeGrowth'];
  /**
   * Source `RoomRewardBonus` with `SourceIsMultiplier`: each rarity scales the
   * base's excess over one by that rarity's `RarityLevels` multiplier.
   */
  readonly resourceRewardBonus?: {
    readonly resources: readonly string[];
    readonly baseValue: number;
    readonly rarityMultipliers: Readonly<
      Record<Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic'>, number>
    >;
  };
  /** Source `GrantRandomMaxHealth` bounds: each base value scaled by its rarity multiplier. */
  readonly acquisitionMaxHealthRoll?: {
    readonly minimum: RawRarityScaledValue;
    readonly maximum: RawRarityScaledValue;
  };
  readonly maxStatEffect?: RawTraitMaxStatEffect;
}

/** A rarityless number, or a base scaled by `RarityLevels` (excess over one with `sourceIsMultiplier`). */
export type RawMaxStatValue =
  number | (RawRarityScaledValue & { readonly sourceIsMultiplier?: true });

export type RawTraitMaxStatEffect =
  | {
      readonly kind: 'multiplier';
      readonly maxHealth?: RawMaxStatValue;
      readonly maxMana?: RawMaxStatValue;
    }
  | { readonly kind: 'manaToHealthConversion'; readonly fraction: RawMaxStatValue }
  | {
      readonly kind: 'perElement';
      readonly element: TraitElement;
      readonly stat: 'maxHealth' | 'maxMana';
      readonly amount: number;
    }
  | { readonly kind: 'familiarStackMultiplier'; readonly multiplier: number };

export interface RawRarityScaledValue {
  readonly baseValue: number;
  readonly rarityMultipliers: Readonly<
    Record<Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic'>, number>
  >;
}

export interface RawWeaponDeclaration {
  readonly key: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly aspectKeys: readonly string[];
  readonly defaultAspectKey: string;
}

export interface RawAspectDeclaration {
  readonly key: string;
  readonly label: string;
  readonly weaponKey: string;
  readonly startingTrait?: { readonly traitKey: string; readonly giverKey: string };
  /** Persephone's authored outcome bounds (native positive roll minus one). */
  readonly traitOfferLevelBonus?: {
    readonly maximumBonus: number;
    readonly upgradedMaximumBonus: number;
    readonly upgradeTraitKey: string;
  };
  /** Flat maximum at rank V (Legendary) and rank VI (Perfect, after the upgrade trait). */
  readonly maxStatBonus?: {
    readonly stat: 'maxHealth' | 'maxMana';
    readonly amount: number;
    readonly upgradedAmount: number;
    readonly upgradeTraitKey: string;
  };
}

export interface RawTraitGiverDeclaration {
  readonly key: string;
  readonly label: string;
  readonly providerKind: 'olympian' | 'hermes' | 'hammer' | 'npc' | 'spell' | 'chaos';
  readonly shopAwareGodTrait?: boolean;
  readonly callingCardMenu?: boolean;
  readonly traitKeys: readonly string[];
  readonly priorityTraitKeys: readonly string[];
  readonly rarityPolicy:
    | { readonly kind: 'selectable'; readonly rarities: readonly TraitRarity[] }
    | { readonly kind: 'fixed'; readonly rarity: TraitRarity }
    | { readonly kind: 'none' };
  readonly boonRarityRollOrder?: readonly TraitRarity[];
  readonly denialParticipates?: boolean;
  readonly selectedOptionPathPointBonuses?: readonly [0, 1, 2];
}

export interface RawTraitOfferContextDeclaration {
  readonly key: string;
  readonly kind: 'rewardRarityBlock' | 'roomFlag' | 'authoredCondition';
  readonly blockedRarity?: TraitRarity;
  readonly roomFlag?: 'BlockGiftBoons';
  readonly authoredCondition?: 'circeRemovableFearVow';
}

/** One source `Structure[depth][slot]` entry; an omitted kind is a repeatable node. */
export interface RawHexLayoutNodeDeclaration {
  readonly slot: number;
  readonly kind?: import('@run-planner/engine/catalog-schema').HexNodeKind;
  readonly linkTo?: readonly number[];
  readonly bidirectional?: true;
  readonly gridOffsetX?: number;
  readonly gridOffsetY?: number;
}

export interface RawHexLayoutDeclaration {
  readonly key: import('@run-planner/engine/catalog-schema').HexLayoutKey;
  readonly label: string;
  /** Source `Structure`, depth 1 first, slots ascending. */
  readonly structure: readonly (readonly RawHexLayoutNodeDeclaration[])[];
}

export interface RawHexDeclaration {
  readonly spellTraitKey: string;
  readonly label: string;
  readonly layouts: readonly RawHexLayoutDeclaration[];
  readonly rareCandidates: readonly import('@run-planner/engine/catalog-schema').HexTalentCandidateDeclaration[];
  readonly epicCandidates: readonly import('@run-planner/engine/catalog-schema').HexTalentCandidateDeclaration[];
  readonly repeatableCandidates: readonly import('@run-planner/engine/catalog-schema').HexRepeatableTalentDeclaration[];
  readonly godSent: import('@run-planner/engine/catalog-schema').HexGodSentDeclaration;
}

export interface RawTraitCatalogInput {
  readonly weapons: readonly RawWeaponDeclaration[];
  readonly aspects: readonly RawAspectDeclaration[];
  readonly traits: readonly RawTraitDeclaration[];
  readonly givers: readonly RawTraitGiverDeclaration[];
  /** Explicit game acquisition-name bindings; never inferred from giver names. */
  readonly traitAcquisitionProviders: readonly {
    readonly gameName: string;
    readonly giverKey: string;
  }[];
  readonly boonRarityBases: Readonly<
    Record<'olympian' | 'hermes', import('@run-planner/engine/catalog-schema').BoonRarityValues>
  >;
  readonly boonRarityRollOrder: readonly TraitRarity[];
  readonly boonReplacement: {
    readonly chance: number;
    readonly excludedRouteKeys: readonly string[];
  };
  readonly echoLastRunBoon: {
    readonly sources: readonly {
      readonly giverKey: string;
      readonly lootHistorySource?: string;
    }[];
    readonly excludedTraitKeys: readonly string[];
  };
  readonly offerContexts: readonly RawTraitOfferContextDeclaration[];
  readonly deferredTraitKeys: readonly string[];
  readonly chaos: {
    readonly curses: readonly import('@run-planner/engine/catalog-schema').ChaosCurseDeclaration[];
    readonly blessings: readonly import('@run-planner/engine/catalog-schema').ChaosBlessingDeclaration[];
    readonly rarity: {
      readonly itemOverride: import('@run-planner/engine/catalog-schema').BoonRarityOverride;
      readonly rollOrder: readonly import('@run-planner/engine/catalog-schema').TraitRarity[];
    };
  };
  readonly hexes: readonly RawHexDeclaration[];
}

export type { TraitCatalog, TraitRequirementExpression, TraitRarity };
