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
  if (offer.options[optionIndex(offer.selectedOptionKey)] === undefined) return false;
  const stone = domain.children.find(
    (
      child,
    ): child is Extract<typeof child, { readonly child: { readonly kind: 'concaveStone' } }> =>
      child.child.kind === 'concaveStone',
  );
  return (
    domain.children
      .filter((child) => child.child.kind !== 'concaveStone')
      .every((child) => child.child.authoredComplete) &&
    (stone === undefined || stone.completeFor(offer))
  );
}
