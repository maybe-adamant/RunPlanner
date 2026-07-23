import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import type { CandidateOptionProjection } from './candidateProjection';
import type { ContextualPickerModel, ContextualPickerProjectionService } from './contextualPicker';
import type { ProjectedRewardDomain, ProjectedRewardDomainOption } from './rewardDomainProjection';

export type RewardPickerStep = 'type' | 'source' | 'chosen' | 'spurned';

export interface RewardPickerProjectionService {
  readonly choiceLabel: (step: RewardPickerStep, offer: ResolvedRewardOffer) => string;
  readonly project: (
    domain: ProjectedRewardDomain,
    step: RewardPickerStep,
    selected: ResolvedRewardOffer,
  ) => ContextualPickerModel<ResolvedRewardOffer>;
  readonly summary: (offer: ResolvedRewardOffer) => string;
}

type AssessmentMode = 'aggregate' | 'exact';

interface CachedCandidates {
  readonly options: readonly CandidateOptionProjection<ResolvedRewardOffer>[];
  readonly sourceByOfferKey: ReadonlyMap<string, ProjectedRewardDomainOption>;
}

function offerKey(offer: ResolvedRewardOffer): string {
  return JSON.stringify(offer);
}

function sourceLabel(catalog: Catalog, source: string): string {
  const declaration = catalog.rewards.rewardTypes.byKey[source];
  if (declaration === undefined) {
    throw new Error(`Reward source ${source} is missing`);
  }
  return declaration.label;
}

function rewardDeclaration(catalog: Catalog, rewardType: string) {
  const declaration = catalog.rewards.rewardTypes.byKey[rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${rewardType} is missing`);
  }
  return declaration;
}

function hasEventualSource(catalog: Catalog, offer: ResolvedRewardOffer): boolean {
  return rewardDeclaration(catalog, offer.rewardType).sourceResolution?.kind === 'acquisitionRole';
}

function optionLabel(catalog: Catalog, step: RewardPickerStep, key: string): string {
  const declaration = catalog.rewards.rewardTypes.byKey[key];
  if (declaration === undefined) {
    throw new Error(`${step === 'type' ? 'Reward type' : 'Reward source'} ${key} is missing`);
  }
  return declaration.label;
}

function stepOptions(
  domain: ProjectedRewardDomain,
  step: RewardPickerStep,
): {
  readonly mode: AssessmentMode;
  readonly options: readonly ProjectedRewardDomainOption[];
} {
  switch (step) {
    case 'type':
      return { mode: 'aggregate', options: domain.types };
    case 'source':
      if (domain.payload.kind !== 'oneOf') {
        throw new Error('Reward source step requires a single-source payload domain');
      }
      return { mode: 'exact', options: domain.payload.sources };
    case 'chosen':
      if (domain.payload.kind !== 'distinctPair') {
        throw new Error('Chosen-source step requires a paired payload domain');
      }
      return { mode: 'aggregate', options: domain.payload.chosenSources };
    case 'spurned':
      if (domain.payload.kind !== 'distinctPair') {
        throw new Error('Spurned-source step requires a paired payload domain');
      }
      return { mode: 'exact', options: domain.payload.spurnedSources };
  }
}

function selectedKey(step: RewardPickerStep, offer: ResolvedRewardOffer): string {
  if (step === 'type') {
    return offer.rewardType;
  }
  if (step === 'source' && offer.payload?.kind === 'BoonSource') {
    return offer.payload.source;
  }
  if (step === 'chosen' && offer.payload?.kind === 'DevotionPair') {
    return offer.payload.chosenSource;
  }
  if (step === 'spurned' && offer.payload?.kind === 'DevotionPair') {
    return offer.payload.spurnedSource;
  }
  throw new Error(`Reward ${offer.rewardType} has no ${step} selection`);
}

function projectedOffer(
  option: ProjectedRewardDomainOption,
  mode: AssessmentMode,
  step: RewardPickerStep,
  selected: ResolvedRewardOffer,
): ResolvedRewardOffer {
  if (mode === 'exact') {
    return option.offer;
  }
  if (step === 'type' && option.key === selected.rewardType) {
    return selected;
  }
  if (
    step === 'chosen' &&
    selected.payload?.kind === 'DevotionPair' &&
    option.key !== selected.payload.spurnedSource
  ) {
    return Object.freeze({
      rewardType: selected.rewardType,
      payload: Object.freeze({
        kind: 'DevotionPair' as const,
        chosenSource: option.key,
        spurnedSource: selected.payload.spurnedSource,
      }),
    });
  }
  return option.supportingOffer;
}

export function createRewardPickerProjection(
  catalog: Catalog,
  contextualPicker: ContextualPickerProjectionService,
): RewardPickerProjectionService {
  const candidateCache = new WeakMap<
    readonly ProjectedRewardDomainOption[],
    Map<string, CachedCandidates>
  >();
  const candidates = (
    options: readonly ProjectedRewardDomainOption[],
    mode: AssessmentMode,
    step: RewardPickerStep,
    selected: ResolvedRewardOffer,
  ): CachedCandidates => {
    let bySelection = candidateCache.get(options);
    if (bySelection === undefined) {
      bySelection = new Map();
      candidateCache.set(options, bySelection);
    }
    const cacheKey = mode === 'exact' ? `${mode}:${step}` : `${mode}:${step}:${offerKey(selected)}`;
    const existing = bySelection.get(cacheKey);
    if (existing !== undefined) {
      return existing;
    }
    const sourceByOfferKey = new Map<string, ProjectedRewardDomainOption>();
    const projected = options.map((option) => {
      const value = projectedOffer(option, mode, step, selected);
      sourceByOfferKey.set(offerKey(value), option);
      return Object.freeze({
        value,
        evaluation: mode === 'aggregate' ? option.evaluation : option.offerEvaluation,
      });
    });
    const cached = Object.freeze({
      options: Object.freeze(projected),
      sourceByOfferKey,
    });
    bySelection.set(cacheKey, cached);
    return cached;
  };

  const service: RewardPickerProjectionService = {
    choiceLabel(step: RewardPickerStep, offer: ResolvedRewardOffer) {
      switch (step) {
        case 'type':
          return 'Reward type';
        case 'source':
          return hasEventualSource(catalog, offer) ? 'Eventual God' : 'God';
        case 'chosen':
          return 'Chosen God';
        case 'spurned':
          return 'Spurned God';
      }
    },
    project(domain: ProjectedRewardDomain, step: RewardPickerStep, selected: ResolvedRewardOffer) {
      const resolved = stepOptions(domain, step);
      const selectedValue = selectedKey(step, selected);
      const projected = candidates(resolved.options, resolved.mode, step, selected);
      return contextualPicker.project(
        projected.options,
        (option) => {
          const source = projected.sourceByOfferKey.get(offerKey(option.value));
          if (source === undefined) {
            throw new Error(`Reward ${step} projection lost its domain option`);
          }
          return {
            label: optionLabel(catalog, step, source.key),
            selected: source.key === selectedValue,
          };
        },
        offerKey,
      );
    },
    summary(offer: ResolvedRewardOffer) {
      const declaration = rewardDeclaration(catalog, offer.rewardType);
      if (offer.payload === undefined) {
        return declaration.label;
      }
      if (offer.payload.kind === 'BoonSource') {
        const source = sourceLabel(catalog, offer.payload.source);
        return hasEventualSource(catalog, offer)
          ? `${declaration.label} · ${source} (eventual)`
          : `${declaration.label} · ${source}`;
      }
      return `${declaration.label} · ${sourceLabel(catalog, offer.payload.chosenSource)} / ${sourceLabel(catalog, offer.payload.spurnedSource)}`;
    },
  };
  return Object.freeze(service);
}
