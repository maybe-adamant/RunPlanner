import type {
  Catalog,
  CountedRewardBinding,
  IncomingRewardAddress,
  ProjectDocument,
  ShopOfferAddress,
} from '@run-planner/core';
import type { ResolvedRewardOffer } from '@run-planner/core/reward-kernel';

import {
  presentCandidateLabel,
  type CandidateOptionProjection,
  type CandidateProjectionService,
} from '../application/candidateProjection';
import { candidateSelectState } from './candidatePresentation';

export type RewardCandidateOwner =
  | { readonly kind: 'incomingReward'; readonly address: IncomingRewardAddress }
  | { readonly kind: 'shopOffer'; readonly address: ShopOfferAddress };

interface RewardValueEditorProps {
  readonly candidateOwner: RewardCandidateOwner;
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly idPrefix: string;
  readonly offer: ResolvedRewardOffer;
  readonly rewardTypes: readonly string[];
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
  readonly project: ProjectDocument;
}

interface CountedRewardEditorProps extends Omit<RewardValueEditorProps, 'rewardTypes'> {
  readonly binding: CountedRewardBinding;
}

function offerKey(value: ResolvedRewardOffer): string {
  return JSON.stringify(value);
}

function projectRewardOptions(
  service: CandidateProjectionService,
  project: ProjectDocument,
  owner: RewardCandidateOwner,
  offers: readonly ResolvedRewardOffer[],
): readonly CandidateOptionProjection<ResolvedRewardOffer>[] {
  return owner.kind === 'incomingReward'
    ? service.incomingRewards(project, owner.address, offers)
    : service.shopOffers(project, owner.address, offers);
}

function defaultOffer(catalog: Catalog, rewardType: string): ResolvedRewardOffer {
  const declaration = catalog.rewards.rewardTypes.byKey[rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${rewardType} is missing`);
  }
  return {
    rewardType,
    ...(declaration.defaultPayload === undefined ? {} : { payload: declaration.defaultPayload }),
  };
}

function payloadDomainValues(catalog: Catalog, domainKey: string): readonly string[] {
  const domain = catalog.rewards.payloadDomains.byKey[domainKey];
  if (domain?.kind !== 'oneOf') {
    throw new Error(`Payload value domain ${domainKey} is missing`);
  }
  return domain.values;
}

function sourceLabel(catalog: Catalog, source: string): string {
  const declaration = catalog.rewards.rewardTypes.byKey[source];
  if (declaration === undefined) {
    throw new Error(`Payload source ${source} is missing`);
  }
  return declaration.label;
}

function RewardPayloadEditor({
  candidateOwner,
  candidateProjection,
  catalog,
  idPrefix,
  onReplace,
  offer,
  project,
}: Omit<RewardValueEditorProps, 'rewardTypes'>) {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${offer.rewardType} is missing`);
  }
  if (declaration.payloadDomain === undefined) {
    return null;
  }
  const domain = catalog.rewards.payloadDomains.byKey[declaration.payloadDomain];
  if (domain === undefined || offer.payload === undefined) {
    throw new Error(`${declaration.gameName} has incomplete payload state`);
  }

  if (domain.kind === 'oneOf') {
    if (offer.payload.kind !== 'BoonSource') {
      throw new Error(`${declaration.gameName} requires a single-source payload`);
    }
    const values = domain.values.map((source) => ({
      ...offer,
      payload: { kind: 'BoonSource' as const, source },
    }));
    const projected = projectRewardOptions(candidateProjection, project, candidateOwner, values);
    const selected = projected.find((option) => offerKey(option.value) === offerKey(offer));
    return (
      <label className="field-control" htmlFor={`${idPrefix}-source`}>
        <span>Source</span>
        <select
          {...candidateSelectState(selected)}
          id={`${idPrefix}-source`}
          onChange={(event) =>
            onReplace({
              ...offer,
              payload: { kind: 'BoonSource', source: event.target.value },
            })
          }
          value={offer.payload.source}
        >
          {projected.map((option) => {
            const payload = option.value.payload;
            if (payload?.kind !== 'BoonSource') {
              throw new Error(`${declaration.gameName} projected a non-source payload`);
            }
            return (
              <option key={payload.source} value={payload.source} {...candidateSelectState(option)}>
                {presentCandidateLabel(sourceLabel(catalog, payload.source), option)}
              </option>
            );
          })}
        </select>
      </label>
    );
  }

  if (offer.payload.kind !== 'DevotionPair') {
    throw new Error(`${declaration.gameName} requires a paired payload`);
  }
  const values = payloadDomainValues(catalog, domain.valueDomain);
  const { chosenSource, spurnedSource } = offer.payload;
  const chosenOffers = values
    .filter((source) => source !== spurnedSource)
    .map((source) => ({
      ...offer,
      payload: { kind: 'DevotionPair' as const, chosenSource: source, spurnedSource },
    }));
  const spurnedOffers = values
    .filter((source) => source !== chosenSource)
    .map((source) => ({
      ...offer,
      payload: { kind: 'DevotionPair' as const, chosenSource, spurnedSource: source },
    }));
  const projectedChosen = projectRewardOptions(
    candidateProjection,
    project,
    candidateOwner,
    chosenOffers,
  );
  const projectedSpurned = projectRewardOptions(
    candidateProjection,
    project,
    candidateOwner,
    spurnedOffers,
  );
  return (
    <div className="paired-payload">
      <label className="field-control" htmlFor={`${idPrefix}-source-1`}>
        <span>Chosen source</span>
        <select
          {...candidateSelectState(
            projectedChosen.find((option) => offerKey(option.value) === offerKey(offer)),
          )}
          id={`${idPrefix}-source-1`}
          onChange={(event) =>
            onReplace({
              ...offer,
              payload: {
                kind: 'DevotionPair',
                chosenSource: event.target.value,
                spurnedSource,
              },
            })
          }
          value={chosenSource}
        >
          {projectedChosen.map((option) => {
            const payload = option.value.payload;
            if (payload?.kind !== 'DevotionPair') {
              throw new Error(`${declaration.gameName} projected an invalid chosen source`);
            }
            return (
              <option
                key={payload.chosenSource}
                value={payload.chosenSource}
                {...candidateSelectState(option)}
              >
                {presentCandidateLabel(sourceLabel(catalog, payload.chosenSource), option)}
              </option>
            );
          })}
        </select>
      </label>
      <label className="field-control" htmlFor={`${idPrefix}-source-2`}>
        <span>Spurned source</span>
        <select
          {...candidateSelectState(
            projectedSpurned.find((option) => offerKey(option.value) === offerKey(offer)),
          )}
          id={`${idPrefix}-source-2`}
          onChange={(event) =>
            onReplace({
              ...offer,
              payload: {
                kind: 'DevotionPair',
                chosenSource,
                spurnedSource: event.target.value,
              },
            })
          }
          value={spurnedSource}
        >
          {projectedSpurned.map((option) => {
            const payload = option.value.payload;
            if (payload?.kind !== 'DevotionPair') {
              throw new Error(`${declaration.gameName} projected an invalid spurned source`);
            }
            return (
              <option
                key={payload.spurnedSource}
                value={payload.spurnedSource}
                {...candidateSelectState(option)}
              >
                {presentCandidateLabel(sourceLabel(catalog, payload.spurnedSource), option)}
              </option>
            );
          })}
        </select>
      </label>
    </div>
  );
}

export function RewardValueEditor({
  candidateOwner,
  candidateProjection,
  catalog,
  idPrefix,
  offer,
  onReplace,
  project,
  rewardTypes,
}: RewardValueEditorProps) {
  const typeOffers = rewardTypes.map((rewardType) =>
    rewardType === offer.rewardType ? offer : defaultOffer(catalog, rewardType),
  );
  const projectedTypes = projectRewardOptions(
    candidateProjection,
    project,
    candidateOwner,
    typeOffers,
  );
  const selectedType = projectedTypes.find(
    (option) => option.value.rewardType === offer.rewardType,
  );
  return (
    <div className="reward-value-editor">
      <label className="field-control" htmlFor={`${idPrefix}-reward`}>
        <span>Reward</span>
        <select
          {...candidateSelectState(selectedType)}
          id={`${idPrefix}-reward`}
          onChange={(event) => onReplace(defaultOffer(catalog, event.target.value))}
          value={offer.rewardType}
        >
          {projectedTypes.map((option) => {
            const declaration = catalog.rewards.rewardTypes.byKey[option.value.rewardType];
            if (declaration === undefined) {
              throw new Error(`Reward type ${option.value.rewardType} is missing`);
            }
            return (
              <option
                key={option.value.rewardType}
                value={option.value.rewardType}
                {...candidateSelectState(option)}
              >
                {presentCandidateLabel(declaration.label, option)}
              </option>
            );
          })}
        </select>
      </label>
      <RewardPayloadEditor
        candidateOwner={candidateOwner}
        candidateProjection={candidateProjection}
        catalog={catalog}
        idPrefix={idPrefix}
        offer={offer}
        onReplace={onReplace}
        project={project}
      />
    </div>
  );
}

export function CountedRewardEditor({
  binding,
  candidateOwner,
  candidateProjection,
  catalog,
  offer,
  idPrefix,
  onReplace,
  project,
}: CountedRewardEditorProps) {
  return (
    <RewardValueEditor
      candidateOwner={candidateOwner}
      candidateProjection={candidateProjection}
      catalog={catalog}
      idPrefix={idPrefix}
      offer={offer}
      onReplace={onReplace}
      project={project}
      rewardTypes={binding.allowedRewardTypes}
    />
  );
}
