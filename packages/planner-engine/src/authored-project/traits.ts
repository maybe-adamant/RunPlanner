import type { Catalog, TraitRarity, TraitProviderKind } from '../catalog-schema';
import type { ResolvedRewardOffer } from '../reward-kernel/model';
import { levelResolutionEffectFor } from '../reward-kernel/level-effects';
import type { LevelResolutionEffectSource } from '../reward-kernel/level-effects';

export interface AuthoredTraitOption {
  readonly traitKey: string;
  /** Hammers intentionally omit rarity. */
  readonly rarity?: TraitRarity;
  /** Exact random equipped-trait outcome for a targeted acquisition. */
  readonly targetTraitKey?: string;
}

export interface AuthoredTraitOffer {
  readonly giverKey: string;
  readonly options: readonly [AuthoredTraitOption, AuthoredTraitOption, AuthoredTraitOption];
  readonly selectedOptionKey: 'option1' | 'option2' | 'option3';
  /** Present only when this giver's normalized offer requirements consume it. */
  readonly deathDefianceConditionMet?: boolean;
}

export type TraitOptionKey = AuthoredTraitOffer['selectedOptionKey'];

/** Makes the declaration-owned producer identity explicit at authored boundaries. */
export function producerLevelEffectSource(binding: {
  readonly producerLifecycleKey: string;
}): LevelResolutionEffectSource {
  return Object.freeze({ kind: 'producerLifecycle', key: binding.producerLifecycleKey });
}

export const TRAIT_OPTION_KEYS: readonly TraitOptionKey[] = Object.freeze([
  'option1',
  'option2',
  'option3',
]);

export interface EquippedTrait {
  readonly traitKey: string;
  readonly giverKey: string;
  readonly providerKind: TraitProviderKind;
  readonly rarity?: TraitRarity;
  /** Fresh Pom-eligible traits start at 1; replacement may inherit it elsewhere. */
  readonly level?: number;
  /** Hammers are rarityless player-facing traits with an independent I/II rank. */
  readonly hammerRank?: 'RankI' | 'RankII';
  readonly sourceRole: string;
}

/** Exact authored outcome for one declaration-owned Pom acquisition role. */
export type AuthoredLevelResolution =
  | {
      readonly kind: 'choice';
      readonly offeredTraitKeys: readonly string[];
      readonly selectedTraitKey: string | null;
    }
  | { readonly kind: 'random'; readonly targetTraitKey: string | null };

/** The declaration-owned Pom child is deliberately incomplete by default. */
export function createDefaultLevelResolutions(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  source: LevelResolutionEffectSource,
): Readonly<Record<string, AuthoredLevelResolution>> | undefined {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) throw new Error(`unknown reward type ${offer.rewardType}`);
  const result: Record<string, AuthoredLevelResolution> = {};
  for (const role of declaration.acquisitionRoles.values) {
    const effect = levelResolutionEffectFor(catalog.rewards, offer, source, role.key);
    if (effect === undefined) continue;
    result[role.key] = Object.freeze(
      effect.kind === 'visibleChoice'
        ? { kind: 'choice' as const, offeredTraitKeys: Object.freeze([]), selectedTraitKey: null }
        : { kind: 'random' as const, targetTraitKey: null },
    );
  }
  return Object.keys(result).length === 0 ? undefined : Object.freeze(result);
}

export interface TraitOfferDefaultsContext {
  readonly weaponKey: string;
  readonly aspectKey: string;
}

export function optionIndex(key: TraitOptionKey): 0 | 1 | 2 {
  return key === 'option1' ? 0 : key === 'option2' ? 1 : 2;
}

function requirementUsesContext(
  requirement: import('../catalog-schema').TraitRequirementExpression,
  context: import('../catalog-schema').TraitOfferContextKey,
): boolean {
  switch (requirement.kind) {
    case 'all':
      return requirement.requirements.some((child) => requirementUsesContext(child, context));
    case 'offerContext':
      return requirement.context === context;
    default:
      return false;
  }
}

/** Engine-owned authoring query for a declaration's source-local condition. */
export function traitGiverUsesOfferContext(
  catalog: Catalog,
  giverKey: string,
  context: import('../catalog-schema').TraitOfferContextKey,
): boolean {
  const giver = catalog.traitGivers.byKey[giverKey];
  return (
    giver?.traitKeys.some((traitKey) =>
      catalog.traits.byKey[traitKey]?.offerRequirements.some((requirement) =>
        requirementUsesContext(requirement, context),
      ),
    ) ?? false
  );
}

function giverForAcquisition(catalog: Catalog, gameName: string) {
  const key = gameName === 'WeaponUpgrade' ? 'WeaponUpgrade' : gameName.replace(/Upgrade$/, '');
  return catalog.traitGivers.byKey[key];
}

/** Resolves the catalog-owned provider for one reward acquisition role. */
export function traitGiverForAcquisitionRole(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  acquisitionRole: string,
): string | undefined {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  const role = declaration?.acquisitionRoles.values.find(
    (candidate) => candidate.key === acquisitionRole,
  );
  if (declaration === undefined || role === undefined) return undefined;
  let source: string | undefined;
  if (role.resolution.kind === 'self') source = declaration.gameName;
  else if (role.resolution.kind === 'fixed') source = role.resolution.acquisition.gameName;
  else {
    const value = offer.payload?.[role.resolution.field as keyof NonNullable<typeof offer.payload>];
    if (typeof value === 'string') source = value;
  }
  return source === undefined ? undefined : giverForAcquisition(catalog, source)?.key;
}

/** Returns one complete authored child for every in-scope acquisition role. */
export function createDefaultTraitOffers(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  loadout: TraitOfferDefaultsContext,
): Readonly<Record<string, AuthoredTraitOffer>> {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) throw new Error(`unknown reward type ${offer.rewardType}`);
  const result: Record<string, AuthoredTraitOffer> = {};
  for (const role of declaration.acquisitionRoles.values) {
    let gameName: string | undefined;
    if (role.resolution.kind === 'self') gameName = declaration.gameName;
    else if (role.resolution.kind === 'fixed') gameName = role.resolution.acquisition.gameName;
    else {
      const field = role.resolution.field;
      const payload = offer.payload;
      const value = payload?.[field as keyof typeof payload];
      if (typeof value === 'string') gameName = value;
    }
    if (gameName === undefined) continue;
    const giver = giverForAcquisition(catalog, gameName);
    if (giver === undefined) continue;
    const defaults =
      giver.defaultsByLoadout?.[`${loadout.weaponKey}:${loadout.aspectKey}`] ?? giver.defaultOffer;
    if (defaults === undefined) continue;
    result[role.key] = Object.freeze({
      giverKey: giver.key,
      options: Object.freeze(
        defaults.options.map((option) => Object.freeze({ ...option })),
      ) as AuthoredTraitOffer['options'],
      selectedOptionKey:
        defaults.selectedOption === 0
          ? 'option1'
          : defaults.selectedOption === 1
            ? 'option2'
            : 'option3',
      ...(traitGiverUsesOfferContext(catalog, giver.key, 'deathDefianceConditionMet')
        ? { deathDefianceConditionMet: false }
        : {}),
    });
  }
  return Object.freeze(result);
}

/** Creates the declaration-owned default for an encounter-local field-NPC offer. */
export function createDefaultEncounterTraitOffer(
  catalog: Catalog,
  encounterKey: string,
): AuthoredTraitOffer | undefined {
  const encounter = catalog.encounterDefinitions.byKey[encounterKey];
  const producer = encounter?.traitOfferProducer;
  if (producer === undefined) return undefined;
  const giver = catalog.traitGivers.byKey[producer.giverKey];
  const defaults = giver?.defaultOffer;
  if (giver === undefined || defaults === undefined) return undefined;
  return Object.freeze({
    giverKey: giver.key,
    options: Object.freeze(
      defaults.options.map((option) => Object.freeze({ ...option })),
    ) as AuthoredTraitOffer['options'],
    selectedOptionKey:
      defaults.selectedOption === 0
        ? 'option1'
        : defaults.selectedOption === 1
          ? 'option2'
          : 'option3',
    ...(traitGiverUsesOfferContext(catalog, giver.key, 'deathDefianceConditionMet')
      ? { deathDefianceConditionMet: false }
      : {}),
  });
}
