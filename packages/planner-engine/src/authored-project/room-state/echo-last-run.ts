import type { Catalog, TraitRarity } from '../../catalog-schema';
import {
  normalizeAuthoredEchoLastRunBoon,
  TRAIT_OPTION_KEYS,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredEchoLastRunBoonOption,
  type TraitOptionKey,
} from '../traits';
import {
  expectArray,
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';

export function decodeEchoLastRunBoon(
  value: unknown,
  catalog: Catalog,
  path: string,
): AuthoredEchoLastRunBoonOffer {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['options', 'selectedOptionKey'], path);
  const rawOptions = expectArray(record.options, `${path}.options`);
  if (rawOptions.length < 1 || rawOptions.length > 3)
    failProjectDocument(`${path}.options`, 'must contain one to three options');
  const options = rawOptions.map((raw, index) => {
    const optionPath = `${path}.options.${TRAIT_OPTION_KEYS[index]}`;
    const option = expectRecord(raw, optionPath);
    expectExactKeys(
      option,
      [
        'giverKey',
        'traitKey',
        'rarity',
        ...(option.targetTraitKey === undefined ? [] : ['targetTraitKey']),
      ],
      optionPath,
    );
    return Object.freeze({
      giverKey: expectString(option.giverKey, `${optionPath}.giverKey`),
      traitKey: expectString(option.traitKey, `${optionPath}.traitKey`),
      rarity: expectString(option.rarity, `${optionPath}.rarity`) as TraitRarity,
      ...(option.targetTraitKey === undefined
        ? {}
        : { targetTraitKey: expectString(option.targetTraitKey, `${optionPath}.targetTraitKey`) }),
    }) satisfies AuthoredEchoLastRunBoonOption;
  });
  const selectedOptionKey = expectString(
    record.selectedOptionKey,
    `${path}.selectedOptionKey`,
  ) as TraitOptionKey;
  try {
    return normalizeAuthoredEchoLastRunBoon(catalog, {
      options: Object.freeze(options) as AuthoredEchoLastRunBoonOffer['options'],
      selectedOptionKey,
    });
  } catch (error) {
    failProjectDocument(
      path,
      error instanceof Error ? error.message : 'invalid Echo last-run boon',
    );
  }
}
