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
import {
  type PreparedRewardDomainOption,
  type PreparedRewardPayloadDomain,
  type ProjectedRewardDomain,
  type ProjectedRewardDomainOption,
  type ProjectedRewardPayloadDomain,
} from '../../../projections/rewardDomainProjection';
import { explainCandidateEvaluation } from '../../../projections/contextualOptions';
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

interface RewardSelectOption {
  readonly evaluation?: CandidateOptionProjection<ResolvedRewardOffer>['evaluation'];
  readonly explanation?: string;
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
  readonly value: string;
}

interface ProjectedRewardSelectProps {
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly onActivate: () => Promise<void>;
  readonly options: readonly RewardSelectOption[];
  readonly value: string;
}

function isProjectedRewardOption(
  option: PreparedRewardDomainOption | ProjectedRewardDomainOption,
): option is ProjectedRewardDomainOption {
  return 'evaluation' in option;
}

function ProjectedRewardSelect({
  id,
  label,
  onChange,
  onActivate,
  options,
  value,
}: ProjectedRewardSelectProps) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex < 0 ? undefined : options[selectedIndex];
  const assessed = options.every((option) => option.evaluation !== undefined);
  const candidate = (option: RewardSelectOption | undefined) =>
    option?.evaluation === undefined
      ? undefined
      : { value: option.offer, evaluation: option.evaluation };
  return (
    <label className="field-control" htmlFor={id}>
      <span>{label}</span>
      <select
        {...candidateSelectState(candidate(selected))}
        aria-busy={!assessed}
        aria-describedby={selected?.explanation === undefined ? undefined : `${id}-explanation`}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => void onActivate()}
        onPointerDown={() => void onActivate()}
        onPointerEnter={() => void onActivate()}
        value={value}
      >
        {options.map((option, index) => (
          <option
            key={option.value}
            title={option.explanation}
            value={option.value}
            {...candidateSelectState(candidate(options[index]))}
          >
            {presentCandidateLabel(option.label, candidate(options[index]))}
          </option>
        ))}
      </select>
      {selected?.explanation === undefined ? null : (
        <small className="candidate-explanation" id={`${id}-explanation`}>
          {selected.explanation}
        </small>
      )}
    </label>
  );
}

function sourceLabel(catalog: Catalog, source: string): string {
  const declaration = catalog.rewards.rewardTypes.byKey[source];
  if (declaration === undefined) {
    throw new Error(`Payload source ${source} is missing`);
  }
  return declaration.label;
}

function RewardPayloadEditor({
  catalog,
  domain,
  idPrefix,
  onReplace,
  offer,
  onActivate,
}: {
  readonly catalog: Catalog;
  readonly domain: PreparedRewardPayloadDomain | ProjectedRewardPayloadDomain;
  readonly idPrefix: string;
  readonly offer: ResolvedRewardOffer;
  readonly onActivate: () => Promise<void>;
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
}) {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${offer.rewardType} is missing`);
  }
  if (declaration.payloadDomain === undefined) {
    return null;
  }
  if (domain.kind === 'none' || offer.payload === undefined) {
    throw new Error(`${declaration.gameName} has incomplete payload state`);
  }

  const selectOption = (
    candidate: PreparedRewardDomainOption | ProjectedRewardDomainOption,
  ): RewardSelectOption => {
    const explanation = isProjectedRewardOption(candidate)
      ? explainCandidateEvaluation(catalog, candidate.offerEvaluation)?.message
      : undefined;
    return {
      label: sourceLabel(catalog, candidate.key),
      offer: candidate.offer,
      value: candidate.key,
      ...(isProjectedRewardOption(candidate) ? { evaluation: candidate.offerEvaluation } : {}),
      ...(explanation === undefined ? {} : { explanation }),
    };
  };

  if (domain.kind === 'oneOf') {
    if (offer.payload.kind !== 'BoonSource') {
      throw new Error(`${declaration.gameName} requires a single-source payload`);
    }
    return (
      <ProjectedRewardSelect
        id={`${idPrefix}-source`}
        label="Source"
        onActivate={onActivate}
        onChange={(source) => {
          const candidate = domain.sources.find((option) => option.key === source);
          if (candidate === undefined) {
            throw new Error(`Reward source ${source} is outside its prepared domain`);
          }
          onReplace(candidate.offer);
        }}
        options={domain.sources.map(selectOption)}
        value={offer.payload.source}
      />
    );
  }

  if (offer.payload.kind !== 'DevotionPair') {
    throw new Error(`${declaration.gameName} requires a paired payload`);
  }
  const { chosenSource, spurnedSource } = offer.payload;
  return (
    <div className="paired-payload">
      <ProjectedRewardSelect
        id={`${idPrefix}-source-1`}
        label="Chosen source"
        onActivate={onActivate}
        onChange={(source) => {
          const candidate = domain.chosenSources.find((option) => option.key === source);
          if (candidate === undefined) {
            throw new Error(`Chosen source ${source} is outside its prepared domain`);
          }
          onReplace(candidate.offer);
        }}
        options={domain.chosenSources.map(selectOption)}
        value={chosenSource}
      />
      <ProjectedRewardSelect
        id={`${idPrefix}-source-2`}
        label="Spurned source"
        onActivate={onActivate}
        onChange={(source) => {
          const candidate = domain.spurnedSources.find((option) => option.key === source);
          if (candidate === undefined) {
            throw new Error(`Spurned source ${source} is outside its prepared domain`);
          }
          onReplace(candidate.offer);
        }}
        options={domain.spurnedSources.map(selectOption)}
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
  const prepared = candidateProjection.prepareRewardDomain(rewardTypes, offer);
  const projectionKey = JSON.stringify({ rewardTypes, offer });
  type Projection = {
    readonly key: string;
    readonly domain: ProjectedRewardDomain;
    readonly project: ProjectDocument;
  };
  type PendingProjection = {
    readonly key: string;
    readonly project: ProjectDocument;
    readonly promise: Promise<void>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const pendingRef = useRef<PendingProjection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const [projectionError, setProjectionError] = useState<Error>();
  if (projectionError !== undefined) {
    throw projectionError;
  }
  const projected =
    projection?.project === project && projection.key === projectionKey
      ? projection.domain
      : undefined;
  const domain = projected ?? prepared;
  const activateProjection = (): Promise<void> => {
    if (
      projected !== undefined ||
      (projectionRef.current?.project === project && projectionRef.current.key === projectionKey)
    ) {
      return Promise.resolve();
    }
    const pending = pendingRef.current;
    if (pending?.project === project && pending.key === projectionKey) {
      return pending.promise;
    }
    const request = {
      key: projectionKey,
      project,
    };
    const promise = candidateProjection
      .rewardDomain(project, candidateOwner, rewardTypes, offer)
      .then(
        (projectedDomain) => {
          if (
            pendingRef.current?.project !== request.project ||
            pendingRef.current.key !== request.key
          ) {
            return;
          }
          const next = { ...request, domain: projectedDomain };
          projectionRef.current = next;
          pendingRef.current = undefined;
          setProjection(next);
        },
        (error: unknown) => {
          if (
            pendingRef.current?.project !== request.project ||
            pendingRef.current.key !== request.key
          ) {
            return;
          }
          pendingRef.current = undefined;
          setProjectionError(error instanceof Error ? error : new Error(String(error)));
        },
      );
    pendingRef.current = { ...request, promise };
    return promise;
  };
  const typeOptions: readonly RewardSelectOption[] = domain.types.map((candidate) => {
    const declaration = catalog.rewards.rewardTypes.byKey[candidate.key];
    if (declaration === undefined) {
      throw new Error(`Reward type ${candidate.key} is missing`);
    }
    const explanation = isProjectedRewardOption(candidate)
      ? explainCandidateEvaluation(catalog, candidate.evaluation)?.message
      : undefined;
    return {
      label: declaration.label,
      offer: isProjectedRewardOption(candidate) ? candidate.supportingOffer : candidate.offer,
      value: candidate.key,
      ...(isProjectedRewardOption(candidate) ? { evaluation: candidate.evaluation } : {}),
      ...(explanation === undefined ? {} : { explanation }),
    };
  });
  return (
    <div className="reward-value-editor">
      <ProjectedRewardSelect
        id={`${idPrefix}-reward`}
        label="Reward"
        onActivate={activateProjection}
        onChange={(rewardType) => {
          const candidate = domain.types.find((option) => option.key === rewardType);
          if (candidate === undefined) {
            throw new Error(`Reward type ${rewardType} is outside its prepared domain`);
          }
          onReplace(
            isProjectedRewardOption(candidate) ? candidate.supportingOffer : candidate.offer,
          );
        }}
        options={typeOptions}
        value={offer.rewardType}
      />
      <RewardPayloadEditor
        catalog={catalog}
        domain={domain.payload}
        idPrefix={idPrefix}
        offer={offer}
        onActivate={activateProjection}
        onReplace={onReplace}
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
