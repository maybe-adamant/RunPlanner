import type { RoomDeclaration } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type { CanonicalFieldsOptionalReward, CanonicalLocalReward } from '../materialization';
import { BiomeRewardSimulationContractError } from './biome-contract';

/** Resolves the declaration binding for one materialized local reward slot. */
export function localRewardBinding(
  declaration: RoomDeclaration,
  reward: CanonicalLocalReward | CanonicalFieldsOptionalReward,
): CountedRewardBinding {
  if (reward.groupKey === 'optionalRewards') {
    const descriptor = declaration.fieldsOptionalRewards;
    if (
      descriptor === undefined ||
      !descriptor.slotKeys.includes(reward.slotKey) ||
      descriptor.reward.producerLifecycleKey !== reward.producerLifecycleKey
    )
      throw new BiomeRewardSimulationContractError(
        `${declaration.gameName} does not own optional reward ${reward.slotKey}`,
      );
    return descriptor.reward;
  }
  const descriptor = declaration.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.key === reward.groupKey,
  );
  if (
    descriptor?.kind !== 'boundedRewardSlots' ||
    !descriptor.slotKeys.includes(reward.slotKey) ||
    descriptor.reward.producerLifecycleKey !== reward.producerLifecycleKey
  )
    throw new BiomeRewardSimulationContractError(
      `${declaration.gameName} does not own local reward ${reward.groupKey}.${reward.slotKey}`,
    );
  return descriptor.reward;
}
