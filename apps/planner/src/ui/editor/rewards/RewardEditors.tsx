import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding } from '@run-planner/engine/reward-kernel';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { useRef, useState } from 'react';

import {
  presentCandidateLabel,
  type CandidateOptionProjection,
  type CandidateProjectionService,
  type CountedRewardCandidateOwner,
  type RewardCandidateOwner,
} from '../../../projections/candidateProjection';
import { candidateSelectState } from '../../feedback/candidatePresentation';

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

interface CountedRewardEditorProps extends Omit<
  RewardValueEditorProps,
  'candidateOwner' | 'rewardTypes'
> {
  readonly binding: CountedRewardBinding;
  readonly candidateOwner: CountedRewardCandidateOwner;
}

function projectRewardOptions(
  service: CandidateProjectionService,
  project: ProjectDocument,
  owner: RewardCandidateOwner,
  offers: readonly ResolvedRewardOffer[],
): readonly CandidateOptionProjection<ResolvedRewardOffer>[] {
  switch (owner.kind) {
    case 'incomingReward':
      return service.incomingRewards(project, owner.address, offers);
    case 'localReward':
      return service.localRewards(project, owner.address, offers);
    case 'rewardWheelOffer':
      return service.rewardWheelOffers(project, owner.address, offers);
    case 'shopOffer':
      return service.shopOffers(project, owner.address, offers);
  }
}

interface RewardSelectOption {
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
  readonly value: string;
}

interface ProjectedRewardSelectProps {
  readonly candidateOwner: RewardCandidateOwner;
  readonly candidateProjection: CandidateProjectionService;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly RewardSelectOption[];
  readonly project: ProjectDocument;
  readonly value: string;
}

function ProjectedRewardSelect({
  candidateOwner,
  candidateProjection,
  id,
  label,
  onChange,
  options,
  project,
  value,
}: ProjectedRewardSelectProps) {
  const projectionKey = JSON.stringify(options.map((option) => option.offer));
  type Projection = {
    readonly key: string;
    readonly options: readonly CandidateOptionProjection<ResolvedRewardOffer>[];
    readonly project: ProjectDocument;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const projected =
    projection?.project === project && projection.key === projectionKey
      ? projection.options
      : undefined;
  const activateProjection = () => {
    if (
      projected !== undefined ||
      (projectionRef.current?.project === project && projectionRef.current.key === projectionKey)
    ) {
      return;
    }
    const next = {
      key: projectionKey,
      options: projectRewardOptions(
        candidateProjection,
        project,
        candidateOwner,
        options.map((option) => option.offer),
      ),
      project,
    };
    projectionRef.current = next;
    setProjection(next);
  };
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex < 0 ? undefined : projected?.[selectedIndex];
  return (
    <label className="field-control" htmlFor={id}>
      <span>{label}</span>
      <select
        {...candidateSelectState(selected)}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        onFocus={activateProjection}
        onPointerDown={activateProjection}
        value={value}
      >
        {options.map((option, index) => (
          <option
            key={option.value}
            value={option.value}
            {...candidateSelectState(projected?.[index])}
          >
            {presentCandidateLabel(option.label, projected?.[index])}
          </option>
        ))}
      </select>
    </label>
  );
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
    return (
      <ProjectedRewardSelect
        candidateOwner={candidateOwner}
        candidateProjection={candidateProjection}
        id={`${idPrefix}-source`}
        label="Source"
        onChange={(source) => onReplace({ ...offer, payload: { kind: 'BoonSource', source } })}
        options={domain.values.map((source) => ({
          label: sourceLabel(catalog, source),
          offer: { ...offer, payload: { kind: 'BoonSource', source } },
          value: source,
        }))}
        project={project}
        value={offer.payload.source}
      />
    );
  }

  if (offer.payload.kind !== 'DevotionPair') {
    throw new Error(`${declaration.gameName} requires a paired payload`);
  }
  const values = payloadDomainValues(catalog, domain.valueDomain);
  const { chosenSource, spurnedSource } = offer.payload;
  const chosenOptions = values
    .filter((source) => source !== spurnedSource)
    .map((source) => ({
      label: sourceLabel(catalog, source),
      offer: {
        ...offer,
        payload: { kind: 'DevotionPair' as const, chosenSource: source, spurnedSource },
      },
      value: source,
    }));
  const spurnedOptions = values
    .filter((source) => source !== chosenSource)
    .map((source) => ({
      label: sourceLabel(catalog, source),
      offer: {
        ...offer,
        payload: { kind: 'DevotionPair' as const, chosenSource, spurnedSource: source },
      },
      value: source,
    }));
  return (
    <div className="paired-payload">
      <ProjectedRewardSelect
        candidateOwner={candidateOwner}
        candidateProjection={candidateProjection}
        id={`${idPrefix}-source-1`}
        label="Chosen source"
        onChange={(source) =>
          onReplace({
            ...offer,
            payload: { kind: 'DevotionPair', chosenSource: source, spurnedSource },
          })
        }
        options={chosenOptions}
        project={project}
        value={chosenSource}
      />
      <ProjectedRewardSelect
        candidateOwner={candidateOwner}
        candidateProjection={candidateProjection}
        id={`${idPrefix}-source-2`}
        label="Spurned source"
        onChange={(source) =>
          onReplace({
            ...offer,
            payload: { kind: 'DevotionPair', chosenSource, spurnedSource: source },
          })
        }
        options={spurnedOptions}
        project={project}
        value={spurnedSource}
      />
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
  return (
    <div className="reward-value-editor">
      <ProjectedRewardSelect
        candidateOwner={candidateOwner}
        candidateProjection={candidateProjection}
        id={`${idPrefix}-reward`}
        label="Reward"
        onChange={(rewardType) => onReplace(defaultOffer(catalog, rewardType))}
        options={typeOffers.map((candidate) => {
          const declaration = catalog.rewards.rewardTypes.byKey[candidate.rewardType];
          if (declaration === undefined) {
            throw new Error(`Reward type ${candidate.rewardType} is missing`);
          }
          return { label: declaration.label, offer: candidate, value: candidate.rewardType };
        })}
        project={project}
        value={offer.rewardType}
      />
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
  const rewardTypes = candidateProjection.countedRewardTypes(
    project,
    candidateOwner,
    binding,
    offer.rewardType,
  );
  return (
    <RewardValueEditor
      candidateOwner={candidateOwner}
      candidateProjection={candidateProjection}
      catalog={catalog}
      idPrefix={idPrefix}
      offer={offer}
      onReplace={onReplace}
      project={project}
      rewardTypes={rewardTypes}
    />
  );
}
