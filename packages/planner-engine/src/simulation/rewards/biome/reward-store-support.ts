import type { BiomeLayout, RoomDeclaration } from '../../../catalog-schema';
import type { BatchRewardStoreAddress } from '../../../authored-project/addresses';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../materialization';
import type { HistoryStateView } from '../../history';
import type { RewardStoreCandidateSupport, RewardStoreSupportEntry } from '../model';
import { BiomeRewardSimulationContractError } from './biome-contract';

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
    .filter((entry) => entry.origin.biomeKey === source.origin.biomeKey)
    .map((entry) => entry.storeKey);
  const currentStore = enteredStoreKey(source, sourceDeclaration);
  const stores = currentStore === undefined ? priorStores : [...priorStores, currentStore];
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
    origin,
    historySequence,
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
