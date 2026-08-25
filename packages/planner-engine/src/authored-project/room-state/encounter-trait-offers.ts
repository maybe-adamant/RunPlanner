import type { Catalog, EncounterSlotBinding } from '../../catalog-schema';
import {
  traitOfferSupportsExhaustion,
  type AuthoredGorgonAthenaOffer,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type AuthoredCirceResolution,
  type TraitOptionKey,
  TRAIT_OPTION_KEYS,
} from '../traits';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import { decodeEchoLastRunBoon } from './echo-last-run';
import { decodeAllTogetherResult } from './all-together';
import { encounterSetForBinding } from './encounter-envelope';

export function decodeEncounterTraitOffer(
  value: unknown,
  catalog: Catalog,
  giverKey: string,
  path: string,
  allowContextInvalid = false,
): AuthoredTraitOffer {
  const record = expectRecord(value, path);
  if (expectString(record.giverKey, `${path}.giverKey`) !== giverKey) {
    failProjectDocument(`${path}.giverKey`, `expected ${giverKey}`);
  }
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) failProjectDocument(path, `unknown giver ${giverKey}`);
  const kind = expectString(record.kind, `${path}.kind`);
  if (kind === 'fallbackGold') {
    expectExactKeys(record, ['kind', 'giverKey'], path);
    if (!traitOfferSupportsExhaustion(giver))
      failProjectDocument(path, 'Fallback Gold is not supported by this giver');
    return Object.freeze({ kind: 'fallbackGold', giverKey });
  }
  if (kind !== 'traits') failProjectDocument(`${path}.kind`, 'must be traits or fallbackGold');
  expectExactKeys(
    record,
    ['kind', 'giverKey', 'options', 'selectedOptionKey', 'rarificationActions'],
    path,
  );
  const rawOptions = expectArray(record.options, `${path}.options`);
  if (rawOptions.length < 1 || rawOptions.length > TRAIT_OPTION_KEYS.length)
    failProjectDocument(`${path}.options`, 'must contain one to three options');
  if (!traitOfferSupportsExhaustion(giver) && rawOptions.length !== TRAIT_OPTION_KEYS.length)
    failProjectDocument(`${path}.options`, 'this giver requires exactly three options');
  const options: AuthoredTraitOption[] = [];
  const seen = new Set<string>();
  for (const [index, optionKey] of TRAIT_OPTION_KEYS.entries()) {
    if (index >= rawOptions.length) break;
    const option = expectRecord(rawOptions[index], `${path}.options.${optionKey}`);
    const hasRarity = option.rarity !== undefined;
    const hasTarget = option.targetTraitKey !== undefined;
    const hasCirceResolution = option.circeResolution !== undefined;
    const hasEchoPomTarget = 'echoPomTarget' in option;
    const hasEchoLastRunBoon = 'echoLastRunBoon' in option;
    const hasAllTogetherResult = 'allTogetherResult' in option;
    const hasNaturalSelectionTargets = 'naturalSelectionTargets' in option;
    expectExactKeys(
      option,
      [
        'traitKey',
        ...(hasRarity ? ['rarity'] : []),
        ...(hasTarget ? ['targetTraitKey'] : []),
        ...(hasCirceResolution ? ['circeResolution'] : []),
        ...(hasEchoPomTarget ? ['echoPomTarget'] : []),
        ...(hasEchoLastRunBoon ? ['echoLastRunBoon'] : []),
        ...(hasAllTogetherResult ? ['allTogetherResult'] : []),
        ...(hasNaturalSelectionTargets ? ['naturalSelectionTargets'] : []),
      ],
      `${path}.options.${optionKey}`,
    );
    const traitKey = expectString(option.traitKey, `${path}.options.${optionKey}.traitKey`);
    if (seen.has(traitKey))
      failProjectDocument(`${path}.options.${optionKey}`, `${traitKey} is duplicated`);
    seen.add(traitKey);
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined || !giver.traitKeys.includes(traitKey))
      failProjectDocument(
        `${path}.options.${optionKey}.traitKey`,
        `${traitKey} is not in giver ${giverKey}`,
      );
    const rarity = hasRarity
      ? expectString(option.rarity, `${path}.options.${optionKey}.rarity`)
      : undefined;
    if (trait.rarityDomain.kind === 'none' && rarity !== undefined)
      failProjectDocument(
        `${path}.options.${optionKey}.rarity`,
        'rarityless options have no rarity',
      );
    if (
      !allowContextInvalid &&
      trait.rarityDomain.kind === 'ranked' &&
      (rarity === undefined || !trait.rarityDomain.equippedRarities.includes(rarity as never))
    )
      failProjectDocument(
        `${path}.options.${optionKey}.rarity`,
        `unsupported authored rarity for ${traitKey}`,
      );
    if (
      !allowContextInvalid &&
      giver.rarityPolicy.kind === 'fixed' &&
      rarity !== giver.rarityPolicy.rarity
    )
      failProjectDocument(
        `${path}.options.${optionKey}.rarity`,
        `${traitKey} must use fixed rarity ${giver.rarityPolicy.rarity}`,
      );
    const targetTraitKey = hasTarget
      ? expectString(option.targetTraitKey, `${path}.options.${optionKey}.targetTraitKey`)
      : undefined;
    let circeResolution: AuthoredCirceResolution | undefined;
    if (hasCirceResolution) {
      const resolution = expectRecord(
        option.circeResolution,
        `${path}.options.${optionKey}.circeResolution`,
      );
      const kind = expectString(
        resolution.kind,
        `${path}.options.${optionKey}.circeResolution.kind`,
      );
      if (kind === 'disableFear') {
        expectExactKeys(
          resolution,
          ['kind', 'vowKey'],
          `${path}.options.${optionKey}.circeResolution`,
        );
        if (resolution.vowKey !== null && typeof resolution.vowKey !== 'string')
          failProjectDocument(
            `${path}.options.${optionKey}.circeResolution.vowKey`,
            'must be a Vow key or null',
          );
        if (
          typeof resolution.vowKey === 'string' &&
          catalog.fearVows.byKey[resolution.vowKey] === undefined
        )
          failProjectDocument(`${path}.options.${optionKey}.circeResolution.vowKey`, 'unknown Vow');
        circeResolution = Object.freeze({ kind, vowKey: resolution.vowKey as string | null });
      } else if (kind === 'activateArcana' || kind === 'promoteArcana') {
        expectExactKeys(
          resolution,
          ['kind', 'arcanaKeys'],
          `${path}.options.${optionKey}.circeResolution`,
        );
        const keys = expectArray(
          resolution.arcanaKeys,
          `${path}.options.${optionKey}.circeResolution.arcanaKeys`,
        ).map((entry, keyIndex) =>
          expectString(
            entry,
            `${path}.options.${optionKey}.circeResolution.arcanaKeys[${keyIndex}]`,
          ),
        );
        if (
          keys.length > catalog.arcanaCards.values.length ||
          new Set(keys).size !== keys.length ||
          keys.some((key) => catalog.arcanaCards.byKey[key] === undefined)
        )
          failProjectDocument(
            `${path}.options.${optionKey}.circeResolution`,
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
          `${path}.options.${optionKey}.circeResolution.kind`,
          'unknown Circe resolution',
        );
      const expected =
        trait.selectedDisposition.kind === 'circe' ? trait.selectedDisposition.effect : undefined;
      if (expected === undefined || circeResolution!.kind !== expected)
        failProjectDocument(
          `${path}.options.${optionKey}.circeResolution`,
          'does not match the selected Circe trait policy',
        );
    }
    if (targetTraitKey !== undefined) {
      if (trait.targetedAcquisition === undefined)
        failProjectDocument(
          `${path}.options.${optionKey}.targetTraitKey`,
          `${traitKey} does not target another trait on acquisition`,
        );
      if (catalog.traits.byKey[targetTraitKey] === undefined)
        failProjectDocument(
          `${path}.options.${optionKey}.targetTraitKey`,
          `unknown trait ${targetTraitKey}`,
        );
    }
    let echoPomTarget: string | null | undefined;
    if (hasEchoPomTarget) {
      if (option.echoPomTarget !== null && typeof option.echoPomTarget !== 'string')
        failProjectDocument(
          `${path}.options.${optionKey}.echoPomTarget`,
          'must be a trait key or null',
        );
      echoPomTarget = option.echoPomTarget as string | null;
      if (echoPomTarget !== null && catalog.traits.byKey[echoPomTarget] === undefined)
        failProjectDocument(
          `${path}.options.${optionKey}.echoPomTarget`,
          `unknown trait ${echoPomTarget}`,
        );
      if (
        trait.selectedDisposition.kind !== 'echo' ||
        trait.selectedDisposition.effect !== 'doubleLevel'
      )
        failProjectDocument(
          `${path}.options.${optionKey}.echoPomTarget`,
          'is supported only by Echo Pom',
        );
    }
    const echoLastRunBoon = hasEchoLastRunBoon
      ? decodeEchoLastRunBoon(
          option.echoLastRunBoon,
          catalog,
          `${path}.options.${optionKey}.echoLastRunBoon`,
        )
      : undefined;
    if (
      hasEchoLastRunBoon &&
      (trait.selectedDisposition.kind !== 'echo' ||
        trait.selectedDisposition.effect !== 'lastRunBoon')
    )
      failProjectDocument(
        `${path}.options.${optionKey}.echoLastRunBoon`,
        'is supported only by Echo Boon Boon Boon',
      );
    const allTogetherResult = hasAllTogetherResult
      ? decodeAllTogetherResult(
          option.allTogetherResult,
          catalog,
          traitKey,
          `${path}.options.${optionKey}.allTogetherResult`,
        )
      : undefined;
    const naturalSelectionTargets = hasNaturalSelectionTargets
      ? (() => {
          const values = expectArray(
            option.naturalSelectionTargets,
            `${path}.options.${optionKey}.naturalSelectionTargets`,
          );
          if (values.length < 1 || values.length > 8)
            failProjectDocument(
              `${path}.options.${optionKey}.naturalSelectionTargets`,
              'requires one to eight trait keys',
            );
          const keys = values.map((value, index) => {
            const traitKey = expectNonBlankString(
              value,
              `${path}.options.${optionKey}.naturalSelectionTargets[${index}]`,
            );
            if (catalog.traits.byKey[traitKey] === undefined)
              failProjectDocument(
                `${path}.options.${optionKey}.naturalSelectionTargets[${index}]`,
                'unknown trait',
              );
            return traitKey;
          });
          if (trait.selectedDisposition.kind !== 'naturalSelection')
            failProjectDocument(
              `${path}.options.${optionKey}.naturalSelectionTargets`,
              'is supported only by Natural Selection',
            );
          return Object.freeze(keys) as AuthoredTraitOption['naturalSelectionTargets'];
        })()
      : undefined;
    const decodedOption: AuthoredTraitOption =
      rarity === undefined
        ? {
            traitKey,
            ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
            ...(circeResolution === undefined ? {} : { circeResolution }),
            ...(hasEchoPomTarget ? { echoPomTarget: echoPomTarget! } : {}),
            ...(echoLastRunBoon === undefined ? {} : { echoLastRunBoon }),
            ...(allTogetherResult === undefined ? {} : { allTogetherResult }),
            ...(naturalSelectionTargets === undefined ? {} : { naturalSelectionTargets }),
          }
        : {
            traitKey,
            rarity: rarity as NonNullable<AuthoredTraitOption['rarity']>,
            ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
            ...(circeResolution === undefined ? {} : { circeResolution }),
            ...(hasEchoPomTarget ? { echoPomTarget: echoPomTarget! } : {}),
            ...(echoLastRunBoon === undefined ? {} : { echoLastRunBoon }),
            ...(allTogetherResult === undefined ? {} : { allTogetherResult }),
            ...(naturalSelectionTargets === undefined ? {} : { naturalSelectionTargets }),
          };
    options.push(Object.freeze(decodedOption));
  }
  const selectedOptionKey = expectString(record.selectedOptionKey, `${path}.selectedOptionKey`);
  const rarificationActions = expectArray(
    record.rarificationActions,
    `${path}.rarificationActions`,
  ).map((value, index) => {
    const key = expectString(value, `${path}.rarificationActions[${index}]`);
    if (!(TRAIT_OPTION_KEYS as readonly string[]).includes(key))
      failProjectDocument(`${path}.rarificationActions[${index}]`, 'must name an option row');
    return key as TraitOptionKey;
  });
  if (
    !(TRAIT_OPTION_KEYS as readonly string[]).includes(selectedOptionKey) ||
    options[TRAIT_OPTION_KEYS.indexOf(selectedOptionKey as never)] === undefined
  )
    failProjectDocument(`${path}.selectedOptionKey`, 'must select option1, option2, or option3');
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: selectedOptionKey as AuthoredTraitOfferTraits['selectedOptionKey'],
    rarificationActions: Object.freeze(rarificationActions),
  });
}

export function legalTraitOfferEncounterKeys(
  catalog: Catalog,
  binding: EncounterSlotBinding,
): readonly string[] {
  if (binding.kind === 'fixed') return [];
  return encounterSetForBinding(catalog, binding, 'encounter trait offers').encounterDefinitionKeys;
}

export function decodeGorgonAthenaOffer(
  value: unknown,
  catalog: Catalog,
  giverKey: string,
  path: string,
): AuthoredGorgonAthenaOffer {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['traitKeys', 'selectedOptionKey'], path);
  const traitKeys = expectArray(record.traitKeys, `${path}.traitKeys`).map((entry, index) =>
    expectString(entry, `${path}.traitKeys[${index}]`),
  );
  const giver = catalog.traitGivers.byKey[giverKey];
  if (
    traitKeys.length !== 3 ||
    new Set(traitKeys).size !== 3 ||
    giver === undefined ||
    traitKeys.some((traitKey) => !giver.traitKeys.includes(traitKey))
  ) {
    failProjectDocument(path, `must contain exactly three distinct ${giverKey} trait identities`);
  }
  const selectedOptionKey = expectString(record.selectedOptionKey, `${path}.selectedOptionKey`);
  if (!(TRAIT_OPTION_KEYS as readonly string[]).includes(selectedOptionKey))
    failProjectDocument(`${path}.selectedOptionKey`, 'must select option1, option2, or option3');
  return Object.freeze({
    traitKeys: Object.freeze(traitKeys) as readonly [string, string, string],
    selectedOptionKey: selectedOptionKey as TraitOptionKey,
  });
}
