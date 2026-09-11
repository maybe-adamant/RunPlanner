import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../declarations';
import { requirePositiveInteger } from './common';
import { normalizeLocalChildren } from './descriptors';
import { fail } from './errors';
import { normalizeFieldsSpatial } from './fields-spatial';
import type { RoomIdentityFacts } from './room-core-facts';
import { normalizeRewardBinding } from './rewardBindings';

export type RoomFieldsFacts = Pick<
  RoomDeclaration,
  'localChildren' | 'fieldsOptionalRewards' | 'fieldsSpatial'
>;

/** Normalizes room-local reward children at their reward-surface boundary. */
export function normalizeRoomLocalChildren(
  room: RawRoomDeclaration,
  rewards: RewardKernelCatalog,
  path: string,
): RoomDeclaration['localChildren'] {
  return normalizeLocalChildren(
    room.localChildren ?? [],
    `${path}.localChildren`,
    (binding, bindingPath) => {
      const normalized = normalizeRewardBinding(binding, rewards, bindingPath);
      if (normalized.kind !== 'countedChoice')
        fail(`${bindingPath}.kind`, 'bounded reward slots require countedChoice');
      return normalized;
    },
  );
}

/** Completes the coupled Fields local-child and placement product. */
export function normalizeRoomFieldsFacts(
  room: RawRoomDeclaration,
  identity: RoomIdentityFacts,
  localChildren: RoomDeclaration['localChildren'],
  rewards: RewardKernelCatalog,
  path: string,
): RoomFieldsFacts {
  const fieldsOptionalRewards = (() => {
    const raw = room.fieldsOptionalRewards;
    if (raw === undefined) return undefined;
    if (
      identity.mode.kind !== 'authored' ||
      identity.mode.templateKey !== 'FieldsCombat' ||
      raw.key !== 'optionalRewards'
    ) {
      fail(`${path}.fieldsOptionalRewards`, 'requires an authored FieldsCombat room');
    }
    const optionalRewardCapacity = requirePositiveInteger(
      raw.optionalRewardCapacity,
      `${path}.fieldsOptionalRewards.optionalRewardCapacity`,
    );
    if (optionalRewardCapacity < 2 || optionalRewardCapacity > 4) {
      fail(
        `${path}.fieldsOptionalRewards.optionalRewardCapacity`,
        'must be within the supported 2..4 map capacity',
      );
    }
    const reward = normalizeRewardBinding(
      raw.reward,
      rewards,
      `${path}.fieldsOptionalRewards.reward`,
    );
    if (
      reward.kind !== 'countedChoice' ||
      reward.storeKeys.length !== 1 ||
      reward.storeKeys[0] !== 'FieldsOptionalRewards'
    ) {
      fail(
        `${path}.fieldsOptionalRewards.reward.storeKeys`,
        'must contain only FieldsOptionalRewards',
      );
    }
    return Object.freeze({
      key: 'optionalRewards' as const,
      optionalRewardCapacity,
      slotKeys: Object.freeze(
        Array.from({ length: optionalRewardCapacity }, (_, index) => `optional${index + 1}`),
      ),
      reward,
    });
  })();
  const fieldsSpatial = normalizeFieldsSpatial(
    room.fieldsSpatial,
    `${path}.fieldsSpatial`,
    identity.mode.kind === 'authored' && identity.mode.templateKey === 'FieldsCombat',
  );
  return Object.freeze({
    localChildren,
    ...(fieldsOptionalRewards === undefined ? {} : { fieldsOptionalRewards }),
    ...(fieldsSpatial === undefined ? {} : { fieldsSpatial }),
  });
}
