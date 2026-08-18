import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import { candidateSupport, type CandidateOptionProjection } from './candidateProjection';
import type { ContextualPickerModel, ContextualPickerProjectionService } from './contextualPicker';
import type { ProjectedRewardDomain, ProjectedRewardDomainOption } from './rewardDomainProjection';

export type RewardPickerStep = 'type' | 'source' | 'chosen' | 'spurned';

export interface RewardPickerProjectionService {
  readonly choiceLabel: (step: RewardPickerStep, offer?: ResolvedRewardOffer) => string;
  readonly project: (
    domain: ProjectedRewardDomain,
    step: RewardPickerStep,
    selected?: ResolvedRewardOffer,
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

function optionLabel(catalog: Catalog, step: RewardPickerStep, key: string): string {
  const declaration = catalog.rewards.rewardTypes.byKey[key];
  if (declaration === undefined) {
    throw new Error(`${step === 'type' ? 'Reward type' : 'Reward source'} ${key} is missing`);
  }
  return declaration.label;
}

function aggregateEvaluation(
  candidates: readonly ProjectedRewardDomain['offers'][number][],
): ProjectedRewardDomain['offers'][number] {
  const supported = candidates.filter((candidate) => {
    const support = candidateSupport(candidate);
    return support === 'possible' || support === 'forced';
  });
  const representative = supported[0] ?? candidates[0];
  if (representative === undefined) {
    throw new Error('Reward payload option has no complete offer');
  }
  return representative;
}

function payloadOptions(
  domain: ProjectedRewardDomain,
  selected: ResolvedRewardOffer | undefined,
  step: Exclude<RewardPickerStep, 'type'>,
): {
  readonly mode: AssessmentMode;
  readonly options: readonly ProjectedRewardDomainOption[];
} {
  const rewardType =
    selected?.rewardType ?? (domain.types.length === 1 ? domain.types[0]?.key : undefined);
  const candidates =
    rewardType === undefined
      ? Object.freeze([])
      : domain.offers.filter((candidate) => candidate.value.rewardType === rewardType);
  if (step === 'source') {
    return {
      mode: 'exact',
      options: Object.freeze(
        candidates.flatMap((candidate): readonly ProjectedRewardDomainOption[] =>
          candidate.value.payload?.kind !== 'BoonSource'
            ? []
            : [
                Object.freeze({
                  evaluation: candidate.evaluation,
                  key: candidate.value.payload.source,
                  offer: candidate.value,
                  offerEvaluation: candidate.evaluation,
                  supportingOffer: candidate.value,
                  witnesses: Object.freeze([candidate.value]),
                }),
              ],
        ),
      ),
    };
  }
  const selectedPair = selected?.payload?.kind === 'DevotionPair' ? selected.payload : undefined;
  if (step === 'spurned') {
    if (selectedPair === undefined) return { mode: 'exact', options: Object.freeze([]) };
    return {
      mode: 'exact',
      options: Object.freeze(
        candidates.flatMap((candidate): readonly ProjectedRewardDomainOption[] =>
          candidate.value.payload?.kind !== 'DevotionPair' ||
          candidate.value.payload.chosenSource !== selectedPair.chosenSource
            ? []
            : [
                Object.freeze({
                  evaluation: candidate.evaluation,
                  key: candidate.value.payload.spurnedSource,
                  offer: candidate.value,
                  offerEvaluation: candidate.evaluation,
                  supportingOffer: candidate.value,
                  witnesses: Object.freeze([candidate.value]),
                }),
              ],
        ),
      ),
    };
  }
  const grouped = new Map<string, ProjectedRewardDomain['offers'][number][]>();
  for (const candidate of candidates) {
    if (candidate.value.payload?.kind !== 'DevotionPair') {
      continue;
    }
    const group = grouped.get(candidate.value.payload.chosenSource) ?? [];
    group.push(candidate);
    grouped.set(candidate.value.payload.chosenSource, group);
  }
  return {
    mode: 'aggregate',
    options: Object.freeze(
      [...grouped].map(([key, groupedCandidates]) => {
        const representative = aggregateEvaluation(groupedCandidates);
        const preferred =
          groupedCandidates.find(
            (candidate) =>
              candidate.value.payload?.kind === 'DevotionPair' &&
              selectedPair !== undefined &&
              candidate.value.payload.spurnedSource === selectedPair.spurnedSource,
          ) ?? representative;
        return Object.freeze({
          evaluation: representative.evaluation,
          key,
          offer: preferred.value,
          offerEvaluation: preferred.evaluation,
          supportingOffer: representative.value,
          witnesses: Object.freeze(groupedCandidates.map((candidate) => candidate.value)),
        });
      }),
    ),
  };
}

function stepOptions(
  domain: ProjectedRewardDomain,
  step: RewardPickerStep,
  selected?: ResolvedRewardOffer,
): {
  readonly mode: AssessmentMode;
  readonly options: readonly ProjectedRewardDomainOption[];
} {
  switch (step) {
    case 'type':
      return { mode: 'aggregate', options: domain.types };
    case 'source':
      return payloadOptions(domain, selected, step);
    case 'chosen':
      return payloadOptions(domain, selected, step);
    case 'spurned':
      return payloadOptions(domain, selected, step);
  }
}

function selectedKey(step: RewardPickerStep, offer?: ResolvedRewardOffer): string | undefined {
  if (offer === undefined) return undefined;
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
  return undefined;
}

function projectedOffer(
  option: ProjectedRewardDomainOption,
  mode: AssessmentMode,
  step: RewardPickerStep,
  selected?: ResolvedRewardOffer,
): ResolvedRewardOffer {
  if (mode === 'exact') {
    return option.offer;
  }
  if (step === 'type' && selected !== undefined && option.key === selected.rewardType) {
    return selected;
  }
  if (
    step === 'chosen' &&
    selected?.payload?.kind === 'DevotionPair' &&
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
    selected?: ResolvedRewardOffer,
  ): CachedCandidates => {
    let bySelection = candidateCache.get(options);
    if (bySelection === undefined) {
      bySelection = new Map();
      candidateCache.set(options, bySelection);
    }
    const cacheKey =
      mode === 'exact'
        ? `${mode}:${step}`
        : `${mode}:${step}:${selected === undefined ? '__unresolved__' : offerKey(selected)}`;
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
    choiceLabel(step: RewardPickerStep, offer?: ResolvedRewardOffer) {
      switch (step) {
        case 'type':
          return 'Reward type';
        case 'source':
          return offer !== undefined && hasEventualSource(catalog, offer) ? 'Eventual God' : 'God';
        case 'chosen':
          return 'Chosen God';
        case 'spurned':
          return 'Spurned God';
      }
    },
    project(domain: ProjectedRewardDomain, step: RewardPickerStep, selected?: ResolvedRewardOffer) {
      const resolved = stepOptions(domain, step, selected);
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
    summary: (offer) => summarizeRewardOffer(catalog, offer),
  };
  return Object.freeze(service);
}
