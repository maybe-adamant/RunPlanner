import {
  optionIndex,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
} from '@run-planner/engine/authored-project';
import type { WorkspaceTraitOptionDomainInteraction } from '@planner/projections/structured-workspace';

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

/**
 * Local compound editors retain partial work outside authored state. Saving is
 * available only once every child owned by the selected draft has published a
 * complete authored value. Semantic availability remains engine-owned.
 */
export function selectedTraitOutcomeDraftComplete(
  offer: AuthoredTraitOfferTraits,
  domain: WorkspaceTraitOptionDomainInteraction,
): boolean {
  const option = offer.options[optionIndex(offer.selectedOptionKey)];
  if (option === undefined) return false;
  return (
    (domain.traitAcquisitionTarget === undefined || option.targetTraitKey !== undefined) &&
    (domain.circeResolution === undefined || option.circeResolution !== undefined) &&
    (domain.echoPomTarget === undefined || Object.hasOwn(option, 'echoPomTarget')) &&
    (domain.echoLastRunBoon === undefined || option.echoLastRunBoon !== undefined) &&
    (domain.allTogetherSets === undefined || option.allTogetherResult !== undefined) &&
    (domain.naturalSelection === undefined || option.naturalSelectionTargets !== undefined) &&
    (domain.hexTree === undefined || offer.hexTree !== undefined) &&
    (domain.concaveStone === undefined || domain.concaveStone.completeFor(offer))
  );
}
