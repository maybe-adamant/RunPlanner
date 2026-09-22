import type { BiomeLayout, RewardStorePolicy, RoomDeclaration } from '../../../catalog-schema';
import type { EnteredRewardStoreHistoryPolicy } from '../../../reward-kernel/bindings';
import type { BatchRewardStoreAddress } from '../../../authored-project/addresses';
import { bossDoorRewardStorePolicyForLayout } from '../../../authored-project/topology/query';
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

/**
 * The declaration-owned answer to "which store does entering this room count
 * with". A materialized room may carry an exact resolved key, which the route
 * start supplies for its loadout-owned starting reward; otherwise the room's
 * declared policy decides. This is the single owner: the lifecycle input reads
 * it through its own wrapper rather than repeating the switch.
 */
export function declaredEnteredStoreKey(
  room: Pick<CanonicalAuthoredRoom, 'enteredRewardStoreKey' | 'incomingReward'>,
  policy: EnteredRewardStoreHistoryPolicy,
): string | undefined {
  if (room.enteredRewardStoreKey !== undefined) return room.enteredRewardStoreKey;
  switch (policy.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return policy.storeKey;
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
  const currentStore = declaredEnteredStoreKey(source, sourceDeclaration.enteredRewardStoreHistory);
  const support = rewardStoreHistorySupport(layout, view, currentStore);
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
  return rewardStorePolicySupport(policy, view, currentStoreKey);
}

/**
 * The same controller at a boss door. The door is an ordinary door, so the
 * math is identical and only the policy differs: Q's ordinary doors carry no
 * store while its boss door still rolls, so the bound comes from the completion
 * descriptor. Sharing `rewardStorePolicySupport` keeps the selector's support
 * and the ordinary batch's support one implementation.
 */
export function bossDoorRewardStoreHistorySupport(
  layout: BiomeLayout,
  view: HistoryStateView,
  currentStoreKey?: string,
): RewardStoreHistorySupport {
  const policy = bossDoorRewardStorePolicyForLayout(layout);
  if (policy?.kind !== 'authoredBaseStore') {
    throw new BiomeRewardSimulationContractError('this boss door has no authored-store policy');
  }
  return rewardStorePolicySupport(policy, view, currentStoreKey);
}

function rewardStorePolicySupport(
  policy: Extract<RewardStorePolicy, { readonly kind: 'authoredBaseStore' }>,
  view: HistoryStateView,
  currentStoreKey?: string,
): RewardStoreHistorySupport {
  // Run-scoped, not per-biome: native CalcMetaProgressRatio (RewardLogic.lua:
  // 469-489) walks the whole run.RoomHistory plus CurrentRoom, so every counted
  // room entered so far in the run feeds the ratio regardless of which biome
  // recorded it. The controller has no per-biome window to reset.
  const priorStores = view.ledgers.enteredRewardStores.map((entry) => entry.storeKey);
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

/**
 * The boss-door twin of `assessAuthoredBatchRewardStore`. The roll happens as
 * the Preboss is left, so the boundary is the Preboss's exit view; its own
 * entered store is already folded into that view, so no `currentStoreKey` is
 * appended (appending would count the Preboss twice). Publishing this entry is
 * what lets `baseRewardStoreUnavailable` fire on a boss door exactly as it does
 * on an ordinary batch, and what lets the selector resolve real support on a
 * complete biome.
 */
export function assessAuthoredBossDoorRewardStore(
  layout: BiomeLayout,
  origin: BatchRewardStoreAddress,
  authoredStoreKey: string,
  view: HistoryStateView,
  historySequence: number,
): RewardStoreSupportEntry {
  const support = bossDoorRewardStoreHistorySupport(layout, view);
  return Object.freeze({
    origin,
    historySequence,
    ...support,
    authoredStoreKey,
    selectedPossible: support.supportStoreKeys.includes(authoredStoreKey),
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
