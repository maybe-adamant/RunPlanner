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
  expectNonBlankString,
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
        ...(option.naturalSelectionTargets === undefined ? [] : ['naturalSelectionTargets']),
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
      ...(option.naturalSelectionTargets === undefined
        ? {}
        : (() => {
            const targets = expectArray(
              option.naturalSelectionTargets,
              `${optionPath}.naturalSelectionTargets`,
            );
            if (targets.length < 1 || targets.length > 8)
              failProjectDocument(
                `${optionPath}.naturalSelectionTargets`,
                'requires one to eight trait keys',
              );
            return {
              naturalSelectionTargets: Object.freeze(
                targets.map((target, targetIndex) =>
                  expectNonBlankString(
                    target,
                    `${optionPath}.naturalSelectionTargets[${targetIndex}]`,
                  ),
                ),
              ) as AuthoredEchoLastRunBoonOption['naturalSelectionTargets'],
            };
          })()),
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
