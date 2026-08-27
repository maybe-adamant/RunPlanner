import type { Catalog } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type {
  ResolvedRewardOffer,
  RewardPayload,
  RewardTypeDeclaration,
} from '../../reward-kernel/model';
import type { AuthoredRewardState } from '../model';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectNonNegativeInteger,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import {
  traitOfferSupportsExhaustion,
  traitGiverForAcquisitionRole,
  normalizeAuthoredChaosTraitOffer,
  createUnresolvedLevelResolutions,
  TRAIT_OPTION_KEYS,
  type AuthoredLevelResolution,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type TraitOptionKey,
  normalizeAuthoredConcaveStoneResult,
} from '../traits';
import { normalizeAuthoredHexTree } from '../hex-tree';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import { decodeEchoLastRunBoon } from './echo-last-run';
import { decodeAllTogetherResult } from './all-together';

export function decodePayload(
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

function expectedTraitRoles(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): Readonly<Record<string, string>> {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) return {};
  const result: Record<string, string> = {};
  for (const role of declaration.acquisitionRoles.values) {
    const giverKey = traitGiverForAcquisitionRole(catalog, offer, role.key);
    if (giverKey !== undefined) result[role.key] = giverKey;
  }
  return result;
}

function decodeTraitOffers(
  value: unknown,
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  path: string,
): Readonly<Record<string, AuthoredTraitOffer | null>> {
  const expected = expectedTraitRoles(catalog, offer);
  if (value === undefined && Object.keys(expected).length === 0) return Object.freeze({});
  const raw = expectRecord(value, path);
  expectExactKeys(raw, Object.keys(expected), path);
  const result: Record<string, AuthoredTraitOffer | null> = {};
  for (const [roleKey, giverKey] of Object.entries(expected)) {
    const rolePath = `${path}.${roleKey}`;
    if (raw[roleKey] === null) {
      result[roleKey] = null;
      continue;
    }
    const record = expectRecord(raw[roleKey], rolePath);
    if (expectString(record.giverKey, `${rolePath}.giverKey`) !== giverKey)
      failProjectDocument(`${rolePath}.giverKey`, `expected ${giverKey}`);
    const giver = catalog.traitGivers.byKey[giverKey];
    if (giver === undefined) failProjectDocument(rolePath, `unknown giver ${giverKey}`);
    const kind = expectString(record.kind, `${rolePath}.kind`);
    if (kind === 'chaos') {
      if (giverKey !== 'Chaos')
        failProjectDocument(rolePath, 'Chaos pairs require the Chaos provider');
      expectExactKeys(
        record,
        [
          'kind',
          'giverKey',
          'curseKey',
          'duration',
          'curseValues',
          'blessingKey',
          'rarity',
          'blessingValues',
        ],
        rolePath,
      );
      const rawValues = (key: 'curseValues' | 'blessingValues') => {
        const values = expectRecord(record[key], `${rolePath}.${key}`);
        return Object.fromEntries(
          Object.entries(values).map(([name, raw]) => {
            if (typeof raw !== 'number')
              failProjectDocument(`${rolePath}.${key}.${name}`, 'must be a number');
            return [name, raw] as const;
          }),
        );
      };
      try {
        result[roleKey] = normalizeAuthoredChaosTraitOffer(catalog, {
          kind: 'chaos',
          giverKey: 'Chaos',
          curseKey: expectString(record.curseKey, `${rolePath}.curseKey`),
          duration:
            typeof record.duration === 'number'
              ? record.duration
              : failProjectDocument(`${rolePath}.duration`, 'must be a number'),
          curseValues: rawValues('curseValues'),
          blessingKey: expectString(record.blessingKey, `${rolePath}.blessingKey`),
          rarity: expectString(record.rarity, `${rolePath}.rarity`) as Extract<
            import('../../catalog-schema').TraitRarity,
            'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary'
          >,
          blessingValues: rawValues('blessingValues'),
        });
      } catch (error) {
        failProjectDocument(
          rolePath,
          error instanceof Error ? error.message : 'invalid Chaos pair',
        );
      }
      continue;
    }
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
        ...(record.rejectedOptionKey === undefined ? [] : ['rejectedOptionKey']),
        ...('concaveStoneResult' in record ? ['concaveStoneResult'] : []),
        ...('hexTree' in record ? ['hexTree'] : []),
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
      const hasAllTogetherResult = 'allTogetherResult' in option;
      const hasNaturalSelectionTargets = 'naturalSelectionTargets' in option;
      const hasPersephoneLevelBonus = 'persephoneLevelBonus' in option;
      expectExactKeys(
        option,
        [
          'traitKey',
          ...(option.rarity === undefined ? [] : ['rarity']),
          ...(option.targetTraitKey === undefined ? [] : ['targetTraitKey']),
          ...(option.circeResolution === undefined ? [] : ['circeResolution']),
          ...('echoPomTarget' in option ? ['echoPomTarget'] : []),
          ...('echoLastRunBoon' in option ? ['echoLastRunBoon'] : []),
          ...('allTogetherResult' in option ? ['allTogetherResult'] : []),
          ...(hasNaturalSelectionTargets ? ['naturalSelectionTargets'] : []),
          ...(hasPersephoneLevelBonus ? ['persephoneLevelBonus'] : []),
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
        failProjectDocument(
          `${rolePath}.options.${key}.rarity`,
          'rarityless options have no rarity',
        );
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
      const hasEchoPomTarget = 'echoPomTarget' in option;
      const hasEchoLastRunBoon = 'echoLastRunBoon' in option;
      let echoPomTarget: string | null | undefined;
      if (hasEchoPomTarget) {
        if (option.echoPomTarget !== null && typeof option.echoPomTarget !== 'string')
          failProjectDocument(
            `${rolePath}.options.${key}.echoPomTarget`,
            'must be a trait key or null',
          );
        echoPomTarget = option.echoPomTarget as string | null;
        if (echoPomTarget !== null && catalog.traits.byKey[echoPomTarget] === undefined)
          failProjectDocument(
            `${rolePath}.options.${key}.echoPomTarget`,
            `unknown trait ${echoPomTarget}`,
          );
        if (
          trait.selectedDisposition.kind !== 'echo' ||
          trait.selectedDisposition.effect !== 'doubleLevel'
        )
          failProjectDocument(
            `${rolePath}.options.${key}.echoPomTarget`,
            'is supported only by Echo Pom',
          );
      }
      const echoLastRunBoon = hasEchoLastRunBoon
        ? decodeEchoLastRunBoon(
            option.echoLastRunBoon,
            catalog,
            `${rolePath}.options.${key}.echoLastRunBoon`,
          )
        : undefined;
      if (
        hasEchoLastRunBoon &&
        (trait.selectedDisposition.kind !== 'echo' ||
          trait.selectedDisposition.effect !== 'lastRunBoon')
      )
        failProjectDocument(
          `${rolePath}.options.${key}.echoLastRunBoon`,
          'is supported only by Echo Boon Boon Boon',
        );
      const allTogetherResult = hasAllTogetherResult
        ? decodeAllTogetherResult(
            option.allTogetherResult,
            catalog,
            traitKey,
            `${rolePath}.options.${key}.allTogetherResult`,
          )
        : undefined;
      const naturalSelectionTargets = hasNaturalSelectionTargets
        ? (() => {
            const values = expectArray(
              option.naturalSelectionTargets,
              `${rolePath}.options.${key}.naturalSelectionTargets`,
            );
            if (values.length < 1 || values.length > 8)
              failProjectDocument(
                `${rolePath}.options.${key}.naturalSelectionTargets`,
                'requires one to eight trait keys',
              );
            const targets = values.map((value, index) => {
              const traitKey = expectNonBlankString(
                value,
                `${rolePath}.options.${key}.naturalSelectionTargets[${index}]`,
              );
              if (catalog.traits.byKey[traitKey] === undefined)
                failProjectDocument(
                  `${rolePath}.options.${key}.naturalSelectionTargets[${index}]`,
                  'unknown trait',
                );
              return traitKey;
            });
            if (trait.selectedDisposition.kind !== 'naturalSelection')
              failProjectDocument(
                `${rolePath}.options.${key}.naturalSelectionTargets`,
                'is supported only by Natural Selection',
              );
            return Object.freeze(targets) as AuthoredTraitOption['naturalSelectionTargets'];
          })()
        : undefined;
      const persephoneLevelBonus = hasPersephoneLevelBonus
        ? expectNonNegativeInteger(
            option.persephoneLevelBonus,
            `${rolePath}.options.${key}.persephoneLevelBonus`,
          )
        : undefined;
      if (persephoneLevelBonus !== undefined && persephoneLevelBonus > 8)
        failProjectDocument(`${rolePath}.options.${key}.persephoneLevelBonus`, 'must not exceed 8');
      options.push(
        Object.freeze({
          traitKey,
          ...(rarity === undefined ? {} : { rarity }),
          ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
          ...(circeResolution === undefined ? {} : { circeResolution }),
          ...(hasEchoPomTarget ? { echoPomTarget: echoPomTarget! } : {}),
          ...(echoLastRunBoon === undefined ? {} : { echoLastRunBoon }),
          ...(allTogetherResult === undefined ? {} : { allTogetherResult }),
          ...(naturalSelectionTargets === undefined ? {} : { naturalSelectionTargets }),
          ...(persephoneLevelBonus === undefined ? {} : { persephoneLevelBonus }),
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
    const selectedOption = options[TRAIT_OPTION_KEYS.indexOf(selected as never)];
    const hasHexTree = 'hexTree' in record;
    let hexTree: import('../traits').AuthoredHexTreeConfiguration | undefined;
    if (giver.providerKind === 'spell') {
      if (
        selectedOption === undefined ||
        catalog.hexes.byKey[selectedOption.traitKey] === undefined
      )
        failProjectDocument(`${rolePath}.selectedOptionKey`, 'must select a declared Spell Hex');
      if (!hasHexTree)
        failProjectDocument(`${rolePath}.hexTree`, 'is required for a resolved Spell Drop offer');
      const rawTree = expectRecord(record.hexTree, `${rolePath}.hexTree`);
      expectExactKeys(
        rawTree,
        ['layoutKey', 'rareTalentKeys', 'epicTalentKeys'],
        `${rolePath}.hexTree`,
      );
      const rareTalentKeys = expectArray(
        rawTree.rareTalentKeys,
        `${rolePath}.hexTree.rareTalentKeys`,
      ).map((entry, index) => expectString(entry, `${rolePath}.hexTree.rareTalentKeys[${index}]`));
      const epicTalentKeys = expectArray(
        rawTree.epicTalentKeys,
        `${rolePath}.hexTree.epicTalentKeys`,
      ).map((entry, index) => expectString(entry, `${rolePath}.hexTree.epicTalentKeys[${index}]`));
      try {
        hexTree = normalizeAuthoredHexTree(catalog, selectedOption!.traitKey, {
          layoutKey: expectString(
            rawTree.layoutKey,
            `${rolePath}.hexTree.layoutKey`,
          ) as import('../../catalog-schema').HexLayoutKey,
          rareTalentKeys,
          epicTalentKeys,
        });
      } catch (error) {
        failProjectDocument(
          `${rolePath}.hexTree`,
          error instanceof Error ? error.message : 'invalid Hex tree',
        );
      }
    } else if (hasHexTree) {
      failProjectDocument(`${rolePath}.hexTree`, 'is supported only for Spell Drop offers');
    }
    const rejectedOptionKey =
      record.rejectedOptionKey === undefined
        ? undefined
        : expectString(record.rejectedOptionKey, `${rolePath}.rejectedOptionKey`);
    if (
      rejectedOptionKey !== undefined &&
      !(TRAIT_OPTION_KEYS as readonly string[]).includes(rejectedOptionKey)
    )
      failProjectDocument(`${rolePath}.rejectedOptionKey`, 'must name an option row');
    let concaveStoneResult: import('../traits').AuthoredConcaveStoneResult | undefined;
    if ('concaveStoneResult' in record) {
      const result = expectRecord(record.concaveStoneResult, `${rolePath}.concaveStoneResult`);
      const resultKind = expectString(result.kind, `${rolePath}.concaveStoneResult.kind`);
      if (resultKind === 'noProc') {
        expectExactKeys(result, ['kind'], `${rolePath}.concaveStoneResult`);
        concaveStoneResult = Object.freeze({ kind: 'noProc' });
      } else if (resultKind === 'proc') {
        expectExactKeys(result, ['kind', 'optionKey'], `${rolePath}.concaveStoneResult`);
        const optionKey = expectString(
          result.optionKey,
          `${rolePath}.concaveStoneResult.optionKey`,
        );
        try {
          concaveStoneResult = normalizeAuthoredConcaveStoneResult(
            { kind: 'proc', optionKey: optionKey as TraitOptionKey },
            selected as TraitOptionKey,
            options,
          );
        } catch (error) {
          failProjectDocument(
            `${rolePath}.concaveStoneResult.optionKey`,
            error instanceof Error ? error.message : 'invalid Concave Stone result',
          );
        }
      } else {
        failProjectDocument(`${rolePath}.concaveStoneResult.kind`, 'must be noProc or proc');
      }
    }
    result[roleKey] = Object.freeze({
      kind: 'traits',
      giverKey,
      options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: selected as AuthoredTraitOfferTraits['selectedOptionKey'],
      rarificationActions: Object.freeze(rarificationActions),
      ...(rejectedOptionKey === undefined
        ? {}
        : { rejectedOptionKey: rejectedOptionKey as TraitOptionKey }),
      ...(concaveStoneResult === undefined ? {} : { concaveStoneResult }),
      ...(hexTree === undefined ? {} : { hexTree }),
    });
  }
  return Object.freeze(result);
}

export function decodeCountedOffer(
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
  allowArtificer = true,
): AuthoredRewardState {
  const raw = expectRecord(value, path);
  for (const key of Object.keys(raw)) {
    if (
      ![
        'offer',
        'traitOffersByAcquisitionRole',
        'levelResolutionsByAcquisitionRole',
        'dispositionByAcquisitionRole',
      ].includes(key)
    )
      failProjectDocument(path, `unexpected key ${key}`);
  }
  const offer = decodeOffer(raw.offer, catalog, `${path}.offer`);
  const requiredLevels = createUnresolvedLevelResolutions(catalog, offer, source);
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
  if (raw.dispositionByAcquisitionRole === undefined)
    failProjectDocument(`${path}.dispositionByAcquisitionRole`, 'is required');
  const dispositionByAcquisitionRole = decodeAcquisitionDispositions(
    raw.dispositionByAcquisitionRole,
    catalog,
    offer,
    `${path}.dispositionByAcquisitionRole`,
    allowArtificer,
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
    dispositionByAcquisitionRole,
  });
}

export function decodeNullableRewardState(
  value: unknown,
  catalog: Catalog,
  path: string,
  source: import('../../reward-kernel/level-effects').LevelResolutionEffectSource,
  allowArtificer = true,
): AuthoredRewardState | null {
  return value === null ? null : decodeRewardState(value, catalog, path, source, allowArtificer);
}

/**
 * Each concrete declaration role owns one closed acquisition disposition.
 * The required map is explicit: documents never receive an implicit normal
 * acquisition disposition during decoding.
 */
function decodeAcquisitionDispositions(
  value: unknown,
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  path: string,
  allowArtificer: boolean,
): AuthoredRewardState['dispositionByAcquisitionRole'] {
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
        const dispositionPath = `${path}.${role}`;
        if (raw[role] === undefined)
          failProjectDocument(dispositionPath, 'is missing acquisition role');
        const disposition = expectRecord(raw[role], dispositionPath);
        const kind = expectString(disposition.kind, `${dispositionPath}.kind`);
        if (kind === 'normal' || kind === 'timePiece') {
          if (Object.keys(disposition).length !== 1)
            failProjectDocument(dispositionPath, `unexpected key beside ${kind}`);
          return [role, Object.freeze({ kind })] as const;
        }
        if (kind !== 'artificer')
          failProjectDocument(`${dispositionPath}.kind`, 'must be normal, timePiece, or artificer');
        if (!allowArtificer) failProjectDocument(dispositionPath, 'Artificer cannot recurse');
        if (Object.keys(disposition).length !== 1)
          failProjectDocument(dispositionPath, 'artificer is intent-only');
        return [role, Object.freeze({ kind: 'artificer' as const })] as const;
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
