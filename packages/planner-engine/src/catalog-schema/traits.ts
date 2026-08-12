import type { CatalogCollection } from '../normalized/collection';

export type TraitProviderKind = 'olympian' | 'hermes' | 'hammer' | 'npc';

/** Rarities that can exist on an equipped trait or a fresh offer. */
export type TraitRarity = 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary' | 'Duo';

/** The rarity vocabulary a declaration participates in.
 *
 * Hammers are deliberately un-rarified in the planner.  Keeping that as an
 * explicit domain (rather than encoding it as a fixed Common rarity) prevents
 * rarity-bearing Hammer state from leaking into authored or derived products.
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

/** Selection either equips, produces declared concrete pickups, or has no
 * modeled run effect. Pickup detail remains owned by the acquisition entry. */
export type TraitSelectedDisposition =
  | { readonly kind: 'equip' }
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

export interface TraitOfferOptionDefault {
  readonly traitKey: string;
  readonly rarity?: TraitRarity;
}

export interface TraitOfferDefaults {
  readonly options: readonly [
    TraitOfferOptionDefault,
    TraitOfferOptionDefault,
    TraitOfferOptionDefault,
  ];
  readonly selectedOption: 0 | 1 | 2;
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
  readonly defaultOffer?: TraitOfferDefaults;
  readonly defaultsByLoadout?: Readonly<Record<string, TraitOfferDefaults>>;
  readonly denialParticipates?: boolean;
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
}
