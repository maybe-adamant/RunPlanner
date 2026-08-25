import type {
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
} from '@run-planner/engine/authored-project';

export function replaceTraitOfferOption(
  value: AuthoredTraitOfferTraits,
  index: number,
  next: AuthoredTraitOfferTraits['options'][number],
): AuthoredTraitOfferTraits {
  const options = [...value.options] as AuthoredTraitOfferTraits['options'][number][];
  options[index] = Object.freeze({ ...next });
  return Object.freeze({
    ...value,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}

export function naturalSelectionOptionWithTargets(
  source: AuthoredTraitOption,
  targets: readonly string[],
): AuthoredTraitOption {
  const { naturalSelectionTargets, ...base } = source;
  void naturalSelectionTargets;
  return {
    ...base,
    ...(targets.length === 0
      ? {}
      : { naturalSelectionTargets: targets as AuthoredTraitOption['naturalSelectionTargets'] }),
  } as AuthoredTraitOption;
}
