import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectCandidateEvaluation } from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

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

function sourceValues(catalog: Catalog, valueDomainKey: string): readonly string[] {
  const domain = catalog.rewards.payloadDomains.byKey[valueDomainKey];
  if (domain?.kind !== 'oneOf') {
    throw new Error(`Reward source domain ${valueDomainKey} is missing`);
  }
  return domain.values;
}

function completeOffers(catalog: Catalog, rewardType: string): readonly ResolvedRewardOffer[] {
  const declaration = catalog.rewards.rewardTypes.byKey[rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${rewardType} is missing`);
  }
  if (declaration.payloadDomain === undefined) {
    return Object.freeze([{ rewardType }]);
  }
  const domain = catalog.rewards.payloadDomains.byKey[declaration.payloadDomain];
  if (domain?.kind === 'oneOf') {
    return Object.freeze(
      domain.values.map((source) =>
        Object.freeze({
          rewardType,
          payload: Object.freeze({ kind: 'BoonSource' as const, source }),
        }),
      ),
    );
  }
  if (domain?.kind === 'distinctPair') {
    const values = sourceValues(catalog, domain.valueDomain);
    return Object.freeze(
      values.flatMap((chosenSource) =>
        values
          .filter((spurnedSource) => spurnedSource !== chosenSource)
          .map((spurnedSource) =>
            Object.freeze({
              rewardType,
              payload: Object.freeze({
                kind: 'DevotionPair' as const,
                chosenSource,
                spurnedSource,
              }),
            }),
          ),
      ),
    );
  }
  throw new Error(`${declaration.gameName} has an unknown payload domain`);
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
  catalog: Catalog,
  selected: ResolvedRewardOffer,
  selectedOffers: readonly ResolvedRewardOffer[],
): PreparedRewardPayloadDomain {
  const declaration = catalog.rewards.rewardTypes.byKey[selected.rewardType];
  if (declaration?.payloadDomain === undefined) {
    return Object.freeze({ kind: 'none' });
  }
  const domain = catalog.rewards.payloadDomains.byKey[declaration.payloadDomain];
  if (domain?.kind === 'oneOf') {
    const sources = domain.values.map((source) => {
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
  if (domain?.kind !== 'distinctPair') {
    throw new Error(`${declaration.gameName} has an unknown payload domain`);
  }
  const values = sourceValues(catalog, domain.valueDomain);
  const selectedPair = selected.payload?.kind === 'DevotionPair' ? selected.payload : undefined;
  const chosenSources = values
    .filter(
      (source) => source !== selectedPair?.spurnedSource || source === selectedPair?.chosenSource,
    )
    .map((source) => {
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
      return option(
        source,
        witnesses,
        source === selectedPair?.chosenSource ? selected : preferred,
      );
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
  selected: ResolvedRewardOffer,
): PreparedRewardDomain {
  const types = rewardTypes.map((rewardType) => {
    let witnesses = completeOffers(catalog, rewardType);
    if (rewardType === selected.rewardType) {
      witnesses = appendUnique(witnesses, selected);
    }
    return option(rewardType, witnesses, rewardType === selected.rewardType ? selected : undefined);
  });
  if (!rewardTypes.includes(selected.rewardType)) {
    types.push(
      option(
        selected.rewardType,
        appendUnique(completeOffers(catalog, selected.rewardType), selected),
        selected,
      ),
    );
  }
  const selectedType = types.find((candidate) => candidate.key === selected.rewardType);
  if (selectedType === undefined) {
    throw new Error(`Selected reward ${selected.rewardType} has no domain`);
  }
  return Object.freeze({
    types: Object.freeze(types),
    payload: payloadDomain(catalog, selected, selectedType.witnesses),
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
  const supported = candidates.filter(
    (candidate) =>
      candidate.evaluation.context === 'evaluated' && candidate.evaluation.support !== 'impossible',
  );
  if (supported.length === 0) {
    return (
      candidates.find((candidate) => offerKey(candidate.offer) === offerKey(option.offer)) ??
      candidates[0]!
    );
  }
  const representative = supported[0]!;
  if (
    representative.evaluation.context === 'evaluated' &&
    representative.evaluation.support === 'forced' &&
    supported.some(
      (candidate) =>
        candidate.evaluation.context === 'evaluated' && candidate.evaluation.support === 'possible',
    )
  ) {
    return Object.freeze({
      ...representative,
      evaluation: Object.freeze({ ...representative.evaluation, support: 'possible' }),
    });
  }
  return representative;
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
  const evaluations = new Map(
    evaluatedOffers.map((candidate) => [offerKey(candidate.value), candidate.evaluation]),
  );
  const types = projectOptions(prepared.types, evaluations);
  switch (prepared.payload.kind) {
    case 'none':
      return Object.freeze({ types, payload: Object.freeze({ kind: 'none' }) });
    case 'oneOf':
      return Object.freeze({
        types,
        payload: Object.freeze({
          kind: 'oneOf',
          sources: projectOptions(prepared.payload.sources, evaluations),
        }),
      });
    case 'distinctPair':
      return Object.freeze({
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
