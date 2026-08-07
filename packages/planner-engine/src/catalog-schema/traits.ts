import type { CatalogCollection } from '../normalized/collection';

export type TraitProviderKind = 'olympian' | 'hermes' | 'hammer';

/** Rarities that can exist on an equipped trait or a fresh offer. */
export type TraitRarity = 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary' | 'Duo';

export type TraitElement = 'Aether' | 'Earth' | 'Air' | 'Fire' | 'Water';

export type TraitOrdinaryBoonSlot = 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana';

export type TraitOfferContextKey = 'devotionNoDuo' | 'blockGiftBoons';

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
      readonly kind: 'superchargeableTrait';
    }
  | {
      readonly kind: 'offerContext';
      readonly context: TraitOfferContextKey;
      readonly required: boolean;
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
}

export interface TraitDeclaration {
  readonly key: string;
  readonly label: string;
  readonly freshOfferRarities: readonly TraitRarity[];
  readonly equippedRarities: readonly TraitRarity[];
  readonly offerRequirements: readonly TraitRequirementExpression[];
  readonly ordinaryBoonSlot?: TraitOrdinaryBoonSlot;
  readonly elementContributions: Readonly<Partial<Record<TraitElement, number>>>;
  readonly isPersistentGodTrait: boolean;
  readonly blockStacking: boolean;
  readonly blockInRunRarify: boolean;
  readonly excludeFromRarityCount: boolean;
  readonly selfExclusion?: string;
  readonly hammerCompatibility?: HammerCompatibility;
}

export interface TraitOfferOptionDefault {
  readonly traitKey: string;
  readonly rarity: TraitRarity;
}

export interface TraitOfferDefaults {
  readonly options: readonly [
    TraitOfferOptionDefault,
    TraitOfferOptionDefault,
    TraitOfferOptionDefault,
  ];
  readonly selectedOption: 0 | 1 | 2;
}

export type TraitGiverRarityPolicy =
  | { readonly kind: 'selectable'; readonly rarities: readonly TraitRarity[] }
  | { readonly kind: 'fixed'; readonly rarity: TraitRarity };

export interface TraitGiverDeclaration {
  readonly key: string;
  readonly label: string;
  readonly providerKind: TraitProviderKind;
  readonly traitKeys: readonly string[];
  readonly rarityPolicy: TraitGiverRarityPolicy;
  readonly defaultOffer?: TraitOfferDefaults;
  readonly defaultsByLoadout?: Readonly<Record<string, TraitOfferDefaults>>;
}

export interface TraitOfferContextDeclaration {
  readonly key: TraitOfferContextKey;
  readonly kind: 'rewardRarityBlock' | 'roomFlag';
  readonly blockedRarity?: TraitRarity;
  readonly roomFlag?: 'BlockGiftBoons';
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
  readonly deferredTraitKeys: readonly string[];
}
