import type { Catalog } from '../../catalog-schema';
import {
  type IncomingRewardAddress,
  type AcquisitionEntryAddress,
  type LocalRewardAddress,
  type StartingRewardAddress,
  type RewardWheelOfferAddress,
  type ShopOfferAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { RouteLoadout } from '../../authored-project/model';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { createRouteStartHistoryView } from '../history/fold';
import type { ResolvedRewardOffer, ShopOptionSelection } from '../../reward-kernel';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import {
  createRewardProducerCandidateResult,
  type RewardProducerCandidateArtifacts,
  type RewardProducerCandidateCapability,
  type RewardProducerCandidateResult,
  type RewardProducerOwnerAddress,
} from '../rewards/producer-frontiers';
import { initializeRewardBranches } from '../rewards/branch-lifecycle';
import { createArcanaFearState } from '../arcana-fear';
import { createRouteStartRewardFacts } from '../rewards/facts';
import { processRewardOffer } from '../rewards/offer-generation';
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

/** A route-owned offer candidate that is valid before any entry room is selected. */
export interface StartingRewardCandidateQuery {
  readonly kind: 'startingReward';
  readonly reward: StartingRewardAddress;
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

export interface ShopOfferOptionCandidateQuery {
  readonly kind: 'shopOfferOption';
  readonly offer: ShopOfferAddress;
  readonly value: ShopOptionSelection;
}

export interface AcquisitionEntryOfferCandidateQuery {
  readonly kind: 'acquisitionEntryOffer';
  readonly entry: AcquisitionEntryAddress;
  readonly value: ResolvedRewardOffer;
}

export type RewardProducerCandidateQuery =
  | StartingRewardCandidateQuery
  | IncomingRewardCandidateQuery
  | LocalRewardCandidateQuery
  | RewardWheelOfferCandidateQuery
  | ShopOfferCandidateQuery
  | ShopOfferOptionCandidateQuery
  | AcquisitionEntryOfferCandidateQuery;

export interface EvaluatedIncomingRewardCandidate {
  readonly kind: 'incomingReward';
  readonly result: RewardProducerCandidateResult;
}

export interface EvaluatedStartingRewardCandidate {
  readonly kind: 'startingReward';
  readonly result: RewardProducerCandidateResult;
}

/** A route-assembly-captured offer frontier; queries never recreate its seed. */
export interface StartingRewardCandidateCapability {
  readonly evaluateOffer: (offer: ResolvedRewardOffer) => RewardProducerCandidateResult;
}

export function createStartingRewardCandidateCapability(
  catalog: Catalog,
  routeKey: string,
  reward: StartingRewardAddress,
  loadout: RouteLoadout,
  routePosition: ResolvedRoutePosition,
): StartingRewardCandidateCapability {
  const binding = catalog.runStartReward.incomingReward;
  const branches = initializeRewardBranches(
    undefined,
    createArcanaFearState(catalog, loadout),
    catalog,
    loadout.startingKeepsakeKey,
    loadout.keepsakeEquipResults,
    routeKey,
    loadout,
    { routePosition, historyView: createRouteStartHistoryView() },
  );
  return Object.freeze({
    evaluateOffer: (offer: ResolvedRewardOffer) => {
      const findings = new Map();
      const evaluated = processRewardOffer(
        branches,
        {
          catalog,
          reward: Object.freeze({
            origin: reward,
            offer,
            producerLifecycleKey: binding.producerLifecycleKey,
            ...(binding.storeKeys[0] === undefined
              ? {}
              : { resolvedStoreKey: binding.storeKeys[0] }),
          }),
          binding,
          historySequence: 0,
          peers: Object.freeze([]),
          facts: (history, _shopNames, branch) =>
            createRouteStartRewardFacts(catalog, reward, history, branch),
        },
        findings,
      );
      return createRewardProducerCandidateResult(findings, evaluated);
    },
  });
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
  | EvaluatedStartingRewardCandidate
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
  if (query.kind === 'startingReward') {
    throw new Error('route-start reward has no room-owned producer address');
  }
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
  startingRewardCapability: StartingRewardCandidateCapability | undefined,
  query: RewardProducerCandidateQuery,
): RewardProducerCandidateEvaluation {
  if (query.kind === 'startingReward') {
    if (project.route.routeKey !== query.reward.routeKey) {
      throw new Error(`unknown route ${query.reward.routeKey} for starting reward candidate`);
    }
    if (startingRewardCapability === undefined) return producerUnavailable(query.reward);
    return Object.freeze({
      kind: 'startingReward',
      result: startingRewardCapability.evaluateOffer(query.value),
    });
  }
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
  if (query.kind === 'shopOfferOption') {
    const evaluate = capability.evaluateShopOption;
    if (evaluate === undefined) return producerUnavailable(owner);
    return Object.freeze({ kind: 'shopOffer', result: evaluate(query.offer, query.value) });
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
