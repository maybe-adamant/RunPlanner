import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
} from '@run-planner/engine/reward-kernel';

export interface PreparedRewardDomainOption {
  readonly key: string;
  readonly offer: ResolvedRewardOffer;
  readonly witnesses: readonly ResolvedRewardOffer[];
}

export interface ProjectedRewardDomainOption extends PreparedRewardDomainOption {
  readonly evaluation: ProjectCandidateEvaluation;
  readonly offerEvaluation: ProjectCandidateEvaluation;
  readonly supportingOffer: ResolvedRewardOffer;
}

export type PreparedRewardPayloadDomain =
  | { readonly kind: 'none' }
  | { readonly kind: 'oneOf'; readonly sources: readonly PreparedRewardDomainOption[] }
  | {
      readonly kind: 'distinctPair';
      readonly chosenSources: readonly PreparedRewardDomainOption[];
      readonly spurnedSources: readonly PreparedRewardDomainOption[];
    };

export type ProjectedRewardPayloadDomain =
  | { readonly kind: 'none' }
  | { readonly kind: 'oneOf'; readonly sources: readonly ProjectedRewardDomainOption[] }
  | {
      readonly kind: 'distinctPair';
      readonly chosenSources: readonly ProjectedRewardDomainOption[];
      readonly spurnedSources: readonly ProjectedRewardDomainOption[];
    };

export interface PreparedRewardDomain {
  readonly types: readonly PreparedRewardDomainOption[];
  readonly payload: PreparedRewardPayloadDomain;
}

export interface ProjectedRewardDomain {
  readonly offers: readonly {
    readonly evaluation: ProjectCandidateEvaluation;
    readonly value: ResolvedRewardOffer;
  }[];
  readonly types: readonly ProjectedRewardDomainOption[];
  readonly payload: ProjectedRewardPayloadDomain;
}

function offerKey(offer: ResolvedRewardOffer): string {
  return JSON.stringify(offer);
}

function appendUnique(
  offers: readonly ResolvedRewardOffer[],
  offer: ResolvedRewardOffer,
): readonly ResolvedRewardOffer[] {
  return offers.some((candidate) => offerKey(candidate) === offerKey(offer))
    ? offers
    : Object.freeze([...offers, offer]);
}

function option(
  key: string,
  witnesses: readonly ResolvedRewardOffer[],
  preferred?: ResolvedRewardOffer,
): PreparedRewardDomainOption {
  if (witnesses.length === 0) {
    throw new Error(`Reward domain option ${key} has no complete offers`);
  }
  const offer =
    preferred === undefined
      ? witnesses[0]!
      : (witnesses.find((candidate) => offerKey(candidate) === offerKey(preferred)) ??
        witnesses[0]!);
  return Object.freeze({ key, offer, witnesses: Object.freeze([...witnesses]) });
}

function payloadDomain(
  selected: ResolvedRewardOffer,
  selectedOffers: readonly ResolvedRewardOffer[],
): PreparedRewardPayloadDomain {
  if (selectedOffers.every((candidate) => candidate.payload === undefined)) {
    return Object.freeze({ kind: 'none' });
  }
  if (selectedOffers.every((candidate) => candidate.payload?.kind === 'BoonSource')) {
    const values = [
      ...new Set(
        selectedOffers.flatMap((candidate) =>
          candidate.payload?.kind === 'BoonSource' ? [candidate.payload.source] : [],
        ),
      ),
    ];
    const sources = values.map((source) => {
      const witness = selectedOffers.filter(
        (candidate) =>
          candidate.payload?.kind === 'BoonSource' && candidate.payload.source === source,
      );
      return option(
        source,
        witness,
        selected.payload?.kind === 'BoonSource' && selected.payload.source === source
          ? selected
          : undefined,
      );
    });
    return Object.freeze({ kind: 'oneOf', sources: Object.freeze(sources) });
  }
  if (!selectedOffers.every((candidate) => candidate.payload?.kind === 'DevotionPair')) {
    throw new Error(`${selected.rewardType} has inconsistent complete offers`);
  }
  const values = [
    ...new Set(
      selectedOffers.flatMap((candidate) =>
        candidate.payload?.kind === 'DevotionPair'
          ? [candidate.payload.chosenSource, candidate.payload.spurnedSource]
          : [],
      ),
    ),
  ];
  const selectedPair = selected.payload?.kind === 'DevotionPair' ? selected.payload : undefined;
  const chosenSources = values.map((source) => {
    let witnesses: readonly ResolvedRewardOffer[] = selectedOffers.filter(
      (candidate) =>
        candidate.payload?.kind === 'DevotionPair' && candidate.payload.chosenSource === source,
    );
    if (source === selectedPair?.chosenSource) {
      witnesses = appendUnique(witnesses, selected);
    }
    const preferred =
      selectedPair === undefined
        ? undefined
        : {
            rewardType: selected.rewardType,
            payload: {
              kind: 'DevotionPair' as const,
              chosenSource: source,
              spurnedSource: selectedPair.spurnedSource,
            },
          };
    return option(source, witnesses, source === selectedPair?.chosenSource ? selected : preferred);
  });
  const spurnedSources = values
    .filter(
      (source) => source !== selectedPair?.chosenSource || source === selectedPair?.spurnedSource,
    )
    .map((source) => {
      let witnesses: readonly ResolvedRewardOffer[] = selectedOffers.filter(
        (candidate) =>
          candidate.payload?.kind === 'DevotionPair' &&
          candidate.payload.chosenSource === selectedPair?.chosenSource &&
          candidate.payload.spurnedSource === source,
      );
      if (source === selectedPair?.spurnedSource) {
        witnesses = appendUnique(witnesses, selected);
      }
      return option(
        source,
        witnesses,
        source === selectedPair?.spurnedSource ? selected : undefined,
      );
    });
  return Object.freeze({
    kind: 'distinctPair',
    chosenSources: Object.freeze(chosenSources),
    spurnedSources: Object.freeze(spurnedSources),
  });
}

export function prepareRewardDomain(
  catalog: Catalog,
  rewardTypes: readonly string[],
  selected?: ResolvedRewardOffer,
): PreparedRewardDomain {
  const types = rewardTypes.map((rewardType) => {
    let witnesses = locallyValidRewardOffers(catalog.rewards, rewardType);
    if (selected !== undefined && rewardType === selected.rewardType) {
      witnesses = appendUnique(witnesses, selected);
    }
    return option(
      rewardType,
      witnesses,
      selected !== undefined && rewardType === selected.rewardType ? selected : undefined,
    );
  });
  if (selected !== undefined && !rewardTypes.includes(selected.rewardType)) {
    types.push(
      option(
        selected.rewardType,
        appendUnique(locallyValidRewardOffers(catalog.rewards, selected.rewardType), selected),
        selected,
      ),
    );
  }
  if (selected === undefined) {
    return Object.freeze({
      types: Object.freeze(types),
      payload: Object.freeze({ kind: 'none' }),
    });
  }
  const selectedType = types.find((candidate) => candidate.key === selected.rewardType);
  if (selectedType === undefined) {
    throw new Error(`Selected reward ${selected.rewardType} has no domain`);
  }
  return Object.freeze({
    types: Object.freeze(types),
    payload: payloadDomain(selected, selectedType.witnesses),
  });
}

function selectCandidate(
  option: PreparedRewardDomainOption,
  evaluations: ReadonlyMap<string, ProjectCandidateEvaluation>,
): { readonly offer: ResolvedRewardOffer; readonly evaluation: ProjectCandidateEvaluation } {
  const candidates = option.witnesses.map((offer) => {
    const evaluation = evaluations.get(offerKey(offer));
    if (evaluation === undefined) {
      throw new Error(`Reward candidate projection omitted ${offerKey(offer)}`);
    }
    return { offer, evaluation };
  });
  const supported = candidates.filter((candidate) => {
    switch (candidate.evaluation.kind) {
      case 'incomingReward':
      case 'localReward':
      case 'rewardWheelOffer':
      case 'shopOffer':
        return candidate.evaluation.result.supported;
      case 'unavailable':
        return false;
      default:
        return false;
    }
  });
  if (supported.length === 0) {
    return (
      candidates.find((candidate) => offerKey(candidate.offer) === offerKey(option.offer)) ??
      candidates[0]!
    );
  }
  return supported[0]!;
}

function projectOptions(
  options: readonly PreparedRewardDomainOption[],
  evaluations: ReadonlyMap<string, ProjectCandidateEvaluation>,
): readonly ProjectedRewardDomainOption[] {
  return Object.freeze(
    options.map((candidate) => {
      const selected = selectCandidate(candidate, evaluations);
      const offerEvaluation = evaluations.get(offerKey(candidate.offer));
      if (offerEvaluation === undefined) {
        throw new Error(`Reward candidate projection omitted ${offerKey(candidate.offer)}`);
      }
      return Object.freeze({
        ...candidate,
        evaluation: selected.evaluation,
        offerEvaluation,
        supportingOffer: selected.offer,
      });
    }),
  );
}

export function projectRewardDomain(
  prepared: PreparedRewardDomain,
  evaluatedOffers: readonly {
    readonly value: ResolvedRewardOffer;
    readonly evaluation: ProjectCandidateEvaluation;
  }[],
): ProjectedRewardDomain {
  const offers = Object.freeze(
    evaluatedOffers.map((candidate) =>
      Object.freeze({ evaluation: candidate.evaluation, value: candidate.value }),
    ),
  );
  const evaluations = new Map(
    evaluatedOffers.map((candidate) => [offerKey(candidate.value), candidate.evaluation]),
  );
  const types = projectOptions(prepared.types, evaluations);
  switch (prepared.payload.kind) {
    case 'none':
      return Object.freeze({ offers, types, payload: Object.freeze({ kind: 'none' }) });
    case 'oneOf':
      return Object.freeze({
        offers,
        types,
        payload: Object.freeze({
          kind: 'oneOf',
          sources: projectOptions(prepared.payload.sources, evaluations),
        }),
      });
    case 'distinctPair':
      return Object.freeze({
        offers,
        types,
        payload: Object.freeze({
          kind: 'distinctPair',
          chosenSources: projectOptions(prepared.payload.chosenSources, evaluations),
          spurnedSources: projectOptions(prepared.payload.spurnedSources, evaluations),
        }),
      });
  }
}

export function rewardDomainOffers(domain: PreparedRewardDomain): readonly ResolvedRewardOffer[] {
  const byKey = new Map<string, ResolvedRewardOffer>();
  const append = (options: readonly PreparedRewardDomainOption[]) => {
    for (const option of options) {
      for (const witness of option.witnesses) {
        byKey.set(offerKey(witness), witness);
      }
    }
  };
  append(domain.types);
  if (domain.payload.kind === 'oneOf') {
    append(domain.payload.sources);
  } else if (domain.payload.kind === 'distinctPair') {
    append(domain.payload.chosenSources);
    append(domain.payload.spurnedSources);
  }
  return Object.freeze([...byKey.values()]);
}
