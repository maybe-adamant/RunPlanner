import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  semanticAddressKey,
  type IncomingRewardAddress,
  type LocalRewardAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import type { ProjectEvaluation } from '../project';
import {
  evaluateProgressiveBiomeAssembly,
  evaluateProgressiveBiomeAssemblyBeforeClamp,
  type ProgressiveBiomeEvaluationAssembly,
} from '../progressive/biome';
import type {
  RewardProducerCandidateArtifacts,
  RewardProducerCandidateCapability,
  RewardProducerCandidateResult,
  RewardProducerOwnerAddress,
} from '../rewards/producer-frontiers';
import {
  producerUnavailable,
  unavailableForBiome,
  type CandidateContextUnavailable,
} from './availability';
import {
  candidateBlockedAt,
  completeBiome,
  completeBiomeCount,
  planFor,
  prefixBiome,
  progressiveSeed,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';
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

export type RewardProducerCandidateQuery =
  | IncomingRewardCandidateQuery
  | LocalRewardCandidateQuery
  | RewardWheelOfferCandidateQuery
  | ShopOfferCandidateQuery;

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

export type RewardProducerCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedIncomingRewardCandidate
  | EvaluatedLocalRewardCandidate
  | EvaluatedRewardWheelOfferCandidate
  | EvaluatedShopOfferCandidate;

interface RewardProducerSource {
  readonly evaluation: CandidateBiomeEvaluation;
  readonly artifacts: RewardProducerCandidateArtifacts | undefined;
}

function selectedRewardProducerSource(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selectedArtifacts: RewardProducerCandidateArtifacts | undefined,
  owner: RewardProducerOwnerAddress,
): RewardProducerSource | undefined {
  const complete = completeBiome(evaluation, owner.routeKey, owner.biomeKey);
  if (complete?.validity === 'invalid') {
    const progressive = evaluateProgressiveBiomeAssembly(
      catalog,
      createBiomeAddress(owner.routeKey, owner.biomeKey),
      planFor(project, owner.routeKey, owner.biomeKey),
      completeBiomeCount(evaluation, owner.routeKey, owner.biomeKey),
      progressiveSeed(evaluation, owner.routeKey, owner.biomeKey),
    );
    return progressive === null
      ? undefined
      : Object.freeze({
          evaluation: progressive.evaluation,
          artifacts: progressive.candidateArtifacts.rewardProducers,
        });
  }
  const biome = complete ?? prefixBiome(evaluation, owner.routeKey, owner.biomeKey);
  return biome === undefined
    ? undefined
    : Object.freeze({ evaluation: biome, artifacts: selectedArtifacts });
}

function repairAssemblyForOwner(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selected: RewardProducerSource,
  owner: RewardProducerOwnerAddress,
): ProgressiveBiomeEvaluationAssembly | undefined {
  // Incoming/free rewards are produced when their target is generated. The
  // progressive assembly now retains that exact offer-time boundary without
  // the target's lifecycle; reopening the raw full prefix here would add
  // acquisition and downstream reward facts back into a blocked route.
  if (owner.kind === 'incomingReward') return undefined;
  const blockedAt = candidateBlockedAt(selected.evaluation);
  if (blockedAt === undefined || semanticAddressKey(blockedAt) !== semanticAddressKey(owner)) {
    return undefined;
  }
  const raw = evaluateProgressiveBiomeAssemblyBeforeClamp(
    catalog,
    createBiomeAddress(owner.routeKey, owner.biomeKey),
    planFor(project, owner.routeKey, owner.biomeKey),
    completeBiomeCount(evaluation, owner.routeKey, owner.biomeKey),
    progressiveSeed(evaluation, owner.routeKey, owner.biomeKey),
  );
  return raw !== null &&
    raw.evaluation.blockedAt !== undefined &&
    semanticAddressKey(raw.evaluation.blockedAt) === semanticAddressKey(owner)
    ? raw
    : undefined;
}

function producerCapability(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  selected: RewardProducerSource,
  owner: RewardProducerOwnerAddress,
): RewardProducerCandidateCapability | undefined {
  const repair = repairAssemblyForOwner(catalog, project, evaluation, selected, owner);
  return repair?.candidateArtifacts.rewardProducers.at(owner) ?? selected.artifacts?.at(owner);
}

function ownerFor(query: RewardProducerCandidateQuery): RewardProducerOwnerAddress {
  return query.kind === 'incomingReward' || query.kind === 'localReward'
    ? query.reward
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
  const selected = selectedRewardProducerSource(
    catalog,
    project,
    evaluation,
    selectedArtifacts,
    owner,
  );
  if (selected === undefined) {
    return unavailableForBiome(
      evaluation,
      owner.routeKey,
      owner.biomeKey,
      owner,
      checkpointFor(query),
    );
  }
  const capability = producerCapability(catalog, project, evaluation, selected, owner);
  if (capability === undefined) {
    return producerUnavailable(owner);
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
  }
}
