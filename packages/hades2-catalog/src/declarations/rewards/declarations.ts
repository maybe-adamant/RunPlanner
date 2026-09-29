import type { RawRewardKernelInput } from './types';

import { acquisitions } from './acquisitions';
import { payloadDomains } from './payloads';
import { producerLifecycles } from './producer-lifecycles';
import { rewardTypes } from './reward-types';
import { shops } from './shops';
import { stores } from './stores';

export const rewardKernelDeclarations = {
  payloadDomains,
  acquisitions,
  rewardTypes,
  stores,
  shops,
  producerLifecycles,
  // RewardLogic.ChooseRoomReward: after two appended store copies stay ineligible.
  countedStoreFallbackRewardType: 'RoomRewardHealDrop',
} satisfies RawRewardKernelInput;
