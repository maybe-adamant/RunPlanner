import type { BiomeLayout, RoomDeclaration } from '../../../catalog-schema';
import type { BatchRewardStoreAddress } from '../../../authored-project/addresses';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../materialization';
import type { HistoryStateView } from '../../history';
import type { RewardStoreCandidateSupport, RewardStoreSupportEntry } from '../model';
import { BiomeRewardSimulationContractError } from './biome-contract';

export interface RewardStoreHistorySupport {
  readonly enteredStoreCount: number;
  readonly enteredMetaStoreCount: number;
  readonly currentMetaRatio: number | null;
  readonly metaSelectionValue: number;
  readonly supportStoreKeys: readonly string[];
}

function enteredStoreKey(
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
): string | undefined {
  switch (declaration.enteredRewardStoreHistory.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return declaration.enteredRewardStoreHistory.storeKey;
    case 'resolvedOffer':
      return room.incomingReward?.resolvedStoreKey;
  }
}

/** Projects one authored base-store decision from its immutable layout and history facts. */
export function rewardStoreCandidateSupport(
  layout: BiomeLayout,
  origin: BatchRewardStoreAddress,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  historySequence: number,
): RewardStoreCandidateSupport {
  const currentStore = enteredStoreKey(source, sourceDeclaration);
  const support = rewardStoreHistorySupport(layout, source.origin.biomeKey, view, currentStore);
  return Object.freeze({
    origin,
    historySequence,
    ...support,
  });
}

/**
 * Resolves the Run/Meta support at a generated reward offer's history
 * boundary. Unlike a batch store, an O wheel has no entered-store value of
 * its own yet, so callers omit `currentStoreKey`.
 */
export function rewardStoreHistorySupport(
  layout: BiomeLayout,
  biomeKey: string,
  view: HistoryStateView,
  currentStoreKey?: string,
): RewardStoreHistorySupport {
  if (layout.progression.kind !== 'generated') {
    throw new BiomeRewardSimulationContractError(
      'Hub progression has no authored base-store policy',
    );
  }
  const policy = layout.progression.rewardStorePolicy;
  if (policy.kind !== 'authoredBaseStore') {
    throw new BiomeRewardSimulationContractError(
      'generated progression lost its authored base-store contract',
    );
  }
  const priorStores = view.ledgers.enteredRewardStores
    .filter((entry) => entry.origin.biomeKey === biomeKey)
    .map((entry) => entry.storeKey);
  const stores = currentStoreKey === undefined ? priorStores : [...priorStores, currentStoreKey];
  const metaCount = stores.filter((storeKey) => storeKey === 'MetaProgress').length;
  const ratio = stores.length === 0 ? null : metaCount / stores.length;
  const metaSelectionValue =
    ratio === null
      ? policy.targetMetaRewardsRatio
      : policy.targetMetaRewardsRatio +
        policy.targetMetaRewardsAdjustSpeed * (policy.targetMetaRewardsRatio - ratio);
  const supportStoreKeys = Object.freeze(
    metaSelectionValue <= 0
      ? policy.storeKeys.filter((storeKey) => storeKey !== 'MetaProgress')
      : metaSelectionValue >= 1
        ? policy.storeKeys.filter((storeKey) => storeKey === 'MetaProgress')
        : [...policy.storeKeys],
  );
  return Object.freeze({
    enteredStoreCount: stores.length,
    enteredMetaStoreCount: metaCount,
    currentMetaRatio: ratio,
    metaSelectionValue,
    supportStoreKeys,
  });
}

export function assessAuthoredBatchRewardStore(
  layout: BiomeLayout,
  batch: Pick<CanonicalBatch, 'rewardStore'>,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  historySequence: number,
): RewardStoreSupportEntry {
  if (batch.rewardStore.kind !== 'authoredBaseStore') {
    throw new BiomeRewardSimulationContractError(
      'generated batch lost its authored base-store contract',
    );
  }
  const support = rewardStoreCandidateSupport(
    layout,
    batch.rewardStore.origin,
    source,
    sourceDeclaration,
    view,
    historySequence,
  );
  return Object.freeze({
    ...support,
    authoredStoreKey: batch.rewardStore.baseRewardStoreKey,
    selectedPossible: support.supportStoreKeys.includes(batch.rewardStore.baseRewardStoreKey),
  });
}
