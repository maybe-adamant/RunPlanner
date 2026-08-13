import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '../../catalog-schema';
import type { CountedRewardBinding, ShopRewardBinding } from '../../reward-kernel/bindings';
import type {
  ResolvedRewardOffer,
  RewardPayload,
  RewardTypeDeclaration,
  ShopProfileDeclaration,
} from '../../reward-kernel/model';
import type {
  AuthoredRewardState,
  AuthoredRoomState,
  EphyraCombatState,
  EphyraSideRoomState,
  RewardWheelState,
  ShipCombatState,
  ShopOfferState,
  ShopState,
} from '../model';
import {
  expectExactKeys,
  expectArray,
  expectBoolean,
  expectPositiveInteger,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import {
  authoredTemplateKey,
  requireCountedBinding,
  requireEphyraSideRooms,
  requireFieldsCages,
  requireOrdinaryRole,
  requireShipCombatWheels,
  requireShopBinding,
  type RoomStateContext,
} from './declaration';
import { decodeRoomEncounterState } from './encounters';
import {
  traitOfferSupportsExhaustion,
  type AuthoredLevelResolution,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type TraitOptionKey,
} from '../traits';
import {
  createDefaultLevelResolutions,
  TRAIT_OPTION_KEYS,
  traitGiverUsesOfferContext,
} from '../traits';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import { shopProfileUsesDeathDefianceCondition } from '../shop';

function decodePayload(
  value: unknown,
  rewardType: RewardTypeDeclaration,
  catalog: Catalog,
  path: string,
): RewardPayload | undefined {
  if (rewardType.payloadDomain === undefined) {
    if (value !== undefined) {
      failProjectDocument(path, `${rewardType.gameName} does not accept a payload`);
    }
    return undefined;
  }
  if (value === undefined) {
    failProjectDocument(path, `${rewardType.gameName} requires a payload`);
  }
  const domain = catalog.rewards.payloadDomains.byKey[rewardType.payloadDomain];
  if (domain === undefined) {
    failProjectDocument(path, `unknown payload domain ${rewardType.payloadDomain}`);
  }
  const payload = expectRecord(value, path);
  if (domain.kind === 'oneOf') {
    expectExactKeys(payload, ['kind', 'source'], path);
    if (expectString(payload.kind, `${path}.kind`) !== 'BoonSource') {
      failProjectDocument(`${path}.kind`, 'expected BoonSource');
    }
    const source = expectString(payload.source, `${path}.source`);
    if (!domain.values.includes(source)) {
      failProjectDocument(`${path}.source`, `${source} is not in ${domain.key}`);
    }
    return Object.freeze({ kind: 'BoonSource', source });
  }
  expectExactKeys(payload, ['kind', 'chosenSource', 'spurnedSource'], path);
  if (expectString(payload.kind, `${path}.kind`) !== 'DevotionPair') {
    failProjectDocument(`${path}.kind`, 'expected DevotionPair');
  }
  const chosenSource = expectString(payload.chosenSource, `${path}.chosenSource`);
  const spurnedSource = expectString(payload.spurnedSource, `${path}.spurnedSource`);
  if (chosenSource === spurnedSource) {
    failProjectDocument(path, 'chosenSource and spurnedSource must be distinct');
  }
  const valueDomain = catalog.rewards.payloadDomains.byKey[domain.valueDomain];
  if (valueDomain?.kind !== 'oneOf') {
    failProjectDocument(path, `invalid value domain ${domain.valueDomain}`);
  }
  for (const [field, source] of [
    ['chosenSource', chosenSource],
    ['spurnedSource', spurnedSource],
  ] as const) {
    if (!valueDomain.values.includes(source)) {
      failProjectDocument(`${path}.${field}`, `${source} is not in ${valueDomain.key}`);
    }
  }
  return Object.freeze({ kind: 'DevotionPair', chosenSource, spurnedSource });
}

function decodeOffer(value: unknown, catalog: Catalog, path: string): ResolvedRewardOffer {
  const offer = expectRecord(value, path);
  expectExactKeys(offer, ['rewardType', 'payload'], path);
  const rewardTypeName = expectString(offer.rewardType, `${path}.rewardType`);
  const rewardType = catalog.rewards.rewardTypes.byKey[rewardTypeName];
  if (rewardType === undefined) {
    failProjectDocument(`${path}.rewardType`, `unknown reward type ${rewardTypeName}`);
  }
  const payload = decodePayload(offer.payload, rewardType, catalog, `${path}.payload`);
  return Object.freeze({
    rewardType: rewardTypeName,
    ...(payload === undefined ? {} : { payload }),
  });
}

function traitGiverForSource(catalog: Catalog, source: string) {
  return catalog.traitGivers.byKey[
    source === 'WeaponUpgrade' ? source : source.replace(/Upgrade$/, '')
  ];
}

function expectedTraitRoles(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): Readonly<Record<string, string>> {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) return {};
  const result: Record<string, string> = {};
  for (const role of declaration.acquisitionRoles.values) {
    let source: string | undefined;
    if (role.resolution.kind === 'self') source = declaration.gameName;
    else if (role.resolution.kind === 'fixed') source = role.resolution.acquisition.gameName;
    else {
      const value =
        offer.payload?.[role.resolution.field as keyof NonNullable<typeof offer.payload>];
      if (typeof value === 'string') source = value;
    }
    if (source !== undefined && traitGiverForSource(catalog, source) !== undefined)
      result[role.key] = traitGiverForSource(catalog, source)!.key;
  }
  return result;
}

function decodeTraitOffers(
  value: unknown,
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  path: string,
): Readonly<Record<string, AuthoredTraitOffer>> {
  const expected = expectedTraitRoles(catalog, offer);
  if (value === undefined && Object.keys(expected).length === 0) return Object.freeze({});
  const raw = expectRecord(value, path);
  expectExactKeys(raw, Object.keys(expected), path);
  const result: Record<string, AuthoredTraitOffer> = {};
  for (const [roleKey, giverKey] of Object.entries(expected)) {
    const rolePath = `${path}.${roleKey}`;
    const record = expectRecord(raw[roleKey], rolePath);
    const conditionApplicable = traitGiverUsesOfferContext(
      catalog,
      giverKey,
      'deathDefianceConditionMet',
    );
    if (expectString(record.giverKey, `${rolePath}.giverKey`) !== giverKey)
      failProjectDocument(`${rolePath}.giverKey`, `expected ${giverKey}`);
    const giver = catalog.traitGivers.byKey[giverKey];
    if (giver === undefined) failProjectDocument(rolePath, `unknown giver ${giverKey}`);
    const kind = expectString(record.kind, `${rolePath}.kind`);
    if (kind === 'fallbackGold') {
      expectExactKeys(record, ['kind', 'giverKey'], rolePath);
      if (!traitOfferSupportsExhaustion(giver))
        failProjectDocument(rolePath, 'Fallback Gold is not supported by this giver');
      result[roleKey] = Object.freeze({ kind: 'fallbackGold', giverKey });
      continue;
    }
    if (kind !== 'traits')
      failProjectDocument(`${rolePath}.kind`, 'must be traits or fallbackGold');
    expectExactKeys(
      record,
      [
        'kind',
        'giverKey',
        'options',
        'selectedOptionKey',
        'rarificationActions',
        ...(conditionApplicable ? ['deathDefianceConditionMet'] : []),
      ],
      rolePath,
    );
    const optionsRaw = expectArray(record.options, `${rolePath}.options`);
    if (optionsRaw.length < 1 || optionsRaw.length > TRAIT_OPTION_KEYS.length)
      failProjectDocument(
        `${rolePath}.options`,
        `must contain one to ${TRAIT_OPTION_KEYS.length} options`,
      );
    if (!traitOfferSupportsExhaustion(giver) && optionsRaw.length !== TRAIT_OPTION_KEYS.length)
      failProjectDocument(`${rolePath}.options`, 'this giver requires exactly three options');
    const options: AuthoredTraitOption[] = [];
    const traitKeys = new Set<string>();
    for (const [index, key] of TRAIT_OPTION_KEYS.entries()) {
      if (index >= optionsRaw.length) break;
      const option = expectRecord(optionsRaw[index], `${rolePath}.options.${key}`);
      expectExactKeys(
        option,
        [
          'traitKey',
          ...(option.rarity === undefined ? [] : ['rarity']),
          ...(option.targetTraitKey === undefined ? [] : ['targetTraitKey']),
          ...(option.circeResolution === undefined ? [] : ['circeResolution']),
        ],
        `${rolePath}.options.${key}`,
      );
      const traitKey = expectString(option.traitKey, `${rolePath}.options.${key}.traitKey`);
      if (traitKeys.has(traitKey))
        failProjectDocument(
          `${rolePath}.options.${key}.traitKey`,
          `${traitKey} is duplicated in the trait offer`,
        );
      traitKeys.add(traitKey);
      const trait = catalog.traits.byKey[traitKey];
      if (trait === undefined || !giver.traitKeys.includes(traitKey))
        failProjectDocument(
          `${rolePath}.options.${key}.traitKey`,
          `${traitKey} is not in giver ${giverKey}`,
        );
      const rarity =
        option.rarity === undefined
          ? undefined
          : (expectString(
              option.rarity,
              `${rolePath}.options.${key}.rarity`,
            ) as AuthoredTraitOption['rarity']);
      if (trait.rarityDomain.kind === 'none' && rarity !== undefined)
        failProjectDocument(`${rolePath}.options.${key}.rarity`, 'Hammer options have no rarity');
      if (
        trait.rarityDomain.kind === 'ranked' &&
        (rarity === undefined || !trait.rarityDomain.equippedRarities.includes(rarity))
      )
        failProjectDocument(
          `${rolePath}.options.${key}.rarity`,
          `unsupported authored rarity for ${traitKey}`,
        );
      if (giver.rarityPolicy.kind === 'fixed' && rarity !== giver.rarityPolicy.rarity)
        failProjectDocument(
          `${rolePath}.options.${key}.rarity`,
          `${traitKey} must use fixed rarity ${giver.rarityPolicy.rarity}`,
        );
      const targetTraitKey =
        option.targetTraitKey === undefined
          ? undefined
          : expectString(option.targetTraitKey, `${rolePath}.options.${key}.targetTraitKey`);
      if (targetTraitKey !== undefined) {
        if (trait.targetedAcquisition === undefined)
          failProjectDocument(
            `${rolePath}.options.${key}.targetTraitKey`,
            `${traitKey} does not target another trait on acquisition`,
          );
        if (catalog.traits.byKey[targetTraitKey] === undefined)
          failProjectDocument(
            `${rolePath}.options.${key}.targetTraitKey`,
            `unknown trait ${targetTraitKey}`,
          );
      }
      let circeResolution: AuthoredTraitOption['circeResolution'];
      if (option.circeResolution !== undefined) {
        const resolution = expectRecord(
          option.circeResolution,
          `${rolePath}.options.${key}.circeResolution`,
        );
        const kind = expectString(
          resolution.kind,
          `${rolePath}.options.${key}.circeResolution.kind`,
        );
        if (kind === 'disableFear') {
          expectExactKeys(
            resolution,
            ['kind', 'vowKey'],
            `${rolePath}.options.${key}.circeResolution`,
          );
          if (resolution.vowKey !== null && typeof resolution.vowKey !== 'string')
            failProjectDocument(
              `${rolePath}.options.${key}.circeResolution.vowKey`,
              'must be a Vow key or null',
            );
          if (
            typeof resolution.vowKey === 'string' &&
            catalog.fearVows.byKey[resolution.vowKey] === undefined
          )
            failProjectDocument(`${rolePath}.options.${key}.circeResolution.vowKey`, 'unknown Vow');
          circeResolution = Object.freeze({ kind, vowKey: resolution.vowKey as string | null });
        } else if (kind === 'activateArcana' || kind === 'promoteArcana') {
          expectExactKeys(
            resolution,
            ['kind', 'arcanaKeys'],
            `${rolePath}.options.${key}.circeResolution`,
          );
          const keys = expectArray(
            resolution.arcanaKeys,
            `${rolePath}.options.${key}.circeResolution.arcanaKeys`,
          ).map((entry, keyIndex) =>
            expectString(
              entry,
              `${rolePath}.options.${key}.circeResolution.arcanaKeys[${keyIndex}]`,
            ),
          );
          if (
            new Set(keys).size !== keys.length ||
            keys.some((arcanaKey) => catalog.arcanaCards.byKey[arcanaKey] === undefined)
          )
            failProjectDocument(
              `${rolePath}.options.${key}.circeResolution`,
              'must contain distinct known Arcana keys',
            );
          circeResolution = Object.freeze({
            kind,
            arcanaKeys: Object.freeze(
              catalog.arcanaCards.values
                .filter((card) => keys.includes(card.key))
                .map((card) => card.key),
            ),
          });
        } else
          failProjectDocument(
            `${rolePath}.options.${key}.circeResolution.kind`,
            'unknown Circe resolution',
          );
        const expected =
          trait.selectedDisposition.kind === 'circe' ? trait.selectedDisposition.effect : undefined;
        if (
          expected === undefined ||
          circeResolution === undefined ||
          circeResolution.kind !== expected
        )
          failProjectDocument(
            `${rolePath}.options.${key}.circeResolution`,
            'does not match the Circe trait policy',
          );
      }
      options.push(
        Object.freeze({
          traitKey,
          ...(rarity === undefined ? {} : { rarity }),
          ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
          ...(circeResolution === undefined ? {} : { circeResolution }),
        }),
      );
    }
    const selected = expectString(record.selectedOptionKey, `${rolePath}.selectedOptionKey`);
    const rarificationActions = expectArray(
      record.rarificationActions,
      `${rolePath}.rarificationActions`,
    ).map((value, index) => {
      const key = expectString(value, `${rolePath}.rarificationActions[${index}]`);
      if (!(TRAIT_OPTION_KEYS as readonly string[]).includes(key))
        failProjectDocument(`${rolePath}.rarificationActions[${index}]`, 'must name an option row');
      return key as TraitOptionKey;
    });
    if (
      !(TRAIT_OPTION_KEYS as readonly string[]).includes(selected) ||
      options[TRAIT_OPTION_KEYS.indexOf(selected as never)] === undefined
    )
      failProjectDocument(
        `${rolePath}.selectedOptionKey`,
        'must select option1, option2, or option3',
      );
    result[roleKey] = Object.freeze({
      kind: 'traits',
      giverKey,
      options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: selected as AuthoredTraitOfferTraits['selectedOptionKey'],
      rarificationActions: Object.freeze(rarificationActions),
      ...(conditionApplicable
        ? {
            deathDefianceConditionMet: expectBoolean(
              record.deathDefianceConditionMet,
              `${rolePath}.deathDefianceConditionMet`,
            ),
          }
        : {}),
    });
  }
  return Object.freeze(result);
}

function decodeCountedOffer(
  value: unknown,
  catalog: Catalog,
  binding: CountedRewardBinding,
  path: string,
): ResolvedRewardOffer {
  const offer = decodeOffer(value, catalog, path);
  if (!binding.allowedRewardTypes.includes(offer.rewardType)) {
    failProjectDocument(`${path}.rewardType`, `${offer.rewardType} is filtered from this room`);
  }
  return offer;
}

export function decodeRewardState(
  value: unknown,
  catalog: Catalog,
  path: string,
  source: import('../../reward-kernel/level-effects').LevelResolutionEffectSource,
): AuthoredRewardState {
  const raw = expectRecord(value, path);
  for (const key of Object.keys(raw)) {
    if (
      ![
        'offer',
        'traitOffersByAcquisitionRole',
        'levelResolutionsByAcquisitionRole',
        'conversionByAcquisitionRole',
      ].includes(key)
    )
      failProjectDocument(path, `unexpected key ${key}`);
  }
  const offer = decodeOffer(raw.offer, catalog, `${path}.offer`);
  const requiredLevels = createDefaultLevelResolutions(catalog, offer, source);
  if (requiredLevels === undefined && raw.levelResolutionsByAcquisitionRole !== undefined)
    failProjectDocument(
      `${path}.levelResolutionsByAcquisitionRole`,
      'Pom resolutions are not supported',
    );
  if (requiredLevels !== undefined && raw.levelResolutionsByAcquisitionRole === undefined)
    failProjectDocument(
      `${path}.levelResolutionsByAcquisitionRole`,
      'is required for this Pom reward',
    );
  const levels =
    raw.levelResolutionsByAcquisitionRole === undefined
      ? undefined
      : decodeLevelResolutions(
          raw.levelResolutionsByAcquisitionRole,
          catalog,
          offer,
          source,
          `${path}.levelResolutionsByAcquisitionRole`,
        );
  if (raw.conversionByAcquisitionRole === undefined)
    failProjectDocument(`${path}.conversionByAcquisitionRole`, 'is required');
  const conversionByAcquisitionRole = decodeConversionDispositions(
    raw.conversionByAcquisitionRole,
    catalog,
    offer,
    `${path}.conversionByAcquisitionRole`,
  );
  return Object.freeze({
    offer,
    traitOffersByAcquisitionRole: decodeTraitOffers(
      raw.traitOffersByAcquisitionRole,
      catalog,
      offer,
      `${path}.traitOffersByAcquisitionRole`,
    ),
    ...(levels === undefined ? {} : { levelResolutionsByAcquisitionRole: levels }),
    conversionByAcquisitionRole,
  });
}

/**
 * Time Piece owns a closed disposition for every concrete declaration role.
 * The required map is explicit: documents never receive an implicit normal
 * conversion disposition during decoding.
 */
function decodeConversionDispositions(
  value: unknown,
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  path: string,
): Readonly<Record<string, 'normal' | 'gold'>> {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined)
    failProjectDocument(path, `unknown reward type ${offer.rewardType}`);
  const roles = declaration.acquisitionRoles.values.map((role) => role.key);
  const raw = expectRecord(value, path);
  for (const key of Object.keys(raw)) {
    if (!roles.includes(key)) failProjectDocument(`${path}.${key}`, 'is not an acquisition role');
  }
  return Object.freeze(
    Object.fromEntries(
      roles.map((role) => {
        const disposition = raw[role];
        if (disposition !== 'normal' && disposition !== 'gold') {
          failProjectDocument(`${path}.${role}`, 'must be normal or gold');
        }
        return [role, disposition] as const;
      }),
    ),
  );
}

function decodeLevelResolutions(
  value: unknown,
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  source: import('../../reward-kernel/level-effects').LevelResolutionEffectSource,
  path: string,
): Readonly<Record<string, AuthoredLevelResolution>> {
  const raw = expectRecord(value, path);
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined)
    failProjectDocument(path, `unknown reward type ${offer.rewardType}`);
  const expectedRoles = declaration.acquisitionRoles.values.flatMap((role) =>
    levelResolutionEffectFor(catalog.rewards, offer, source, role.key) === undefined
      ? []
      : [role.key],
  );
  if (expectedRoles.length === 0) {
    if (Object.keys(raw).length > 0) failProjectDocument(path, 'Pom resolutions are not supported');
    return Object.freeze({});
  }
  if (
    Object.keys(raw).length !== expectedRoles.length ||
    expectedRoles.some((role) => raw[role] === undefined)
  )
    failProjectDocument(path, 'must contain exactly every Pom acquisition role');
  const result: Record<string, AuthoredLevelResolution> = {};
  for (const [role, encoded] of Object.entries(raw)) {
    const effect = levelResolutionEffectFor(catalog.rewards, offer, source, role);
    if (effect === undefined)
      failProjectDocument(`${path}.${role}`, 'has no Pom level-resolution effect');
    const entry = expectRecord(encoded, `${path}.${role}`);
    if (effect.kind === 'visibleChoice') {
      expectExactKeys(entry, ['kind', 'offeredTraitKeys', 'selectedTraitKey'], `${path}.${role}`);
      if (expectString(entry.kind, `${path}.${role}.kind`) !== 'choice')
        failProjectDocument(`${path}.${role}.kind`, 'expected choice');
      const keys = expectArray(entry.offeredTraitKeys, `${path}.${role}.offeredTraitKeys`).map(
        (candidate, index) => {
          const key = expectString(candidate, `${path}.${role}.offeredTraitKeys[${index}]`);
          if (catalog.traits.byKey[key] === undefined)
            failProjectDocument(
              `${path}.${role}.offeredTraitKeys[${index}]`,
              `unknown trait ${key}`,
            );
          return key;
        },
      );
      if (new Set(keys).size !== keys.length)
        failProjectDocument(`${path}.${role}.offeredTraitKeys`, 'must be distinct');
      const selected =
        entry.selectedTraitKey === null
          ? null
          : expectString(entry.selectedTraitKey, `${path}.${role}.selectedTraitKey`);
      if (selected !== null && catalog.traits.byKey[selected] === undefined)
        failProjectDocument(`${path}.${role}.selectedTraitKey`, `unknown trait ${selected}`);
      if (selected !== null && !keys.includes(selected))
        failProjectDocument(
          `${path}.${role}.selectedTraitKey`,
          'must be one of the offered trait keys',
        );
      result[role] = Object.freeze({
        kind: 'choice',
        offeredTraitKeys: Object.freeze(keys),
        selectedTraitKey: selected,
      });
    } else {
      expectExactKeys(entry, ['kind', 'targetTraitKey'], `${path}.${role}`);
      if (expectString(entry.kind, `${path}.${role}.kind`) !== 'random')
        failProjectDocument(`${path}.${role}.kind`, 'expected random');
      const target =
        entry.targetTraitKey === null
          ? null
          : expectString(entry.targetTraitKey, `${path}.${role}.targetTraitKey`);
      if (target !== null && catalog.traits.byKey[target] === undefined)
        failProjectDocument(`${path}.${role}.targetTraitKey`, `unknown trait ${target}`);
      result[role] = Object.freeze({ kind: 'random', targetTraitKey: target });
    }
  }
  return Object.freeze(result);
}

function decodeRewardWheel(
  value: unknown,
  catalog: Catalog,
  descriptor: EncounterRewardWheelAttachment,
  path: string,
): RewardWheelState {
  const wheel = expectRecord(value, path);
  expectExactKeys(wheel, ['storeKey', 'offerCount', 'offers', 'pickedOfferIndex'], path);
  const storeKey = expectString(wheel.storeKey, `${path}.storeKey`);
  if (!descriptor.reward.storeKeys.includes(storeKey)) {
    failProjectDocument(`${path}.storeKey`, `${storeKey} is not available from this wheel`);
  }
  const offerCount = expectPositiveInteger(wheel.offerCount, `${path}.offerCount`);
  if (offerCount < descriptor.offerCount.min || offerCount > descriptor.offerCount.max) {
    failProjectDocument(
      `${path}.offerCount`,
      `must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
    );
  }
  const rawOffers = expectRecord(wheel.offers, `${path}.offers`);
  expectExactKeys(rawOffers, descriptor.offerKeys, `${path}.offers`);
  const offers: Record<string, AuthoredRewardState> = {};
  for (const offerKey of descriptor.offerKeys) {
    const reward = decodeRewardState(rawOffers[offerKey], catalog, `${path}.offers.${offerKey}`, {
      kind: 'producerLifecycle',
      key: descriptor.reward.producerLifecycleKey,
    });
    if (!descriptor.reward.allowedRewardTypes.includes(reward.offer.rewardType))
      failProjectDocument(
        `${path}.offers.${offerKey}.offer.rewardType`,
        `${reward.offer.rewardType} is filtered from this wheel`,
      );
    offers[offerKey] = reward;
  }
  const pickedOfferIndex = expectPositiveInteger(
    wheel.pickedOfferIndex,
    `${path}.pickedOfferIndex`,
  );
  if (pickedOfferIndex > offerCount) {
    failProjectDocument(`${path}.pickedOfferIndex`, 'must select an active offer');
  }
  return Object.freeze({
    storeKey,
    offerCount,
    offers: Object.freeze(offers),
    pickedOfferIndex,
  });
}

function decodeShipCombatState(
  value: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): ShipCombatState {
  expectedKind(value.kind, 'shipCombat', path);
  expectExactKeys(value, ['kind', 'encounterCount', 'wheels'], path);
  const encounterCount = expectPositiveInteger(value.encounterCount, `${path}.encounterCount`);
  if (encounterCount !== 2 && encounterCount !== 3) {
    failProjectDocument(`${path}.encounterCount`, 'must be 2 or 3');
  }
  const descriptors = requireShipCombatWheels(catalog, room, path);
  const rawWheels = expectRecord(value.wheels, `${path}.wheels`);
  expectExactKeys(
    rawWheels,
    descriptors.map((descriptor) => descriptor.key),
    `${path}.wheels`,
  );
  const wheels: Record<string, RewardWheelState> = {};
  for (const descriptor of descriptors) {
    wheels[descriptor.key] = decodeRewardWheel(
      rawWheels[descriptor.key],
      catalog,
      descriptor,
      `${path}.wheels.${descriptor.key}`,
    );
  }
  return Object.freeze({
    kind: 'shipCombat',
    encounterCount,
    wheels: Object.freeze(wheels),
  });
}

function decodeEphyraCombatState(
  value: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): EphyraCombatState {
  expectedKind(value.kind, 'ephyraCombat', path);
  expectExactKeys(value, ['kind', 'reward', 'sideRooms'], path);
  const descriptor = requireEphyraSideRooms(room, path);
  const slots = descriptor?.slots ?? [];
  const rawSideRooms = expectRecord(value.sideRooms, `${path}.sideRooms`);
  expectExactKeys(
    rawSideRooms,
    slots.map((slot) => slot.slotKey),
    `${path}.sideRooms`,
  );
  const enteredOrdinals = new Set<number>();
  const sideRooms: Record<string, EphyraSideRoomState> = {};
  for (const slot of slots) {
    const slotPath = `${path}.sideRooms.${slot.slotKey}`;
    const rawState = expectRecord(rawSideRooms[slot.slotKey], slotPath);
    expectExactKeys(rawState, ['generation', 'enteredOrdinal', 'reward', 'encounters'], slotPath);
    const generation = expectString(rawState.generation, `${slotPath}.generation`);
    if (generation !== 'generated' && generation !== 'notGenerated') {
      failProjectDocument(`${slotPath}.generation`, 'must be generated or notGenerated');
    }
    let enteredOrdinal: number | null = null;
    if (rawState.enteredOrdinal !== null) {
      enteredOrdinal = expectPositiveInteger(rawState.enteredOrdinal, `${slotPath}.enteredOrdinal`);
      if (enteredOrdinal > slots.length) {
        failProjectDocument(`${slotPath}.enteredOrdinal`, 'exceeds the local side-room capacity');
      }
      if (enteredOrdinals.has(enteredOrdinal)) {
        failProjectDocument(`${slotPath}.enteredOrdinal`, `duplicates ${enteredOrdinal}`);
      }
      enteredOrdinals.add(enteredOrdinal);
      if (generation !== 'generated') {
        failProjectDocument(`${slotPath}.enteredOrdinal`, 'requires a generated side room');
      }
    }
    const sideRoom = catalog.rooms.byKey[slot.roomGameName];
    if (sideRoom === undefined) {
      failProjectDocument(slotPath, `unknown room ${slot.roomGameName}`);
    }
    const sideReward = decodeRewardState(rawState.reward, catalog, `${slotPath}.reward`, {
      kind: 'producerLifecycle',
      key: requireCountedBinding(sideRoom, slotPath).producerLifecycleKey,
    });
    const sideOffer = decodeCountedOffer(
      sideReward.offer,
      catalog,
      requireCountedBinding(sideRoom, slotPath),
      `${slotPath}.reward.offer`,
    );
    sideRooms[slot.slotKey] = Object.freeze({
      generation,
      enteredOrdinal,
      reward: Object.freeze({ ...sideReward, offer: sideOffer }),
      encounters: decodeRoomEncounterState(
        rawState.encounters,
        catalog,
        sideRoom,
        `${slotPath}.encounters`,
      ),
    });
  }
  for (let ordinal = 1; ordinal <= enteredOrdinals.size; ordinal += 1) {
    if (!enteredOrdinals.has(ordinal)) {
      failProjectDocument(
        `${path}.sideRooms.enteredOrdinals`,
        `must contain contiguous ordinal ${ordinal}`,
      );
    }
  }
  const parentReward = decodeRewardState(value.reward, catalog, `${path}.reward`, {
    kind: 'producerLifecycle',
    key: requireCountedBinding(room, path).producerLifecycleKey,
  });
  const offer = decodeCountedOffer(
    parentReward.offer,
    catalog,
    requireCountedBinding(room, path),
    `${path}.reward.offer`,
  );
  return Object.freeze({
    kind: 'ephyraCombat',
    reward: Object.freeze({ ...parentReward, offer }),
    sideRooms: Object.freeze(sideRooms),
  });
}

function decodeShopState(
  value: unknown,
  catalog: Catalog,
  binding: ShopRewardBinding,
  path: string,
): ShopState {
  const shop = expectRecord(value, path);
  const profileKey = expectString(shop.profileKey, `${path}.profileKey`);
  const profile = catalog.rewards.shops.byKey[profileKey];
  if (profile === undefined) {
    failProjectDocument(`${path}.profileKey`, `unknown shop profile ${profileKey}`);
  }
  const conditionApplicable = shopProfileUsesDeathDefianceCondition(catalog, profileKey);
  expectExactKeys(
    shop,
    ['profileKey', 'offers', ...(conditionApplicable ? ['deathDefianceConditionMet'] : [])],
    path,
  );
  if (profileKey !== binding.shopProfileKey) {
    failProjectDocument(`${path}.profileKey`, `expected ${binding.shopProfileKey}`);
  }
  return Object.freeze({
    ...decodeShopOffers(shop.offers, catalog, profile, path),
    ...(conditionApplicable
      ? {
          deathDefianceConditionMet: expectBoolean(
            shop.deathDefianceConditionMet,
            `${path}.deathDefianceConditionMet`,
          ),
        }
      : {}),
  });
}

function decodeShopOffers(
  value: unknown,
  catalog: Catalog,
  profile: ShopProfileDeclaration,
  path: string,
): ShopState {
  const rawOffers = expectRecord(value, `${path}.offers`);
  expectExactKeys(
    rawOffers,
    profile.slots.values.map((slot) => slot.key),
    `${path}.offers`,
  );
  const offers: Record<string, ShopOfferState> = {};
  for (const slot of profile.slots.values) {
    const offerPath = `${path}.offers.${slot.key}`;
    const rawOffer = expectRecord(rawOffers[slot.key], offerPath);
    expectExactKeys(rawOffer, ['reward'], offerPath);
    const reward = decodeRewardState(rawOffer.reward, catalog, `${offerPath}.reward`, {
      kind: 'shopProfile',
      key: profile.key,
    });
    const offer = reward.offer;
    const group = profile.groups.byKey[slot.groupKey];
    if (group === undefined) {
      failProjectDocument(offerPath, `unknown shop group ${slot.groupKey}`);
    }
    if (
      !group.options.values.some((option) => option.defaultOffer.rewardType === offer.rewardType)
    ) {
      failProjectDocument(
        `${offerPath}.reward.offer.rewardType`,
        `${offer.rewardType} is not available from ${slot.groupKey}`,
      );
    }
    offers[slot.key] = Object.freeze({ reward });
  }
  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
  });
}

function expectedKind(value: unknown, expected: string, path: string): void {
  const kind = expectString(value, `${path}.kind`);
  if (kind !== expected) {
    failProjectDocument(`${path}.kind`, `expected ${expected}, received ${kind}`);
  }
}

export function decodeRoomState(
  value: unknown,
  catalog: Catalog,
  room: RoomDeclaration,
  context: Pick<RoomStateContext, 'role' | 'entryActive' | 'rememberedCountedBinding'>,
  path: string,
): AuthoredRoomState {
  const state = expectRecord(value, path);
  const { role, entryActive, rememberedCountedBinding } = context;
  switch (authoredTemplateKey(room, path)) {
    case 'FixedIntro':
    case 'RewardlessCombat':
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'none', path);
      expectExactKeys(state, ['kind'], path);
      return Object.freeze({ kind: 'none' });
    case 'FieldsCombat': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fieldsCombat', path);
      expectExactKeys(state, ['kind', 'cages'], path);
      const descriptor = requireFieldsCages(room, path);
      const rawCages = expectRecord(state.cages, `${path}.cages`);
      expectExactKeys(rawCages, descriptor.slotKeys, `${path}.cages`);
      const cages: Record<string, AuthoredRewardState> = {};
      for (const slotKey of descriptor.slotKeys) {
        const reward = decodeRewardState(rawCages[slotKey], catalog, `${path}.cages.${slotKey}`, {
          kind: 'producerLifecycle',
          key: descriptor.reward.producerLifecycleKey,
        });
        const offer = decodeCountedOffer(
          reward.offer,
          catalog,
          descriptor.reward,
          `${path}.cages.${slotKey}.offer`,
        );
        cages[slotKey] = Object.freeze({ ...reward, offer });
      }
      return Object.freeze({
        kind: 'fieldsCombat',
        cages: Object.freeze(cages),
      });
    }
    case 'ShipCombat':
      requireOrdinaryRole(role, room, path);
      return decodeShipCombatState(state, catalog, room, path);
    case 'EphyraCombat':
      requireOrdinaryRole(role, room, path);
      return decodeEphyraCombatState(state, catalog, room, path);
    case 'FixedOpening':
    case 'FixedPreHub':
    case 'ClockworkCombat':
    case 'EphyraSideRoom':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'counted', path);
      expectExactKeys(state, ['kind', 'reward'], path);
      const reward = decodeRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: requireCountedBinding(room, path).producerLifecycleKey,
      });
      const offer = decodeCountedOffer(
        reward.offer,
        catalog,
        requireCountedBinding(room, path),
        `${path}.reward.offer`,
      );
      return Object.freeze({
        kind: 'counted',
        reward: Object.freeze({ ...reward, offer }),
      });
    }
    case 'Anomaly': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'anomaly', path);
      expectExactKeys(state, ['kind', 'reward', 'success'], path);
      if (rememberedCountedBinding === undefined) {
        failProjectDocument(path, 'Anomaly requires its remembered counted reward binding');
      }
      const reward = decodeRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: rememberedCountedBinding.producerLifecycleKey,
      });
      const offer = decodeCountedOffer(
        reward.offer,
        catalog,
        rememberedCountedBinding,
        `${path}.reward.offer`,
      );
      return Object.freeze({
        kind: 'anomaly',
        // The takeover can retain a normal G reward that this Anomaly map
        // would not normally offer. The remembered G declaration remains the
        // persisted offer domain; evaluation reports the Anomaly mismatch.
        reward: Object.freeze({ ...reward, offer }),
        success: expectBoolean(state.success, `${path}.success`),
      });
    }
    case 'Devotion':
    case 'ContractBoss':
    case 'Chaos':
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fixed', path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(
          path,
          `${authoredTemplateKey(room, path)} requires a fixed reward binding`,
        );
      }
      const rewardType = catalog.rewards.rewardTypes.byKey[room.incomingReward.offer.rewardType];
      if (rewardType === undefined) {
        failProjectDocument(path, `unknown fixed reward ${room.incomingReward.offer.rewardType}`);
      }
      const reward = decodeRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: room.incomingReward.producerLifecycleKey,
      });
      const payload = decodePayload(
        reward.offer.payload,
        rewardType,
        catalog,
        `${path}.reward.offer.payload`,
      );
      const offer = Object.freeze({
        rewardType: room.incomingReward.offer.rewardType,
        ...(payload === undefined ? {} : { payload }),
      });
      if (offer.rewardType !== reward.offer.rewardType)
        failProjectDocument(
          `${path}.reward.offer.rewardType`,
          'fixed reward type is declaration-owned',
        );
      return Object.freeze({
        kind: 'fixed',
        reward: Object.freeze({ ...reward, offer }),
      });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return decodeShopRoomState(state, catalog, room, entryActive, path);
    case 'Preboss': {
      if (role === 'ordinary') {
        failProjectDocument(path, 'Preboss requires a declaration-derived offer role');
      }
      if (role === 'prebossShop') {
        return decodeShopRoomState(state, catalog, room, entryActive, path);
      }
      expectedKind(state.kind, 'freeReward', path);
      expectExactKeys(state, ['kind', 'reward'], path);
      if (
        room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors' ||
        room.prebossBatchPolicy.remainingOffers.kind !== 'counted'
      ) {
        failProjectDocument(path, 'Preboss has no counted remaining-offer policy');
      }
      const reward = decodeRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: room.prebossBatchPolicy.remainingOffers.reward.producerLifecycleKey,
      });
      const offer = decodeCountedOffer(
        reward.offer,
        catalog,
        room.prebossBatchPolicy.remainingOffers.reward,
        `${path}.reward.offer`,
      );
      return Object.freeze({
        kind: 'freeReward',
        reward: Object.freeze({ ...reward, offer }),
      });
    }
  }
}

function decodeShopRoomState(
  state: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  entryActive: boolean,
  path: string,
): AuthoredRoomState {
  expectedKind(state.kind, 'shop', path);
  expectExactKeys(state, ['kind', 'shop'], path);
  if (state.shop === undefined) {
    if (entryActive) {
      failProjectDocument(`${path}.shop`, 'is required for an entered shop occurrence');
    }
    return Object.freeze({ kind: 'shop' });
  }
  return Object.freeze({
    kind: 'shop',
    shop: decodeShopState(state.shop, catalog, requireShopBinding(room, path), `${path}.shop`),
  });
}
