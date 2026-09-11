import type {
  CatalogCollection,
  PrebossBatchPolicy,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type {
  EnteredRewardStoreHistoryPolicy,
  RewardKernelCatalog,
  RewardStoreDeclaration,
} from '@run-planner/engine/reward-kernel';

import type { RawPrebossBatchPolicy, RawRoomDeclaration } from '../../declarations/index';
import { fail } from '../errors';
import { normalizeRoomLocalChildren } from './fields-facts';
import { normalizeRewardBinding, requireRewardStoreKey } from '../rewards/bindings';

export type RoomRewardFacts = Pick<
  RoomDeclaration,
  'incomingReward' | 'localChildren' | 'offerRewardBinding' | 'prebossBatchPolicy'
>;

export type RoomRewardStoreFacts = Pick<
  RoomDeclaration,
  'forcedRewardStoreKey' | 'individualRewardStoreKey'
>;

function normalizePrebossBatchPolicy(
  raw: RawPrebossBatchPolicy,
  rewards: RewardKernelCatalog,
  path: string,
): PrebossBatchPolicy {
  if (raw.kind === 'retainNormalPeers') return Object.freeze({ kind: 'retainNormalPeers' });
  if (raw.kind !== 'takeOverNormalDoors') {
    fail(
      `${path}.kind`,
      `unknown Preboss batch policy ${String((raw as { kind?: unknown }).kind)}`,
    );
  }
  if (raw.remainingOffers.kind === 'none') {
    return Object.freeze({
      kind: 'takeOverNormalDoors',
      remainingOffers: Object.freeze({ kind: 'none' }),
    });
  }
  if (raw.remainingOffers.kind !== 'counted') {
    fail(
      `${path}.remainingOffers.kind`,
      `unknown remaining Preboss offer policy ${String((raw.remainingOffers as { kind?: unknown }).kind)}`,
    );
  }
  const reward = normalizeRewardBinding(
    raw.remainingOffers.reward,
    rewards,
    `${path}.remainingOffers.reward`,
  );
  if (reward.kind !== 'countedChoice')
    fail(`${path}.remainingOffers.reward.kind`, 'must be countedChoice');
  return Object.freeze({
    kind: 'takeOverNormalDoors',
    remainingOffers: Object.freeze({ kind: 'counted', reward }),
  });
}

/** Normalizes incoming and local reward surfaces before feature-specific reward facts. */
export function normalizeRoomRewardFacts(
  room: RawRoomDeclaration,
  rewards: RewardKernelCatalog,
  path: string,
): RoomRewardFacts {
  const incomingReward = normalizeRewardBinding(
    room.incomingReward,
    rewards,
    `${path}.incomingReward`,
  );
  const localChildren = normalizeRoomLocalChildren(room, rewards, path);
  const offerRewardBinding = (() => {
    const raw = room.offerRewardBinding;
    if (raw === undefined) {
      return Object.freeze(
        incomingReward.kind === 'none' || incomingReward.kind === 'shop'
          ? { kind: 'none' as const }
          : { kind: 'incomingReward' as const },
      );
    }
    if (raw.kind !== 'localRewardGroup') {
      fail(`${path}.offerRewardBinding.kind`, `unknown binding ${String(raw.kind)}`);
    }
    const group = localChildren.find((child) => child.key === raw.groupKey);
    if (group === undefined)
      fail(
        `${path}.offerRewardBinding.groupKey`,
        `unknown local reward group ${String(raw.groupKey)}`,
      );
    if (group.kind !== 'boundedRewardSlots') {
      fail(
        `${path}.offerRewardBinding.groupKey`,
        'offer reward groups must reference bounded reward slots',
      );
    }
    if (group.offerRewardCapability !== 'fieldsCages') {
      fail(
        `${path}.offerRewardBinding.groupKey`,
        'offer reward groups must declare the fieldsCages materialization capability',
      );
    }
    return Object.freeze({ kind: 'localRewardGroup' as const, groupKey: group.key });
  })();
  const prebossBatchPolicy =
    room.prebossBatchPolicy === undefined
      ? undefined
      : normalizePrebossBatchPolicy(room.prebossBatchPolicy, rewards, `${path}.prebossBatchPolicy`);
  return Object.freeze({
    incomingReward,
    localChildren,
    offerRewardBinding,
    ...(prebossBatchPolicy === undefined ? {} : { prebossBatchPolicy }),
  });
}

/** Normalizes reward-store overrides after required room objects. */
export function normalizeRoomRewardStoreFacts(
  room: RawRoomDeclaration,
  rewardFacts: RoomRewardFacts,
  rewards: RewardKernelCatalog,
  path: string,
): RoomRewardStoreFacts {
  const forcedRewardStoreKey =
    room.forcedRewardStoreKey === undefined
      ? undefined
      : requireRewardStoreKey(
          room.forcedRewardStoreKey,
          rewards.stores,
          `${path}.forcedRewardStoreKey`,
        );
  const individualRewardStoreKey =
    room.individualRewardStoreKey === undefined
      ? undefined
      : requireRewardStoreKey(
          room.individualRewardStoreKey,
          rewards.stores,
          `${path}.individualRewardStoreKey`,
        );
  for (const [field, storeKey] of [
    ['forcedRewardStoreKey', forcedRewardStoreKey],
    ['individualRewardStoreKey', individualRewardStoreKey],
  ] as const) {
    if (
      storeKey !== undefined &&
      rewardFacts.incomingReward.kind === 'countedChoice' &&
      !rewardFacts.incomingReward.storeKeys.includes(storeKey)
    ) {
      fail(`${path}.${field}`, `${storeKey} is not accepted by the incoming producer`);
    }
    const remainingReward =
      rewardFacts.prebossBatchPolicy?.kind === 'takeOverNormalDoors' &&
      rewardFacts.prebossBatchPolicy.remainingOffers.kind === 'counted'
        ? rewardFacts.prebossBatchPolicy.remainingOffers.reward
        : undefined;
    if (
      storeKey !== undefined &&
      !remainingReward?.storeKeys.includes(storeKey) &&
      remainingReward !== undefined
    ) {
      fail(`${path}.${field}`, `${storeKey} is not accepted by the remaining-offer producer`);
    }
  }
  return Object.freeze({
    ...(forcedRewardStoreKey === undefined ? {} : { forcedRewardStoreKey }),
    ...(individualRewardStoreKey === undefined ? {} : { individualRewardStoreKey }),
  });
}

/** Normalizes the room-entered reward-store history policy at its original final boundary. */
export function normalizeEnteredStoreHistory(
  policy: EnteredRewardStoreHistoryPolicy,
  stores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): EnteredRewardStoreHistoryPolicy {
  const receivedKind: unknown = (policy as { readonly kind?: unknown }).kind;
  if (policy.kind === 'none' || policy.kind === 'resolvedOffer')
    return Object.freeze({ kind: policy.kind });
  if (policy.kind !== 'fixed')
    fail(`${path}.kind`, `unknown entered-store history policy ${String(receivedKind)}`);
  return Object.freeze({
    kind: 'fixed',
    storeKey: requireRewardStoreKey(policy.storeKey, stores, `${path}.storeKey`),
  });
}
