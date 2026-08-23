import type {
  TraitCatalog,
  TraitDeclaration,
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
  readonly offerRequirements: readonly TraitRequirementExpression[];
  readonly equipmentSlot?: TraitDeclaration['equipmentSlot'];
  readonly elementContributions: TraitDeclaration['elementContributions'];
  readonly usesBoonRarity: boolean;
  readonly blockStacking: boolean;
  readonly blockInRunRarify: boolean;
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
  readonly startingTrait?: { readonly traitKey: string; readonly giverKey: string };
}

export interface RawTraitGiverDeclaration {
  readonly key: string;
  readonly label: string;
  readonly providerKind: 'olympian' | 'hermes' | 'hammer' | 'npc' | 'spell' | 'chaos';
  readonly traitKeys: readonly string[];
  readonly priorityTraitKeys: readonly string[];
  readonly rarityPolicy:
    | { readonly kind: 'selectable'; readonly rarities: readonly TraitRarity[] }
    | { readonly kind: 'fixed'; readonly rarity: TraitRarity }
    | { readonly kind: 'none' };
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
  /** Explicit game acquisition-name bindings; never inferred from giver names. */
  readonly traitAcquisitionProviders: readonly {
    readonly gameName: string;
    readonly giverKey: string;
  }[];
  readonly boonRarityBases: Readonly<
    Record<'olympian' | 'hermes', import('@run-planner/engine/catalog-schema').BoonRarityValues>
  >;
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
  };
}

export type { TraitCatalog, TraitRequirementExpression, TraitRarity };
