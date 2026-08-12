import type { Catalog } from '../../catalog-schema';
import {
  type IncomingRewardAddress,
  type AcquisitionEntryAddress,
  type LocalRewardAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { ProjectEvaluation } from '../project';
import type {
  RewardProducerCandidateArtifacts,
  RewardProducerCandidateCapability,
  RewardProducerCandidateResult,
  RewardProducerOwnerAddress,
} from '../rewards/producer-frontiers';
import {
  coverageUnavailable,
  producerUnavailable,
  unavailableForBiome,
  type CandidateContextUnavailable,
} from './availability';
import { candidateBiome, type CandidateBiomeEvaluation } from './evaluated-biome';
import { wheelState } from './ship-owner';

export interface IncomingRewardCandidateQuery {
  readonly kind: 'incomingReward';
  readonly reward: IncomingRewardAddress;
  readonly value: ResolvedRewardOffer;
}

export interface LocalRewardCandidateQuery {
  readonly kind: 'localReward';
  readonly reward: LocalRewardAddress;
  readonly value: ResolvedRewardOffer;
}

export interface RewardWheelOfferCandidateQuery {
  readonly kind: 'rewardWheelOffer';
  readonly offer: RewardWheelOfferAddress;
  readonly value: ResolvedRewardOffer;
}

export interface ShopOfferCandidateQuery {
  readonly kind: 'shopOffer';
  readonly offer: ShopOfferAddress;
  readonly value: ResolvedRewardOffer;
}

export interface AcquisitionEntryOfferCandidateQuery {
  readonly kind: 'acquisitionEntryOffer';
  readonly entry: AcquisitionEntryAddress;
  readonly value: ResolvedRewardOffer;
}

export type RewardProducerCandidateQuery =
  | IncomingRewardCandidateQuery
  | LocalRewardCandidateQuery
  | RewardWheelOfferCandidateQuery
  | ShopOfferCandidateQuery
  | AcquisitionEntryOfferCandidateQuery;

export interface EvaluatedIncomingRewardCandidate {
  readonly kind: 'incomingReward';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedLocalRewardCandidate {
  readonly kind: 'localReward';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedRewardWheelOfferCandidate {
  readonly kind: 'rewardWheelOffer';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedShopOfferCandidate {
  readonly kind: 'shopOffer';
  readonly result: RewardProducerCandidateResult;
}
export interface EvaluatedAcquisitionEntryOfferCandidate {
  readonly kind: 'acquisitionEntryOffer';
  readonly result: RewardProducerCandidateResult;
}

export type RewardProducerCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedIncomingRewardCandidate
  | EvaluatedLocalRewardCandidate
  | EvaluatedRewardWheelOfferCandidate
  | EvaluatedShopOfferCandidate
  | EvaluatedAcquisitionEntryOfferCandidate;

interface RewardProducerSource {
  readonly evaluation: CandidateBiomeEvaluation;
  readonly artifacts: RewardProducerCandidateArtifacts | undefined;
}

function selectedRewardProducerSource(
  evaluation: ProjectEvaluation,
  selectedArtifacts: RewardProducerCandidateArtifacts | undefined,
  owner: RewardProducerOwnerAddress,
): RewardProducerSource | undefined {
  const biome = candidateBiome(evaluation, owner.routeKey, owner.biomeKey);
  return biome === undefined
    ? undefined
    : Object.freeze({ evaluation: biome, artifacts: selectedArtifacts });
}

function ownerFor(query: RewardProducerCandidateQuery): RewardProducerOwnerAddress {
  return query.kind === 'incomingReward' || query.kind === 'localReward'
    ? query.reward
    : query.kind === 'acquisitionEntryOffer'
      ? query.entry
      : query.offer;
}

function checkpointFor(query: RewardProducerCandidateQuery) {
  return query.kind === 'incomingReward' || query.kind === 'localReward'
    ? ('afterTargetGeneration' as const)
    : ('afterRoomLifecycle' as const);
}

export function evaluateRewardProducerCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RewardProducerCandidateArtifacts | undefined,
  query: RewardProducerCandidateQuery,
): RewardProducerCandidateEvaluation {
  if (query.kind === 'rewardWheelOffer') {
    wheelState(catalog, project, query.offer);
  }
  const owner = ownerFor(query);
  const selected = selectedRewardProducerSource(evaluation, selectedArtifacts, owner);
  if (selected === undefined) {
    return unavailableForBiome(
      evaluation,
      owner.routeKey,
      owner.biomeKey,
      owner,
      checkpointFor(query),
    );
  }
  const capability: RewardProducerCandidateCapability | undefined = selected.artifacts?.at(owner);
  if (capability === undefined) {
    return selected.evaluation.coverage.kind === 'prefix'
      ? coverageUnavailable(evaluation, owner, checkpointFor(query))
      : producerUnavailable(owner);
  }
  const result = capability.evaluateOffer(owner, query.value);
  switch (query.kind) {
    case 'incomingReward':
      return Object.freeze({ kind: 'incomingReward', result });
    case 'localReward':
      return Object.freeze({ kind: 'localReward', result });
    case 'rewardWheelOffer':
      return Object.freeze({ kind: 'rewardWheelOffer', result });
    case 'shopOffer':
      return Object.freeze({ kind: 'shopOffer', result });
    case 'acquisitionEntryOffer':
      return Object.freeze({ kind: 'acquisitionEntryOffer', result });
  }
}
