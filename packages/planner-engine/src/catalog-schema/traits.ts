import type { CatalogCollection } from '../normalized/collection';

export type TraitProviderKind = 'olympian' | 'hermes' | 'hammer' | 'npc';

/** Rarities that can exist on an equipped trait or a fresh offer. */
export type TraitRarity = 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary' | 'Duo';

/** The player-facing boon-rarity vocabulary a declaration participates in.
 *
 * `none` is explicit for every planner-rarityless trait. It covers Hammers,
 * whose independent Rank I/II state is not rarity, and NPC traits whose source
 * uses internal scaling tiers without exposing or mutating boon rarity.
 */
export type TraitRarityDomain =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'ranked';
      readonly freshOfferRarities: readonly TraitRarity[];
      readonly equippedRarities: readonly TraitRarity[];
    };

export type TraitElement = 'Aether' | 'Earth' | 'Air' | 'Fire' | 'Water';

/**
 * One declaration-owned, scalable god-trait rarity floor.  This intentionally
 * remains a closed product rather than a general trait-effect language.
 */
export interface ScalableGodTraitRarityFloorEffect {
  readonly activationElementMinimums: Readonly<Partial<Record<TraitElement, number>>>;
  readonly fromRarity: 'Common';
  readonly minimumRarity: 'Rare';
}

/** One acquisition-time transition targeting exactly one equipped trait. */
export interface PromoteGodTraitToHeroicAcquisition {
  readonly kind: 'promoteGodTraitToHeroic';
  readonly target: 'superchargeableGodTrait';
  /**
   * Source-declared cooldown caps for the small set of Heroic promotions
   * whose current Pom level constrains the transition. This remains a
   * targeted-acquisition fact, not a general combat-value model.
   */
  readonly maximumEligibleLevelByTraitAndRarity?: Readonly<
    Record<string, Readonly<Partial<Record<TraitRarity, number>>>>
  >;
}

/** Player-facing Rank II progression for one eligible equipped Daedalus Hammer. */
export interface UpgradeHammerToRank2Acquisition {
  readonly kind: 'upgradeHammerToRank2';
  readonly target: 'upgradableHammer';
}

export type TargetedTraitAcquisition =
  PromoteGodTraitToHeroicAcquisition | UpgradeHammerToRank2Acquisition;

export type TraitOrdinaryBoonSlot = 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana';

export type DirectTraitSetKey = 'earth' | 'fire' | 'air' | 'water';

/** One closed source-owned direct-grant pair. This is deliberately narrower
 * than a generic trait callback/effect language. */
export interface DirectTraitSetDeclaration {
  readonly key: DirectTraitSetKey;
  readonly traitKeys: readonly [string, string];
}

/** Selection either equips, produces declared concrete pickups, or has no
 * modeled run effect. Pickup detail remains owned by the acquisition entry. */
export type TraitSelectedDisposition =
  | { readonly kind: 'equip' }
  | {
      /** Equips the outer trait, then resolves one direct rarityless grant per set. */
      readonly kind: 'directTraitSets';
      readonly sets: readonly [
        DirectTraitSetDeclaration,
        DirectTraitSetDeclaration,
        DirectTraitSetDeclaration,
        DirectTraitSetDeclaration,
      ];
    }
  | {
      /** Echo always equips the outer rarityless identity before this closed effect settles. */
      readonly kind: 'echo';
      readonly effect: 'numericNoOp' | 'survive' | 'doubleLevel' | 'lastRunBoon' | 'lastReward';
    }
  | {
      /** Gift Gift Gift snapshots the current eligible keepsake into this equipped identity. */
      readonly kind: 'echo';
      readonly effect: 'repeatKeepsake';
      readonly excludedKeepsakeKeys: readonly string[];
    }
  | {
      /** One equipped Echo trait duplicates the first eligible World Shop acquisition. */
      readonly kind: 'echo';
      readonly effect: 'doubleShop';
      readonly excludedRewardTypes: readonly string[];
    }
  | {
      /** Hermes Travel Deal: numeric discount is catalog truth while simulation uses one refill. */
      readonly kind: 'worldShopRestock';
      readonly refillCount: 1;
      readonly discountByRarity: Readonly<Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>>;
    }
  | { readonly kind: 'advanceCurrentKeepsake'; readonly rankBonus: 1 }
  | { readonly kind: 'circe'; readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear' }
  | {
      readonly kind: 'producePickups';
      readonly producerLifecycleKey: string;
      readonly pickups: readonly TraitPickupDeclaration[];
    }
  | { readonly kind: 'noOp' };

export interface TraitPickupDeclaration {
  readonly key: string;
  readonly rewardType: string;
}

export type TraitOfferContextKey =
  'devotionNoDuo' | 'blockGiftBoons' | 'deathDefianceConditionMet' | 'circeRemovableFearVow';

export type TraitRequirementExpression =
  | {
      readonly kind: 'all';
      readonly requirements: readonly TraitRequirementExpression[];
    }
  | {
      readonly kind: 'anyEquippedTrait';
      readonly traitKeys: readonly string[];
    }
  | {
      readonly kind: 'notEquippedTrait';
      readonly traitKeys: readonly string[];
    }
  | {
      readonly kind: 'elementCount';
      readonly element: TraitElement;
      readonly minimum: number;
    }
  | {
      readonly kind: 'highestBaseElementCount';
      readonly minimum: number;
    }
  | {
      readonly kind: 'godBoonRarityCount';
      readonly rarity: TraitRarity;
      readonly minimum: number;
      readonly maximum?: number;
    }
  | {
      readonly kind: 'rarifiableTrait';
    }
  | {
      readonly kind: 'upgradableTrait';
    }
  | {
      /** Requires an occupied ordinary boon slot without naming its possible traits. */
      readonly kind: 'ordinaryBoonSlotOccupied';
      readonly slot: TraitOrdinaryBoonSlot;
    }
  | {
      readonly kind: 'offerContext';
      readonly context: TraitOfferContextKey;
      readonly required: boolean;
    }
  | {
      readonly kind: 'manualArcanaGraspCost';
      readonly minimum: number;
    };

export interface WeaponDeclaration {
  readonly key: string;
  readonly label: string;
  readonly aspectKeys: readonly string[];
  readonly defaultAspectKey: string;
}

export interface AspectDeclaration {
  readonly key: string;
  readonly label: string;
  readonly weaponKey: string;
}

export interface HammerCompatibility {
  readonly weaponKey: string;
  readonly aspectKeys: readonly string[];
  /** Source-declared internal Legendary level, presented by the planner as Rank II. */
  readonly supportsRankII: boolean;
}

export interface TraitDeclaration {
  readonly key: string;
  readonly label: string;
  readonly rarityDomain: TraitRarityDomain;
  readonly offerRequirements: readonly TraitRequirementExpression[];
  readonly ordinaryBoonSlot?: TraitOrdinaryBoonSlot;
  readonly elementContributions: Readonly<Partial<Record<TraitElement, number>>>;
  readonly usesBoonRarity: boolean;
  readonly isCoreGodTrait: boolean;
  readonly blockStacking: boolean;
  readonly blockInRunRarify: boolean;
  readonly excludeFromRarityCount: boolean;
  readonly rarityFloorEffect?: ScalableGodTraitRarityFloorEffect;
  readonly targetedAcquisition?: TargetedTraitAcquisition;
  readonly selectedDisposition: TraitSelectedDisposition;
  readonly selfExclusion?: string;
  readonly hammerCompatibility?: HammerCompatibility;
}

/** The rarity controls a giver exposes while authoring a fresh offer. */
export type TraitGiverRarityPolicy =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly rarity: TraitRarity }
  | { readonly kind: 'selectable'; readonly rarities: readonly TraitRarity[] };

export interface TraitGiverDeclaration {
  readonly key: string;
  readonly label: string;
  readonly providerKind: TraitProviderKind;
  readonly traitKeys: readonly string[];
  /** Source-declared priority/core traits used by first Olympian offers. */
  readonly priorityTraitKeys: readonly string[];
  readonly rarityPolicy: TraitGiverRarityPolicy;
  /** Closed source-menu participation normalized for Calling Card. */
  readonly callingCardMenu: boolean;
  readonly denialParticipates?: boolean;
}

/** One giver-preserving source variant in Echo's audited previous-run approximation. */
export interface EchoLastRunBoonVariantDeclaration {
  readonly key: string;
  readonly giverKey: string;
  readonly traitKey: string;
  /** Source `GameStateRequirements`, distinct from ordinary boon prerequisites. */
  readonly requiresDeathDefianceCondition?: boolean;
  /** Present only when source `GetLootSourceName` records this provider. */
  readonly lootHistorySource?: string;
}

export interface EchoLastRunBoonCatalog {
  readonly variants: CatalogCollection<EchoLastRunBoonVariantDeclaration>;
}

export interface TraitOfferContextDeclaration {
  readonly key: TraitOfferContextKey;
  readonly kind: 'rewardRarityBlock' | 'roomFlag' | 'authoredCondition';
  readonly blockedRarity?: TraitRarity;
  readonly roomFlag?: 'BlockGiftBoons';
  readonly authoredCondition?: 'deathDefianceConditionMet' | 'circeRemovableFearVow';
}

export interface TraitCatalog {
  readonly rarityOrder: readonly ['Common', 'Rare', 'Epic', 'Heroic'];
  readonly elements: readonly TraitElement[];
  readonly baseElements: readonly ['Earth', 'Air', 'Fire', 'Water'];
  readonly offerContexts: CatalogCollection<TraitOfferContextDeclaration>;
  readonly weapons: CatalogCollection<WeaponDeclaration>;
  readonly aspects: CatalogCollection<AspectDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
  readonly echoLastRunBoon: EchoLastRunBoonCatalog;
}
