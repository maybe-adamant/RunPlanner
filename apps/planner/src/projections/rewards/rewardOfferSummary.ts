import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

function sourceLabel(catalog: Catalog, source: string): string {
  const declaration = catalog.rewards.rewardTypes.byKey[source];
  if (declaration === undefined) {
    throw new Error(`Reward source ${source} is missing`);
  }
  return declaration.label;
}

export function rewardDeclaration(catalog: Catalog, rewardType: string) {
  const declaration = catalog.rewards.rewardTypes.byKey[rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${rewardType} is missing`);
  }
  return declaration;
}

export function summarizeRewardOffer(catalog: Catalog, offer: ResolvedRewardOffer): string {
  const declaration = rewardDeclaration(catalog, offer.rewardType);
  if (offer.payload === undefined) {
    return declaration.label;
  }
  if (offer.payload.kind === 'BoonSource') {
    const source = sourceLabel(catalog, offer.payload.source);
    return `${declaration.label} · ${source}`;
  }
  return `${declaration.label} · ${sourceLabel(catalog, offer.payload.chosenSource)} / ${sourceLabel(catalog, offer.payload.spurnedSource)}`;
}
