import type {
  TraitCatalog,
  TraitDeclaration,
  TraitOfferDefaults,
  TraitRequirementExpression,
  TraitRarity,
  ScalableGodTraitRarityFloorEffect,
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
  readonly offerRequirements: readonly TraitRequirementExpression[];
  readonly ordinaryBoonSlot?: TraitDeclaration['ordinaryBoonSlot'];
  readonly elementContributions: TraitDeclaration['elementContributions'];
  readonly usesBoonRarity: boolean;
  readonly blockStacking: boolean;
  readonly blockInRunRarify: boolean;
  readonly excludeFromRarityCount: boolean;
  readonly rarityFloorEffect?: ScalableGodTraitRarityFloorEffect;
  readonly targetedAcquisition?: TargetedTraitAcquisition;
  /** Omitted declarations retain ordinary persistent-trait equip behavior. */
  readonly selectedDisposition?: TraitSelectedDisposition;
  readonly selfExclusion?: string;
  /** Raw Hammer declarations receive the source-closed Rank II matrix below. */
  readonly hammerCompatibility?: Omit<
    NonNullable<TraitDeclaration['hammerCompatibility']>,
    'supportsRankII'
  >;
}

export interface RawWeaponDeclaration {
  readonly key: string;
  readonly label: string;
  readonly aspectKeys: readonly string[];
  readonly defaultAspectKey: string;
}

export interface RawAspectDeclaration {
  readonly key: string;
  readonly label: string;
  readonly weaponKey: string;
}

export interface RawTraitOfferOptionDefault {
  readonly traitKey: string;
  readonly rarity?: TraitRarity;
}

export interface RawTraitOfferDefaults {
  readonly options: readonly [
    RawTraitOfferOptionDefault,
    RawTraitOfferOptionDefault,
    RawTraitOfferOptionDefault,
  ];
  readonly selectedOption: 0 | 1 | 2;
}

export interface RawTraitGiverDeclaration {
  readonly key: string;
  readonly label: string;
  readonly providerKind: 'olympian' | 'hermes' | 'hammer' | 'npc';
  readonly traitKeys: readonly string[];
  readonly priorityTraitKeys: readonly string[];
  readonly rarityPolicy:
    | { readonly kind: 'selectable'; readonly rarities: readonly TraitRarity[] }
    | { readonly kind: 'fixed'; readonly rarity: TraitRarity }
    | { readonly kind: 'none' };
  readonly defaultOffer?: RawTraitOfferDefaults;
  readonly denialParticipates?: boolean;
}

export interface RawTraitOfferContextDeclaration {
  readonly key: string;
  readonly kind: 'rewardRarityBlock' | 'roomFlag' | 'authoredCondition';
  readonly blockedRarity?: TraitRarity;
  readonly roomFlag?: 'BlockGiftBoons';
  readonly authoredCondition?: 'deathDefianceConditionMet' | 'circeRemovableFearVow';
}

export interface RawTraitCatalogInput {
  readonly weapons: readonly RawWeaponDeclaration[];
  readonly aspects: readonly RawAspectDeclaration[];
  readonly traits: readonly RawTraitDeclaration[];
  readonly givers: readonly RawTraitGiverDeclaration[];
  readonly echoLastRunBoon: {
    readonly sources: readonly {
      readonly giverKey: string;
      readonly lootHistorySource?: string;
    }[];
    readonly excludedTraitKeys: readonly string[];
  };
  readonly offerContexts: readonly RawTraitOfferContextDeclaration[];
  readonly deferredTraitKeys: readonly string[];
}

export type { TraitCatalog, TraitOfferDefaults, TraitRequirementExpression, TraitRarity };
