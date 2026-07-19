import { rewardKernelDeclarations } from './declarations';
import { createRewardKernelCatalog } from './normalize';

export const rewardKernelCatalog = createRewardKernelCatalog(rewardKernelDeclarations);

export { ordinarySources, rewardKernelDeclarations } from './declarations';
export { createRewardKernelCatalog } from './normalize';
export type {
  RawAcquisitionRoleDeclaration,
  RawConcreteAcquisitionDeclaration,
  RawPayloadDomainDeclaration,
  RawProducerLifecycleOverrideDeclaration,
  RawProducerLifecycleProfileDeclaration,
  RawRewardKernelInput,
  RawRewardStoreDeclaration,
  RawRewardStoreEntryDeclaration,
  RawRewardTypeDeclaration,
  RawShopGroupDeclaration,
  RawShopOptionEntryDeclaration,
  RawShopProfileDeclaration,
  RawShopSlotDeclaration,
} from './types';
