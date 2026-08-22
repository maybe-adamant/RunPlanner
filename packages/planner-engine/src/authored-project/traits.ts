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
  /** All Together's complete one-result-per-source-set outcome when authored. */
  readonly allTogetherResult?: AuthoredAllTogetherResult;
}

export type AuthoredAllTogetherResult = Readonly<
  Record<import('../catalog-schema').DirectTraitSetKey, string | null>
>;

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
  /** Rejected keeps this exact generated row visible but unavailable. */
  readonly rejectedOptionKey?: TraitOptionKey;
}

export interface AuthoredTraitOfferFallbackGold {
  readonly kind: 'fallbackGold';
  readonly giverKey: string;
}

export type TraitOptionKey = 'option1' | 'option2' | 'option3';

/** The one selected transforming Chaos row.  Numeric records are declaration-closed. */
export interface AuthoredChaosTraitOffer {
  readonly kind: 'chaos';
  readonly giverKey: 'Chaos';
  readonly curseKey: string;
  readonly duration: number;
  readonly curseValues: Readonly<Record<string, number>>;
  readonly blessingKey: string;
  readonly rarity: Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary'>;
  readonly blessingValues: Readonly<Record<string, number>>;
}

export type AuthoredTraitOffer =
  AuthoredTraitOfferTraits | AuthoredTraitOfferFallbackGold | AuthoredChaosTraitOffer;

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

function normalizeChaosValues(
  expected: readonly import('../catalog-schema').ChaosNumericOperand[],
  value: Readonly<Record<string, number>>,
  label: string,
): Readonly<Record<string, number>> {
  const keys = Object.keys(value);
  if (
    keys.length !== expected.length ||
    expected.some((operand) => !Object.hasOwn(value, operand.key))
  )
    throw new Error(`${label} values must contain exactly the declaration operands`);
  for (const operand of expected) {
    const numeric = value[operand.key];
    if (numeric === undefined) throw new Error(`${label}.${operand.key} is required`);
    if (!Number.isFinite(numeric) || numeric < operand.minimum || numeric > operand.maximum)
      throw new Error(`${label}.${operand.key} is outside its declared domain`);
    if (operand.integer === true && !Number.isInteger(numeric))
      throw new Error(`${label}.${operand.key} must be an integer`);
    const steps = (numeric - operand.minimum) / operand.step;
    if (Math.abs(steps - Math.round(steps)) > 1e-8)
      throw new Error(`${label}.${operand.key} is not on its declared step`);
  }
  return Object.freeze(
    Object.fromEntries(expected.map((operand) => [operand.key, value[operand.key]!])),
  );
}

function chaosOperandsAtRarity(
  operands: readonly import('../catalog-schema').ChaosNumericOperand[],
  rarity: AuthoredChaosTraitOffer['rarity'],
): readonly import('../catalog-schema').ChaosNumericOperand[] {
  return operands.map((operand) => {
    const domain = operand.byRarity?.[rarity];
    if (domain === undefined) return operand;
    return Object.freeze({
      key: operand.key,
      label: operand.label,
      minimum: domain.minimum,
      maximum: domain.maximum,
      step: domain.step,
      ...(domain.integer === true ? { integer: true as const } : {}),
    });
  });
}

export function normalizeAuthoredChaosTraitOffer(
  catalog: Catalog,
  value: AuthoredChaosTraitOffer,
): AuthoredChaosTraitOffer {
  if (value.giverKey !== 'Chaos') throw new Error('Chaos pairs require the Chaos provider');
  const curse = catalog.chaos.curses.byKey[value.curseKey];
  const blessing = catalog.chaos.blessings.byKey[value.blessingKey];
  if (curse === undefined || blessing === undefined)
    throw new Error('unknown Chaos curse or blessing');
  const rarity = value.rarity;
  const legal =
    blessing.fixedRarity === 'Legendary'
      ? rarity === 'Legendary'
      : curse.semanticTag === 'Barren'
        ? rarity === 'Heroic'
        : rarity === 'Common' || rarity === 'Rare' || rarity === 'Epic';
  if (!legal) throw new Error('Chaos pair rarity is not legal for this selected pair');
  const duration = normalizeChaosValues(
    [curse.duration],
    { duration: value.duration },
    'duration',
  ).duration!;
  return Object.freeze({
    kind: 'chaos',
    giverKey: 'Chaos',
    curseKey: curse.key,
    duration,
    curseValues: normalizeChaosValues(curse.operands, value.curseValues, 'curseValues'),
    blessingKey: blessing.key,
    rarity,
    blessingValues: normalizeChaosValues(
      chaosOperandsAtRarity(blessing.operands, rarity),
      value.blessingValues,
      'blessingValues',
    ),
  });
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
  if (role.traitGiverKey !== undefined) return catalog.traitGivers.byKey[role.traitGiverKey]?.key;
  let source: string | undefined;
  if (role.resolution.kind === 'self') source = declaration.gameName;
  else if (role.resolution.kind === 'fixed') source = role.resolution.acquisition.gameName;
  else {
    const value = offer.payload?.[role.resolution.field as keyof NonNullable<typeof offer.payload>];
    if (typeof value === 'string') source = value;
  }
  const key = source === undefined ? undefined : catalog.traitGiverByAcquisitionGameName[source];
  return key === undefined ? undefined : catalog.traitGivers.byKey[key]?.key;
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
  producer: SelectedPickupProducer,
): Readonly<Record<string, import('./model').AuthoredRewardState | null>> {
  const entries: Record<string, import('./model').AuthoredRewardState | null> = {};
  for (const pickup of producer.pickups) {
    if (pickup.rewardType === undefined) {
      entries[pickup.key] = null;
      continue;
    }
    const declaration = catalog.rewards.rewardTypes.byKey[pickup.rewardType];
    if (declaration === undefined) throw new Error(`unknown pickup reward ${pickup.rewardType}`);
    entries[pickup.key] =
      declaration.payloadDomain === undefined
        ? createUnresolvedPickupRewardState(
            catalog,
            Object.freeze({ rewardType: pickup.rewardType }),
            producer.producerLifecycleKey,
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
  readonly producerLifecycleKey: string;
  /** Exact encounter contact whose selected trait activates these pickup rows. */
  readonly sourcePhaseKey: string;
  readonly pickups: readonly {
    readonly key: string;
    /** Omitted when exact prior history derives the generated reward identity. */
    readonly rewardType?: string;
    readonly required: boolean;
  }[];
}

export function echoLastRewardPickupEntryKey(
  phaseKey: string,
  encounterKey: string,
  optionKey: TraitOptionKey,
): string {
  return `echoLastReward:${phaseKey}:${encounterKey}:${optionKey}`;
}

/** Reattest one persisted Echo replay pickup key without exposing its encoding to consumers. */
export function parseEchoLastRewardPickupEntryKey(key: string):
  | {
      readonly phaseKey: string;
      readonly encounterKey: string;
      readonly optionKey: TraitOptionKey;
    }
  | undefined {
  const [kind, phaseKey, encounterKey, optionKey, ...remainder] = key.split(':');
  if (
    kind !== 'echoLastReward' ||
    phaseKey === undefined ||
    phaseKey.length === 0 ||
    encounterKey === undefined ||
    encounterKey.length === 0 ||
    optionKey === undefined ||
    !TRAIT_OPTION_KEYS.includes(optionKey as TraitOptionKey) ||
    remainder.length > 0
  )
    return undefined;
  return Object.freeze({
    phaseKey,
    encounterKey,
    optionKey: optionKey as TraitOptionKey,
  });
}

/** Every structurally owned Echo replay row, including dormant outer options. */
export function echoLastRewardPickupEntryKeys(
  catalog: Catalog,
  encounters: RoomEncounterState,
): readonly string[] {
  return Object.freeze(
    Object.entries(encounters.traitOffersByPhase ?? {}).flatMap(([phaseKey, offers]) =>
      Object.entries(offers).flatMap(([encounterKey, offer]) =>
        offer?.kind !== 'traits'
          ? []
          : offer.options.flatMap((option, index) => {
              const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              const optionKey = TRAIT_OPTION_KEYS[index];
              return disposition?.kind === 'echo' &&
                disposition.effect === 'lastReward' &&
                optionKey !== undefined
                ? [echoLastRewardPickupEntryKey(phaseKey, encounterKey, optionKey)]
                : [];
            }),
      ),
    ),
  );
}

/**
 * A pickup site belongs to the one selected descriptor across the occurrence's
 * complete encounter state, never to whichever phase happened to be edited.
 */
export function selectedPickupProducer(
  catalog: Catalog,
  encounters: RoomEncounterState,
): SelectedPickupProducer | undefined {
  const producers: readonly SelectedPickupProducer[] = Object.entries(
    encounters.traitOffersByPhase ?? {},
  ).flatMap(([phaseKey, offers]) =>
    Object.entries(offers).flatMap(([encounterKey, offer]): readonly SelectedPickupProducer[] => {
      if (offer?.kind !== 'traits') return [];
      const selected = offer.options[optionIndex(offer.selectedOptionKey)];
      if (selected === undefined) return [];
      const traitKey = selected.traitKey;
      const disposition = catalog.traits.byKey[traitKey]?.selectedDisposition;
      if (disposition?.kind === 'producePickups')
        return [
          Object.freeze({
            traitKey,
            producerLifecycleKey: disposition.producerLifecycleKey,
            sourcePhaseKey: phaseKey,
            pickups: Object.freeze(
              disposition.pickups.map((pickup) =>
                Object.freeze({ ...pickup, required: false as const }),
              ),
            ),
          }),
        ];
      if (disposition?.kind === 'echo' && disposition.effect === 'lastReward')
        return [
          Object.freeze({
            traitKey,
            producerLifecycleKey: 'EchoLastReward',
            sourcePhaseKey: phaseKey,
            pickups: Object.freeze([
              Object.freeze({
                key: echoLastRewardPickupEntryKey(phaseKey, encounterKey, offer.selectedOptionKey),
                required: true as const,
              }),
            ]),
          }),
        ];
      return [];
    }),
  );
  if (producers.length > 1)
    throw new Error('occurrence has more than one selected pickup producer');
  return producers[0];
}
