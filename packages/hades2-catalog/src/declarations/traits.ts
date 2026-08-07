import type {
  AspectDeclaration,
  TraitCatalog,
  TraitDeclaration,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
  TraitOfferDefaults,
  TraitRequirementExpression,
  TraitRarity,
  WeaponDeclaration,
} from '@run-planner/engine/catalog-schema';

export type RawTraitDeclaration = TraitDeclaration;
export type RawWeaponDeclaration = WeaponDeclaration;
export type RawAspectDeclaration = AspectDeclaration;
export type RawTraitGiverDeclaration = TraitGiverDeclaration;
export type RawTraitOfferContextDeclaration = TraitOfferContextDeclaration;

export interface RawTraitCatalogInput {
  readonly weapons: readonly RawWeaponDeclaration[];
  readonly aspects: readonly RawAspectDeclaration[];
  readonly traits: readonly RawTraitDeclaration[];
  readonly givers: readonly RawTraitGiverDeclaration[];
  readonly offerContexts: readonly RawTraitOfferContextDeclaration[];
  readonly deferredTraitKeys: readonly string[];
}

export type { TraitCatalog, TraitOfferDefaults, TraitRequirementExpression, TraitRarity };
