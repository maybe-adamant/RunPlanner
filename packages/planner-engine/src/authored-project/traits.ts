import type { Catalog, TraitRarity, TraitProviderKind } from '../catalog-schema';
import type { ResolvedRewardOffer } from '../reward-kernel/model';
import type { RoomEncounterState } from './model';
import { createNormalDispositionByAcquisitionRole } from './reward-state';
import { levelResolutionEffectFor } from '../reward-kernel/level-effects';
import type { LevelResolutionEffectSource } from '../reward-kernel/level-effects';

export interface AuthoredTraitOption {
  readonly traitKey: string;
  /** Planner-rarityless traits, including Hammers and Story/NPC traits, omit rarity. */
  readonly rarity?: TraitRarity;
  /** Exact random equipped-trait outcome for a targeted acquisition. */
  readonly targetTraitKey?: string;
  /** Circe's closed exact Arcana/Fear outcome. Detail may remain dormant on an unselected option. */
  readonly circeResolution?: AuthoredCirceResolution;
  /** Echo Pom's exact random greatest-level target; null records a legal empty-domain no-op. */
  readonly echoPomTarget?: string | null;
  /** Echo's explicit previous-run approximation; dormant when this outer row is not selected. */
  readonly echoLastRunBoon?: AuthoredEchoLastRunBoonOffer;
  /** Decisions owned by the exact recreated acquisition; replay identity stays derived. */
  readonly echoLastReward?: AuthoredEchoLastRewardAcquisition;
  /** All Together's complete one-result-per-source-set outcome. */
  readonly allTogetherResult?: AuthoredAllTogetherResult;
}

export type AuthoredAllTogetherResult = Readonly<
  Record<import('../catalog-schema').DirectTraitSetKey, string | null>
>;

export function createDefaultAllTogetherResult(
  catalog: Catalog,
  traitKey: string,
): AuthoredAllTogetherResult | undefined {
  const disposition = catalog.traits.byKey[traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'directTraitSets') return undefined;
  return Object.freeze(
    Object.fromEntries(disposition.sets.map((set) => [set.key, set.traitKeys[0]])),
  ) as AuthoredAllTogetherResult;
}

export function normalizeAllTogetherResult(
  catalog: Catalog,
  traitKey: string,
  value: AuthoredAllTogetherResult,
): AuthoredAllTogetherResult {
  const disposition = catalog.traits.byKey[traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'directTraitSets')
    throw new Error(`${traitKey} does not support an All Together result`);
  const expectedKeys = disposition.sets.map((set) => set.key);
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !actualKeys.includes(key))
  )
    throw new Error('All Together result must contain exactly earth, fire, air, and water');
  return Object.freeze(
    Object.fromEntries(
      disposition.sets.map((set) => {
        const selected = value[set.key];
        if (selected !== null && !set.traitKeys.includes(selected))
          throw new Error(`${String(selected)} is not a member of ${set.key}`);
        return [set.key, selected];
      }),
    ),
  ) as AuthoredAllTogetherResult;
}

/** Adds only declaration-complete static option detail. Contextual eligibility
 * remains entirely in simulation/candidate authorities. */
export function withDefaultTraitOptionDetail(
  catalog: Catalog,
  option: AuthoredTraitOption,
): AuthoredTraitOption {
  const allTogetherResult = createDefaultAllTogetherResult(catalog, option.traitKey);
  return Object.freeze({
    ...option,
    ...(allTogetherResult === undefined
      ? {}
      : { allTogetherResult: option.allTogetherResult ?? allTogetherResult }),
  });
}

export interface AuthoredEchoLastRewardAcquisition {
  readonly disposition: { readonly kind: 'normal' | 'timePiece' };
  readonly traitOffer?: AuthoredTraitOffer | null;
  readonly levelResolution?: AuthoredLevelResolution;
}

export function normalizeAuthoredEchoLastReward(
  catalog: Catalog,
  value: AuthoredEchoLastRewardAcquisition,
): AuthoredEchoLastRewardAcquisition {
  if (value.disposition.kind !== 'normal' && value.disposition.kind !== 'timePiece')
    throw new Error('Echo last-reward disposition must be normal or timePiece');
  const level = value.levelResolution;
  if (level?.kind === 'choice') {
    if (new Set(level.offeredTraitKeys).size !== level.offeredTraitKeys.length)
      throw new Error('Echo last-reward Pom choices must be distinct');
    if (level.offeredTraitKeys.some((key) => catalog.traits.byKey[key] === undefined))
      throw new Error('Echo last-reward Pom choice contains an unknown trait');
    if (level.selectedTraitKey !== null && !level.offeredTraitKeys.includes(level.selectedTraitKey))
      throw new Error('Echo last-reward Pom selection must be one of its choices');
  } else if (
    level?.kind === 'random' &&
    level.targetTraitKey !== null &&
    catalog.traits.byKey[level.targetTraitKey] === undefined
  ) {
    throw new Error('Echo last-reward random Pom target is unknown');
  }
  const traitOffer =
    value.traitOffer?.kind === 'traits'
      ? Object.freeze({
          ...value.traitOffer,
          options: Object.freeze([
            ...value.traitOffer.options,
          ]) as AuthoredTraitOfferTraits['options'],
          rarificationActions: Object.freeze([...(value.traitOffer.rarificationActions ?? [])]),
        })
      : value.traitOffer;
  return Object.freeze({
    disposition: Object.freeze({ ...value.disposition }),
    ...(traitOffer === undefined ? {} : { traitOffer }),
    ...(level === undefined
      ? {}
      : {
          levelResolution: Object.freeze(
            level.kind === 'choice'
              ? {
                  kind: 'choice' as const,
                  offeredTraitKeys: Object.freeze([...level.offeredTraitKeys]),
                  selectedTraitKey: level.selectedTraitKey,
                }
              : { kind: 'random' as const, targetTraitKey: level.targetTraitKey },
          ),
        }),
  });
}

export function createUnresolvedEchoLastRewardAcquisition(
  catalog: Catalog,
  recreation: NonNullable<
    import('../reward-kernel/model').RewardHistoryState['lastRewardRecreation']
  >,
): AuthoredEchoLastRewardAcquisition {
  const traitOffer = createUnresolvedTraitOffers(catalog, recreation.offer).self;
  const levelResolution = createUnresolvedLevelResolutions(
    catalog,
    recreation.offer,
    producerLevelEffectSource({ producerLifecycleKey: recreation.producerLifecycleKey }),
  )?.self;
  return Object.freeze({
    disposition: Object.freeze({ kind: 'normal' as const }),
    ...(traitOffer === undefined ? {} : { traitOffer }),
    ...(levelResolution === undefined ? {} : { levelResolution }),
  });
}

export interface AuthoredEchoLastRunBoonOption {
  readonly giverKey: string;
  readonly traitKey: string;
  readonly rarity: TraitRarity;
  /** Declaration-owned selected-acquisition detail, currently Bridal Glow's exact target. */
  readonly targetTraitKey?: string;
}

export interface AuthoredEchoLastRunBoonOffer {
  readonly options: OneToThree<AuthoredEchoLastRunBoonOption>;
  readonly selectedOptionKey: TraitOptionKey;
}

export type AuthoredCirceResolution =
  | { readonly kind: 'activateArcana'; readonly arcanaKeys: readonly string[] }
  | { readonly kind: 'promoteArcana'; readonly arcanaKeys: readonly string[] }
  | { readonly kind: 'disableFear'; readonly vowKey: string | null };

export type OneToThree<T> = readonly [T] | readonly [T, T] | readonly [T, T, T];

export interface AuthoredTraitOfferTraits {
  readonly kind: 'traits';
  readonly giverKey: string;
  readonly options: OneToThree<AuthoredTraitOption>;
  readonly selectedOptionKey: TraitOptionKey;
  /** Ordered explicit Calling Card row actions; base option rarity remains rolled/authored. */
  readonly rarificationActions?: readonly TraitOptionKey[];
  /** Present only when this giver's normalized offer requirements consume it. */
  readonly deathDefianceConditionMet?: boolean;
}

export interface AuthoredTraitOfferFallbackGold {
  readonly kind: 'fallbackGold';
  readonly giverKey: string;
}

export type AuthoredTraitOffer = AuthoredTraitOfferTraits | AuthoredTraitOfferFallbackGold;
export type TraitOptionKey = 'option1' | 'option2' | 'option3';

/** Gorgon persists only author decisions; provider and rarity are chronological facts. */
export interface AuthoredGorgonAthenaOffer {
  readonly traitKeys: readonly [string, string, string];
  readonly selectedOptionKey: TraitOptionKey;
}

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
  /** Hammers additionally carry an independent I/II rank. */
  readonly hammerRank?: 'RankI' | 'RankII';
  readonly sourceRole: string;
  /** Exact acquisition event that installed this instance. */
  readonly acquisitionIdentity?: string;
  /** Immutable acquisition-time target owned only by Gift Gift Gift. */
  readonly echoRepeatedKeepsakeKey?: string;
  /** Count of declaration-owned biome-start replay attempts recorded in trait history. */
  readonly echoKeepsakeReplayCount?: number;
}

/** Exact authored outcome for one declaration-owned Pom acquisition role. */
export type AuthoredLevelResolution =
  | {
      readonly kind: 'choice';
      readonly offeredTraitKeys: readonly string[];
      readonly selectedTraitKey: string | null;
    }
  | { readonly kind: 'random'; readonly targetTraitKey: string | null };

/** Constructs declaration-shaped, deliberately unresolved Pom children. */
export function createUnresolvedLevelResolutions(
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

export interface TraitOfferLoadoutContext {
  readonly weaponKey: string;
  readonly aspectKey: string;
}

export function optionIndex(key: TraitOptionKey): 0 | 1 | 2 {
  return key === 'option1' ? 0 : key === 'option2' ? 1 : 2;
}

/** Strict structural closure for Echo's source-resolved mixed-provider child. */
export function normalizeAuthoredEchoLastRunBoon(
  catalog: Catalog,
  value: AuthoredEchoLastRunBoonOffer,
): AuthoredEchoLastRunBoonOffer {
  if (value.options.length < 1 || value.options.length > 3)
    throw new Error('Echo last-run boon requires one to three options');
  if (new Set(value.options.map((option) => option.traitKey)).size !== value.options.length)
    throw new Error('Echo last-run boon trait keys must be distinct');
  if (
    !TRAIT_OPTION_KEYS.includes(value.selectedOptionKey) ||
    value.options[optionIndex(value.selectedOptionKey)] === undefined
  )
    throw new Error('Echo last-run boon must select a present option');
  const options = value.options.map((option) => {
    const variant = catalog.echoLastRunBoon.variants.byKey[`${option.giverKey}:${option.traitKey}`];
    if (variant === undefined)
      throw new Error(`${option.giverKey}.${option.traitKey} is not an Echo last-run source`);
    const trait = catalog.traits.byKey[option.traitKey];
    if (
      trait?.rarityDomain.kind !== 'ranked' ||
      !trait.rarityDomain.equippedRarities.includes(option.rarity)
    )
      throw new Error(`${option.rarity} is not an equipped rarity for ${option.traitKey}`);
    if (
      option.targetTraitKey !== undefined &&
      (option.targetTraitKey.length === 0 ||
        catalog.traits.byKey[option.targetTraitKey] === undefined)
    )
      throw new Error(`unknown Echo last-run acquisition target ${String(option.targetTraitKey)}`);
    if (option.targetTraitKey !== undefined && trait.targetedAcquisition === undefined)
      throw new Error(`${option.traitKey} does not support an Echo last-run acquisition target`);
    return Object.freeze({
      giverKey: option.giverKey,
      traitKey: option.traitKey,
      rarity: option.rarity,
      ...(option.targetTraitKey === undefined ? {} : { targetTraitKey: option.targetTraitKey }),
    });
  });
  return Object.freeze({
    options: Object.freeze(options) as AuthoredEchoLastRunBoonOffer['options'],
    selectedOptionKey: value.selectedOptionKey,
  });
}

export function traitOfferOption(
  offer: AuthoredTraitOffer,
  key: TraitOptionKey,
): AuthoredTraitOption | undefined {
  return offer.kind === 'traits' ? offer.options[optionIndex(key)] : undefined;
}

export function traitOfferSupportsExhaustion(giver: {
  readonly providerKind: TraitProviderKind;
}): boolean {
  return giver.providerKind === 'olympian' || giver.providerKind === 'hermes';
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

/**
 * Creates the exact acquisition-role shape for a newly authored concrete
 * reward without inventing a generated trait offer. Known providers own an
 * explicit unresolved value; roles without a trait giver remain absent.
 */
export function createUnresolvedTraitOffers(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): Readonly<Record<string, AuthoredTraitOffer | null>> {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) throw new Error(`unknown reward type ${offer.rewardType}`);
  return Object.freeze(
    Object.fromEntries(
      declaration.acquisitionRoles.values.flatMap((role) =>
        traitGiverForAcquisitionRole(catalog, offer, role.key) === undefined
          ? []
          : [[role.key, null] as const],
      ),
    ),
  );
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
    kind: 'traits',
    giverKey: giver.key,
    options: Object.freeze(
      defaults.options.map((option) => {
        const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
        return withDefaultTraitOptionDetail(catalog, {
          ...option,
          ...(disposition?.kind === 'echo' && disposition.effect === 'doubleLevel'
            ? { echoPomTarget: null }
            : {}),
        });
      }),
    ) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey:
      defaults.selectedOption === 0
        ? 'option1'
        : defaults.selectedOption === 1
          ? 'option2'
          : 'option3',
    rarificationActions: Object.freeze([]),
    ...(traitGiverUsesOfferContext(catalog, giver.key, 'deathDefianceConditionMet')
      ? { deathDefianceConditionMet: false }
      : {}),
  });
}

/** Declaration-owned Athena decisions for one Gorgon child. */
export function createDefaultGorgonAthenaOffer(
  catalog: Catalog,
): AuthoredGorgonAthenaOffer | undefined {
  const keepsake = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
  );
  const effect = keepsake?.effect;
  const providerKey = effect?.kind === 'gorgonAmulet' ? effect.providerKey : undefined;
  const giver = providerKey === undefined ? undefined : catalog.traitGivers.byKey[providerKey];
  const defaults = giver?.defaultOffer;
  if (giver === undefined || defaults === undefined) return undefined;
  return Object.freeze({
    traitKeys: Object.freeze(defaults.options.map((option) => option.traitKey)) as readonly [
      string,
      string,
      string,
    ],
    selectedOptionKey:
      defaults.selectedOption === 0
        ? 'option1'
        : defaults.selectedOption === 1
          ? 'option2'
          : 'option3',
  });
}

/** Transient full offer consumed by ordinary assessment and presentation. */
export function materializeGorgonAthenaOffer(
  catalog: Catalog,
  value: AuthoredGorgonAthenaOffer,
  rarity?: TraitRarity,
): AuthoredTraitOfferTraits | undefined {
  const effect = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
  )?.effect;
  if (
    effect?.kind !== 'gorgonAmulet' ||
    catalog.traitGivers.byKey[effect.providerKey] === undefined
  )
    return undefined;
  return Object.freeze({
    kind: 'traits',
    giverKey: effect.providerKey,
    options: Object.freeze(
      value.traitKeys.map((traitKey) =>
        Object.freeze({ traitKey, ...(rarity === undefined ? {} : { rarity }) }),
      ),
    ) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: value.selectedOptionKey,
    rarificationActions: Object.freeze([]),
  });
}

/**
 * Constructs every fixed pickup identity for one selected producer. Variable
 * payloads and acquisition-owned child authorship remain unresolved.
 */
export function createSelectedPickupEntries(
  catalog: Catalog,
  selectedTraitKey: string,
): Readonly<Record<string, import('./model').AuthoredRewardState | null>> {
  const disposition = catalog.traits.byKey[selectedTraitKey]?.selectedDisposition;
  if (disposition?.kind !== 'producePickups') return Object.freeze({});
  const entries: Record<string, import('./model').AuthoredRewardState | null> = {};
  for (const pickup of disposition.pickups) {
    const declaration = catalog.rewards.rewardTypes.byKey[pickup.rewardType];
    if (declaration === undefined) throw new Error(`unknown pickup reward ${pickup.rewardType}`);
    entries[pickup.key] =
      declaration.payloadDomain === undefined
        ? createUnresolvedPickupRewardState(
            catalog,
            Object.freeze({ rewardType: pickup.rewardType }),
            disposition.producerLifecycleKey,
          )
        : null;
  }
  return Object.freeze(entries);
}

/** One command-complete pickup entry for a fixed reward identity and payload. */
export function createUnresolvedPickupRewardState(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  producerLifecycleKey: string,
): import('./model').AuthoredRewardState {
  return createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'producerLifecycle',
    key: producerLifecycleKey,
  });
}

/** One command-complete reward state for a reached concrete acquisition source. */
export function createUnresolvedAcquisitionRewardState(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  levelEffectSource: LevelResolutionEffectSource,
): import('./model').AuthoredRewardState {
  return createUnresolvedAcquisitionRewardStateForEffect(catalog, offer, levelEffectSource);
}

/** Exact unresolved child state for an engine-derived World Shop acquisition. */
export function createUnresolvedShopAcquisitionRewardState(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  shopProfileKey: string,
): import('./model').AuthoredRewardState {
  return createUnresolvedAcquisitionRewardStateForEffect(catalog, offer, {
    kind: 'shopProfile',
    key: shopProfileKey,
  });
}

function createUnresolvedAcquisitionRewardStateForEffect(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  levelEffectSource: LevelResolutionEffectSource,
): import('./model').AuthoredRewardState {
  const levels = createUnresolvedLevelResolutions(catalog, offer, levelEffectSource);
  return Object.freeze({
    offer,
    dispositionByAcquisitionRole: createNormalDispositionByAcquisitionRole(catalog, offer),
    traitOffersByAcquisitionRole: createUnresolvedTraitOffers(catalog, offer),
    ...(levels === undefined ? {} : { levelResolutionsByAcquisitionRole: levels }),
  });
}

export interface SelectedPickupProducer {
  readonly traitKey: string;
  readonly disposition: Extract<
    import('../catalog-schema').TraitSelectedDisposition,
    { readonly kind: 'producePickups' }
  >;
}

/**
 * A pickup site belongs to the one selected descriptor across the occurrence's
 * complete encounter state, never to whichever phase happened to be edited.
 */
export function selectedPickupProducer(
  catalog: Catalog,
  encounters: RoomEncounterState,
): SelectedPickupProducer | undefined {
  const producers = Object.values(encounters.traitOffersByPhase ?? {})
    .flatMap((offers) => Object.values(offers))
    .flatMap((offer) => {
      if (offer.kind === 'fallbackGold') return [];
      const selected = offer.options[optionIndex(offer.selectedOptionKey)];
      if (selected === undefined) return [];
      const traitKey = selected.traitKey;
      const disposition = catalog.traits.byKey[traitKey]?.selectedDisposition;
      return disposition?.kind === 'producePickups'
        ? [Object.freeze({ traitKey, disposition })]
        : [];
    });
  if (producers.length > 1)
    throw new Error('occurrence has more than one selected pickup producer');
  return producers[0];
}
