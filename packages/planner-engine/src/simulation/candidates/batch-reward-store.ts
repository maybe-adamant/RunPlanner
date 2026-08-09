import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createExitDecisionAddress,
  semanticAddressKey,
  type BatchRewardStoreAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import { exitDecisionForSource } from '../../authored-project/topology/query';
import { rewardStoreCandidateSupport, type RewardStoreCandidateSupport } from '../rewards';
import type { ProjectEvaluation } from '../project';
import {
  unavailableForBiome,
  unreachableTarget,
  type CandidateContextUnavailable,
} from './availability';
import {
  candidateAssessmentPrefix,
  candidateBiome,
  candidatePrefix,
  planFor,
  prefixAuthoredRooms,
  prefixBiome,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';

export interface BatchRewardStoreCandidateQuery {
  readonly kind: 'batchRewardStore';
  readonly rewardStore: BatchRewardStoreAddress;
  readonly storeKey: string;
}

export interface BatchRewardStoreCandidateSupport extends RewardStoreCandidateSupport {
  readonly authoredStoreKey?: string;
  readonly selectedStoreKey: string;
  readonly selectedPossible: boolean;
}

export interface EvaluatedBatchRewardStoreCandidate {
  readonly kind: 'batchRewardStore';
  readonly result: BatchRewardStoreCandidateSupport;
}

export type BatchRewardStoreCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedBatchRewardStoreCandidate;

export interface UnresolvedBatchRewardStorePrerequisiteEvidence {
  readonly kind: 'authoredPrerequisiteMissing';
  readonly prerequisite: {
    readonly kind: 'batchRewardStore';
    readonly owner: BatchRewardStoreAddress;
  };
}

/** Evidence that this source cannot generate targets until its authored store is selected. */
export function unresolvedBatchRewardStorePrerequisite(
  project: ProjectDocument,
  rewardStore: BatchRewardStoreAddress,
): UnresolvedBatchRewardStorePrerequisiteEvidence | undefined {
  const plan = planFor(project, rewardStore.routeKey, rewardStore.biomeKey);
  const decision =
    plan.topology === null ? undefined : exitDecisionForSource(plan.topology, rewardStore.source);
  if (
    decision?.kind !== 'exit' ||
    decision.normal.kind !== 'batch' ||
    decision.normal.rewardStore.kind !== 'authoredBaseStore' ||
    decision.normal.rewardStore.baseRewardStoreKey !== null
  ) {
    return undefined;
  }
  return Object.freeze({
    kind: 'authoredPrerequisiteMissing',
    prerequisite: Object.freeze({ kind: 'batchRewardStore', owner: rewardStore }),
  });
}

function prefixBatchRewardStoreSupport(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: BatchRewardStoreCandidateQuery,
  candidate?: CandidateBiomeEvaluation,
): BatchRewardStoreCandidateSupport | undefined {
  const biome = candidatePrefix(
    candidate ?? prefixBiome(evaluation, query.rewardStore.routeKey, query.rewardStore.biomeKey),
  );
  const prefix = candidateAssessmentPrefix(biome);
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  const decision = createExitDecisionAddress(
    createBiomeAddress(query.rewardStore.routeKey, query.rewardStore.biomeKey),
    query.rewardStore.source,
  );
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(decision)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const source = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const sourceDeclaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  const sourceHistory =
    source === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        )?.preOutgoing;
  const plan = planFor(project, query.rewardStore.routeKey, query.rewardStore.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (
    source === undefined ||
    sourceDeclaration === undefined ||
    sourceHistory === undefined ||
    layout?.progression.kind !== 'generated'
  ) {
    return undefined;
  }
  const support = rewardStoreCandidateSupport(
    layout,
    query.rewardStore,
    source,
    sourceDeclaration,
    sourceHistory,
    sourceHistory.sequence + 1,
  );
  return Object.freeze({
    ...support,
    selectedStoreKey: query.storeKey,
    selectedPossible: support.supportStoreKeys.includes(query.storeKey),
  });
}

export function evaluateBatchRewardStoreCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: BatchRewardStoreCandidateQuery,
): BatchRewardStoreCandidateEvaluation {
  const biome = candidateBiome(evaluation, query.rewardStore.routeKey, query.rewardStore.biomeKey);
  if (biome === undefined) {
    const prefixSupport = prefixBatchRewardStoreSupport(catalog, project, evaluation, query);
    return prefixSupport === undefined
      ? unavailableForBiome(
          evaluation,
          query.rewardStore.routeKey,
          query.rewardStore.biomeKey,
          query.rewardStore,
          'afterTargetGeneration',
        )
      : Object.freeze({ kind: 'batchRewardStore', result: prefixSupport });
  }
  const support = biome.rewards.storeSupport.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(query.rewardStore),
  );
  if (support === undefined) {
    const prefixSupport = prefixBatchRewardStoreSupport(catalog, project, evaluation, query, biome);
    if (prefixSupport !== undefined) {
      return Object.freeze({ kind: 'batchRewardStore', result: prefixSupport });
    }
    return 'snapshot' in biome
      ? unreachableTarget(query.rewardStore)
      : unavailableForBiome(
          evaluation,
          query.rewardStore.routeKey,
          query.rewardStore.biomeKey,
          query.rewardStore,
          'afterTargetGeneration',
        );
  }
  return Object.freeze({
    kind: 'batchRewardStore',
    result: Object.freeze({
      ...support,
      selectedStoreKey: query.storeKey,
      selectedPossible: support.supportStoreKeys.includes(query.storeKey),
    }),
  });
}
