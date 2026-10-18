import type { RoomDeclaration } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type { IncomingRewardAddress, LocalRewardAddress } from '../addresses';
import type { RoomOccurrence } from '../model';

/**
 * The declared counted binding of an incoming reward or a Fields reward group:
 * a free Preboss door uses its takeover's remaining offers.
 */
export function countedRewardBinding(
  room: RoomDeclaration,
  stateKind: RoomOccurrence['state']['kind'],
  owner: Pick<IncomingRewardAddress, 'kind'> | Pick<LocalRewardAddress, 'kind' | 'groupKey'>,
): CountedRewardBinding | undefined {
  if (owner.kind === 'localReward') {
    const group = room.localChildren.find((child) => child.key === owner.groupKey);
    if (group?.kind === 'boundedRewardSlots') return group.reward;
    return room.fieldsOptionalRewards?.key === owner.groupKey
      ? room.fieldsOptionalRewards.reward
      : undefined;
  }
  if (stateKind === 'freeReward') {
    const policy = room.prebossBatchPolicy;
    return policy?.kind === 'takeOverNormalDoors' && policy.remainingOffers.kind === 'counted'
      ? policy.remainingOffers.reward
      : undefined;
  }
  return room.incomingReward.kind === 'countedChoice' ? room.incomingReward : undefined;
}
